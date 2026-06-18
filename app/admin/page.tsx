export const dynamic = 'force-dynamic'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const cookieStore = await cookies()
  const authed = cookieStore.get('admin_authed')?.value === 'true'
  if (!authed) redirect('/admin/login')

  const db = supabaseAdmin()
  const [
    { data: orders },
    { data: products },
    { data: restock },
    { data: subscribers },
    { data: testimonials },
  ] = await Promise.all([
    db.from('sensare_orders').select('*').order('created_at', { ascending: false }).limit(100),
    db.from('sensare_products').select('*').order('sort_order'),
    db.from('sensare_restock_notifications').select('*, sensare_products(name)').is('notified_at', null).order('created_at', { ascending: false }),
    db.from('sensare_newsletter_subscribers').select('*').is('unsubscribed_at', null).order('subscribed_at', { ascending: false }),
    db.from('sensare_testimonials').select('*').order('sort_order'),
  ])

  return <AdminClient orders={orders || []} products={products || []} restock={restock || []} subscribers={subscribers || []} testimonials={testimonials || []} />
}
