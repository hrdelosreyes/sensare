# Partner & Reseller Portal

Partners apply at **/partners**, an admin approves them, and approved partners use
**/partners/portal** to order (in cases of 12), track inventory, record daily sales
and run reports. Admins manage everything under **/admin**.

## One-time setup

1. **Run the SQL** in Supabase → SQL Editor: `supabase/partner_portal.sql`.
   It is safe to re-run. It also revokes public access to the existing
   `sensare_decrement_stock` function (the public anon key could call it before).
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
   partners, and the low-stock warning threshold.
5. Environment variables are unchanged (`NEXT_PUBLIC_SUPABASE_URL`,
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

Reorder suggestions appear when a product has fewer days of stock than the
threshold, based on the partner's last 14 days of sales.

## Security model

- All data access is server-side with explicit checks (`lib/auth.ts`); every server
  action re-verifies the user.
- RLS is on for every new table; the anon key can't read or write any of it, and the
  database functions can only be called with the service role.
- Partners only ever see their own rows.
