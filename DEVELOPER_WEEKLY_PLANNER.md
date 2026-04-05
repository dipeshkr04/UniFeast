# 📋 UniFeast Developer Task Prioritization & Weekly Planner

**Assign to**: [Developer Name]  
**Role**: [Backend | Frontend]  
**Duration**: 4 weeks (Max 40 hours/week recommended)  
**Deadline**: May 5, 2026

---

## 👤 DEVELOPER 1: BACKEND - Order & Pool Engineering

### PRINT THIS! Week-by-week breakdown:

---

## 📅 WEEK 1: Order Creation & Pool Integration

### Day 1-2: Setup & Order Creation Enhancement
**Target Hours**: 8 hrs  
**Key File**: `server/controllers/orderController.js`

- [ ] Review existing `createOrder` function (30 min)
- [ ] Plan pool checking logic (1 hr)
- [ ] Implement pool finding in `createOrder` (2 hrs)
  ```javascript
  // For each item in order, find open pools
  const openPools = await Pool.find({
    menuItem: item.menuItem,
    status: 'open',
    closesAt: { $gt: new Date() }
  });
  ```
- [ ] Return `suggestedPools` in response (1.5 hrs)
- [ ] Test with Postman (1.5 hrs)
- [ ] Commit & push: `feat: add pool recommendations to order creation` (30 min)

**PR Title**: `feat: pool suggestions in order creation`  
**Acceptance**: Response includes `{order: {...}, suggestedPools: [...]}`

---

### Day 3-4: Lock Manager & Pool Joining
**Target Hours**: 8 hrs  
**Key Files**: `server/config/lockManager.js`, `server/utils/poolEngine.js`

- [ ] Design Redis lock strategy (1 hr)
- [ ] Implement `acquireLock()` function (2 hrs)
- [ ] Implement `releaseLock()` function (1.5 hrs)
- [ ] Enhance `joinPool()` with lock protection (2 hrs)
- [ ] Test concurrent joins (simulate 50 users) (1.5 hrs)

**Test Script**:
```bash
for i in {1..50}; do
  curl -X POST http://localhost:5000/api/pools/:id/join \
    -H "Authorization: Bearer $TOKEN" &
done
```

**Acceptance**: No duplicate members, all joins succeed, < 50ms lock time

---

### Day 5: Validation Middleware & Testing
**Target Hours**: 4 hrs  
**Key File**: `server/middleware/validate.js`

- [ ] Create validation middleware (1.5 hrs)
- [ ] Apply to order & pool routes (1 hr)
- [ ] Test invalid inputs (400 errors) (1 hr)
- [ ] Commit & PR: `feat: input validation middleware` (30 min)

**PR Summary**: Order creation now returns pool suggestions; joinPool uses distributed locks

---

## 📅 WEEK 2: Pool Consolidation & ETA Broadcasting

### Day 8-9: Pool Closing & Consolidation
**Target Hours**: 8 hrs  
**Key Files**: `server/utils/poolEngine.js`

- [ ] Implement `closePool()` timer logic (2 hrs)
- [ ] Implement `consolidatePool()` - create merged order (3 hrs)
- [ ] Calculate per-member costs correctly (1.5 hrs)
- [ ] Test: pools close at 5min mark (1.5 hrs)

**Acceptance Criteria**:
- Pool auto-closes at 5min OR maxSize
- Consolidated order created with all items
- No data loss or duplicate charges
- Each member's original order linked

---

### Day 10-11: ETA Recalculation Engine
**Target Hours**: 8 hrs  
**Key File**: `server/utils/queueEngine.js`

- [ ] Implement `recalculateAllETAs()` function (2.5 hrs)
- [ ] Integrate into `updateOrderStatus()` (1.5 hrs)
- [ ] Test calculation accuracy (50+ orders) (2 hrs)
- [ ] Optimize for speed (< 500ms) (1.5 hrs)
- [ ] Commit: `feat: real-time ETA recalculation` (30 min)

**Pseudocode**:
```javascript
async function recalculateAllETAs(excludeOrderId) {
  const pending = await Order.find({status: {$in: ['pending','queued']}});
  const updates = [];
  
  for (let order of pending) {
    const newETA = calculateETA(order);
    if (Math.abs(newETA - order.estimatedTime) > threshold) {
      updates.push({orderId: order._id, newETA});
    }
  }
  
  // Broadcast via Socket
  return updates;
}
```

---

### Day 12: Socket.io Broadcasting Setup
**Target Hours**: 4 hrs  
**Key File**: `server/utils/socketHandler.js`

- [ ] Enhance `notifyAllETAUpdates()` (1.5 hrs)
- [ ] Add pool-closed event broadcast (1 hr)
- [ ] Add order-status-changed event (1 hr)
- [ ] Test event delivery (30 min)

**Acceptance**: Events reach clients within 100ms

---

## 📅 WEEK 3: Nutrition & Final Backend Features

### Day 15-16: Auto-Nutrition Logging
**Target Hours**: 8 hrs  
**Key File**: `server/controllers/orderController.js`

- [ ] Implement `autoLogNutrition()` function (3 hrs)
- [ ] Trigger on order completion (1.5 hrs)
- [ ] Calculate daily totals (1 hr)
- [ ] Test with various order sizes (1.5 hrs)
- [ ] Handle edge cases (1 hr)

**Acceptance Criteria**:
- Nutrition logged automatically on order complete
- Quantities multiplied correctly
- Daily totals accurate
- "Auto-logged" flag set

---

### Day 17-18: Backend Polish
**Target Hours**: 8 hrs  
**Files**: All models & controllers

- [ ] Add database indexes (1 hr)
- [ ] Implement global error handler (2 hrs)
- [ ] Complete all CRUD endpoints (2 hrs)
- [ ] Final testing & debugging (2 hrs)
- [ ] Code review self-check (1 hr)

---

### Day 19-20: Documentation & Code Review
**Target Hours**: 4-8 hrs

- [ ] Write API documentation
- [ ] Update README
- [ ] Review Dev 2's PRs for backend requirements
- [ ] Fix any integration issues

---

## 🎯 Week 1 PR Checklist (Dev 1)

### Must Include
- [x] Order response includes `suggestedPools` array
- [x] Pool joining protected by Redis lock
- [x] No race conditions (tested with 50+ concurrent)
- [x] Validation middleware applied
- [x] Error responses formatted consistently
- [ ] No console.log() or debug code
- [ ] Commits are logical and atomic

### PR Description Template
```markdown
## What This Does
Implements pool suggestions in order creation and adds distributed lock protection for pool joining.

- Order creation now checks for existing open pools
- Returns discount calculations with pool recommendation
- Pool joining uses Redis distributed locks (< 50ms)
- Prevents race conditions with concurrent joins

## Testing Done
- [x] Order with 1 pool available
- [x] Order with 3 pools available
- [x] Concurrent joins (50 users) - no duplicates
- [x] Lock timeout + retry
- [x] Invalid pool state handling

## Files Changed
- server/controllers/orderController.js
- server/utils/poolEngine.js
- server/config/lockManager.js
- server/middleware/validate.js

## Related Tasks
#1 - order creation
#2 - pool joining
```

---

---

## 👤 DEVELOPER 2: FRONTEND - UI & Real-Time Components

### PRINT THIS! Week-by-week breakdown:

---

## 📅 WEEK 1: Critical User Pages

### Day 1-2: CartPage Component
**Target Hours**: 8 hrs  
**File**: `client/src/pages/CartPage.jsx`

- [ ] Create component skeleton (1 hr)
- [ ] Wire CartContext for items (1 hr)
- [ ] Build CartItemList sub-component (1.5 hrs)
  ```jsx
  // Show: name, price, qty +/-, remove btn, pool badge
  ```
- [ ] Build CostSummary sub-component (1 hr)
- [ ] Build PoolRecommendation cards (1.5 hrs)
- [ ] Add "Place Order" checkout flow (1 hr)
- [ ] Test on mobile (360px) & desktop (1920px) (1 hr)

**Acceptance**:
- Add/remove items works
- Pool savings calculated correctly
- Responsive on 360px and 1920px
- Checkout button submits order

---

### Day 3-4: OrdersPage Component
**Target Hours**: 8 hrs  
**File**: `client/src/pages/OrdersPage.jsx`  
**CRITICAL**: Includes ETATimer component

- [ ] Create page skeleton (1 hr)
- [ ] Fetch user orders via API (1 hr)
- [ ] Display active orders tab (1.5 hrs)
- [ ] Create OrderCard sub-component (1.5 hrs)
  ```jsx
  // Show: items list, status, ETA, actions
  ```
- [ ] **Create ETATimer component** (1.5 hrs)
  ```jsx
  // Display "Est. Ready in 12 min"
  // Count down every second
  // Color: green if <5min, amber if <15min
  ```
- [ ] Completed orders tab (1 hr)
- [ ] Responsive testing (1 hr)

**Acceptance**:
- ETA counts down correctly
- Orders display with status
- Can view order details
- Mobile responsive

---

### Day 5: Polish & Commit
**Target Hours**: 4 hrs

- [ ] Fix styling inconsistencies (1 hr)
- [ ] Add loading states (1 hr)
- [ ] Test error scenarios (1 hr)
- [ ] Commit & PR (30 min)

**PR Title**: `feat: implement CartPage and OrdersPage`

---

## 📅 WEEK 2: Real-Time & Pool Features

### Day 8-9: PoolsPage Component
**Target Hours**: 8 hrs  
**File**: `client/src/pages/PoolsPage.jsx`

- [ ] Create page skeleton (1 hr)
- [ ] Fetch available pools from API (1 hr)
- [ ] Create PoolCard component (2 hrs)
  ```jsx
  // Show: item image, members count, savings %, time remaining
  // Include join button
  ```
- [ ] Create TimeRemaining countdown (1 hr)
  - Update every second
  - Show "Pool closes in 4:32"
- [ ] Create PoolMemberList (1 hr)
- [ ] Join pool modal with confirmation (1.5 hrs)
- [ ] Responsive testing (1 hr)

**Acceptance**:
- Lists all open pools
- Join button works
- Time countdown accurate
- Mobile responsive

---

### Day 10-11: Socket.io Integration
**Target Hours**: 8 hrs  
**File**: `client/src/contexts/SocketContext.jsx` (enhance)

- [ ] Add event listeners for ETA updates (1.5 hrs)
  ```javascript
  socket.on('eta-update', (data) => {
    // Update order ETA in OrdersPage
  });
  ```
- [ ] Add pool update listeners (1.5 hrs)
  ```javascript
  socket.on('pool-update', (data) => {
    // Update pool member count real-time
  });
  ```
- [ ] Add order status change listeners (1 hr)
- [ ] Test event delivery (1.5 hrs)
- [ ] Add reconnection logic (1.5 hr)
- [ ] Commit: `feat: real-time socket listeners` (30 min)

**Acceptance**:
- ETA updates live on screen
- Pool members appear/disappear in real-time
- Status changes reflect immediately
- No memory leaks on unmount

---

### Day 12: ETA Ticker Enhancement
**Target Hours**: 4 hrs  
**File**: `client/src/components/ETATimer.jsx` (enhance)

- [ ] Add Socket event listener (1 hr)
- [ ] Sync server ETA with countdown (1 hr)
- [ ] Color changes based on time (1 hr)
- [ ] Test with mocked events (1 hr)

---

## 📅 WEEK 3: Admin Features & Nutrition

### Day 15-16: MenuManagePage Component
**Target Hours**: 8 hrs  
**File**: `client/src/pages/MenuManagePage.jsx` (new)

- [ ] Fetch menu items from API (1 hr)
- [ ] Display items table (1.5 hrs)
- [ ] Add item form modal (2 hrs)
  - Name, category, price, prep time
  - Nutrition fields
  - Availability toggle
- [ ] Edit item modal (1.5 hrs)
- [ ] Delete button with confirmation (1 hr)
- [ ] Test CRUD operations (1 hr)

**Acceptance**:
- Add new items works
- Edit existing items works
- Delete with confirmation
- All changes save to backend

---

### Day 17-18: Nutrition Page Enhancements
**Target Hours**: 8 hrs  
**File**: `client/src/pages/NutritionPage.jsx` (enhance)

- [ ] Display "Auto-logged" badge on meals (1 hr)
- [ ] Show nutrition log source (meal order ref) (1 hr)
- [ ] Implement photo upload form (2 hrs)
  ```jsx
  // File input → Cloudinary upload
  ```
- [ ] Add ability to edit auto-logged meals (1.5 hrs)
- [ ] Add ability to undo auto-logging (1 hr)
- [ ] Test photo upload flow (1 hr)

---

### Day 19-20: AdminDashboard Enhancements
**Target Hours**: 4-8 hrs  
**File**: `client/src/pages/AdminDashboard.jsx` (enhance)

- [ ] Add User Management tab (2 hrs)
  - List users with roles
  - Role assignment (optional)
- [ ] Add Canteen Settings tab (1.5 hrs)
  - Active stations input
  - Pool duration select
  - Save button
- [ ] Add basic Analytics tab (1.5 hrs)
  - Daily order count
  - Popular items
  - Peak hour chart

---

## 🎯 Week 1 PR Checklist (Dev 2)

### Must Include
- [x] CartPage renders cart items correctly
- [x] Add/remove items updates total
- [x] Pool recommendation displays with discount
- [x] OrdersPage shows all user orders
- [x] ETA counts down every second
- [x] Responsive at 360px, 768px, 1920px
- [ ] No console.log() or debug code
- [ ] Component props well-defined
- [ ] Loading states show
- [ ] No console errors

### PR Description Template
```markdown
## What This Does
Implements CartPage and OrdersPage for end-to-end order flow. Includes real-time ETA countdown component.

## Features
- Add/remove items from cart
- View pool recommendations with savings
- Complete order checkout
- Track order status in real-time
- ETA countdown updates every second
- Full mobile responsiveness

## Testing Done
- [x] Add item → update total
- [x] Join pool → see discount applied
- [x] Checkout order → gets confirmation
- [x] ETA timer counts down
- [x] Mobile responsive (360px, 768px)
- [x] All buttons clickable

## Files Changed
- client/src/pages/CartPage.jsx (new)
- client/src/pages/OrdersPage.jsx (enhanced)
- client/src/components/ETATimer.jsx (new)

## Related Tasks
#10 - cart functionality
#11 - order tracking
```

---

## 🎯 SUCCESS CHECKLIST - Each Week

### ✅ Friday EOD Checklist (Both Devs)

**Week 1 EOD**:
- [ ] All Sprint 1 tasks committed
- [ ] PRs created and reviewed
- [ ] No merge conflicts remaining
- [ ] Dev tested other dev's code (5 min)
- [ ] Update status in shared document

**Week 2 EOD**:
- [ ] Sprint 2 complete
- [ ] Real-time features working end-to-end
- [ ] Cross-tested integration
- [ ] Performance acceptable

**Week 3 EOD**:
- [ ] All planned features done
- [ ] Code reviewed
- [ ] Bug fixes applied
- [ ] Ready for QA

**Week 4 EOD**:
- [ ] Polish complete
- [ ] All issues resolved
- [ ] Documentation updated
- [ ] Ready for production

---

## 🎯 TEMPO & DAILY STAND-UP TEMPLATE

### Every Morning (10 min)
```
Dev 1: "Completed [task] yesterday. Today working on [task]. 
        Blocker: [if any]"

Dev 2: "Completed [task] yesterday. Today working on [task]. 
        Blocker: [if any]"

Action Items:
- [ ] Any Git conflicts to resolve?
- [ ] Any API integration issues?
- [ ] Do PRs from other dev need review?
```

---

## 🚨 RED FLAGS - Stop & Escalate Immediately If:

1. **Task is estimated 8hrs but takes 16+**
   - Stop, discuss, re-plan

2. **API from other dev is delayed by 2+ days**
   - Implement mock API to unblock

3. **Git merge conflict can't be resolved**
   - Get both devs in 15-min call

4. **Bug in dependent's code blocks your feature**
   - File issue, agree on hotfix priority

5. **Architecture mismatch discovered**
   - Emergency 30-min sync to realign

---

## 📊 TRACKING YOUR PROGRESS

### Daily Logger
```
Date: April 8, 2026
Dev: Developer 1

Tasks Done:
- ✅ Order pool checking (2hrs)
- ✅ Lock manager design (1.5hrs)
- Total: 3.5 hours

Tomorrow:
- [ ] Implement acquireLock
- [ ] Test concurrent joins

Blockers: None
```

### Weekly Summary
```
Week 1 Actual vs Planned:
        Planned  Actual  Status
Dev 1:  40 hrs   38 hrs  ON TRACK
Dev 2:  40 hrs   42 hrs  SLIGHT OVER

Completed:
- ✅ Order creation with pool suggestions
- ✅ CartPage MVP
- ✅ OrdersPage basic
- ❌ Lock manager (started, not finished)

Next Week Focus:
- Lock manager completion
- Pool consolidation
- PoolsPage component
```

---

## 📞 ESCALATION CONTACTS

**If blocked, contact in this order:**
1. Other developer (5 min chat)
2. Tech lead (30 min discussion)
3. Project manager (status update)

**Provide when escalating**:
- What you're working on
- What the blocker is
- What you've already tried
- How it affects timeline

---

**Print This → Stick to Wall/Desk!**

**Version**: 1.0  
**Last Updated**: April 5, 2026
