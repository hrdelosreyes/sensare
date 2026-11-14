import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { BUSINESS_TYPES, fmtDate, PAYMENT_TERMS, type Partner, type PartnerStatus } from '@/lib/partner'
import { PartnerStatusBadge } from '@/components/portal/ui'

const FILTERS: { key: PartnerStatus | 'all'; label: string }[] = [
  { key: 'pending', label: 'Pending' }, { key: 'approved', label: 'Approved' },
  { key: 'suspended', label: 'Suspended' }, { key: 'rejected', label: 'Rejected' }, { key: 'all', label: 'All' },
]

export default async function AdminPartnersPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireAdminPage()
  const sp = await searchParams
  const db = supabaseAdmin()
  const { data: all } = await db.from('sensare_partners').select('*').order('created_at', { ascending: false }).limit(2000)
  const partners = (all ?? []) as Partner[]
  const counts = partners.reduce<Record<string, number>>((c, p) => ({ ...c, [p.status]: (c[p.status] ?? 0) + 1 }), {})
  const status = (sp.status as PartnerStatus | 'all') ?? (counts.pending ? 'pending' : 'approved')
  const q = (sp.q ?? '').toLowerCase().trim()
  const shown = partners
    .filter(p => status === 'all' || p.status === status)
    .filter(p => !q || [p.business_name, p.contact_name, p.email, p.city].some(v => v?.toLowerCase().includes(q)))

  return (
    <div>
      <div className="pp-head">
        <div>
          <h1 className="pp-h1">Partners</h1>
          <p className="pp-muted">{counts.approved ?? 0} active · {counts.pending ?? 0} awaiting review</p>
        </div>
        <form method="get" className="pp-row">
          <input type="hidden" name="status" value={status} />
          <input className="pp-input" name="q" defaultValue={sp.q} placeholder="Search name, email, city" style={{ width: 240 }} />
          <button className="pp-btn pp-btn-sm" type="submit">Search</button>
        </form>
      </div>
      <div className="pp-row" style={{ marginBottom: 20 }}>
        {FILTERS.map(f => (
          <Link key={f.key} href={`/admin/partners?status=${f.key}`} className={`pp-btn pp-btn-sm ${status === f.key ? '' : 'pp-btn-ghost'}`}>
            {f.label}{f.key !== 'all' && counts[f.key] ? ` (${counts[f.key]})` : ''}
          </Link>
        ))}
      </div>
      <div className="pp-card">
        {shown.length === 0 ? <p className="pp-empty">No partners here.</p> : (
          <div className="pp-table-wrap">
            <table className="pp-table">
              <thead><tr><th>Business</th><th>Contact</th><th>Location</th><th>Type</th><th>Default terms</th><th>Status</th><th>Applied</th></tr></thead>
              <tbody>
                {shown.map(p => (
                  <tr key={p.id}>
                    <td><Link className="pp-link" href={`/admin/partners/${p.id}`}>{p.business_name}</Link></td>
                    <td>{p.contact_name}<br /><span className="pp-muted" style={{ fontSize: 12 }}>{p.email}</span></td>
                    <td>{[p.city, p.province].filter(Boolean).join(', ')}</td>
                    <td>{p.business_type ? BUSINESS_TYPES[p.business_type] ?? p.business_type : '—'}</td>
                    <td>{PAYMENT_TERMS[p.default_payment_terms]}</td>
                    <td><PartnerStatusBadge status={p.status} /></td>
                    <td>{fmtDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
