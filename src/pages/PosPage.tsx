import { useMemo, useState } from 'react';
import { api, errorMessage } from '../api/client';
import type { Order, PaymentMethod, Product } from '../api/types';
import Modal from '../components/Modal';
import { BUSINESS_NAME, dateTime, METHOD_LABEL, peso } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const METHODS: PaymentMethod[] = ['cash', 'gcash', 'maya', 'other'];

export default function PosPage() {
  const {
    data: products,
    loading,
    error: loadError,
    reload,
  } = useLoad<Product[]>(async () => (await api.get<{ data: Product[] }>('/products')).data.data, []);

  const [cart, setCart] = useState<Record<number, number>>({});
  const [category, setCategory] = useState('All');
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [tendered, setTendered] = useState('');
  const [discount, setDiscount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<Order | null>(null);

  const list = useMemo(() => products ?? [], [products]);
  const categories = useMemo(() => ['All', ...Array.from(new Set(list.map((p) => p.category)))], [list]);
  const visible = category === 'All' ? list : list.filter((p) => p.category === category);

  const lines = useMemo(
    () =>
      list
        .filter((p) => (cart[p.id] ?? 0) > 0)
        .map((p) => ({ product: p, quantity: cart[p.id], total: p.price * cart[p.id] })),
    [list, cart],
  );

  const subtotal = lines.reduce((sum, l) => sum + l.total, 0);
  const discountNum = Math.min(Math.max(Number(discount) || 0, 0), subtotal);
  const total = Math.round((subtotal - discountNum) * 100) / 100;
  const tenderedNum = Number(tendered) || 0;
  const change = payment === 'cash' ? Math.max(0, tenderedNum - total) : 0;
  const canCharge = lines.length > 0 && !submitting && (payment !== 'cash' || tenderedNum + 0.001 >= total);

  const add = (p: Product) => {
    const inCart = cart[p.id] ?? 0;
    if (p.servings_available !== null && inCart >= p.servings_available) return;
    setCart((c) => ({ ...c, [p.id]: inCart + 1 }));
  };

  const adjust = (p: Product, delta: number) => {
    const next = (cart[p.id] ?? 0) + delta;
    if (delta > 0 && p.servings_available !== null && next > p.servings_available) return;
    setCart((c) => {
      const copy = { ...c };
      if (next <= 0) delete copy[p.id];
      else copy[p.id] = next;
      return copy;
    });
  };

  const clearAll = () => {
    setCart({});
    setTendered('');
    setDiscount('');
    setNote('');
    setError(null);
  };

  const charge = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await api.post<{ data: Order }>('/orders', {
        items: lines.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
        discount: discountNum,
        payment_method: payment,
        amount_tendered: payment === 'cash' ? tenderedNum : undefined,
        customer_note: note.trim() || undefined,
      });
      setReceipt(res.data.data);
      clearAll();
      reload(); // refresh servings left
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const quickCash = [100, 200, 500, 1000];

  return (
    <div>
      <div className="page-head">
        <h1>New order</h1>
      </div>

      {loadError && <div className="alert alert-error">{loadError}</div>}

      <div className="pos">
        <section aria-label="Menu">
          <div className="chips" role="tablist" aria-label="Menu category">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={category === c}
                className={`chip${category === c ? ' chip-on' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>

          {loading && !products && <p className="muted">Loading menu…</p>}
          {!loading && list.length === 0 && !loadError && (
            <div className="empty">No products yet. The owner can add some on the Products page.</div>
          )}

          <div className="tiles">
            {visible.map((p) => {
              const inCart = cart[p.id] ?? 0;
              const soldOut = p.servings_available === 0;
              const atLimit = p.servings_available !== null && inCart >= p.servings_available;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`tile${inCart > 0 ? ' tile-on' : ''}`}
                  disabled={soldOut || atLimit}
                  onClick={() => add(p)}
                  aria-label={`Add ${p.name}, ${peso(p.price)}`}
                >
                  {inCart > 0 && <span className="tile-count">{inCart}</span>}
                  <span className="tile-name">{p.name}</span>
                  <span className="tile-price">{peso(p.price)}</span>
                  <span className={`tile-stock${soldOut ? ' tile-stock-out' : ''}`}>
                    {p.servings_available === null
                      ? 'Stock not tracked'
                      : soldOut
                        ? 'Out of stock'
                        : `${p.servings_available} can be made`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="ticket-wrap" aria-label="Current order">
          <div className="ticket">
            <div className="ticket-head">
              <h2>Current order</h2>
              {lines.length > 0 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>
                  Clear
                </button>
              )}
            </div>

            {lines.length === 0 ? (
              <p className="muted ticket-empty">Tap a product to start an order.</p>
            ) : (
              <ul className="ticket-lines">
                {lines.map((l) => (
                  <li key={l.product.id}>
                    <div className="ticket-line-name">{l.product.name}</div>
                    <div className="ticket-line-row">
                      <div className="stepper">
                        <button type="button" aria-label={`Remove one ${l.product.name}`} onClick={() => adjust(l.product, -1)}>
                          −
                        </button>
                        <span aria-live="polite">{l.quantity}</span>
                        <button type="button" aria-label={`Add one ${l.product.name}`} onClick={() => adjust(l.product, 1)}>
                          +
                        </button>
                      </div>
                      <span className="num">{peso(l.total)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="ticket-sum">
              <div className="row">
                <span>Subtotal</span>
                <span className="num">{peso(subtotal)}</span>
              </div>
              <label className="row row-input">
                <span>Discount</span>
                <input
                  className="input input-sm num"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </label>
              <div className="row row-total">
                <span>Total</span>
                <span className="num">{peso(total)}</span>
              </div>
            </div>

            <div className="methods" role="radiogroup" aria-label="Payment method">
              {METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={payment === m}
                  className={`chip${payment === m ? ' chip-on' : ''}`}
                  onClick={() => setPayment(m)}
                >
                  {METHOD_LABEL[m]}
                </button>
              ))}
            </div>

            {payment === 'cash' && (
              <div className="cash">
                <label className="row row-input">
                  <span>Cash received</span>
                  <input
                    className="input input-sm num"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                  />
                </label>
                <div className="quick">
                  <button type="button" className="chip" onClick={() => setTendered(String(total))} disabled={total <= 0}>
                    Exact
                  </button>
                  {quickCash.map((n) => (
                    <button key={n} type="button" className="chip" onClick={() => setTendered(String(n))}>
                      {n}
                    </button>
                  ))}
                </div>
                <div className="row">
                  <span>Change</span>
                  <span className="num change">{peso(change)}</span>
                </div>
              </div>
            )}

            <input
              className="input"
              placeholder="Note (optional)"
              maxLength={255}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            {error && (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            )}

            <button type="button" className="btn btn-primary btn-block btn-lg" disabled={!canCharge} onClick={() => void charge()}>
              {submitting ? 'Saving…' : `Charge ${peso(total)}`}
            </button>
          </div>
        </aside>
      </div>

      {receipt && (
        <Modal title="Order complete" onClose={() => setReceipt(null)}>
          <Receipt order={receipt} />
          <div className="modal-actions">
            <button type="button" className="btn" onClick={() => window.print()}>
              Print receipt
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setReceipt(null)} autoFocus>
              New order
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function Receipt({ order }: { order: Order }) {
  return (
    <div className="receipt">
      <div className="receipt-head">
        <strong>{BUSINESS_NAME}</strong>
        <span>{order.order_number}</span>
        <span>{dateTime(order.created_at)}</span>
        {order.cashier && <span>Cashier: {order.cashier}</span>}
      </div>
      <table className="receipt-table">
        <tbody>
          {order.items?.map((item, i) => (
            <tr key={i}>
              <td>
                {item.quantity} × {item.product_name}
              </td>
              <td className="num">{peso(item.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="receipt-sum">
        <div className="row">
          <span>Subtotal</span>
          <span className="num">{peso(order.subtotal)}</span>
        </div>
        {order.discount > 0 && (
          <div className="row">
            <span>Discount</span>
            <span className="num">−{peso(order.discount)}</span>
          </div>
        )}
        <div className="row row-total">
          <span>Total</span>
          <span className="num">{peso(order.total)}</span>
        </div>
        <div className="row">
          <span>{METHOD_LABEL[order.payment_method]}</span>
          <span className="num">{peso(order.amount_tendered ?? order.total)}</span>
        </div>
        {order.payment_method === 'cash' && (
          <div className="row">
            <span>Change</span>
            <span className="num change">{peso(order.change_due)}</span>
          </div>
        )}
      </div>
      {order.customer_note && <p className="muted">Note: {order.customer_note}</p>}
    </div>
  );
}
