import 'server-only'
import { Resend } from 'resend'
import { supabaseAdmin } from './supabase'
import { SITE_URL } from './seo'

const FROM = 'Sensarè Partners <noreply@mysensare.com>'

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function layout(title: string, bodyHtml: string, cta?: { label: string; href: string }) {
  return `
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;background:#1c0e09;color:#faf0e4;padding:40px 32px;">
    <p style="color:#c9906a;font-size:13px;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px;">Sensarè Partner Program</p>
    <h2 style="color:#faf0e4;font-size:24px;margin:0 0 20px;">${esc(title)}</h2>
    <div style="color:#e8d8c4;font-size:15px;line-height:1.7;">${bodyHtml}</div>
    ${cta ? `<p style="margin:28px 0 0;"><a href="${cta.href}" style="display:inline-block;background:#c9906a;color:#0f0705;padding:12px 24px;text-decoration:none;font-weight:bold;letter-spacing:1px;">${esc(cta.label)}</a></p>` : ''}
    <p style="font-size:12px;color:#a08070;margin-top:36px;">Sensarè Chocolates · mysensare.com</p>
  </div>`
}

// Never let an email failure break the user's action.
async function send(to: string | string[], subject: string, html: string) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean)
  if (!recipients.length || !process.env.RESEND_API_KEY) return
  try {
    await new Resend(process.env.RESEND_API_KEY).emails.send({ from: FROM, to: recipients, subject, html })
  } catch (err) {
    console.error('Email send failed:', subject, err)
  }
}

async function adminEmails(): Promise<string[]> {
  const { data } = await supabaseAdmin().from('sensare_admins').select('email')
  return (data ?? []).map(a => a.email as string)
}

export const email = {
  async applicationReceived(p: { email: string; contact_name: string; business_name: string }) {
    await send(p.email, 'We received your Sensarè partner application',
      layout(`Thank you, ${p.contact_name}.`,
        `<p>We've received the partner application for <strong>${esc(p.business_name)}</strong>. Our team reviews applications within 1–3 business days, and we'll email you as soon as your account is approved.</p>`))
    await send(await adminEmails(), `New partner application: ${p.business_name}`,
      layout('New partner application', `<p><strong>${esc(p.business_name)}</strong> (${esc(p.contact_name)}, ${esc(p.email)}) applied to the partner program.</p>`,
        { label: 'Review application', href: `${SITE_URL}/admin/partners?status=pending` }))
  },

  async partnerStatusChanged(p: { email: string; contact_name: string; business_name: string }, status: string, note?: string | null) {
    if (status === 'approved') {
      await send(p.email, 'Your Sensarè partner account is approved',
        layout(`Welcome aboard, ${p.contact_name}!`,
          `<p>Your partner account for <strong>${esc(p.business_name)}</strong> is now active. You can log in to place orders, track inventory and record daily sales.</p>${note ? `<p>${esc(note)}</p>` : ''}`,
          { label: 'Go to the Partner Portal', href: `${SITE_URL}/partners/portal` }))
    } else if (status === 'rejected') {
      await send(p.email, 'Update on your Sensarè partner application',
        layout(`Hi ${p.contact_name},`,
          `<p>Thank you for your interest in becoming a Sensarè partner. We're unable to approve the application for <strong>${esc(p.business_name)}</strong> at this time.</p>${note ? `<p>${esc(note)}</p>` : ''}<p>You're welcome to reply to hello@mysensare.com with any questions.</p>`))
    } else if (status === 'suspended') {
      await send(p.email, 'Your Sensarè partner account has been paused',
        layout(`Hi ${p.contact_name},`,
          `<p>Access to the partner portal for <strong>${esc(p.business_name)}</strong> has been paused.</p>${note ? `<p>${esc(note)}</p>` : ''}<p>Please contact hello@mysensare.com for details.</p>`))
    }
  },

  async orderPlaced(order: { id: string; order_number: string; total_php: number }, partner: { business_name: string; email: string; contact_name: string }) {
    await send(partner.email, `Order ${order.order_number} received`,
      layout('We received your order',
        `<p>Order <strong>${esc(order.order_number)}</strong> (₱${Number(order.total_php).toLocaleString('en-PH', { minimumFractionDigits: 2 })}) is with our team. We'll confirm it and let you know the shipping fee, if any.</p>`,
        { label: 'View order', href: `${SITE_URL}/partners/portal/orders/${order.id}` }))
    await send(await adminEmails(), `New partner order ${order.order_number} — ${partner.business_name}`,
      layout('New partner order', `<p><strong>${esc(partner.business_name)}</strong> placed order <strong>${esc(order.order_number)}</strong> for ₱${Number(order.total_php).toLocaleString('en-PH', { minimumFractionDigits: 2 })}.</p>`,
        { label: 'Review order', href: `${SITE_URL}/admin/partner-orders/${order.id}` }))
  },

  async orderStatusChanged(order: { id: string; order_number: string; tracking_info?: string | null }, partner: { email: string }, status: string) {
    const messages: Record<string, string> = {
      confirmed: 'Your order has been confirmed and is being prepared.',
      shipped: `Your order is on its way.${order.tracking_info ? ` Tracking: ${esc(order.tracking_info)}` : ''}`,
      delivered: 'Your order has been marked as delivered and the stock has been added to your inventory.',
      cancelled: 'Your order has been cancelled. Contact us if you have questions.',
    }
    if (!messages[status]) return
    await send(partner.email, `Order ${order.order_number}: ${status}`,
      layout(`Order ${order.order_number} ${status}`, `<p>${messages[status]}</p>`,
        { label: 'View order', href: `${SITE_URL}/partners/portal/orders/${order.id}` }))
  },

  async paymentReported(order: { id: string; order_number: string }, partner: { business_name: string }, amount: number, ref: string) {
    await send(await adminEmails(), `Bank transfer to verify — ${order.order_number}`,
      layout('Payment awaiting verification',
        `<p><strong>${esc(partner.business_name)}</strong> reported a bank transfer of <strong>₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> for order ${esc(order.order_number)} (ref: ${esc(ref)}).</p>`,
        { label: 'Verify payment', href: `${SITE_URL}/admin/partner-orders/${order.id}` }))
  },

  async paymentConfirmed(order: { id: string; order_number: string }, partner: { email: string }, amount: number) {
    await send(partner.email, `Payment received — ${order.order_number}`,
      layout('Payment received', `<p>We've recorded your payment of <strong>₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> for order ${esc(order.order_number)}. Thank you!</p>`,
        { label: 'View order', href: `${SITE_URL}/partners/portal/orders/${order.id}` }))
  },
}
