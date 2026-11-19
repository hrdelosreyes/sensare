import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import JsonLd from '@/components/JsonLd'
import MetaPixel from '@/components/MetaPixel'
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, organizationJsonLd } from '@/lib/seo'

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  keywords: ['dark chocolate for couples', 'couples chocolate', 'Davao chocolate', 'gift for couples', 'dark chocolate Philippines'],
  metadataBase: new URL(SITE_URL),
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_PH',
    url: SITE_URL,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
  icons: { icon: '/logo-sensare.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <JsonLd data={organizationJsonLd} />
        <Navbar />
        <main style={{ flex: 1 }}>{children}</main>
        <Footer />
        <MetaPixel />
      </body>
    </html>
  )
}
