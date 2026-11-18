import { useState } from 'react';
import { api, errorMessage } from '../api/client';
import type { Order, Paginated } from '../api/types';
import Modal from '../components/Modal';
import { useAuth } from '../context/AuthContext';
import { dateTime, METHOD_LABEL, monthStartISO, peso, todayISO } from '../lib/format';
import { useLoad } from '../lib/useLoad';
import { Receipt } from './PosPage';

export default function OrdersPage() {
  const { isOwner } = useAuth();
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState(todayISO());
  const [to, setTo] = useState(todayISO());
  const [status, setStatus] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, loading, error, reload } = useLoad<Paginated<Order>>(
    async () => {
      const params: Record<string, string | number> = { page };
      if (isOwner) {
        if (from) params.from = from;
        if (to) params.to = to;
        if (status) params.status = status;
      }
      return (await api.get<Paginated<Order>>('/orders', { params })).data;
    },
    [page, from, to, status, isOwner],
  );

  const orders = data?.data ?? [];
  const meta = data?.meta;

  const voidOrder = async (order: Order) => {
    if (!window.confirm(`Void ${order.order_number}? The ingredients it used go back into stock.`)) return;
    setActionError(null);
    try {
      const res = await api.post<{ data: Order }>(`/orders/${order.id}/void`);
      setSelected(res.data.data);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    }
  };

  const setRange = (f: string, t: string) => {
    setFrom(f);
    setTo(t);
    setPage(1);
  };

  return (
    <div>
      <div className="page-head">
        <h1>Orders</h1>
        {!isOwner && <p className="muted">Your orders from today.</p>}
      </div>

      {isOwner && (
        <div className="filters">
          <label className="field">
            <span>From</span>
            <input className="input" type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          </label>
          <label className="field">
            <span>To</span>
            <input className="input" type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
          </label>
          <label className="field">
            <span>Status</span>
            <select className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="completed">Completed</option>
              <option value="voided">Voided</option>
            </select>
          </label>
          <div className="quick">
            <button type="button" className="chip" onClick={() => setRange(todayISO(), todayISO())}>
              Today
            </button>
            <button type="button" className="chip" onClick={() => setRange(monthStartISO(), todayISO())}>
              This month
            </button>
            <button type="button" className="chip" onClick={() => setRange('', '')}>
              All time
            </button>
          </div>
        </div>
      )}

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card table-card">
        <table className="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Time</th>
              <th>Items</th>
              <th>Payment</th>
              <th className="num">Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="row-click" onClick={() => { setActionError(null); setSelected(o); }}>
                <td>
                  <button type="button" className="link" onClick={() => { setActionError(null); setSelected(o); }}>
                    {o.order_number}
                  </button>
                </td>
                <td>{dateTime(o.created_at)}</td>
                <td className="cell-wrap">
                  {o.items?.map((i) => `${i.quantity} × ${i.product_name}`).join(', ')}
                </td>
                <td>{METHOD_LABEL[o.payment_method]}</td>
                <td className="num">{peso(o.total)}</td>
                <td>
                  <span className={`badge ${o.status === 'voided' ? 'badge-void' : 'badge-ok'}`}>
                    {o.status === 'voided' ? 'Voided' : 'Completed'}
                  </span>
                </td>
              </tr>
            ))}
            {!loading && orders.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-cell">
                  No orders found for this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {loading && <p className="muted pad">Loading…</p>}
      </div>

      {meta && meta.last_page > 1 && (
        <div className="pager">
          <button type="button" className="btn btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </button>
          <span>
            Page {meta.current_page} of {meta.last_page} ({meta.total} orders)
          </span>
          <button type="button" className="btn btn-sm" disabled={page >= meta.last_page} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}

      {selected && (
        <Modal title={selected.order_number} onClose={() => setSelected(null)}>
          {selected.status === 'voided' && (
            <div className="alert alert-warn">
              This order was voided{selected.voided_at ? ` on ${dateTime(selected.voided_at)}` : ''}.
            </div>
          )}
          <Receipt order={selected} />
          {isOwner && selected.total_cost !== undefined && selected.profit !== undefined && (
            <p className="muted">
              Ingredient cost {peso(selected.total_cost)}, profit {peso(selected.profit)}.
            </p>
          )}
          {actionError && <div className="alert alert-error">{actionError}</div>}
          <div className="modal-actions">
            {isOwner && selected.status === 'completed' && (
              <button type="button" className="btn btn-danger" onClick={() => void voidOrder(selected)}>
                Void order
              </button>
            )}
            <button type="button" className="btn" onClick={() => window.print()}>
              Print receipt
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
