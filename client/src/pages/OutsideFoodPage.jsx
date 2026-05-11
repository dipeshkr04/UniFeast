import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { outsideFoodAPI } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import {
  HiOutlineChartBar,
  HiOutlineClock,
  HiOutlineLockClosed,
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineSearch,
  HiOutlineUserGroup,
  HiOutlineX,
} from 'react-icons/hi';
import { MdOutlineGroups } from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

const MotionArticle = motion.article;

const categoryOptions = [
  { value: 'food', label: 'Food' },
  { value: 'travel', label: 'Travel' },
  { value: 'others', label: 'Others' },
];

function formatCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatAgo(value) {
  if (!value) return 'Just now';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function idToString(value) {
  if (!value) return '';
  if (typeof value === 'object') return String(value._id || value.id || value.userId || '');
  return String(value);
}

function resolveViewerState(pool, update, existingViewer, viewerUserId) {
  const updatedViewer = update.viewer;
  const updateLooksPersonal = Boolean(
    update.__personal ||
    updatedViewer?.isParticipant ||
    updatedViewer?.isBroadcaster ||
    updatedViewer?.pendingRequest ||
    updatedViewer?.isAdmin
  );
  let viewer = updateLooksPersonal ? updatedViewer : (existingViewer || updatedViewer || {});

  if (viewerUserId) {
    const isParticipant = (pool.participants || []).some((participant) => (
      idToString(participant.userId) === viewerUserId
    ));
    const isBroadcaster = idToString(pool.broadcaster) === viewerUserId;

    if (isParticipant || isBroadcaster) {
      viewer = {
        ...viewer,
        isParticipant,
        isBroadcaster,
        pendingRequest: null,
        canJoin: false,
        canRequest: false,
      };
    }
  }

  return viewer;
}

function mergePoolById(list, update, viewerUserId = '') {
  if (!update?._id && !update?.poolId) return list;
  const id = (update._id || update.poolId).toString();
  if (update.archived || update.status === 'ARCHIVED' || update.status === 'COMPLETED') {
    return list.filter((pool) => pool._id?.toString() !== id);
  }
  const exists = list.some((pool) => pool._id?.toString() === id);
  if (!exists && update._id) return [update, ...list];
  return list.map((pool) => (
    pool._id?.toString() === id
      ? (() => {
        const merged = {
          ...pool,
          ...update,
          broadcaster: update.broadcaster || pool.broadcaster,
          participants: update.participants || pool.participants,
        };
        return {
          ...merged,
          viewer: resolveViewerState(merged, update, pool.viewer, viewerUserId),
        };
      })()
      : pool
  ));
}

function PoolActionModal({ pool, mode, onClose, onSubmit, submitting }) {
  const [intendedAmount, setIntendedAmount] = useState('');
  const [orderPreview, setOrderPreview] = useState('');
  if (!pool) return null;

  const isRequest = mode === 'request';

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
            <span>{isRequest ? 'Request access' : 'Join pool'}</span>
            <h2>{pool.title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close pool dialog">
            <HiOutlineX />
          </button>
        </div>

        <label className="outside-food-field">
          <span>Your contribution</span>
          <input
            type="number"
            min="1"
            value={intendedAmount}
            onChange={(event) => setIntendedAmount(event.target.value)}
            placeholder="200"
            required
            autoFocus
          />
        </label>

        <label className="outside-food-field">
          <span>{isRequest ? 'What do you want to order?' : 'Order note optional'}</span>
          <textarea
            value={orderPreview}
            onChange={(event) => setOrderPreview(event.target.value)}
            placeholder={isRequest ? 'Veg roll and cold coffee' : 'Optional note for the broadcaster'}
            rows={3}
            required={isRequest}
          />
        </label>

        <div className="outside-food-modal-summary">
          <strong>{formatCurrency(pool.currentAmount)} / {formatCurrency(pool.targetAmount)}</strong>
          <span>{pool.status === 'LOCKED' ? 'Broadcaster approval needed' : `${pool.remainingAmount ? formatCurrency(pool.remainingAmount) : 'Goal'} left`}</span>
        </div>

        <button type="submit" className="outside-food-primary-btn" disabled={submitting}>
          {submitting ? 'Working...' : isRequest ? 'Send Request' : 'Join Pool'}
        </button>
      </form>
    </div>
  );
}

function CreatePoolModal({ onClose, onSubmit, submitting }) {
  const [form, setForm] = useState({ category: 'food', title: '', targetAmount: '' });

  const update = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));

  return (
    <div className="outside-food-modal-backdrop" onClick={onClose}>
      <form
        className="outside-food-join-modal"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(form);
        }}
      >
        <div className="outside-food-modal-header">
          <div>
            <span>New pool</span>
            <h2>Create a campus pool</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close create pool dialog">
            <HiOutlineX />
          </button>
        </div>

        <label className="outside-food-field">
          <span>Category</span>
          <select value={form.category} onChange={(event) => update('category', event.target.value)} required>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label className="outside-food-field">
          <span>Pool name</span>
          <input
            value={form.title}
            onChange={(event) => update('title', event.target.value)}
            placeholder="Friday snack run"
            required
          />
        </label>

        <label className="outside-food-field">
          <span>Pool value</span>
          <input
            type="number"
            min="1"
            value={form.targetAmount}
            onChange={(event) => update('targetAmount', event.target.value)}
            placeholder="800"
            required
          />
        </label>

        <button type="submit" className="outside-food-primary-btn" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Pool'}
        </button>
      </form>
    </div>
  );
}

function PoolCard({ pool, onAction, onEnter }) {
  const progress = Math.min(100, Number(pool.progressPercent || 0));
  const locked = pool.status === 'LOCKED';
  const categoryLabel = categoryOptions.find((item) => item.value === pool.category)?.label || 'Others';
  const joined = Boolean(pool.viewer?.isParticipant || pool.viewer?.isBroadcaster);

  return (
    <MotionArticle
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className={`outside-food-pool-card pool-card-flat ${locked ? 'is-locked' : ''}`}
    >
      <div className="outside-food-card-body">
        <span className="outside-food-category-chip pool-category-chip">{categoryLabel}</span>
        <div className="pool-card-head">
          <h2>{pool.title}</h2>
          <div className={`outside-food-status-pill ${locked ? 'danger static' : 'live static'}`}>
            {locked ? 'Locked' : 'Open'}
          </div>
        </div>

        <p className="pool-card-broadcaster">Broadcaster: {pool.broadcaster?.name || 'Student'}</p>

        <div className="pool-card-progress">
          <div className="outside-food-progress-track pool-progress-track">
            <div className="outside-food-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="pool-value-row">
            <strong>{formatCurrency(pool.currentAmount)} / {formatCurrency(pool.targetAmount)}</strong>
            <span>{progress}% filled</span>
          </div>
        </div>

        <div className={`pool-stat-stack ${locked ? 'is-locked' : ''}`}>
          <div className="pool-stat-row">
            <span><HiOutlineUserGroup /> {pool.participantCount} members</span>
            <span><HiOutlineClock /> {formatAgo(pool.createdAt)}</span>
            <span><HiOutlineLockClosed /> {pool.pendingRequestCount || 0} requests</span>
            <span>{pool.onlineCount || 0} active</span>
          </div>
        </div>

        {joined ? (
          <button type="button" className="outside-food-primary-btn pool-joined-btn" onClick={() => onEnter(pool)} title="Open pool room">
            Joined
          </button>
        ) : pool.viewer?.pendingRequest ? (
          <button type="button" className="outside-food-secondary-btn outside-food-full-btn" disabled>
            Requested
          </button>
        ) : locked ? (
          <button type="button" className="outside-food-primary-btn" onClick={() => onAction(pool, 'request')}>
            Request Access
          </button>
        ) : (
          <button type="button" className="outside-food-primary-btn" onClick={() => onAction(pool, 'join')}>
            Join Pool
          </button>
        )}
      </div>
    </MotionArticle>
  );
}

export default function OutsideFoodPage() {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedPool, setSelectedPool] = useState(null);
  const [actionMode, setActionMode] = useState('join');
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { socket } = useSocket() || {};
  const { user } = useAuth();
  const navigate = useNavigate();
  const viewerUserId = idToString(user?._id || user?.id);

  const loadPools = useCallback(async ({ quiet = false } = {}) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const { data } = await outsideFoodAPI.pools.getAll();
      setPools(data.data || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to load pools');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPools();
  }, [loadPools]);

  useEffect(() => {
    if (!socket) return undefined;

    const handlePoolUpdate = (pool) => setPools((previous) => mergePoolById(previous, pool, viewerUserId));
    const handleParticipantUpdate = (update) => setPools((previous) => mergePoolById(previous, update, viewerUserId));
    const handleRequestResolved = (payload) => {
      if (payload?.pool) {
        setPools((previous) => mergePoolById(previous, { ...payload.pool, __personal: true }, viewerUserId));
      }
    };
    const handleExpired = ({ poolId }) => setPools((previous) => previous.filter((pool) => pool._id?.toString() !== poolId?.toString()));

    socket.on('pool:update', handlePoolUpdate);
    socket.on('pool:lock', handlePoolUpdate);
    socket.on('pool:request-update', handlePoolUpdate);
    socket.on('pool:status-update', handlePoolUpdate);
    socket.on('pool:participant-update', handleParticipantUpdate);
    socket.on('pool:request-resolved', handleRequestResolved);
    socket.on('pool:expired', handleExpired);

    return () => {
      socket.off('pool:update', handlePoolUpdate);
      socket.off('pool:lock', handlePoolUpdate);
      socket.off('pool:request-update', handlePoolUpdate);
      socket.off('pool:status-update', handlePoolUpdate);
      socket.off('pool:participant-update', handleParticipantUpdate);
      socket.off('pool:request-resolved', handleRequestResolved);
      socket.off('pool:expired', handleExpired);
    };
  }, [socket, viewerUserId]);

  const visiblePools = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return pools
      .filter((pool) => {
        if (pool.archived || !['OPEN', 'LOCKED'].includes(pool.status)) return false;
        if (!query) return true;
        return [
          pool.title,
          pool.category,
          pool.status,
          pool.broadcaster?.name,
        ].some((value) => String(value || '').toLowerCase().includes(query));
      })
      .sort((a, b) => {
        const statusScore = (pool) => (pool.status === 'OPEN' ? 1 : 0);
        if (statusScore(a) !== statusScore(b)) return statusScore(b) - statusScore(a);
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt);
      });
  }, [pools, searchTerm]);

  const openAction = (pool, mode) => {
    setSelectedPool(pool);
    setActionMode(mode);
  };

  const handleCreateSubmit = async (form) => {
    setCreating(true);
    try {
      const { data } = await outsideFoodAPI.pools.create(form);
      setPools((previous) => mergePoolById(previous, data.data, viewerUserId));
      setCreateOpen(false);
      toast.success('Pool created');
      navigate(`/pools/${data.data._id}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create pool');
    } finally {
      setCreating(false);
    }
  };

  const handleActionSubmit = async ({ intendedAmount, orderPreview }) => {
    if (!selectedPool) return;
    setSubmitting(true);
    try {
      const request = actionMode === 'request'
        ? outsideFoodAPI.pools.requestJoin(selectedPool._id, { intendedAmount, orderPreview })
        : outsideFoodAPI.pools.join(selectedPool._id, { intendedAmount, orderPreview });
      const { data } = await request;
      setPools((previous) => mergePoolById(previous, data.data, viewerUserId));
      toast.success(actionMode === 'request' ? 'Request sent to broadcaster' : 'Joined pool');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Pool action failed');
    } finally {
      setSubmitting(false);
      setSelectedPool(null);
    }
  };

  return (
    <div className="outside-food-page">
      <header className="outside-food-hero">
        <div>
          <span>Pools</span>
          <h1>Campus pools</h1>
          <p>Create or join shared food, travel, and custom pools.</p>
        </div>
        <div className="outside-food-header-actions">
          <button
            type="button"
            className="outside-food-secondary-btn"
            onClick={() => loadPools({ quiet: true })}
            disabled={refreshing}
          >
            <HiOutlineRefresh className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button type="button" className="outside-food-primary-btn outside-food-create-btn" onClick={() => setCreateOpen(true)}>
            <HiOutlinePlus />
            Create
          </button>
        </div>
      </header>

      <label className="outside-food-search">
        <HiOutlineSearch />
        <input
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search pools by name, category, broadcaster..."
        />
      </label>

      {loading ? (
        <div className="outside-food-grid">
          {[1, 2, 3].map((item) => <div key={item} className="outside-food-skeleton" />)}
        </div>
      ) : visiblePools.length === 0 ? (
        <section className="outside-food-empty">
          <MdOutlineGroups />
          <h2>No active pools yet</h2>
          <p>Start one for snacks, rides, print runs, or anything that needs a shared target.</p>
          <button type="button" className="outside-food-primary-btn outside-food-create-btn" onClick={() => setCreateOpen(true)}>
            <HiOutlinePlus />
            Create Pool
          </button>
        </section>
      ) : (
        <div className="outside-food-grid">
          <AnimatePresence>
            {visiblePools.map((pool) => (
              <PoolCard
                key={pool._id}
                pool={pool}
                onAction={openAction}
                onEnter={(nextPool) => navigate(`/pools/${nextPool._id}`)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <PoolActionModal
        pool={selectedPool}
        mode={actionMode}
        onClose={() => setSelectedPool(null)}
        onSubmit={handleActionSubmit}
        submitting={submitting}
      />

      {createOpen && (
        <CreatePoolModal
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreateSubmit}
          submitting={creating}
        />
      )}
    </div>
  );
}
