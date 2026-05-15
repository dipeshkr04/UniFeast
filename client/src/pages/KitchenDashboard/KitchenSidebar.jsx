import React, { useMemo } from 'react';
import { HiX } from 'react-icons/hi';
import { STATUS_COLORS } from './kitchenColors';

const KitchenSidebar = ({ summary, orders, isOpen, onClose, queueStats, isConnected }) => {
  const itemAggregates = useMemo(() => {
    const list = {};
    orders.forEach((order) => {
      if (['completed', 'cancelled'].includes((order.status || '').toLowerCase())) return;
      (order.items || []).forEach((item) => {
        const name = item.menuItem?.name || 'Unknown Item';
        list[name] = (list[name] || 0) + item.quantity;
      });
    });
    return list;
  }, [orders]);

  return (
    <>
      <div className={`kitchen-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title-row">
            <button className="sidebar-close-btn desktop-hide" onClick={onClose} aria-label="Close kitchen overview">
              <HiX />
            </button>
            <h2>Kitchen Overview</h2>
          </div>
          <span className="live-indicator desktop-only">
            <span className={`dot green ${isConnected ? 'pulse' : ''}`}></span>
            Live
          </span>
        </div>

        <div className="sidebar-section">
          <h3 className="section-title">Order Queue</h3>
          <ul className="queue-list">
            <li>
              <span className="dot" style={{ backgroundColor: STATUS_COLORS.PENDING.badge }}></span> Pending
              <span className="count">{summary.PENDING}</span>
            </li>
            <li>
              <span className="dot" style={{ backgroundColor: STATUS_COLORS.QUEUED.badge }}></span> Queued
              <span className="count">{summary.QUEUED}</span>
            </li>
            <li>
              <span className="dot" style={{ backgroundColor: STATUS_COLORS.PREPARING.badge }}></span> Preparing
              <span className="count">{summary.PREPARING}</span>
            </li>
            <li>
              <span className="dot" style={{ backgroundColor: STATUS_COLORS.READY.badge }}></span> Ready
              <span className="count">{summary.READY}</span>
            </li>
            <li>
              <span className="dot" style={{ backgroundColor: STATUS_COLORS.COMPLETED.badge }}></span> Done (Today)
              <span className="count">{summary.COMPLETED}</span>
            </li>
          </ul>
        </div>

        <hr className="sidebar-divider" />

        <div className="sidebar-section">
          <h3 className="section-title">Active Items to Cook</h3>
          <ul className="items-list">
            {Object.keys(itemAggregates).length === 0 && <li className="muted">No items active</li>}
            {Object.entries(itemAggregates).sort((a, b) => b[1] - a[1]).map(([name, qty]) => (
              <li key={name}>
                <span className="item-name">{name}</span>
                <span className="item-qty">x{qty}</span>
              </li>
            ))}
          </ul>
        </div>

        <hr className="sidebar-divider" />

        <div className="sidebar-section">
          <h3 className="section-title">Bucket Workload</h3>
          <ul className="stats-list">
            <li>Arrival Rate: <span>{(queueStats?.arrivalRate || 0).toFixed(2)}/min</span></li>
            <li>Active Work: <span>{Math.round(queueStats?.activeBucketWorkMinutes || 0)} min</span></li>
            <li>Avg Bucket Work: <span>{Math.max(1, Math.round(queueStats?.averageBucketWorkMinutes || 0))} min</span></li>
            <li>ETA Method: <span>Bucket arithmetic</span></li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default KitchenSidebar;
