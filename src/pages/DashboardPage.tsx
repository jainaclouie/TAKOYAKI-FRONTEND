import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { DashboardData, DashboardRange } from '../api/types';
import { METHOD_LABEL, peso, qty, shortDate } from '../lib/format';
import { useLoad } from '../lib/useLoad';

const RANGES: { value: DashboardRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
];

export default function DashboardPage() {
  const [range, setRange] = useState<DashboardRange>('today');
  const { data, loading, error } = useLoad<DashboardData>(
    async () => (await api.get<DashboardData>('/dashboard', { params: { range } })).data,
    [range],
  );

  return (
    <div>
      <div className="page-head">
        <h1>Dashboard</h1>
        <div className="chips" role="tablist" aria-label="Period">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              role="tab"
              aria-selected={range === r.value}
              className={`chip${range === r.value ? ' chip-on' : ''}`}
              onClick={() => setRange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {loading && !data && <p className="muted">Loading…</p>}

      {data && (
        <>
          <p className="muted">
            {data.from === data.to ? shortDate(data.from) : `${shortDate(data.from)} to ${shortDate(data.to)}`}
          </p>

          <div className="kpis">
            <Kpi label="Sales" value={peso(data.sales)} note={`${data.orders} ${data.orders === 1 ? 'order' : 'orders'}`} />
            <Kpi label="Items sold" value={qty(data.items_sold, 0)} note={`${peso(data.average_order)} average order`} />
            <Kpi label="Gross profit" value={peso(data.gross_profit)} note={`After ${peso(data.cost_of_goods)} ingredient cost`} />
            <Kpi label="Expenses" value={peso(data.expenses)} note="Rent, gas, salaries and so on" />
            <Kpi
              label="Net profit"
              value={peso(data.net_profit)}
              note={`${peso(data.ingredient_purchases)} spent on ingredients`}
              tone={data.net_profit < 0 ? 'bad' : 'good'}
            />
          </div>

          <div className="dash-grid">
            <section className="card">
              <SalesChart days={data.sales_by_day} />
            </section>

            <section className="card">
              <h2>Best sellers</h2>
              {data.top_products.length === 0 ? (
                <p className="muted">No sales in this period yet.</p>
              ) : (
                <ol className="rank">
                  {data.top_products.map((p) => (
                    <li key={p.name}>
                      <span className="rank-name">{p.name}</span>
                      <span className="muted">{p.quantity} sold</span>
                      <span className="num">{peso(p.revenue)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="card">
              <h2>Payment methods</h2>
              {data.payment_breakdown.length === 0 ? (
                <p className="muted">No sales in this period yet.</p>
              ) : (
                <ul className="rank">
                  {data.payment_breakdown.map((p) => (
                    <li key={p.method}>
                      <span className="rank-name">{METHOD_LABEL[p.method]}</span>
                      <span className="muted">{p.orders} {p.orders === 1 ? 'order' : 'orders'}</span>
                      <span className="num">{peso(p.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card">
              <h2>Needs restocking</h2>
              {data.low_stock.length === 0 ? (
                <p className="muted">Everything is above its reorder level.</p>
              ) : (
                <>
                  <ul className="rank">
                    {data.low_stock.map((i) => (
                      <li key={i.id}>
                        <span className="rank-name">{i.name}</span>
                        <span className="muted">reorder at {qty(i.reorder_level)} {i.unit}</span>
                        <span className="num text-bad">
                          {qty(i.stock_qty)} {i.unit}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/inventory" className="link">
                    Open inventory
                  </Link>
                </>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className={`kpi-value${tone === 'bad' ? ' text-bad' : ''}`}>{value}</div>
      <div className="kpi-note muted">{note}</div>
    </div>
  );
}

/** Single-series bar chart of the last 7 days, with a table view for accessibility. */
function SalesChart({ days }: { days: DashboardData['sales_by_day'] }) {
  const [active, setActive] = useState<number | null>(null);
  const [asTable, setAsTable] = useState(false);

  const max = Math.max(1, ...days.map((d) => d.sales));
  const focus = active !== null ? days[active] : days[days.length - 1];
  const focusLabel = active !== null ? shortDate(focus.date) : `Today, ${shortDate(focus.date)}`;

  return (
    <div>
      <div className="chart-head">
        <h2>Sales, last 7 days</h2>
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Show chart' : 'Show table'}
        </button>
      </div>

      {asTable ? (
        <table className="table">
          <thead>
            <tr>
              <th>Day</th>
              <th className="num">Orders</th>
              <th className="num">Sales</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date}>
                <td>{shortDate(d.date)}</td>
                <td className="num">{d.orders}</td>
                <td className="num">{peso(d.sales)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <p className="chart-readout" aria-live="polite">
            <strong>{peso(focus.sales)}</strong> from {focus.orders} {focus.orders === 1 ? 'order' : 'orders'} on {focusLabel}
          </p>
          <div className="bars" role="list" onMouseLeave={() => setActive(null)}>
            {days.map((d, i) => (
              <div
                key={d.date}
                role="listitem"
                className="bar-col"
                tabIndex={0}
                aria-label={`${shortDate(d.date)}: ${peso(d.sales)} from ${d.orders} orders`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                <div className="bar-track">
                  <div className="bar" style={{ height: `${Math.max(1, (d.sales / max) * 100)}%` }} />
                </div>
                <span className="bar-label">{d.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
