import express from 'express';
import { query } from '../db/pool.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

// List all categories available to the user (their own + system defaults)
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, color, icon, is_default
       FROM categories
       WHERE user_id = $1 OR is_default = TRUE
       ORDER BY is_default DESC, name ASC`,
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, color, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name is required' });

    const result = await query(
      `INSERT INTO categories (user_id, name, color, icon, is_default)
       VALUES ($1, $2, $3, $4, FALSE) RETURNING *`,
      [req.userId, name, color || '#6366f1', icon || 'tag']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create category' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await query(
      'DELETE FROM categories WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Category not found or not deletable' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete category' });
  }
});

export default router;
