import { useState, useEffect } from 'react';
import { orderAPI } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { HiOutlineClock, HiOutlineRefresh } from 'react-icons/hi';
import toast from 'react-hot-toast';

const statusConfig = {
  pending: { label: 'Pending', color: 'badge-warning', emoji: '⏳' },
  queued: { label: 'Queued', color: 'badge-info', emoji: '📋' },
  preparing: { label: 'Preparing', color: 'badge-primary', emoji: '👨‍🍳' },
  ready: { label: 'Ready!', color: 'badge-success', emoji: '✅' },
  completed: { label: 'Completed', color: 'badge-success', emoji: '🎉' },
  cancelled: { label: 'Cancelled', color: 'badge-danger', emoji: '❌' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const { socket } = useSocket() || {};

  useEffect(() => {
    fetchOrders();
  }, [filter]);

  useEffect(() => {
    if (!socket) return;
    
    const handleOrderUpdate = (data) => {
      setOrders(prev => prev.map(o =>
        o._id === data.orderId ? { ...o, status: data.status } : o
      ));
      const cfg = statusConfig[data.status];
      toast(`Order ${cfg.emoji} ${cfg.label}`, { icon: cfg.emoji });
    };

    const handleETAUpdate = (data) => {
      setOrders(prev => prev.map(o =>
        o._id === data.orderId ? { ...o, estimatedTime: data.eta, estimatedReadyAt: data.estimatedReadyAt } : o
      ));
    };

    socket.on('order-update', handleOrderUpdate);
    socket.on('eta-update', handleETAUpdate);

    return () => {
      socket.off('order-update', handleOrderUpdate);
      socket.off('eta-update', handleETAUpdate);
    };
  }, [socket]);

  const fetchOrders = async () => {
    try {
      const params = {};
      if (filter) params.status = filter;
      const { data } = await orderAPI.getMy(params);
      setOrders(data.data);
    } catch (err) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const getTimeLeft = (estimatedReadyAt) => {
    if (!estimatedReadyAt) return null;
    const diff = new Date(estimatedReadyAt) - new Date();
    if (diff <= 0) return 'Any moment now';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  // Live countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-fadeIn">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">My <span className="text-primary-400">Orders</span></h1>
          <p className="text-surface-400 mt-1">Track your orders in real-time</p>
        </div>
        <button onClick={fetchOrders} className="btn-secondary flex items-center gap-2 text-sm" id="refresh-orders">
          <HiOutlineRefresh className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Status Filters */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {['', 'pending', 'preparing', 'ready', 'completed'].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all
              ${filter === s ? 'tab-active' : 'bg-surface-800/40 text-surface-400 hover:bg-surface-700/40 border border-surface-700/30'}`}
            id={`filter-${s || 'all'}`}
          >
            {s ? statusConfig[s].emoji + ' ' + statusConfig[s].label : '📋 All Orders'}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="skeleton h-32" />)}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 glass-card-static">
          <div className="text-5xl mb-4">📭</div>
          <p className="text-surface-400 text-lg">No orders found</p>
        </div>
      ) : (
        <div className="space-y-4 stagger-children">
          {orders.map(order => {
            const cfg = statusConfig[order.status] || statusConfig.pending;
            const timeLeft = getTimeLeft(order.estimatedReadyAt);
            const isActive = ['pending', 'queued', 'preparing'].includes(order.status);

            return (
              <div
                key={order._id}
                className={`glass-card-static p-5 ${isActive ? 'border-l-4 border-l-primary-500' : ''}`}
                id={`order-${order._id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${cfg.color}`}>{cfg.emoji} {cfg.label}</span>
                      {order.isPooled && <span className="badge badge-info">🤝 Pooled</span>}
                    </div>
                    <p className="text-xs text-surface-500">
                      #{order._id.slice(-6).toUpperCase()} • {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-primary-400">₹{order.totalAmount}</p>
                    {isActive && timeLeft && (
                      <div className="flex items-center gap-1 text-sm text-accent-400 mt-1">
                        <HiOutlineClock className="w-4 h-4 animate-pulse" />
                        <span className="font-mono font-semibold">{timeLeft}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-1.5">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span className="text-surface-300">
                        {item.name || item.menuItem?.name} × {item.quantity}
                      </span>
                      <span className="text-surface-400">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                </div>

                {/* ETA bar for active orders */}
                {isActive && order.estimatedTime && (
                  <div className="mt-3 pt-3 border-t border-surface-700/50">
                    <div className="flex items-center justify-between text-xs text-surface-400 mb-1.5">
                      <span>Estimated Time</span>
                      <span className="font-semibold text-surface-200">{order.estimatedTime} min</span>
                    </div>
                    <div className="w-full h-1.5 bg-surface-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full gradient-primary transition-all duration-1000"
                        style={{
                          width: `${Math.min(100, Math.max(5, (1 - (new Date(order.estimatedReadyAt) - new Date()) / (order.estimatedTime * 60000)) * 100))}%`
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

