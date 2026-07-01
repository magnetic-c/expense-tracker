import React, { useEffect, useState } from 'react';
import api from '../api/client.js';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Insights() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/subscriptions'),
      api.get('/dashboard/anomalies', { params: { month: currentMonth() } })
    ]).then(([s, a]) => {
      setSubscriptions(s.data);
      setAnomalies(a.data);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="empty-state">Scanning your transactions…</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Insights</h1>
          <div className="sub">Patterns your transactions are telling us.</div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Recurring subscriptions</h3>
          {subscriptions.length === 0 ? (
            <div className="empty-state">No recurring subscriptions detected yet — they show up once a merchant repeats a few months in a row.</div>
          ) : (
            subscriptions.map((s) => (
              <div key={s.merchant} className="insight-card ok">
                <strong>{s.merchant}</strong> — ~₹{s.average_amount.toLocaleString('en-IN')} every {s.avg_gap_days} days
                <div style={{ fontSize: 12.5, marginTop: 4, color: 'var(--ink-soft)' }}>
                  Last charged {s.last_charged} · seen {s.occurrences} times
                </div>
              </div>
            ))
          )}
        </div>

        <div className="card">
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>This month's anomalies</h3>
          {anomalies.length === 0 ? (
            <div className="empty-state">Nothing unusual this month — spending is in line with your recent average.</div>
          ) : (
            anomalies.map((a) => (
              <div key={a.category_id} className="insight-card danger">
                <strong>{a.category_name}</strong>: average ₹{a.average.toLocaleString('en-IN')} → this month ₹{a.current.toLocaleString('en-IN')}
                <div style={{ fontSize: 12.5, marginTop: 4 }}>You spent {a.pct_change}% more than usual.</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
