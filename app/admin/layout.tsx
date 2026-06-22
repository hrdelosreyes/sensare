import type { Metadata } from 'next'

// Keep the entire admin area out of search indexes.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
