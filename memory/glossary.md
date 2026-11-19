# Glossary

## Business terms
| Term | Meaning | Context |
|------|---------|---------|
| Sensarè | Brand: 60% Davao dark chocolate + botanicals, couples ritual | mysensare.com |
| Ritual | Brand concept/page (/pages/the-sensare-ritual) | |
| Two Hearts | 2-piece box, ₱295 SRP (was "Intimate Indulgence", renamed Nov 2026) | slug two-hearts; /shop/intimate-indulgence redirects |
| The Ritual Bundle | 2 boxes, ₱590, free shipping nationwide (Nov 2026; was 3 boxes ₱795) | ritual-bundle |
| Lover's Gift Set | RETIRED Nov 2026 (hidden from shop + partners; kept for order history) | lovers-gift-set → /shop |
| partner / reseller | Wholesale buyer using the Partner Portal | /partners |
| case | 12 boxes (case_size, editable per product) | ordering unit |
| default case price | Wholesale price per product (Partner Settings) | fallback |
| custom price | Per-partner case price (partner page) | overrides default |
| branch / location | Partner delivery location; own stock + sales | one order splits per branch |
| suggested order | Daily auto reorder suggestion; partner approves | lead 14 / cover 14 / safety 7 days |
| consignment settlement | Pay for consignment boxes sold over a period | default 7 days per partner |
| return credit | Payment type for unsold consignment stock sent back | earns no commission |
| collection | Payment logged by an AM; pending until Finance confirms | |
| commission | AM % of confirmed collections; snapshotted per payment | /admin/commissions |
| sign-up link | AM referral link /partners/apply?ref=CODE | auto-assigns AM |

## Roles
| Role | Short |
|------|-------|
| Owner | Everything incl. Team & Partner Settings (always ≥1 active) |
| Manager | Partners, prices, orders, payments, reports |
| Fulfillment | Confirm/ship/deliver, shop stock; no money visible |
| Finance | Confirm/record payments, consignment, commissions |
| Viewer | Read-only |
| Account Manager (AM) | Freelance; only assigned partners; logs collections; commission |
| Partner owner | The partner's main login |
| Branch staff | Partner staff; daily sales + stock for assigned branches only |

## Technical shorthand
| Term | Meaning |
|------|---------|
| migrations | db/migrations/*.sql, auto-applied by scripts/migrate.mjs before `next build` |
| ActionForm | components/portal/forms.tsx wrapper — keeps form input after server-action errors (React 19 resets forms) |
| e2e suite | Playwright flows 1–3 against local Postgres (setup, ordering, suggestions, consignment, auth, webhook, roles) |
| CRON_SECRET | Protects /api/cron/partners (daily 06:00 Manila) |
| /admin/setup | One-time first-Owner creation (used; closed) |
