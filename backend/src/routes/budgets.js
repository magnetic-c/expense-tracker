import express from 'express';
import { query } from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const month = req.query.month || new Date().toISOString().slice(0, 7);
    const result = await query(
      `SELECT b.*, c.name AS category_name, c.color AS category_color
       FROM budgets b
       LEFT JOIN categories c ON c.id = b.category_id
       WHERE b.user_id = $1 AND b.month_year = $2
       ORDER BY c.name ASC NULLS FIRST`,
      [req.userId, month]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch budgets' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { category_id, month_year, amount } = req.body;
    if (!month_year || amount === undefined) {
      return res.status(400).json({ error: 'month_year and amount are required' });
    }

    const catId = category_id || null;
    let result;

    if (catId === null) {
      // Overall budget — conflict on partial index (category_id IS NULL)
      result = await query(
        `INSERT INTO budgets (user_id, category_id, month_year, amount)
         VALUES ($1, NULL, $2, $3)
         ON CONFLICT (user_id, month_year) WHERE category_id IS NULL
         DO UPDATE SET amount = EXCLUDED.amount
         RETURNING *`,
        [req.userId, month_year, amount]
      );
    } else {
      // Per-category budget — conflict on partial index (category_id IS NOT NULL)
      result = await query(
        `INSERT INTO budgets (user_id, category_id, month_year, amount)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, category_id, month_year) WHERE category_id IS NOT NULL
         DO UPDATE SET amount = EXCLUDED.amount
         RETURNING *`,
        [req.userId, catId, month_year, amount]
      );
    }

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save budget' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Budget not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete budget' });
  }
});

export default router;
