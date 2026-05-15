import React, { useEffect, useState } from 'react';
import { STATUS_COLORS, URGENCY } from './kitchenColors';
import { getImageUrl } from '../../utils/imageUrl';

const getOrderItemId = (order, item, index) => String(item._id || item.menuItem?._id || `${order._id}-${index}`);
const EMPTY_PICKUP_CHECKED = new Set();

const getFallbackThumb = (name = 'Food') => {
  const seed = String(name || 'Food').split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const palettes = [
    ['#451a03', '#f97316', '#fed7aa'],
    ['#052e16', '#10b981', '#bbf7d0'],
    ['#172554', '#3b82f6', '#dbeafe'],
    ['#3b0764', '#a855f7', '#f3e8ff'],
  ];
  const [bg, accent, plate] = palettes[seed % palettes.length];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <defs>
        <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stop-color="${accent}"/>
          <stop offset="1" stop-color="${bg}"/>
        </linearGradient>
      </defs>
      <rect width="96" height="96" rx="20" fill="url(#g)"/>
      <circle cx="48" cy="52" r="25" fill="${plate}" opacity=".94"/>
      <circle cx="48" cy="52" r="15" fill="${accent}" opacity=".28"/>
      <path d="M28 23v22M35 23v22M31.5 45v25M68 24c-8 8-9 20-3 28v18" stroke="${plate}" stroke-width="5" stroke-linecap="round" fill="none"/>
    </svg>
  `.trim();
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

const isFullyReadyOrder = (nextOrder) => {
  const items = nextOrder?.items || [];
  return items.length > 0 && items.every((item) => {
    const quantity = Number(item.quantity || 0);
    const readyQuantity = Number(item.assignedReadyQty || 0);
    return quantity > 0 && readyQuantity >= quantity;
  });
};

const OrderCard = ({ order, onStatusUpdate, onItemReady, busyOrderIds, busyItemIds }) => {
  const normalizedStatus = (order.status || 'pending').toLowerCase();
  const status = normalizedStatus.toUpperCase();
  const colors = STATUS_COLORS[status] || STATUS_COLORS.PENDING;
  const isOrderCompleted = status === 'COMPLETED';
  const isOrderReady = status === 'READY';
  const pickupKey = `${order._id}:${status}`;
  const [pickupState, setPickupState] = useState(() => ({ key: pickupKey, checked: new Set() }));
  const [now, setNow] = useState(Date.now);
  const pickupChecked = pickupState.key === pickupKey ? pickupState.checked : EMPTY_PICKUP_CHECKED;

  const shouldRefreshEta = ['QUEUED', 'PREPARING'].includes(status) && Boolean(order.estimatedReadyAt || order.eta);
  useEffect(() => {
    if (!shouldRefreshEta) return undefined;
    const updateSoon = setTimeout(() => setNow(Date.now), 0);
    const timer = setInterval(() => setNow(Date.now), 30000);
    return () => {
      clearTimeout(updateSoon);
      clearInterval(timer);
    };
  }, [order._id, order.estimatedReadyAt, order.eta, shouldRefreshEta]);

  let extraClasses = '';
  let shadow = URGENCY.NORMAL.shadow;

  const etaTarget = order.estimatedReadyAt
    ? new Date(order.estimatedReadyAt)
    : typeof order.eta === 'number'
      ? new Date(now + order.eta * 60000)
      : order.eta
        ? new Date(order.eta)
        : null;
  if (['QUEUED', 'PREPARING'].includes(status) && etaTarget && order.startedAt) {
    const elapsedRatio =
      (now - new Date(order.startedAt).getTime()) /
      (new Date(etaTarget).getTime() - new Date(order.startedAt).getTime());
    if (elapsedRatio > 1.0) {
      extraClasses = 'critical pulse';
      shadow = URGENCY.CRITICAL.shadow;
    } else if (elapsedRatio > 0.75) {
      shadow = URGENCY.WARNING.shadow;
    }
  }

  const handleAction = () => {
    if (busyOrderIds?.has(order._id)) return;
    let target = null;
    if (status === 'QUEUED') target = 'PREPARING';
    if (status === 'PREPARING') target = 'READY';
    if (status === 'READY') target = 'COMPLETED';
    if (target) onStatusUpdate(order._id, target);
  };

  const getButtonText = () => {
    if (status === 'QUEUED') return 'Start Cooking';
    if (status === 'PREPARING') return 'Mark Ready';
    if (status === 'READY') return 'Confirm Pickup';
    return null;
  };

  const handleItemToggle = async (itemId, canMarkItemReady) => {
    if (busyOrderIds?.has(order._id) || busyItemIds?.has(`${order._id}:${itemId}`)) return;

    if (isOrderReady) {
      const next = new Set(pickupChecked);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      setPickupState({ key: pickupKey, checked: next });
      if ((order.items || []).length > 0 && next.size >= (order.items || []).length) {
        onStatusUpdate?.(order._id, 'COMPLETED');
      }
      return;
    }

    if (canMarkItemReady) {
      const updatedOrder = await onItemReady?.(order._id, itemId);
      if (updatedOrder && typeof updatedOrder === 'object') {
        const updatedStatus = String(updatedOrder.status || '').toUpperCase();
        if (updatedStatus === 'READY' || isFullyReadyOrder(updatedOrder)) {
          await onStatusUpdate?.(updatedOrder._id || order._id, 'COMPLETED');
        }
      }
    }
  };

  const studentName = order.user?.name || order.student?.name || 'Unknown';
  const rawBtId =
    order.user?.btId ||
    order.student?.btId ||
    order.btId ||
    order.user?.email ||
    order.student?.email ||
    `ID-${String(order.user?._id || '').slice(-4) || 'N/A'}`;
  const btId = String(rawBtId || '').split('@')[0];
  const createdTime = new Date(order.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  const shortOrderId = `#${(order.orderId || order._id?.slice(-4) || '').toString().toUpperCase()}`;

  return (
    <article
      className={`order-card ${extraClasses}`}
      style={{
        backgroundColor: colors.bg,
        borderLeftColor: colors.border,
        boxShadow: shadow,
      }}
    >
      <div className="order-card-accent" style={{ backgroundColor: colors.border }} />

      <div className="order-card-header">
        <div className="order-left-meta">
          <span className="meta-time">{createdTime}</span>
          <span className="meta-btid">BT: {btId}</span>
        </div>
        <div className="order-right-meta">
          <div className="order-id">{shortOrderId}</div>
          <div className="student-name">{studentName}</div>
        </div>
      </div>

      <div className="card-top-row">
        <span className="status-badge" style={{ backgroundColor: colors.badge }}>
          {colors.label}
        </span>
        {etaTarget && ['QUEUED', 'PREPARING'].includes(status) && (
          <span className="eta-text">
            {Math.max(1, Math.round((new Date(etaTarget).getTime() - now) / 60000))} min ETA
          </span>
        )}
      </div>

      <div className="card-items">
        {(order.items || []).map((it, idx) => {
          const itemName = it.menuItem?.name || it.name || 'Item';
          const imageUrl = getImageUrl(it.menuItem?.imageUrl || it.imageUrl) || getFallbackThumb(itemName);
          const itemQty = Number(it.quantity || 0);
          const readyQty = (isOrderCompleted || isOrderReady)
            ? itemQty
            : Math.min(Number(it.assignedReadyQty || 0), itemQty);
          const isItemReady = itemQty > 0 && readyQty >= itemQty;
          const itemId = getOrderItemId(order, it, idx);
          const isPickupChecked = isOrderCompleted || pickupChecked.has(itemId);
          const isVisuallyChecked = isOrderReady ? isPickupChecked : isItemReady || isPickupChecked;
          const canMarkItemReady = status === 'PREPARING' && !isItemReady;
          const isToggleDisabled =
            (!canMarkItemReady && !isOrderReady && !isOrderCompleted) ||
            busyOrderIds?.has(order._id) ||
            busyItemIds?.has(`${order._id}:${itemId}`);

          return (
            <div key={itemId} className="item-row">
              <div className="item-thumb-wrap">
                <img className="item-thumb" src={imageUrl} alt={itemName} loading="lazy" decoding="async" />
              </div>
              <div className="item-main">
                <div className="item-title">
                  {itemQty}x {itemName}
                </div>
                <div className="item-ready-meta">
                  {readyQty}/{itemQty} ready
                </div>
                {order.specialInstructions && idx === 0 && (
                  <div className="item-note">{order.specialInstructions}</div>
                )}
              </div>
              <button
                type="button"
                className={`item-ready-toggle ${isVisuallyChecked ? 'checked' : ''}`}
                onClick={() => handleItemToggle(itemId, canMarkItemReady)}
                disabled={isToggleDisabled}
                aria-label={isOrderReady ? `Confirm ${itemName} picked up` : isOrderCompleted ? `${itemName} picked up` : `Mark ${itemName} ready`}
                title={isOrderReady ? 'Confirm this item was received' : isOrderCompleted ? 'Item received' : isItemReady ? 'Item ready' : 'Mark this item ready'}
              >
                {isVisuallyChecked ? '✓' : ''}
              </button>
            </div>
          );
        })}
      </div>

      {getButtonText() && (
        <>
          <hr className="card-divider" />
          <div className="card-footer">
            <button
              className="card-action-btn"
              style={{ backgroundColor: colors.border }}
              onClick={handleAction}
              disabled={busyOrderIds?.has(order._id)}
            >
              {busyOrderIds?.has(order._id) ? 'Updating...' : getButtonText()}
            </button>
          </div>
        </>
      )}
    </article>
  );
};

export default React.memo(OrderCard);
