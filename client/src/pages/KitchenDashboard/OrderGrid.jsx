import React from 'react';
import OrderCard from './OrderCard';

const emptyMessages = {
  ACTIVE: "No active orders. Enjoy the silence 🎉",
  PENDING: "No pending orders.",
  QUEUED: "No orders waiting. Kitchen is clear 🎉",
  PREPARING: "No active cooking. Tap a queued order to start.",
  READY: "No food awaiting pickup.",
  COMPLETED: "No completed orders today."
};

const OrderGrid = ({ orders, activeFilter, dishFilterLabel, dishFilterKey, onStatusUpdate, onItemReady, busyOrderIds, busyItemIds }) => {
  if (!orders || orders.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🍽️</div>
        <p className="empty-text">{dishFilterLabel ? `No ${activeFilter.toLowerCase()} orders found for ${dishFilterLabel}.` : emptyMessages[activeFilter] || "No orders found."}</p>
      </div>
    );
  }

  return (
    <div className="order-grid">
      {orders.map(order => (
        <OrderCard
          key={order._id}
          order={order}
          dishFilterKey={dishFilterKey}
          onStatusUpdate={onStatusUpdate}
          onItemReady={onItemReady}
          busyOrderIds={busyOrderIds}
          busyItemIds={busyItemIds}
        />
      ))}
    </div>
  );
};

export default OrderGrid;
