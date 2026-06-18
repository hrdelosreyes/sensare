import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: { default: 'Sensarè Chocolates', template: '%s | Sensarè Chocolates' },
  description: 'Artisanal dark chocolate infused with ancient botanicals — crafted for couples to awaken desire, elevate intimacy, and deepen connection.',
  keywords: ['aphrodisiac chocolate', 'couples chocolate', 'Davao chocolate', 'intimate gift', 'dark chocolate Philippines'],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://mysensare.com'),
  openGraph: {
    siteName: 'Sensarè Chocolates',
    type: 'website',
    locale: 'en_PH',
  },
  icons: { icon: '/logo-sensare.png' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main style={{ flex: 1 }}>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
