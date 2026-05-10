import React, { useEffect, useState } from 'react';
import { STATUS_COLORS, URGENCY } from './kitchenColors';

const getOrderItemId = (order, item, index) => String(item._id || item.menuItem?._id || `${order._id}-${index}`);

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

const OrderCard = ({ order, dishFilterKey, onStatusUpdate, onItemReady, busyOrderIds, busyItemIds }) => {
  const normalizedStatus = (order.status || 'pending').toLowerCase();
  const status = normalizedStatus.toUpperCase();
  const colors = STATUS_COLORS[status] || STATUS_COLORS.PENDING;
  const isOrderCompleted = status === 'COMPLETED';
  const isOrderReady = status === 'READY';
  const [pickupChecked, setPickupChecked] = useState(() => new Set());

  useEffect(() => {
    setPickupChecked(new Set());
  }, [order._id, status]);

  let extraClasses = '';
  let shadow = URGENCY.NORMAL.shadow;

  const etaTarget = order.estimatedReadyAt
    ? new Date(order.estimatedReadyAt)
    : typeof order.eta === 'number'
      ? new Date(Date.now() + order.eta * 60000)
      : order.eta
        ? new Date(order.eta)
        : null;
  if (['QUEUED', 'PREPARING'].includes(status) && etaTarget && order.startedAt) {
    const elapsedRatio =
      (Date.now() - new Date(order.startedAt).getTime()) /
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

  const isFullyReadyOrder = (nextOrder) => (
    (nextOrder?.items || []).length > 0 &&
    (nextOrder.items || []).every((item) => {
      const quantity = Number(item.quantity || 0);
      const ready = Number(item.assignedReadyQty || 0);
      return quantity > 0 && ready >= quantity;
    })
  );

  const wouldCompleteAfterItemReady = (targetItemId) => (
    ['QUEUED', 'PREPARING'].includes(status) &&
    (order.items || []).length > 0 &&
    (order.items || []).every((item, index) => {
      const quantity = Number(item.quantity || 0);
      const ready = Number(item.assignedReadyQty || 0);
      const itemId = getOrderItemId(order, item, index);
      return quantity > 0 && (itemId === targetItemId || ready >= quantity);
    })
  );

  const handleItemToggle = async (itemId, canMarkItemReady) => {
    if (busyOrderIds?.has(order._id) || busyItemIds?.has(`${order._id}:${itemId}`)) return;

    if (isOrderReady) {
      const next = new Set(pickupChecked);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      setPickupChecked(next);
      if ((order.items || []).length > 0 && next.size >= (order.items || []).length) {
        onStatusUpdate?.(order._id, 'COMPLETED');
      }
      return;
    }

    if (canMarkItemReady) {
      if (wouldCompleteAfterItemReady(itemId)) {
        await onStatusUpdate?.(order._id, 'COMPLETED');
        return;
      }
      const updatedOrder = await onItemReady?.(order._id, itemId);
      if (updatedOrder && isFullyReadyOrder(updatedOrder)) {
        await onStatusUpdate?.(order._id, 'COMPLETED');
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
    order.user?.phone ||
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
            {Math.max(1, Math.round((new Date(etaTarget).getTime() - Date.now()) / 60000))} min ETA
          </span>
        )}
      </div>

      <div className="card-items">
        {(order.items || []).map((it, idx) => {
          const itemName = it.menuItem?.name || it.name || 'Item';
          const imageUrl = it.menuItem?.imageUrl || it.imageUrl || getFallbackThumb(itemName);
          const itemQty = Number(it.quantity || 0);
          const readyQty = (isOrderCompleted || isOrderReady)
            ? itemQty
            : Math.min(Number(it.assignedReadyQty || 0), itemQty);
          const isItemReady = itemQty > 0 && readyQty >= itemQty;
          const itemId = getOrderItemId(order, it, idx);
          const isPickupChecked = isOrderCompleted || pickupChecked.has(itemId);
          const isVisuallyChecked = isOrderReady ? isPickupChecked : isItemReady || isPickupChecked;
          const canMarkItemReady = !isItemReady && !['READY', 'COMPLETED', 'CANCELLED'].includes(status);
          const isToggleDisabled =
            (!canMarkItemReady && !isOrderReady && !isOrderCompleted) ||
            busyOrderIds?.has(order._id) ||
            busyItemIds?.has(`${order._id}:${itemId}`);

          return (
            <div key={itemId} className="item-row">
              <div className="item-thumb-wrap">
                <img className="item-thumb" src={imageUrl} alt={itemName} loading="lazy" />
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

export default OrderCard;
