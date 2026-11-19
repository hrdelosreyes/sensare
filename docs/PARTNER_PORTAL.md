# Partner & Reseller Portal

Partners apply at **/partners**, an admin approves them, and approved partners use
**/partners/portal** to order (in cases of 12), track inventory, record daily sales
and run reports. Admins manage everything under **/admin**.

## Hosting: Vercel + Neon

Everything runs on Vercel: the site, the daily job, and a Neon Postgres database
connected through Vercel's Storage tab. There is no Supabase dependency.

- **Database tables are created automatically.** Every deploy runs
  `scripts/migrate.mjs` before `next build`. It applies any new files in
  `db/migrations/` (once each) and, on an empty database, loads the starter
  catalogue from `db/seed.sql`.
- **Accounts** (partners and admins) are stored in the same database: scrypt-hashed
  passwords, httpOnly session cookies, password-reset links emailed through Resend,
  and sign-in throttling.

## Moving from Supabase to Neon (one time)

1. **Connect Neon.** In the Vercel project → **Storage** → create or connect a Neon
   database for Production (and Preview if you like). It adds `DATABASE_URL`
   (plus `DATABASE_URL_UNPOOLED`) automatically.
2. **Keep the old Supabase variables for now.** While `NEXT_PUBLIC_SUPABASE_URL`
   and `SUPABASE_SERVICE_ROLE_KEY` are still set, each deploy copies the shop's
   data from Supabase into Neon: products (with their ids), product images,
   testimonials, newsletter subscribers, restock requests and orders. It only
   adds rows that aren't there yet, so it's safe on every deploy.
3. **Add** `CRON_SECRET` (any long random string) for the daily job.
4. **Deploy** (merge the PR). Check the build log for `[migrate] … database ready`
   and the row counts it imported.
5. **Create the first admin** at **/admin/setup**. Enter the site's current
   `ADMIN_PASSWORD` as the setup code, then choose your own email and password.
   The page closes for good once an admin exists. Add more admins under **Team**.
6. **Check the shop and admin.** Then, once you're happy (and after one last
   redeploy if orders came in during the switch), **remove** these variables in
   Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, and `ADMIN_PASSWORD`. Redeploy.

   ⚠️ While the Supabase variables remain, each deploy refreshes product details
   and stock from Supabase — so remove them before editing products in the new admin.

7. **Partner settings** at **/admin/partner-settings**: default case prices, bank
   details for transfers, and reorder settings (lead time 14 / cover 14 / safety 7 days).

> The Supabase project also hosts BukidBox — only cancel it once BukidBox has moved too.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon (set by the Vercel integration) |
| `CRON_SECRET` | Protects `/api/cron/partners` (Vercel sends it automatically) |
| `RESEND_API_KEY` | Emails (order updates, password resets) |
| `HITPAY_API_KEY`, `HITPAY_SALT`, `NEXT_PUBLIC_HITPAY_MODE` | Online payments |
| `NEXT_PUBLIC_APP_URL` | Site URL used in emails and payment redirects |
| `ADMIN_PASSWORD` or `ADMIN_SETUP_CODE` | Only until the first admin is created |

### Running locally

```bash
DATABASE_URL=postgres://… npm run db:migrate   # create/upgrade tables
DATABASE_URL=postgres://… npm run dev
```

## How it works

| Step | What happens |
|---|---|
| Apply | Partner creates a login and submits business details → status *pending*. Admins get an email. |
| Approve | Admin reviews at /admin/partners, picks default payment terms, approves → partner is emailed. |
| Prices | Per-partner case price on the partner's admin page; blank = product default. Products can be hidden per partner. |
| Order | Partner orders in cases. Terms default to theirs (COD / Consignment / 30 Days) but can be changed per order by partner (flagged) or admin. |
| Confirm | Admin sets shipping fee/terms and confirms → warehouse stock is deducted. Cancelling returns it. |
| Ship / Deliver | Admin marks shipped (optional tracking). Delivered (by admin, or partner clicks *Confirm received*) adds the boxes to the partner's inventory and sets the due date (30 Days = delivery + 30; COD = delivery day; Consignment = none). |
| Pay | Partner pays online via HitPay or reports a bank transfer (admin verifies). Admin can record cash/check/other payments and *Return credit* for consignment stock sent back. Partial payments are supported. |
| Daily sales | Partner enters boxes sold per product per day (editable for 90 days). Inventory is deducted automatically; sales can't exceed stock on hand. |
| Inventory | Ledger of deliveries, sales and adjustments. Partners can remove stock (damaged/expired/returned/count); admins can adjust either way. |
| Reports | Opening/received/sold/adjusted/closing stock, sell-through, daily chart, orders by terms, balances & overdue. CSV export and print-to-PDF. Admin view adds a per-partner league table. |

### Branches

Partners add branches (delivery locations) under **Branches**. Each branch has
its own inventory and daily sales. The order form is a products × branches grid:
one order request is split into one order per branch, each with its own delivery,
shipping fee, status, invoice and due date (they share a group and link to each
other).

### Automatic order suggestions

Every day (and whenever a partner records sales, adjusts stock, or opens the
dashboard after 12h) the system forecasts each branch × product:

- **Forecast/day** = last 14 days weighted ×2 plus the 14 days before ×1, but never
  below the last 14 days' rate (rising sales are followed at once). Branches with
  under 2 weeks of history use their sales so far (min. 7-day divisor).
- **Reorder** when *on hand + on the way* ≤ forecast × (lead time + safety).
- **Order up to** forecast × (lead time + cover + safety), in whole cases.

Defaults: lead time 14, cover 14, safety 7 days (Admin → Partner Settings).
Partners get an email when a new suggestion opens and can **approve** it as is,
**adjust** quantities in the order form, or skip it (**Not now** — no new one for
2 days). Approved suggestions become normal split orders.

### Consignment settlements

Consignment stock is paid as it sells. Every period (default 7 days, set per
partner on their admin page) the partner settles the sales recorded for that
period on **Consignment**, by HitPay or bank transfer; admins can also record
cash/check settlements at **/admin/consignment** and verify bank transfers there.

- Periods run back-to-back from the day after the last settlement, so no sales
  are missed or counted twice; sales in a settled period are locked.
- Each branch's sales are matched to that branch's consignment deliveries, oldest
  first, at the consignment case price ÷ case size. If a branch also holds stock
  bought on COD/30 days, sales count against the consignment stock first; anything
  beyond the consignment stock isn't charged again.
- A settlement creates a payment on each consignment order it draws from (capped
  at that order's open balance). Shipping fees and returned stock (*Return credit*)
  are handled on the order as before.
- An unfinished online payment expires after 2 hours, or immediately when the
  partner tries again.
- The daily job emails a reminder when a period has passed and sales are unsettled.

## Roles

Owners manage the team under **Admin → Team** (add people with a role; change
role, commission or active status). Everyone changes their own password under
**My Account**. Existing admins became Owners. There is always at least one active Owner.

| Role | Can |
|---|---|
| **Owner** | Everything, including Team, Partner Settings and default prices |
| **Manager** | Approve partners, set partner prices, all orders and payments, reports |
| **Fulfillment** | Confirm / ship / deliver partner orders, shop stock. Sees no prices or payments |
| **Finance** | Confirm or record payments and consignment, reports, all commissions |
| **Viewer** | Read-only partners, orders and reports |
| **Account Manager** | Only their assigned partners: orders, inventory, deliveries, balances, reports. Logs collections (pending until Finance confirms). Sees their commission |

### Account managers (freelance)

- Each has a personal **sign-up link** (`/partners/apply?ref=CODE`, on their
  My Accounts / My Account page). Partners who apply with it — or that the
  account manager signs up on their own phone while logged in — are assigned to
  them automatically. An Owner or Manager still approves the account and sets prices.
- Owners/Managers can assign or reassign any partner on the partner's page.
- **Collections:** cash, check or transfers they log are *pending* until Finance
  (or an Owner/Manager) confirms the money arrived; only then do they reduce the
  balance.
- **Commission:** a % per account manager, earned on payments **confirmed** for
  their accounts (return credits excluded). The rate is recorded on each payment
  when it's confirmed, so changing a rate later doesn't change past commission.
  See **Admin → Commissions** (by month).

### Partner branch staff

Partner owners add staff under **Portal → Team** with a login and the
branch(es) they work at. Branch staff can only record daily sales and stock
changes for those branches; they can't order or see prices, payments or reports.

## Emails

All emails use the site's blush/rose design (`lib/email-layout.ts`), come from
`noreply@mysensare.com`, and replies go to **mysensare@gmail.com**.

- **The shop inbox (mysensare@gmail.com) gets every alert:** new partner
  applications and orders, bank transfers and collections to verify, late
  consignment payments, paid shop orders, new newsletter subscribers and
  contact-form messages. Team members whose role handles the alert (and the
  partner's account manager) still get a copy.
- Customers and partners get their own emails (approvals, order updates,
  payment receipts, reminders, password resets, ritual guide, order confirmation).

## Security model

- All data access is server-side with explicit checks (`lib/auth.ts`); every server
  action re-verifies the user. The database is reachable only with `DATABASE_URL`,
  which never leaves the server.
- Passwords: scrypt with per-user salt. Sessions: random 256-bit tokens, stored
  hashed, httpOnly + Secure + SameSite=Lax cookies, 30-day expiry; changing or
  resetting a password signs out other devices.
- 8 failed sign-ins for an email within 15 minutes pauses sign-in; reset links are
  single-use and expire after 1 hour (max 3 per hour).
- Partners only ever see their own rows; account managers only their assigned
  partners; branch staff only their branches. Every permission is checked on the
  server (pages, actions and CSV downloads), not just hidden in menus.
