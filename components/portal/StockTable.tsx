import { fmtDate } from '@/lib/partner'
import type { StockLine } from '@/lib/forecast'

export default function StockTable({ rows }: { rows: StockLine[] }) {
  return (
    <div className="pp-table-wrap">
      <table className="pp-table">
        <thead><tr><th>Product</th><th className="pp-num">On hand</th><th className="pp-num">On the way</th><th className="pp-num">Sold, 14 days</th><th className="pp-num">Forecast / day</th><th className="pp-num">Trend</th><th className="pp-num">Days left</th><th>Status</th></tr></thead>
        <tbody>
          {rows.map(s => (
            <tr key={`${s.location_id}${s.product_id}`}>
              <td>{s.product_name}</td>
              <td className="pp-num">{s.on_hand}</td>
              <td className="pp-num">{s.on_order || '—'}</td>
              <td className="pp-num">{s.sold_14}</td>
              <td className="pp-num">{s.avg_daily.toFixed(1)}</td>
              <td className="pp-num">{s.trend_pct === null ? '—' : `${s.trend_pct > 0 ? '▲' : s.trend_pct < 0 ? '▼' : ''} ${Math.abs(Math.round(s.trend_pct))}%`}</td>
              <td className="pp-num" title={s.stockout_date ? `Runs out around ${fmtDate(s.stockout_date)}` : undefined}>{s.days_cover === null ? '—' : Math.floor(s.days_cover)}</td>
              <td>{s.on_hand === 0 && s.on_order === 0 ? <span className="pp-badge pp-badge-bad">Out of stock</span>
                : s.needs_reorder ? <span className="pp-badge pp-badge-warn">Reorder {s.suggested_cases} cs</span>
                : <span className="pp-badge pp-badge-ok">OK</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
