import express from 'express';
import PDFDocument from 'pdfkit';
import { query } from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';
import { computeHealthScore, predictBudget, detectAnomalies } from '../utils/insights.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/monthly/:month', async (req, res) => {
  try {
    const month = req.params.month;
    const userRes = await query('SELECT name, email FROM users WHERE id = $1', [req.userId]);
    const user = userRes.rows[0];

    const { rows: byCategory } = await query(
      `SELECT c.name, c.color, COALESCE(SUM(t.amount), 0) AS total
       FROM categories c
       LEFT JOIN transactions t ON t.category_id = c.id AND t.user_id = $1
         AND t.type = 'expense' AND TO_CHAR(t.txn_date, 'YYYY-MM') = $2
       WHERE (c.user_id = $1 OR c.is_default = TRUE) AND c.name != 'Income'
       GROUP BY c.name, c.color
       HAVING COALESCE(SUM(t.amount), 0) > 0
       ORDER BY total DESC`,
      [req.userId, month]
    );

    const { rows: transactions } = await query(
      `SELECT t.txn_date, t.merchant, t.amount, t.type, c.name AS category_name
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = $1 AND TO_CHAR(t.txn_date, 'YYYY-MM') = $2
       ORDER BY t.txn_date ASC`,
      [req.userId, month]
    );

    const health = await computeHealthScore(req.userId, month);
    const prediction = await predictBudget(req.userId, month);
    const anomalies = await detectAnomalies(req.userId, month);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="expense-report-${month}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Header
    doc.fontSize(20).fillColor('#1e293b').text('Monthly Financial Report', { align: 'left' });
    doc.fontSize(11).fillColor('#64748b').text(`${user.name} • ${user.email}`);
    doc.text(`Period: ${month}`);
    doc.moveDown(1);

    // Health score
    doc.fontSize(14).fillColor('#1e293b').text(`Financial Health Score: ${health.score} / 100`);
    doc.fontSize(10).fillColor('#64748b').text(
      `Income: ₹${health.income}   Expense: ₹${health.expense}   Savings rate: ${health.savings_rate_pct}%`
    );
    doc.moveDown(1);

    // Prediction
    doc.fontSize(13).fillColor('#1e293b').text('Budget Prediction');
    doc.fontSize(10).fillColor('#334155').text(
      `Current spend: ₹${prediction.current_spend}   Predicted month-end: ₹${prediction.predicted_month_end}   Budget: ₹${prediction.budget}`
    );
    if (prediction.will_exceed_budget) {
      doc.fillColor('#dc2626').text(`⚠ Likely to exceed budget by ₹${prediction.exceed_amount}`);
    }
    doc.moveDown(1);

    // Anomalies
    if (anomalies.length > 0) {
      doc.fontSize(13).fillColor('#1e293b').text('Spending Anomalies');
      anomalies.forEach((a) => {
        doc.fontSize(10).fillColor('#334155').text(
          `${a.category_name}: avg ₹${a.average} → this month ₹${a.current} (+${a.pct_change}%)`
        );
      });
      doc.moveDown(1);
    }

    // Category breakdown
    doc.fontSize(13).fillColor('#1e293b').text('Spending by Category');
    byCategory.forEach((c) => {
      doc.fontSize(10).fillColor('#334155').text(`${c.name}: ₹${Math.round(Number(c.total))}`);
    });
    doc.moveDown(1);

    // Transactions table
    doc.fontSize(13).fillColor('#1e293b').text('Transactions');
    doc.moveDown(0.3);
    doc.fontSize(9).fillColor('#64748b');
    transactions.forEach((t) => {
      const date = new Date(t.txn_date).toISOString().slice(0, 10);
      const sign = t.type === 'income' ? '+' : '-';
      doc.text(
        `${date}   ${(t.merchant || '—').padEnd(25)}   ${(t.category_name || 'Uncategorized').padEnd(18)}   ${sign}₹${Number(t.amount).toFixed(2)}`
      );
    });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;
