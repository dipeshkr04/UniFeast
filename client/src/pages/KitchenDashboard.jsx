import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { menuAPI, orderAPI } from '../api';
import { useSocket } from '../contexts/SocketContext';
import { HiOutlineRefresh, HiOutlineClock, HiOutlineChartBar, HiOutlineChevronRight } from 'react-icons/hi';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

const Motion = motion;

const flowStages = ['pending', 'queued', 'preparing', 'ready', 'completed'];

const flowMeta = {
  pending: { label: 'Pending', hint: 'Waiting to be acknowledged', color: 'text-amber-400', badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
  queued: { label: 'Queued', hint: 'Already in the kitchen line', color: 'text-blue-400', badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
  preparing: { label: 'Preparing', hint: 'Currently being cooked', color: 'text-orange-400', badge: 'bg-orange-500/10 border-orange-500/20 text-orange-400' },
  ready: { label: 'Ready', hint: 'Waiting for pickup', color: 'text-green-400', badge: 'bg-green-500/10 border-green-500/20 text-green-400' },
  completed: { label: 'Completed', hint: 'Finished and archived', color: 'text-surface-400', badge: 'bg-surface-500/10 border-surface-500/20 text-surface-400' },
};

const statusConfig = {
  pending: { label: 'Pending', badgeClass: 'bg-amber-500/10 text-amber-500 border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]', icon: '⏳', next: 'preparing', nextLabel: 'Start Preparing', btnClass: 'btn-primary' },
  queued: { label: 'Queued', badgeClass: 'bg-blue-500/10 text-blue-500 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.2)]', icon: '📋', next: 'preparing', nextLabel: 'Start Preparing', btnClass: 'btn-primary' },
  preparing: { label: 'Preparing', badgeClass: 'bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-[0_0_10px_rgba(249,115,22,0.2)]', icon: '👨‍🍳', next: null },
  ready: { label: 'Ready', badgeClass: 'bg-green-500/10 text-green-500 border border-green-500/20 shadow-[0_0_10px_rgba(34,197,94,0.2)]', icon: '✅', next: 'completed', nextLabel: 'Complete Order', btnClass: 'bg-surface-700 hover:bg-surface-600' },
  completed: { label: 'Done', badgeClass: 'bg-surface-500/10 text-surface-400 border border-surface-500/20', icon: '🎉', next: null },
  cancelled: { label: 'Cancelled', badgeClass: 'bg-red-500/10 text-red-500 border border-red-500/20', icon: '❌', next: null },
};

function areOrdersEqual(prev = [], next = []) {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;

  for (let i = 0; i < prev.length; i += 1) {
    const a = prev[i];
    const b = next[i];
    if (!a || !b) return false;
    if (a._id !== b._id) return false;
    if (a.status !== b.status) return false;
    if (String(a.updatedAt || '') !== String(b.updatedAt || '')) return false;
  }

  return true;
}

function areStockRowsEqual(prev = [], next = []) {
  if (prev === next) return true;
  if (prev.length !== next.length) return false;

  for (let i = 0; i < prev.length; i += 1) {
    const a = prev[i];
    const b = next[i];
    if (!a || !b) return false;
    if (String(a.menuItemId) !== String(b.menuItemId)) return false;
    if (Number(a.madeQuantity || 0) !== Number(b.madeQuantity || 0)) return false;
    if (Number(a.allocatedQuantity || 0) !== Number(b.allocatedQuantity || 0)) return false;
    if (Number(a.waitingQuantity || 0) !== Number(b.waitingQuantity || 0)) return false;
    if (Number(a.availableQuantity || 0) !== Number(b.availableQuantity || 0)) return false;
  }

  return true;
}

export default function KitchenDashboard() {
  const [orders, setOrders] = useState([]);
  const [completedOrders, setCompletedOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [stockRows, setStockRows] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [productionItemId, setProductionItemId] = useState('');
  const [productionQty, setProductionQty] = useState(1);
  const [submittingProduction, setSubmittingProduction] = useState(false);
  const [selectedStage, setSelectedStage] = useState('active');
  const isMountedRef = useRef(true);
  const { socket } = useSocket() || {};

  const fetchOrders = useCallback(async ({ showLoader = true } = {}) => {
    if (showLoader) {
      setLoadingOrders(true);
    }

    try {
      const [ordersRes, completedRes, stockRes] = await Promise.all([
        orderAPI.getAll({ status: 'active' }),
        orderAPI.getAll({ status: 'completed', limit: 30 }),
        orderAPI.getKitchenStock(),
      ]);

      if (!isMountedRef.current) return;

      const nextOrders = ordersRes.data.data || [];
      const nextCompleted = completedRes.data.data || [];
      const nextStock = stockRes.data.data || [];

      setOrders((prev) => (areOrdersEqual(prev, nextOrders) ? prev : nextOrders));
      setCompletedOrders((prev) => (areOrdersEqual(prev, nextCompleted) ? prev : nextCompleted));
      setStockRows((prev) => (areStockRowsEqual(prev, nextStock) ? prev : nextStock));
    } catch {
      if (showLoader) {
        toast.error('Failed to load orders');
      }
    } finally {
      if (showLoader && isMountedRef.current) {
        setLoadingOrders(false);
      }
    }
  }, []);

  const stageCounts = useMemo(() => {
    const counts = {
      active: orders.length,
      pending: 0,
      queued: 0,
      preparing: 0,
      ready: 0,
      completed: completedOrders.length,
    };

    orders.forEach((order) => {
      if (counts[order.status] !== undefined) {
        counts[order.status] += 1;
      }
    });

    return counts;
  }, [orders, completedOrders.length]);

  const visibleOrders = useMemo(() => {
    if (selectedStage === 'completed') return completedOrders;
    if (selectedStage === 'active') return orders;
    return orders.filter((order) => order.status === selectedStage);
  }, [orders, completedOrders, selectedStage]);

  const totalActiveDemand = useMemo(() => {
    return orders.reduce((sum, order) => sum + order.items.reduce((orderSum, item) => orderSum + Number(item.quantity || 0), 0), 0);
  }, [orders]);

  const orderEtaSummary = useMemo(() => {
    const averageEta = orders.length ? Math.round(orders.reduce((sum, order) => sum + Number(order.estimatedTime || 0), 0) / orders.length) : 0;
    return { averageEta };
  }, [orders]);

  const fetchProductionMeta = useCallback(async () => {
    try {
      const [menuRes, stockRes] = await Promise.all([
        menuAPI.getAll({ available: true }),
        orderAPI.getKitchenStock(),
      ]);
      const items = menuRes.data.data || [];
      setMenuItems(items);
      setStockRows(stockRes.data.data || []);
      setProductionItemId((current) => {
        if (current || items.length === 0) return current;
        const preferred = items.find((x) => x.name?.toLowerCase().includes('chai')) || items[0];
        return preferred?._id || current;
      });
    } catch {
      toast.error('Failed to load kitchen stock data');
    }
  }, []);

  // ── Initial fetch & tab/filter changes ───────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    fetchOrders();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchOrders]);

  useEffect(() => {
    fetchProductionMeta();
  }, [fetchProductionMeta]);

  // ── Socket events ────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (order) => {
      setOrders(prev => [order, ...prev]);
      toast('New order received!', { icon: '🔔' });
    };

    const handleOrderUpdate = () => {
      // Full refresh so status pipeline updates correctly
      fetchOrders({ showLoader: false });
    };

    socket.on('new-order', handleNewOrder);
    socket.on('order-update', handleOrderUpdate);

    return () => {
      socket.off('new-order', handleNewOrder);
      socket.off('order-update', handleOrderUpdate);
    };
  }, [socket, fetchOrders]);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await orderAPI.updateStatus(orderId, newStatus);
      toast.success(`Order updated to ${newStatus}`, { icon: statusConfig[newStatus]?.icon });
      // Immediately refresh so stage counts and lists update in real-time
      await fetchOrders({ showLoader: false });
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
      await fetchOrders({ showLoader: false });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not add produced quantity');
    } finally {
      setSubmittingProduction(false);
    }
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

  const getFulfillmentState = (order) => {
    const requested = order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const assigned = order.items.reduce((sum, item) => sum + Math.min(Number(item.assignedReadyQty || 0), Number(item.quantity || 0)), 0);
    return {
      requested,
      assigned,
      percent: requested > 0 ? Math.round((assigned / requested) * 100) : 0,
      fulfilled: requested > 0 && assigned >= requested,
    };
  };

  const renderFlowStepper = (currentStatus) => {
    const currentIndex = flowStages.indexOf(currentStatus);
    return (
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
        {flowStages.map((stage, index) => {
          const meta = flowMeta[stage];
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <div key={stage} className="flex items-center gap-1.5 shrink-0">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.14em] border ${isDone || isCurrent ? meta.badge : 'bg-white/5 border-white/10 text-surface-500'}`}>
                {meta.label}
              </span>
              {index < flowStages.length - 1 && (
                <HiOutlineChevronRight className={`w-3.5 h-3.5 ${isDone ? meta.color : 'text-surface-600'}`} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-5 max-w-7xl mx-auto pb-8">
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
            <Motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="min-w-0">
            <h1 className="text-3xl sm:text-4xl font-black leading-tight tracking-tight text-white drop-shadow-2xl">
              Kitchen <span className="text-primary-500">Flow</span>
            </h1>
            <p className="text-surface-400 text-xs sm:text-sm mt-2 max-w-xl">
              Track every order state from pending to completed. The ETA is driven by the same queue math used on the student side.
            </p>
          </Motion.div>

          <button onClick={fetchOrders} className="shrink-0 h-11 px-4 rounded-xl bg-white/5 border border-white/10 text-white text-sm font-semibold flex items-center gap-2">
            <HiOutlineRefresh className="w-4 h-4 text-primary-400" />
            Sync
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {[
            { key: 'active', label: 'Active', value: stageCounts.active },
            { key: 'pending', label: 'Pending', value: stageCounts.pending },
            { key: 'queued', label: 'Queued', value: stageCounts.queued },
            { key: 'preparing', label: 'Preparing', value: stageCounts.preparing },
            { key: 'ready', label: 'Ready', value: stageCounts.ready },
            { key: 'completed', label: 'Completed', value: stageCounts.completed },
          ].map((item) => (
            <button
              key={item.key}
              onClick={() => setSelectedStage(item.key)}
              className={`rounded-2xl border p-4 text-left transition-all ${selectedStage === item.key ? 'bg-primary-500/10 border-primary-500/30' : 'bg-white/5 border-white/10 hover:border-white/20'}`}
            >
              <div className="text-[10px] uppercase tracking-[0.2em] text-surface-500 font-bold">{item.label}</div>
              <div className="mt-2 text-2xl font-black text-white">{item.value || 0}</div>
            </button>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-surface-300 text-xs font-semibold uppercase tracking-[0.2em]">
              <HiOutlineChartBar className="w-4 h-4 text-primary-400" /> Queue math
            </div>
            <p className="mt-2 text-sm text-white font-semibold">ETA = Wq + 1/μ</p>
            <p className="mt-1 text-xs text-surface-400">The queue engine uses recent orders and prep time to estimate wait plus service time.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-surface-300 text-xs font-semibold uppercase tracking-[0.2em]">
              <HiOutlineClock className="w-4 h-4 text-primary-400" /> Live queue
            </div>
            <p className="mt-2 text-sm text-white font-semibold">{orders.length} active orders</p>
            <p className="mt-1 text-xs text-surface-400">Average ETA: {orderEtaSummary.averageEta} min · {totalActiveDemand} items waiting</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-surface-300 text-xs font-semibold uppercase tracking-[0.2em]">
              <HiOutlineRefresh className="w-4 h-4 text-primary-400" /> Production
            </div>
            <p className="mt-2 text-sm text-white font-semibold">Mark prepared stock</p>
            <p className="mt-1 text-xs text-surface-400">Add made quantity and let the system auto-allocate it to the oldest waiting orders.</p>
          </div>
        </div>

      </div>

      <AnimatePresence mode="wait">
        <motion.div key={selectedStage} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
          <div className="rounded-3xl border border-white/10 bg-surface-950/70 p-4 sm:p-5">
            <div className="flex flex-col gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-surface-400">Step 1</p>
                <h3 className="text-lg font-black text-white mt-1">Add prepared quantity</h3>
                <p className="text-xs text-surface-500 mt-1">Enter how many units are made. The oldest active orders get fulfilled first.</p>
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
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-3xl border border-white/10 bg-surface-950/70 p-4 sm:p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-surface-400">Step 2</p>
              <h3 className="text-lg font-black text-white mt-1 mb-4">Current kitchen state</h3>

              {loadingOrders ? (
                <div className="grid gap-3">
                  {[1, 2, 3].map((i) => <div key={i} className="skeleton h-40 rounded-2xl" />)}
                </div>
              ) : visibleOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <span className="text-5xl mb-4 grayscale opacity-50">🍳</span>
                  <p className="text-xl font-black text-white">No orders in this stage</p>
                  <p className="text-surface-400 mt-2 text-sm">Switch stages above to inspect another part of the flow.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleOrders.map((order) => {
                    const cfg = statusConfig[order.status] || statusConfig.pending;
                    const canStart = order.status === 'pending' || order.status === 'queued';
                    const fulfillment = getFulfillmentState(order);
                    const canMarkReady = order.status === 'preparing' && fulfillment.fulfilled;
                    const canComplete = order.status === 'ready' && fulfillment.fulfilled;

                    return (
                      <div key={order._id} className="rounded-2xl border border-white/10 bg-[#111114] p-4 sm:p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-black text-white truncate">{order.user?.name} • #{order._id.slice(-6)}</p>
                            <p className="text-xs text-surface-400 mt-1 line-clamp-2">{getItemsSummary(order)}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] border shrink-0 ${cfg.badgeClass}`}>{cfg.label}</span>
                        </div>

                        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                          <div>
                            {renderFlowStepper(order.status)}
                            <p className="mt-2 text-xs text-surface-500">{cfg.hint}</p>
                            <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-surface-400">
                              <span>Fulfilled {fulfillment.assigned}/{fulfillment.requested}</span>
                              <span className={`px-2 py-0.5 rounded-full border ${fulfillment.fulfilled ? 'border-green-500/20 text-green-400 bg-green-500/10' : 'border-amber-500/20 text-amber-400 bg-amber-500/10'}`}>
                                {fulfillment.percent}%
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 sm:min-w-45">
                            {canStart && (
                              <button onClick={() => handleStatusUpdate(order._id, 'preparing')} className="w-full rounded-xl bg-primary-500 px-4 py-3 text-sm font-black text-white">
                                Start cooking
                              </button>
                            )}
                            {canMarkReady && (
                              <button onClick={() => handleStatusUpdate(order._id, 'ready')} className="w-full rounded-xl bg-green-500 px-4 py-3 text-sm font-black text-white disabled:opacity-60 disabled:cursor-not-allowed" disabled={!fulfillment.fulfilled}>
                                Mark ready
                              </button>
                            )}
                            {canComplete && (
                              <button onClick={() => handleStatusUpdate(order._id, 'completed')} className="w-full rounded-xl bg-surface-700 px-4 py-3 text-sm font-black text-white disabled:opacity-60 disabled:cursor-not-allowed" disabled={!fulfillment.fulfilled}>
                                Complete order
                              </button>
                            )}
                            {!canStart && !canMarkReady && !canComplete && (
                              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold text-surface-400 text-center">
                                Read-only stage
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-surface-400">
                          <span>ETA {order.estimatedTime || 0} min</span>
                          <span>Placed {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div className="rounded-3xl border border-white/10 bg-surface-950/70 p-4 sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-surface-400">Step 3</p>
                <h3 className="text-lg font-black text-white mt-1 mb-4">What to cook next</h3>

                <div className="space-y-3">
                  {groupedDemand.length === 0 ? (
                    <p className="text-sm text-surface-500">No active demand.</p>
                  ) : groupedDemand.map((group) => (
                    <div key={group.key} className="rounded-2xl border border-white/10 bg-[#111114] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-white">{group.itemName}</p>
                        <span className="text-xs font-black bg-primary-500/20 text-primary-300 px-2 py-1 rounded-md">{group.totalQty}</span>
                      </div>
                      <div className="mt-3 space-y-1">
                        {group.orders.slice(0, 5).map((entry) => (
                          <div key={`${group.key}-${entry.orderId}-${entry.studentName}`} className="flex items-center justify-between gap-2 text-xs text-surface-300">
                            <span className="truncate">{entry.studentName}</span>
                            <span className="font-bold">{entry.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-surface-950/70 p-4 sm:p-5">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-surface-400">Completed Orders</p>
                <h3 className="text-lg font-black text-white mt-1 mb-4">Recently completed</h3>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {completedOrders.length === 0 ? (
                    <p className="text-sm text-surface-500">No completed orders yet.</p>
                  ) : completedOrders.slice(0, 12).map((order) => (
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
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
