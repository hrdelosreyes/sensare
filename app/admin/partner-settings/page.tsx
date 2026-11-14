import { requireAdminPage } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { getSetting } from '@/lib/partner-data'
import { getForecastSettings } from '@/lib/forecast'
import type { Product } from '@/lib/partner'
import SettingsForm from './SettingsForm'

export default async function PartnerSettingsPage() {
  await requireAdminPage()
  const [{ data: products }, bank, forecast] = await Promise.all([
    supabaseAdmin().from('sensare_products').select('*').order('sort_order'),
    getSetting('partner_bank_details'),
    getForecastSettings(),
  ])
  return (
    <div>
      <h1 className="pp-h1">Partner settings</h1>
      <p className="pp-muted" style={{ marginBottom: 24 }}>Defaults that apply to every partner. Custom prices per partner are set on each partner&apos;s page.</p>
      <SettingsForm bank={bank} forecast={forecast} products={(products ?? []) as Product[]} />
    </div>
  )
}
