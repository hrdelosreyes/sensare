export const dynamic = 'force-dynamic'
import { requireAdminPage } from '@/lib/auth'
import { can } from '@/lib/roles'
import { db } from '@/lib/db'
import AdminClient from './AdminClient'

export default async function AdminPage() {
  const admin = await requireAdminPage('store.view')

  const sql = db()
  const [orders, products, restock, subscribers, testimonials] = await Promise.all([
    sql`select * from sensare_orders order by created_at desc limit 100`,
    sql`select * from sensare_products order by sort_order`,
    sql`select r.*, p.name as product_name from sensare_restock_notifications r
        left join sensare_products p on p.id = r.product_id
        where r.notified_at is null order by r.created_at desc`,
    sql`select * from sensare_newsletter_subscribers where unsubscribed_at is null order by subscribed_at desc`,
    sql`select * from sensare_testimonials order by sort_order`,
  ])

  return <AdminClient canEditStock={can(admin.role, 'store.stock')} showMoney={can(admin.role, 'money.view')} orders={[...orders]} products={[...products]} restock={[...restock]} subscribers={[...subscribers]} testimonials={[...testimonials]} />
}
