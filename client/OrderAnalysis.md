# UniFeast — Order Lifecycle Flow: Current Implementation

## 1. Overview
The UniFeast order lifecycle manages the progression of student meal orders from cart to completion using a queue-driven, optimistic concurrency state machine. The student initiates checkout via Razorpay, and upon client-side verification, the backend commits the order to the database. The order is inserted into the kitchen queue, and its time to completion is managed via socket-driven Erlang-C estimations. Kitchen staff pull orders through a strictly enforced state pipeline until ready for pickup, with live socket emissions providing the student UI real-time fidelity.

Student Cart → Checkout → Razorpay Sequence → POST `/api/orders` → My Orders Page
→ Kitchen Dashboard (socket `order:new`) → QUEUED → PREPARING → READY → COMPLETED
→ Student sees final status

## 2. Stage 1: Cart & Checkout (Student Side)
### 2.1 CartContext
- **State held:** Usually `items`, `totalAmount`, `totalItems` (inferred from `useCart()` usages).
- **Functions:** `clearCart()` used after successful order.

### 2.2 Checkout Component (`src/pages/CartPage.jsx`)
- **Payment Initiation:** Uses the Razorpay web script `checkout.razorpay.com/v1/checkout.js`.
- **Form Data:** Prefills `name`, `email`, `phone` from the global `user` context. Submits `paymentData.order.amount`.

### 2.3 API Calls & Flow
- **1. Payment Verification:** `await paymentAPI.verifyPayment(...)` handles the Razorpay signature validation on the backend.
- **2. Order Creation:** If payment verifies, the client *then* creates the order: `await orderAPI.create({ items: orderItems, specialInstructions: instructions })`.
- **Note on Flow:** The backend doesn't seem to construct the PENDING order *before* Razorpay launch inside `CartPage`—CartPage relies on a pre-existing `paymentData.order.id`. Thus, payment is mapped prior to `orderAPI.create()`. 

### 2.4 Success Behavior
- The cart is cleared `clearCart()`.
- Success toast shows the ETA: `ETA: ${data.eta?.eta || data.data?.estimatedTime} min`.
- `navigate('/orders')` re-routes the student to the "My Orders" page.

## 3. Stage 2: Order Creation (Backend)
### 3.1 POST `/api/orders` Handler
- Lives in `orderController` (mapped from `server/routes/orders.js`).
- Expects `items` and `specialInstructions`.

### 3.2 Order Document Fields (`server/models/Order.js`)
- **Fields written:** `user` (ObjectId), `items` (Array of items with `menuItem`, `name`, `price`, `quantity`), `totalAmount`, `status` (defaults to `'pending'`), `isPooled`, `estimatedTime`, `estimatedReadyAt`, `statusHistory`, `specialInstructions`.
- **Status:** The schema specifies a default status of `'pending'`, though logic often assumes it starts as `'queued'` if payment is already complete.

### 3.3 Queue Engine
- The frontend expects an ETA response directly in the order creation payload (`data.eta?.eta` or `data.data?.estimatedTime`). 
- The backend incorporates `recalculateQueueETAs` internally to provide this capability.

### 3.4 Socket Event
- Based on `KitchenSocketProvider`, the creation of a new order triggers `socket.emit('order:new', { order })` which alerts the kitchen dashboard to push the order onto the active map dynamically.

## 4. Stage 3: My Orders Page (Student View)
### 4.1 Page Load & Fetching
- Component: `src/pages/OrdersPage.jsx`.
- Endpoint: `GET /api/orders/my?status={filter}` via `orderAPI.getMy(params)`.
- Updates `orders` state array.

### 4.2 New Order Rendering
- After `navigate('/orders')`, the `useEffect` triggers `fetchOrders()`. The new order is fetched cleanly from the server DB. Orders are grouped by date.

### 4.3 Status Display
- Badges use `statusConfig` mapping:
  - pending ⏳ (warning)
  - queued 📋 (info)
  - preparing 👨‍🍳 (primary)
  - ready ✅ (success)
  - completed 🎉 (success)
  - cancelled ❌ (danger)

### 4.4 ETA & Queue Display
- Progress Bar visualizes the time gap between `Date.now()` and `order.estimatedReadyAt`.
- Raw `order.estimatedTime` (min) and a live countdown string format (`${mins}m ${secs}s`) are shown on active orders, updating via local `setInterval` ticks.

### 4.5 Socket Subscriptions
- `order-update`: Updates an order's `status` array directly in local state. Triggers UI toast notification.
- `eta-update`: Modifies `estimatedTime` and `estimatedReadyAt` for the given `orderId`.

## 5. Stage 4: Kitchen Dashboard (Kitchen View)
### 5.1 Initial Load
- Component: `src/pages/KitchenDashboard/useKitchenOrders.js`.
- Endpoints: `GET /api/orders/kitchen/live` (for the queue map) and `GET /api/orders/kitchen/summary` (for counts).

### 5.2 Socket Connection
- `socket.emit('kitchen:join')` tells the server to assign this connection to the kitchen broadcasting room.

### 5.3 Order Card (`OrderCard.jsx`)
- Uses Urgency mapping logic (`elapsedRatio`). If `elapsedRatio > 1.0`, it adds `critical pulse` classes.
- Shows student name, order #, total Items, queue position, ETA (if QUEUED/PREPARING).

### 5.4 Sidebar 
- Shows raw counts passed from `summary` state (which holds `.PENDING`, `.QUEUED`, `.PREPARING`, etc).
- Overload state banner conditionally appears if `isOverloaded` flag fires from Socket.

## 6. Stage 5: 5-Stage Kitchen Status Progression

### 6.1 PENDING → QUEUED
- **Trigger:** Payment verifies and the post-checkout order save finishes.
- **Backend steps:** Backend puts order in Mongo. Backend inserts order into Redis: `zadd kitchen:queue Date.now()`.

### 6.2 QUEUED → PREPARING
- **Trigger:** Kitchen chef presses `→ Start Cooking` on the UI.
- **Frontend action:** `useKitchenOrders.updateOrderStatus` calls `PATCH /api/orders/:id/status`.
- **Optimistic update:** Yes. The React state sets `status: 'PREPARING'` instantly via a local `Map()`. Reverted automatically if API errors.
- **Backend steps:**
  1. Idempotency Check vs Redis `idempotent:key`.
  2. State machine `validateTransition('QUEUED', 'PREPARING')`.
  3. Set `startedAt: Date.now()`.
  4. Optimistic Concurrency `findOneAndUpdate` with `__v`.
  5. `redisClient.zrem('kitchen:queue')`.
  6. Recalculate global ETAs.
- **Socket events:** `order:statusChanged` emitted to `room: kitchen` and `room: student:{student_id}`.
- **Student sees:** My Orders page updates status to 👨‍🍳 Preparing.
- **Kitchen sees:** Card shifts status badge, UI resets urgency colors based on new targets.

### 6.3 PREPARING → READY
- **Trigger:** Kitchen chef presses `→ Mark Ready`.
- **Frontend action:** PATCH `newStatus: 'READY'`.
- **Backend steps:** Stamps `preparedAt = Date.now()`. Updates DB.
- **Socket events:** `order:statusChanged`.
- **Student sees:** ETA bar halts. Status shifts to ✅ Ready.

### 6.4 READY → COMPLETED
- **Trigger:** Kitchen chef verifies ID and presses `→ Confirm Pickup`.
- **Backend steps:** Stamps `completedAt = Date.now()`. Emits events. Call `autoLogNutrition(order)` to parse `MenuItem.nutrition` array and push it to `NutritionLog`.
- **Kitchen sees:** Status `'COMPLETED'` triggers the socket listener to `next.delete(orderId)`, clearing it out of the active visual map entirely.

## 7. Real-Time Mechanics
### 7.1 Idempotency
- Generated locally inside `useKitchenOrders.js` as `${orderId}-${newStatus}-${Date.now()}`. (Note: Using `Date.now()` heavily weakens idempotency against legitimate rapid double-taps happening at slightly different ms. A UUID or hash of the exact order state is much safer).
- Redis caches the full API response inside `idempotent:{key}` with a 600s TTL.

### 7.2 OCC (Optimistic Concurrency Control)
- Backend enforces `__v` matching stringently. `findOneAndUpdate({ _id: id, status: order.status, __v: order.__v })`. If this returns null, the backend 409s out with `'Concurrent modification — retry'`, prompting the frontend to rollback its optimistic UI map.

### 7.3 Socket Reconnection
- The `SocketContext.jsx` configures `reconnection: true` and `reconnectionAttempts: 10`.
- The `useKitchenOrders` hook handles `socket.on('connect', onConnect)` but right now, it **does not re-invoke** `fetchLiveOrders()` upon reconnect, meaning orders created during a brief wifi outage won't appear unless a hard refresh occurs.

## 8. Color Coding & UI Behavior

| Status | Card Outline | Badge | Action Button Label | ETA Display |
| :--- | :--- | :--- | :--- | :--- |
| **PENDING** | Grey | Yellow/Warn | None | None |
| **QUEUED** | Info | Info | → Start Cooking | `<X> min ETA` |
| **PREPARING** | Primary | Primary | → Mark Ready | `<X> min ETA` |
| **READY** | Success | Success | → Confirm Pickup | None |
| **COMPLETED** | N/A | N/A | None / Card removed | None |
| **CANCELLED** | Danger | Danger | None / Card removed | None |

## 9. Gaps & Issues Found

| Stage | File | Issue Description | Severity |
| :--- | :--- | :--- | :--- |
| **Stage 1** | `CartPage.jsx` | Checks Razorpay verification but if the *order.create* API errors, the student pays but gets no order | CRITICAL |
| **Stage 2** | `paymentController.js` | The API endpoint initiates a Razorpay Order ID asynchronously, but CartPage expects `paymentData.order.amount` globally available | MINOR |
| **Stage 6/7** | `useKitchenOrders.js` | Idempotency key uses `Date.now()`. Two clicks 1ms apart yield different keys, bypassing idempotency | MINOR |
| **Stage 7** | `useKitchenOrders.js` | Socket disconnect/reconnect does not re-trigger `fetchLiveOrders()` to catch missed payloads | CRITICAL |

## 10. Summary
- **Working End-to-End:** The architecture for transitioning orders via Mongoose OCC and piping the resultant state cleanly to sockets is well established. The Erlang-C and backend queue integrations form a sturdy foundation. The Kitchen UX is cleanly separated via modular Socket scopes.
- **Partially Implemented:** Idempotency requires slightly better key hashing. Re-synchronization on drops needs a polling fallback.
- **Missing Entirely:** Pre-creation locking (ensuring food stock isn't depleted *before* the student completes the 1-minute Razorpay flow).

