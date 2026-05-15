# UniFeast Database Relationship Architecture

## 1. Complete Entity List

### Mongo Collections

- `User`
- `MenuItem`
- `Order`
- `Payment`
- `Pool`
- `NutritionLog`
- `KitchenStock`
- `CartReservation`
- `Settings`
- `OutsideFoodRestaurant`
- `OutsideFoodPool`
- `OutsideFoodParticipant`
- `OutsideFoodJoinRequest`
- `OutsideFoodChatMessage`

### Embedded Child Entities

- `OrderItem`
- `OrderStatusHistory`
- `PoolMember`
- `NutritionMealEntry`

### Embedded Value Objects

- `Order.userSnapshot`
- `MenuItem.nutrition`
- `MenuItem.dailyStock`
- `NutritionLog.dailyTotals`
- `Payment.price`

### Non-Persistent Dependencies

- JWT auth cookie
- Register OTP in-memory map
- Redis queue: `kitchen:queue`
- Redis idempotency keys: `idempotency:<key>`
- Socket presence maps

## 2. Master Database Relationship Diagram

```mermaid
erDiagram
  USER {
    ObjectId _id PK
    String name
    String email UK
    String password
    String authProvider
    String googleId
    String role
    String avatarUrl
    Number dailyCalorieGoal
    Number dailyProteinGoal
    Number dailyCarbGoal
    Number dailyFatGoal
    Number dailyFiberGoal
    Number nutritionStreak
    String lastLoggedDate
    Date createdAt
    Date updatedAt
  }

  MENU_ITEM {
    ObjectId _id PK
    String name
    String description
    Number price
    String category
    String imageUrl
    Number prepTime
    Number batchCapacity
    Number batchPrepTime
    Number batchBufferMinutes
    Number maxOrder
    Boolean isAvailable
    Object nutrition
    Object dailyStock
    String[] tags
    Date createdAt
    Date updatedAt
  }

  ORDER {
    ObjectId _id PK
    ObjectId user FK
    Object userSnapshot
    Number totalAmount
    String razorpayPaymentId "logical FK to PAYMENT.paymentId"
    String qrTokenHash
    String qrTokenLookup
    Date qrIssuedAt
    String status
    Boolean isPooled
    Number estimatedTime
    Date estimatedReadyAt
    Date startedAt
    Date preparedAt
    Date completedAt
    Number actualCompletionTime
    String specialInstructions
    Date createdAt
    Date updatedAt
  }

  ORDER_ITEM {
    ObjectId _id PK
    ObjectId menuItem FK
    ObjectId poolId FK
    String name
    Number price
    String imageUrl
    String category
    Number batchCapacity
    Number batchPrepTime
    Number batchBufferMinutes
    Number quantity
    Number assignedReadyQty
  }

  ORDER_STATUS_HISTORY {
    ObjectId _id PK
    String status
    Date timestamp
  }

  PAYMENT {
    ObjectId _id PK
    ObjectId user FK
    String orderId "Razorpay order id"
    String paymentId "Razorpay payment id"
    String signature
    Object price
    String status
    Date createdAt
    Date updatedAt
  }

  POOL {
    ObjectId _id PK
    ObjectId menuItem FK
    String status
    Number maxSize
    Number currentSize
    Number totalQuantity
    Number pricePerUnit
    Number savingsPercent
    Date closesAt
    Date closedAt
    ObjectId consolidatedOrder FK
    Date createdAt
    Date updatedAt
  }

  POOL_MEMBER {
    ObjectId _id PK
    ObjectId user FK
    ObjectId order FK
    Number quantity
    Date joinedAt
  }

  NUTRITION_LOG {
    ObjectId _id PK
    ObjectId user FK
    String date "unique with user"
    Object dailyTotals
    Date createdAt
    Date updatedAt
  }

  NUTRITION_MEAL_ENTRY {
    ObjectId _id PK
    ObjectId menuItem FK
    String customName
    Number calories
    Number protein
    Number carbs
    Number fat
    Number fiber
    Number quantity
    String mealType
    String imageUrl
    Boolean isAutoLogged
    Date loggedAt
  }

  KITCHEN_STOCK {
    ObjectId _id PK
    ObjectId menuItem FK_UK
    Number madeQuantity
    Date createdAt
    Date updatedAt
  }

  CART_RESERVATION {
    ObjectId _id PK
    ObjectId user FK
    ObjectId menuItem FK
    Number quantity
    String dayKey
    Date expiresAt
    Date createdAt
    Date updatedAt
  }

  SETTINGS {
    ObjectId _id PK
    String key UK
    Mixed value
    ObjectId updatedBy FK
    Date updatedAt
  }

  OUTSIDE_FOOD_RESTAURANT {
    ObjectId _id PK
    String name
    String image
    String[] cuisineTags
    Number minPoolAmount
    String estimatedDeliveryTime
    String orderWindow
    String location
    String contactNumber
    String menuLink
    String whatsappLink
    String[] pickupPoints
    Boolean active
    ObjectId createdByAdmin FK
    Date createdAt
    Date updatedAt
  }

  OUTSIDE_FOOD_POOL {
    ObjectId _id PK
    ObjectId restaurantId FK
    ObjectId broadcaster FK
    String category
    String title
    String status
    Number targetAmount
    Number currentAmount
    Number participantCount
    ObjectId[] participants FK
    Date opensAt
    Date closesAt
    Date unlockAt
    Date graceClosesAt
    Date lockedAt
    ObjectId[] coordinators FK
    Date coordinatorLastActiveAt
    Date coordinationConfirmedAt
    String pickupPoint
    Boolean archived
    ObjectId createdByAdmin FK
    Date createdAt
    Date updatedAt
  }

  OUTSIDE_FOOD_PARTICIPANT {
    ObjectId _id PK
    ObjectId poolId FK
    ObjectId userId FK
    Number intendedAmount
    String orderPreview
    Date joinedAt
    Number messageCount
    Date lastActiveAt
    Boolean online
    Date createdAt
    Date updatedAt
  }

  OUTSIDE_FOOD_JOIN_REQUEST {
    ObjectId _id PK
    ObjectId poolId FK
    ObjectId userId FK
    Number intendedAmount
    String orderPreview
    String status
    Date resolvedAt
    ObjectId resolvedBy FK
    Date createdAt
    Date updatedAt
  }

  OUTSIDE_FOOD_CHAT_MESSAGE {
    ObjectId _id PK
    ObjectId poolId FK
    ObjectId senderId FK
    String type
    String content
    Date timestamp
  }

  USER ||--o{ ORDER : places
  USER ||--o{ PAYMENT : pays
  PAYMENT ||--o| ORDER : "paymentId to razorpayPaymentId"

  ORDER ||--|{ ORDER_ITEM : embeds
  ORDER ||--|{ ORDER_STATUS_HISTORY : audits
  MENU_ITEM ||--o{ ORDER_ITEM : ordered_as

  MENU_ITEM ||--o{ POOL : pooled_item
  POOL ||--|{ POOL_MEMBER : embeds
  USER ||--o{ POOL_MEMBER : joins
  ORDER ||--o{ POOL_MEMBER : member_order
  POOL ||--o| ORDER : consolidatedOrder
  POOL ||--o{ ORDER_ITEM : poolId

  USER ||--o{ NUTRITION_LOG : owns
  NUTRITION_LOG ||--|{ NUTRITION_MEAL_ENTRY : embeds
  MENU_ITEM ||--o{ NUTRITION_MEAL_ENTRY : logged_food

  MENU_ITEM ||--o| KITCHEN_STOCK : made_stock
  USER ||--o{ CART_RESERVATION : holds
  MENU_ITEM ||--o{ CART_RESERVATION : reserved_item
  USER ||--o{ SETTINGS : updatedBy

  USER ||--o{ OUTSIDE_FOOD_RESTAURANT : createdByAdmin
  OUTSIDE_FOOD_RESTAURANT ||--o{ OUTSIDE_FOOD_POOL : hosts
  USER ||--o{ OUTSIDE_FOOD_POOL : broadcaster
  USER ||--o{ OUTSIDE_FOOD_POOL : createdByAdmin
  USER }o--o{ OUTSIDE_FOOD_POOL : coordinators

  OUTSIDE_FOOD_POOL ||--o{ OUTSIDE_FOOD_PARTICIPANT : poolId
  USER ||--o{ OUTSIDE_FOOD_PARTICIPANT : userId
  OUTSIDE_FOOD_POOL }o--o{ OUTSIDE_FOOD_PARTICIPANT : participants_refs

  OUTSIDE_FOOD_POOL ||--o{ OUTSIDE_FOOD_JOIN_REQUEST : poolId
  USER ||--o{ OUTSIDE_FOOD_JOIN_REQUEST : userId
  USER ||--o{ OUTSIDE_FOOD_JOIN_REQUEST : resolvedBy

  OUTSIDE_FOOD_POOL ||--o{ OUTSIDE_FOOD_CHAT_MESSAGE : poolId
  USER ||--o{ OUTSIDE_FOOD_CHAT_MESSAGE : senderId
```

## 3. FK and Unique Mapping

| Source | Target | Type |
|---|---|---|
| `Order.user` | `User._id` | FK |
| `Order.items.menuItem` | `MenuItem._id` | FK in embedded array |
| `Order.items.poolId` | `Pool._id` | FK in embedded array |
| `Order.razorpayPaymentId` | `Payment.paymentId` | Logical string FK |
| `Payment.user` | `User._id` | FK |
| `Pool.menuItem` | `MenuItem._id` | FK |
| `Pool.members.user` | `User._id` | FK in embedded array |
| `Pool.members.order` | `Order._id` | FK in embedded array |
| `Pool.consolidatedOrder` | `Order._id` | FK |
| `NutritionLog.user` | `User._id` | FK |
| `NutritionLog.meals.menuItem` | `MenuItem._id` | FK in embedded array |
| `KitchenStock.menuItem` | `MenuItem._id` | FK + unique |
| `CartReservation.user` | `User._id` | FK |
| `CartReservation.menuItem` | `MenuItem._id` | FK |
| `Settings.updatedBy` | `User._id` | FK |
| `OutsideFoodRestaurant.createdByAdmin` | `User._id` | FK |
| `OutsideFoodPool.restaurantId` | `OutsideFoodRestaurant._id` | FK |
| `OutsideFoodPool.broadcaster` | `User._id` | FK |
| `OutsideFoodPool.createdByAdmin` | `User._id` | FK |
| `OutsideFoodPool.coordinators[]` | `User._id` | FK array |
| `OutsideFoodPool.participants[]` | `OutsideFoodParticipant._id` | FK array |
| `OutsideFoodParticipant.poolId` | `OutsideFoodPool._id` | FK |
| `OutsideFoodParticipant.userId` | `User._id` | FK |
| `OutsideFoodJoinRequest.poolId` | `OutsideFoodPool._id` | FK |
| `OutsideFoodJoinRequest.userId` | `User._id` | FK |
| `OutsideFoodJoinRequest.resolvedBy` | `User._id` | FK |
| `OutsideFoodChatMessage.poolId` | `OutsideFoodPool._id` | FK |
| `OutsideFoodChatMessage.senderId` | `User._id` | FK |

### Unique / Key Indexes

- `User.email` unique
- `Settings.key` unique
- `KitchenStock.menuItem` unique
- `CartReservation(user, menuItem)` unique
- `NutritionLog(user, date)` unique
- `Payment(user, orderId)` indexed
- `Payment(user, paymentId)` indexed
- `Order.razorpayPaymentId` unique partial index
- `Order(user, razorpayPaymentId)` indexed
- `OutsideFoodParticipant(poolId, userId)` unique
- `OutsideFoodJoinRequest(poolId, userId, status)` unique for `PENDING`

## 4. Transactional Dependency Chains

```text
User
  -> Payment
  -> Order
  -> OrderItem
  -> MenuItem
```

```text
User
  -> CartReservation
  -> MenuItem.dailyStock
  -> Order
  -> consume CartReservation
```

```text
Order.status = completed
  -> KitchenStock decrement
  -> NutritionLog auto meal insert
```

```text
MenuItem
  -> KitchenStock
  -> CartReservation
  -> OrderItem
  -> NutritionMealEntry
```

```text
OutsideFoodRestaurant
  -> OutsideFoodPool
  -> OutsideFoodParticipant
  -> OutsideFoodJoinRequest
  -> OutsideFoodChatMessage
```

```text
Settings
  -> canteen_live
  -> cart_hold_ms
```

## 5. Module To Table Interactions

| Module | Tables / Collections |
|---|---|
| `authController` | `User` |
| `paymentController` | `Payment`, `User` |
| `orderController` | `Order`, `MenuItem`, `Payment`, `Settings`, `KitchenStock`, `NutritionLog`, `CartReservation` |
| `orderStatusController` | `Order`, `KitchenStock`, `NutritionLog` |
| `menuController` | `MenuItem` |
| `cartController`, `cartReservations` | `CartReservation`, `MenuItem`, `Settings` |
| `nutritionController` | `NutritionLog`, `User`, `MenuItem` |
| `poolController`, `poolEngine` | `Pool`, `Order`, `MenuItem`, `User` |
| `outsideFoodController`, `outsideFood.service` | `OutsideFoodRestaurant`, `OutsideFoodPool`, `OutsideFoodParticipant`, `OutsideFoodJoinRequest`, `OutsideFoodChatMessage`, `User` |
| `adminController` | `User`, `Order`, `Settings` |
| `queueEngine` | `Order` |
| `leaderboardEngine` | `NutritionLog`, `User` |
