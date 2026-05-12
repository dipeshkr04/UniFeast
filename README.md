<div align="center">

# UniFeast

### Campus Dining OS for IIIT Nagpur

<p>
  A private, full-stack dining platform connecting students, kitchen teams, admins, pooled orders, live queue visibility, nutrition intelligence, and analytics.
</p>

<p>
  <img alt="React" src="https://img.shields.io/badge/React-19-0f172a?style=for-the-badge&logo=react&logoColor=61DAFB&labelColor=111827">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-6-ff4714?style=for-the-badge&logo=vite&logoColor=white&labelColor=111827">
  <img alt="Node" src="https://img.shields.io/badge/Node.js-Express-16a34a?style=for-the-badge&logo=node.js&logoColor=white&labelColor=111827">
  <img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-Mongoose-10b981?style=for-the-badge&logo=mongodb&logoColor=white&labelColor=111827">
  <img alt="Socket.IO" src="https://img.shields.io/badge/Realtime-Socket.IO-f97316?style=for-the-badge&logo=socket.io&logoColor=white&labelColor=111827">
</p>

<p>
  <img alt="Razorpay" src="https://img.shields.io/badge/Payments-Razorpay-2563eb?style=flat-square&labelColor=111827">
  <img alt="Cloudinary" src="https://img.shields.io/badge/Images-Cloudinary-38bdf8?style=flat-square&labelColor=111827">
  <img alt="JWT" src="https://img.shields.io/badge/Auth-JWT%20%2B%20OTP-facc15?style=flat-square&labelColor=111827">
  <img alt="Analytics" src="https://img.shields.io/badge/Admin-Analytics-a855f7?style=flat-square&labelColor=111827">
  <img alt="Nutrition" src="https://img.shields.io/badge/Nutrition-Badges%20%2B%20XP-22c55e?style=flat-square&labelColor=111827">
</p>

</div>

---

## Signal Board

| Zone | Flow | Signature Experience |
| --- | --- | --- |
| **Student** | Menu, cart holds, payment, QR pickup, live order tracking | Browse fast, reserve stock, pay safely, track without asking the counter. |
| **Kitchen** | Live orders, produced stock, queue timing, QR completion | Operational command center for preparation and pickup. |
| **Admin** | Users, roles, analytics, restaurants, canteen controls | A control room for usage, spend, students, items, and system settings. |
| **Nutrition** | Logs, goals, image analysis, charts, XP, badges | Food tracking tied to a competitive campus leaderboard. |
| **Pools** | Broadcaster-created pools, joining, requests, chat, closure | Group ordering with ownership, approval, and realtime coordination. |
| **Realtime Layer** | Orders, ETA, kitchen summary, stock, pools, chat | Socket.IO keeps every panel alive without manual refresh. |

## Visual Index

| Section | What It Shows |
| --- | --- |
| [System Map](#system-map) | How frontend, backend, sockets, database, payments, images, and mail connect. |
| [Role Portal](#role-portal) | Where each role lands and what they control. |
| [User Flow Gallery](#user-flow-gallery) | Ordering, kitchen fulfillment, nutrition ranking, and outside-food pooling. |
| [Feature Matrix](#feature-matrix) | The product surface by module. |
| [Data Constellation](#data-constellation) | Main MongoDB collections and relationships. |
| [Tech Stack](#tech-stack) | The exact technologies powering the product. |
| [Realtime Mesh](#realtime-mesh) | Event rooms and live updates. |

---

## System Map

```mermaid
flowchart LR
  Student[Student Panel] --> Client[React + Vite Client]
  Kitchen[Kitchen Panel] --> Client
  Admin[Admin Panel] --> Client

  Client --> API[Axios API Layer]
  Client <--> SocketClient[Socket.IO Client]

  API --> Server[Express API Server]
  SocketClient <--> SocketServer[Socket.IO Server]

  Server --> Auth[Auth + Role Guard]
  Server --> Orders[Orders + Queue Engine]
  Server --> Nutrition[Nutrition + Badge Engine]
  Server --> Pools[Outside Food Pools]
  Server --> Analytics[Admin Analytics]

  Orders --> Mongo[(MongoDB Atlas)]
  Nutrition --> Mongo
  Pools --> Mongo
  Analytics --> Mongo

  Server --> Cloudinary[Cloudinary]
  Server --> Razorpay[Razorpay]
  Server --> Mail[OTP Email]

  SocketServer --> Client

  classDef panel fill:#1f2937,stroke:#ff4714,color:#ffffff,stroke-width:2px;
  classDef client fill:#111827,stroke:#f97316,color:#ffffff,stroke-width:2px;
  classDef server fill:#22110c,stroke:#fb923c,color:#ffffff,stroke-width:2px;
  classDef data fill:#052e2b,stroke:#10b981,color:#ecfeff,stroke-width:2px;
  classDef vendor fill:#172554,stroke:#38bdf8,color:#eff6ff,stroke-width:2px;

  class Student,Kitchen,Admin panel;
  class Client,API,SocketClient client;
  class Server,SocketServer,Auth,Orders,Nutrition,Pools,Analytics server;
  class Mongo data;
  class Cloudinary,Razorpay,Mail vendor;
```

## Role Portal

```mermaid
flowchart TD
  Gate[Login, Google Sign In, or OTP Registration] --> Role{Role}

  Role -->|student| StudentHome[Menu]
  Role -->|kitchen| KitchenHome[Live Orders]
  Role -->|admin| AdminHome[Dashboard]

  StudentHome --> Cart[Cart Holds]
  Cart --> Payment[Verified Payment]
  Payment --> StudentOrders[My Orders + QR]
  StudentHome --> Queue[Live Queue]
  StudentHome --> NutritionPage[Nutrition Hub]
  StudentHome --> PoolsPage[Campus Pools]
  StudentHome --> Feast[Find Your Feast]

  KitchenHome --> Production[Produced Stock]
  KitchenHome --> QRScan[QR Scan]
  KitchenHome --> MenuManage[Menu Management]
  KitchenHome --> KitchenAnalytics[Kitchen Analytics]

  AdminHome --> Users[Users + Roles]
  AdminHome --> AnalyticsPage[Analytics]
  AdminHome --> Restaurants[Restaurants]
  AdminHome --> Settings[Canteen + Cart Settings]

  classDef entry fill:#ff4714,stroke:#ffb199,color:#fff,stroke-width:2px;
  classDef student fill:#0f172a,stroke:#fb923c,color:#fff,stroke-width:2px;
  classDef kitchen fill:#1a2e05,stroke:#84cc16,color:#f7fee7,stroke-width:2px;
  classDef admin fill:#2e1065,stroke:#a855f7,color:#faf5ff,stroke-width:2px;
  classDef neutral fill:#111827,stroke:#475569,color:#e5e7eb;

  class Gate,Role entry;
  class StudentHome,Cart,Payment,StudentOrders,Queue,NutritionPage,PoolsPage,Feast student;
  class KitchenHome,Production,QRScan,MenuManage,KitchenAnalytics kitchen;
  class AdminHome,Users,AnalyticsPage,Restaurants,Settings admin;
```

---

## User Flow Gallery

### 1. Student Canteen Order

```mermaid
sequenceDiagram
  participant Student
  participant Client as React Client
  participant API as Express API
  participant DB as MongoDB
  participant Pay as Razorpay
  participant Kitchen as Kitchen Socket Room

  Student->>Client: Browse menu
  Client->>API: GET /api/menu
  API->>DB: Read menu, availability, daily stock
  DB-->>API: Menu payload
  API-->>Client: Optimized menu data

  Student->>Client: Add item
  Client->>API: POST /api/cart/hold
  API->>DB: Reserve item for hold window
  API-->>Client: Hold confirmed

  Student->>Client: Checkout
  Client->>API: POST /api/payments/create-order
  API->>Pay: Create payment order
  Pay-->>API: Payment order
  API-->>Client: Payment metadata

  Client->>API: POST /api/payments/verify
  API->>Pay: Verify signature
  API-->>Client: Payment verified

  Client->>API: POST /api/orders
  API->>DB: Create paid order, consume hold, compute ETA
  API->>Kitchen: Emit order:new
  API-->>Client: Order created
```

### 2. Kitchen Fulfillment

```mermaid
stateDiagram-v2
  [*] --> pending
  pending --> queued
  queued --> preparing
  preparing --> ready
  ready --> completed

  pending --> cancelled
  queued --> cancelled
  preparing --> cancelled

  completed --> [*]
  cancelled --> [*]
```

```mermaid
flowchart LR
  Made[Produced Stock] --> Allocate[Auto Allocation]
  Allocate --> Waiting[Waiting Orders]
  Waiting --> Ready[Ready when all items assigned]
  Ready --> QR[Student QR]
  QR --> Scan[Kitchen Scan]
  Scan --> Complete[Completed Pickup]
  Complete --> Notify[Student + Kitchen Updates]

  classDef hot fill:#220a05,stroke:#ff4714,color:#fff,stroke-width:2px;
  classDef green fill:#052e16,stroke:#22c55e,color:#ecfdf5,stroke-width:2px;
  class Made,Allocate,Waiting hot;
  class Ready,QR,Scan,Complete,Notify green;
```

### 3. Nutrition Ranking

```mermaid
flowchart TD
  Goals[Daily Goals] --> Meal[Meal Log]
  Image[Food Image] --> Cloudinary[Cloudinary Upload]
  Cloudinary --> Analyzer[Food Analysis]
  Analyzer --> Meal
  Manual[Manual Entry] --> Meal

  Meal --> Totals[Daily Totals]
  Totals --> Reports[Daily, Weekly, Monthly Views]
  Totals --> Score[Adherence + XP + Consistency]
  Score --> Badge[Badge Tier]
  Badge --> Rank[Nutrition Rank]

  classDef start fill:#111827,stroke:#ff4714,color:#fff,stroke-width:2px;
  classDef nutrition fill:#052e16,stroke:#22c55e,color:#ecfdf5,stroke-width:2px;
  classDef rank fill:#422006,stroke:#facc15,color:#fffbeb,stroke-width:2px;

  class Goals,Image,Manual start;
  class Cloudinary,Analyzer,Meal,Totals,Reports,Score nutrition;
  class Badge,Rank rank;
```

#### Nutrition Scoreboard

| Signal | Meaning | Weight or Rule |
| --- | --- | --- |
| Calories | Closeness to calorie goal | 35 percent |
| Protein | Progress toward protein target | 25 percent |
| Fiber | Progress toward fiber target | 15 percent |
| Carbs | Closeness to carb goal | 15 percent |
| Fat | Closeness to fat goal | 10 percent |
| Consistency | Valid day with meal data and 50 percent adherence | Counts toward badge days |
| XP | Logging and goal-hit activity points | Capped at 200 per day |

#### Badge Ladder

| Badge | Days | XP | Average Adherence |
| --- | ---: | ---: | ---: |
| Begin | 0 | 0 | 0 percent |
| Build | 14 | 1,000 | 60 percent |
| Balance | 28 | 2,500 | 65 percent |
| Steady | 50 | 5,000 | 70 percent |
| Aligned | 100 | 12,000 | 75 percent |
| Sustain | 200 | 28,000 | 80 percent |
| Thrive | 365 | 60,000 | 85 percent |

### 4. Outside Food Pooling

```mermaid
sequenceDiagram
  participant Owner as Broadcaster
  participant Member
  participant API as Outside Food API
  participant DB as MongoDB
  participant Room as Pool Socket Room

  Owner->>API: Create pool
  API->>DB: Save broadcaster, target, status
  API->>Room: pool:update

  Member->>API: Join open pool
  API->>DB: Save participant amount and note
  API->>Room: pool:participant-update

  Owner->>API: Lock pool
  API->>DB: status = LOCKED
  API->>Room: pool:lock

  Member->>API: Request locked access
  API->>DB: Save pending request
  API->>Room: pool:request-update

  Owner->>API: Accept or reject request
  API->>DB: Resolve request
  API->>Room: pool:update

  Owner->>API: Complete or archive
  API->>DB: Close pool
  API->>Room: pool:status-update
```

The creator is the broadcaster. The broadcaster sees **Created** in grey. Other members see **Joined** in green after they join.

---

## Feature Matrix

| Module | Student Surface | Kitchen/Admin Surface | Backend Brain |
| --- | --- | --- | --- |
| **Menu** | Search, categories, stock badges, nutrition preview | Create, edit, toggle, stock updates | `MenuItem`, upload middleware, stock reset jobs |
| **Cart** | Add, reduce, reserve item quantity | Cart hold duration control | `CartReservation`, cleanup worker |
| **Orders** | My Orders, active/completed states, QR pickup | Live board, item ready, status updates, QR scan | `Order`, queue service, ETA engine |
| **Payments** | Checkout with verified payment | Payment-backed order record | Razorpay order and signature verification |
| **Queue** | Live queue visibility | Kitchen summary and queue stats | Socket events and queue aggregation |
| **Nutrition** | Goals, logs, charts, analysis, ranks | Leaderboard visibility | `NutritionLog`, scoring engine, Cloudinary |
| **Pools** | Create, join, request, chat | Restaurant admin management | Pool service, participants, requests, chat messages |
| **Analytics** | Not exposed directly | Revenue, spend, cohorts, item sales | MongoDB aggregation and cache |

---

## Data Constellation

```mermaid
erDiagram
  USER ||--o{ ORDER : places
  USER ||--o{ NUTRITION_LOG : owns
  USER ||--o{ CART_RESERVATION : holds
  USER ||--o{ OUTSIDE_FOOD_POOL : broadcasts
  USER ||--o{ OUTSIDE_FOOD_PARTICIPANT : joins

  MENU_ITEM ||--o{ ORDER_ITEM : included_in
  MENU_ITEM ||--o{ CART_RESERVATION : reserved_by
  MENU_ITEM ||--o| KITCHEN_STOCK : tracks

  ORDER ||--o{ ORDER_ITEM : contains
  ORDER ||--o| PAYMENT : paid_by

  NUTRITION_LOG ||--o{ MEAL_ENTRY : contains

  OUTSIDE_FOOD_POOL ||--o{ OUTSIDE_FOOD_PARTICIPANT : has
  OUTSIDE_FOOD_POOL ||--o{ OUTSIDE_FOOD_JOIN_REQUEST : receives
  OUTSIDE_FOOD_POOL ||--o{ OUTSIDE_FOOD_CHAT_MESSAGE : contains
  OUTSIDE_FOOD_RESTAURANT ||--o{ OUTSIDE_FOOD_POOL : optional_source
```

| Collection | Why It Exists |
| --- | --- |
| `User` | Identity, role, auth provider, nutrition goals, profile data. |
| `MenuItem` | Canteen catalog, price, category, prep time, availability, nutrition, daily stock. |
| `CartReservation` | Temporary stock holds before payment and order creation. |
| `Order` | Paid orders, item snapshots, ETA, QR token hashes, status history. |
| `KitchenStock` | Produced quantity available for allocation and readiness. |
| `NutritionLog` | Daily meal entries and recalculated macro totals. |
| `OutsideFoodPool` | Broadcaster-owned pools with status, target amount, participants, and closure state. |
| `OutsideFoodParticipant` | Joined members, contribution notes, presence, and activity. |
| `OutsideFoodJoinRequest` | Pending requests for locked pools. |
| `OutsideFoodChatMessage` | Pool-room chat, system messages, and broadcaster updates. |
| `OutsideFoodRestaurant` | Admin-managed discovery records for Find Your Feast. |
| `Settings` | Canteen live state and cart timing configuration. |

---

## Tech Stack

### Frontend Deck

| Layer | Stack |
| --- | --- |
| Core UI | **React 19**, component-driven pages, route-level lazy loading |
| Build | **Vite 6**, manual chunk splitting, fast production bundles |
| Routing | **React Router 7** with role-protected page trees |
| Styling | **Tailwind CSS 4**, custom CSS tokens, glass surfaces, dark/light theme variables |
| API | **Axios** with JWT request interceptor and 401 handling |
| Realtime | **Socket.IO Client** for order, queue, stock, and pool events |
| Charts | **Recharts**, lazy-loaded for nutrition visualizations |
| Forms | **React Hook Form**, **Zod**, controlled inputs where tighter state is needed |
| Icons | **React Icons**, **Lucide React** |
| Feedback | **React Hot Toast** |
| Performance | Memoized menu cards, cached menu data, incremental rendering, lazy modal chart code |

### Backend Core

| Layer | Stack |
| --- | --- |
| API | **Node.js**, **Express** |
| Database | **MongoDB Atlas**, **Mongoose** schemas and indexes |
| Auth | **JWT**, **bcryptjs**, Google OAuth, OTP email registration |
| Realtime | **Socket.IO** rooms for users, kitchen, pool rooms, and lobby updates |
| Payments | **Razorpay** order creation and signature verification |
| Images | **Multer**, **Cloudinary Storage**, Cloudinary transformations |
| Email | **Nodemailer** service for OTP delivery |
| Validation | **Zod** and explicit controller guards |
| Security | Role middleware, protected routes, hashed passwords, QR token hashing |
| Analytics | MongoDB aggregation pipelines with short-lived cache |

### Platform Services

| Service | Used For |
| --- | --- |
| MongoDB Atlas | Persistent application data |
| Cloudinary | Menu and nutrition image storage |
| Razorpay | Payment order creation and verification |
| Socket.IO | Realtime state propagation |
| Email SMTP | OTP delivery |

---

## Realtime Mesh

```mermaid
flowchart TD
  Socket[Socket.IO Server] --> UserRoom[user:<userId>]
  Socket --> KitchenRoom[kitchen]
  Socket --> PoolRoom[pool:<poolId>]
  Socket --> Lobby[outside-food:lobby]

  UserRoom --> StudentEvents[order-update, eta-update, order:statusChanged]
  KitchenRoom --> KitchenEvents[order:new, queue-stats, kitchen:summary]
  PoolRoom --> PoolEvents[pool:message, pool:status, pool:request-update]
  Lobby --> PoolListEvents[pool:update, pool:participant-update, pool:expired]

  classDef socket fill:#160b05,stroke:#ff4714,color:#fff,stroke-width:2px;
  classDef room fill:#111827,stroke:#38bdf8,color:#eff6ff,stroke-width:2px;
  classDef event fill:#052e16,stroke:#22c55e,color:#ecfdf5,stroke-width:2px;

  class Socket socket;
  class UserRoom,KitchenRoom,PoolRoom,Lobby room;
  class StudentEvents,KitchenEvents,PoolEvents,PoolListEvents event;
```

Realtime is used only where the product genuinely needs immediacy: kitchen operations, student order status, ETA changes, menu stock updates, queue summaries, and pool coordination.

---

## Reliability Notes

| Concern | UniFeast Handling |
| --- | --- |
| Overselling stock | Cart holds reserve stock before payment, then order creation consumes reservations. |
| Duplicate payment submissions | Order creation is idempotent by user and Razorpay payment id. |
| Pickup trust | QR payloads use lookup and secret values, with hashes stored server-side. |
| Expired state | Cart holds, daily stocks, and stale outside-food pools have cleanup jobs. |
| Analytics latency | Admin stats are cached briefly by selected date range. |
| Heavy frontend bundles | Route lazy loading, exact manual chunks, and lazy nutrition chart loading reduce first-load cost. |
| Future nutrition dates | Backend blocks future daily log reads. |

## Security Guardrails

| Layer | Protection |
| --- | --- |
| Identity | JWT sessions, bcrypt password hashing, Google OAuth support |
| Registration | OTP verification and institution email checks |
| Roles | Student, kitchen, and admin authorization on protected API routes |
| Payments | Razorpay signature verification before order creation |
| Uploads | Image-only Cloudinary upload pipeline with size limits |
| QR | Hashed token lookup and secret verification |
| Admin | User management, restaurants, analytics, and settings are role-restricted |

---

## Product Pulse

```mermaid
flowchart LR
  Menu[Menu Discovery] --> Hold[Stock Hold]
  Hold --> Pay[Verified Payment]
  Pay --> Order[Order]
  Order --> Queue[Queue + ETA]
  Queue --> Kitchen[Kitchen Fulfillment]
  Kitchen --> Pickup[QR Pickup]
  Pickup --> History[Order History]

  Order --> Nutrition[Meal Context]
  Nutrition --> Badge[Badge + XP]
  Badge --> Rank[Leaderboard]

  Menu --> Pool[Campus Pools]
  Pool --> Chat[Pool Chat]
  Chat --> Coordinate[Group Coordination]

  classDef orange fill:#220a05,stroke:#ff4714,color:#fff,stroke-width:2px;
  classDef green fill:#052e16,stroke:#22c55e,color:#ecfdf5,stroke-width:2px;
  classDef blue fill:#082f49,stroke:#38bdf8,color:#f0f9ff,stroke-width:2px;
  classDef violet fill:#2e1065,stroke:#a855f7,color:#faf5ff,stroke-width:2px;

  class Menu,Hold,Pay,Order,Queue,Kitchen,Pickup,History orange;
  class Nutrition,Badge,Rank green;
  class Pool,Chat,Coordinate blue;
```

## Design Identity

UniFeast is designed like a compact operations console with a warm campus dining personality:

| Token | Product Feeling |
| --- | --- |
| Orange primary | Appetite, action, checkout, and high-priority operations. |
| Dark glass surfaces | Focused dashboard feel for repeated daily use. |
| Green live states | Canteen live, available stock, successful status, and ready signals. |
| Compact cards | Dense information without making students or staff scroll through noise. |
| Realtime badges | Clear state changes for orders, pools, queue, and availability. |

## Why UniFeast Matters

UniFeast is not just a menu screen. It models the real loop of campus dining:

- Students know what is available before they pay.
- Kitchen staff see what is waiting, what is ready, and what has been produced.
- Admins get reporting tied to real students, orders, BTID signals, and spending patterns.
- Nutrition tracking becomes part of the actual food journey instead of a disconnected tracker.
- Outside-food pooling gets ownership, joining, approval, chat, and closure.

The result is one connected dining system where ordering, operations, analytics, nutrition, and community pooling share the same identity layer and realtime backbone.

