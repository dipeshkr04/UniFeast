import { useState, useEffect, useCallback, useRef } from 'react';
import { orderAPI } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { HiOutlineCalendar, HiOutlineClock, HiOutlineRefresh, HiX } from 'react-icons/hi';
import { MdQrCode2 } from 'react-icons/md';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'qrcode';

const Motion = motion;

const statusConfig = {
  pending: { label: 'Pending', color: 'badge-warning', border: 'border-l-warning', emoji: '⏳' },
  queued: { label: 'Queued', color: 'badge-info', border: 'border-l-info', emoji: '📋' },
  preparing: { label: 'Preparing', color: 'badge-primary', border: 'border-l-primary-500', emoji: '👨‍🍳' },
  ready: { label: 'Ready!', color: 'badge-success', border: 'border-l-success', emoji: '✅' },
  completed: { label: 'Completed', color: 'badge-success', border: 'border-l-success', emoji: '🎉' },
  cancelled: { label: 'Cancelled', color: 'badge-danger', border: 'border-l-danger', emoji: '❌' },
};

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [reconnecting, setReconnecting] = useState(false);
  const [qrModal, setQrModal] = useState(null);
  const [qrLoading, setQrLoading] = useState(false);
  const { socket } = useSocket() || {};
  const lastStatusToastRef = useRef({ key: '', time: 0 });
  const dateInputRef = useRef(null);

  const fetchOrders = useCallback(async () => {
    try {
      const params = {};
      if (filter) params.status = filter;
      const { data } = await orderAPI.getMy(params);
      setOrders(data.data || []);
    } catch {
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
      if (['completed', 'cancelled'].includes(nextStatus)) {
        setQrModal((current) => (
          current?.order?._id === (data.order?._id || data.orderId) ? null : current
        ));
      }
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

  const toDateInputValue = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 10);
  };

  const visibleOrders = dateFilter
    ? orders.filter((order) => toDateInputValue(order.createdAt) === dateFilter)
    : orders;
  const selectedDateExpense = visibleOrders.reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);
  const formatCurrency = (value) => new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
  const selectedDateLabel = dateFilter
    ? new Date(`${dateFilter}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;
    try {
      if (typeof input.showPicker === 'function') {
        input.showPicker();
      } else {
        input.focus();
      }
    } catch {
      input.focus();
    }
  };

  const canShowQr = (order) => !['completed', 'cancelled'].includes(String(order.status || '').toLowerCase());

  const getQrModalAnchor = (trigger) => {
    if (!trigger || typeof window === 'undefined') return null;

    const rect = trigger.getBoundingClientRect();
    const gutter = 14;
    const modalWidth = Math.min(380, window.innerWidth - gutter * 2);
    const modalHeight = Math.min(460, window.innerHeight - gutter * 2);
    const maxLeft = Math.max(gutter, window.innerWidth - modalWidth - gutter);
    const preferredLeft = rect.right - modalWidth;
    const left = Math.min(Math.max(gutter, preferredLeft), maxLeft);
    const lowerTop = rect.bottom + 10;
    const upperTop = rect.top - modalHeight - 10;
    const preferredTop = lowerTop + modalHeight <= window.innerHeight - gutter ? lowerTop : upperTop;
    const maxTop = Math.max(gutter, window.innerHeight - modalHeight - gutter);
    const top = Math.min(Math.max(gutter, preferredTop), maxTop);

    return { top, left };
  };

  const openQrModal = async (order, event) => {
    const anchor = getQrModalAnchor(event?.currentTarget);
    setQrLoading(true);
    try {
      const { data } = await orderAPI.getQr(order._id);
      const qrImage = await QRCode.toDataURL(data.data.qrPayload, {
        width: 280,
        margin: 2,
        color: {
          dark: '#050505',
          light: '#ffffff',
        },
      });
      setQrModal({
        order,
        qrImage,
        issuedAt: data.data.issuedAt,
        anchor,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to generate QR for this order');
    } finally {
      setQrLoading(false);
    }
  };

  return (
    <div className="student-orders-page animate-fadeIn">
      <div className="student-orders-header">
        <div className="student-orders-title-block">
          <h2 className="student-orders-title">My <span className="text-primary-400">Orders</span></h2>
          <p>Track your orders in real-time</p>
        </div>
        <div className="student-orders-actions">
          <button onClick={fetchOrders} className="student-orders-refresh btn-secondary" id="refresh-orders">
            <HiOutlineRefresh className="w-4 h-4" /> Refresh
          </button>
          <div className="student-orders-date-filter" onClick={openDatePicker}>
            <HiOutlineCalendar className="student-orders-date-icon" />
            <input
              ref={dateInputRef}
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              aria-label="Filter orders by date"
              id="orders-date-filter"
            />
            {dateFilter && (
              <button type="button" onClick={(e) => { e.stopPropagation(); setDateFilter(''); }} aria-label="Clear date filter">
                <HiX />
              </button>
            )}
          </div>
        </div>
      </div>

      {dateFilter && (
        <div className="student-orders-date-summary">
          <span>{selectedDateLabel}</span>
          <strong>Spent {formatCurrency(selectedDateExpense)}</strong>
          <span>{visibleOrders.length} order{visibleOrders.length === 1 ? '' : 's'}</span>
        </div>
      )}

      {reconnecting && (
        <div className="student-orders-reconnect">
          Reconnecting... live updates are paused
        </div>
      )}

      <div className="student-orders-filter-scroll scrollbar-none">
        {['', 'pending', 'queued', 'preparing', 'ready', 'completed'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`student-orders-filter-btn
              ${filter === s ? 'tab-active' : 'bg-surface-800/40 text-surface-400 hover:bg-surface-700/40 border border-surface-700/30'}`}
            id={`filter-${s || 'all'}`}
          >
            {s ? statusConfig[s].emoji + ' ' + statusConfig[s].label : '📋 All Orders'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="student-orders-loading-grid">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton student-orders-skeleton" />)}</div>
      ) : visibleOrders.length === 0 ? (
        <div className="student-orders-empty glass-card-static">
          <div className="text-5xl mb-4">📭</div>
          <h3>No orders found</h3>
          <p>{dateFilter ? `No orders found for ${selectedDateLabel}.` : "You haven't placed any orders yet, or they don't match this filter."}</p>
        </div>
      ) : (
        <div className="student-orders-groups">
          {(() => {
            const grouped = {};
            visibleOrders.forEach((order) => {
              const dateKey = new Date(order.createdAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
              if (!grouped[dateKey]) grouped[dateKey] = [];
              grouped[dateKey].push(order);
            });
            const sortedDates = Object.keys(grouped).sort((a, b) => new Date(grouped[b][0].createdAt) - new Date(grouped[a][0].createdAt));

            return sortedDates.map((dateKey) => (
              <div className="student-orders-date-group" key={dateKey}>
                <div className="student-orders-date-divider">
                  <div />
                  <span>{dateKey}</span>
                  <div />
                </div>
                <div className="student-orders-list">
                  <AnimatePresence mode="popLayout">
                    {grouped[dateKey].map((order) => {
                      const cfg = statusConfig[order.status] || statusConfig.pending;
                      const timeLeft = getTimeLeft(order.estimatedReadyAt);
                      const isActive = ['pending', 'queued', 'preparing'].includes(order.status);
                      const placedTime = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                      return (
                        <Motion.div layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} key={order._id}
                          className={`student-order-card glass-card-static border-l-4 ${cfg.border}`} id={`order-${order._id}`}>
                          <div className="student-order-top">
                            <div className="student-order-status-row">
                              <div className="student-order-badges">
                                <span className={`badge ${cfg.color}`}>{cfg.emoji} {cfg.label}</span>
                                {order.isPooled && <span className="badge badge-info">🤝 Pooled</span>}
                              </div>
                              <div className="student-order-total-tools">
                                {canShowQr(order) && (
                                  <button
                                    type="button"
                                    onClick={(event) => openQrModal(order, event)}
                                    className="student-order-qr-btn"
                                    aria-label={`Show pickup QR for order ${order._id.slice(-6).toUpperCase()}`}
                                    title="Show pickup QR"
                                    disabled={qrLoading}
                                  >
                                    <MdQrCode2 />
                                  </button>
                                )}
                                <div className="student-order-total">
                                  <p>₹{order.totalAmount}</p>
                                </div>
                              </div>
                            </div>
                            <div className="student-order-meta-row">
                              <p className="student-order-meta">
                                <strong>#{order._id.slice(-6).toUpperCase()}</strong>
                                <span>{placedTime}</span>
                              </p>
                              <div className="student-order-pickup-tools">
                                {isActive && timeLeft && (
                                  <div className="student-order-eta">
                                    <HiOutlineClock className="w-4 h-4 animate-pulse" />
                                    <span>{timeLeft}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="student-order-items">
                            {order.items.map((item, i) => {
                              const itemQty = Number(item.quantity || 0);
                              const orderStatus = String(order.status || '').toLowerCase();
                              const readyQty = ['ready', 'completed'].includes(orderStatus)
                                ? itemQty
                                : Math.min(Number(item.assignedReadyQty || 0), itemQty);
                              const isItemReady = readyQty > 0 && readyQty >= itemQty;

                              return (
                                <div key={i} className="student-order-item-row">
                                  <span className="student-order-item-name">
                                    <span className="student-order-item-qty">{item.quantity}x</span>
                                    {item.name || item.menuItem?.name}
                                    {readyQty > 0 && (
                                      <span className={`student-order-ready-chip ${isItemReady ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-200 border border-amber-500/30'}`}>
                                        {readyQty}/{item.quantity} ready
                                      </span>
                                    )}
                                  </span>
                                  <span className="student-order-item-price">₹{item.price * item.quantity}</span>
                                </div>
                              );
                            })}
                          </div>

                          {['queued', 'preparing'].includes(order.status) && order.estimatedReadyAt && order.estimatedTime && (
                            <div className="student-order-progress">
                              <div className="student-order-progress-meta">
                                <span>Progress</span>
                                <span>{order.estimatedTime} min</span>
                              </div>
                              <div className="student-order-progress-track">
                                <div className="student-order-progress-fill gradient-primary" style={{
                                  width: `${Math.min(100, Math.max(5, (1 - (new Date(order.estimatedReadyAt) - new Date()) / (order.estimatedTime * 60000)) * 100))}%`,
                                  transition: 'width 1s linear'
                                }} />
                              </div>
                            </div>
                          )}
                        </Motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      <AnimatePresence>
        {qrModal && (
          <Motion.div
            className="order-qr-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setQrModal(null)}
          >
            <Motion.div
              className="order-qr-modal glass-card-static"
              style={qrModal.anchor ? { top: qrModal.anchor.top, left: qrModal.anchor.left } : undefined}
              initial={{ scale: 0.94, y: 18 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 18 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="order-qr-close" onClick={() => setQrModal(null)} aria-label="Close QR">
                <HiX />
              </button>
              <div className="order-qr-heading">
                <span className="badge badge-primary">Pickup QR</span>
                <h3>Order #{qrModal.order._id.slice(-6).toUpperCase()}</h3>
                <p>Show this at the counter. It expires automatically once pickup is confirmed.</p>
              </div>
              <div className="order-qr-frame">
                <img src={qrModal.qrImage} alt="Order pickup QR code" />
              </div>
              <div className="order-qr-meta">
                <span>{new Date(qrModal.order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span>₹{qrModal.order.totalAmount}</span>
              </div>
            </Motion.div>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}



