import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import api from '../api/client.js';
import MonthPicker from '../components/MonthPicker.jsx';
import ScoreRing from '../components/ScoreRing.jsx';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Dashboard() {
  const [month, setMonth] = useState(currentMonth());
  const [summary, setSummary] = useState(null);
  const [health, setHealth] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api.get('/dashboard/summary', { params: { month } }),
      api.get('/dashboard/health-score', { params: { month } }),
      api.get('/dashboard/prediction', { params: { month } }),
      api.get('/dashboard/anomalies', { params: { month } })
    ]).then(([s, h, p, a]) => {
      if (cancelled) return;
      setSummary(s.data);
      setHealth(h.data);
      setPrediction(p.data);
      setAnomalies(a.data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [month]);

  async function downloadReport() {
    const res = await api.get(`/reports/monthly/${month}`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `expense-report-${month}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  if (loading || !summary) {
    return <div className="empty-state">Loading your dashboard…</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <div className="sub">A monthly read on where your money went.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <MonthPicker value={month} onChange={setMonth} />
          <button className="btn secondary" onClick={downloadReport}>Download PDF report</button>
        </div>
      </div>

      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="stat-label">Income</div>
          <div className="stat-value" style={{ color: '#0f766e' }}>₹{summary.income.toLocaleString('en-IN')}</div>
        </div>
        <div className="card">
          <div className="stat-label">Expenses</div>
          <div className="stat-value" style={{ color: '#be123c' }}>₹{summary.expense.toLocaleString('en-IN')}</div>
        </div>
        <div className="card">
          <div className="stat-label">Net</div>
          <div className="stat-value">₹{summary.net.toLocaleString('en-IN')}</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3 style={{ marginBottom: 14, fontSize: 16 }}>Spending by category</h3>
          {summary.by_category.length === 0 ? (
            <div className="empty-state">No expenses logged yet this month.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={summary.by_category} dataKey="total" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {summary.by_category.map((entry, i) => (
                    <Cell key={i} fill={entry.color || '#0f766e'} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `₹${v}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px', marginTop: 8 }}>
            {summary.by_category.map((c) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 99, background: c.color, display: 'inline-block' }} />
                {c.name}
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginBottom: 14, fontSize: 16 }}>Daily spend trend</h3>
          {summary.daily_trend.length === 0 ? (
            <div className="empty-state">Nothing to chart yet.</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={summary.daily_trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4ddd0" />
                <XAxis dataKey="date" tickFormatter={(d) => d.slice(8, 10)} fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v) => `₹${v}`} labelFormatter={(d) => d} />
                <Line type="monotone" dataKey="total" stroke="#0f766e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 16 }}>Financial health score</h3>
          <div className="score-ring-wrap">
            <ScoreRing score={health.score} />
            <div style={{ fontSize: 13.5, color: 'var(--ink-soft)' }}>
              <div>Savings rate: <strong style={{ color: 'var(--ink)' }}>{health.savings_rate_pct}%</strong></div>
              <div>Budget adherence: <strong style={{ color: 'var(--ink)' }}>{health.budget_adherence_pct}%</strong></div>
            </div>
          </div>
          {health.trends.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
              {health.trends.map((t) => (
                <span key={t.category} className={`badge ${t.direction}`}>
                  {t.category} {t.direction === 'up' ? '↑' : t.direction === 'down' ? '↓' : '→'}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Budget prediction</h3>
          <div style={{ fontSize: 13.5, lineHeight: 1.9 }}>
            <div>Current spend: <strong style={{ fontFamily: 'var(--font-mono)' }}>₹{prediction.current_spend.toLocaleString('en-IN')}</strong></div>
            <div>Predicted month-end: <strong style={{ fontFamily: 'var(--font-mono)' }}>₹{prediction.predicted_month_end.toLocaleString('en-IN')}</strong></div>
            <div>Budget: <strong style={{ fontFamily: 'var(--font-mono)' }}>{prediction.budget > 0 ? `₹${prediction.budget.toLocaleString('en-IN')}` : 'Not set'}</strong></div>
          </div>
          {prediction.budget > 0 && (
            <div className={`insight-card ${prediction.will_exceed_budget ? 'danger' : 'ok'}`} style={{ marginTop: 14 }}>
              {prediction.will_exceed_budget
                ? `⚠ Likely to exceed budget by ₹${prediction.exceed_amount.toLocaleString('en-IN')} at this pace.`
                : '✓ On track to stay within budget this month.'}
            </div>
          )}

          {anomalies.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div className="stat-label" style={{ marginBottom: 8 }}>Spending anomalies</div>
              {anomalies.map((a) => (
                <div key={a.category_id} className="insight-card">
                  ⚠ {a.category_name}: avg ₹{a.average.toLocaleString('en-IN')} → this month ₹{a.current.toLocaleString('en-IN')} ({a.pct_change > 0 ? '+' : ''}{a.pct_change}%)
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
