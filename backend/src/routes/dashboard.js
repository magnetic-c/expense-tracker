import express from 'express';
import { query } from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  detectAnomalies,
  detectSubscriptions,
  predictBudget,
  computeHealthScore
} from '../utils/insights.js';

const router = express.Router();
router.use(authMiddleware);

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Monthly summary: totals, category breakdown (for pie chart), daily trend (for line chart)
router.get('/summary', async (req, res) => {
  try {
    const month = req.query.month || currentMonth();

    const { rows: totals } = await query(
      `SELECT type, COALESCE(SUM(amount), 0) AS total
       FROM transactions
       WHERE user_id = $1 AND TO_CHAR(txn_date, 'YYYY-MM') = $2
       GROUP BY type`,
      [req.userId, month]
    );
    let income = 0, expense = 0;
    for (const row of totals) {
      if (row.type === 'income') income = Number(row.total);
      if (row.type === 'expense') expense = Number(row.total);
    }

    const { rows: byCategory } = await query(
      `SELECT c.id, c.name, c.color, COALESCE(SUM(t.amount), 0) AS total
       FROM categories c
       LEFT JOIN transactions t ON t.category_id = c.id AND t.user_id = $1
         AND t.type = 'expense' AND TO_CHAR(t.txn_date, 'YYYY-MM') = $2
       WHERE (c.user_id = $1 OR c.is_default = TRUE) AND c.name != 'Income'
       GROUP BY c.id, c.name, c.color
       HAVING COALESCE(SUM(t.amount), 0) > 0
       ORDER BY total DESC`,
      [req.userId, month]
    );

    const { rows: dailyTrend } = await query(
      `SELECT txn_date::date AS date, SUM(amount) AS total
       FROM transactions
       WHERE user_id = $1 AND type = 'expense' AND TO_CHAR(txn_date, 'YYYY-MM') = $2
       GROUP BY txn_date
       ORDER BY txn_date ASC`,
      [req.userId, month]
    );

    res.json({
      month,
      income: Math.round(income),
      expense: Math.round(expense),
      net: Math.round(income - expense),
      by_category: byCategory.map((r) => ({ ...r, total: Math.round(Number(r.total)) })),
      daily_trend: dailyTrend.map((r) => ({ date: r.date, total: Math.round(Number(r.total)) }))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

router.get('/anomalies', async (req, res) => {
  try {
    const month = req.query.month || currentMonth();
    const anomalies = await detectAnomalies(req.userId, month);
    res.json(anomalies);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to detect anomalies' });
  }
});

router.get('/subscriptions', async (req, res) => {
  try {
    const subs = await detectSubscriptions(req.userId);
    res.json(subs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to detect subscriptions' });
  }
});

router.get('/prediction', async (req, res) => {
  try {
    const month = req.query.month || currentMonth();
    const prediction = await predictBudget(req.userId, month);
    res.json(prediction);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to predict budget' });
  }
});

router.get('/health-score', async (req, res) => {
  try {
    const month = req.query.month || currentMonth();
    const score = await computeHealthScore(req.userId, month);
    res.json(score);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute health score' });
  }
});

export default router;
