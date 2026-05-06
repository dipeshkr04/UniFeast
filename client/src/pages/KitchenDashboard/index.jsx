import React, { useState } from 'react';
import KitchenSidebar from './KitchenSidebar';
import KitchenStatusNav from './KitchenStatusNav';
import OrderGrid from './OrderGrid';
import KitchenSocketProvider from './KitchenSocketProvider';
import { useKitchenOrders } from './useKitchenOrders';
import './KitchenDashboard.css';

const KitchenDashboardContent = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const {
    filteredOrders,
    orders,
    activeFilter,
    setActiveFilter,
    dishFilter,
    setDishFilter,
    dishOptions,
    selectedDish,
    summary,
    isConnected,
    isOverloaded,
    reconnecting,
    updateOrderStatus,
    markItemReady
  } = useKitchenOrders();

  return (
    <div className="kitchen-page">
      <div 
        className={`kitchen-sidebar-backdrop ${sidebarOpen ? 'visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
      ></div>

      <KitchenSidebar
        summary={summary}
        orders={orders}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        queueStats={summary.queueStats}
        isOverloaded={isOverloaded}
        isConnected={isConnected}
      />
      
      <div className="kitchen-main">
        <KitchenStatusNav
          summary={summary}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
          isConnected={isConnected}
          onOpenSidebar={() => setSidebarOpen(true)}
        />
        
        {reconnecting && (
          <div className="kitchen-reconnect-banner">
            Reconnecting... live updates are paused
          </div>
        )}

        <div className="dish-filter-panel">
          <div className="dish-filter-copy">
            <span className="dish-filter-eyebrow">Dish filter</span>
            <strong>{selectedDish ? selectedDish.name : 'All dishes'}</strong>
            <small>
              {selectedDish
                ? `${selectedDish.orderCount} order${selectedDish.orderCount === 1 ? '' : 's'} / ${selectedDish.quantity} item${selectedDish.quantity === 1 ? '' : 's'} today`
                : 'Pick an item to show only matching live order cards'}
            </small>
          </div>

          <div className="dish-filter-controls">
            <select
              value={dishFilter}
              onChange={(event) => setDishFilter(event.target.value)}
              className="dish-filter-select"
              aria-label="Filter kitchen orders by dish"
            >
              <option value="ALL">All dishes</option>
              {dishOptions.map((dish) => (
                <option key={dish.key} value={dish.key}>
                  {dish.name} ({dish.orderCount} orders / {dish.quantity} qty)
                </option>
              ))}
            </select>
            {dishFilter !== 'ALL' && (
              <button className="dish-filter-clear" onClick={() => setDishFilter('ALL')}>
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="kitchen-orders-area">
          <OrderGrid
            orders={filteredOrders}
            activeFilter={activeFilter}
            dishFilterLabel={selectedDish?.name}
            dishFilterKey={dishFilter}
            onStatusUpdate={updateOrderStatus}
            onItemReady={markItemReady}
          />
        </div>
      </div>
    </div>
  );
};

const KitchenDashboard = () => {
  return (
    <KitchenSocketProvider>
      <KitchenDashboardContent />
    </KitchenSocketProvider>
  );
};

export default KitchenDashboard;
