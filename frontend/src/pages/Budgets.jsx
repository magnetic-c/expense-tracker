import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import MonthPicker from '../components/MonthPicker.jsx';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Budgets() {
  const [month, setMonth] = useState(currentMonth());
  const [categories, setCategories] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const [c, b] = await Promise.all([
      api.get('/categories'),
      api.get('/budgets', { params: { month } })
    ]);
    setCategories(c.data.filter((cat) => cat.name !== 'Income'));
    const map = {};
    b.data.forEach((bud) => {
      map[bud.category_id || 'overall'] = bud.amount;
    });
    setAmounts(map);
    setLoading(false);
  }

  useEffect(() => { load(); }, [month]);

  function updateAmount(key, value) {
    setAmounts((a) => ({ ...a, [key]: value }));
  }

  async function saveAll() {
    setSaving(true);
    try {
      const calls = Object.entries(amounts)
        .filter(([, amount]) => amount !== '' && amount !== undefined && amount !== null)
        .map(([key, amount]) =>
          api.post('/budgets', {
            category_id: key === 'overall' ? null : key,
            month_year: month,
            amount: Number(amount)
          })
        );
      await Promise.all(calls);
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Budgets</h1>
          <div className="sub">Set monthly limits — overall and per category.</div>
        </div>
        <MonthPicker value={month} onChange={setMonth} />
      </div>

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <div className="card">
          <div className="field" style={{ maxWidth: 320, paddingBottom: 14, borderBottom: '1px solid var(--line)', marginBottom: 16 }}>
            <label>Overall monthly budget (₹)</label>
            <input
              type="number"
              value={amounts.overall || ''}
              onChange={(e) => updateAmount('overall', e.target.value)}
              placeholder="e.g. 12000"
            />
          </div>

          <div className="stat-label" style={{ marginBottom: 10 }}>Per-category budgets (optional)</div>
          <div className="grid grid-2">
            {categories.map((cat) => (
              <div className="field" key={cat.id}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 99, background: cat.color, display: 'inline-block' }} />
                  {cat.name}
                </label>
                <input
                  type="number"
                  value={amounts[cat.id] || ''}
                  onChange={(e) => updateAmount(cat.id, e.target.value)}
                  placeholder="No limit set"
                />
              </div>
            ))}
          </div>

          <button className="btn" onClick={saveAll} disabled={saving} style={{ marginTop: 8 }}>
            {saving ? 'Saving…' : 'Save budgets'}
          </button>
        </div>
      )}
    </div>
  );
}
