# Wally — Smart Expense Tracker

A personal finance assistant

## What's inside

**Core (MVP)**
- Email/password auth (JWT + bcrypt)
- Add / edit / delete transactions
- Categories (defaults + custom)
- Monthly dashboard with pie + line charts (Recharts)
- Budget setting (overall + per-category)

**Smart features**
- **Automatic categorization** — a hand-built keyword engine (`backend/src/utils/categorize.js` + `db/seed.js`) maps merchant text like "Swiggy" to Food, "Uber" to Transport, etc. No AI/ML, just deterministic keyword matching with longest-match-wins and user-rule priority.
- **Spending anomaly detection** — compares this month's spend per category to the trailing 3-month average and flags anything 30%+ above normal.
- **Subscription detector** — groups transactions by merchant and looks for repeat charges ~25-35 days apart to flag likely subscriptions.
- **Monthly financial health score (0-100)** — weighted blend of savings rate, budget adherence, and category-level spending stability vs last month, with up/down trend badges per category.
- **Budget prediction** — projects month-end spend from current daily pace and warns if you're on track to exceed budget.
- **PDF report export** — one-click monthly report (PDFKit) with health score, prediction, anomalies, category breakdown, and full transaction list.

## Stack

React (Vite) + Recharts on the frontend, Node/Express + PostgreSQL on the backend, plain JWT auth, no ORM, just `pg` and hand-written SQL so the logic stays visible.

## Prerequisites

- Node.js 18+
- PostgreSQL running locally (or any reachable instance)

## Setup

### 1. Database

Create a database:
```bash
createdb expense_tracker
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# edit .env: set DATABASE_URL and a real JWT_SECRET
npm install
npm run migrate   # creates tables
npm run seed      # loads default categories + keyword rules
npm run dev       # starts on http://localhost:5000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev   # starts on http://localhost:5173, proxies /api to :5000
```

Open http://localhost:5173, sign up, and start adding transactions. Try adding one with merchant "Swiggy" and leave the category on "Auto-detect" — it'll tag itself as Food.

## How the keyword engine works

`db/seed.js` loads a `keyword_rules` table mapping ~100 common merchant keywords (Swiggy, Zomato, Uber, Amazon, Netflix, etc.) to default categories. When you add a transaction without picking a category, `utils/categorize.js` lowercases the merchant + description text and checks it against all rules (your own custom rules first, then defaults), picking the longest keyword match to avoid ambiguity (e.g. "Amazon Prime" matches Subscriptions before "Amazon" matches Shopping).

## Project structure

```
backend/
  src/
    db/            schema.sql, migrate.js, seed.js, pool.js
    middleware/    auth.js (JWT verification)
    routes/        auth, categories, transactions, budgets, dashboard, reports
    utils/         categorize.js (keyword engine), insights.js (anomalies, subscriptions, score, prediction)
    server.js
frontend/
  src/
    api/client.js  axios instance with auth interceptor
    context/       AuthContext
    components/    Layout, MonthPicker, ScoreRing, TransactionModal
    pages/         Login, Signup, Dashboard, Transactions, Budgets, Insights
```

## Notes / next steps

- Currency is hardcoded to Rs (INR symbol) throughout — change the symbol in the frontend if you need another currency.
- The anomaly/health-score math is intentionally simple (documented inline in `insights.js`) — easy to tune thresholds or weights.
- No refresh tokens — JWT just expires after 7 days (configurable via `JWT_EXPIRES_IN`) and the user has to log in again.
