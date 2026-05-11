import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { outsideFoodAPI } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { HiOutlineClock, HiOutlineLocationMarker, HiOutlineRefresh, HiOutlineUserGroup, HiOutlineX } from 'react-icons/hi';
import { MdOutlineDeliveryDining, MdOutlineRestaurant } from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const MotionArticle = motion.article;

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hours}h ${rem}m`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function getPoolTiming(pool) {
  const now = Date.now();
  const opensAt = new Date(pool.opensAt).getTime();
  const closesAt = new Date(pool.activeWindowClosesAt || pool.closesAt).getTime();
  if (now < opensAt) {
    return { label: `Starts in ${formatDuration(opensAt - now)}`, tone: 'scheduled', isScheduled: true };
  }
  if (now >= closesAt) {
    return { label: 'Locking...', tone: 'danger', isClosed: true };
  }
  const remainingMs = closesAt - now;
  if (pool.status === 'UNLOCKED') {
    return {
      label: `Grace closes in ${formatDuration(remainingMs)}`,
      tone: 'danger',
      isGrace: true,
    };
  }
  return {
    label: `Closes in ${formatDuration(remainingMs)}`,
    tone: remainingMs < 5 * 60 * 1000 ? 'danger' : 'live',
    isScheduled: false,
  };
}

function mergePoolById(list, update) {
  if (!update?._id && !update?.poolId) return list;
  const id = (update._id || update.poolId).toString();
  const shouldRemove = ['LOCKED', 'COORDINATING', 'COMPLETED', 'ARCHIVED'].includes(update.status) || update.archived;
  const exists = list.some((pool) => pool._id?.toString() === id);

  if (shouldRemove) {
    return list.map((pool) => (
      pool._id?.toString() === id ? { ...pool, ...update } : pool
    ));
  }

  if (!exists && update._id) return [update, ...list];
  return list.map((pool) => (
    pool._id?.toString() === id ? { ...pool, ...update } : pool
  ));
}

function JoinPoolModal({ pool, onClose, onSubmit, submitting }) {
  const [intendedAmount, setIntendedAmount] = useState('');
  const [orderPreview, setOrderPreview] = useState('');

  if (!pool) return null;

  return (
    <div className="outside-food-modal-backdrop" onClick={onClose}>
      <form
        className="outside-food-join-modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit({ intendedAmount, orderPreview });
        }}
      >
        <div className="outside-food-modal-header">
          <div>
            <span>Join pool</span>
            <h2>{pool.restaurant?.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close join dialog">
            <HiOutlineX />
          </button>
        </div>

        <label className="outside-food-field">
          <span>Intended order amount</span>
          <input
            type="number"
            min="1"
            value={intendedAmount}
            onChange={(event) => setIntendedAmount(event.target.value)}
            placeholder="180"
            required
            autoFocus
          />
        </label>

        <label className="outside-food-field">
          <span>Order preview or note</span>
          <textarea
            value={orderPreview}
            onChange={(event) => setOrderPreview(event.target.value)}
            placeholder="Medium pizza, garlic bread, no olives"
            rows={3}
          />
        </label>

        <div className="outside-food-modal-summary">
          <strong>
            {pool.status === 'UNLOCKED'
              ? 'Unlocked - grace window active'
              : `${formatCurrency(pool.remainingAmount)} left to unlock`}
          </strong>
          <span>{pool.participantCount} students are already in</span>
        </div>

        <button type="submit" className="outside-food-primary-btn" disabled={submitting}>
          {submitting ? 'Joining...' : 'Join realtime room'}
        </button>
      </form>
    </div>
  );
}

function PoolCard({ pool, onJoin, onEnter }) {
  const timing = getPoolTiming(pool);
  const isUnlocked = pool.status === 'UNLOCKED';
  const isParticipant = pool.viewer?.isParticipant;
  const progress = Math.min(100, Number(pool.progressPercent || 0));

  return (
    <MotionArticle
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={`outside-food-pool-card ${isUnlocked ? 'is-unlocked' : ''}`}
    >
      <div className="outside-food-card-media">
        {pool.restaurant?.image ? (
          <img src={pool.restaurant.image} alt={pool.restaurant.name} />
        ) : (
          <div className="outside-food-card-fallback">
            <MdOutlineRestaurant />
          </div>
        )}
        <span className={`outside-food-status-pill ${timing.tone}`}>
          {isUnlocked ? 'Grace Open' : pool.status}
        </span>
      </div>

      <div className="outside-food-card-body">
        <div className="outside-food-card-title-row">
          <div>
            <h2>{pool.restaurant?.name || pool.title}</h2>
            <p>{pool.title}</p>
          </div>
          <div className="outside-food-amount">
            <strong>{formatCurrency(pool.currentAmount)}</strong>
            <span>/ {formatCurrency(pool.targetAmount)}</span>
          </div>
        </div>

        <div className="outside-food-tags">
          {(pool.restaurant?.cuisineTags || []).slice(0, 4).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>

        <div className="outside-food-progress-track">
          <div className="outside-food-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="outside-food-progress-copy">
          <strong>{isUnlocked ? 'Unlocked - join before lock' : `${formatCurrency(pool.remainingAmount)} left to unlock`}</strong>
          <span>{progress}%</span>
        </div>

        <div className="outside-food-card-stats">
          <span><HiOutlineUserGroup /> {pool.participantCount} joined</span>
          <span><HiOutlineClock /> {timing.label}</span>
          <span><MdOutlineDeliveryDining /> {pool.restaurant?.estimatedDeliveryTime}</span>
          <span><HiOutlineLocationMarker /> {pool.pickupPoint}</span>
        </div>

        <div className="outside-food-activity-line">
          <span>{pool.onlineCount || 0} students active now</span>
          <span>{pool.recentlyJoinedCount || 0} joined recently</span>
        </div>

        <button
          type="button"
          className="outside-food-primary-btn"
          onClick={() => (isParticipant ? onEnter(pool) : onJoin(pool))}
          disabled={!isParticipant && !pool.isJoinable}
        >
          {isParticipant ? 'Enter Room' : timing.isScheduled ? 'Opens Soon' : isUnlocked ? 'Join During Grace' : 'Join Pool'}
        </button>
      </div>
    </MotionArticle>
  );
}

export default function OutsideFoodPage() {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPool, setSelectedPool] = useState(null);
  const [joining, setJoining] = useState(false);
  const [, setTick] = useState(0);
  const { socket } = useSocket() || {};
  const navigate = useNavigate();

  const loadPools = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const { data } = await outsideFoodAPI.pools.getAll();
      setPools(data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load outside food pools');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPools();
  }, [loadPools]);

  useEffect(() => {
    const interval = setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    const handlePoolUpdate = (pool) => setPools((prev) => mergePoolById(prev, pool));
    const handleParticipantUpdate = (update) => {
      setPools((prev) => prev.map((pool) => (
        pool._id?.toString() === update.poolId?.toString()
          ? { ...pool, ...update }
          : pool
      )));
    };
    const handleLock = (pool) => {
      setPools((prev) => mergePoolById(prev, pool));
      toast('An outside food pool locked');
    };
    const handleUnlock = (pool) => {
      setPools((prev) => mergePoolById(prev, pool));
      toast.success(`${pool.restaurant?.name || 'Pool'} unlocked!`);
    };
    const handleGraceTimer = (timer) => {
      setPools((prev) => prev.map((pool) => (
        pool._id?.toString() === timer.poolId?.toString()
          ? { ...pool, ...timer }
          : pool
      )));
    };

    socket.on('pool:update', handlePoolUpdate);
    socket.on('pool:unlock', handleUnlock);
    socket.on('pool:lock', handleLock);
    socket.on('pool:coordinator-update', handlePoolUpdate);
    socket.on('pool:status-update', handlePoolUpdate);
    socket.on('pool:grace-timer', handleGraceTimer);
    socket.on('pool:participant-update', handleParticipantUpdate);

    return () => {
      socket.off('pool:update', handlePoolUpdate);
      socket.off('pool:unlock', handleUnlock);
      socket.off('pool:lock', handleLock);
      socket.off('pool:coordinator-update', handlePoolUpdate);
      socket.off('pool:status-update', handlePoolUpdate);
      socket.off('pool:grace-timer', handleGraceTimer);
      socket.off('pool:participant-update', handleParticipantUpdate);
    };
  }, [socket]);

  const visiblePools = useMemo(() => (
    pools
      .filter((pool) => !pool.archived && ['OPEN', 'UNLOCKED'].includes(pool.status))
      .sort((a, b) => {
        const score = (pool) => {
          const target = Number(pool.targetAmount || 1);
          const remainingRatio = Number(pool.remainingAmount || 0) / target;
          const urgencyDeadline = new Date(pool.activeWindowClosesAt || pool.closesAt).getTime();
          const minutesLeft = Math.max(0, (urgencyDeadline - Date.now()) / 60000);
          return (
            (pool.status === 'UNLOCKED' ? 1000 : 0) +
            (1 - remainingRatio) * 500 +
            Number(pool.onlineCount || 0) * 25 +
            Number(pool.recentlyJoinedCount || 0) * 20 -
            minutesLeft
          );
        };
        return score(b) - score(a);
      })
  ), [pools]);

  const handleJoinSubmit = async ({ intendedAmount, orderPreview }) => {
    if (!selectedPool) return;
    setJoining(true);
    try {
      const { data } = await outsideFoodAPI.pools.join(selectedPool._id, { intendedAmount, orderPreview });
      setPools((prev) => mergePoolById(prev, data.data));
      if (socket) socket.emit('pool:join', { poolId: selectedPool._id });
      toast.success('Joined the outside food room');
      navigate(`/outside-food/pool/${selectedPool._id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to join this pool');
    } finally {
      setJoining(false);
      setSelectedPool(null);
    }
  };

  return (
    <div className="outside-food-page">
      <header className="outside-food-hero">
        <div>
          <span>Outside Food</span>
          <h1>Realtime campus food pools</h1>
          <p>Coordinate outside restaurant orders together. UniFeast helps form the room, track the pooled amount, and keep everyone in sync.</p>
        </div>
        <button
          type="button"
          className="outside-food-secondary-btn"
          onClick={() => loadPools({ quiet: true })}
          disabled={refreshing}
        >
          <HiOutlineRefresh className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </header>

      {loading ? (
        <div className="outside-food-grid">
          {[1, 2, 3].map((item) => <div key={item} className="outside-food-skeleton" />)}
        </div>
      ) : visiblePools.length === 0 ? (
        <section className="outside-food-empty">
          <MdOutlineRestaurant />
          <h2>No outside food pools are active</h2>
          <p>Scheduled pools created by admins will appear here during their ordering windows.</p>
        </section>
      ) : (
        <div className="outside-food-grid">
          <AnimatePresence>
            {visiblePools.map((pool) => (
              <PoolCard
                key={pool._id}
                pool={pool}
                onJoin={setSelectedPool}
                onEnter={(nextPool) => navigate(`/outside-food/pool/${nextPool._id}`)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <JoinPoolModal
        pool={selectedPool}
        onClose={() => setSelectedPool(null)}
        onSubmit={handleJoinSubmit}
        submitting={joining}
      />
    </div>
  );
}
