# UniFeast — Order Lifecycle Flow: Current Implementation

## 1. Overview
The UniFeast order lifecycle manages the progression of student meal orders from cart to completion using a queue-driven, optimistic concurrency state machine. The student initiates checkout via Razorpay, and upon client-side verification, the backend commits the order to the database. The order is inserted into the kitchen queue, and its time to completion is managed via socket-driven Erlang-C estimations. Kitchen staff pull orders through a strictly enforced state pipeline until ready for pickup, with live socket emissions providing the student UI real-time fidelity.

Student Cart → Checkout → POST /api/orders → My Orders Page
→ Kitchen Dashboard (socket order:new) → QUEUED → PREPARING → READY → COMPLETED
→ Student sees final status

## 2. Stage 1: Cart & Checkout (Student Side)
### 2.1 CartContext
- **State held:** `items`, `totalAmount`, `totalItems`.
- **Functions:** `addToCart`, `updateQuantity`, and `clearCart()`.

### 2.2 Checkout Component (`src/pages/CartPage.jsx`)
- **Payment Initiation:** Injects the Razorpay web script `checkout.razorpay.com/v1/checkout.js`.
- **Form Data:** Prefills `name`, `email`, `phone` from the global `user` context. Initializes a new window.Razorpay(options).

### 2.3 API Calls & Flow
- **1. Payment Verification:** The frontend script `handler` calls `await paymentAPI.verifyPayment` validating the `razorpay_signature`.
- **2. Order Creation:** Once verified, `await orderAPI.create({ items: orderItems, specialInstructions: instructions })` is fired.
- **Failures:** Catch block captures backend or payment errors and triggers a frontend UI toast.

### 2.4 Success Behavior
- `clearCart()` is invoked.
- Student is routed to `/orders` inside an ETA success Toast.

## 3. Stage 2: Order Creation (Backend)
### 3.1 POST /api/orders Handler
- Expected handling: Creates document from items arrays and quantities.

### 3.2 Order Document Fields (`server/models/Order.js`)
- **Fields written:** `user` (ObjectId), `items` (Array), `totalAmount`, `status` (defaults to 'pending'), `isPooled`, `estimatedTime`, `estimatedReadyAt`, `statusHistory`, `actualCompletionTime`, `specialInstructions`.

### 3.3 Queue Engine
- The backend incorporates Queue ETA calculations. Frontend explicitly expects: `data.eta?.eta` or `data.data?.estimatedTime`.

### 3.4 Socket Event
- Creation ultimately emits `socket.emit('order:new', { order })` to update the kitchen dynamically without page reload.

## 4. Stage 3: My Orders Page (Student View)
### 4.1 Page Load & Fetching
- Component: `src/pages/OrdersPage.jsx`.
- Endpoint: `GET /api/orders/my?status={filter}` via `orderAPI.getMy(params)`.
- Updates `orders` state array.

### 4.2 New Order Rendering
- After `navigate('/orders')`, `useEffect` mounts and `fetchOrders()` populates the latest DB snapshot. Groups orders visually by date headers.

### 4.3 Status Display
- Maps via `statusConfig`. Badges use tailwind theme configs mapping strings 'pending', 'queued', 'preparing' into formatted emojis:
  - pending ⏳ 
  - queued 📋 
  - preparing 👨‍🍳 
  - ready ✅ 
  - completed 🎉 
  - cancelled ❌

### 4.4 ETA & Queue Display
- Active orders reveal a progress bar visualizing time from `Date.now()` → `estimatedReadyAt`.
- A generic `setInterval` updates the `${mins}m ${secs}s` string per-second.

### 4.5 Socket Subscriptions
- `order-update`: Rewrites the array object per ID (`status: data.status`).
- `eta-update`: Refreshes `estimatedTime` and `estimatedReadyAt` without moving the component.

## 5. Stage 4: Kitchen Dashboard (Kitchen View)
### 5.1 Initial Load
- Component: `useKitchenOrders.js` handles data sourcing for `KitchenDashboard/index.jsx`.
- Endpoints: `GET /api/orders/kitchen/live` (for active orders map) and `GET /api/orders/kitchen/summary`.

### 5.2 Socket Connection
- `socket.emit('kitchen:join')` maps the current backend user stream onto the namespace.

### 5.3 Order Card (`OrderCard.jsx`)
- Computes `elapsedRatio`. Exceeding 1.0 flags `critical pulse`.
- Displays items, notes, student ID, and order ID strings. 

### 5.4 Sidebar 
- Updates the summary object `summary.queueStats` passing metrics to `KitchenSidebar`. Includes a dynamic Overloaded banner flag driven by socket.

## 6. Stage 5: 5-Stage Kitchen Status Progression

### 6.1 PENDING → QUEUED
- **Trigger:** Auto-triggers after payment integration and order initialization success.
- **Backend steps:** MongoDB row created. Sent into Redis `kitchen:queue` active space.

### 6.2 QUEUED → PREPARING
- **Trigger:** Kitchen chef presses `→ Start Cooking`.
- **Frontend action:** `useKitchenOrders.updateOrderStatus` calls `PATCH /api/orders/:id/status`.
- **Optimistic update:** Yes. Local JS `Map()` is overwritten immediately.
- **Backend steps:**
  1. Idempotency Check
  2. Transition validator `validateTransition`
  3. Applies `startedAt = Date.now()`
  4. Optimistic `findOneAndUpdate` hitting `__v`
  5. Removes Redis `kitchen:queue` ZSET
  6. Recalculate ETA rules
- **Socket events:** `order:statusChanged` hit.
- **Student sees:** Shift to Preparing.
- **Kitchen sees:** Status shift.

### 6.3 PREPARING → READY
- **Trigger:** Kitchen chef presses `→ Mark Ready`.
- **Backend steps:** `preparedAt` stamped.
- **Socket events:** `order:statusChanged`.
- **Student sees:** ETA halts. Shift to Ready state.
- **Kitchen sees:** Shift to Confirm Pickup button state.

### 6.4 READY → COMPLETED
- **Trigger:** Kitchen presses `→ Confirm Pickup`.
- **Backend steps:** Stamps `completedAt`. Potentially fires `autoLogNutrition`. 
- **Kitchen sees:** `'COMPLETED'` triggers array unmounting: `next.delete(orderId)`. The UI card is fully destroyed.

## 7. Real-Time Mechanics
### 7.1 Idempotency
- `useKitchenOrders.js` utilizes `const idempotencyKey = ${orderId}-${newStatus}-${Date.now()}`. Backend Redis client processes and responds to cached payloads.

### 7.2 OCC (Optimistic Concurrency Control)
- Backend locks `_id: id`, `status`, and `__v`. Failing `__v` returns `Concurrent modification — retry`, averting duplicate Kitchen double-pulls.

### 7.3 Socket Reconnection
- The UI contains exponential backoff, but misses a re-trigger of `fetchLiveOrders` during disconnects. 

## 8. Color Coding & UI Behavior

| Status | BG Color | Border Color | Action Button Label | 
| :--- | :--- | :--- | :--- | 
| **PENDING** | Default CSS | Grey | None | 
| **QUEUED** | Default CSS | Info Accent | → Start Cooking | 
| **PREPARING** | Default CSS | Primary Accent | → Mark Ready | 
| **READY** | Default CSS | Success Accent | → Confirm Pickup | 

## 9. Gaps & Issues Found

| Stage | File | Issue Description | Severity |
| :--- | :--- | :--- | :--- |
| **Stage 1** | `CartPage.jsx` | If the backend `orderAPI.create()` errors post-payment verify, the student has paid but possesses no internal order. | CRITICAL |
| **Stage 6/7** | `useKitchenOrders.js` | Idempotency generation includes `Date.now()`. Two taps in sequence generate unique keys, bypassing Idempotency protection. | MINOR |
| **Stage 7** | `useKitchenOrders.js` | Drops lack re-synchronization (`socket.on('reconnect')` does not fetch DB snapshot). Missed payloads stay dead. | CRITICAL |

## 10. Summary
- **Working End-to-End correctly:** The backend optimistic concurrency (`__v`) routing tightly couples with socket payloads. The Kitchen mapping dynamically filters without severe UI overhead.
- **Partially implemented:** Idempotency key generation via frontend.
- **Missing ENTIRELY:** Hard fallback polling strategies on websocket destruction.