@AGENTS.md

# Memory

## Me
Owner of **Sensarè Chocolates** (aphrodisiac dark chocolate for couples, Philippines) and YANA Enterprises. Target market: **women as buyers** of a chocolate shared with their husband/partner (couples product, not self-care). Non-developer; works with Claude from the app. Wants plain-language explanations, then a PR opened and merged when asked.

## Terms
| Term | Meaning |
|------|---------|
| **partner / reseller** | Shop that buys wholesale via the Partner Portal |
| **AM** | Freelance Account Manager (staff role; own accounts only, earns commission) |
| **branch staff** | Partner-side login limited to chosen branches (sales + stock only) |
| **case** | 12 boxes; partners order in cases |
| **terms** | COD, Consignment, 30 Days (net30) — default per partner, changeable per order |
| **consignment settlement** | Partner pays for boxes sold in a period (default 7 days) |
| **suggested order** | Auto reorder from sales trend + stock + 14-day lead time |
| **SRP** | Suggested retail price (per box) |
| **SPO-YYYY-NNNNN** | Partner order number |
→ Full glossary: memory/glossary.md

## Projects
| Name | What |
|------|------|
| **Partner Portal** | Live. Partners, orders, inventory, sales, reports, roles → memory/projects/sensare-partner-portal.md |
| **Neon move** | Done: Supabase → Neon (Vercel). Supabase still hosts BukidBox |
| **YANA Enterprises** | Separate repo (NestJS + Neon on Vercel) |

## Stack (sensare repo)
Next.js 16 (read node_modules/next/dist/docs first — `proxy.ts` not middleware; params are Promises), React 19, Tailwind 4, `postgres` v4 driver → **Neon**, Resend email, HitPay payments, Vercel hosting + daily cron.
→ Details: memory/context/company.md

## Preferences & conventions
- Brand wordmark font: **Oleo Script** ("Sensarè" only); Allura for script accents; Playfair Display for headings/text
- Colour palette (applied 2026-11-19, tokens in app/globals.css; `.on-dark` for dark bands): soft blush base, analogous rose-gold/rose/berry + split-complementary sage; dark only for hero/footer → memory/context/brand.md
- Contact email everywhere: **mysensare@gmail.com** (sender stays noreply@mysensare.com, Reply-To Gmail). Every staff alert, shop order, signup and contact message also goes to this inbox (`INBOX` in lib/email-layout.ts)
- Must be mobile-friendly (check at iPhone width)
- Ask before merging/deploying; when asked: open PR → merge
- Test end-to-end against local Postgres + Playwright before shipping
