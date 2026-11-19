# Company Context

## Businesses
| Name | What | Repo |
|------|------|------|
| Sensarè Chocolates | Couples' botanical dark chocolate (PH) | hrdelosreyes/sensare |
| YANA Enterprises | Separate site (NestJS + Postgres) | hrdelosreyes/yanaenterprises |
| BukidBox | Shares the old Supabase project | — |

## Tools & Systems
| Tool | Used for |
|------|----------|
| Vercel | Hosting (both sites), cron, Neon Storage integration |
| Neon | Postgres for Sensarè (DATABASE_URL) and YANA |
| Supabase | Legacy Sensarè DB/auth; still BukidBox |
| Resend | Transactional email (from noreply@mysensare.com) |
| HitPay | Online payments (shop + partner orders/settlements); webhook /api/webhooks/hitpay |
| GitHub | Code; Claude works on branch claude/sensare-partner-portal-wxt25f, PRs into main |

## Sensarè repo map
| Path | What |
|------|------|
| db/migrations/ | 001 storefront, 002 accounts, 003 partner portal, 004 roles |
| scripts/migrate.mjs | Migrations + one-time Supabase import + seed |
| lib/auth.ts | Sessions, passwords, guards (requireAdminPage(perm), partner access) |
| lib/roles.ts | Role → permission map, nav per role |
| lib/forecast*.ts | Suggested-order maths + generation |
| lib/consignment.ts, lib/reports.ts | Settlements, reports |
| docs/PARTNER_PORTAL.md | Setup + feature guide |

## Notes
- Live site is not reachable from Claude's cloud container (network policy); owner checks deploys.
- Known pre-existing lint errors (unescaped quotes) in older storefront files.
