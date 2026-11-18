import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, errorMessage } from '../api/client';
import type { Expense, ExpensesResponse } from '../api/types';
import Modal from '../components/Modal';
import { monthStartISO, peso, shortDate, todayISO } from '../lib/format';
import { useLoad } from '../lib/useLoad';

export default function ExpensesPage() {
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [editing, setEditing] = useState<Expense | 'new' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, loading, error, reload } = useLoad<ExpensesResponse>(
    async () => (await api.get<ExpensesResponse>('/expenses', { params: { from, to } })).data,
    [from, to],
  );

  const expenses = data?.data ?? [];

  const remove = async (e: Expense) => {
    if (!window.confirm(`Delete this ${peso(e.amount)} ${e.category} expense?`)) return;
    setActionError(null);
    try {
      await api.delete(`/expenses/${e.id}`);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>Expenses</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          Add expense
        </button>
      </div>

      <p className="muted">
        Record running costs such as rent, gas, salaries and packaging. Ingredient purchases are tracked in Inventory, so leave them out here.
      </p>

      {(error || actionError) && <div className="alert alert-error">{error ?? actionError}</div>}

      <div className="filters">
        <label className="field">
          <span>From</span>
          <input className="input" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span>To</span>
          <input className="input" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="filter-total">
          <span className="muted">Total for this period</span>
          <strong>{peso(data?.total ?? 0)}</strong>
        </div>
      </div>

      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th className="num">Amount</th>
              <th>Recorded by</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id}>
                <td>{shortDate(e.expense_date)}</td>
                <td>{e.category}</td>
                <td className="cell-wrap">{e.description}</td>
                <td className="num">{peso(e.amount)}</td>
                <td>{e.recorded_by}</td>
                <td className="actions">
                  <button type="button" className="btn btn-sm" onClick={() => setEditing(e)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-sm btn-danger" onClick={() => void remove(e)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {!loading && expenses.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-cell">
                  No expenses in this period.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {loading && <p className="muted pad">Loading…</p>}
      </div>

      {editing && (
        <ExpenseForm
          expense={editing === 'new' ? null : editing}
          categories={data?.categories ?? ['Other']}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}

interface ExpenseFormProps {
  expense: Expense | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}

function ExpenseForm({ expense, categories, onClose, onSaved }: ExpenseFormProps) {
  const [category, setCategory] = useState(expense?.category ?? categories[0] ?? 'Other');
  const [description, setDescription] = useState(expense?.description ?? '');
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '');
  const [date, setDate] = useState(expense?.expense_date ?? todayISO());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      category,
      description: description.trim() || undefined,
      amount: Number(amount),
      expense_date: date,
    };
    try {
      if (expense) {
        await api.put(`/expenses/${expense.id}`, payload);
      } else {
        await api.post('/expenses', payload);
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={expense ? 'Edit expense' : 'Add expense'} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <div className="grid-2">
          <label className="field">
            <span>Date</span>
            <input className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Category</span>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Amount (₱)</span>
            <input className="input" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span>Description (optional)</span>
            <input className="input" maxLength={255} value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !(Number(amount) > 0)}>
            {saving ? 'Saving…' : 'Save expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
