import { fmtDate, peso, PAYMENT_TERMS, type PaymentTerms } from '@/lib/partner'
import { PRESETS, type Report } from '@/lib/reports'
import { Stat } from './ui'
import PrintButton from './PrintButton'

const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`)

export default function ReportView({ report, csvHref, title, extraParams = {}, filters }: {
  report: Report
  csvHref: (kind: string) => string
  title: string
  extraParams?: Record<string, string>
  filters?: React.ReactNode
}) {
  const { range, totals, orders } = report
  const max = Math.max(1, ...report.daily.map(d => d.units))
  const isAdmin = report.partners.length > 0 || 'partner' in extraParams

  return (
    <div className="pp-stack">
      <div className="pp-head" style={{ marginBottom: 0 }}>
        <div>
          <h1 className="pp-h1">{title}</h1>
          <p className="pp-muted">{fmtDate(range.from)} – {fmtDate(range.to)}</p>
        </div>
        <PrintButton />
      </div>

      <form method="get" className="pp-card pp-row no-print" style={{ alignItems: 'flex-end' }}>
        {Object.entries(extraParams).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {filters}
        <label><span className="pp-label">Period</span>
          <select className="pp-select" name="preset" defaultValue={range.preset} style={{ width: 'auto' }}>
            {Object.entries(PRESETS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            <option value="custom">Custom range</option>
          </select></label>
        <label><span className="pp-label">From</span><input className="pp-input" type="date" name="from" defaultValue={range.from} style={{ width: 'auto' }} /></label>
        <label><span className="pp-label">To</span><input className="pp-input" type="date" name="to" defaultValue={range.to} style={{ width: 'auto' }} /></label>
        <button className="pp-btn pp-btn-sm" type="submit">Update</button>
        <span className="pp-hint" style={{ flexBasis: '100%' }}>Choose “Custom range” to use the From/To dates.</span>
      </form>

      <div className="pp-grid">
        <Stat label="Boxes sold" value={totals.sold.toLocaleString()} sub={`${(totals.sold / 12).toFixed(1)} cases`} />
        <Stat label="Sales value" value={peso(totals.sales_value, 0)} sub="at recorded selling prices" />
        <Stat label="Sell-through" value={pct(totals.sell_through)} sub="sold ÷ (opening + received)" />
        <Stat label="Stock at end" value={totals.closing.toLocaleString()} sub="boxes" />
        <Stat label="Orders" value={orders.count} sub={`${orders.cases} cases · ${peso(orders.value, 0)}`} />
        <Stat label="Outstanding" value={peso(orders.outstanding, 0)} sub={orders.overdue > 0 ? `${peso(orders.overdue, 0)} overdue` : 'as of today'} />
      </div>

      <div className="pp-card">
        <div className="pp-row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <p className="pp-h2" style={{ marginBottom: 0 }}>Daily boxes sold</p>
          <a className="pp-link no-print" href={csvHref('daily')} style={{ fontSize: 13 }}>Download CSV</a>
        </div>
        {report.daily.length === 0 ? <p className="pp-empty">No sales recorded in this period.</p> : (
          <div role="img" aria-label={`Bar chart of daily boxes sold, peak ${max}`} style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 160, borderBottom: '1px solid rgba(201,144,106,0.25)', overflowX: 'auto' }}>
            {report.daily.map(d => (
              <div key={d.sale_date} className="pp-bar" title={`${fmtDate(d.sale_date)}: ${d.units} boxes · ${peso(d.sales_value, 0)}`}
                style={{ flex: '1 0 6px', maxWidth: 36, height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                <div style={{ width: '100%', height: `${Math.max(2, (d.units / max) * 100)}%`, background: 'var(--rose-gold)', borderRadius: '4px 4px 0 0' }} />
              </div>
            ))}
          </div>
        )}
        {report.daily.length > 0 && <p className="pp-hint" style={{ marginTop: 6 }}>Peak day: {max} boxes. Hover a bar for details.</p>}
      </div>

      <div className="pp-card">
        <div className="pp-row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
          <p className="pp-h2" style={{ marginBottom: 0 }}>Stock & sales by product</p>
          <a className="pp-link no-print" href={csvHref('products')} style={{ fontSize: 13 }}>Download CSV</a>
        </div>
        {report.products.length === 0 ? <p className="pp-empty">No stock activity in this period.</p> : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Product</th><th className="pp-num">Opening</th><th className="pp-num">Received</th><th className="pp-num">Sold</th><th className="pp-num">Adjusted</th><th className="pp-num">Closing</th><th className="pp-num">Sell-through</th><th className="pp-num">Sales value</th></tr></thead>
              <tbody>
                {report.products.map(p => (
                  <tr key={p.product_id}>
                    <td>{p.product_name}</td><td className="pp-num">{p.opening}</td><td className="pp-num">{p.received}</td><td className="pp-num">{p.sold}</td>
                    <td className="pp-num">{p.adjusted}</td><td className="pp-num">{p.closing}</td><td className="pp-num">{pct(p.sell_through)}</td><td className="pp-num">{peso(p.sales_value, 0)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td>Total</td><td className="pp-num">{totals.opening}</td><td className="pp-num">{totals.received}</td><td className="pp-num">{totals.sold}</td><td className="pp-num">{totals.adjusted}</td><td className="pp-num">{totals.closing}</td><td className="pp-num">{pct(totals.sell_through)}</td><td className="pp-num">{peso(totals.sales_value, 0)}</td></tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {report.partners.length > 0 && (
        <div className="pp-card">
          <div className="pp-row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <p className="pp-h2" style={{ marginBottom: 0 }}>By partner</p>
            <a className="pp-link no-print" href={csvHref('partners')} style={{ fontSize: 13 }}>Download CSV</a>
          </div>
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Partner</th><th className="pp-num">Boxes sold</th><th className="pp-num">Sales value</th><th className="pp-num">Sell-through</th><th className="pp-num">Stock</th><th className="pp-num">Ordered</th><th className="pp-num">Outstanding</th><th className="pp-num">Overdue</th></tr></thead>
              <tbody>
                {report.partners.map(p => (
                  <tr key={p.partner_id}>
                    <td><a className="pp-link" href={`/admin/partners/${p.partner_id}`}>{p.partner_name}</a></td>
                    <td className="pp-num">{p.sold}</td><td className="pp-num">{peso(p.sales_value, 0)}</td><td className="pp-num">{pct(p.sell_through)}</td>
                    <td className="pp-num">{p.closing}</td><td className="pp-num">{peso(p.order_value, 0)}</td><td className="pp-num">{peso(p.outstanding, 0)}</td>
                    <td className="pp-num" style={{ color: p.overdue > 0 ? '#e09a9a' : undefined }}>{peso(p.overdue, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="pp-grid-2">
        <div className="pp-card">
          <p className="pp-h2">Orders by payment terms</p>
          <table className="pp-table">
            <thead><tr><th>Terms</th><th className="pp-num">Orders</th><th className="pp-num">Value</th><th className="pp-num">Unpaid</th></tr></thead>
            <tbody>
              {(Object.keys(PAYMENT_TERMS) as PaymentTerms[]).map(t => (
                <tr key={t}><td>{PAYMENT_TERMS[t]}</td><td className="pp-num">{orders.byTerms[t].count}</td><td className="pp-num">{peso(orders.byTerms[t].value, 0)}</td><td className="pp-num">{peso(orders.byTerms[t].outstanding, 0)}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="pp-hint" style={{ marginTop: 8 }}>Orders placed in this period (cancelled orders excluded).</p>
        </div>
        <div className="pp-card">
          <div className="pp-row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
            <p className="pp-h2" style={{ marginBottom: 0 }}>Orders in period</p>
            <a className="pp-link no-print" href={csvHref('orders')} style={{ fontSize: 13 }}>Download CSV</a>
          </div>
          {orders.list.length === 0 ? <p className="pp-empty">No orders in this period.</p> : (
            <div className="pp-table-wrap" style={{ maxHeight: 320, overflowY: 'auto' }}>
              <table className="pp-table">
                <tbody>
                  {orders.list.slice(0, 50).map(o => (
                    <tr key={o.id}>
                      <td>{o.order_number}{isAdmin && o.partner_name && <><br /><span className="pp-muted" style={{ fontSize: 12 }}>{o.partner_name}</span></>}</td>
                      <td>{fmtDate(o.created_at)}</td>
                      <td>{o.cases} cs</td>
                      <td className="pp-num">{peso(o.total_php, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
