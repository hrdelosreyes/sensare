import { redirect } from 'next/navigation'
import { getAdmin, hasAnyAdmin } from '@/lib/auth'
import AdminLoginForm from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function AdminLoginPage() {
  if (await getAdmin()) redirect('/admin')
  return <AdminLoginForm needsSetup={!(await hasAnyAdmin())} />
}
