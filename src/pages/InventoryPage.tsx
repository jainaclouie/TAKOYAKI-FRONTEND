import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, errorMessage } from '../api/client';
import type { Ingredient, StockMovement } from '../api/types';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { dateTime, MOVEMENT_LABEL, peso, qty } from '../lib/format';
import { useLoad } from '../lib/useLoad';

type Dialog =
  | { kind: 'edit'; ingredient: Ingredient | null }
  | { kind: 'restock'; ingredient: Ingredient }
  | { kind: 'adjust'; ingredient: Ingredient }
  | { kind: 'history'; ingredient: Ingredient };

export default function InventoryPage() {
  const { isOwner } = useAuth();
  const { data, loading, error, reload } = useLoad<Ingredient[]>(
    async () => (await api.get<{ data: Ingredient[] }>('/ingredients')).data.data,
    [],
  );
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const all = data ?? [];
  const lowCount = all.filter((i) => i.is_active && i.is_low).length;
  const shown = all.filter(
    (i) => i.name.toLowerCase().includes(search.trim().toLowerCase()) && (!onlyLow || i.is_low),
  );

  const close = () => setDialog(null);
  const done = () => {
    setDialog(null);
    reload();
  };

  const remove = async (i: Ingredient) => {
    if (!window.confirm(`Delete "${i.name}"?`)) return;
    setActionError(null);
    try {
      await api.delete(`/ingredients/${i.id}`);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>Inventory</h1>
        {isOwner && (
          <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'edit', ingredient: null })}>
            Add ingredient
          </button>
        )}
      </div>

      {lowCount > 0 && (
        <div className="alert alert-warn">
          {lowCount} {lowCount === 1 ? 'ingredient is' : 'ingredients are'} at or below the reorder level.
        </div>
      )}
      {(error || actionError) && <div className="alert alert-error">{error ?? actionError}</div>}

      <div className="filters">
        <label className="field grow">
          <span>Search</span>
          <input className="input" placeholder="Ingredient name" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />
          <span>Low stock only</span>
        </label>
      </div>

      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Ingredient</th>
              <th className="num">In stock</th>
              <th className="num">Reorder at</th>
              {isOwner && <th className="num">Cost per unit</th>}
              <th>Status</th>
              {isOwner && <th />}
            </tr>
          </thead>
          <tbody>
            {shown.map((i) => (
              <tr key={i.id} className={i.is_active ? '' : 'row-off'}>
                <td>
                  <strong>{i.name}</strong>
                </td>
                <td className={`num ${i.stock_qty < 0 ? 'text-bad' : ''}`}>
                  {qty(i.stock_qty)} {i.unit}
                </td>
                <td className="num">
                  {qty(i.reorder_level)} {i.unit}
                </td>
                {isOwner && <td className="num">{peso(i.cost_per_unit ?? 0)}</td>}
                <td>
                  {!i.is_active ? (
                    <span className="badge badge-off">Inactive</span>
                  ) : i.is_low ? (
                    <span className="badge badge-low">Low</span>
                  ) : (
                    <span className="badge badge-ok">OK</span>
                  )}
                </td>
                {isOwner && (
                  <td className="actions">
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => setDialog({ kind: 'restock', ingredient: i })}>
                      Restock
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setDialog({ kind: 'adjust', ingredient: i })}>
                      Adjust
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setDialog({ kind: 'history', ingredient: i })}>
                      History
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => setDialog({ kind: 'edit', ingredient: i })}>
                      Edit
                    </button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => void remove(i)}>
                      Delete
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {!loading && shown.length === 0 && (
              <tr>
                <td colSpan={isOwner ? 6 : 4} className="empty-cell">
                  {all.length === 0 ? 'No ingredients yet.' : 'No ingredients match.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {loading && <p className="muted pad">Loading…</p>}
      </div>

      {dialog?.kind === 'edit' && <IngredientForm ingredient={dialog.ingredient} onClose={close} onSaved={done} />}
      {dialog?.kind === 'restock' && <RestockForm ingredient={dialog.ingredient} onClose={close} onSaved={done} />}
      {dialog?.kind === 'adjust' && <AdjustForm ingredient={dialog.ingredient} onClose={close} onSaved={done} />}
      {dialog?.kind === 'history' && <HistoryModal ingredient={dialog.ingredient} onClose={close} />}
    </div>
  );
}

interface FormProps {
  ingredient: Ingredient | null;
  onClose: () => void;
  onSaved: () => void;
}

function IngredientForm({ ingredient, onClose, onSaved }: FormProps) {
  const [name, setName] = useState(ingredient?.name ?? '');
  const [unit, setUnit] = useState(ingredient?.unit ?? 'g');
  const [stock, setStock] = useState('');
  const [reorder, setReorder] = useState(ingredient ? String(ingredient.reorder_level) : '');
  const [cost, setCost] = useState(ingredient ? String(ingredient.cost_per_unit ?? 0) : '');
  const [active, setActive] = useState(ingredient?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      unit: unit.trim(),
      reorder_level: Number(reorder) || 0,
      cost_per_unit: Number(cost) || 0,
      is_active: active,
    };
    try {
      if (ingredient) {
        await api.put(`/ingredients/${ingredient.id}`, payload);
      } else {
        await api.post('/ingredients', { ...payload, stock_qty: Number(stock) || 0 });
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={ingredient ? 'Edit ingredient' : 'Add ingredient'} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <div className="grid-2">
          <label className="field">
            <span>Name</span>
            <input className="input" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span>Unit</span>
            <input className="input" required maxLength={20} list="unit-list" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <datalist id="unit-list">
              <option value="g" />
              <option value="kg" />
              <option value="ml" />
              <option value="l" />
              <option value="pcs" />
            </datalist>
          </label>
          {!ingredient && (
            <label className="field">
              <span>Opening stock ({unit || 'unit'})</span>
              <input className="input" inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} />
            </label>
          )}
          <label className="field">
            <span>Reorder level ({unit || 'unit'})</span>
            <input className="input" inputMode="decimal" value={reorder} onChange={(e) => setReorder(e.target.value)} />
          </label>
          <label className="field">
            <span>Cost per {unit || 'unit'} (₱)</span>
            <input className="input" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>Active</span>
          </label>
        </div>
        {ingredient && <p className="muted small">To change how much is in stock, use Restock or Adjust so the change is logged.</p>}
        {error && <div className="alert alert-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save ingredient'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RestockForm({ ingredient, onClose, onSaved }: FormProps & { ingredient: Ingredient }) {
  const [amount, setAmount] = useState('');
  const [paid, setPaid] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const amountNum = Number(amount) || 0;
  const unitCost = amountNum > 0 && paid !== '' ? Number(paid) / amountNum : null;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/ingredients/${ingredient.id}/restock`, {
        quantity: amountNum,
        total_cost: paid === '' ? undefined : Number(paid),
        note: note.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Restock ${ingredient.name}`} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <p className="muted">
          Currently {qty(ingredient.stock_qty)} {ingredient.unit} in stock.
        </p>
        <label className="field">
          <span>Quantity bought ({ingredient.unit})</span>
          <input className="input" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Total paid (₱, optional)</span>
          <input className="input" inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} />
        </label>
        {unitCost !== null && Number.isFinite(unitCost) && (
          <p className="muted small">
            That is {peso(unitCost)} per {ingredient.unit}. The ingredient cost is updated using a weighted average with what is already in stock.
          </p>
        )}
        <label className="field">
          <span>Note (optional)</span>
          <input className="input" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Supplier, receipt number…" />
        </label>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || amountNum <= 0}>
            {saving ? 'Saving…' : 'Add to stock'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function AdjustForm({ ingredient, onClose, onSaved }: FormProps & { ingredient: Ingredient }) {
  const [type, setType] = useState<'count' | 'waste'>('count');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post(`/ingredients/${ingredient.id}/adjust`, {
        type,
        quantity: Number(amount),
        note: note.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Adjust ${ingredient.name}`} onClose={onClose}>
      <form onSubmit={onSubmit}>
        <p className="muted">
          Currently {qty(ingredient.stock_qty)} {ingredient.unit} in stock.
        </p>
        <div className="chips" role="radiogroup" aria-label="Adjustment type">
          <button type="button" role="radio" aria-checked={type === 'count'} className={`chip${type === 'count' ? ' chip-on' : ''}`} onClick={() => setType('count')}>
            Stock count
          </button>
          <button type="button" role="radio" aria-checked={type === 'waste'} className={`chip${type === 'waste' ? ' chip-on' : ''}`} onClick={() => setType('waste')}>
            Waste
          </button>
        </div>
        <label className="field">
          <span>{type === 'count' ? `Counted quantity (${ingredient.unit})` : `Amount wasted (${ingredient.unit})`}</span>
          <input className="input" required inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>Note (optional)</span>
          <input className="input" maxLength={255} value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === 'waste' ? 'Spoiled, spilled…' : 'End-of-day count'} />
        </label>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || amount === ''}>
            {saving ? 'Saving…' : type === 'count' ? 'Set stock' : 'Record waste'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function HistoryModal({ ingredient, onClose }: { ingredient: Ingredient; onClose: () => void }) {
  const { data, loading, error } = useLoad<StockMovement[]>(
    async () => (await api.get<{ data: StockMovement[] }>(`/ingredients/${ingredient.id}/movements`)).data.data,
    [ingredient.id],
  );
  const rows = data ?? [];

  return (
    <Modal title={`${ingredient.name} history`} onClose={onClose} wide>
      {error && <div className="alert alert-error">{error}</div>}
      {loading && <p className="muted">Loading…</p>}
      {!loading && rows.length === 0 && <p className="muted">No stock changes yet.</p>}
      {rows.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>What happened</th>
              <th className="num">Change</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.id}>
                <td>{dateTime(m.created_at)}</td>
                <td>
                  {MOVEMENT_LABEL[m.type] ?? m.type}
                  {m.note ? <div className="muted small">{m.note}</div> : null}
                </td>
                <td className={`num ${m.quantity < 0 ? 'text-bad' : 'text-good'}`}>
                  {m.quantity > 0 ? '+' : ''}
                  {qty(m.quantity)} {ingredient.unit}
                </td>
                <td>{m.user ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted small">Showing the latest 50 changes.</p>
    </Modal>
  );
}
