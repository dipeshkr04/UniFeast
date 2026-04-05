# UniFeast Implementation Roadmap - Detailed Tasks

## 🚀 DEVELOPER 1: Backend - Order & Pool Flow

### Sprint 1: Order Creation & Pool Integration (Days 1-5)

#### Task 1.1: Complete Order Creation with Pool Checking
**File**: `server/controllers/orderController.js` → `createOrder`  
**Current State**: ~50% complete (calculates ETA, creates order)  
**Missing**:
```javascript
// Need to add:
1. Validate items are poolable
2. For each item, check for existing open pools
3. Return pool suggestion with discount info
4. Return order with pool recommendations
5. Auto-join option for same items in same pool
```

**Acceptance Criteria**:
- [x] Order created with correct total amount
- [x] JSON response includes `suggestedPools: [{poolId, itemName, savings%, members}]`
- [ ] Client receives order with pool recommendation
- [ ] Can specify `joinPoolId` during order creation to auto-join

**Test Cases**:
```bash
POST /api/orders
Body: { items: [{menuItem: "...", quantity: 1}] }
Expected: { order: {...}, suggestedPools: [{...}] }
```

---

#### Task 1.2: Implement Pool Join Validation & Lock Manager
**File**: `server/config/lockManager.js`, `server/controllers/poolController.js`  
**Current State**: Basic structure exists  
**Missing**:
```javascript
// Redis-based distributed lock implementation
1. acquireLock(key, ttl) - with exponential backoff
2. releaseLock(key)
3. Lock expiration handling
4. Handle lock timeout gracefully
```

**Dependencies**: Redis running locally or on dev server

**Acceptance Criteria**:
- [ ] 100+ concurrent requests can join same pool safely
- [ ] No duplicate members in pool
- [ ] Lock acquired/released under 50ms
- [ ] Graceful failure when lock unavailable

---

#### Task 1.3: Pool Status Transitions & Consolidation
**File**: `server/utils/poolEngine.js` → `closePool`, `consolidatePool`  
**Current State**: 40% complete (joinPool works, closePool partially)  
**Implement**:
```javascript
// closePool(poolId) - called when:
1. Timer expires (5 min from creation)
2. maxSize reached (10 members)

// Steps:
1. Set pool.status = 'queued'
2. Create consolidated order (merger of all members' items)
3. Set pool.consolidatedOrder reference
4. Update all member orders: order.isPooled = true, order.poolId = poolId
5. Calculate individual amounts for each member
6. Broadcast via Socket.io: pool-closed event

// consolidatePool(poolId, orders)
1. Fetch all orders from pool members
2. Create new Order with all items combined
3. Add special pricing (per-member split)
4. Save consolidated order to DB
5. Return consolidated order details
```

**Acceptance Criteria**:
- [ ] Pool closes automatically at 5-min mark
- [ ] Consolidated order created with all member items
- [ ] Each member's original order linked to pool
- [ ] No data loss or duplicate charges
- [ ] Socket event triggers for all members

---

#### Task 1.4: Backend Request Validation Middleware
**File**: Create `server/middleware/validate.js`  
**Implement**:
```javascript
// validate() - generic validator
// validateOrder() - check items, quantities, user
// validatePool() - check pool exists, user not already member
// validateMenu() - check categories, prices, etc.

// Use: 
app.post('/api/orders', validate('createOrder'), orderController.createOrder);
```

**Acceptance Criteria**:
- [ ] All routes have input validation
- [ ] 400 errors with clear messages for invalid input
- [ ] XSS prevention (sanitize strings)
- [ ] Type checking for numbers/email/etc

---

#### Task 1.5: Error Handling & Edge Cases
**Files**: All controllers  
**Implement**:
```javascript
- Item becomes unavailable after added to cart
- User insufficient funds (placeholder)
- Pool closes while joining
- Network timeout during order creation
- Duplicate order prevention
```

**Test Scenarios**:
```bash
1. Order non-existent item → 404
2. Order unavailable item → 400
3. Join full pool → 400
4. Join after pool closed → 400
5. Pool expires mid-transaction → retry with new pool
```

---

### Sprint 2: Real-Time ETA & Queue Management (Days 6-10)

#### Task 2.1: Real-Time ETA Recalculation
**File**: `server/utils/queueEngine.js` → `recalculateAllETAs`  
**Current State**: Calculation function exists, but not triggered on updates  
**Implement**:
```javascript
// recalculateAllETAs(excludeOrderId)
// Called when: order status changes (pending → preparing, etc.)
// Logic:
1. Fetch all pending + queued orders
2. Recalculate ETA for each based on current queue position
3. Update Order.estimatedReadyAt for changes > 1min
4. Return array of updates: [{orderId, newETA, oldETA}]

// Optimization:
- Batch update in MongoDB if possible
- Only update if delta > threshold (1-2 min)
- Cache calculation results for 30 seconds
```

**Integration Points**:
```javascript
// In orderController.updateOrderStatus()
const updates = await recalculateAllETAs(order._id);

// Emit to Socket.io
socketHandlers.notifyAllETAUpdates(updates);
```

**Acceptance Criteria**:
- [ ] ETA updates on every order status change
- [ ] 50+ orders recalculated in < 500ms
- [ ] WebSocket broadcasts to correct users only
- [ ] No calculator errors for edge cases

---

#### Task 2.2: Order Status Update Routes
**File**: `server/routes/orders.js`, `server/controllers/orderController.js`  
**Implement**:
```javascript
// PATCH /api/orders/:id/status
// body: { status: 'preparing' | 'ready' | 'completed' }

// Kitchen staff can: pending → preparing, preparing → ready, ready → completed
// Students can: cancel pending/queued orders only

// On each status change:
1. Log to statusHistory
2. Recalculate ETAs and broadcast
3. If completed: auto-log nutrition
4. Emit Socket event to user + kitchen
```

**Acceptance Criteria**:
- [ ] Status transitions follow state machine
- [ ] Only authorized roles can change status
- [ ] statusHistory updated with timestamp
- [ ] Real-time notifications sent

---

#### Task 2.3: Socket.io ETA Broadcast
**File**: `server/utils/socketHandler.js`  
**Current State**: Skeleton exists  
**Implement**:
```javascript
// notifyAllETAUpdates(updates) - already referenced but needs full implementation
// For each update: emit to user's private room

// New Socket events:
1. 'eta-update' - when order ETA changes
2. 'order-preparing' - when order status → preparing
3. 'order-ready' - when order status → ready
4. 'order-completed' - when order completed (trigger nutrition log)

// Listening on kitchen side:
socket.on('new-order', handleNewOrder)
socket.on('queue-stats', updateQueueDisplay)
```

**Acceptance Criteria**:
- [ ] ETA updates within 100ms of database change
- [ ] All active clients receive updates
- [ ] No duplicate notifications
- [ ] Connection drop recovery

---

#### Task 2.4: Queue Management Endpoints
**File**: `server/routes/orders.js`, new `server/routes/admin.js`  
**Implement**:
```javascript
// GET /api/admin/queue/stats
// Response: {
//   totalPending: 23,
//   totalPreparing: 8,
//   avgWaitTime: 15,
//   peakTraffic: true,
//   utilizationRatio: 0.78
// }

// GET /api/admin/queue/history/today
// Response: [{time: "14:30", pendingCount: 15, poolCount: 5}, ...]
```

**Acceptance Criteria**:
- [ ] Stats update in real-time
- [ ] Accurate calculations
- [ ] History data for trend analysis

---

### Sprint 3: Nutrition Auto-Logging & Polish (Days 11-15)

#### Task 3.1: Nutrition Auto-Logging on Order Completion
**File**: `server/controllers/orderController.js` → after status = 'completed'  
**Implement**:
```javascript
// Trigger when order.status = 'completed'

async function autoLogNutrition(orderId, userId) {
  const order = await Order.findById(orderId).populate('items.menuItem');
  const today = new Date().toISOString().split('T')[0];
  
  let nutritionLog = await NutritionLog.findOne({
    user: userId,
    date: today
  });
  
  if (!nutritionLog) {
    nutritionLog = await NutritionLog.create({
      user: userId,
      date: today,
      meals: [],
      dailyTotals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    });
  }
  
  // For each item in order, create meal entry
  order.items.forEach(item => {
    const nutrition = item.menuItem.nutrition;
    nutritionLog.meals.push({
      menuItem: item.menuItem._id,
      customName: item.name,
      calories: nutrition.calories * item.quantity,
      protein: nutrition.protein * item.quantity,
      carbs: nutrition.carbs * item.quantity,
      fat: nutrition.fat * item.quantity,
      fiber: nutrition.fiber * item.quantity,
      quantity: item.quantity,
      mealType: 'lunch', // or detect from time of day
      isAutoLogged: true,
      loggedAt: new Date()
    });
    
    // Add to daily totals
    nutritionLog.dailyTotals.calories += nutrition.calories * item.quantity;
    // ... etc for other macros
  });
  
  await nutritionLog.save();
  return nutritionLog;
}
```

**Acceptance Criteria**:
- [ ] Nutrition logged automatically on order completion
- [ ] Quantities multiplied correctly
- [ ] Daily totals calculated accurately
- [ ] "Auto-logged" flag set correctly
- [ ] User can override/edit logged meals

---

#### Task 3.2: Database Indexes & Performance Optimization
**File**: All model files  
**Implement**:
```javascript
// In Order.js
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ estimatedReadyAt: 1 });

// In Pool.js
poolSchema.index({ menuItem: 1, status: 1 });
poolSchema.index({ closesAt: 1 });
poolSchema.index({ createdAt: -1 });

// In NutritionLog.js
nutritionLogSchema.index({ user: 1, date: -1 });
```

**Acceptance Criteria**:
- [ ] Query times < 100ms for typical queries
- [ ] No N+1 query problems
- [ ] Proper population of refs

---

#### Task 3.3: Comprehensive Error Handling
**File**: `server/middleware/errorHandler.js`  
**Implement**:
```javascript
// Global error handler middleware
// Catch all unhandled errors
// Format error responses consistently
// Log errors for monitoring
// Return appropriate HTTP status codes
```

---

## 👨‍💻 DEVELOPER 2: Frontend - UI & Real-Time Components

### Sprint 1: Cart & Order Pages (Days 1-5)

#### Task 1.1: CartPage Component
**File**: `client/src/pages/CartPage.jsx`  
**Current State**: Doesn't exist  
**Build**:
```jsx
// Components in CartPage:
1. Cart Item List
   - Item name, price, prep time
   - Quantity +/- buttons
   - Remove button
   - Pool info badge (if joined)

2. Cost Summary
   - Subtotal
   - Pool savings (if any)
   - Final total
   - Savings badge with percentage

3. Pool Recommendation
   - For each item: "Join pool with 3 others? Save 6%"
   - Show pool members count, time remaining
   - Join button

4. Checkout Section
   - Special instructions text area (max 300 char)
   - "Place Order" button
   - Loading state during submission

5. Status After Order
   - Order confirmation
   - Receipt with itemization
   - ETA display
   - "Track Order" button
```

**Acceptance Criteria**:
- [ ] Add/remove items from cart
- [ ] Real-time total calculation
- [ ] Pool joining option displays with correct savings
- [ ] Can add special instructions
- [ ] Order placement successful
- [ ] Responsive on mobile

**Test Scenarios**:
```
1. Add item → see in cart → remove → cart empty
2. Join pool for item → see discount applied
3. Add special instructions → appears in order
4. Cart doesn't empty after checkout (for returning)
5. Quantity adjustment updates totals
```

---

#### Task 1.2: OrdersPage Component
**File**: `client/src/pages/OrdersPage.jsx`  
**Current State**: Skeleton only  
**Build**:
```jsx
// OrdersPage Layout:
1. Tab-based view: "Active" | "Completed" | "All"

2. Active Orders Tab
   - For each order:
     - Items list
     - Status badge
     - ETA countdown timer (CRITICAL - see 1.3)
     - "Track Order" link
     - "Cancel" button (if pending/queued)

3. Completed Orders Tab
   - Order summary
   - Completion time
   - Nutrition auto-logged badge
   - "Reorder" button

4. Order Detail View (modal/expandable)
   - Full item list with quantities
   - Nutrition breakdown (if food items)
   - Price breakdown
   - Pool info (if pooled)
   - Individual payment if pooled

5. Filters & Search
   - By status
   - By date range
   - By item name
```

**Acceptance Criteria**:
- [ ] List all user's orders
- [ ] Active orders show ETA countdown
- [ ] Can expand for details
- [ ] Cancel button works for eligible orders
- [ ] Reorder functionality
- [ ] Mobile responsive

---

#### Task 1.3: ETA Countdown Ticker Component (CRITICAL)
**File**: `client/src/components/ETATimer.jsx`  
**Critical for**: Real-time UX feel  
**Build**:
```jsx
// ETATimer Component
export function ETATimer({ order, onETAUpdate }) {
  // Display: "Est. Ready in 12 min"
  // Update every 1 second via:
  // 1. Local countdown timer
  // 2. Socket.io 'eta-update' events
  
  // Color: green if < 5min, amber if < 15min, orange if > 15min
  
  // Show:
  - Timer value
  - Progress bar from order time to ETA
  - Status badge (Preparing, Almost Ready, etc)
  - Estimated ready timestamp
}

// Hook in OrdersPage:
useEffect(() => {
  socket?.on('eta-update', (update) => {
    setOrders(prev => prev.map(o =>
      o._id === update.orderId 
        ? { ...o, estimatedTime: update.newETA, ... }
        : o
    ));
  });
}, [socket]);
```

**Socket Events Expected**:
```javascript
// From server:
socket.emit('eta-update', {
  orderId: "...",
  newETA: 12, // minutes
  oldETA: 15,
  reason: 'status-change' | 'queue-movement' | 'calculation-update'
})
```

**Acceptance Criteria**:
- [ ] Timer counts down every second
- [ ] Updates when socket event received
- [ ] Never goes negative
- [ ] Color changes based on time
- [ ] Syncs with server time on each update

---

#### Task 1.4: Socket.io Event Listeners Setup
**File**: `client/src/contexts/SocketContext.jsx` + components  
**Implement**:
```javascript
// In SocketContext:
useEffect(() => {
  if (!socket) return;

  // Your specific events:
  socket.on('eta-update', handleETAUpdate);
  socket.on('order-preparing', handleOrderPreparing);
  socket.on('order-ready', handleOrderReady);
  socket.on('order-update', handleOrderUpdate);
  socket.on('pool-closed', handlePoolClosed);

  return () => {
    socket.off('eta-update', handleETAUpdate);
    // ... unsubscribe all
  };
}, [socket]);

// Connect on page load:
useEffect(() => {
  const newSocket = io(import.meta.env.VITE_API_URL, {
    auth: { token: localStorage.getItem('unifeast_token') }
  });
  setSocket(newSocket);
  
  return () => newSocket.disconnect();
}, []);
```

**Acceptance Criteria**:
- [ ] Socket connects on app init
- [ ] Events received and processed
- [ ] UI updates immediately on events
- [ ] No memory leaks on unmount
- [ ] Reconnects on disconnect

---

### Sprint 2: Pool Management & Real-Time Features (Days 6-10)

#### Task 2.1: PoolsPage Component
**File**: `client/src/pages/PoolsPage.jsx`  
**Current State**: Doesn't exist  
**Build**:
```jsx
// PoolsPage Layout:
1. Available Pools Section
   - Each pool card shows:
     - Item image & name
     - Members count / Max size
     - Savings percentage
     - Time until close (countdown)
     - Price per unit
     - Member list (expandable)
     - "Join Pool" button

2. My Pools Section
   - Pools user has joined
   - Show confirmation status
   - "Leave Pool" button (before consolidation)
   - Pool details

3. Real-time Updates
   - Member count updates live
   - New pools appear automatically
   - Pools disappear when closed
   - Time countdowns sync with server

4. Filters
   - By category
   - By price
   - By members count
   - Sort by discount / time remaining
```

**Component Breakdown**:
```jsx
<PoolCard
  pool={{ _id, menuItem, members, status, closesAt, savingsPercent }}
  onJoin={handleJoinPool}
  userInPool={boolean}
/>

<PoolMemberList members={...} />

<TimeRemaining closeTime={date} />
```

**Acceptance Criteria**:
- [ ] List all open pools
- [ ] Join pool with confirmation
- [ ] Real-time member count updates
- [ ] Time countdown accurate
- [ ] Can view member list
- [ ] Can leave pool before consolidation
- [ ] Mobile responsive

---

#### Task 2.2: Pool Card & Member Components
**File**: `client/src/components/PoolCard.jsx`, `PoolMemberList.jsx`  
**Build**:
```jsx
// PoolCard: Displays single pool with savings badge

// PoolMemberList: Shows members joined, with avatar/name

// TimeRemaining: Countdown timer for pool close time

// JoinPoolModal: Confirmation before joining
```

**Acceptance Criteria**:
- [ ] Design consistent with app theme
- [ ] Shows all key info at a glance
- [ ] Join action clear and accessible
- [ ] Member count updates in real-time

---

#### Task 2.3: Real-Time Pool Updates via Socket
**File**: `client/src/pages/PoolsPage.jsx` + SocketContext  
**Implement**:
```javascript
// Listen for:
socket.on('pool-update', (data) => {
  // data: { poolId, action, ...details }
  // action: 'member-joined', 'member-left', 'pool-closed'
  
  setPools(prev => {
    if (data.action === 'member-joined') {
      return prev.map(p => p._id === data.poolId
        ? { ...p, currentSize: data.currentSize, members: data.members }
        : p
      );
    }
    if (data.action === 'pool-closed') {
      return prev.filter(p => p._id !== data.poolId); // Remove from available
    }
    return prev;
  });
});

// On pool close, refresh orders to show new consolidated order
socket.on('pool-closed', () => {
  // Refetch user's orders
  // Show notification "Your pool order is ready!"
});
```

**Acceptance Criteria**:
- [ ] New members visible immediately
- [ ] Pool disappears when full or time expires
- [ ] Member-left removes from list
- [ ] No race conditions or duplicates

---

#### Task 2.4: MenuManagePage Component (for Kitchen/Admin)
**File**: `client/src/pages/MenuManagePage.jsx`  
**Current State**: Skeleton only  
**Build**:
```jsx
// MenuManagePage Layout:
1. Menu Items Table
   - Item name, category, price, prep time
   - Availability toggle
   - Edit button
   - Delete button

2. Add Item Form (modal/collapsible)
   - Name, Category, Price, Prep Time
   - Nutrition info inputs (cal, protein, carbs, fat, fiber)
   - Image upload placeholder
   - Tags input
   - Poolable toggle
   - Submit button

3. Edit Item Form (modal)
   - Prefill existing data
   - Allow image upload
   - Save changes

4. Bulk Actions
   - Select multiple items
   - Toggle availability for all
```

**Acceptance Criteria**:
- [ ] Add new menu item
- [ ] Edit existing item
- [ ] Delete item
- [ ] Toggle availability
- [ ] All changes reflect immediately
- [ ] Form validation
- [ ] Image upload ready (Cloudinary placeholder)

---

### Sprint 3: Nutrition & Admin Components (Days 11-15)

#### Task 3.1: Nutrition Auto-Log Display
**File**: `client/src/pages/NutritionPage.jsx` - enhance existing  
**Modify**:
```jsx
// Show badge on meal entries: "Auto-logged from order #123"
// Add override/edit functionality:
  - Edit quantity
  - Edit macros
  - Clear entry
  - Confirm logging

// New "Auto-Log Details" section:
  - Show which completed orders were logged today
  - Show nutrition breakdown by source (auto vs manual)

// Add option to:
  - Disable auto-logging
  - Review before auto-logging (if user preference)
```

**Acceptance Criteria**:
- [ ] Auto-logged meals show source
- [ ] Can edit auto-logged meals
- [ ] Can undo auto-logging
- [ ] User preference for auto-log toggle

---

#### Task 3.2: Photo Upload for Manual Meals
**File**: `client/src/components/PhotoUploadForm.jsx`  
**Build**:
```jsx
// When adding manual meal:
1. Photo input (camera or file upload)
2. Preview uploaded photo
3. On submit:
   - Upload to Cloudinary via multer endpoint
   - Display in nutrition history
   - Option to use photo-based nutrition estimation (future)
```

**Acceptance Criteria**:
- [ ] Can select photo from device
- [ ] Preview before upload
- [ ] Photo stored in nutritionLog
- [ ] Photo displays in nutrition history

---

#### Task 3.3: AdminDashboard - User & Settings
**File**: `client/src/pages/AdminDashboard.jsx` - new tab  
**Build (Basic MVP)**:
```jsx
// Tab 1: Canteen Settings
- Active kitchen stations (input)
- Pool window duration (select: 3, 5, 10 min)
- Save settings

// Tab 2: User Management (basic)
- List all users with roles
- Search/filter
- Role assignment dropdown (if future feature)

// Tab 3: Analytics (basic)
- Total orders today
- Peak hour (simple chart)
- Most ordered item
- Revenue (if implemented)
```

**Acceptance Criteria**:
- [ ] Settings save correctly
- [ ] User list displays
- [ ] Analytics show real data

---

#### Task 3.4: Loading States & Error Boundaries
**Files**: Throughout all pages  
**Implement**:
```jsx
// LoadingSpinner component
// ErrorBoundary wrapper
// Skeleton loaders for lists
// Toast notifications for errors
// Retry buttons on failed requests
```

**Acceptance Criteria**:
- [ ] All async operations show loading state
- [ ] Errors display user-friendly messages
- [ ] Can retry failed requests
- [ ] No white screen of death

---

## 🔗 INTEGRATION CHECKLIST

### Dev 1 → Dev 2 Integration Points
- [ ] Order creation returns `suggestedPools` field → CartPage displays
- [ ] Order structure includes `estimatedTime`, `estimatedReadyAt` → ETATimer uses
- [ ] Order.status changes emit Socket events → OrdersPage receives
- [ ] Pool consolidation creates merged order → OrdersPage shows
- [ ] Nutrition auto-log stores data → NutritionPage displays
- [ ] Queue stats endpoint returns data → AdminDashboard displays

### API Endpoints Dev 2 Will Call
```javascript
// Orders
GET /api/orders (list user's orders)
GET /api/orders/:id (get order detail)
POST /api/orders (create order)
PATCH /api/orders/:id/status (for complete receipt)
DELETE /api/orders/:id (cancel order)

// Pools
GET /api/pools?status=open (list available pools)
GET /api/pools/user (list user's joined pools)
POST /api/pools/:id/join (join pool)
DELETE /api/pools/:id/leave (leave pool)

// Menu
GET /api/menu (list items, paginated)
GET /api/menu/:id (item detail)
POST /api/menu (add item - kitchen/admin only)
PATCH /api/menu/:id (edit item)
DELETE /api/menu/:id (delete item)

// Nutrition
GET /api/nutrition/daily?date=YYYY-MM-DD (daily log)
GET /api/nutrition/weekly (weekly summary)
POST /api/nutrition/log (manual logging)

// Admin
GET /api/admin/queue/stats
PATCH /api/admin/settings
GET /api/admin/users
```

---

## ✅ VALIDATION & TESTING PLAN

### Dev 1 Testing Checklist
- [ ] Postman collection with all order/pool endpoints
- [ ] Test concurrent pool joins (10+ simultaneous)
- [ ] Test pool auto-close scenarios
- [ ] Test ETA calculation edge cases
- [ ] Test nutri auto-log with various order sizes

### Dev 2 Testing Checklist
- [ ] Component renders without errors
- [ ] All buttons clickable and functional
- [ ] Socket events handled correctly
- [ ] Forms validate inputs
- [ ] Responsive on mobile (375px, 768px, 1920px)

### Integration Testing
- [ ] Complete flow: Login → Browse Menu → Add to Cart → Join Pool → Checkout → Track ETA → Order Ready → Nutrition Logged
- [ ] Kitchen workflow: See incoming orders → Mark preparing → Mark ready → Confirm complete
- [ ] Pool flow: Multiple students join pool → Pool auto-closes → Consolidated order created → All members notified

---

## 📞 DAILY COMMUNICATION TEMPLATE

**Dev 1 & Dev 2 Standup (15 min)**
```
Dev 1:
- Completed: [task]
- In Progress: [task]
- Blockers: [if any]
- Tomorrow: [task]

Dev 2:
- Completed: [task]
- In Progress: [task]
- Blockers: [if any]
- Tomorrow: [task]

Joint:
- PR review (5 min)
- Integration check-in
```

**PR Template**:
```
## What changed
- Fixed/Added: [description]

## Testing
- [x] Unit tested
- [x] Manual tested
- [x] No regressions

## Integration notes
- Related to Dev 2: [task]
- Blocks: [none]
```

---

**Last Updated**: April 5, 2026
