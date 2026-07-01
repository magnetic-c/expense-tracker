import { query } from '../db/pool.js';

function shiftMonth(monthYear, delta) {
  const [y, m] = monthYear.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function daysInMonth(monthYear) {
  const [y, m] = monthYear.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/**
 * Compare current month spend per category against the average of the
 * previous N months for that same category. Flags categories that spiked.
 */
export async function detectAnomalies(userId, monthYear, lookbackMonths = 3, thresholdPct = 30) {
  const pastMonths = [];
  for (let i = 1; i <= lookbackMonths; i++) pastMonths.push(shiftMonth(monthYear, -i));

  const { rows: currentRows } = await query(
    `SELECT c.id AS category_id, c.name, COALESCE(SUM(t.amount), 0) AS total
     FROM categories c
     LEFT JOIN transactions t
       ON t.category_id = c.id AND t.user_id = $1 AND t.type = 'expense'
       AND TO_CHAR(t.txn_date, 'YYYY-MM') = $2
     WHERE c.user_id = $1 OR c.is_default = TRUE
     GROUP BY c.id, c.name`,
    [userId, monthYear]
  );

  const { rows: pastRows } = await query(
    `SELECT category_id, TO_CHAR(txn_date, 'YYYY-MM') AS month, SUM(amount) AS total
     FROM transactions
     WHERE user_id = $1 AND type = 'expense' AND TO_CHAR(txn_date, 'YYYY-MM') = ANY($2)
     GROUP BY category_id, month`,
    [userId, pastMonths]
  );

  const pastByCategory = {};
  for (const row of pastRows) {
    if (!pastByCategory[row.category_id]) pastByCategory[row.category_id] = [];
    pastByCategory[row.category_id].push(Number(row.total));
  }

  const anomalies = [];
  for (const cur of currentRows) {
    const history = pastByCategory[cur.category_id] || [];
    if (history.length === 0) continue; // need history to judge an anomaly
    const avg = history.reduce((a, b) => a + b, 0) / lookbackMonths; // divide by lookback, missing months count as 0 spend
    const current = Number(cur.total);
    if (avg <= 0) continue;
    const pctChange = ((current - avg) / avg) * 100;
    if (pctChange >= thresholdPct) {
      anomalies.push({
        category_id: cur.category_id,
        category_name: cur.name,
        average: Math.round(avg),
        current: Math.round(current),
        pct_change: Math.round(pctChange)
      });
    }
  }

  return anomalies.sort((a, b) => b.pct_change - a.pct_change);
}

/**
 * Detect likely recurring subscriptions: same merchant, similar amount,
 * appearing repeatedly at ~25-35 day intervals.
 */
export async function detectSubscriptions(userId) {
  const { rows } = await query(
    `SELECT merchant, amount, txn_date
     FROM transactions
     WHERE user_id = $1 AND type = 'expense' AND merchant IS NOT NULL AND merchant != ''
     ORDER BY merchant, txn_date ASC`,
    [userId]
  );

  const byMerchant = {};
  for (const row of rows) {
    const key = row.merchant.trim().toLowerCase();
    if (!byMerchant[key]) byMerchant[key] = { merchant: row.merchant, entries: [] };
    byMerchant[key].entries.push({ amount: Number(row.amount), date: new Date(row.txn_date) });
  }

  const subscriptions = [];
  for (const key in byMerchant) {
    const { merchant, entries } = byMerchant[key];
    if (entries.length < 2) continue;

    const gaps = [];
    for (let i = 1; i < entries.length; i++) {
      const days = Math.round((entries[i].date - entries[i - 1].date) / (1000 * 60 * 60 * 24));
      gaps.push(days);
    }

    // A subscription has most gaps clustered around 25-35 days
    const monthlyGaps = gaps.filter((g) => g >= 25 && g <= 35);
    const isRecurring = monthlyGaps.length >= Math.max(1, Math.ceil(gaps.length * 0.6));

    if (isRecurring) {
      const amounts = entries.map((e) => e.amount);
      const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const last = entries[entries.length - 1];
      subscriptions.push({
        merchant,
        occurrences: entries.length,
        average_amount: Math.round(avgAmount),
        last_charged: last.date.toISOString().slice(0, 10),
        avg_gap_days: Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length),
        message: `Looks like "${merchant}" is a recurring subscription (~every ${Math.round(
          gaps.reduce((a, b) => a + b, 0) / gaps.length
        )} days).`
      });
    }
  }

  return subscriptions;
}

/**
 * Predicts month-end spend based on current pace, and compares to budget.
 */
export async function predictBudget(userId, monthYear) {
  const today = new Date();
  const isCurrentMonth = monthYear === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const totalDays = daysInMonth(monthYear);
  const dayOfMonth = isCurrentMonth ? today.getDate() : totalDays;

  const { rows } = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE user_id = $1 AND type = 'expense' AND TO_CHAR(txn_date, 'YYYY-MM') = $2`,
    [userId, monthYear]
  );
  const currentSpend = Number(rows[0].total);

  const dailyAvg = dayOfMonth > 0 ? currentSpend / dayOfMonth : 0;
  const predictedTotal = Math.round(dailyAvg * totalDays);

  const { rows: budgetRows } = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM budgets
     WHERE user_id = $1 AND month_year = $2`,
    [userId, monthYear]
  );
  const budget = Number(budgetRows[0].total);

  const willExceed = budget > 0 && predictedTotal > budget;

  return {
    current_spend: Math.round(currentSpend),
    predicted_month_end: predictedTotal,
    budget,
    day_of_month: dayOfMonth,
    total_days: totalDays,
    will_exceed_budget: willExceed,
    exceed_amount: willExceed ? predictedTotal - budget : 0
  };
}

/**
 * Computes a 0-100 financial health score from savings rate, budget adherence,
 * and category-level trends vs the previous month.
 */
export async function computeHealthScore(userId, monthYear) {
  const prevMonth = shiftMonth(monthYear, -1);

  const { rows: incomeExpense } = await query(
    `SELECT type, COALESCE(SUM(amount), 0) AS total
     FROM transactions
     WHERE user_id = $1 AND TO_CHAR(txn_date, 'YYYY-MM') = $2
     GROUP BY type`,
    [userId, monthYear]
  );
  let income = 0, expense = 0;
  for (const row of incomeExpense) {
    if (row.type === 'income') income = Number(row.total);
    if (row.type === 'expense') expense = Number(row.total);
  }
  const savingsRate = income > 0 ? (income - expense) / income : expense > 0 ? -1 : 0;

  const { rows: budgetRows } = await query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM budgets WHERE user_id = $1 AND month_year = $2`,
    [userId, monthYear]
  );
  const budget = Number(budgetRows[0].total);
  const budgetAdherence = budget > 0 ? Math.max(0, 1 - Math.max(0, expense - budget) / budget) : 0.7; // neutral if no budget set

  const { rows: curByCat } = await query(
    `SELECT c.name, COALESCE(SUM(t.amount), 0) AS total
     FROM categories c
     LEFT JOIN transactions t ON t.category_id = c.id AND t.user_id = $1
       AND t.type = 'expense' AND TO_CHAR(t.txn_date, 'YYYY-MM') = $2
     WHERE c.user_id = $1 OR c.is_default = TRUE
     GROUP BY c.name`,
    [userId, monthYear]
  );
  const { rows: prevByCat } = await query(
    `SELECT c.name, COALESCE(SUM(t.amount), 0) AS total
     FROM categories c
     LEFT JOIN transactions t ON t.category_id = c.id AND t.user_id = $1
       AND t.type = 'expense' AND TO_CHAR(t.txn_date, 'YYYY-MM') = $2
     WHERE c.user_id = $1 OR c.is_default = TRUE
     GROUP BY c.name`,
    [userId, prevMonth]
  );
  const prevMap = Object.fromEntries(prevByCat.map((r) => [r.name, Number(r.total)]));

  const trends = curByCat
    .filter((r) => Number(r.total) > 0 || (prevMap[r.name] || 0) > 0)
    .map((r) => {
      const cur = Number(r.total);
      const prev = prevMap[r.name] || 0;
      let direction = 'flat';
      let pct = 0;
      if (prev > 0) {
        pct = Math.round(((cur - prev) / prev) * 100);
        direction = pct > 5 ? 'up' : pct < -5 ? 'down' : 'flat';
      } else if (cur > 0) {
        direction = 'up';
        pct = 100;
      }
      return { category: r.name, current: Math.round(cur), previous: Math.round(prev), pct_change: pct, direction };
    });

  // Weighted score: savings rate 50%, budget adherence 30%, spending stability 20%
  const avgAbsTrendPct = trends.length
    ? trends.reduce((sum, t) => sum + Math.min(Math.abs(t.pct_change), 100), 0) / trends.length
    : 0;
  const stabilityScore = Math.max(0, 1 - avgAbsTrendPct / 100);

  const savingsScore = Math.max(0, Math.min(1, (savingsRate + 0.2) / 1.2)); // -20% savings -> 0, 100% savings -> 1

  const rawScore = savingsScore * 0.5 + budgetAdherence * 0.3 + stabilityScore * 0.2;
  const score = Math.round(rawScore * 100);

  return {
    score: Math.max(0, Math.min(100, score)),
    savings_rate_pct: Math.round(savingsRate * 100),
    budget_adherence_pct: Math.round(budgetAdherence * 100),
    income: Math.round(income),
    expense: Math.round(expense),
    trends
  };
}
