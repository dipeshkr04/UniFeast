import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { outsideFoodAPI } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { HiArrowLeft, HiOutlineClock, HiOutlineLocationMarker, HiOutlineUserGroup } from 'react-icons/hi';
import { MdOutlineRestaurant } from 'react-icons/md';
import toast from 'react-hot-toast';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatTimeLeft(value, now = Date.now()) {
  const target = new Date(value).getTime();
  if (Number.isNaN(target)) return 'Soon';

  const totalSeconds = Math.max(0, Math.ceil((target - now) / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatClock(value) {
  if (!value) return 'Not set';
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function mergeMessage(list, message) {
  if (!message?._id) return list;
  const messageId = message._id.toString();
  if (list.some((item) => item._id?.toString() === messageId)) {
    return list.map((item) => (item._id?.toString() === messageId ? { ...item, ...message } : item));
  }
  return [...list, message];
}

function isRoomClosed(pool) {
  return pool?.archived || pool?.status === 'ARCHIVED';
}

function mergePoolState(previous, update, { preserveViewer = true } = {}) {
  if (!previous) return update;
  if (!update?._id && !update?.poolId) return previous;
  const updateId = (update._id || update.poolId).toString();
  if (previous._id?.toString() !== updateId) return previous;

  return {
    ...previous,
    ...update,
    restaurant: update.restaurant || previous.restaurant,
    participants: update.participants || previous.participants,
    viewer: preserveViewer ? previous.viewer : (update.viewer || previous.viewer),
  };
}

function participantInitial(name) {
  return String(name || 'S').charAt(0).toUpperCase();
}

function isCoordinatorParticipant(pool, participant) {
  return (pool?.coordinators || []).some((coordinator) => (
    coordinator.userId?.toString?.() === participant.userId?.toString?.()
  ));
}

export default function OutsideFoodPoolPage() {
  const { poolId } = useParams();
  const navigate = useNavigate();
  const { socket, connected } = useSocket() || {};
  const [pool, setPool] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageDraft, setMessageDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState('');
  const [joinAmount, setJoinAmount] = useState('');
  const [joinNote, setJoinNote] = useState('');
  const [joining, setJoining] = useState(false);
  const [sending, setSending] = useState(false);
  const [nowMs, setNowMs] = useState(Date.now());
  const bottomRef = useRef(null);

  const loadRoom = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await outsideFoodAPI.pools.getOne(poolId);
      const nextPool = data.data;
      setPool(nextPool);

      if (nextPool.viewer?.isParticipant || nextPool.viewer?.isAdmin) {
        const messageResponse = await outsideFoodAPI.chat.getMessages(poolId);
        setMessages(messageResponse.data.data || []);
      } else {
        setMessages([]);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to open outside food room');
      navigate('/outside-food');
    } finally {
      setLoading(false);
    }
  }, [navigate, poolId]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    if (!socket || !connected || !poolId || !(pool?.viewer?.isParticipant || pool?.viewer?.isAdmin)) {
      return undefined;
    }

    const handlePoolStatus = (payload) => {
      setPool((previous) => mergePoolState(previous, payload, { preserveViewer: false }));
    };
    const handlePoolUpdate = (payload) => {
      setPool((previous) => mergePoolState(previous, payload));
    };
    const handleParticipantUpdate = (payload) => {
      setPool((previous) => mergePoolState(previous, payload));
    };
    const handleMessage = (message) => {
      setMessages((previous) => mergeMessage(previous, message));
    };
    const handleUnlock = (payload) => {
      setPool((previous) => mergePoolState(previous, payload));
      toast.success('Pool unlocked. Restaurant details are available now.');
    };
    const handleLock = (payload) => {
      setPool((previous) => mergePoolState(previous, payload));
      toast('This pool is locked. Coordination continues in the room.');
    };
    const handleCoordinatorUpdate = (payload) => {
      setPool((previous) => mergePoolState(previous, payload));
    };
    const handleGraceTimer = (payload) => {
      setPool((previous) => mergePoolState(previous, payload));
    };
    const handleStatusUpdate = (payload) => {
      setPool((previous) => mergePoolState(previous, payload));
    };
    const handleSocketError = (payload) => {
      toast.error(payload?.message || 'Outside food room error');
    };

    socket.emit('pool:join', { poolId });
    socket.on('pool:status', handlePoolStatus);
    socket.on('pool:update', handlePoolUpdate);
    socket.on('pool:participant-update', handleParticipantUpdate);
    socket.on('pool:message', handleMessage);
    socket.on('pool:unlock', handleUnlock);
    socket.on('pool:lock', handleLock);
    socket.on('pool:coordinator-update', handleCoordinatorUpdate);
    socket.on('pool:grace-timer', handleGraceTimer);
    socket.on('pool:status-update', handleStatusUpdate);
    socket.on('pool:error', handleSocketError);

    return () => {
      socket.emit('pool:leave', { poolId });
      socket.off('pool:status', handlePoolStatus);
      socket.off('pool:update', handlePoolUpdate);
      socket.off('pool:participant-update', handleParticipantUpdate);
      socket.off('pool:message', handleMessage);
      socket.off('pool:unlock', handleUnlock);
      socket.off('pool:lock', handleLock);
      socket.off('pool:coordinator-update', handleCoordinatorUpdate);
      socket.off('pool:grace-timer', handleGraceTimer);
      socket.off('pool:status-update', handleStatusUpdate);
      socket.off('pool:error', handleSocketError);
    };
  }, [connected, pool?.viewer?.isAdmin, pool?.viewer?.isParticipant, poolId, socket]);

  const roomTiming = useMemo(() => {
    if (!pool) return '';
    const opensAt = new Date(pool.opensAt).getTime();
    if (nowMs < opensAt) return `Starts in ${formatTimeLeft(pool.opensAt, nowMs)}`;
    if (pool.status === 'UNLOCKED') return `Grace closes in ${formatTimeLeft(pool.graceClosesAt || pool.activeWindowClosesAt, nowMs)}`;
    if (pool.status === 'LOCKED') return 'Locked for coordination';
    if (pool.status === 'COORDINATING') return 'Coordinating order';
    if (['COMPLETED', 'ARCHIVED'].includes(pool.status)) return pool.status;
    return `Closes in ${formatTimeLeft(pool.activeWindowClosesAt || pool.closesAt, nowMs)}`;
  }, [nowMs, pool]);

  const progressPercent = Math.min(100, Number(pool?.progressPercent || 0));
  const canChat = Boolean((pool?.viewer?.isParticipant || pool?.viewer?.isAdmin) && !isRoomClosed(pool));
  const canCoordinate = Boolean((pool?.viewer?.isCoordinator || pool?.viewer?.isAdmin) && !isRoomClosed(pool));
  const canVolunteer = Boolean(pool?.unlockAt && pool?.viewer?.isParticipant && !pool?.viewer?.isCoordinator && !isRoomClosed(pool));
  const unlocked = Boolean(pool?.unlockAt);
  const sortedParticipants = useMemo(() => (
    [...(pool?.participants || [])].sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt))
  ), [pool?.participants]);

  const sendMessage = async (event) => {
    event.preventDefault();
    const content = messageDraft.trim();
    if (!content || !canChat || sending) return;

    setMessageDraft('');
    setSending(true);
    try {
      if (socket && connected) {
        socket.emit('pool:message', { poolId, content }, (response) => {
          if (!response?.success) {
            setMessageDraft(content);
            toast.error(response?.message || 'Message failed');
            return;
          }
          if (response.data) setMessages((previous) => mergeMessage(previous, response.data));
        });
      } else {
        const { data } = await outsideFoodAPI.chat.send(poolId, { content });
        setMessages((previous) => mergeMessage(previous, data.data));
      }
    } catch (error) {
      setMessageDraft(content);
      toast.error(error.response?.data?.message || 'Unable to send message');
    } finally {
      setSending(false);
    }
  };

  const submitStatusUpdate = async (event) => {
    event.preventDefault();
    const content = statusDraft.trim();
    if (!content || !canCoordinate) return;

    setStatusDraft('');
    try {
      if (socket && connected) {
        socket.emit('pool:status-update', { poolId, statusMessage: content }, (response) => {
          if (!response?.success) {
            setStatusDraft(content);
            toast.error(response?.message || 'Status update failed');
          }
        });
      } else {
        const { data } = await outsideFoodAPI.pools.updateStatus(poolId, {
          status: 'COORDINATING',
          statusMessage: content,
        });
        setPool(data.data);
      }
    } catch (error) {
      setStatusDraft(content);
      toast.error(error.response?.data?.message || 'Unable to post status update');
    }
  };

  const markCompleted = async () => {
    if (!canCoordinate) return;
    try {
      if (socket && connected) {
        socket.emit('pool:status-update', {
          poolId,
          status: 'COMPLETED',
          statusMessage: 'Delivery completed',
        }, (response) => {
          if (!response?.success) toast.error(response?.message || 'Unable to complete pool');
        });
      } else {
        const { data } = await outsideFoodAPI.pools.updateStatus(poolId, {
          status: 'COMPLETED',
          statusMessage: 'Delivery completed',
        });
        setPool(data.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to complete pool');
    }
  };

  const confirmCoordination = async () => {
    if (!canCoordinate) return;
    try {
      if (socket && connected) {
        socket.emit('pool:status-update', {
          poolId,
          status: 'COORDINATING',
          statusMessage: 'Restaurant communication confirmed',
        }, (response) => {
          if (!response?.success) toast.error(response?.message || 'Unable to confirm coordination');
        });
      } else {
        const { data } = await outsideFoodAPI.pools.updateStatus(poolId, {
          status: 'COORDINATING',
          statusMessage: 'Restaurant communication confirmed',
        });
        setPool(data.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to confirm coordination');
    }
  };

  const volunteerCoordinator = async () => {
    if (!canVolunteer) return;
    try {
      if (socket && connected) {
        socket.emit('pool:coordinator-update', { poolId }, (response) => {
          if (!response?.success) {
            toast.error(response?.message || 'Unable to volunteer');
            return;
          }
          if (response.data) setPool(response.data);
          toast.success('You are now a coordinator for this pool');
        });
        return;
      } else {
        const { data } = await outsideFoodAPI.pools.volunteerCoordinator(poolId);
        setPool(data.data);
      }
      toast.success('You are now a coordinator for this pool');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to volunteer as coordinator');
    }
  };

  const joinFromRoom = async (event) => {
    event.preventDefault();
    setJoining(true);
    try {
      const { data } = await outsideFoodAPI.pools.join(poolId, {
        intendedAmount: joinAmount,
        orderPreview: joinNote,
      });
      setPool(data.data);
      setJoinAmount('');
      setJoinNote('');

      if (socket && connected) socket.emit('pool:join', { poolId });
      const messageResponse = await outsideFoodAPI.chat.getMessages(poolId);
      setMessages(messageResponse.data.data || []);
      toast.success('Joined this realtime pool room');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to join this pool');
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="outside-food-room-loading">
        <MdOutlineRestaurant />
        <h2>Opening realtime room...</h2>
        <p>Loading participants, messages, and current pool status.</p>
      </div>
    );
  }

  if (!pool) return null;

  return (
    <div className="outside-food-room-page">
      <button type="button" className="outside-food-back-btn" onClick={() => navigate('/outside-food')}>
        <HiArrowLeft />
        Back to Outside Food
      </button>

      <header className="outside-food-room-hero">
        <div className="outside-food-room-main">
          <div className="outside-food-room-title">
            <span>{pool.status}</span>
            <h1>{pool.title}</h1>
            <p>{pool.restaurant?.name} coordination room for pooled outside food ordering.</p>
          </div>

          <div className="outside-food-room-progress">
            <div className="outside-food-progress-track">
              <div className="outside-food-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="outside-food-progress-copy">
              <strong>
                {unlocked ? 'Restaurant details unlocked' : `${formatCurrency(pool.remainingAmount)} left to unlock`}
              </strong>
              <span>{formatCurrency(pool.currentAmount)} / {formatCurrency(pool.targetAmount)}</span>
            </div>
          </div>

          <div className="outside-food-room-facts">
            <span><HiOutlineClock /> {roomTiming}</span>
            <span><HiOutlineUserGroup /> {pool.participantCount} participants</span>
            <span><HiOutlineLocationMarker /> {pool.pickupPoint}</span>
            <span>{pool.onlineCount || 0} students active now</span>
          </div>
        </div>

        <div className="outside-food-room-image">
          {pool.restaurant?.image ? (
            <img src={pool.restaurant.image} alt={pool.restaurant.name} />
          ) : (
            <MdOutlineRestaurant />
          )}
        </div>
      </header>

      {!pool.viewer?.isParticipant && !pool.viewer?.isAdmin && (
        <form className="outside-food-room-join-panel" onSubmit={joinFromRoom}>
          <label className="outside-food-field">
            <span>Intended order amount</span>
            <input
              type="number"
              min="1"
              value={joinAmount}
              onChange={(event) => setJoinAmount(event.target.value)}
              placeholder="180"
              required
            />
          </label>
          <label className="outside-food-field">
            <span>Order note</span>
            <input
              value={joinNote}
              onChange={(event) => setJoinNote(event.target.value)}
              placeholder="Burger meal, less spicy"
            />
          </label>
          <div className="outside-food-modal-summary">
            <strong>
              {pool.status === 'UNLOCKED' ? 'Unlocked - grace window active' : `${formatCurrency(pool.remainingAmount)} left`}
            </strong>
            <span>{pool.participantCount} joined</span>
          </div>
          <button type="submit" className="outside-food-primary-btn" disabled={!pool.isJoinable || joining}>
            {joining ? 'Joining...' : 'Join Room'}
          </button>
        </form>
      )}

      <div className="outside-food-room-layout">
        <aside className="outside-food-room-side">
          <section className="outside-food-room-panel">
            <h2>{unlocked ? 'Restaurant Details' : 'Locked Details'}</h2>
            {unlocked ? (
              <div className="outside-food-unlocked-details">
                <p><strong>Phone</strong><span>{pool.restaurant?.contactNumber || 'Not added'}</span></p>
                <p><strong>Pickup</strong><span>{pool.pickupPoint}</span></p>
                <p><strong>Delivery ETA</strong><span>{pool.restaurant?.estimatedDeliveryTime || 'Coordinate in room'}</span></p>
                {pool.restaurant?.contactNumber && (
                  <a href={`tel:${pool.restaurant.contactNumber}`}>Call Restaurant</a>
                )}
                {pool.restaurant?.menuLink && (
                  <a href={pool.restaurant.menuLink} target="_blank" rel="noreferrer">Open Menu</a>
                )}
                {pool.restaurant?.whatsappLink && (
                  <a href={pool.restaurant.whatsappLink} target="_blank" rel="noreferrer">Open WhatsApp</a>
                )}
              </div>
            ) : (
              <p className="outside-food-locked-copy">
                Details unlock once the pool reaches {formatCurrency(pool.targetAmount)}. Keep the room active and coordinate exact orders here.
              </p>
            )}
          </section>

          <section className="outside-food-room-panel">
            <h2>Coordination</h2>
            {!unlocked ? (
              <p className="outside-food-locked-copy">
                Coordinators can volunteer after the pool unlocks.
              </p>
            ) : (
              <>
                <p className="outside-food-locked-copy">
                  {pool.coordinationPrompt || 'Coordinators help call the restaurant, post updates, and keep everyone aligned.'}
                </p>
                {pool.coordinatorInactive && (
                  <p className="outside-food-locked-copy">Coordinator inactive. Anyone else can volunteer to help.</p>
                )}
                <div className="outside-food-tags">
                  {(pool.coordinators || []).length === 0 ? (
                    <span>No coordinator yet</span>
                  ) : pool.coordinators.map((coordinator) => (
                    <span key={(coordinator.userId || coordinator._id || coordinator.name).toString()}>{coordinator.name}</span>
                  ))}
                </div>
                {pool.suggestedCoordinator && (pool.coordinators || []).length === 0 && (
                  <p className="outside-food-locked-copy">
                    {pool.suggestedCoordinator.name} has been active in this pool. Ask them to coordinate?
                  </p>
                )}
                {canVolunteer && (
                  <button type="button" className="outside-food-primary-btn" onClick={volunteerCoordinator}>
                    Volunteer to Coordinate
                  </button>
                )}
              </>
            )}
          </section>

          <section className="outside-food-room-panel">
            <h2>Participants</h2>
            <div className="outside-food-participant-list">
              {sortedParticipants.length === 0 ? (
                <p className="outside-food-locked-copy">No students have joined yet.</p>
              ) : sortedParticipants.map((participant) => (
                <div key={participant._id} className="outside-food-participant">
                  <span className={participant.online ? 'is-online' : ''}>{participantInitial(participant.name)}</span>
                  <div>
                    <strong>{participant.name}</strong>
                    <small>
                      {isCoordinatorParticipant(pool, participant) ? 'Coordinator' : 'Member'} · {formatCurrency(participant.intendedAmount)}
                    </small>
                    {participant.orderPreview && <small>{participant.orderPreview}</small>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {canCoordinate && (
            <section className="outside-food-room-panel">
              <h2>Coordinator Controls</h2>
              <form onSubmit={submitStatusUpdate}>
                <label className="outside-food-field">
                  <span>Status update</span>
                  <textarea
                    rows={3}
                    value={statusDraft}
                    onChange={(event) => setStatusDraft(event.target.value)}
                    placeholder="Delivery arriving in 10 mins"
                  />
                </label>
                <button type="submit" className="outside-food-primary-btn" disabled={!statusDraft.trim()}>
                  Broadcast Update
                </button>
              </form>
              <button type="button" className="outside-food-secondary-btn" onClick={confirmCoordination}>
                Confirm Restaurant Communication
              </button>
              <button type="button" className="outside-food-secondary-btn" onClick={markCompleted}>
                Mark Completed
              </button>
            </section>
          )}
        </aside>

        <section className="outside-food-chat-panel">
          <div className="outside-food-chat-header">
            <div>
              <h2>Room Chat</h2>
              <p>{canChat ? 'Coordinate order notes and pickup details here.' : 'Join this pool to chat with the room.'}</p>
            </div>
            <div className="outside-food-tags">
              <span>{pool.status}</span>
            </div>
          </div>

          <div className="outside-food-message-list">
            {messages.length === 0 ? (
              <p className="outside-food-chat-empty">No room messages yet.</p>
            ) : messages.map((message) => (
              <article key={message._id} className={`outside-food-message ${String(message.type || '').toLowerCase()}`}>
                {message.type === 'TEXT' && <strong>{message.senderName || 'Student'}</strong>}
                <p>{message.content}</p>
                <span>{formatClock(message.timestamp)}</span>
              </article>
            ))}
            <div ref={bottomRef} />
          </div>

          <form className="outside-food-message-form" onSubmit={sendMessage}>
            <input
              value={messageDraft}
              onChange={(event) => setMessageDraft(event.target.value)}
              placeholder={canChat ? 'Message the pool...' : 'Join the pool to message'}
              disabled={!canChat}
            />
            <button type="submit" className="outside-food-primary-btn" disabled={!canChat || !messageDraft.trim() || sending}>
              Send
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
