# UniFeast Development Quick Reference

## 🚀 Quick Start Checklist

### Prerequisites Setup (Both Devs)
```bash
# 1. Clone and navigate
cd d:\UniBeast

# 2. Install dependencies
cd server && npm install
cd ../client && npm install

# 3. Create .env file in project root (ask for credentials)
# Keys needed:
MONGODB_URI=
JWT_SECRET=
CLIENT_URL=http://localhost:5173
REDIS_URL=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
PORT=5000
NODE_ENV=development

# 4. Start services
##  Terminal 1 - Backend
cd server && npm run dev

## Terminal 2 - Frontend
cd client && npm run dev

## Terminal 3 (optional) - Redis (if not using cloud)
redis-server

# 5. Seed database
cd server && npm run seed

# 6. Access app at http://localhost:5173
```

---

## 📂 BRANCH WORKFLOW

### Creating a Feature Branch
```bash
# 1. From dev branch
git checkout dev
git pull origin dev

# 2. Create feature branch
git checkout -b feature/backend-order-flow
# OR
git checkout -b feature/frontend-cart-page

# 3. Work on your tasks
# (Make commits regularly)
git add .
git commit -m "feat: implement pool joining logic with concurrency locks"

# 4. Push to origin
git push origin feature/backend-order-flow

# 5. Create Pull Request
# Go to GitHub/GitLab → Create PR from feature → dev
# Add description, tests, integration notes
```

### Committing Best Practices
```bash
# Good commit messages:
git commit -m "feat: add pool consolidation logic"
git commit -m "fix: handle race condition in joinPool"
git commit -m "refactor: extract validation to middleware"
git commit -m "docs: update queue engine readme"

# Types: feat, fix, refactor, docs, test, style, chore
```

### Merging Back to Dev
```bash
# 1. Ensure all tests pass
npm test (when available)

# 2. Pull latest dev
git checkout dev
git pull origin dev

# 3. Merge your branch
git merge feature/backend-order-flow

# 4. Resolve conflicts if any
# (Edit conflicted files, then)
git add .
git commit -m "merge: feature/backend-order-flow into dev"

# 5. Push to origin
git push origin dev
```

---

## 🔍 KEY FILE LOCATIONS & PURPOSES

### BACKEND (Node.js/Express)
```
server/
├── server.js                          # Entry point, Socket.io setup
├── package.json                       # Dependencies
├── config/
│   ├── db.js                          # MongoDB connection
│   └── lockManager.js                 # Redis locks (TODO: Finish)
├── middleware/
│   ├── auth.js                        # JWT protection
│   ├── role.js                        # Role-based access
│   └── upload.js                      # Multer file upload
├── models/
│   ├── User.js                        # User schema
│   ├── MenuItem.js                    # Menu items
│   ├── Order.js                       # Orders (PRIORITY FOCUS)
│   ├── Pool.js                        # Pooling schema
│   └── NutritionLog.js               # Nutrition tracking
├── controllers/
│   ├── authController.js              # Register/Login
│   ├── orderController.js             # Order CRUD & status ★★★ FOCUS
│   ├── poolController.js              # Pool operations
│   ├── menuController.js              # Menu CRUD
│   ├── nutritionController.js         # Nutrition endpoints
│   └── adminController.js             # Admin operations
├── routes/
│   ├── auth.js
│   ├── orders.js                      # ★★★ EXPAND THIS
│   ├── pools.js
│   ├── menu.js
│   ├── nutrition.js
│   └── admin.js
├── utils/
│   ├── queueEngine.js                 # ★★★ M/M/c calculations
│   ├── poolEngine.js                  # ★★★ Pool lifecycle
│   └── socketHandler.js               # Real-time events
└── seeds/
    └── seed.js                        # Sample data
```

### FRONTEND (React/Vite)
```
client/
├── package.json
├── src/
│   ├── App.jsx                        # Router setup
│   ├── main.jsx                       # Entry point
│   ├── index.css                      # Tailwind + theme
│   ├── api/
│   │   └── index.js                   # Axios instance + API calls
│   ├── components/
│   │   ├── common/
│   │   │   ├── Layout.jsx
│   │   │   ├── Navbar.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── ETATimer.jsx               # ★★★ PRIORITY (Dev 2)
│   │   ├── PoolCard.jsx               # ★★★ NEW (Dev 2)
│   │   └── ...
│   ├── contexts/
│   │   ├── AuthContext.jsx            # User auth state
│   │   ├── CartContext.jsx            # Cart management
│   │   └── SocketContext.jsx          # Socket.io connection
│   └── pages/
│       ├── Login.jsx                  # ✅ Working
│       ├── Register.jsx               # ✅ Working
│       ├── MenuPage.jsx               # ✅ Working
│       ├── CartPage.jsx               # ★★★ TODO (Dev 2 Priority 1)
│       ├── OrdersPage.jsx             # ★★★ TODO (Dev 2 Priority 1)
│       ├── PoolsPage.jsx              # ★★★ TODO (Dev 2 Priority 2)
│       ├── KitchenDashboard.jsx       # 70% done
│       ├── AdminDashboard.jsx         # TODO (Dev 2)
│       ├── MenuManagePage.jsx         # TODO (Dev 2)
│       └── NutritionPage.jsx          # 60% done
```

---

## 🎯 DEVELOPER 1: PRIORITY QUICK REFERENCE

### THIS WEEK: Order & Pool Flow
```javascript
// FILE: server/controllers/orderController.js
// FOCUS: createOrder() function (line ~50)
// TODO:
1. Check for existing open pools for each item
2. Return suggestedPools array with discount info
3. Handle auto-join if ?joinPoolId=... in request

// FILE: server/utils/poolEngine.js
// FOCUS: closePool(), consolidatePool() functions
// TODO:
1. Auto-close at 5min or maxSize=10
2. Create consolidated order with all members' items
3. Split payment correctly
4. Broadcast via Socket.io

// FILE: server/config/lockManager.js
// FOCUS: acquireLock(), releaseLock()
// TODO:
1. Redis-based distributed locking
2. Handle timeout + retry
3. Ensure < 50ms lock time

// TEST: Concurrent pool joins
// Use: POSTMAN or this script:
for i in {1..50}; do
  curl -X POST http://localhost:5000/api/pools/:id/join \
    -H "Authorization: Bearer $TOKEN" &
done
wait
```

### ORDER FLOW LOGIC MAP
```
User Orders Item
    ↓
Check for OPEN pools on that MenuItem
    ↓
YES: Return pool option          NO: Create regular order
    ↓                                 ↓
Show "Join pool with N others?"   Order status = PENDING
    ↓                                 ↓
User clicks JOIN                  Socket: notify-new-order to kitchen
    ↓
acquireLock on pool:join
    ↓
Add user to pool.members
    ↓
Check: pool.currentSize >= pool.maxSize?
    ↓ YES                            ↓ NO
closePool()                        releaseLock → emit pool-update
    ↓
consolidatePool() - create merged order
    ↓
socket: pool-closed event to all members
```

### QUICK ENDPOINTS TO IMPLEMENT
```bash
# Priority 1
POST /api/orders                    # ← ENHANCE with pools
PATCH /api/orders/:id/status       # ← NEW (and trigger ETA recalc)
POST /api/pools/:id/join           # ← ENHANCE with locks

# Priority 2
GET /api/admin/queue/stats        # ← NEW
GET /api/orders?status=preparing  # ← NEW (for recalc)

# Test with:
curl -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items": [{"menuItem": "ID", "quantity": 1}]}'
```

### SOCKET EVENTS TO EMIT
```javascript
// In socketHandler.js
socket.on('connection', () => {
  // Existing: join-room
  // TODO ADD:
  socket.on('eta-request', calculateETAForOrder)
})

// From controller.js after status change:
io.to('kitchen').emit('order-update', {...})
io.to(`user:${userId}`).emit('eta-update', {...})
io.emit('pool-closed', {...})
```

---

## 🎨 DEVELOPER 2: PRIORITY QUICK REFERENCE

### THIS WEEK: Cart & Orders Pages
```jsx
// FILE: client/src/pages/CartPage.jsx
// STATUS: Doesn't exist
// TODO:
1. Display cart items (from CartContext)
2. Show pool recommendation for each item
3. Checkout flow
4. Place order button (call API)
5. Show confirmation

// FILE: client/src/pages/OrdersPage.jsx
// STATUS: Skeleton only
// TODO:
1. Fetch user orders via: orderAPI.getAll()
2. Render each with ETA countdown
3. Show status badge
4. Cancel & reorder buttons
5. Listen to Socket.io 'eta-update' events

// FILE: client/src/components/ETATimer.jsx
// STATUS: Doesn't exist
// CRITICAL:
1. Props: order, onUpdate callback
2. Display "Est. Ready in X min"
3. Count down every 1 second
4. Update when socket event received
5. Color: green <5min, amber <15min, orange >15min

// SOCKET EVENTS YOU'LL RECEIVE:
socket.on('eta-update', {
  orderId: "...",
  newETA: 12,  // minutes
})
socket.on('order-update', ...)
socket.on('pool-closed', ...)
```

### UI COMPONENT TREE: CartPage
```
CartPage
├── CartItemList
│   └── CartItem (x N)
│       ├── ItemName, Price
│       ├── Qty controls
│       └── Remove button
├── PoolRecommendation (x N)
│   ├── "Join pool with 3 others? Save 6%"
│   └── Join button
├── CostSummary
│   ├── Subtotal
│   ├── Savings
│   └── Total
├── SpecialInstructions (textarea)
└── CheckoutButton
```

### UI COMPONENT TREE: OrdersPage
```
OrdersPage
├── Tab: Active | Completed
├── OrderCard (x N)
│   ├── ItemsList (compact)
│   ├── Status badge
│   ├── ETATimer ★★★ CRITICAL
│   ├── "Track Order" link
│   ├── "Cancel" button (if eligible)
│   └── "View Details" (expand)
└── OrderDetail (modal/expanded)
    ├── Full itemsList
    ├── Nutrition breakdown
    ├── Price breakdown
    ├── Pool info (if pooled)
    └── Close button
```

### QUICK API CALLS
```javascript
// In OrdersPage.jsx
import { orderAPI } from '../api';
import { useEffect, useState } from 'react';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  
  useEffect(() => {
    orderAPI.getAll({ status: 'active' })
      .then(res => setOrders(res.data.data))
      .catch(err => toast.error('Failed to load orders'));
  }, []);
  
  // Listen to socket:
  useEffect(() => {
    socket?.on('eta-update', (update) => {
      setOrders(prev => prev.map(o =>
        o._id === update.orderId
          ? { ...o, estimatedTime: update.newETA }
          : o
      ));
    });
  }, [socket]);
}
```

### SOCKET EVENT LISTENERS TEMPLATE
```javascript
// client/src/contexts/SocketContext.jsx - ENHANCE:
function setupSocketListeners(socket) {
  socket.on('eta-update', (data) => {
    // Update order ETA
    console.log('ETA Update:', data);
  });
  
  socket.on('order-preparing', (data) => {
    // Order status changed to preparing
  });
  
  socket.on('order-ready', (data) => {
    // Toast: "Your order is ready!"
    toast.success(`Order ${data.orderId} is ready!`, { duration: 4000 });
  });
  
  socket.on('pool-closed', (data) => {
    // Pool consolidated, order created
    // Refetch orders
  });
}
```

### QUICK RESPONSIVE BREAKPOINTS
```jsx
// Tailwind: sm=640px, md=768px, lg=1024px, xl=1280px
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
  {orders.map(order => (
    <div key={order._id} className="p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl">{order.id}</h2>
    </div>
  ))}
</div>
```

---

## 🧪 TESTING COMMANDS

### Backend Testing
```bash
# Start server in dev mode
cd server && npm run dev

# Test order creation
curl -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"menuItem": "66001a1234567890abcdef11", "quantity": 1}
    ],
    "specialInstructions": "Extra spicy"
  }'

# Test pool join
curl -X POST http://localhost:5000/api/pools/ID/join \
  -H "Authorization: Bearer TOKEN"

# Test ETA calc
curl -X GET http://localhost:5000/api/admin/queue/stats \
  -H "Authorization: Bearer TOKEN"
```

### Frontend Testing
```bash
# Start dev server
cd client && npm run dev

# Check browser console for errors
# Test with Redux DevTools / React DevTools

# Test Socket connection:
// In browser console:
socket.connected  // should be true
socket.emit('get-queue-stats')
socket.on('queue-stats', console.log)
```

---

## ⚠️ COMMON PITFALLS & FIXES

### Dev 1 - Backend
| Problem | Cause | Fix |
|---------|-------|-----|
| Pool loses members | Race condition | Use Redis lock with ttl |
| ETA never updates | No socket broadcast | Add notifyAllETAUpdates call |
| Orders stuck "pending" | No status transition logic | Implement updateOrderStatus route |
| Nutrition not logging | Order completion not hooked | Add autoLogNutrition in controller |

### Dev 2 - Frontend
| Problem | Cause | Fix |
|---------|-------|-----|
| Cart empties on refresh | localStorage not persisted | Save to localStorage in CartContext |
| Socket events not received | Not listening or disconnected | Check socket.connected in DevTools |
| ETA timer wrong | Not updating on socket | Add useEffect for eta-update listener |
| Pool not joining | API returns 400 | Check request payload, user auth |

---

## 📱 TESTING DEVICES & VIEWPORT SIZES

```javascript
// Test these viewport sizes:
// Mobile: 375×667 (iPhone SE)
// Tablet: 768×1024 (iPad)
// Desktop: 1920×1080 (Full width)

// Keyboard shortcuts (in browser dev tools):
// Ctrl+Shift+M: Toggle device toolbar
// Ctrl+Shift+I: Open DevTools
```

---

## 🔗 USEFUL LINKS

### Documentation
- Mongoose: https://mongoosejs.com/docs/guide.html
- Express: https://expressjs.com/
- React Hooks: https://react.dev/reference/react
- Socket.io: https://socket.io/docs/v4/
- Tailwind: https://tailwindcss.com/docs

### Queue Theory
- Erlang-C Formula: https://en.wikipedia.org/wiki/Erlang_C
- M/M/c Queue: https://en.wikipedia.org/wiki/M/M/c_queue

### Dev Tools
- Postman: https://www.postman.com/
- Redux DevTools: Chrome extension
- React DevTools: Chrome extension
- MongoDB Compass: Local DB viewer

---

## ✅ DEFINITION OF DONE (DoD)

**For each task to be considered "done"**:
- [ ] Code written and committed
- [ ] PR created with description
- [ ] Self-tested and working locally
- [ ] No console errors
- [ ] Follows project conventions
- [ ] Integrated with existing code
- [ ] Peer reviewed and approved
- [ ] Merged to dev branch

---

## 📞 EMERGENCY CONTACTS & ESCALATION

### If Blocked
1. Check with other dev if dependency
2. Post in shared chat with details
3. Try workaround (mock data, stub functions)
4. Continue with other tasks if possible

### If Git Merge Conflict
```bash
# Either:
git checkout --ours server/models/Order.js  # Keep your changes
git checkout --theirs server/models/Order.js # Keep their changes

# Then:
git add .
git commit -m "resolve: merge conflict in Order model"
```

---

**Last Updated**: April 5, 2026  
**For Questions**: Refer to PROJECT_STATUS_ANALYSIS.md or IMPLEMENTATION_ROADMAP.md
