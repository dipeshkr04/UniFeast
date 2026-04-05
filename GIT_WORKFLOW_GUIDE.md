# UniFeast Git Branch & Team Workflow Guide

## 📦 Repository Structure

```
unifeast/
├── main                              # Production (deploy from here)
├── dev                               # Integration branch (stable development)
├── feature/backend-*                 # Developer 1 feature branches
├── feature/frontend-*                # Developer 2 feature branches
├── bugfix/*
└── release/*
```

---

## 🌳 BRANCH HIERARCHY & NAMING CONVENTION

### Main Branches (Protected)
```
main
  └─ Can only merge via PR with CI passing
  └─ Represents production-ready code
  └─ Tagged with version (v1.0.0, etc)

dev (Integration)
  └─ Always working, not production
  └─ All feature branches merge here
  └─ Ready for QA testing
```

### Feature Branches (Developer 1 - Backend)
```
feature/backend-order-flow
  ├─ Branch from: dev
  ├─ Merges to: dev
  ├─ Scope: Order creation with pool checking
  └─ Status: Days 1-5
  
feature/backend-pool-consolidation
  ├─ Branch from: dev
  ├─ Merges to: dev
  ├─ Scope: Pool closing and order merging
  └─ Status: Days 6-10
  
feature/backend-eta-realtime
  ├─ Branch from: dev
  ├─ Merges to: dev
  ├─ Scope: Real-time ETA updates and broadcasts
  └─ Status: Days 11-15
```

### Feature Branches (Developer 2 - Frontend)
```
feature/frontend-cart-orders
  ├─ Branch from: dev
  ├─ Merges to: dev
  ├─ Scope: CartPage & OrdersPage components
  └─ Status: Days 1-5

feature/frontend-pools-page
  ├─ Branch from: dev
  ├─ Merges to: dev
  ├─ Scope: PoolsPage & pool components
  └─ Status: Days 6-10

feature/frontend-realtime-eta
  ├─ Branch from: dev
  ├─ Merges to: dev
  ├─ Scope: ETA ticker, Socket.io listeners
  └─ Status: Days 6-10

feature/frontend-nutrition
  ├─ Branch from: dev
  ├─ Merges to: dev
  ├─ Scope: Auto-logging, photo upload, UI enhancements
  └─ Status: Days 11-15
```

### Other Branch Types
```
bugfix/ISSUE-123-pool-race-condition
  └─ For fixing bugs in dev/main

hotfix/ISSUE-456-production-crash
  └─ For urgent production fixes (from main)

refactor/consolidate-api-calls
  └─ For code improvements (from dev)

docs/update-readme
  └─ For documentation updates
```

---

## 📋 STEP-BY-STEP: YOUR FIRST FEATURE BRANCH

### Initial Setup
```bash
# 1. Clone repository (do this once)
git clone https://github.com/yourorg/unifeast.git
cd unifeast

# 2. Configure git (do this once)
git config user.name "Your Name"
git config user.email "your.email@iiit.ac.in"

# 3. Ensure you have latest dev
git checkout dev
git pull origin dev
```

### Creating Feature Branch (Developer 1 Example)
```bash
# 1. Create local feature branch
git checkout -b feature/backend-order-flow

# 2. Make it trackable on origin
git push -u origin feature/backend-order-flow

# 3. Verify you're on the right branch
git branch  # Should show * feature/backend-order-flow

# 4. Start working!
# (Edit files, test locally, add as needed)
```

### Making Commits (Throughout the day)
```bash
# 1. Check what you changed
git status

# 2. Add specific files (recommended - avoid git add .)
git add server/controllers/orderController.js
git add server/config/lockManager.js

# 3. Commit with descriptive message
git commit -m "feat: implement order creation with pool checking

- Add logic to check for existing open pools
- Return suggestedPools array with discount info
- Validate pool eligibility before suggesting
- Closes #123"

# 4. Push to remote
git push origin feature/backend-order-flow

# REPEAT steps 1-4 multiple times per day
```

### Good Commit Message Examples
```bash
# ✅ Good
git commit -m "feat: add pool consolidation on size reached"
git commit -m "fix: prevent race condition in joinPool with Redis lock"
git commit -m "refactor: extract ETA calculation to utils"
git commit -m "docs: add queue engine documentation"

# ❌ Bad
git commit -m "fixed stuff"
git commit -m "changes"
git commit -m "updated"
git commit -m "WIP"
```

### Daily Workflow
```bash
# Morning: Pull latest dev changes
git checkout dev
git pull origin dev
git checkout feature/backend-order-flow
git rebase dev  # Update your branch with latest dev

# Work: Edit files, make commits

# Before lunch/end of day: Push your work
git push origin feature/backend-order-flow

# Check your progress on GitHub
# (View your branch in GitHub UI)
```

---

## 🔄 CREATING A PULL REQUEST (PR)

### When You're Ready to Merge (After task complete)
```bash
# 1. Ensure all changes are committed
git status  # Should be clean

# 2. Push final changes
git push origin feature/backend-order-flow

# 3. Go to GitHub → Create Pull Request
# OR use GitHub CLI:
gh pr create --base dev --head feature/backend-order-flow
```

### PR Template (Use this format)
```markdown
## Description
Closes #123

Implements order creation with pool checking. When a student orders an item,
the system checks for existing open pools and suggests joining with savings.

## Changes Made
- Added pool suggestion logic to createOrder
- Integrated lock manager for concurrency
- Added validation for pool eligibility  
- Returns suggestedPools array in response

## Testing
- [x] Tested order creation with 1 pool
- [x] Tested order creation with multiple pools
- [x] Tested concurrent joins (50 simultaneous)
- [x] Verified lock timeout handling
- [x] No console errors

## Screenshots / Evidence
```
GET /api/orders response:
{
  "order": {...},
  "suggestedPools": [
    {
      "poolId": "...",
      "itemName": "Dosa",
      "savingsPercent": 6,
      "members": 3
    }
  ]
}
```

## Integration Notes
- No breaking changes
- Ready for Dev 2 to use in CartPage
- Depends on lockManager Redis connection

## Related Issues
Fixes #123
Related to #456
Blocks #789 (until merged)
```

### Code Review Checklist (for other dev reviewing)
- [ ] Code follows project conventions
- [ ] No syntax errors or console logs
- [ ] Logic is correct and complete
- [ ] Comments explain complex sections
- [ ] No security issues
- [ ] Tests added/updated
- [ ] No merge conflicts

---

## 🤝 HANDLING MERGE CONFLICTS

### If Conflicts Occur
```bash
# 1. You get message like:
# "Commit is on head, but ref refs/heads/dev/... expects ..."

# 2. Pull latest dev first
git checkout dev
git pull origin dev

# 3. Rebase your branch
git checkout feature/backend-order-flow
git rebase dev

# 4. If conflicts:
# (Git will pause and show conflicts)

# 5. Edit conflicted files
# Look for:
# <<<<<<< HEAD
# your changes here
# =======
# their changes here
# >>>>>>> dev

# 6. Manually merge (keep both if possible)
# 7. Mark as resolved:
git add conflicted-file.js

# 8. Continue rebase:
git rebase --continue

# 9. Force push (only to your feature branch!)
git push -f origin feature/backend-order-flow

# 10. The PR will auto-update with resolved conflicts
```

### Conflict Resolution Strategy (Ask Yourself)
```
If your change && their change are compatible:
  → Keep both (merge them)
  
If they deleted something you edited:
  → Usually keep deletion (they knew something you didn't)
  
If both areas are independent:
  → Keep both but test thoroughly
  
If absolutely conflicting:
  → Discuss with other dev via GitHub comment
```

---

## 🔄 COMMON GIT SCENARIOS

### Scenario 1: Accidentally Worked on dev Branch
```bash
# 1. Create new branch from current state
git checkout -b feature/backend-order-flow

# 2. Go back and reset dev
git checkout dev
git reset --hard origin/dev

# 3. Continue on feature branch
git checkout feature/backend-order-flow
# 
# Now push both
git push -u origin feature/backend-order-flow
git push origin dev
```

### Scenario 2: Committed Wrong File
```bash
# Option A: Undo last commit (keep changes)
git reset --soft HEAD~1
git add correct-files-only.js
git commit -m "feat: correct commit message"

# Option B: Undo last commit (discard changes)
git reset --hard HEAD~1

# Option C: Uncommit but keep staged
git reset HEAD~1

# Then push (force only to your feature branch):
git push -f origin feature/backend-order-flow
```

### Scenario 3: Want to Discard All Changes
```bash
# Go back to last commit on remote
git reset --hard origin/feature/backend-order-flow

# Or go back to last committed state locally
git reset --hard HEAD
```

### Scenario 4: Want to See What You Changed
```bash
# Compare your feature branch to dev
git diff dev...feature/backend-order-flow

# See commits in your branch not in dev
git log dev..feature/backend-order-flow

# See detailed changes per file
git show HEAD  # Last commit
git show HEAD~1  # Previous commit
```

### Scenario 5: Need to Update from dev Without Rebasing
```bash
# Switch to dev and pull
git checkout dev
git pull origin dev

# Go back to feature and merge dev into it
git checkout feature/backend-order-flow
git merge dev

# This creates a "merge commit" (different from rebase)
# Use rebase if feature is not yet shared, merge if already shared
```

---

## ✅ DAILY GIT CHECKLIST

### Morning (Start of Day)
- [ ] `git checkout dev` - switch to dev
- [ ] `git pull origin dev` - get latest changes
- [ ] `git checkout feature/backend-order-flow` - go back to your branch
- [ ] `git rebase dev` - update with latest (optional but recommended)  
- [ ] `npm install` - in case dependencies changed
- [ ] Test existing functionality still works

### During Day
- [ ] Make 3-5 logical commits (not 1 giant commit)
- [ ] Push every 2-3 commits
- [ ] Add meaningful commit messages
- [ ] Run linter occasionally: `npm run lint`

### Before End of Day
- [ ] `git push origin feature/backend-order-flow`
- [ ] Comment status in team channel
- [ ] Document any blockers

---

## 🎯 MERGING INTO DEV PROPERLY

### When Feature is Complete
```bash
# 1. Final push
git push origin feature/backend-order-flow

# 2. Create PR on GitHub

# 3. Wait for code review (other dev checks it)

# 4. Once approved, merge via GitHub UI
# (Do NOT force push after PR created!)

# 5. Delete the feature branch (GitHub UI offers)

# 6. Pull dev locally to stay updated
git checkout dev
git pull origin dev

# 7. Delete local feature branch
git branch -d feature/backend-order-flow
```

### Merge Commit Message (GitHub Auto-Generated)
```
Merge pull request #42 from user/feature/backend-order-flow

feat: implement order creation with pool checking
```

---

## 📊 MONITORING YOUR BRANCH

### GitHub UI Actions
```
1. Go to: https://github.com/yourorg/unifeast
2. Click "Branches" tab
3. See your branch status:
   - ✅ Ahead of dev (ready to merge)
   - ⚠️ Has merge conflicts
   - 🔄 Checks in progress

4. Click branch name to see:
   - Recent commits
   - Differences from dev
   - Ready to create PR button
```

### Command Line Monitoring
```bash
# See all branches locally
git branch -a

# See branches with last commit
git branch -v

# See which branches are merged
git branch --merged

# See tracking status
git branch -vv
```

---

## 🚀 FINAL MERGE TO MAIN (After 4 Weeks Complete)

```bash
# 1. Ensure dev is stable
git checkout dev
git pull origin dev
npm run lint  # No errors
npm test      # All tests pass (when available)

# 2. Create release branch
git checkout -b release/v1.0.0

# 3. Bump version in package.json
# Edit client/package.json and server/package.json
# "version": "1.0.0"

git commit -m "chore: bump version to 1.0.0"
git push -u origin release/v1.0.0

# 4. Create PR from release → main

# 5. Once merged to main:
git checkout main
git pull origin main
git tag v1.0.0
git push origin v1.0.0

# 6. Merge main back to dev
git checkout dev
git merge main
git push origin dev
```

---

## 📋 GIT COMMANDS CHEAT SHEET

```bash
# Basic
git status                           # What's changed?
git add filename.js                  # Stage file
git commit -m "message"              # Commit
git push origin branch-name          # Push to remote
git pull origin branch-name          # Pull from remote

# Branches
git branch                           # List local branches
git branch -a                        # List all branches
git checkout -b new-branch           # Create new branch
git checkout existing-branch         # Switch branches
git branch -d branch-name            # Delete branch

# History
git log                              # View commits
git log --oneline                    # Short format
git log -n 5                         # Last 5 commits
git show commit-hash                 # View specific commit

# Undoing
git reset HEAD~1                     # Undo last commit (keep changes)
git reset --hard HEAD~1              # Undo last commit (discard changes)
git revert commit-hash               # Create new commit that undoes changes
git checkout -- filename.js          # Discard changes to file

# Advanced
git rebase dev                       # Rebase your branch on latest dev
git merge feature-branch             # Merge a branch into current
git stash                            # Save work temporarily
git stash pop                        # Restore stashed work
git cherry-pick commit-hash          # Copy specific commit to current branch

# Sync fork with upstream (if forked)
git remote add upstream original-repo-url
git fetch upstream
git rebase upstream/dev
```

---

## 🎓 GIT LEARNING RESOURCES

- Interactive Tutorial: https://learngitbranching.js.org/
- GitHub Docs: https://docs.github.com/en/get-started
- Atlassian Git Tutorials: https://www.atlassian.com/git/tutorials/
- Pro Git Book: https://git-scm.com/book/en/v2

---

## ⚠️ CRITICAL RULES (DO NOT VIOLATE)

1. **NEVER `git push -f` to `dev` or `main`**
   - Force push only to your personal feature branches

2. **NEVER commit directly to `main`**
   - Always use PR from dev → main

3. **ALWAYS pull before pushing**
   - Reduces merge conflicts

4. **ALWAYS test locally before committing**
   - Verify npm run dev works

5. **NEVER commit node_modules, .env, or .DS_Store**
   - Should be in .gitignore

6. **NEVER use `git add .` blindly**
   - Review files: `git add` specific files

---

**Last Updated**: April 5, 2026  
**Questions?** Ask in team channel with your branch name and error message
