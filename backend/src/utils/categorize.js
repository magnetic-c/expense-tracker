import { query } from '../db/pool.js';

/**
 * Given a merchant/description string, find the best matching category
 * using keyword rules. User-defined rules take priority over default rules.
 * Longest keyword match wins (so "amazon prime" beats "amazon").
 */
export async function categorizeByKeyword(userId, text) {
  if (!text) return null;
  const normalized = text.toLowerCase();

  const { rows } = await query(
    `SELECT keyword, category_id, is_default
     FROM keyword_rules
     WHERE user_id = $1 OR is_default = TRUE
     ORDER BY LENGTH(keyword) DESC`,
    [userId]
  );

  // Prefer user-defined rules over default rules when both match.
  let bestUserMatch = null;
  let bestDefaultMatch = null;

  for (const rule of rows) {
    if (normalized.includes(rule.keyword.toLowerCase())) {
      if (!rule.is_default && !bestUserMatch) {
        bestUserMatch = rule;
      } else if (rule.is_default && !bestDefaultMatch) {
        bestDefaultMatch = rule;
      }
    }
  }

  const match = bestUserMatch || bestDefaultMatch;
  return match ? match.category_id : null;
}

/**
 * Add or update a custom keyword rule for a user (lets them teach the engine).
 */
export async function addUserKeywordRule(userId, keyword, categoryId) {
  await query(
    `INSERT INTO keyword_rules (user_id, keyword, category_id, is_default)
     VALUES ($1, $2, $3, FALSE)`,
    [userId, keyword.toLowerCase(), categoryId]
  );
}
