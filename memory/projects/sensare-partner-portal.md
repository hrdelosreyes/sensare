# Sensarè Partner Portal

**Status:** Live on mysensare.com (PRs #1–#3 merged). Roles work committed on branch
`claude/sensare-partner-portal-wxt25f` (commit "Add staff roles…") — PR not yet opened/merged as of 2026-11-19.

## Timeline
- PR #1: partner portal + Neon move + own auth (merged). Owner created first admin via /admin/setup.
- PR #2: contact email → mysensare@gmail.com (merged).
- PR #3: mobile navigation (section menu button on phones; fixed site header; homepage ritual grid) (merged).
- Pending: staff roles + AMs + branch staff (migration 004_roles.sql; existing admins → Owner).

## Features
- Apply → admin approval → portal. Ordering in cases at per-partner prices; split per branch.
- Payment terms COD / Consignment / 30 Days; HitPay online or bank-transfer report; partial payments.
- Per-branch inventory ledger + daily sales (90-day edit window; oversell blocked).
- Suggested orders: weighted 4-week forecast, follows rising trends; reorder when stock+on-order ≤ forecast×(lead+safety); order up to forecast×(lead+cover+safety).
- Consignment settlements: contiguous periods, FIFO per branch, settled sales locked, abandoned HitPay checkouts expire 2h / on retry.
- Reports with branch filter, CSV, print. Daily cron: suggestions + consignment reminders.
- Roles (pending merge): see glossary. AM scoping enforced server-side.

## Ops checklist (owner)
- Vercel: Neon connected (Production), CRON_SECRET set.
- After verifying Neon data: remove NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY, ADMIN_PASSWORD (while set, each deploy re-imports products from Supabase).
- Set default case prices + bank details in Partner Settings.
- Supabase project also hosts BukidBox — don't cancel until BukidBox moves.

## Open ideas
- Admins placing orders for partners; partner marketing downloads; activity log;
  lead time per partner/branch; editing order quantities before confirm.
