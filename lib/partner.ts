// Shared types, labels and helpers for the partner portal (safe for client + server).

export type PartnerStatus = 'pending' | 'approved' | 'rejected' | 'suspended'
export type PaymentTerms = 'cod' | 'consignment' | 'net30'
export type OrderStatus = 'submitted' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'
export type PaymentStatus = 'unpaid' | 'partial' | 'paid'
export type PaymentMethod = 'hitpay' | 'bank_transfer' | 'cash' | 'check' | 'return_credit' | 'other'

export type Partner = {
  id: string
  user_id: string
  business_name: string
  contact_name: string
  email: string
  phone: string | null
  tin: string | null
  business_type: string | null
  address: string | null
  city: string | null
  province: string | null
  sales_channels: string | null
  expected_monthly_cases: number | null
  message: string | null
  status: PartnerStatus
  default_payment_terms: PaymentTerms
  admin_notes: string | null
  reviewed_at: string | null
  created_at: string
  consignment_period_days: number
  consignment_reminded_at: string | null
}

export type Location = {
  id: string
  partner_id: string
  name: string
  contact_name: string | null
  phone: string | null
  address: string | null
  city: string | null
  province: string | null
  delivery_notes: string | null
  is_default: boolean
  is_active: boolean
}

export type Settlement = {
  id: string
  partner_id: string
  period_from: string
  period_to: string
  units: number
  amount_php: number
  method: Exclude<PaymentMethod, 'return_credit'>
  status: 'pending' | 'confirmed' | 'rejected' | 'failed'
  reference: string | null
  notes: string | null
  paid_on: string | null
  created_at: string
  confirmed_at: string | null
}

export function locationAddress(l: Pick<Location, 'address' | 'city' | 'province'>): string {
  return [l.address, l.city, l.province].filter(Boolean).join(', ')
}

export function locationLabel(l: Pick<Location, 'name' | 'city'>): string {
  return l.city && !l.name.toLowerCase().includes(l.city.toLowerCase()) ? `${l.name} (${l.city})` : l.name
}

export type Product = {
  id: string
  slug: string
  name: string
  price_php: number
  stock_qty: number
  is_active: boolean
  case_size: number
  wholesale_case_price_php: number | null
  is_wholesale: boolean
  sort_order: number
}

export type PartnerOrder = {
  id: string
  order_number: string
  partner_id: string
  location_id: string
  order_group_id: string
  suggestion_id: string | null
  status: OrderStatus
  payment_terms: PaymentTerms
  subtotal_php: number
  shipping_php: number
  total_php: number
  amount_paid_php: number
  payment_status: PaymentStatus
  due_date: string | null
  shipping_address: string | null
  partner_notes: string | null
  admin_notes: string | null
  tracking_info: string | null
  confirmed_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  created_at: string
}

export type OrderItem = {
  id: string
  order_id: string
  product_id: string
  product_name: string
  case_qty: number
  case_size: number
  case_price_php: number
  line_total_php: number
}

export type Payment = {
  id: string
  order_id: string
  partner_id: string
  amount_php: number
  method: PaymentMethod
  status: 'pending' | 'confirmed' | 'rejected' | 'failed'
  reference: string | null
  notes: string | null
  paid_on: string | null
  created_at: string
  confirmed_at: string | null
  settlement_id: string | null
}

export const PAYMENT_TERMS: Record<PaymentTerms, string> = {
  cod: 'Cash on Delivery',
  consignment: 'Consignment',
  net30: '30 Days',
}

export const PAYMENT_TERMS_HELP: Record<PaymentTerms, string> = {
  cod: 'Pay in full when the order is delivered.',
  consignment: 'Pay only for boxes sold, settled every period (default weekly).',
  net30: 'Pay in full within 30 days of delivery.',
}

export const ORDER_STATUS: Record<OrderStatus, string> = {
  submitted: 'Submitted',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

export const PARTNER_STATUS: Record<PartnerStatus, string> = {
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
}

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  hitpay: 'HitPay (online)',
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  check: 'Check',
  return_credit: 'Return credit',
  other: 'Other',
}

export const BUSINESS_TYPES: Record<string, string> = {
  retail_store: 'Retail store / boutique',
  online_seller: 'Online seller',
  distributor: 'Distributor',
  hospitality: 'Hotel / spa / restaurant',
  events: 'Events & gifting',
  other: 'Other',
}

export const ADJUSTMENT_REASONS: Record<string, string> = {
  damaged: 'Damaged',
  expired: 'Expired',
  returned: 'Returned to Sensarè',
  count_correction: 'Stock count correction',
  other: 'Other',
}

export function isPaymentTerms(v: unknown): v is PaymentTerms {
  return v === 'cod' || v === 'consignment' || v === 'net30'
}

export function peso(n: number | string | null | undefined, decimals = 2): string {
  const v = Number(n ?? 0)
  return '₱' + v.toLocaleString('en-PH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return '—'
  const date = typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T00:00:00+08:00') : new Date(d)
  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Manila' })
}

// Today's date (YYYY-MM-DD) in Manila.
export function manilaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date())
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function isIsoDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s))
}

export function balance(o: Pick<PartnerOrder, 'total_php' | 'amount_paid_php'>): number {
  return Math.max(0, Number(o.total_php) - Number(o.amount_paid_php))
}

export function isOverdue(o: Pick<PartnerOrder, 'due_date' | 'payment_status' | 'status'>): boolean {
  return !!o.due_date && o.payment_status !== 'paid' && o.status !== 'cancelled' && o.due_date < manilaToday()
}
