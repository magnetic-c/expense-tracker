import React, { useState, useEffect } from 'react';

export default function TransactionModal({ categories, initial, onClose, onSave }) {
  const [form, setForm] = useState({
    amount: initial?.amount || '',
    type: initial?.type || 'expense',
    merchant: initial?.merchant || '',
    description: initial?.description || '',
    txn_date: initial?.txn_date ? initial.txn_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
    category_id: initial?.category_id || ''
  });
  const [saving, setSaving] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({ ...form, category_id: form.category_id || null });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginBottom: 18 }}>{initial ? 'Edit transaction' : 'Add transaction'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Type</label>
            <select value={form.type} onChange={(e) => update('type', e.target.value)}>
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div className="field">
            <label>Amount (₹)</label>
            <input type="number" step="0.01" value={form.amount} onChange={(e) => update('amount', e.target.value)} required />
          </div>
          <div className="field">
            <label>Merchant / Payee</label>
            <input
              value={form.merchant}
              onChange={(e) => update('merchant', e.target.value)}
              placeholder="e.g. Swiggy, Uber, Amazon"
            />
          </div>
          <div className="field">
            <label>Description (optional)</label>
            <input value={form.description} onChange={(e) => update('description', e.target.value)} />
          </div>
          <div className="field">
            <label>Date</label>
            <input type="date" value={form.txn_date} onChange={(e) => update('txn_date', e.target.value)} required />
          </div>
          <div className="field">
            <label>Category {!form.category_id && <span style={{ fontWeight: 400, color: 'var(--ink-soft)' }}>(leave blank to auto-detect)</span>}</label>
            <select value={form.category_id} onChange={(e) => update('category_id', e.target.value)}>
              <option value="">Auto-detect from merchant</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn secondary" onClick={onClose} style={{ flex: 1 }}>Cancel</button>
            <button type="submit" className="btn" disabled={saving} style={{ flex: 1 }}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
