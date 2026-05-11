import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { outsideFoodAPI } from '../api';
import { useSocket } from '../contexts/SocketContext';
import {
  HiArrowLeft,
  HiOutlineCheck,
  HiOutlineClock,
  HiOutlineCog,
  HiOutlineLockClosed,
  HiOutlineLogout,
  HiOutlinePaperAirplane,
  HiOutlineTrash,
  HiOutlineUserGroup,
  HiOutlineX,
} from 'react-icons/hi';
import { MdOutlineGroups } from 'react-icons/md';
import toast from 'react-hot-toast';

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatClock(value) {
  if (!value) return 'Now';
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatAgo(value) {
  if (!value) return 'Just now';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Just now';

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function mergeMessage(list, message) {
  if (!message?._id) return list;
  const messageId = message._id.toString();
  if (list.some((item) => item._id?.toString() === messageId)) {
    return list.map((item) => (item._id?.toString() === messageId ? { ...item, ...message } : item));
  }
  return [...list, message];
}

function mergePoolState(previous, update, { preserveViewer = true } = {}) {
  if (!previous) return update;
  if (!update?._id && !update?.poolId) return previous;
  const updateId = (update._id || update.poolId).toString();
  if (previous._id?.toString() !== updateId) return previous;

  return {
    ...previous,
    ...update,
    broadcaster: update.broadcaster || previous.broadcaster,
    participants: update.participants || previous.participants,
    pendingRequests: update.pendingRequests || previous.pendingRequests,
    viewer: preserveViewer ? previous.viewer : (update.viewer || previous.viewer),
  };
}

function participantInitial(name) {
  return String(name || 'S').charAt(0).toUpperCase();
}

function isClosed(pool) {
  return pool?.archived || ['ARCHIVED', 'COMPLETED'].includes(pool?.status);
}

function JoinOrRequestPanel({ pool, onSubmit, busy }) {
  const [intendedAmount, setIntendedAmount] = useState('');
  const [orderPreview, setOrderPreview] = useState('');
  const locked = pool.status === 'LOCKED';
  const pending = Boolean(pool.viewer?.pendingRequest);

  if (pending) {
    return (
      <section className="outside-food-room-join-panel pool-room-join-card">
        <div>
          <h2>Request pending</h2>
          <p>Your request is waiting for the broadcaster.</p>
        </div>
        <div className="outside-food-modal-summary">
          <strong>{formatCurrency(pool.viewer.pendingRequest.intendedAmount)}</strong>
          <span>{pool.viewer.pendingRequest.orderPreview}</span>
        </div>
      </section>
    );
  }

  return (
    <form
      className="outside-food-room-join-panel pool-room-join-card"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ intendedAmount, orderPreview, mode: locked ? 'request' : 'join' });
      }}
    >
      <label className="outside-food-field">
        <span>Your contribution</span>
        <input
          type="number"
          min="1"
          value={intendedAmount}
          onChange={(event) => setIntendedAmount(event.target.value)}
          placeholder="200"
          required
        />
      </label>
      <label className="outside-food-field">
        <span>{locked ? 'What do you want to order?' : 'Order note optional'}</span>
        <input
          value={orderPreview}
          onChange={(event) => setOrderPreview(event.target.value)}
          placeholder={locked ? 'Required for locked pool' : 'Optional'}
          required={locked}
        />
      </label>
      <div className="outside-food-modal-summary">
        <strong>{locked ? 'Broadcaster approval' : `${formatCurrency(pool.remainingAmount)} left`}</strong>
        <span>{pool.status}</span>
      </div>
      <button type="submit" className="outside-food-primary-btn" disabled={busy || isClosed(pool)}>
        {busy ? 'Working...' : locked ? 'Request Access' : 'Join Pool'}
      </button>
    </form>
  );
}

export default function OutsideFoodPoolPage() {
  const { poolId } = useParams();
  const navigate = useNavigate();
  const { socket, connected } = useSocket() || {};
  const [pool, setPool] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messageDraft, setMessageDraft] = useState('');
  const [broadcastDraft, setBroadcastDraft] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [toolsOpen, setToolsOpen] = useState(false);
  const bottomRef = useRef(null);

  const canChat = Boolean((pool?.viewer?.isParticipant || pool?.viewer?.isBroadcaster || pool?.viewer?.isAdmin) && !isClosed(pool));
  const canManage = Boolean(pool?.viewer?.isBroadcaster && !isClosed(pool));
  const progressPercent = Math.min(100, Number(pool?.progressPercent || 0));

  const loadRoom = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await outsideFoodAPI.pools.getOne(poolId);
      const nextPool = data.data;

      if (isClosed(nextPool)) {
        toast('This pool has ended');
        navigate('/pools', { replace: true });
        return;
      }

      setPool(nextPool);

      if (nextPool.viewer?.isParticipant || nextPool.viewer?.isBroadcaster || nextPool.viewer?.isAdmin) {
        const messageResponse = await outsideFoodAPI.chat.getMessages(poolId);
        setMessages(messageResponse.data.data || []);
      } else {
        setMessages([]);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to open pool');
      navigate('/pools');
    } finally {
      setLoading(false);
    }
  }, [navigate, poolId]);

  useEffect(() => {
    loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  useEffect(() => {
    if (!socket || !connected || !poolId || !canChat) return undefined;

    const redirectIfClosed = (payload) => {
      if (!payload || payload.poolId?.toString() !== poolId?.toString() && payload._id?.toString() !== poolId?.toString()) return false;
      if (!isClosed(payload)) return false;
      toast('This pool has ended');
      navigate('/pools', { replace: true });
      return true;
    };
    const handlePoolStatus = (payload) => {
      if (redirectIfClosed(payload)) return;
      setPool((previous) => mergePoolState(previous, payload, { preserveViewer: false }));
    };
    const handlePoolUpdate = (payload) => {
      if (redirectIfClosed(payload)) return;
      setPool((previous) => mergePoolState(previous, payload));
    };
    const handleMessage = (message) => setMessages((previous) => mergeMessage(previous, message));
    const handleSocketError = (payload) => toast.error(payload?.message || 'Pool room error');
    const handleKicked = (payload) => {
      if (payload?.poolId?.toString() !== poolId?.toString()) return;
      toast.error('You were removed from this pool');
      navigate('/pools');
    };
    const handleExpired = (payload) => {
      if (payload?.poolId?.toString() !== poolId?.toString()) return;
      toast('This pool was removed');
      navigate('/pools', { replace: true });
    };

    socket.emit('pool:join', { poolId });
    socket.on('pool:status', handlePoolStatus);
    socket.on('pool:update', handlePoolUpdate);
    socket.on('pool:participant-update', handlePoolUpdate);
    socket.on('pool:request-update', handlePoolUpdate);
    socket.on('pool:message', handleMessage);
    socket.on('pool:lock', handlePoolUpdate);
    socket.on('pool:status-update', handlePoolUpdate);
    socket.on('pool:error', handleSocketError);
    socket.on('pool:kicked', handleKicked);
    socket.on('pool:expired', handleExpired);

    return () => {
      socket.emit('pool:leave', { poolId });
      socket.off('pool:status', handlePoolStatus);
      socket.off('pool:update', handlePoolUpdate);
      socket.off('pool:participant-update', handlePoolUpdate);
      socket.off('pool:request-update', handlePoolUpdate);
      socket.off('pool:message', handleMessage);
      socket.off('pool:lock', handlePoolUpdate);
      socket.off('pool:status-update', handlePoolUpdate);
      socket.off('pool:error', handleSocketError);
      socket.off('pool:kicked', handleKicked);
      socket.off('pool:expired', handleExpired);
    };
  }, [canChat, connected, navigate, poolId, socket]);

  const sortedParticipants = useMemo(() => (
    [...(pool?.participants || [])].sort((a, b) => new Date(a.joinedAt) - new Date(b.joinedAt))
  ), [pool?.participants]);

  const submitJoinOrRequest = async ({ intendedAmount, orderPreview, mode }) => {
    setBusyAction(mode);
    try {
      const request = mode === 'request'
        ? outsideFoodAPI.pools.requestJoin(poolId, { intendedAmount, orderPreview })
        : outsideFoodAPI.pools.join(poolId, { intendedAmount, orderPreview });
      const { data } = await request;
      setPool(data.data);
      if (mode === 'join') {
        const messageResponse = await outsideFoodAPI.chat.getMessages(poolId);
        setMessages(messageResponse.data.data || []);
      }
      toast.success(mode === 'request' ? 'Request sent' : 'Joined pool');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update pool');
    } finally {
      setBusyAction('');
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const content = messageDraft.trim();
    if (!content || !canChat || busyAction === 'message') return;

    setMessageDraft('');
    setBusyAction('message');
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
      setBusyAction('');
    }
  };

  const sendBroadcastUpdate = async (event) => {
    event.preventDefault();
    const content = broadcastDraft.trim();
    if (!content || !canManage || busyAction === 'broadcast') return;

    setBusyAction('broadcast');
    try {
      const { data } = await outsideFoodAPI.chat.broadcast(poolId, { content });
      if (data.data) setMessages((previous) => mergeMessage(previous, data.data));
      setBroadcastDraft('');
      toast.success('Broadcast sent');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to send broadcast');
    } finally {
      setBusyAction('');
    }
  };

  const updateStatus = async (status, message) => {
    setBusyAction(status);
    try {
      const { data } = await outsideFoodAPI.pools.updateStatus(poolId, {
        status,
        statusMessage: message,
      });
      if (isClosed(data.data)) {
        toast.success('Pool completed');
        navigate('/pools', { replace: true });
        return;
      }
      setPool(data.data);
      toast.success(status === 'LOCKED' ? 'Pool locked' : status === 'OPEN' ? 'Pool unlocked' : 'Pool completed');
      setToolsOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update pool');
    } finally {
      setBusyAction('');
    }
  };

  const resolveRequest = async (request, action) => {
    setBusyAction(`${action}-${request._id}`);
    try {
      const { data } = await outsideFoodAPI.pools.resolveRequest(poolId, request._id, { action });
      setPool(data.data);
      toast.success(action === 'accept' ? 'Request accepted' : 'Request rejected');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to resolve request');
    } finally {
      setBusyAction('');
    }
  };

  const leavePool = async () => {
    setBusyAction('leave');
    try {
      await outsideFoodAPI.pools.leave(poolId);
      toast.success('Left pool');
      navigate('/pools');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to leave pool');
    } finally {
      setBusyAction('');
    }
  };

  const exitPool = async () => {
    if (canManage) {
      const confirmed = window.confirm('Exit and end this pool for everyone?');
      if (!confirmed) return;
      setBusyAction('archive');
      try {
        await outsideFoodAPI.pools.archive(poolId);
        toast.success('Pool ended');
        navigate('/pools');
      } catch (error) {
        toast.error(error.response?.data?.message || 'Unable to end pool');
      } finally {
        setBusyAction('');
      }
      return;
    }

    if (pool.viewer?.canLeave) {
      await leavePool();
    }
  };

  const kickParticipant = async (participant) => {
    setBusyAction(`kick-${participant.userId}`);
    try {
      const { data } = await outsideFoodAPI.pools.kick(poolId, participant.userId);
      setPool(data.data);
      toast.success(`${participant.name} removed`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to remove member');
    } finally {
      setBusyAction('');
    }
  };

  if (loading) {
    return (
      <div className="outside-food-room-loading">
        <MdOutlineGroups />
        <h2>Opening pool...</h2>
        <p>Loading members, messages, and current progress.</p>
      </div>
    );
  }

  if (!pool) return null;

  const isPoolLocked = pool.status === 'LOCKED';
  const statusClass = isPoolLocked
    ? 'danger'
    : ['COMPLETED', 'ARCHIVED'].includes(pool.status)
      ? 'scheduled'
      : 'live';

  return (
    <div className="outside-food-room-page">
      <div className="pool-room-toolbar">
        <button type="button" className="outside-food-back-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/pools'))}>
          <HiArrowLeft />
          Back
        </button>
        <div className="pool-room-toolbar-actions">
          {(canManage || pool.viewer?.canLeave) && (
            <button
              type="button"
              className="pool-room-exit-btn"
              onClick={exitPool}
              disabled={busyAction === 'leave' || busyAction === 'archive'}
            >
              <HiOutlineLogout />
              {busyAction === 'archive' ? 'Ending...' : busyAction === 'leave' ? 'Exiting...' : 'Exit Pool'}
            </button>
          )}
        </div>
      </div>

      <header className="outside-food-room-hero pool-room-hero-card">
        <div className="pool-room-line pool-room-title-line">
          <div className="outside-food-room-title">
            <span>{pool.category}</span>
            <h1>{pool.title}</h1>
          </div>
          <div className={`outside-food-status-pill static ${statusClass}`}>
            {pool.status}
          </div>
        </div>

        <div className="pool-room-line pool-room-broadcaster-line">
          <p className="pool-room-broadcaster">
            Broadcaster: <strong>{pool.broadcaster?.name || 'Student'}</strong>
          </p>
        </div>

        <div className="pool-room-line pool-room-progress-line">
          <div className="outside-food-progress-track">
            <div className="outside-food-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="pool-room-money-row">
            <strong>{formatCurrency(pool.currentAmount)} / {formatCurrency(pool.targetAmount)}</strong>
          </div>
        </div>

        <div className="pool-room-line pool-room-stats-line">
          <div className="outside-food-room-facts pool-room-fact-grid">
            <span><HiOutlineUserGroup /> <strong>{pool.participantCount}</strong> members</span>
            <span><HiOutlineClock /> {formatAgo(pool.createdAt)}</span>
            <span><HiOutlineLockClosed /> {pool.pendingRequestCount || 0} requests</span>
            <span>{pool.onlineCount || 0} active</span>
          </div>
        </div>
      </header>

      {!canChat && (
        <JoinOrRequestPanel pool={pool} onSubmit={submitJoinOrRequest} busy={Boolean(busyAction)} />
      )}

      <section className="outside-food-chat-panel pool-room-chat-main">
        <div className="outside-food-chat-header">
          <div>
            <h2>Pool Chat</h2>
            <p>{canChat ? 'Coordinate order details here.' : 'Join this pool to chat with members.'}</p>
          </div>
          <div className="outside-food-tags">
            <span>{pool.status}</span>
          </div>
        </div>

        <div className="outside-food-message-list">
          {!canChat ? (
            <p className="outside-food-chat-empty">Chat unlocks after you join or create the pool.</p>
          ) : messages.length === 0 ? (
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
          <button
            type="button"
            className="pool-composer-icon-btn"
            onClick={() => setToolsOpen(true)}
            disabled={!canChat}
            aria-label="Open pool tools"
            title="Pool tools"
          >
            <HiOutlineCog />
            {canManage && isPoolLocked && Number(pool.pendingRequestCount || 0) > 0 && (
              <span>{pool.pendingRequestCount}</span>
            )}
          </button>
          <button
            type="submit"
            className="outside-food-primary-btn pool-composer-send-btn"
            disabled={!canChat || !messageDraft.trim() || busyAction === 'message'}
            aria-label="Send message"
            title="Send"
          >
            <HiOutlinePaperAirplane />
          </button>
        </form>
      </section>

      {toolsOpen && (
        <div className="pool-tools-backdrop">
          <section className="pool-tools-modal" role="dialog" aria-modal="true" aria-label="Pool tools">
            <div className="pool-tools-head">
              <div>
                <span>Pool tools</span>
                <h2>{canManage ? 'Broadcaster controls' : 'Room details'}</h2>
              </div>
              <button type="button" onClick={() => setToolsOpen(false)} aria-label="Close pool tools">
                <HiOutlineX />
              </button>
            </div>

            {canManage && (
              <section className="pool-tools-section">
                <div className="pool-panel-head">
                  <h3>Controls</h3>
                  <span>{progressPercent}% filled</span>
                </div>
                <div className="pool-control-stack pool-control-grid">
                  <button
                    type="button"
                    className="outside-food-primary-btn"
                    onClick={() => updateStatus(
                      isPoolLocked ? 'OPEN' : 'LOCKED',
                      isPoolLocked ? 'Pool unlocked by the broadcaster' : 'Pool locked by the broadcaster'
                    )}
                    disabled={
                      (isPoolLocked ? busyAction === 'OPEN' : busyAction === 'LOCKED')
                      || !['OPEN', 'LOCKED'].includes(pool.status)
                    }
                  >
                    {isPoolLocked
                      ? busyAction === 'OPEN' ? 'Unlocking...' : 'Unlock Pool'
                      : busyAction === 'LOCKED' ? 'Locking...' : 'Lock Pool'}
                  </button>
                  <button
                    type="button"
                    className="outside-food-secondary-btn outside-food-full-btn"
                    onClick={() => updateStatus('COMPLETED', 'Pool marked completed')}
                    disabled={busyAction === 'COMPLETED'}
                  >
                    Complete Pool
                  </button>
                </div>

                <form className="pool-broadcast-form" onSubmit={sendBroadcastUpdate}>
                  <label className="outside-food-field">
                    <span>Important broadcast</span>
                    <textarea
                      rows={2}
                      value={broadcastDraft}
                      onChange={(event) => setBroadcastDraft(event.target.value)}
                      placeholder="Order will be placed in 5 minutes"
                    />
                  </label>
                  <button
                    type="submit"
                    className="outside-food-primary-btn pool-broadcast-btn"
                    disabled={!broadcastDraft.trim() || busyAction === 'broadcast'}
                  >
                    {busyAction === 'broadcast' ? 'Broadcasting...' : 'Broadcast Update'}
                  </button>
                </form>
              </section>
            )}

            {canManage && pool.status === 'LOCKED' && (
              <section className="pool-tools-section">
                <div className="pool-panel-head">
                  <h3>Join Requests</h3>
                  <span>{pool.pendingRequestCount || 0}</span>
                </div>
                <div className="outside-food-participant-list">
                  {(pool.pendingRequests || []).length === 0 ? (
                    <p className="outside-food-locked-copy">No pending requests.</p>
                  ) : pool.pendingRequests.map((request) => (
                    <div key={request._id} className="outside-food-participant pool-request-row">
                      <span>{participantInitial(request.name)}</span>
                      <div>
                        <strong>{request.name}</strong>
                        <small>{formatCurrency(request.intendedAmount)}</small>
                        <small>{request.orderPreview}</small>
                      </div>
                      <div className="pool-inline-actions">
                        <button
                          type="button"
                          onClick={() => resolveRequest(request, 'accept')}
                          disabled={busyAction === `accept-${request._id}`}
                          aria-label={`Accept ${request.name}`}
                        >
                          <HiOutlineCheck />
                        </button>
                        <button
                          type="button"
                          onClick={() => resolveRequest(request, 'reject')}
                          disabled={busyAction === `reject-${request._id}`}
                          aria-label={`Reject ${request.name}`}
                        >
                          <HiOutlineX />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="pool-tools-section">
              <div className="pool-panel-head">
                <h3>Members</h3>
                <span>{sortedParticipants.length}</span>
              </div>
              <div className="outside-food-participant-list">
                {sortedParticipants.length === 0 ? (
                  <p className="outside-food-locked-copy">No members have joined yet.</p>
                ) : sortedParticipants.map((participant) => (
                  <div key={participant._id} className="outside-food-participant pool-member-row">
                    <span className={participant.online ? 'is-online' : ''}>{participantInitial(participant.name)}</span>
                    <div>
                      <strong>{participant.name}</strong>
                      <small>{formatCurrency(participant.intendedAmount)}</small>
                      {participant.orderPreview && <small>{participant.orderPreview}</small>}
                    </div>
                    {canManage && (
                      <button
                        type="button"
                        className="pool-icon-danger"
                        onClick={() => kickParticipant(participant)}
                        disabled={busyAction === `kick-${participant.userId}`}
                        aria-label={`Remove ${participant.name}`}
                      >
                        <HiOutlineTrash />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </section>
        </div>
      )}
    </div>
  );
}
