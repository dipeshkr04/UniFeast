import { useState, useEffect, useCallback, useRef } from 'react';
import { orderAPI } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { HiOutlineClock, HiOutlineRefresh } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [reconnecting, setReconnecting] = useState(false);
  const { socket } = useSocket() || {};
  const lastStatusToastRef = useRef({ key: '', time: 0 });

  const fetchOrders = useCallback(async () => {
    try {
      const params = {};
      if (filter) params.status = filter;
      const { data } = await orderAPI.getMy(params);
      setOrders(data.data || []);
    } catch (err) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!socket) return;

    const handleOrderUpdate = (data) => {
      const nextStatus = (data.status || data.newStatus || '').toLowerCase();
      setOrders((prev) => prev.map((o) => {
        if (data.order?._id === o._id) {
          return { ...o, ...data.order };
        }
        return o._id === data.orderId
          ? {
            ...o,
            status: nextStatus || o.status,
            estimatedTime: data.estimatedTime ?? o.estimatedTime,
            estimatedReadyAt: data.estimatedReadyAt ?? o.estimatedReadyAt,
          }
          : o;
      }));
      const cfg = statusConfig[nextStatus];
      const toastKey = `${data.orderId}:${nextStatus}:${data.notification || ''}`;
      const now = Date.now();
      const shouldToast = toastKey !== lastStatusToastRef.current.key || now - lastStatusToastRef.current.time > 2000;

      if (shouldToast) {
        lastStatusToastRef.current = { key: toastKey, time: now };
        if (data.notification) {
          toast.success(data.notification);
        } else if (cfg) {
          toast(`Order ${cfg.emoji} ${cfg.label}`, { icon: cfg.emoji });
        }
      }
    };

    const handleETAUpdate = (data) => {
      setOrders((prev) => prev.map((o) =>
        o._id === data.orderId
          ? { ...o, estimatedTime: data.estimatedTime ?? data.eta, estimatedReadyAt: data.estimatedReadyAt }
          : o
      ));
    };

    const handleReconnect = async () => {
      setReconnecting(false);
      await fetchOrders();
    };

    const handleDisconnect = () => setReconnecting(true);
    const handleConnectError = () => setReconnecting(true);
    const handleConnect = async () => {
      setReconnecting(false);
      if (socket.recovered === false) {
        await fetchOrders();
      }
    };

    socket.on('order-update', handleOrderUpdate);
    socket.on('order:statusChanged', handleOrderUpdate);
    socket.on('order:itemReady', handleOrderUpdate);
    socket.on('eta-update', handleETAUpdate);
    socket.on('reconnect', handleReconnect);
    socket.io?.on('reconnect', handleReconnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('order-update', handleOrderUpdate);
      socket.off('order:statusChanged', handleOrderUpdate);
      socket.off('order:itemReady', handleOrderUpdate);
      socket.off('eta-update', handleETAUpdate);
      socket.off('reconnect', handleReconnect);
      socket.io?.off('reconnect', handleReconnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.off('connect', handleConnect);
    };
  }, [socket, fetchOrders]);

  const getTimeLeft = (estimatedReadyAt) => {
    if (!estimatedReadyAt) return null;
    const diff = new Date(estimatedReadyAt) - new Date();
    if (diff <= 0) return 'Any moment now';
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
  };

  const [, setTick] = useState(0);
  useEffect(() => {
    const hasActiveEta = orders.some((o) => ['queued', 'preparing'].includes(o.status) && o.estimatedReadyAt);
    if (!hasActiveEta) return;
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [orders]);

  return (
    <div className="animate-fadeIn">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight tracking-tight">My <span className="text-primary-400">Orders</span></h1>
          <p className="text-surface-400 mt-2 text-sm">Track your orders in real-time</p>
        </div>
        <button onClick={fetchOrders} className="btn-secondary flex items-center gap-2 text-sm min-h-[44px] px-4 py-2.5 self-start" id="refresh-orders">
          <HiOutlineRefresh className="w-4 h-4" /> Refresh
        </button>
      </div>

      {reconnecting && (
        <div className="mb-4 rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm text-amber-100">
          Reconnecting... live updates are paused
        </div>
      )}

      <div className="flex gap-2 mb-6 md:mb-8 overflow-x-auto pb-3 scrollbar-none">
        {['', 'pending', 'queued', 'preparing', 'ready', 'completed'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all min-h-[44px]
              ${filter === s ? 'tab-active' : 'bg-surface-800/40 text-surface-400 hover:bg-surface-700/40 border border-surface-700/30'}`}
            id={`filter-${s || 'all'}`}
          >
            {s ? statusConfig[s].emoji + ' ' + statusConfig[s].label : '📋 All Orders'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 md:gap-6 md:grid-cols-2">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-44 rounded-2xl" />)}</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 md:py-20 glass-card-static max-w-md mx-auto">
          <div className="text-5xl mb-4">📭</div>
          <h3 className="text-lg font-bold mb-2">No orders found</h3>
          <p className="text-surface-400 text-sm">You haven't placed any orders yet, or they don't match this filter.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {(() => {
            const grouped = {};
            orders.forEach((order) => {
              const dateKey = new Date(order.createdAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
              if (!grouped[dateKey]) grouped[dateKey] = [];
              grouped[dateKey].push(order);
            });
            const sortedDates = Object.keys(grouped).sort((a, b) => new Date(grouped[b][0].createdAt) - new Date(grouped[a][0].createdAt));

            return sortedDates.map((dateKey) => (
              <div key={dateKey}>
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-px flex-1 bg-surface-800" />
                  <span className="text-xs font-black uppercase tracking-widest text-surface-500 bg-surface-900/80 px-3 py-1.5 rounded-full border border-surface-800">{dateKey}</span>
                  <div className="h-px flex-1 bg-surface-800" />
                </div>
                <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
                  <AnimatePresence mode="popLayout">
                    {grouped[dateKey].map((order) => {
                      const cfg = statusConfig[order.status] || statusConfig.pending;
                      const timeLeft = getTimeLeft(order.estimatedReadyAt);
                      const isActive = ['pending', 'queued', 'preparing'].includes(order.status);

                      return (
                        <motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} key={order._id}
                          className={`glass-card-static p-4 md:p-6 flex flex-col relative overflow-hidden ${isActive ? 'border-l-4 border-l-primary-500' : ''}`} id={`order-${order._id}`}>
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className={`badge ${cfg.color}`}>{cfg.emoji} {cfg.label}</span>
                                {order.isPooled && <span className="badge badge-info">🤝 Pooled</span>}
                              </div>
                              <p className="text-xs text-surface-400 font-medium">#{order._id.slice(-6).toUpperCase()} • {new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} • {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <div className="text-right shrink-0 ml-4">
                              <p className="text-xl font-bold text-primary-400">₹{order.totalAmount}</p>
                              {isActive && timeLeft && (
                                <div className="flex items-center gap-1 text-sm text-accent-400 mt-1">
                                  <HiOutlineClock className="w-4 h-4 animate-pulse" />
                                  <span className="font-mono font-semibold text-xs">{timeLeft}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="space-y-1.5 mb-4 flex-1">
                            {order.items.map((item, i) => {
                              const readyQty = Math.min(Number(item.assignedReadyQty || 0), Number(item.quantity || 0));
                              const isItemReady = readyQty > 0 && readyQty >= Number(item.quantity || 0);

                              return (
                                <div key={i} className="flex justify-between items-center text-sm py-1.5 px-3 rounded-lg bg-surface-800/30 border border-surface-700/20">
                                  <span className="text-surface-200 flex flex-wrap items-center gap-2">
                                    <span className="text-xs text-surface-400 font-mono">{item.quantity}x</span>
                                    {item.name || item.menuItem?.name}
                                    {readyQty > 0 && (
                                      <span className={`text-[10px] font-black uppercase tracking-wide rounded-full px-2 py-0.5 ${isItemReady ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-200 border border-amber-500/30'}`}>
                                        {readyQty}/{item.quantity} ready
                                      </span>
                                    )}
                                  </span>
                                  <span className="text-surface-400 font-mono text-xs">₹{item.price * item.quantity}</span>
                                </div>
                              );
                            })}
                          </div>

                          {['queued', 'preparing'].includes(order.status) && order.estimatedReadyAt && order.estimatedTime && (
                            <div className="pt-4 border-t border-surface-700/50 mt-auto">
                              <div className="flex items-center justify-between text-xs text-surface-400 mb-2">
                                <span className="font-semibold uppercase tracking-wider">Progress</span>
                                <span className="font-bold text-surface-200">{order.estimatedTime} min</span>
                              </div>
                              <div className="w-full h-2 bg-surface-800/80 rounded-full overflow-hidden">
                                <div className="h-full rounded-full gradient-primary relative" style={{
                                  width: `${Math.min(100, Math.max(5, (1 - (new Date(order.estimatedReadyAt) - new Date()) / (order.estimatedTime * 60000)) * 100))}%`,
                                  transition: 'width 1s linear'
                                }} />
                              </div>
                            </div>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}



