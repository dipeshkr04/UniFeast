# 🍽️ UniFeast Project - Developer Assignment Package

**Ready for 2-Developer Team Assignment**  
**Analysis Date**: April 5, 2026  
**Project Status**: 60% Complete - Ready for Implementation Sprint  

---

## 📖 DOCUMENTATION INDEX

You've been assigned to work on **UniFeast** - a MERN-based smart campus food ordering system with real-time queue management and collaborative pooling features.

### 📚 Read These Documents IN THIS ORDER:

1. **⭐ START HERE: [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md)** (10 min read)
   - Quick overview of the project
   - Feature completion status
   - Work split between 2 developers
   - Timeline & success criteria
   - **READ THIS FIRST**

2. **📊 [PROJECT_STATUS_ANALYSIS.md](PROJECT_STATUS_ANALYSIS.md)** (20-30 min read)
   - Detailed feature breakdown (what works, what's partial, what's missing)
   - Status for each of the 6 core features
   - Work distribution explained with priorities
   - Blocking dependencies identified
   - **Know the complete picture**

3. **🚀 [IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)** (30-40 min read per dev)
   - YOUR SPECIFIC TASKS for the next 4 weeks
   - Sprint-by-sprint breakdown
   - File locations and code snippets
   - Acceptance criteria for each task
   - Testing strategies
   - **YOUR DETAILED WORK PLAN**

4. **⚡ [QUICK_REFERENCE.md](QUICK_REFERENCE.md)** (Bookmark this!)
   - Commands & API endpoint quick lookup
   - Common pitfalls & fixes
   - Component tree diagrams
   - Testing procedures
   - **Keep open while coding**

5. **🌿 [GIT_WORKFLOW_GUIDE.md](GIT_WORKFLOW_GUIDE.md)** (15-20 min read)
   - Branch creation & naming
   - Step-by-step PR process
   - Commit best practices
   - Merge conflict resolution
   - Daily git checklist
   - **Reference for version control**

6. **📋 [DEVELOPER_WEEKLY_PLANNER.md](DEVELOPER_WEEKLY_PLANNER.md)** (Print this!)
   - Week-by-week task breakdown
   - Daily hours allocation
   - Success checklist for each week
   - Stand-up template
   - **Print & put on your desk**

---

## 🎯 QUICK START (Next 60 Minutes)

### For Everyone
```bash
# 1. Read EXECUTIVE_SUMMARY.md (10 min)
# 2. Create .env file with credentials from tech lead (5 min)
# 3. Install dependencies (15 min):
cd server && npm install
cd ../client && npm install

# 4. Verify setup (10 min):
npm run dev  # both terminals
http://localhost:5173  # test in browser

# 5. Seed database (5 min):
cd server && npm run seed

# 6. Create your branch (15 min):
git checkout dev && git pull
git checkout -b feature/[your-task]
git push -u origin feature/[your-task]
```

### For Developer 1 (Backend)
- Read: IMPLEMENTATION_ROADMAP.md → Sprint 1 Backend sections
- Start: Enhance `server/controllers/orderController.js`
- Branch: `feature/backend-order-flow`

### For Developer 2 (Frontend)
- Read: IMPLEMENTATION_ROADMAP.md → Sprint 1 Frontend sections
- Start: Create `client/src/pages/CartPage.jsx`
- Branch: `feature/frontend-cart-orders`

---

## 🏗️ PROJECT ARCHITECTURE

```
MERN Stack + Socket.io + Redis

Frontend                Backend              Database
=========               =======              ========
React + Tailwind  →  Express.js App  →  MongoDB
Socket.io Client  →  Socket.io Server →  Redis (locks)
Vite Dev Server   →  Port 5000         Mongoose ODM
Port 5173         →  Node.js Runtime    JWT Auth
```

### Key Technologies
- **Frontend**: React 19, Tailwind CSS, Axios, Socket.io-client, Recharts
- **Backend**: Express.js, Socket.io, Mongoose, JWT, Bcrypt
- **Database**: MongoDB, Redis
- **File Upload**: Multer + Cloudinary
- **Build**: Vite (frontend), Node (backend)

---

## 📊 FEATURE STATUS AT A GLANCE

### ✅ Fully Complete (95%+)
- User authentication & authorization
- Database models (User, MenuItem, Order, Pool, NutritionLog)
- Queue calculation engine (M/M/c Erlang-C formula)
- Socket.io infrastructure
- Basic API routes

### 🟡 Partially Complete (40-70%)
- Menu browsing UI
- Kitchen dashboard
- Nutrition tracking
- Real-time features (structure only)
- Order creation (missing pool integration)

### ❌ Not Started (0%)
- **CartPage** - critical user flow
- **OrdersPage** - critical user flow
- **PoolsPage** - pool discovery & joining UI
- **ETA countdown component** - real-time ticker
- **MenuManagePage** - admin menu management
- **Photo upload** - for nutrition logging
- Error handling in controllers
- Admin user management

---

## 👥 WORK DISTRIBUTION

### Developer 1: Backend (Order & Pool Logic)
**Focus**: Order creation, pool consolidation, ETA recalculation, real-time broadcasts

**Weekly Timeline**:
- Week 1: Order + pool integration
- Week 2: Consolidation + ETA broadcasting
- Week 3: Nutrition auto-logging + polish
- Week 4: Code review + final touches

**Key Files**:
- `server/controllers/orderController.js`
- `server/utils/queueEngine.js`
- `server/utils/poolEngine.js`
- `server/config/lockManager.js`

---

### Developer 2: Frontend (UI & Real-Time)
**Focus**: User pages, real-time components, dashboard UIs

**Weekly Timeline**:
- Week 1: CartPage + OrdersPage + ETA ticker
- Week 2: PoolsPage + Socket.io integration
- Week 3: MenuManagePage + Nutrition enhancements + Admin
- Week 4: Polish + responsive testing

**Key Files**:
- `client/src/pages/CartPage.jsx`
- `client/src/pages/OrdersPage.jsx`
- `client/src/pages/PoolsPage.jsx`
- `client/src/components/ETATimer.jsx`

---

## 🔄 CRITICAL INTEGRATION POINTS

```
Dev 1 Completes              Dev 2 Uses For
================              ==============
Order creation API        →   CartPage checkout
Pool consolidation        →   Pool UI updates
ETA recalculation         →   ETA countdown display
Socket broadcasts         →   Real-time listeners
Nutrition auto-logging    →   Nutrition page display
Menu CRUD endpoints       →   MenuManagePage forms
Admin settings endpoints  →   AdminDashboard controls
```

**Strategy**: Both work in parallel. Dev 2 uses mock APIs initially, integrates real APIs as Dev 1 completes endpoints.

---

## 🔗 EXTERNAL DEPENDENCIES

### You Need From Tech Lead:
```
MongoDB Connection String (Atlas or local)
Redis URL (for distributed locks)
JWT Secret (32+ character random string)
Cloudinary Credentials (sign up free: cloudinary.com)
GitHub repo access & branch permissions
```

### Create `.env` file at project root:
```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key-min-32-chars
CLIENT_URL=http://localhost:5173
REDIS_URL=redis://localhost:6379
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
PORT=5000
NODE_ENV=development
```

---

## 📅 4-WEEK TIMELINE

```
WEEK 1: Foundation Weeks
├─ Dev 1: Order + pool joining logic
└─ Dev 2: CartPage + OrdersPage + ETA component
  Status: Basic order flow working

WEEK 2: Real-Time Integration
├─ Dev 1: Pool consolidation + ETA recalculation
└─ Dev 2: PoolsPage + Socket listeners
  Status: Pooling works, real-time features functional

WEEK 3: Refinement
├─ Dev 1: Nutrition auto-logging + error handling
└─ Dev 2: MenuManagePage + Admin + photo upload
  Status: All planned features implemented

WEEK 4: Polish & Testing
├─ Dev 1: Performance optimization + code review
└─ Dev 2: Responsive design + final testing
  Status: Production-ready codebase
```

---

## ✅ SUCCESS METRICS

### By End of Week 1
- [x] Orders can be created and retrieved
- [x] CartPage displays items and calculates totals
- [x] Real-time checkout flow works (may use mock)

### By End of Week 2
- [x] Pools close automatically and consolidate
- [x] PoolsPage shows available pools
- [x] ETA updates live on screen

### By End of Week 3
- [x] All features implemented
- [x] No major bugs in happy path
- [x] Responsive on mobile (360px)

### By End of Week 4
- [x] Production-ready code
- [x] All edge cases handled
- [x] Documentation complete

---

## 🚀 DAILY WORKFLOW

### Morning (Start of Day)
```bash
# 1. Pull latest changes from dev
git checkout dev && git pull origin dev

# 2. Switch to your feature branch
git checkout feature/[your-branch]

# 3. Rebase on latest dev (optional but recommended)
git rebase dev

# 4. Start work
npm run dev
```

### Throughout Day
- Make small, logical commits (not 1 giant commit)
- Push every 2-3 commits
- Run linter: `npm run lint`
- Test locally before each commit

### End of Day
```bash
# 1. Push your work
git push origin feature/[your-branch]

# 2. Post status in team chat
"Completed X, working on Y, no blockers"

# 3. Next morning, create PR if task done
```

---

## 🧪 TESTING APPROACH

### Backend (Dev 1)
- Use Postman or cURL to test APIs
- Test with concurrent requests (50+ users)
- Verify database state after operations
- No console.log() in final code

### Frontend (Dev 2)
- Run `npm run lint` to catch errors
- Test on multiple viewport sizes (360px, 768px, 1920px)
- Check React DevTools for warnings
- No console errors before PR

### Integration
- Run end-to-end flows weekly
- Cross-dev code review on PRs
- Manual testing on multiple devices

---

## 📞 GETTING HELP

### If Blocked
1. Check relevant documentation (usually in QUICK_REFERENCE.md)
2. Search codebase for similar patterns
3. Ask other developer (5 min chat)
4. Post in team channel with:
   - What you're trying to do
   - What the error is
   - What you've already tried

### Common Issues & Solutions
See [QUICK_REFERENCE.md](QUICK_REFERENCE.md#-common-pitfalls--fixes) for common pitfalls

### Escalation Path
1. Other developer (peer help)
2. Tech lead (architectural questions)
3. Project manager (timeline issues)

---

## 📋 DOCUMENT PURPOSES

| Document | Purpose | When to Read |
|----------|---------|--------------|
| EXECUTIVE_SUMMARY | Overview & timeline | Start here |
| PROJECT_STATUS_ANALYSIS | Complete feature breakdown | Week 1 |
| IMPLEMENTATION_ROADMAP | Your specific tasks | Before each sprint |
| QUICK_REFERENCE | Commands & troubleshooting | While coding |
| GIT_WORKFLOW_GUIDE | Git procedures | First commit |
| DEVELOPER_WEEKLY_PLANNER | Task breakdown & tracking | Print it! |

---

## 🎯 KEY FILES YOU'LL MODIFY

### Backend (Dev 1)
```
server/
├── controllers/orderController.js        ← PRIORITY
├── utils/queueEngine.js                 ← PRIORITY
├── utils/poolEngine.js                  ← PRIORITY
├── config/lockManager.js                ← PRIORITY
├── utils/socketHandler.js
├── middleware/validate.js               ← CREATE
└── middleware/errorHandler.js           ← ENHANCE
```

### Frontend (Dev 2)
```
client/src/
├── pages/CartPage.jsx                   ← CREATE (PRIORITY)
├── pages/OrdersPage.jsx                 ← CREATE (PRIORITY)
├── pages/PoolsPage.jsx                  ← CREATE
├── pages/MenuManagePage.jsx             ← CREATE
├── components/ETATimer.jsx              ← CREATE (CRITICAL)
├── components/PoolCard.jsx              ← CREATE
├── contexts/SocketContext.jsx           ← ENHANCE
└── pages/AdminDashboard.jsx             ← ENHANCE
```

---

## 🚨 CRITICAL RULES

1. **NEVER force push to `dev` or `main`**
2. **ALWAYS test locally before committing**
3. **Test concurrency for pool operations**
4. **No console.log() in production code**
5. **Commit messages must be descriptive**
6. **Code review before merge**
7. **Daily standup on progress**

---

## 💡 SUCCESS TIPS

### For Developers
- **Read before coding** — understand context first
- **Commit often** — small logical chunks
- **Test continuously** — hourly, not at end
- **Communicate early** — ask about dependencies
- **Document as you go** — helps future you

### For the Team
- **15-min daily standup** — keep momentum
- **PR review same day** — don't block teammate
- **Pair on blockers** — solve together
- **Celebrate wins** — stay motivated
- **Weekly retrospective** — improve process

---

## 📞 TEAM CONTACT TEMPLATE

**Daily Standup (10 min)**:
```
Dev 1: "Done: [task], Doing: [task], Blockers: [none/X]"
Dev 2: "Done: [task], Doing: [task], Blockers: [none/X]"
→ Sync time: [yes/no]
```

**PR Merge Check**:
```
Reviewer: ✅ Approved or ❌ Request changes (with comments)
Merge: [yes/no]
Blocker: [none/X]
```

**Escalation**:
```
Issue: [What]
Blocker: [Why it matters]
Tried: [What you tried]
Need: [Decision needed]
Timeline: [Urgent/Can wait]
```

---

## 🎓 LEARNING RESOURCES

### API & Architecture
- MongoDB: https://mongoosejs.com/
- Express: https://expressjs.com/
- Socket.io: https://socket.io/docs/

### React & Frontend
- React Hooks: https://react.dev/
- Tailwind CSS: https://tailwindcss.com/
- Axios: https://axios-http.com/

### Queue Theory (for Dev 1)
- Erlang-C: Wikipedia M/M/c Queue
- Queue Models: https://outmatcher.com

---

## ✨ NEXT STEPS (DO THIS NOW!)

### 📝 Preparation (30 min)
- [ ] Read EXECUTIVE_SUMMARY.md
- [ ] Read IMPLEMENTATION_ROADMAP.md (your role's section)
- [ ] Skim QUICK_REFERENCE.md
- [ ] Bookmark GIT_WORKFLOW_GUIDE.md
- [ ] Print DEVELOPER_WEEKLY_PLANNER.md

### ⚙️ Setup (30 min)
- [ ] Get .env credentials from tech lead
- [ ] Install dependencies: `npm install` (both folders)
- [ ] Run dev server: `npm run dev`
- [ ] Seed database: `npm run seed`
- [ ] Test browser access: `http://localhost:5173`

### 🌿 Git Initialization (15 min)
- [ ] Configure git (name, email)
- [ ] Create your feature branch
- [ ] Make first commit: "chore: initialize working branch"
- [ ] Push to origin

### 🚀 Start Coding (5 min)
- [ ] Dev 1: Open orderController.js, read existing code
- [ ] Dev 2: Create CartPage.jsx skeleton
- [ ] Both: Join team standup at [scheduled time]

---

## 📊 PROJECT DASHBOARD

### Real-Time Status
```
Project: UniFeast - Campus Food Pooling
Status: IN PROGRESS - Implementation Sprint
Phase: 2/3 (Development)
Deadline: May 5, 2026 (4 weeks)

Team:
├─ Dev 1 (Backend): [Name]  
├─ Dev 2 (Frontend): [Name]
└─ Tech Lead: [Name]

Progress:
├─ Week 1: 0% (Just starting)
├─ Week 2: 25%
├─ Week 3: 50%
└─ Week 4: 100% (Complete)
```

---

## 🎊 YOU'RE READY!

Everything you need is documented. Time to build something amazing! 

**Questions?** Check the relevant document first. Can't find it? Documented in this README.

**Let's go ship UniFeast! 🚀**

---

**Assignment Package Version**: 1.0  
**Last Updated**: April 5, 2026  
**For Support**: Refer to the 6 documentation files provided  

**Good luck, devs! Make this project 🔥**
