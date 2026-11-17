import { fmtDate, peso } from '@/lib/partner'
import type { SettlementLine } from '@/lib/consignment'

// Lines of a consignment settlement grouped by product (and branch when several).
export default function SettlementPreview({ lines, locName }: { lines: SettlementLine[]; locName: Map<string, string> }) {
  const multi = new Set(lines.map(l => l.location_id)).size > 1
  const groups = new Map<string, { label: string; units: number; amount: number; orders: Set<string> }>()
  for (const l of lines) {
    const key = `${l.location_id}|${l.product_id}`
    const g = groups.get(key) ?? { label: `${multi ? `${locName.get(l.location_id) ?? ''} — ` : ''}${l.product_name}`, units: 0, amount: 0, orders: new Set<string>() }
    g.units += l.units; g.amount += l.amount_php; g.orders.add(l.order_number)
    groups.set(key, g)
  }
  const units = lines.reduce((s, l) => s + l.units, 0)
  const amount = lines.reduce((s, l) => s + l.amount_php, 0)
  return (
    <div className="pp-table-wrap">
      <table className="pp-table">
        <thead><tr><th>Product</th><th>From orders</th><th className="pp-num">Boxes sold</th><th className="pp-num">Amount</th></tr></thead>
        <tbody>
          {[...groups.values()].map(g => (
            <tr key={g.label}><td>{g.label}</td><td className="pp-muted" style={{ fontSize: 13 }}>{[...g.orders].join(', ')}</td><td className="pp-num">{g.units}</td><td className="pp-num">{peso(g.amount)}</td></tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={2}>Total</td><td className="pp-num">{units}</td><td className="pp-num">{peso(amount)}</td></tr></tfoot>
      </table>
    </div>
  )
}

export function periodLabel(from: string, to: string) {
  return from === to ? fmtDate(from) : `${fmtDate(from)} – ${fmtDate(to)}`
}
