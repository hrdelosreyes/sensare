import type { Metadata } from 'next'
import ContactForm from '@/components/ContactForm'

export const metadata: Metadata = {
  title: 'Contact Us',
  description: 'Get in touch with Sensarè Chocolates. Questions about orders, ingredients, or gifting? We reply within 24 hours.',
  alternates: { canonical: '/contact' },
}

export default function ContactPage() {
  return (
    <div style={{ paddingTop: 72 }}>
      <section style={{ padding: '80px 24px 48px', textAlign: 'center', borderBottom: '1px solid rgba(201,144,106,0.1)' }}>
        <p style={{ fontFamily: 'Allura', fontSize: 32, color: 'var(--rose-gold)', marginBottom: 8 }}>Say Hello</p>
        <h1 style={{ fontFamily: 'PlayfairDisplay', fontWeight: 700, fontSize: 'clamp(28px, 4vw, 48px)', color: 'var(--cream)' }}>Contact Us</h1>
      </section>

      <ContactForm />
    </div>
  )
}
