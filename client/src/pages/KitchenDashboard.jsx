import { useState, useEffect } from 'react';
import { orderAPI, poolAPI } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { HiOutlineClock, HiOutlineRefresh, HiOutlineUserGroup, HiOutlineFire } from 'react-icons/hi';
import toast from 'react-hot-toast';

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-amber-500/15 text-amber-400 border-amber-500/20', next: 'preparing', nextLabel: 'Start Preparing' },
  queued: { label: 'Queued', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20', next: 'preparing', nextLabel: 'Start Preparing' },
  preparing: { label: 'Preparing', color: 'bg-orange-500/15 text-orange-400 border-orange-500/20', next: 'ready', nextLabel: 'Mark Ready' },
  ready: { label: 'Ready', color: 'bg-green-500/15 text-green-400 border-green-500/20', next: 'completed', nextLabel: 'Complete' },
  completed: { label: 'Done', color: 'bg-surface-500/15 text-surface-400 border-surface-500/20', next: null, nextLabel: null },
  cancelled: { label: 'Cancelled', color: 'bg-red-500/15 text-red-400 border-red-500/20', next: null, nextLabel: null },
};

export default function KitchenDashboard() {
  const [tab, setTab] = useState('orders'); // 'orders' or 'pools'
  
  // Orders State
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({});
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [filter, setFilter] = useState('active');
  
  // Pools State
  const [pools, setPools] = useState([]);
  const [loadingPools, setLoadingPools] = useState(true);
  const [, setTick] = useState(0);

  const { socket } = useSocket() || {};

  // Fetch logic
  useEffect(() => {
    if (tab === 'orders') fetchOrders();
    if (tab === 'pools') fetchPools();
  }, [tab, filter]);

  // Tick for pool timer
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  // Socket logic
  useEffect(() => {
    if (!socket) return;
    
    // Order events
    const handleNewOrder = (order) => {
      if (tab === 'orders') setOrders(prev => [order, ...prev]);
      toast('New order received!', { icon: '🔔', duration: 4000 });
    };
    const handleOrderUpdate = () => { if (tab === 'orders') fetchOrders(); };
    
    // Pool events
    const handlePoolUpdate = (data) => {
      setPools(prev => prev.map(p => p._id === data.poolId ? { ...p, ...data } : p));
    };

    socket.on('new-order', handleNewOrder);
    socket.on('order-update', handleOrderUpdate);
    socket.on('pool-update', handlePoolUpdate);
    
    return () => {
      socket.off('new-order', handleNewOrder);
      socket.off('order-update', handleOrderUpdate);
      socket.off('pool-update', handlePoolUpdate);
    };
  }, [socket, tab]);

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const [ordersRes, statsRes] = await Promise.all([
        orderAPI.getAll({ status: filter }),
        orderAPI.getStats(),
      ]);
      setOrders(ordersRes.data.data);
      setStats(statsRes.data.data);
    } catch (err) {
      toast.error('Failed to load orders');
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchPools = async () => {
    setLoadingPools(true);
    try {
      const { data } = await poolAPI.getActive();
      setPools(data.data);
    } catch (err) {
      toast.error('Failed to load pools');
    } finally {
      setLoadingPools(false);
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await orderAPI.updateStatus(orderId, newStatus);
      toast.success(`Order updated to ${newStatus}`, { icon: statusConfig[newStatus]?.label === 'Ready' ? '✅' : '👨‍🍳' });
      fetchOrders();
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
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">🍳 <span className="text-primary-400">Kitchen</span> Panel</h1>
          <p className="text-surface-400 mt-1">Manage orders and active pools</p>
        </div>
        <button onClick={tab === 'orders' ? fetchOrders : fetchPools} className="btn-secondary flex items-center gap-2 text-sm" id="refresh-kitchen">
          <HiOutlineRefresh className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-surface-700/50 pb-4">
        <button
          onClick={() => setTab('orders')}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === 'orders' ? 'tab-active' : 'bg-surface-800/40 text-surface-400 hover:bg-surface-700/40 border border-surface-700/30'}`}
        >
          📋 Live Orders
        </button>
        <button
          onClick={() => setTab('pools')}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${tab === 'pools' ? 'tab-active' : 'bg-surface-800/40 text-surface-400 hover:bg-surface-700/40 border border-surface-700/30'}`}
        >
          🏊‍♂️ Active Pools
        </button>
      </div>

      {tab === 'orders' ? (
        // ======================= ORDERS TAB =======================
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Today's Orders", value: stats.todayOrders || 0, icon: '📋', color: 'text-blue-400' },
              { label: 'Revenue', value: `₹${stats.todayRevenue || 0}`, icon: '💰', color: 'text-green-400' },
              { label: 'Avg Prep Time', value: `${stats.avgPrepTime || 0}m`, icon: '⏱️', color: 'text-amber-400' },
              { label: 'Pending', value: stats.statusBreakdown?.pending || 0, icon: '⏳', color: 'text-orange-400' },
            ].map(s => (
              <div key={s.label} className="glass-card-static p-4 text-center">
                <span className="text-2xl">{s.icon}</span>
                <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-surface-500 uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Order Filters */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {[
              { key: 'active', label: '📋 Active' },
              { key: 'pending', label: '⏳ Pending' },
              { key: 'preparing', label: '👨‍🍳 Preparing' },
              { key: 'ready', label: '✅ Ready' },
              { key: 'completed', label: '🎉 Completed' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all
                  ${filter === f.key ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30' : 'bg-surface-800/40 text-surface-400 hover:bg-surface-700/40 border border-surface-700/30'}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Order Queue */}
          {loadingOrders ? (
            <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-36" />)}</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-16 glass-card-static">
              <div className="text-5xl mb-4">🎉</div>
              <p className="text-surface-400 text-lg">No orders in this queue</p>
            </div>
          ) : (
            <div className="space-y-3 stagger-children">
              {orders.map(order => {
                const cfg = statusConfig[order.status] || statusConfig.pending;
                return (
                  <div key={order._id} className="glass-card-static p-5" id={`kitchen-order-${order._id}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`badge border ${cfg.color}`}>{cfg.label}</span>
                          {order.isPooled && <span className="badge badge-info">🤝 Pooled</span>}
                          <span className="text-xs text-surface-500">#{order._id.slice(-6).toUpperCase()}</span>
                        </div>
                        <p className="text-sm text-surface-300">
                          👤 {order.user?.name} • {order.user?.phone || order.user?.email}
                        </p>
                        <p className="text-xs text-surface-500 mt-0.5">
                          {new Date(order.createdAt).toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary-400">₹{order.totalAmount}</p>
                        <div className="flex items-center gap-1 text-xs text-surface-400">
                          <HiOutlineClock className="w-3.5 h-3.5" />
                          <span>ETA: {order.estimatedTime}m</span>
                        </div>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div className="bg-surface-900/50 rounded-xl p-3 mb-3">
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-sm py-1">
                          <span className="text-surface-200">{item.name || item.menuItem?.name}</span>
                          <span className="text-surface-400">× {item.quantity}</span>
                        </div>
                      ))}
                      {order.specialInstructions && (
                        <p className="text-xs text-amber-400 mt-2 pt-2 border-t border-surface-700/50">
                          📝 {order.specialInstructions}
                        </p>
                      )}
                    </div>

                    {/* Action Button */}
                    {cfg.next && (
                      <button
                        onClick={() => handleStatusUpdate(order._id, cfg.next)}
                        className={cfg.next === 'ready' ? 'btn-success w-full text-sm' : 'btn-primary w-full text-sm'}
                        id={`action-${order._id}`}
                      >
                        {cfg.next === 'preparing' && '👨‍🍳 '}
                        {cfg.next === 'ready' && '✅ '}
                        {cfg.next === 'completed' && '🎉 '}
                        {cfg.nextLabel}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        // ======================= POOLS TAB =======================
        <>
          <div className="glass-card-static p-4 mb-6 border-l-4 border-l-info">
            <p className="text-sm text-surface-300">
              <strong className="text-blue-400">💡 Kitchen Pool Monitor:</strong> Active pools automatically collect batched orders. Prepare these items in bulk once the pool closes!
            </p>
          </div>
          
          {loadingPools ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {[1,2].map(i => <div key={i} className="skeleton h-40" />)}
            </div>
          ) : pools.length === 0 ? (
            <div className="text-center py-16 glass-card-static">
              <div className="text-5xl mb-4">🤝</div>
              <p className="text-surface-400 text-lg">No active pools right now</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {pools.map(pool => (
                <div key={pool._id} className="glass-card-static p-5 relative overflow-hidden flex flex-col justify-between">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/10 rounded-full blur-3xl opacity-50" />
                  
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-xl bg-surface-800 flex items-center justify-center text-2xl">
                        {pool.menuItem?.category === 'snacks' ? '🥟' :
                         pool.menuItem?.category === 'meals' ? '🍛' :
                         pool.menuItem?.category === 'beverages' ? '☕' : '🍮'}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-surface-100">{pool.menuItem?.name}</h3>
                          <span className="badge badge-warning text-[10px]">{pool.status}</span>
                        </div>
                        <p className="text-sm text-surface-400 mt-0.5">ID: #{pool._id.slice(-6).toUpperCase()}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mb-4">
                      <div className="p-3 rounded-xl bg-surface-900/50 border border-surface-700/30 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-surface-400">
                          <HiOutlineUserGroup className="w-4 h-4" />
                          <span className="text-xs uppercase font-semibold tracking-wider">Queue</span>
                        </div>
                        <span className="font-mono font-bold text-lg text-blue-400">{pool.currentSize}/{pool.maxSize}</span>
                      </div>
                      
                      <div className="p-3 rounded-xl bg-surface-900/50 border border-surface-700/30 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-surface-400">
                          <HiOutlineClock className="w-4 h-4" />
                          <span className="text-xs uppercase font-semibold tracking-wider">Closes in</span>
                        </div>
                        <span className="font-mono font-bold text-lg text-amber-400">{getTimeLeft(pool.closesAt)}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleForceClosePool(pool._id)}
                    className="btn-danger w-full text-sm mt-auto"
                  >
                    Force Close & Push to Order Queue
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
