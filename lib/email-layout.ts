// Branded email template in the site palette (blush base, rose-copper accents, plum text).
// Email clients ignore CSS variables and web fonts, so colours are inline and fonts fall back to Georgia.

import { SITE_URL } from './seo'

/** The shop's inbox: every staff alert, contact message and shop order is sent here. */
export const INBOX = 'mysensare@gmail.com'

const C = {
  page: '#FCF5F2',
  card: '#FFFCFB',
  line: '#EBD9D3',
  text: '#3B2026',
  soft: '#6E4E55',
  muted: '#8C6F74',
  accent: '#A4523F',
  signature: '#C9906A',
  petal: '#F8E7E2',
}

export function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

/** A highlighted side note, e.g. the ritual steps or a reference number. */
export function callout(html: string) {
  return `<div style="background:${C.petal};border-left:3px solid ${C.signature};padding:16px 20px;margin:20px 0;color:${C.soft};font-size:14px;line-height:1.8;">${html}</div>`
}

export function muted(html: string) {
  return `<p style="font-size:12px;color:${C.muted};">${html}</p>`
}

export function brandEmail(opts: {
  eyebrow?: string
  title: string
  body: string
  cta?: { label: string; href: string }
  signoff?: string
}) {
  const { eyebrow, title, body, cta, signoff } = opts
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"></head>
<body style="margin:0;padding:0;background:${C.page};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
    <tr><td align="center" style="padding:0 0 20px;">
      <a href="${SITE_URL}" style="text-decoration:none;"><img src="${SITE_URL}/logo-sensare.png" width="72" height="72" alt="Sensarè" style="display:block;border:0;"></a>
    </td></tr>
    <tr><td style="background:${C.card};border:1px solid ${C.line};border-top:3px solid ${C.signature};border-radius:4px;padding:36px 32px;font-family:Georgia,'Times New Roman',serif;">
      ${eyebrow ? `<p style="margin:0 0 10px;color:${C.accent};font-size:12px;letter-spacing:2px;text-transform:uppercase;">${esc(eyebrow)}</p>` : ''}
      <h1 style="margin:0 0 18px;color:${C.text};font-size:24px;line-height:1.3;font-weight:bold;">${esc(title)}</h1>
      <div style="color:${C.soft};font-size:15px;line-height:1.75;">${body}</div>
      ${cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0 0;"><tr><td style="background:${C.accent};border-radius:2px;"><a href="${cta.href}" style="display:inline-block;padding:13px 26px;color:#FFFFFF;font-family:Georgia,serif;font-size:14px;font-weight:bold;letter-spacing:1px;text-decoration:none;">${esc(cta.label)}</a></td></tr></table>` : ''}
      ${signoff ? `<p style="margin:28px 0 0;color:${C.accent};font-style:italic;font-size:14px;">${signoff}</p>` : ''}
    </td></tr>
    <tr><td align="center" style="padding:20px 8px 0;font-family:Georgia,serif;font-size:12px;line-height:1.7;color:${C.muted};">
      Sensarè Chocolates · Handcrafted in the Philippines<br>
      <a href="${SITE_URL}" style="color:${C.accent};text-decoration:none;">mysensare.com</a> · <a href="mailto:${INBOX}" style="color:${C.accent};text-decoration:none;">${INBOX}</a>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`
}
