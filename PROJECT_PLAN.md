# UniFeast: Comprehensive Project Plan & Architecture Roadmap

## 1. Project Understanding & Core Objective
**Project Name:** UniFeast
**Core Objective:** To develop a "Smart Canteen & Collaborative Restaurant Pooling Ecosystem." The platform optimizes university/canteen food ordering by grouping simultaneous orders for the same items into "Pools," which reduces kitchen prep load and splits costs among students. It dynamically calculates queue delays and accurate ETAs using mathematical models (Erlang-C) and integrates dietary/nutrition tracking.
**Target Disruption:** Combating long canteen lines, inefficient kitchen preparation workflows, and opaque ordering timelines. 
**Primary Roles:** Student, Kitchen, Admin.

---

## 2. Current Progress Analysis
Based on the existing codebase and completed reports, the project foundation is approximately **60% complete**.

* **Frontend:** 
  * *Working:* Basic layout, Routing, Auth Context, basic `MenuPage` with search/category filtering.
  * *Partial:* `KitchenDashboard` skeleton (live orders display, manual status toggles).
* **Backend:** 
  * *Working:* MVC Architecture scaffolded. Authentication (JWT, bcrypt), Role-Based Access Control (RBAC). Queue Engine mathematical formulas (Erlang-C, ETA baseline structures).
  * *Partial:* Core API routes sketched out, Socket.io initialization.
* **Database:** 
  * *Working:* Fully normalized Mongoose schemas (User, MenuItem, Order, Pool, KitchenStock, NutritionLog, Settings).
* **APIs / Integrations:** 
  * *Working:* Basic internal endpoints.
  * *Partial:* Clarifai/Inference Python integration bridged via Node (development/testing phase). Socket.io integration has basic hooks but lacks broad event propagation.
* **UI/UX:** 
  * *Working:* Core color scheme / CSS styling (`index.css`), responsive layouts (`Navbar`, `Sidebar`, `Layout`).

---

## 3. Architecture Overview
**Tech Stack:** MERN (MongoDB, Express.js, React.js via Vite, Node.js), Socket.io (Real-time), Redis (Distributed Lock Manager), Python (Inference script).
**System Design:**
* **Client:** React utilizing the Context API for state management (`AuthContext`, `CartContext`, `SocketContext`).
* **Server:** Express.js adhering to an MVC pattern. 
* **Concurrency Engine:** Redis-based Distributed Lock Manager (`config/lockManager.js`) ensures atomic operations when multiple students attempt to join an order Pool concurrently.
* **Real-time Pipeline:** `socketHandler.js` handles WebSocket connections to push ETA changes and order status updates directly to clients.

**Gaps & Inefficiencies:**
* Complex state sequences (e.g., joining a pool, locking the cost, modifying the queue) lack transactional safety on the database level (MongoDB ACID transactions).
* Missing comprehensive validation layer (e.g., Zod or Joi) for incoming backend requests. 
* Frontend relies heavily on basic Context; using something like React Query or Redux Toolkit would better handle the complex asynchronous pooling and caching states.

---

## 4. Feature Mapping
| Feature | Status | Notes |
| :--- | :---: | :--- |
| **Authentication (JWT/RBAC)** | ✅ Completed | Fully operational. |
| **Database Schemas** | ✅ Completed | Models structured cleanly. |
| **Menu Browsing & Filtering** | ✅ Completed | `MenuPage.jsx` implemented. |
| **Queue Engine Math (Erlang-C)** | ✅ Completed | Mathematical operations configured in `queueEngine.js`. |
| **Kitchen Dashboard UI** | 🔄 In Progress | Basic skeleton exists, requires real-time Socket hooks. |
| **Pool Logic Backend** | 🔄 In Progress | Scaffolding exists, but final consolidation/cost splitting logic is pending. |
| **Shopping Cart & Checkout** | ❌ Not Started | `CartPage.jsx` and checkout flows do not function end-to-end. |
| **Pool Discovery (UI)** | ❌ Not Started | `PoolsPage.jsx` does not visually map active pools yet. |
| **Order History & Active ETAs** | ❌ Not Started | `OrdersPage.jsx` needs data wiring and live socket consumption. |
| **Nutrition Auto-Logging** | ❌ Not Started | Orders do not yet automatically patch `NutritionLog`. |

---

## 5. Technical Debt & Issues
* **Zero Testing Coverage:** No Unit, Integration, or E2E tests exist. A bug in the Erlang-C math or Pool Consolidation could crash the production environment.
* **Error Handling Fragility:** Missing centralized custom error handling middleware. Mid-flight connection drops during checkout or pool joining could leave orphaned DB artifacts.
* **Missing AI Pipelines:** `test_clarifai.js` and `inference.py` are isolated. File handling (`multer` or Cloudinary) for photo food-logging is unimplemented.
* **Concurrency Edge Cases:** While Redis locks are set up, validation checking if a "Pool just closed" right as a lock is acquired during checkout is not perfectly hardened.

---

## 6. Project Plan (Forward Roadmap)

### **Phase 1: Core Lifecycle Completion (Weeks 1-2)**
*Objective: Allow a student to browse, add to cart, join a pool, checkout, and have the kitchen receive the consolidated order.*
* **Task 1.1:** Develop the frontend `CartPage.jsx` and `CartContext`.
* **Task 1.2:** Implement backend Pool Validation and Consolidation (aggregate Pool requests, finalize cost splitting on timer expiration).
* **Task 1.3:** Complete the end-to-end Checkout/Payment bridging (simulate or integrate Stripe/Razorpay).
* **Task 1.4:** Wire `OrdersPage.jsx` to fetch historical and active orders.

### **Phase 2: Real-time Orchestration & Kitchen Flow (Weeks 3-4)**
*Objective: Make the system truly "live" with WebSockets and dynamic queueing.*
* **Task 2.1:** Wire `socketHandler.js` to emit `orderStatusUpdated` and `etaRecalculated` events.
* **Task 2.2:** Connect `KitchenDashboard.jsx` to WebSockets so kitchen staff see incoming orders pop up without refreshing.
* **Task 2.3:** Integrate the `queueEngine.js` formulas to broadcast specific user ETAs on the `OrdersPage.jsx`.
* **Task 2.4:** Build `PoolsPage.jsx` to dynamically list active pools students can jump into.

### **Phase 3: AI, Nutrition & Polish (Weeks 5-6)**
*Objective: Activate the "Smart" and "Healthy" aspects of UniFeast.*
* **Task 3.1:** Implement file uploads (`multer`/Cloudinary) for nutrition tracking and link to `inference.py`.
* **Task 3.2:** Trigger automatic addition to `NutritionLog` based on completed order ingredients.
* **Task 3.3:** Design and connect the `NutritionPage.jsx` UI and Leaderboards (`LeaderboardWidget/Modal.jsx`).
* **Task 3.4:** Implement Rate Limiting, request validation (e.g., Zod), and Winston logging.

---

## 7. Prioritization Matrix
* **High Priority (Blockers):** Cart logic, Checkout processes, Pool Consolidation engine, Kitchen order receipt.
* **Medium Priority (Core Value Proposition):** Real-time Socket sync, Live ETA calculations, Visual Pool Discovery.
* **Low Priority (Enhancements):** Clarifai AI photo tracking, granular Nutrition leaderboards, Admin analytical dashboard.

---

## 8. Best Practices & Strategic Suggestions
1. **Adopt MongoDB ACID Transactions:** For the pool checkout flow. Deducting money, locking a pool, and writing an order chunk MUST be atomic. `session.startTransaction()` should be heavily utilized.
2. **Shift to React Query (TanStack Query):** Move away from pure React Context for fetching API data. React Query will natively handle polling, caching, and background refetching which is critical for dynamic Pool displays.
3. **Dedicated Queue Worker:** Consider adding BullMQ or a similar background job processor. Closing pools exactly at "countdown = 0" requires robust background workers, not just standard HTTP requests.
4. **Validation Layer:** Introduce `Zod` to heavily sanitize inputs before hitting the Pool Engine or Database.