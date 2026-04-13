import { useState, useEffect, useCallback, useRef } from 'react';
import { orderAPI, poolAPI } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { HiOutlineClock, HiOutlineRefresh, HiOutlineUserGroup } from 'react-icons/hi';
import { MdRestaurantMenu } from 'react-icons/md';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const statusConfig = {
  pending: { label: 'Pending', badgeClass: 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]', icon: '⏳', next: 'preparing', nextLabel: 'Start Preparing', btnClass: 'btn-primary' },
  queued: { label: 'Queued', badgeClass: 'bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]', icon: '📋', next: 'preparing', nextLabel: 'Start Preparing', btnClass: 'btn-primary' },
  preparing: { label: 'Preparing', badgeClass: 'bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.2)]', icon: '👨‍🍳', next: 'ready', nextLabel: 'Mark Ready', btnClass: 'bg-green-600 hover:bg-green-500 text-white shadow-[0_8px_20px_rgba(22,163,74,0.3)]' },
  ready: { label: 'Ready', badgeClass: 'bg-green-500/10 text-green-500 border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.2)]', icon: '✅', next: 'completed', nextLabel: 'Complete Order', btnClass: 'bg-surface-700 hover:bg-surface-600' },
  completed: { label: 'Done', badgeClass: 'bg-surface-500/10 text-surface-400 border border-surface-500/20', icon: '🎉', next: null },
  cancelled: { label: 'Cancelled', badgeClass: 'bg-red-500/10 text-red-500 border border-red-500/20', icon: '❌', next: null },
};

export default function KitchenDashboard() {
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [filter, setFilter] = useState('active');
  const [pools, setPools] = useState([]);
  const [loadingPools, setLoadingPools] = useState(true);
  const [, setTick] = useState(0);
  const { socket } = useSocket() || {};
  const tabRef = useRef(tab);
  const filterRef = useRef(filter);
  tabRef.current = tab;
  filterRef.current = filter;

  // ── Fetch helpers (stable references via useCallback) ────────
  const fetchStats = useCallback(async () => {
    try {
      const statsRes = await orderAPI.getStats();
      setStats(statsRes.data.data);
    } catch { /* silent – stats are non-critical */ }
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    try {
      const [ordersRes, statsRes] = await Promise.all([
        orderAPI.getAll({ status: filterRef.current }),
        orderAPI.getStats(),
      ]);
      setOrders(ordersRes.data.data);
      setStats(statsRes.data.data);
    } catch (err) {
      toast.error('Failed to load orders');
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const fetchPools = useCallback(async () => {
    setLoadingPools(true);
    try {
      const { data } = await poolAPI.getActive();
      setPools(data.data);
    } catch (err) {
      toast.error('Failed to load pools');
    } finally {
      setLoadingPools(false);
    }
  }, []);

  // ── Initial fetch & tab/filter changes ───────────────────────
  useEffect(() => {
    if (tab === 'orders') fetchOrders();
    if (tab === 'pools') fetchPools();
  }, [tab, filter, fetchOrders, fetchPools]);

  // ── 1-second tick for live countdown timers ──────────────────
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Auto-poll stats every 15 seconds so revenue stays fresh ──
  useEffect(() => {
    const poll = setInterval(() => {
      fetchStats();
      // Also refresh the active tab silently
      if (tabRef.current === 'orders') {
        orderAPI.getAll({ status: filterRef.current }).then(r => setOrders(r.data.data)).catch(() => {});
      } else {
        poolAPI.getActive().then(r => setPools(r.data.data)).catch(() => {});
      }
    }, 15_000);
    return () => clearInterval(poll);
  }, [fetchStats]);

  // ── Socket events ────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (order) => {
      // Prepend and immediately refresh stats so revenue updates
      setOrders(prev => [order, ...prev]);
      fetchStats();
      toast('New order received!', { icon: '🔔' });
    };

    const handleOrderUpdate = () => {
      // Full refresh so status pipeline + revenue both update
      fetchOrders();
    };

    const handlePoolUpdate = (data) => {
      setPools(prev => prev.map(p => p._id === data.poolId ? { ...p, ...data } : p));
      // If pool closed, also refresh stats (a new consolidated order may exist)
      if (data.status === 'queued') fetchStats();
    };

    const handleQueueStats = (queueData) => {
      // Update live queue numbers if provided
      setStats(prev => ({
        ...prev,
        statusBreakdown: {
          ...prev.statusBreakdown,
          pending: queueData.pendingOrders ?? prev.statusBreakdown?.pending,
          preparing: queueData.preparingOrders ?? prev.statusBreakdown?.preparing,
        },
      }));
    };

    socket.on('new-order', handleNewOrder);
    socket.on('order-update', handleOrderUpdate);
    socket.on('pool-update', handlePoolUpdate);
    socket.on('queue-stats', handleQueueStats);

    return () => {
      socket.off('new-order', handleNewOrder);
      socket.off('order-update', handleOrderUpdate);
      socket.off('pool-update', handlePoolUpdate);
      socket.off('queue-stats', handleQueueStats);
    };
  }, [socket, fetchOrders, fetchStats]);

  // fetchPools is now defined above with useCallback

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await orderAPI.updateStatus(orderId, newStatus);
      toast.success(`Order updated to ${newStatus}`, { icon: statusConfig[newStatus]?.icon });
      // Immediately refresh both orders AND stats so revenue updates in real-time
      await fetchOrders();
    } catch (err) {
      toast.error('Update failed');
    }
  };
  
  const handleForceClosePool = async (poolId) => {
    try {
      await poolAPI.close(poolId);
      toast.success('Pool closed manually');
      fetchPools();
    } catch {
      toast.error('Failed to close pool');
    }
  };

  const getTimeLeft = (closesAt) => {
    const diff = new Date(closesAt) - new Date();
    if (diff <= 0) return 'Closing...';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-4">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight tracking-tight text-white drop-shadow-2xl">
            Kitchen <span className="text-primary-500">Command Control.</span>
          </h1>
          <p className="text-surface-400 font-bold uppercase tracking-widest text-xs mt-3 bg-white/5 inline-block py-1.5 px-3 rounded-md border border-white/5">Real-time Order Management Engine</p>
        </motion.div>
        
        <button onClick={tab === 'orders' ? fetchOrders : fetchPools} className="btn-secondary h-12 px-6 flex items-center justify-center gap-2 group border border-white/10 hover:border-white/20 transition-all rounded-xl shadow-lg shadow-black/50">
          <HiOutlineRefresh className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500 text-primary-400" /> 
          <span className="font-bold text-sm tracking-wide">Sync Data</span>
        </button>
      </div>

      {/* Tabs */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-4 mb-4 border-b border-surface-800 pb-6">
        <button
          onClick={() => setTab('orders')}
          className={`px-8 py-3.5 rounded-full text-sm font-black tracking-wide transition-all shadow-lg ${tab === 'orders' ? 'bg-primary-500 text-white shadow-primary-500/30' : 'bg-surface-900 border border-surface-800 text-surface-400 hover:text-white hover:border-surface-700'}`}
        >
          LIVE PIPELINE
        </button>
        <button
          onClick={() => setTab('pools')}
          className={`px-8 py-3.5 rounded-full text-sm font-black tracking-wide transition-all shadow-lg ${tab === 'pools' ? 'bg-primary-500 text-white shadow-primary-500/30' : 'bg-surface-900 border border-surface-800 text-surface-400 hover:text-white hover:border-surface-700'}`}
        >
          ACTIVE POOLS
        </button>
      </motion.div>

      <AnimatePresence mode="wait">
        {tab === 'orders' ? (
          <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">
            {/* Stats Dashboard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Today's Orders", value: stats.todayOrders || 0, color: 'from-blue-600/20 to-blue-900/20 border-blue-500/30 text-blue-400' },
                { label: 'Revenue Generated', value: `₹${stats.todayRevenue || 0}`, color: 'from-green-600/20 to-green-900/20 border-green-500/30 text-green-400' },
                { label: 'Avg Prep Cycle', value: `${stats.avgPrepTime || 0} min`, color: 'from-purple-600/20 to-purple-900/20 border-purple-500/30 text-purple-400' },
                { label: 'Pending Processing', value: stats.statusBreakdown?.pending || 0, color: 'from-orange-600/20 to-orange-900/20 border-orange-500/30 text-orange-400' },
              ].map((s, i) => (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                  key={s.label} className={`glass-card bg-gradient-to-br ${s.color} border shadow-xl flex flex-col justify-center min-h-[140px]`}
                >
                  <p className="text-3xl font-black drop-shadow-md mb-2">{s.value}</p>
                  <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">{s.label}</p>
                </motion.div>
              ))}
            </div>

            {/* Order Pipelines Filters */}
            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-none">
              {[
                { key: 'active', label: '🔥 All Active' },
                { key: 'pending', label: '⏳ Pending' },
                { key: 'preparing', label: '👨‍🍳 Preparing' },
                { key: 'ready', label: '✅ Ready' }
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`px-6 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all
                    ${filter === f.key ? 'bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.2)]' : 'bg-[#18181b] text-surface-400 hover:text-white border border-surface-800'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Order Cards Grid */}
            {loadingOrders ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1,2,3].map(i => <div key={i} className="skeleton h-64 rounded-3xl" />)}
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 glass-card bg-[#09090b]/40 border border-white/5">
                <span className="text-6xl mb-6 grayscale opacity-50">🍳</span>
                <p className="text-2xl font-black text-white">Pipeline is clear</p>
                <p className="text-surface-400 mt-2 font-medium">No active orders in this segment right now.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6 stagger-children">
                <AnimatePresence>
                  {orders.map(order => {
                    const cfg = statusConfig[order.status] || statusConfig.pending;
                    return (
                      <motion.div 
                        layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                        key={order._id} className="glass-card flex flex-col justify-between border border-surface-800 hover:border-surface-600 bg-[#0c0c0e] p-6 lg:p-8 relative overflow-hidden"
                      >
                        {/* Status glow orb */}
                        <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-[60px] opacity-20 pointer-events-none ${cfg.badgeClass.split(' ')[0]}`} />
                        
                        <div>
                          <div className="flex items-start justify-between gap-4 mb-6">
                            <div>
                               <div className="flex items-center gap-2 mb-3">
                                 <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-md ${cfg.badgeClass}`}>
                                   {cfg.icon} {cfg.label}
                                 </span>
                                 {order.isPooled && <span className="px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-md bg-info/10 text-blue-400 border border-info/30">🤝 Pooled</span>}
                               </div>
                               <p className="text-xl font-black text-white">{order.user?.name}</p>
                               <p className="text-xs font-bold text-surface-500 uppercase tracking-widest mt-1">ORDER #{order._id.slice(-6)} • {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • {new Date(order.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                            </div>
                            <div className="text-right flex flex-col items-end shrink-0">
                               <p className="text-2xl font-black text-primary-400 mb-1">₹{order.totalAmount}</p>
                               <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-900 border border-surface-800 text-xs font-bold text-surface-300 shadow-inner">
                                 <HiOutlineClock className="w-4 h-4 text-amber-500" /> ETA: {order.estimatedTime}m
                               </div>
                            </div>
                          </div>

                          <div className="bg-[#121214] rounded-2xl p-4 mb-6 border border-white/5 shadow-inner">
                            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-surface-500 mb-3 ml-1">Receipt</p>
                            <div className="space-y-3">
                              {order.items.map((item, i) => (
                                <div key={i} className="flex justify-between items-center bg-[#18181b] p-3 rounded-xl border border-white/5">
                                  <span className="text-sm font-bold text-surface-200">{item.name || item.menuItem?.name}</span>
                                  <span className="text-xs font-black bg-surface-800 px-2 py-1 rounded-md">x{item.quantity}</span>
                                </div>
                              ))}
                            </div>
                            {order.specialInstructions && (
                              <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs font-medium text-amber-300/90 leading-relaxed">
                                <span className="font-bold text-amber-500">NOTE:</span> {order.specialInstructions}
                              </div>
                            )}
                          </div>
                        </div>

                        {cfg.next && (
                          <button
                            onClick={() => handleStatusUpdate(order._id, cfg.next)}
                            className={`w-full py-4 rounded-xl text-sm font-black tracking-wide transition-all shadow-xl rounded-b-2xl rounded-t-lg border border-white/10 flex items-center justify-center gap-2 ${cfg.btnClass}`}
                          >
                            {cfg.nextLabel}
                          </button>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div key="pools" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {/* Pool Warning Card */}
            <div className="glass-card p-6 mb-8 border-l-4 border-info/50 bg-info/5 shadow-[0_0_30px_rgba(59,130,246,0.1)] relative overflow-hidden">
               <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-info/10 to-transparent pointer-events-none" />
               <h3 className="font-black text-blue-400 mb-2 flex items-center gap-2"><MdRestaurantMenu className="w-5 h-5"/> POOL MONITORING</h3>
               <p className="text-surface-300 text-sm font-medium leading-relaxed max-w-4xl">
                 Active pools batch multiple student orders together to optimize kitchen throughput. Do not process these items individually until the pool automatically closes or you force close it. Once closed, they enter the live pipeline as a single massive order.
               </p>
            </div>

            {loadingPools ? (
              <div className="grid md:grid-cols-2 gap-6">
                {[1,2].map(i => <div key={i} className="skeleton h-60 rounded-3xl" />)}
              </div>
            ) : pools.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 glass-card bg-[#09090b]/40 border border-white/5">
                <span className="text-6xl mb-6 grayscale opacity-50">🤝</span>
                <p className="text-2xl font-black text-white">No active pools</p>
                <p className="text-surface-400 mt-2 font-medium">Students haven't initiated any batch orders yet.</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-8 stagger-children">
                {pools.map(pool => (
                  <div key={pool._id} className="glass-card flex flex-col justify-between border-2 border-info/20 hover:border-info/40 bg-[#0c0c0e] p-8 shadow-[0_10px_40px_rgba(0,0,0,0.5)] relative overflow-hidden group">
                    <div className="absolute -right-20 -top-20 w-64 h-64 bg-info/10 rounded-full blur-[80px] pointer-events-none group-hover:scale-150 transition-transform duration-1000" />
                    
                    <div>
                      <div className="flex gap-5 mb-8">
                        <div className="w-16 h-16 rounded-2xl bg-surface-900 border border-white/10 flex items-center justify-center text-3xl shrink-0 shadow-inner">
                          {pool.menuItem?.category === 'snacks' ? '🥟' : pool.menuItem?.category === 'meals' ? '🍛' : pool.menuItem?.category === 'beverages' ? '☕' : '🍮'}
                        </div>
                        <div className="flex-1">
                          <span className="inline-block px-2.5 py-1 rounded-md bg-info/15 text-blue-400 font-black text-[10px] uppercase tracking-widest border border-info/30 mb-2 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                            {pool.status}
                          </span>
                          <h3 className="font-black text-2xl text-white leading-tight mb-1">{pool.menuItem?.name}</h3>
                          <p className="text-xs text-surface-500 font-bold uppercase tracking-widest tracking-widest">POOL #{pool._id.slice(-6)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 mb-8">
                         <div className="bg-[#121214] p-4 rounded-2xl border border-white/5 shadow-inner flex flex-col items-center text-center">
                            <HiOutlineUserGroup className="w-6 h-6 text-surface-500 mb-2" />
                            <p className="text-[10px] uppercase tracking-widest font-bold text-surface-400 mb-1">Queue Size</p>
                            <p className="text-2xl font-black text-white">{pool.currentSize}<span className="text-surface-600">/{pool.maxSize}</span></p>
                         </div>
                         <div className="bg-[#121214] p-4 rounded-2xl border border-white/5 shadow-inner flex flex-col items-center text-center">
                            <HiOutlineClock className="w-6 h-6 text-amber-500 mb-2 animate-pulse" />
                            <p className="text-[10px] uppercase tracking-widest font-bold text-surface-400 mb-1">Closing In</p>
                            <p className="text-2xl font-black text-amber-400">{getTimeLeft(pool.closesAt)}</p>
                         </div>
                      </div>
                    </div>

                    <button
                      onClick={() => handleForceClosePool(pool._id)}
                      className="w-full py-4 rounded-xl text-sm font-black tracking-wide transition-all bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                    >
                      FORCE CLOSE POOL & COOK
                    </button>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
