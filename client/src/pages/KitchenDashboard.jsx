import { useState, useEffect, useCallback, useRef } from 'react';
import { menuAPI, orderAPI, poolAPI } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { HiOutlineClock, HiOutlineRefresh, HiOutlineUserGroup } from 'react-icons/hi';
import { MdRestaurantMenu } from 'react-icons/md';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const statusConfig = {
  pending: { label: 'Pending', badgeClass: 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]', icon: '⏳', next: 'preparing', nextLabel: 'Start Preparing', btnClass: 'btn-primary' },
  queued: { label: 'Queued', badgeClass: 'bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]', icon: '📋', next: 'preparing', nextLabel: 'Start Preparing', btnClass: 'btn-primary' },
  preparing: { label: 'Preparing', badgeClass: 'bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.2)]', icon: '👨‍🍳', next: null },
  ready: { label: 'Ready', badgeClass: 'bg-green-500/10 text-green-500 border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.2)]', icon: '✅', next: 'completed', nextLabel: 'Complete Order', btnClass: 'bg-surface-700 hover:bg-surface-600' },
  completed: { label: 'Done', badgeClass: 'bg-surface-500/10 text-surface-400 border border-surface-500/20', icon: '🎉', next: null },
  cancelled: { label: 'Cancelled', badgeClass: 'bg-red-500/10 text-red-500 border border-red-500/20', icon: '❌', next: null },
};

export default function KitchenDashboard() {
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [filter] = useState('active');
  const [pools, setPools] = useState([]);
  const [loadingPools, setLoadingPools] = useState(true);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [stockRows, setStockRows] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [productionItemId, setProductionItemId] = useState('');
  const [productionQty, setProductionQty] = useState(1);
  const [submittingProduction, setSubmittingProduction] = useState(false);
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
      const [ordersRes, completedRes, statsRes, stockRes] = await Promise.all([
        orderAPI.getAll({ status: filterRef.current }),
        orderAPI.getAll({ status: 'completed', limit: 30 }),
        orderAPI.getStats(),
        orderAPI.getKitchenStock(),
      ]);
      setOrders(ordersRes.data.data);
      setCompletedOrders(completedRes.data.data || []);
      setStats(statsRes.data.data);
      setStockRows(stockRes.data.data || []);
    } catch {
      toast.error('Failed to load orders');
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const fetchProductionMeta = useCallback(async () => {
    try {
      const [menuRes, stockRes] = await Promise.all([
        menuAPI.getAll({ available: true }),
        orderAPI.getKitchenStock(),
      ]);
      const items = menuRes.data.data || [];
      setMenuItems(items);
      setStockRows(stockRes.data.data || []);
      if (!productionItemId && items.length > 0) {
        const preferred = items.find((x) => x.name?.toLowerCase().includes('chai')) || items[0];
        setProductionItemId(preferred._id);
      }
    } catch {
      toast.error('Failed to load kitchen stock data');
    }
  }, [productionItemId]);

  const fetchPools = useCallback(async () => {
    setLoadingPools(true);
    try {
      const { data } = await poolAPI.getActive();
      setPools(data.data);
    } catch {
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

  useEffect(() => {
    fetchProductionMeta();
  }, [fetchProductionMeta]);

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
        Promise.all([
          orderAPI.getAll({ status: filterRef.current }),
          orderAPI.getAll({ status: 'completed', limit: 30 }),
          orderAPI.getKitchenStock(),
        ])
          .then(([ordersResp, completedResp, stockResp]) => {
            setOrders(ordersResp.data.data);
            setCompletedOrders(completedResp.data.data || []);
            setStockRows(stockResp.data.data || []);
          })
          .catch(() => {});
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
      toast.error(err.response?.data?.message || 'Update failed');
    }
  };

  const handleAddProduced = async () => {
    if (!productionItemId || Number(productionQty) <= 0) {
      toast.error('Select an item and add a valid quantity');
      return;
    }

    setSubmittingProduction(true);
    try {
      const qty = Number(productionQty);
      const { data } = await orderAPI.addProducedStock(productionItemId, qty);
      setStockRows(data.stock || []);
      toast.success(data.message || 'Stock updated');
      await fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add produced quantity');
    } finally {
      setSubmittingProduction(false);
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

  const groupedDemand = Object.values(
    orders.reduce((acc, order) => {
      order.items.forEach((item) => {
        const key = item.menuItem?._id || item.menuItem || item.name;
        if (!acc[key]) {
          acc[key] = {
            key,
            itemName: item.name || item.menuItem?.name || 'Menu Item',
            totalQty: 0,
            orders: [],
          };
        }

        acc[key].totalQty += Number(item.quantity || 0);
        acc[key].orders.push({
          orderId: order._id,
          studentName: order.user?.name || 'Student',
          quantity: Number(item.quantity || 0),
          status: order.status,
        });
      });
      return acc;
    }, {})
  ).sort((a, b) => b.totalQty - a.totalQty || a.itemName.localeCompare(b.itemName));

  const getItemsSummary = (order) =>
    order.items
      .map((item) => `${item.quantity}x ${item.name || item.menuItem?.name}`)
      .join(', ');

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
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Active Orders', value: orders.length, color: 'from-blue-600/20 to-blue-900/20 border-blue-500/30 text-blue-400' },
                { label: 'Completed Today', value: stats.statusBreakdown?.completed || 0, color: 'from-green-600/20 to-green-900/20 border-green-500/30 text-green-400' },
                { label: 'Pending Queue', value: stats.statusBreakdown?.pending || 0, color: 'from-orange-600/20 to-orange-900/20 border-orange-500/30 text-orange-400' },
                { label: 'Preparing Now', value: stats.statusBreakdown?.preparing || 0, color: 'from-purple-600/20 to-purple-900/20 border-purple-500/30 text-purple-400' },
              ].map((s, i) => (
                <motion.div
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  key={s.label} className={`glass-card bg-gradient-to-br ${s.color} border shadow-xl flex flex-col justify-center min-h-[120px]`}
                >
                  <p className="text-3xl font-black drop-shadow-md mb-2">{s.value}</p>
                  <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">{s.label}</p>
                </motion.div>
              ))}
            </div>

            <div className="glass-card bg-[#0c0c0e] border border-surface-800 p-5 lg:p-6 space-y-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-surface-400">Step 1</p>
                <h3 className="text-lg font-black text-white mt-1">Add prepared quantity</h3>
                <p className="text-xs text-surface-500 mt-1">Enter how many units are made. System auto-allocates to oldest orders.</p>
              </div>

              <div className="grid md:grid-cols-[2fr_1fr_auto] gap-3">
                <select
                  value={productionItemId}
                  onChange={(e) => setProductionItemId(e.target.value)}
                  className="bg-surface-900 border border-surface-700 rounded-xl px-4 h-12 text-sm font-semibold text-white"
                >
                  {menuItems.map((item) => (
                    <option key={item._id} value={item._id}>{item.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={productionQty}
                  onChange={(e) => setProductionQty(e.target.value)}
                  className="bg-surface-900 border border-surface-700 rounded-xl px-4 h-12 text-sm font-semibold text-white"
                />
                <button
                  onClick={handleAddProduced}
                  disabled={submittingProduction}
                  className="h-12 px-5 rounded-xl bg-primary-500 hover:bg-primary-400 text-white text-sm font-black tracking-wide disabled:opacity-60"
                >
                  {submittingProduction ? 'Adding...' : 'Add Made Qty'}
                </button>
              </div>

              <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {stockRows.slice(0, 8).map((row) => (
                  <div key={row.menuItemId} className="rounded-xl border border-white/10 bg-[#111114] p-3">
                    <p className="text-xs font-bold text-surface-300 truncate">{row.name}</p>
                    <div className="mt-2 space-y-1 text-[11px] font-semibold text-surface-400">
                      <p>Made: <span className="text-white">{row.madeQuantity}</span></p>
                      <p>Allocated: <span className="text-blue-400">{row.allocatedQuantity}</span></p>
                      <p>Waiting: <span className="text-amber-400">{row.waitingQuantity}</span></p>
                      <p>Free: <span className="text-green-400">{row.availableQuantity}</span></p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {loadingOrders ? (
              <div className="grid md:grid-cols-2 gap-6">
                {[1, 2].map(i => <div key={i} className="skeleton h-64 rounded-3xl" />)}
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-32 glass-card bg-[#09090b]/40 border border-white/5">
                <span className="text-6xl mb-6 grayscale opacity-50">🍳</span>
                <p className="text-2xl font-black text-white">No active orders</p>
                <p className="text-surface-400 mt-2 font-medium">New orders will show here automatically.</p>
              </div>
            ) : (
              <div className="grid xl:grid-cols-2 gap-6">
                <div className="glass-card bg-[#0c0c0e] border border-surface-800 p-5 lg:p-6">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-surface-400">Step 2</p>
                  <h3 className="text-lg font-black text-white mt-1 mb-4">What to cook now</h3>

                  <div className="space-y-3 max-h-[430px] overflow-y-auto pr-1">
                    {groupedDemand.length === 0 ? (
                      <p className="text-sm text-surface-500">No active demand.</p>
                    ) : groupedDemand.map((group) => (
                      <div key={group.key} className="rounded-xl border border-white/10 bg-[#111114] p-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-black text-white">{group.itemName}</p>
                          <span className="text-xs font-black bg-primary-500/20 text-primary-300 px-2 py-1 rounded-md">Total: {group.totalQty}</span>
                        </div>
                        <div className="mt-2 space-y-1">
                          {group.orders.slice(0, 6).map((entry) => (
                            <div key={`${group.key}-${entry.orderId}-${entry.studentName}`} className="text-xs text-surface-300 flex justify-between gap-2">
                              <span className="truncate">{entry.studentName}</span>
                              <span className="font-bold">{entry.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="glass-card bg-[#0c0c0e] border border-surface-800 p-5 lg:p-6">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-surface-400">Step 3</p>
                  <h3 className="text-lg font-black text-white mt-1 mb-4">Order checklist</h3>

                  <div className="space-y-3 max-h-[430px] overflow-y-auto pr-1">
                    {orders.map((order) => {
                      const cfg = statusConfig[order.status] || statusConfig.pending;
                      return (
                        <div key={order._id} className="rounded-xl border border-white/10 bg-[#111114] p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-black text-white truncate">{order.user?.name} • #{order._id.slice(-6)}</p>
                              <p className="text-xs text-surface-400 mt-1 line-clamp-2">{getItemsSummary(order)}</p>
                            </div>
                            <span className={`px-2 py-1 text-[10px] font-black uppercase rounded-md shrink-0 ${cfg.badgeClass}`}>{cfg.label}</span>
                          </div>

                          <div className="mt-3 flex gap-2">
                            {(order.status === 'pending' || order.status === 'queued') && (
                              <button
                                onClick={() => handleStatusUpdate(order._id, 'preparing')}
                                className="px-3 py-2 rounded-lg text-xs font-black bg-primary-500 text-white"
                              >
                                Start Cooking
                              </button>
                            )}

                            {order.status === 'ready' && (
                              <button
                                onClick={() => handleStatusUpdate(order._id, 'completed')}
                                className="px-3 py-2 rounded-lg text-xs font-black bg-green-600 hover:bg-green-500 text-white"
                              >
                                Checkmark Completed
                              </button>
                            )}

                            {order.status === 'preparing' && (
                              <span className="px-3 py-2 rounded-lg text-xs font-black bg-orange-500/15 text-orange-400 border border-orange-500/30">
                                Cooking in progress
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="xl:col-span-2 glass-card bg-[#0c0c0e] border border-surface-800 p-5 lg:p-6">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-surface-400">Completed Orders</p>
                  <h3 className="text-lg font-black text-white mt-1 mb-4">Recently completed</h3>

                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {completedOrders.length === 0 ? (
                      <p className="text-sm text-surface-500">No completed orders yet.</p>
                    ) : completedOrders.map((order) => (
                      <div key={order._id} className="rounded-xl border border-white/10 bg-[#111114] px-3 py-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">{order.user?.name} • #{order._id.slice(-6)}</p>
                          <p className="text-xs text-surface-400 truncate">{getItemsSummary(order)}</p>
                        </div>
                        <span className="text-xs text-surface-400 shrink-0">{new Date(order.updatedAt || order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    ))}
                  </div>
                </div>
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
