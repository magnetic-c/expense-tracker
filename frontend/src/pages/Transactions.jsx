import React, { useEffect, useState } from 'react';
import api from '../api/client.js';
import MonthPicker from '../components/MonthPicker.jsx';
import TransactionModal from '../components/TransactionModal.jsx';

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Transactions() {
  const [month, setMonth] = useState(currentMonth());
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [t, c] = await Promise.all([
      api.get('/transactions', { params: { month } }),
      api.get('/categories')
    ]);
    setTransactions(t.data);
    setCategories(c.data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [month]);

  async function handleSave(form) {
    if (editing) {
      await api.put(`/transactions/${editing.id}`, form);
    } else {
      await api.post('/transactions', form);
    }
    setModalOpen(false);
    setEditing(null);
    load();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this transaction?')) return;
    await api.delete(`/transactions/${id}`);
    load();
  }

  function openEdit(t) {
    setEditing(t);
    setModalOpen(true);
  }

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Transactions</h1>
          <div className="sub">Every rupee, logged and categorized.</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <MonthPicker value={month} onChange={setMonth} />
          <button className="btn" onClick={openAdd}>+ Add transaction</button>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">No transactions for this month yet. Add your first one above.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Merchant</th>
                <th>Category</th>
                <th>Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.txn_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                  <td>
                    {t.merchant || '—'}
                    {t.description ? <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{t.description}</div> : null}
                  </td>
                  <td>
                    {t.category_name ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 99, background: t.category_color, display: 'inline-block' }} />
                        {t.category_name}
                        {t.auto_categorized && <span style={{ fontSize: 11, color: 'var(--teal)' }}>(auto)</span>}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--ink-soft)' }}>Uncategorized</span>
                    )}
                  </td>
                  <td className={t.type === 'income' ? 'amount-income' : 'amount-expense'}>
                    {t.type === 'income' ? '+' : '-'}₹{Number(t.amount).toLocaleString('en-IN')}
                  </td>
                  <td>
                    <button className="btn secondary" style={{ padding: '6px 10px', marginRight: 6 }} onClick={() => openEdit(t)}>Edit</button>
                    <button className="btn danger" style={{ padding: '6px 10px' }} onClick={() => handleDelete(t.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <TransactionModal
          categories={categories}
          initial={editing}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
