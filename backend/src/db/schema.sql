-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(180) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Categories (system defaults have user_id = NULL, user-created have user_id set)
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  color VARCHAR(20) DEFAULT '#6366f1',
  icon VARCHAR(40) DEFAULT 'tag',
  is_default BOOLEAN DEFAULT FALSE
);

-- Keyword rules for auto-categorization engine ("Swiggy" -> Food)
CREATE TABLE IF NOT EXISTS keyword_rules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  keyword VARCHAR(120) NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  is_default BOOLEAN DEFAULT FALSE
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  amount NUMERIC(12,2) NOT NULL,
  type VARCHAR(10) NOT NULL DEFAULT 'expense',
  merchant VARCHAR(150),
  description TEXT,
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  auto_categorized BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Budgets: overall (category_id IS NULL) or per-category.
-- PostgreSQL UNIQUE doesn't treat NULL=NULL, so we use two partial unique indexes.
CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
  month_year VARCHAR(7) NOT NULL,
  amount NUMERIC(12,2) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS budgets_overall_unique
  ON budgets (user_id, month_year)
  WHERE category_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS budgets_category_unique
  ON budgets (user_id, category_id, month_year)
  WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, txn_date);
CREATE INDEX IF NOT EXISTS idx_transactions_merchant ON transactions(user_id, merchant);
