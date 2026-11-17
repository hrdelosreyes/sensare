import { ORDER_STATUS, PARTNER_STATUS, type OrderStatus, type PartnerStatus, type PaymentStatus } from '@/lib/partner'

const orderCls: Record<OrderStatus, string> = {
  submitted: 'pp-badge-warn', confirmed: 'pp-badge-info', shipped: 'pp-badge-info', delivered: 'pp-badge-ok', cancelled: 'pp-badge-mute',
}
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`pp-badge ${orderCls[status]}`}>{ORDER_STATUS[status]}</span>
}

const payCls: Record<PaymentStatus, string> = { unpaid: 'pp-badge-bad', partial: 'pp-badge-warn', paid: 'pp-badge-ok' }
export function PaymentStatusBadge({ status, overdue }: { status: PaymentStatus; overdue?: boolean }) {
  if (overdue) return <span className="pp-badge pp-badge-bad">Overdue</span>
  return <span className={`pp-badge ${payCls[status]}`}>{status}</span>
}

const partnerCls: Record<PartnerStatus, string> = { pending: 'pp-badge-warn', approved: 'pp-badge-ok', rejected: 'pp-badge-mute', suspended: 'pp-badge-bad' }
export function PartnerStatusBadge({ status }: { status: PartnerStatus }) {
  return <span className={`pp-badge ${partnerCls[status]}`}>{PARTNER_STATUS[status]}</span>
}

export function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="pp-stat">
      <p className="pp-stat-label">{label}</p>
      <p className="pp-stat-value">{value}</p>
      {sub && <p className="pp-stat-sub">{sub}</p>}
    </div>
  )
}
