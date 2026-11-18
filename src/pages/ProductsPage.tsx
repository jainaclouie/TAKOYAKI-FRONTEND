import { useState } from 'react';
import type { FormEvent } from 'react';
import { api, errorMessage } from '../api/client';
import type { Ingredient, Product } from '../api/types';
import Modal from '../components/Modal';
import { peso, qty } from '../lib/format';
import { useLoad } from '../lib/useLoad';

interface RecipeRow {
  ingredient_id: number | '';
  quantity: string;
}

export default function ProductsPage() {
  const products = useLoad<Product[]>(async () => (await api.get<{ data: Product[] }>('/products')).data.data, []);
  const ingredients = useLoad<Ingredient[]>(
    async () => (await api.get<{ data: Ingredient[] }>('/ingredients')).data.data,
    [],
  );

  const [editing, setEditing] = useState<Product | 'new' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const list = products.data ?? [];
  const categories = Array.from(new Set(list.map((p) => p.category)));

  const remove = async (p: Product) => {
    if (!window.confirm(`Delete "${p.name}"? Past orders keep their records.`)) return;
    setActionError(null);
    try {
      await api.delete(`/products/${p.id}`);
      products.reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  return (
    <div>
      <div className="page-head">
        <h1>Products</h1>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          Add product
        </button>
      </div>

      {(products.error || ingredients.error || actionError) && (
        <div className="alert alert-error">{products.error ?? ingredients.error ?? actionError}</div>
      )}

      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th className="num">Price</th>
              <th className="num">Ingredient cost</th>
              <th className="num">Margin</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const cost = p.unit_cost ?? 0;
              const margin = p.price > 0 ? ((p.price - cost) / p.price) * 100 : 0;
              return (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    {(p.recipe?.length ?? 0) === 0 && <div className="muted small">No recipe, so stock is not tracked</div>}
                  </td>
                  <td>{p.category}</td>
                  <td className="num">{peso(p.price)}</td>
                  <td className="num">{peso(cost)}</td>
                  <td className={`num ${margin < 30 ? 'text-bad' : ''}`}>{margin.toFixed(0)}%</td>
                  <td>
                    <span className={`badge ${p.is_active ? 'badge-ok' : 'badge-off'}`}>
                      {p.is_active ? 'On menu' : 'Hidden'}
                    </span>
                  </td>
                  <td className="actions">
                    <button type="button" className="btn btn-sm" onClick={() => setEditing(p)}>
                      Edit
                    </button>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => void remove(p)}>
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
            {!products.loading && list.length === 0 && (
              <tr>
                <td colSpan={7} className="empty-cell">
                  No products yet. Add your first one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {products.loading && <p className="muted pad">Loading…</p>}
      </div>

      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          ingredients={ingredients.data ?? []}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            products.reload();
          }}
        />
      )}
    </div>
  );
}

interface ProductFormProps {
  product: Product | null;
  ingredients: Ingredient[];
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}

function ProductForm({ product, ingredients, categories, onClose, onSaved }: ProductFormProps) {
  const [name, setName] = useState(product?.name ?? '');
  const [category, setCategory] = useState(product?.category ?? categories[0] ?? 'Takoyaki');
  const [price, setPrice] = useState(product ? String(product.price) : '');
  const [active, setActive] = useState(product?.is_active ?? true);
  const [rows, setRows] = useState<RecipeRow[]>(
    product?.recipe?.map((r) => ({ ingredient_id: r.ingredient_id, quantity: String(r.quantity) })) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const byId = new Map(ingredients.map((i) => [i.id, i]));

  const cost = rows.reduce((sum, r) => {
    const ing = r.ingredient_id === '' ? undefined : byId.get(r.ingredient_id);
    return sum + (ing ? (Number(r.quantity) || 0) * (ing.cost_per_unit ?? 0) : 0);
  }, 0);
  const priceNum = Number(price) || 0;
  const margin = priceNum > 0 ? ((priceNum - cost) / priceNum) * 100 : 0;

  const updateRow = (index: number, patch: Partial<RecipeRow>) =>
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const recipe = rows
      .filter((r) => r.ingredient_id !== '' && Number(r.quantity) > 0)
      .map((r) => ({ ingredient_id: r.ingredient_id as number, quantity: Number(r.quantity) }));

    const payload = { name: name.trim(), category: category.trim(), price: priceNum, is_active: active, recipe };

    try {
      if (product) {
        await api.put(`/products/${product.id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={product ? 'Edit product' : 'Add product'} onClose={onClose} wide>
      <form onSubmit={onSubmit}>
        <div className="grid-2">
          <label className="field">
            <span>Name</span>
            <input className="input" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>
          <label className="field">
            <span>Category</span>
            <input className="input" required maxLength={60} list="category-list" value={category} onChange={(e) => setCategory(e.target.value)} />
            <datalist id="category-list">
              {categories.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>Price (₱)</span>
            <input className="input" required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <span>Show on the order screen</span>
          </label>
        </div>

        <h3 className="section-title">Recipe</h3>
        <p className="muted small">
          How much of each ingredient one unit of this product uses. Stock is deducted from these amounts every time it is sold.
        </p>

        {rows.map((row, i) => {
          const ing = row.ingredient_id === '' ? undefined : byId.get(row.ingredient_id);
          return (
            <div className="recipe-row" key={i}>
              <select
                className="input"
                aria-label="Ingredient"
                value={row.ingredient_id}
                onChange={(e) => updateRow(i, { ingredient_id: e.target.value === '' ? '' : Number(e.target.value) })}
              >
                <option value="">Choose ingredient</option>
                {ingredients.map((opt) => (
                  <option
                    key={opt.id}
                    value={opt.id}
                    disabled={rows.some((r, j) => j !== i && r.ingredient_id === opt.id)}
                  >
                    {opt.name}
                  </option>
                ))}
              </select>
              <input
                className="input num"
                aria-label="Quantity"
                inputMode="decimal"
                placeholder="0"
                value={row.quantity}
                onChange={(e) => updateRow(i, { quantity: e.target.value })}
              />
              <span className="unit">{ing?.unit ?? ''}</span>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
          );
        })}

        <button
          type="button"
          className="btn btn-sm"
          onClick={() => setRows((rs) => [...rs, { ingredient_id: '', quantity: '' }])}
        >
          Add ingredient
        </button>

        <div className="cost-summary">
          <span>Ingredient cost: <strong>{peso(cost)}</strong></span>
          <span className={margin < 30 ? 'text-bad' : ''}>
            Margin: <strong>{qty(margin, 0)}%</strong>
          </span>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save product'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
