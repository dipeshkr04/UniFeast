import { useState, useEffect, useMemo, useContext, useCallback } from 'react';
import toast from 'react-hot-toast';
import { KitchenLocalContext } from './KitchenSocketProvider';

export const useKitchenOrders = () => {
  const { socket } = useContext(KitchenLocalContext) || {};
  const [orders, setOrders] = useState(new Map());
  const [activeFilter, setActiveFilter] = useState('ACTIVE');
  const [dishFilter, setDishFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [summary, setSummary] = useState({
    PENDING: 0, QUEUED: 0, PREPARING: 0, READY: 0, COMPLETED: 0, CANCELLED: 0, totalActive: 0, queueStats: {}
  });
  const [isConnected, setIsConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [hasConnected, setHasConnected] = useState(false);

  const markEveryItemReady = useCallback((order) => ({
    ...order,
    items: (order.items || []).map((item) => ({
      ...item,
      assignedReadyQty: item.quantity,
    })),
  }), []);

  const fetchLiveOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders/kitchen/live', {
        headers: { Authorization: `Bearer ${localStorage.getItem('unifeast_token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        const map = new Map();
        data.forEach((o) => map.set(o._id, o));
        setOrders(map);
      } else {
        toast.error('Failed to load live kitchen orders');
      }
    } catch (err) {
      console.error('Failed to fetch live orders', err);
      toast.error('Failed to load live kitchen orders');
    }
  }, []);

  const refreshSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/orders/kitchen/summary', {
        headers: { Authorization: `Bearer ${localStorage.getItem('unifeast_token')}` }
      });
      if (res.ok) {
        setSummary(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch summary', err);
    }
  }, []);

  useEffect(() => {
    fetchLiveOrders();
    refreshSummary();
  }, [fetchLiveOrders, refreshSummary]);

  useEffect(() => {
    if (!socket) return;

    const onConnect = async () => {
      setHasConnected(true);
      setIsConnected(true);
      setReconnecting(false);
      socket.emit('kitchen:join');
      if (socket.recovered === false) {
        await fetchLiveOrders();
      }
    };

    const onReconnect = async () => {
      console.log('[socket] reconnected - re-fetching live orders');
      setReconnecting(false);
      await fetchLiveOrders();
      await refreshSummary();
    };

    const onDisconnect = () => {
      setIsConnected(false);
      setReconnecting(hasConnected);
    };

    const onConnectError = () => {
      setIsConnected(false);
      setReconnecting(hasConnected);
    };

    setIsConnected(socket.connected);
    if (socket.connected) {
      setHasConnected(true);
    }

    socket.on('connect', onConnect);
    socket.on('reconnect', onReconnect);
    socket.io?.on('reconnect', onReconnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);

    socket.on('order:new', ({ order }) => {
      if (!order?._id) return;
      setOrders((prev) => new Map(prev).set(order._id, order));
      refreshSummary();
    });

    socket.on('order-update', ({ orderId, status, newStatus, order }) => {
      const nextStatus = (status || newStatus || '').toLowerCase();
      setOrders((prev) => {
        const next = new Map(prev);
        if (order?._id) {
          next.set(order._id, order);
        } else if (next.has(orderId)) {
          next.set(orderId, { ...next.get(orderId), status: nextStatus });
        }
        return next;
      });
      refreshSummary();
    });

    socket.on('order:statusChanged', ({ orderId, status, newStatus, order }) => {
      const nextStatus = (status || newStatus || '').toLowerCase();
      setOrders((prev) => {
        const next = new Map(prev);
        if (order?._id) {
          next.set(order._id, order);
        } else if (next.has(orderId)) {
          next.set(orderId, { ...next.get(orderId), status: nextStatus });
        }
        return next;
      });
      refreshSummary();
    });

    socket.on('order:itemReady', ({ orderId, order }) => {
      setOrders((prev) => {
        const next = new Map(prev);
        if (order?._id) {
          next.set(order._id, order);
        } else if (orderId && next.has(orderId)) {
          next.set(orderId, { ...next.get(orderId) });
        }
        return next;
      });
      refreshSummary();
    });

    socket.on('order:etaUpdated', ({ orderId, newETA, queuePosition, estimatedReadyAt }) => {
      setOrders((prev) => {
        const next = new Map(prev);
        const existing = next.get(orderId);
        if (existing) {
          next.set(orderId, {
            ...existing,
            eta: newETA,
            estimatedTime: newETA,
            estimatedReadyAt: estimatedReadyAt ?? existing.estimatedReadyAt,
            queuePosition,
          });
        }
        return next;
      });
    });

    socket.on('queue:etasBulkUpdated', (updates = []) => {
      setOrders((prev) => {
        const next = new Map(prev);
        updates.forEach(({ orderId, newETA, queuePosition, estimatedReadyAt }) => {
          const existing = next.get(orderId);
          if (existing) {
            next.set(orderId, {
              ...existing,
              eta: newETA,
              estimatedTime: newETA,
              estimatedReadyAt: estimatedReadyAt ?? existing.estimatedReadyAt,
              queuePosition
            });
          }
        });
        return next;
      });
    });

    socket.on('kitchen:summary', (sum) => setSummary(sum));

    socket.emit('kitchen:join');

    return () => {
      socket.off('connect', onConnect);
      socket.off('reconnect', onReconnect);
      socket.io?.off('reconnect', onReconnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('order:new');
      socket.off('order-update');
      socket.off('order:statusChanged');
      socket.off('order:itemReady');
      socket.off('order:etaUpdated');
      socket.off('queue:etasBulkUpdated');
      socket.off('kitchen:summary');
    };
  }, [socket, fetchLiveOrders, refreshSummary, hasConnected]);

  const updateOrderStatus = async (orderId, newStatus) => {
    const nextStatus = (newStatus || '').toLowerCase();
    const previousMap = new Map(orders);
    const current = previousMap.get(orderId);
    if (!current) return;

    const optimisticOrder = nextStatus === 'completed'
      ? markEveryItemReady({ ...current, status: nextStatus })
      : { ...current, status: nextStatus };

    setOrders((prev) => new Map(prev).set(orderId, optimisticOrder));

    try {
      const idempotencyKey = `${orderId}-${nextStatus}`;
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('unifeast_token')}`,
        },
        body: JSON.stringify({ newStatus: nextStatus, idempotencyKey })
      });

      if (!res.ok) {
        if (res.status === 409) {
          toast.error('Order was updated elsewhere - refreshing');
          await fetchLiveOrders();
          await refreshSummary();
          return;
        }
        throw new Error('Update failed');
      }

      const data = await res.json().catch(() => ({}));
      if (data.order?._id) {
        const nextOrder = nextStatus === 'completed'
          ? markEveryItemReady(data.order)
          : data.order;
        setOrders((prev) => new Map(prev).set(nextOrder._id, nextOrder));
      }
      await refreshSummary();
    } catch (err) {
      console.error(err);
      setOrders(previousMap);
      toast.error('Failed to update status. Please retry.');
    }
  };

  const markItemReady = async (orderId, itemId) => {
    const previousMap = new Map(orders);
    const current = previousMap.get(orderId);
    if (!current) return;

    setOrders((prev) => {
      const next = new Map(prev);
      next.set(orderId, {
        ...current,
        items: (current.items || []).map((item) =>
          item._id === itemId ? { ...item, assignedReadyQty: item.quantity } : item
        ),
      });
      return next;
    });

    try {
      const res = await fetch(`/api/orders/${orderId}/items/${itemId}/ready`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('unifeast_token')}`,
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to mark item ready');
      }

      if (data.order?._id) {
        setOrders((prev) => new Map(prev).set(data.order._id, data.order));
      }
      await refreshSummary();
      toast.success(data.message || 'Item marked ready');
    } catch (err) {
      setOrders(previousMap);
      toast.error(err.message || 'Failed to mark item ready');
    }
  };

  const getItemName = useCallback((item) => (
    item?.name || item?.menuItem?.name || 'Unknown item'
  ), []);

  const normalizeDishName = useCallback((value) => (
    String(value || '').trim().toLowerCase()
  ), []);

  const getOrderSearchText = useCallback((order) => {
    const user = order.user || order.student || {};
    const btId = String(user.btId || order.btId || user.email || '').split('@')[0];
    const token = String(order.orderId || order._id?.slice(-4) || '');
    return [
      btId,
      user.name,
      order.user?.name,
      order.student?.name,
      token,
      order.orderId,
      order._id,
    ].filter(Boolean).join(' ').toLowerCase();
  }, []);

  const dishOptions = useMemo(() => {
    const stats = new Map();

    Array.from(orders.values()).forEach((order) => {
      const orderDishKeys = new Set();

      (order.items || []).forEach((item) => {
        const name = getItemName(item);
        const key = normalizeDishName(name);
        if (!key) return;

        const current = stats.get(key) || {
          key,
          name,
          orderCount: 0,
          quantity: 0,
        };
        current.quantity += Number(item.quantity || 0);
        stats.set(key, current);
        orderDishKeys.add(key);
      });

      orderDishKeys.forEach((key) => {
        const current = stats.get(key);
        if (current) current.orderCount += 1;
      });
    });

    return Array.from(stats.values()).sort((a, b) =>
      b.quantity - a.quantity || a.name.localeCompare(b.name)
    );
  }, [orders, getItemName, normalizeDishName]);

  const selectedDish = useMemo(() => (
    dishOptions.find((dish) => dish.key === dishFilter) || null
  ), [dishFilter, dishOptions]);

  const filteredOrders = useMemo(() => {
    let arr = Array.from(orders.values());
    if (activeFilter === 'ACTIVE') {
      arr = arr.filter((o) => !['completed', 'cancelled'].includes((o.status || '').toLowerCase()));
    } else {
      arr = arr.filter((o) => (o.status || '').toUpperCase() === activeFilter);
    }

    if (dishFilter !== 'ALL') {
      arr = arr.filter((order) => (
        (order.items || []).some((item) => normalizeDishName(getItemName(item)) === dishFilter)
      ));
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      arr = arr.filter((order) => getOrderSearchText(order).includes(query));
    }

    return arr.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [orders, activeFilter, dishFilter, searchQuery, getItemName, getOrderSearchText, normalizeDishName]);

  const isOverloaded = Boolean(summary?.queueStats?.isOverloaded);

  return {
    orders,
    filteredOrders,
    activeFilter,
    setActiveFilter,
    dishFilter,
    setDishFilter,
    searchQuery,
    setSearchQuery,
    dishOptions,
    selectedDish,
    summary,
    isConnected,
    reconnecting,
    isOverloaded,
    updateOrderStatus,
    markItemReady,
    refreshSummary,
    fetchLiveOrders,
  };
};



