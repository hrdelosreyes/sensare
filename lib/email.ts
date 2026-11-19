import 'server-only'
import { Resend } from 'resend'
import { db } from './db'
import { SITE_URL } from './seo'
import { INBOX, brandEmail, callout, esc, muted } from './email-layout'

const FROM = 'Sensarè Partners <noreply@mysensare.com>'
const REPLY_TO = INBOX

function layout(title: string, bodyHtml: string, cta?: { label: string; href: string }) {
  return brandEmail({ eyebrow: 'Sensarè Partner Program', title, body: bodyHtml, cta })
}

const SHOP_FROM = 'Sensarè Chocolates <noreply@mysensare.com>'

async function send(to: string | string[], subject: string, html: string) {
  return sendAs(FROM, to, subject, html)
}

// Never let an email failure break the user's action (unless the caller asks).
async function sendAs(from: string, to: string | string[], subject: string, html: string, replyTo = REPLY_TO, throwOnError = false) {
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean)
  if (!recipients.length || !process.env.RESEND_API_KEY) return
  try {
    const { error } = await new Resend(process.env.RESEND_API_KEY).emails.send({ from, replyTo, to: recipients, subject, html })
    if (error) throw new Error(error.message)
  } catch (err) {
    console.error('Email send failed:', subject, err)
    if (throwOnError) throw err
  }
}

// Staff alerts go to the shop inbox, the roles that act on them, and the partner's account manager.
async function staffEmails(roles: string[], partnerEmail?: string): Promise<string[]> {
  const rows = await db()<{ email: string }[]>`
    select email from sensare_admins where is_active and (
      role = any(${roles}::text[])
      or (role = 'account_manager' and ${partnerEmail ?? null}::text is not null and user_id in (
        select account_manager_id from sensare_partners where lower(email) = lower(${partnerEmail ?? ''}))))`
  const seen = new Set<string>()
  return [INBOX, ...rows.map(a => a.email)].filter(e => !seen.has(e.toLowerCase()) && !!seen.add(e.toLowerCase()))
}

export const email = {
  async applicationReceived(p: { email: string; contact_name: string; business_name: string }) {
    await send(p.email, 'We received your Sensarè partner application',
      layout(`Thank you, ${p.contact_name}.`,
        `<p>We've received the partner application for <strong>${esc(p.business_name)}</strong>. Our team reviews applications within 1–3 business days, and we'll email you as soon as your account is approved.</p>`))
    await send(await staffEmails(['owner', 'manager'], p.email), `New partner application: ${p.business_name}`,
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
          `<p>Thank you for your interest in becoming a Sensarè partner. We're unable to approve the application for <strong>${esc(p.business_name)}</strong> at this time.</p>${note ? `<p>${esc(note)}</p>` : ''}<p>You're welcome to reply to ${INBOX} with any questions.</p>`))
    } else if (status === 'suspended') {
      await send(p.email, 'Your Sensarè partner account has been paused',
        layout(`Hi ${p.contact_name},`,
          `<p>Access to the partner portal for <strong>${esc(p.business_name)}</strong> has been paused.</p>${note ? `<p>${esc(note)}</p>` : ''}<p>Please contact ${INBOX} for details.</p>`))
    }
  },

  async orderPlaced(order: { id: string; order_number: string; total_php: number }, partner: { business_name: string; email: string; contact_name: string }) {
    await send(partner.email, `Order ${order.order_number} received`,
      layout('We received your order',
        `<p>Order <strong>${esc(order.order_number)}</strong> (₱${Number(order.total_php).toLocaleString('en-PH', { minimumFractionDigits: 2 })}) is with our team. We'll confirm it and let you know the shipping fee, if any.</p>`,
        { label: 'View order', href: `${SITE_URL}/partners/portal/orders/${order.id}` }))
    await send(await staffEmails(['owner', 'manager', 'fulfillment'], partner.email), `New partner order ${order.order_number} — ${partner.business_name}`,
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

  async paymentReported(order: { id: string; order_number: string }, partner: { business_name: string; email?: string }, amount: number, ref: string) {
    await send(await staffEmails(['owner', 'manager', 'finance'], partner.email), `Bank transfer to verify — ${order.order_number}`,
      layout('Payment awaiting verification',
        `<p><strong>${esc(partner.business_name)}</strong> reported a bank transfer of <strong>₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> for order ${esc(order.order_number)} (ref: ${esc(ref)}).</p>`,
        { label: 'Verify payment', href: `${SITE_URL}/admin/partner-orders/${order.id}` }))
  },

  async paymentConfirmed(order: { id: string; order_number: string }, partner: { email: string }, amount: number) {
    await send(partner.email, `Payment received — ${order.order_number}`,
      layout('Payment received', `<p>We've recorded your payment of <strong>₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> for order ${esc(order.order_number)}. Thank you!</p>`,
        { label: 'View order', href: `${SITE_URL}/partners/portal/orders/${order.id}` }))
  },

  async suggestionReady(p: { email: string; contact_name: string }, cases: number, locations: number) {
    await send(p.email, 'Your suggested Sensarè reorder is ready',
      layout(`Time to restock, ${p.contact_name.split(' ')[0]}`,
        `<p>Based on your recent sales, current stock and our 2-week delivery lead time, we've prepared a suggested order of <strong>${cases} case${cases === 1 ? '' : 's'}</strong>${locations > 1 ? ` across ${locations} branches` : ''}.</p><p>Review it, adjust the quantities if you like, and approve it in one click.</p>`,
        { label: 'Review suggested order', href: `${SITE_URL}/partners/portal/suggested` }))
  },

  async consignmentReminder(p: { email: string; contact_name: string }, from: string, to: string, amount: number) {
    await send(p.email, 'Consignment settlement due',
      layout(`Hi ${p.contact_name.split(' ')[0]},`,
        `<p>Your consignment sales from <strong>${esc(from)}</strong> to <strong>${esc(to)}</strong> come to <strong>₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong>. Please settle online or by bank transfer from the partner portal.</p>`,
        { label: 'Settle consignment', href: `${SITE_URL}/partners/portal/consignment` }))
  },

  async settlementReported(partner: { business_name: string; email?: string }, amount: number, ref: string, from: string, to: string) {
    await send(await staffEmails(['owner', 'manager', 'finance'], partner.email), `Consignment transfer to verify — ${partner.business_name}`,
      layout('Consignment payment awaiting verification',
        `<p><strong>${esc(partner.business_name)}</strong> reported a bank transfer of <strong>₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> (ref: ${esc(ref)}) for consignment sales ${esc(from)} – ${esc(to)}.</p>`,
        { label: 'Verify payment', href: `${SITE_URL}/admin/consignment` }))
  },

  async settlementConfirmed(partner: { email: string }, amount: number, from: string, to: string) {
    await send(partner.email, 'Consignment payment received',
      layout('Payment received', `<p>We've recorded your consignment payment of <strong>₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> for sales ${esc(from)} – ${esc(to)}. Thank you!</p>`,
        { label: 'View consignment', href: `${SITE_URL}/partners/portal/consignment` }))
  },

  async lateSettlementPayment(settlementId: string, amount: number) {
    await send(await staffEmails(['owner', 'finance']), 'Check: late consignment payment received',
      layout('Late consignment payment',
        `<p>HitPay confirmed a consignment payment of <strong>₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> after its checkout had expired. It has been recorded — please check the partner hasn't paid the same period twice.</p>${muted(`Settlement ${esc(settlementId)}`)}`,
        { label: 'Open consignment', href: `${SITE_URL}/admin/consignment` }))
  },

  async passwordReset(to: string, token: string) {
    await send(to, 'Reset your Sensarè password',
      layout('Reset your password',
        `<p>We received a request to reset the password for your Sensarè account. This link works once and expires in 1 hour.</p><p>If you didn't ask for this, you can ignore this email — your password won't change.</p>`,
        { label: 'Set a new password', href: `${SITE_URL}/partners/reset-password?token=${encodeURIComponent(token)}` }))
  },

  async collectionLogged(order: { id: string; order_number: string; business_name: string }, by: string, amount: number, method: string) {
    await send(await staffEmails(['owner', 'manager', 'finance']), `Collection to confirm — ${order.order_number}`,
      layout('Collection awaiting confirmation',
        `<p><strong>${esc(by)}</strong> logged a ${esc(method.replace('_', ' '))} collection of <strong>₱${amount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> from <strong>${esc(order.business_name)}</strong> for order ${esc(order.order_number)}. Confirm it once the money has arrived.</p>`,
        { label: 'Review collection', href: `${SITE_URL}/admin/partner-orders/${order.id}` }))
  },

  // ---- Online shop ----
  async shopOrderPaid(order: { reference: string; customer_email?: string | null; customer_name?: string | null; total_php: number; items: Array<{ product_name?: string; qty: number; unit_price?: number }>; phone?: string | null; address?: { address?: string; city?: string; province?: string } | null; notes?: string | null }) {
    const peso = (n: number) => `₱${Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`
    const lines = order.items.map(i => `${esc(i.product_name ?? 'Item')} × ${i.qty}`).join('<br>')
    const realEmail = order.customer_email && order.customer_email !== 'pending@sensare.com' ? order.customer_email : null
    const a = order.address
    const deliverTo = a?.address ? `${esc(order.customer_name ?? '')}<br>${esc(a.address)}<br>${esc([a.city, a.province].filter(Boolean).join(', '))}${order.phone ? `<br>${esc(order.phone)}` : ''}` : ''
    const notes = order.notes ? `<br><em>Notes: ${esc(order.notes)}</em>` : ''
    if (realEmail) {
      await sendAs(SHOP_FROM, realEmail, 'Your Sensarè order is confirmed ♥', brandEmail({
        eyebrow: 'Order confirmed',
        title: 'Your ritual is on its way.',
        body: `<p>Thank you for choosing Sensarè. We're preparing your order now.</p>${callout(`${lines}<br><strong style="color:#3B2026;">Total ${peso(order.total_php)}</strong> <span style="font-size:12px;">incl. shipping</span><br>Reference: ${esc(order.reference)}`)}${deliverTo ? `<p style="margin:0 0 4px;color:#3B2026;"><strong>Delivering to</strong></p><p style="margin:0 0 16px;">${deliverTo}${notes}</p>` : ''}<p>Questions about your order? Just reply to this email.</p>`,
        signoff: 'Unwrap. Savor. Ignite. ♥',
      }))
    }
    await sendAs(SHOP_FROM, INBOX, `New shop order ${order.reference} — ${peso(order.total_php)}`, brandEmail({
      eyebrow: 'Online shop',
      title: 'New paid order',
      body: `<p>A shop order was paid through HitPay.</p>${callout(`${lines}<br><strong style="color:#3B2026;">Total ${peso(order.total_php)}</strong> <span style="font-size:12px;">incl. shipping</span><br>Reference: ${esc(order.reference)}`)}${deliverTo ? `<p style="margin:0 0 4px;color:#3B2026;"><strong>Deliver to</strong></p><p style="margin:0 0 16px;">${deliverTo}${realEmail ? `<br><a href="mailto:${esc(realEmail)}" style="color:#A4523F;">${esc(realEmail)}</a>` : ''}${notes}</p>` : `<p>Customer and delivery details are in your HitPay dashboard.</p>`}`,
      cta: { label: 'Open admin', href: `${SITE_URL}/admin` },
    }))
  },

  async ritualGuide(to: string) {
    await sendAs(SHOP_FROM, to, 'Your Sensarè Ritual Guide ♥', brandEmail({
      eyebrow: 'The Sensarè Ritual',
      title: 'Your ritual guide',
      body: `<p>Thank you for joining the Sensarè community. Here are the five steps — best enjoyed 30–60 minutes before an evening together.</p>${callout(
        '<strong style="color:#A4523F;">01 · Set the Scene</strong> — Dim the lights, light a candle, phones away.<br>' +
        '<strong style="color:#A4523F;">02 · Unwrap with Intention</strong> — Slow down. Breathe. Eye contact.<br>' +
        '<strong style="color:#A4523F;">03 · Savor Slowly</strong> — Small bites. Let it melt. Describe the taste.<br>' +
        '<strong style="color:#A4523F;">04 · Touch, Speak, Connect</strong> — “What do you feel? What do you need tonight?”<br>' +
        '<strong style="color:#A4523F;">05 · Ignite</strong> — Let the evening unfold.')}`,
      cta: { label: 'Shop the Collection', href: `${SITE_URL}/shop` },
      signoff: 'Unwrap. Savor. Ignite. ♥',
    }))
  },

  async newsletterSignup(subscriber: string) {
    await sendAs(SHOP_FROM, INBOX, `New newsletter subscriber: ${subscriber}`, brandEmail({
      eyebrow: 'Newsletter', title: 'New subscriber',
      body: `<p><strong style="color:#3B2026;">${esc(subscriber)}</strong> signed up and was sent the Ritual Guide.</p>`,
    }))
  },

  async contactMessage(m: { name: string; email: string; message: string }) {
    await sendAs('Sensarè Contact <noreply@mysensare.com>', INBOX, `Contact from ${m.name}`, brandEmail({
      eyebrow: 'Website contact form', title: `Message from ${m.name}`,
      body: `<p>From <strong style="color:#3B2026;">${esc(m.name)}</strong> (<a href="mailto:${esc(m.email)}" style="color:#A4523F;">${esc(m.email)}</a>)</p>${callout(esc(m.message).replace(/\n/g, '<br>'))}<p>Reply to this email to answer them directly.</p>`,
    }), m.email, true)
  },
}
