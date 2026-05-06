import React, { useMemo } from 'react';
import { STATUS_COLORS } from './kitchenColors';

const KitchenSidebar = ({ summary, orders, isOpen, onClose, queueStats, isOverloaded, isConnected }) => {
  
  // Aggregate food items across ACTIVE orders
  const itemAggregates = useMemo(() => {
    const list = {};
    orders.forEach(order => {
      if (['completed', 'cancelled'].includes((order.status || '').toLowerCase())) return;
      (order.items || []).forEach(item => {
        const name = item.menuItem?.name || 'Unknown Item';
        list[name] = (list[name] || 0) + item.quantity;
      });
    });
    return list;
  }, [orders]);

  return (
    <>
      <div className={`kitchen-sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="sidebar-close-btn desktop-hide" onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>✕</button>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Kitchen Overview</h2>
          </div>
          <span className="live-indicator desktop-only" style={{ display: 'flex', alignItems: 'center', fontSize: '12px', fontWeight: 'bold' }}>
            {isConnected ? <span className="dot green pulse"></span> : <span className="dot red"></span>}
            {isConnected ? 'Live' : '...'}
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
            {Object.entries(itemAggregates).sort((a,b) => b[1] - a[1]).map(([name, qty]) => (
              <li key={name}>
                <span className="item-name">{name}</span>
                <span className="item-qty">x{qty}</span>
              </li>
            ))}
          </ul>
        </div>

        <hr className="sidebar-divider" />

        <div className="sidebar-section">
          <h3 className="section-title">Queue Health</h3>
          {isOverloaded && (
            <div className="overload-banner">⚠ Kitchen Overloaded!</div>
          )}
          <ul className="stats-list">
            <li>Util (ρ): <span style={{ color: queueStats?.rho >= 0.8 ? 'red' : 'inherit' }}>{((queueStats?.rho || 0) * 100).toFixed(1)}%</span></li>
            <li>Arrival (λ): <span>{(queueStats?.lambda || 0).toFixed(2)}/min</span></li>
            <li>Prep Time: <span>5 min</span></li>
          </ul>
        </div>
      </div>
    </>
  );
};

export default KitchenSidebar;
