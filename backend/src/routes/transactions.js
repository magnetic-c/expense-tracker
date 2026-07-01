import express from 'express';
import { query } from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';
import { categorizeByKeyword } from '../utils/categorize.js';

const router = express.Router();
router.use(authMiddleware);

// List transactions, optional filters: month=YYYY-MM, category_id, type
router.get('/', async (req, res) => {
  try {
    const { month, category_id, type, limit = 200, offset = 0 } = req.query;
    const conditions = ['t.user_id = $1'];
    const params = [req.userId];
    let idx = 2;

    if (month) {
      conditions.push(`TO_CHAR(t.txn_date, 'YYYY-MM') = $${idx++}`);
      params.push(month);
    }
    if (category_id) {
      conditions.push(`t.category_id = $${idx++}`);
      params.push(category_id);
    }
    if (type) {
      conditions.push(`t.type = $${idx++}`);
      params.push(type);
    }

    params.push(limit, offset);
    const result = await query(
      `SELECT t.*, c.name AS category_name, c.color AS category_color
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.txn_date DESC, t.id DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Create transaction. If category_id not given, auto-categorize using keyword engine.
router.post('/', async (req, res) => {
  try {
    const { amount, type, merchant, description, txn_date, category_id } = req.body;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({ error: 'A valid amount is required' });
    }

    let finalCategoryId = category_id || null;
    let autoCategorized = false;

    if (!finalCategoryId) {
      const guess = await categorizeByKeyword(req.userId, `${merchant || ''} ${description || ''}`);
      if (guess) {
        finalCategoryId = guess;
        autoCategorized = true;
      }
    }

    const result = await query(
      `INSERT INTO transactions
        (user_id, category_id, amount, type, merchant, description, txn_date, auto_categorized)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE), $8)
       RETURNING *`,
      [
        req.userId,
        finalCategoryId,
        amount,
        type || 'expense',
        merchant || null,
        description || null,
        txn_date || null,
        autoCategorized
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { amount, type, merchant, description, txn_date, category_id } = req.body;

    const existing = await query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const result = await query(
      `UPDATE transactions
       SET amount = COALESCE($1, amount),
           type = COALESCE($2, type),
           merchant = COALESCE($3, merchant),
           description = COALESCE($4, description),
           txn_date = COALESCE($5, txn_date),
           category_id = COALESCE($6, category_id),
           auto_categorized = FALSE
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
      [amount, type, merchant, description, txn_date, category_id, req.params.id, req.userId]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
});

export default router;
