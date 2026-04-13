import { useState, useEffect } from 'react';
import { poolAPI } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { HiOutlineClock, HiOutlineUserGroup, HiOutlineRefresh } from 'react-icons/hi';
import toast from 'react-hot-toast';

export default function PoolsPage() {
  const [pools, setPools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(null);
  const { socket } = useSocket() || {};

  useEffect(() => {
    fetchPools();
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handlePoolUpdate = (data) => {
      setPools(prev => prev.map(p =>
        p._id === data.poolId ? { ...p, ...data } : p
      ));
    };
    socket.on('pool-update', handlePoolUpdate);
    return () => socket.off('pool-update', handlePoolUpdate);
  }, [socket]);

  const fetchPools = async () => {
    try {
      const { data } = await poolAPI.getActive();
      setPools(data.data);
    } catch (err) {
      toast.error('Failed to load pools');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPool = async (menuItemId) => {
    setJoining(menuItemId);
    try {
      const { data } = await poolAPI.join({ menuItemId, quantity: 1 });
      toast.success(`Joined pool! You save ${data.data.pool.savingsPercent}%`, { icon: '🤝' });
      fetchPools();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to join pool');
    } finally {
      setJoining(null);
    }
  };

  // Countdown timer
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const getTimeLeft = (closesAt) => {
    const diff = new Date(closesAt) - new Date();
    if (diff <= 0) return 'Closing...';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight">Order <span className="text-primary-400">Pools</span></h1>
          <p className="text-surface-400 mt-2 text-sm">Join others to save on your orders</p>
        </div>
        <button onClick={fetchPools} className="btn-secondary flex items-center gap-2 text-sm min-h-[44px] px-4 py-2.5 self-start">
          <HiOutlineRefresh className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Info banner */}
      <div className="glass-card-static p-4 md:p-5 mb-6 md:mb-8 border-l-4 border-l-info">
        <p className="text-sm text-surface-300 leading-relaxed">
          <strong className="text-blue-400">💡 How Order Pooling works:</strong> When multiple students order the same item within a 5-minute window,
          orders are batched together. You save up to <strong className="text-green-400">15%</strong> based on pool size!
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          {[1,2,3].map(i => <div key={i} className="skeleton h-48 rounded-2xl" />)}
        </div>
      ) : pools.length === 0 ? (
        <div className="text-center py-16 md:py-20 glass-card-static max-w-md mx-auto">
          <div className="text-5xl mb-4">🤝</div>
          <h3 className="text-lg font-bold mb-2">No active pools right now</h3>
          <p className="text-surface-400 text-sm">Order from the menu to start a new pool!</p>
        </div>
      ) : (
        <div className="grid gap-4 md:gap-6 sm:grid-cols-2">
          {pools.map(pool => (
            <div key={pool._id} className="glass-card-static p-4 md:p-6 relative overflow-hidden" id={`pool-${pool._id}`}>
              {/* Glow effect */}
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/10 rounded-full blur-3xl" />

              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center text-2xl shrink-0">
                    {pool.menuItem?.category === 'snacks' ? '🥟' :
                     pool.menuItem?.category === 'meals' ? '🍛' :
                     pool.menuItem?.category === 'beverages' ? '☕' : '🍮'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-surface-100 truncate">{pool.menuItem?.name}</h3>
                    <p className="text-sm text-surface-400">₹{pool.pricePerUnit} per unit</p>
                  </div>
                  <span className="badge badge-success shrink-0">{pool.status}</span>
                </div>

                {/* Pool stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 rounded-xl bg-surface-900/50">
                    <HiOutlineUserGroup className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                    <p className="text-lg font-bold">{pool.currentSize}/{pool.maxSize}</p>
                    <p className="text-[10px] text-surface-500">Members</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-surface-900/50">
                    <HiOutlineClock className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                    <p className="text-lg font-bold font-mono">{getTimeLeft(pool.closesAt)}</p>
                    <p className="text-[10px] text-surface-500">Time Left</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-surface-900/50">
                    <span className="text-lg block">💰</span>
                    <p className="text-lg font-bold text-green-400">{pool.savingsPercent}%</p>
                    <p className="text-[10px] text-surface-500">Savings</p>
                  </div>
                </div>

                {/* Members */}
                <div className="flex items-center gap-1 mb-4">
                  <span className="text-xs text-surface-500 mr-1">Members:</span>
                  {pool.members?.slice(0, 5).map((m, i) => (
                    <div
                      key={i}
                      className="w-7 h-7 rounded-full bg-surface-700 flex items-center justify-center text-xs font-bold border-2 border-surface-800 -ml-1.5 first:ml-0"
                      title={m.user?.name}
                    >
                      {m.user?.name?.charAt(0)?.toUpperCase()}
                    </div>
                  ))}
                  {pool.members?.length > 5 && (
                    <span className="text-xs text-surface-500 ml-1">+{pool.members.length - 5}</span>
                  )}
                </div>

                <button
                  onClick={() => handleJoinPool(pool.menuItem?._id)}
                  disabled={joining === pool.menuItem?._id || pool.currentSize >= pool.maxSize}
                  className="btn-primary w-full text-sm min-h-[44px]"
                  id={`join-pool-${pool._id}`}
                >
                  {joining === pool.menuItem?._id ? 'Joining...' : pool.currentSize >= pool.maxSize ? 'Pool Full' : '🤝 Join This Pool'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
