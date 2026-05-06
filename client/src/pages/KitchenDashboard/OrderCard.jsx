import React from 'react';
import { STATUS_COLORS, URGENCY } from './kitchenColors';

const OrderCard = ({ order, dishFilterKey, onStatusUpdate, onItemReady }) => {
  const normalizedStatus = (order.status || 'pending').toLowerCase();
  const status = normalizedStatus.toUpperCase();
  const colors = STATUS_COLORS[status] || STATUS_COLORS.PENDING;

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
  const normalizeDishName = (value) => String(value || '').trim().toLowerCase();

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
          <span className="eta-text">⏱ {Math.max(1, Math.round((new Date(etaTarget).getTime() - Date.now()) / 60000))} min ETA</span>
        )}
      </div>

      <div className="card-items">
        {(order.items || []).map((it, idx) => {
          const itemName = it.menuItem?.name || it.name || 'Item';
          const itemQty = Number(it.quantity || 0);
          const readyQty = Math.min(Number(it.assignedReadyQty || 0), itemQty);
          const isItemReady = itemQty > 0 && readyQty >= itemQty;
          const canMarkItemReady = !isItemReady && !['COMPLETED', 'CANCELLED'].includes(status);

          return (
          <div key={idx} className="item-row">
            <div className="item-thumb-wrap">
              {it.menuItem?.imageUrl ? (
                <img className="item-thumb" src={it.menuItem.imageUrl} alt={itemName} />
              ) : (
                <div className="item-thumb item-thumb-fallback">🍽</div>
              )}
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
              className={`item-ready-toggle ${isItemReady ? 'checked' : ''}`}
              onClick={() => canMarkItemReady && onItemReady?.(order._id, it._id)}
              disabled={!canMarkItemReady}
              aria-label={isItemReady ? `${itemName} is ready` : `Mark ${itemName} ready`}
              title={isItemReady ? 'Item ready' : 'Mark this item ready'}
            >
              {isItemReady ? '✓' : ''}
            </button>
          </div>
          );
        })}
      </div>

      <hr className="card-divider" />

      <div className="card-footer">
        <span className="time-text">{order.queuePosition ? `Queue #${order.queuePosition}` : 'In service'}</span>

        {getButtonText() && (
          <button className="card-action-btn" style={{ backgroundColor: colors.border }} onClick={handleAction}>
            → {getButtonText()}
          </button>
        )}
      </div>
    </article>
  );
};

export default OrderCard;
