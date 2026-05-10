import React from 'react';
import { HiOutlineMenuAlt2 } from 'react-icons/hi';
import { STATUS_COLORS } from './kitchenColors';

const TABS = ['ACTIVE', 'PENDING', 'QUEUED', 'PREPARING', 'READY', 'COMPLETED'];

const KitchenStatusNav = ({ summary, activeFilter, onFilterChange, canteenLive, onOpenSidebar }) => {
  return (
    <div className="kitchen-status-nav">
      <div className="nav-header-info">
        <button 
          className="kitchen-sidebar-toggle desktop-hide" 
          onClick={onOpenSidebar}
          aria-label="Open kitchen overview"
        >
          <HiOutlineMenuAlt2 className="kitchen-sidebar-toggle-icon" />
        </button>
        <span className={`kitchen-canteen-status ${canteenLive ? 'is-open' : 'is-closed'}`}>
          <span className="dot"></span>
          {canteenLive ? 'Live' : 'Closed'}
        </span>
      </div>
      <div className="nav-tabs">
        {TABS.map(tab => {
          let count = 0;
          let badgeColor = '#9E9E9E';

          if (tab === 'ACTIVE') {
            count = summary.totalActive || 0;
            badgeColor = '#D84315'; // Generic active color
          } else {
            count = summary[tab] || 0;
            badgeColor = STATUS_COLORS[tab]?.badge || '#9E9E9E';
          }

          return (
            <button
              key={tab}
              className={`nav-tab ${activeFilter === tab ? 'active' : ''}`}
              onClick={() => onFilterChange(tab)}
              style={activeFilter === tab ? { borderBottomColor: badgeColor, color: badgeColor } : {}}
            >
              {tab === 'ACTIVE' ? 'ACTIVE ★' : STATUS_COLORS[tab]?.label || tab}
              <span 
                className="nav-count-bubble" 
                style={{ backgroundColor: badgeColor }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default KitchenStatusNav;
