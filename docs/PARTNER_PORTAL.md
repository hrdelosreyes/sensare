# Partner & Reseller Portal

Partners apply at **/partners**, an admin approves them, and approved partners use
**/partners/portal** to order (in cases of 12), track inventory, record daily sales
and run reports. Admins manage everything under **/admin**.

## One-time setup

1. **Run the SQL** in Supabase → SQL Editor, in this order:
   `supabase/partner_portal.sql`, then `supabase/partner_portal_v2.sql`.
   Both are safe to re-run (if you re-run the first, re-run the second after it).
   The first also revokes public access to the existing `sensare_decrement_stock`
   function (the public anon key could call it before). The second adds branches,
   order suggestions and consignment settlements, and moves any existing partner
   data onto each partner's "Main" branch.
2. **Create the first admin.** The old `ADMIN_PASSWORD` login is gone — admins now
   sign in with email + password.
   - Supabase → Authentication → Users → *Add user* (tick *Auto Confirm User*).
   - Then in the SQL Editor:
     ```sql
     insert into sensare_admins (user_id, email, name)
     select id, email, 'Owner' from auth.users where email = 'you@example.com';
     ```
   - Add more admins afterwards from **/admin/team**.
3. **Supabase Auth settings** (Authentication → URL Configuration): add
   `https://mysensare.com/partners/auth/callback` to *Redirect URLs* so
   password-reset emails work.
4. **Set partner defaults** at **/admin/partner-settings**: default case price per
   product (used when a partner has no custom price), bank-transfer details shown to
   partners, and the reorder settings (lead time 14 / cover 14 / safety 7 days).
5. **Daily job.** `vercel.json` schedules `/api/cron/partners` every day at 06:00
   Manila time. Set a `CRON_SECRET` environment variable in Vercel (any long
   random string) — Vercel sends it automatically, and the endpoint refuses calls
   without it. Not on Vercel? Call the URL daily with
   `Authorization: Bearer <CRON_SECRET>`.
6. Other environment variables are unchanged (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`,
   `HITPAY_API_KEY`, `HITPAY_SALT`, `NEXT_PUBLIC_HITPAY_MODE`, `NEXT_PUBLIC_APP_URL`).
   `ADMIN_PASSWORD` is no longer used and can be removed.

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

## Security model

- All data access is server-side with explicit checks (`lib/auth.ts`); every server
  action re-verifies the user.
- RLS is on for every new table; the anon key can't read or write any of it, and the
  database functions can only be called with the service role.
- Partners only ever see their own rows.
