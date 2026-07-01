import { pool } from './pool.js';

// Default categories
const DEFAULT_CATEGORIES = [
  { name: 'Food', color: '#f59e0b', icon: 'utensils' },
  { name: 'Transport', color: '#3b82f6', icon: 'car' },
  { name: 'Shopping', color: '#ec4899', icon: 'shopping-bag' },
  { name: 'Entertainment', color: '#8b5cf6', icon: 'film' },
  { name: 'Bills & Utilities', color: '#ef4444', icon: 'receipt' },
  { name: 'Health', color: '#10b981', icon: 'heart-pulse' },
  { name: 'Subscriptions', color: '#06b6d4', icon: 'repeat' },
  { name: 'Groceries', color: '#84cc16', icon: 'shopping-cart' },
  { name: 'Travel', color: '#0ea5e9', icon: 'plane' },
  { name: 'Education', color: '#6366f1', icon: 'book' },
  { name: 'Income', color: '#22c55e', icon: 'trending-up' },
  { name: 'Other', color: '#64748b', icon: 'more-horizontal' }
];

// Keyword -> Category map. This is the "keyword engine" for automatic categorization.
// Matching is done case-insensitively against merchant/description text.
const KEYWORD_MAP = {
  Food: [
    'swiggy', 'zomato', 'dominos', "domino's", 'pizza hut', 'kfc', 'mcdonald',
    "mcdonald's", 'burger king', 'starbucks', 'cafe coffee day', 'ccd',
    'restaurant', 'eatery', 'foodpanda', 'subway', 'haldiram', 'barbeque nation'
  ],
  Transport: [
    'uber', 'ola', 'rapido', 'metro', 'irctc', 'fuel', 'petrol', 'diesel',
    'parking', 'toll', 'fastag', 'cab', 'taxi', 'bus ticket', 'redbus'
  ],
  Shopping: [
    'amazon', 'flipkart', 'myntra', 'ajio', 'meesho', 'nykaa', 'snapdeal',
    'reliance digital', 'croma', 'decathlon', 'ikea', 'lifestyle', 'shoppers stop'
  ],
  Entertainment: [
    'bookmyshow', 'pvr', 'inox', 'cinema', 'movie', 'concert ticket'
  ],
  'Bills & Utilities': [
    'electricity', 'water bill', 'gas bill', 'broadband', 'wifi', 'jio',
    'airtel', 'vodafone', 'vi recharge', 'mobile recharge', 'dth', 'piped gas',
    'rent', 'maintenance charge'
  ],
  Health: [
    'pharmacy', 'apollo', 'medplus', 'hospital', 'clinic', 'doctor',
    'diagnostic', 'medical', 'practo', '1mg', 'netmeds'
  ],
  Subscriptions: [
    'netflix', 'spotify', 'amazon prime', 'prime video', 'hotstar', 'disney+',
    'youtube premium', 'apple music', 'icloud', 'gym membership', 'audible',
    'sonyliv', 'zee5', 'jio cinema'
  ],
  Groceries: [
    'bigbasket', 'blinkit', 'zepto', 'grofers', 'dmart', 'instamart',
    'reliance fresh', 'more supermarket', 'grocery'
  ],
  Travel: [
    'makemytrip', 'goibibo', 'airbnb', 'oyo', 'indigo', 'air india',
    'vistara', 'spicejet', 'hotel booking', 'yatra'
  ],
  Education: [
    'udemy', 'coursera', 'byju', "byju's", 'unacademy', 'tuition', 'school fee',
    'college fee', 'book store'
  ]
};

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const categoryIds = {};
    for (const cat of DEFAULT_CATEGORIES) {
      const existing = await client.query(
        'SELECT id FROM categories WHERE name = $1 AND is_default = TRUE',
        [cat.name]
      );
      if (existing.rows.length > 0) {
        categoryIds[cat.name] = existing.rows[0].id;
        continue;
      }
      const res = await client.query(
        `INSERT INTO categories (user_id, name, color, icon, is_default)
         VALUES (NULL, $1, $2, $3, TRUE) RETURNING id`,
        [cat.name, cat.color, cat.icon]
      );
      categoryIds[cat.name] = res.rows[0].id;
    }

    for (const [catName, keywords] of Object.entries(KEYWORD_MAP)) {
      const categoryId = categoryIds[catName];
      for (const kw of keywords) {
        const exists = await client.query(
          'SELECT id FROM keyword_rules WHERE keyword = $1 AND is_default = TRUE',
          [kw]
        );
        if (exists.rows.length === 0) {
          await client.query(
            `INSERT INTO keyword_rules (user_id, keyword, category_id, is_default)
             VALUES (NULL, $1, $2, TRUE)`,
            [kw, categoryId]
          );
        }
      }
    }

    await client.query('COMMIT');
    console.log('✅ Seeded default categories and keyword rules.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
