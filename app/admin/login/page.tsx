import { redirect } from 'next/navigation'
import { getAdmin, hasAnyAdmin } from '@/lib/auth'
import { homeFor } from '@/lib/roles'
import AdminLoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function AdminLoginPage() {
  const admin = await getAdmin()
  if (admin) redirect(homeFor(admin.role))
  return <AdminLoginForm needsSetup={!(await hasAnyAdmin())} />
}
