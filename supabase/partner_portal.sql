-- ============================================================================
-- Sensarè Partner & Reseller Portal
-- Run in Supabase → SQL Editor AFTER schema.sql / functions.sql.
-- Safe to re-run (idempotent where possible).
--
-- Model overview
--   sensare_admins                 – staff who can log in to /admin (multiple)
--   sensare_partners               – reseller accounts (pending → approved)
--   sensare_partner_prices         – custom case price per partner per product
--   sensare_partner_orders/_items  – wholesale orders (in cases of 12)
--   sensare_partner_payments       – HitPay / bank transfer / cash / credits
--   sensare_partner_inventory_movements – stock ledger per partner (units)
--   sensare_partner_sales          – daily sales entered by partners (units)
--   sensare_settings               – key/value settings (bank details, etc.)
--
-- All app access goes through the server using the service-role key and
-- explicit authorization checks. RLS is enabled on every table so the public
-- anon key cannot read or write any of this data; partners additionally get
-- read-only policies on their own rows (defense in depth).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Products: wholesale fields
-- ---------------------------------------------------------------------------
alter table sensare_products add column if not exists case_size integer not null default 12;
alter table sensare_products add column if not exists wholesale_case_price_php numeric(10,2);
alter table sensare_products add column if not exists is_wholesale boolean not null default true;

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------
create table if not exists sensare_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Partners
-- ---------------------------------------------------------------------------
create table if not exists sensare_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references auth.users(id) on delete cascade,
  business_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  tin text,
  business_type text,                -- retail_store | online_seller | distributor | events | other
  address text,
  city text,
  province text,
  sales_channels text,
  expected_monthly_cases integer,
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'suspended')),
  default_payment_terms text not null default 'cod'
    check (default_payment_terms in ('cod', 'consignment', 'net30')),
  admin_notes text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sensare_partners_status_idx on sensare_partners(status);

-- Custom case price per partner (falls back to sensare_products.wholesale_case_price_php)
create table if not exists sensare_partner_prices (
  partner_id uuid not null references sensare_partners(id) on delete cascade,
  product_id uuid not null references sensare_products(id) on delete cascade,
  case_price_php numeric(10,2),     -- null = use product default
  is_available boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (partner_id, product_id)
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create sequence if not exists sensare_partner_order_seq;

create table if not exists sensare_partner_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null
    default ('SPO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('sensare_partner_order_seq')::text, 5, '0')),
  partner_id uuid not null references sensare_partners(id) on delete restrict,
  status text not null default 'submitted'
    check (status in ('submitted', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  payment_terms text not null
    check (payment_terms in ('cod', 'consignment', 'net30')),
  subtotal_php numeric(12,2) not null default 0,
  shipping_php numeric(12,2) not null default 0,
  total_php numeric(12,2) not null default 0,
  amount_paid_php numeric(12,2) not null default 0,   -- sum of confirmed payments (maintained by trigger)
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'partial', 'paid')),
  due_date date,                                       -- net30: delivered + 30 days; cod: delivery date
  shipping_address text,
  partner_notes text,
  admin_notes text,
  tracking_info text,
  stock_deducted boolean not null default false,       -- warehouse stock taken on confirm
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sensare_partner_orders_partner_idx on sensare_partner_orders(partner_id, created_at desc);
create index if not exists sensare_partner_orders_status_idx on sensare_partner_orders(status);

create table if not exists sensare_partner_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references sensare_partner_orders(id) on delete cascade,
  product_id uuid not null references sensare_products(id) on delete restrict,
  product_name text not null,
  case_qty integer not null check (case_qty > 0),
  case_size integer not null check (case_size > 0),
  case_price_php numeric(10,2) not null check (case_price_php >= 0),
  line_total_php numeric(12,2) not null
);
create index if not exists sensare_partner_order_items_order_idx on sensare_partner_order_items(order_id);

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------
create table if not exists sensare_partner_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references sensare_partner_orders(id) on delete cascade,
  partner_id uuid not null references sensare_partners(id) on delete cascade,
  amount_php numeric(12,2) not null check (amount_php > 0),
  method text not null
    check (method in ('hitpay', 'bank_transfer', 'cash', 'check', 'return_credit', 'other')),
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'rejected', 'failed')),
  reference text,                      -- bank ref no. / HitPay reference
  hitpay_payment_id text,
  notes text,
  paid_on date,
  created_by uuid references auth.users(id) on delete set null,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sensare_partner_payments_order_idx on sensare_partner_payments(order_id);
create unique index if not exists sensare_partner_payments_ref_idx
  on sensare_partner_payments(reference) where method = 'hitpay';

-- Keep order.amount_paid_php / payment_status in sync with confirmed payments
create or replace function sensare_partner_sync_order_payment()
returns trigger language plpgsql as $$
declare
  v_order_id uuid := coalesce(new.order_id, old.order_id);
  v_paid numeric(12,2);
  v_total numeric(12,2);
begin
  select coalesce(sum(amount_php), 0) into v_paid
  from sensare_partner_payments
  where order_id = v_order_id and status = 'confirmed';

  select total_php into v_total from sensare_partner_orders where id = v_order_id;

  update sensare_partner_orders
  set amount_paid_php = v_paid,
      payment_status = case
        when v_paid <= 0 then 'unpaid'
        when v_paid >= v_total then 'paid'
        else 'partial' end,
      updated_at = now()
  where id = v_order_id;
  return null;
end;
$$;

drop trigger if exists sensare_partner_payments_sync on sensare_partner_payments;
create trigger sensare_partner_payments_sync
  after insert or update or delete on sensare_partner_payments
  for each row execute function sensare_partner_sync_order_payment();

-- Recompute payment_status when an order total changes (e.g. shipping fee edited)
create or replace function sensare_partner_order_total_changed()
returns trigger language plpgsql as $$
begin
  if new.total_php is distinct from old.total_php then
    new.payment_status := case
      when new.amount_paid_php <= 0 then 'unpaid'
      when new.amount_paid_php >= new.total_php then 'paid'
      else 'partial' end;
  end if;
  return new;
end;
$$;

drop trigger if exists sensare_partner_orders_total on sensare_partner_orders;
create trigger sensare_partner_orders_total
  before update of total_php on sensare_partner_orders
  for each row execute function sensare_partner_order_total_changed();

-- ---------------------------------------------------------------------------
-- Partner inventory ledger + daily sales
-- ---------------------------------------------------------------------------
create table if not exists sensare_partner_sales (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references sensare_partners(id) on delete cascade,
  product_id uuid not null references sensare_products(id) on delete restrict,
  sale_date date not null,
  units_sold integer not null check (units_sold >= 0),
  unit_price_php numeric(10,2),        -- partner's selling price (optional)
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (partner_id, sale_date, product_id)
);
create index if not exists sensare_partner_sales_partner_date_idx on sensare_partner_sales(partner_id, sale_date);

create table if not exists sensare_partner_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references sensare_partners(id) on delete cascade,
  product_id uuid not null references sensare_products(id) on delete restrict,
  qty_change integer not null,          -- units (+ in, - out)
  movement_type text not null
    check (movement_type in ('delivery', 'sale', 'adjustment')),
  reason text,                          -- adjustments: damaged | expired | returned | count_correction | other
  order_id uuid references sensare_partner_orders(id) on delete set null,
  sale_id uuid references sensare_partner_sales(id) on delete cascade,
  batch_code text,
  expiry_date date,
  notes text,
  movement_date date not null default current_date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists sensare_partner_inv_partner_idx on sensare_partner_inventory_movements(partner_id, product_id);
create unique index if not exists sensare_partner_inv_sale_idx on sensare_partner_inventory_movements(sale_id) where sale_id is not null;

create or replace view sensare_partner_stock
with (security_invoker = true) as
select partner_id, product_id, sum(qty_change)::integer as on_hand
from sensare_partner_inventory_movements
group by partner_id, product_id;

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
create table if not exists sensare_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
insert into sensare_settings (key, value) values
  ('partner_bank_details', 'Bank: (set in Admin → Partner Settings)'),
  ('partner_low_stock_days', '7')
on conflict (key) do nothing;

-- ============================================================================
-- Transactional functions (called only by the server with the service role)
-- ============================================================================

-- Confirm a submitted order: deduct warehouse stock atomically.
create or replace function sensare_partner_confirm_order(p_order_id uuid)
returns void language plpgsql as $$
declare
  v_order sensare_partner_orders%rowtype;
  r record;
  v_stock integer;
begin
  select * into v_order from sensare_partner_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status <> 'submitted' then
    raise exception 'Only submitted orders can be confirmed (current: %)', v_order.status;
  end if;

  for r in
    select product_id, product_name, sum(case_qty * case_size)::integer as units
    from sensare_partner_order_items where order_id = p_order_id
    group by product_id, product_name
  loop
    select stock_qty into v_stock from sensare_products where id = r.product_id for update;
    if v_stock < r.units then
      raise exception 'Not enough warehouse stock for % (need %, have %)', r.product_name, r.units, v_stock;
    end if;
    update sensare_products set stock_qty = stock_qty - r.units where id = r.product_id;
  end loop;

  update sensare_partner_orders
  set status = 'confirmed', stock_deducted = true, confirmed_at = now(), updated_at = now()
  where id = p_order_id;
end;
$$;

-- Cancel an order; returns warehouse stock if it was deducted.
create or replace function sensare_partner_cancel_order(p_order_id uuid)
returns void language plpgsql as $$
declare
  v_order sensare_partner_orders%rowtype;
  r record;
begin
  select * into v_order from sensare_partner_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status in ('delivered', 'cancelled') then
    raise exception 'Order cannot be cancelled (current: %)', v_order.status;
  end if;

  if v_order.stock_deducted then
    for r in
      select product_id, sum(case_qty * case_size)::integer as units
      from sensare_partner_order_items where order_id = p_order_id group by product_id
    loop
      update sensare_products set stock_qty = stock_qty + r.units where id = r.product_id;
    end loop;
  end if;

  update sensare_partner_orders
  set status = 'cancelled', stock_deducted = false, cancelled_at = now(), updated_at = now()
  where id = p_order_id;
end;
$$;

-- Mark delivered: add units to partner inventory and set due date.
create or replace function sensare_partner_deliver_order(p_order_id uuid, p_user_id uuid)
returns void language plpgsql as $$
declare
  v_order sensare_partner_orders%rowtype;
begin
  select * into v_order from sensare_partner_orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status not in ('confirmed', 'shipped') then
    raise exception 'Only confirmed or shipped orders can be delivered (current: %)', v_order.status;
  end if;

  insert into sensare_partner_inventory_movements
    (partner_id, product_id, qty_change, movement_type, order_id, notes, created_by)
  select v_order.partner_id, product_id, sum(case_qty * case_size)::integer, 'delivery', p_order_id,
         'Order ' || v_order.order_number, p_user_id
  from sensare_partner_order_items where order_id = p_order_id
  group by product_id;

  update sensare_partner_orders
  set status = 'delivered',
      delivered_at = now(),
      shipped_at = coalesce(shipped_at, now()),
      due_date = case payment_terms
        when 'net30' then current_date + 30
        when 'cod' then current_date
        else null end,
      updated_at = now()
  where id = p_order_id;
end;
$$;

-- Record / update a daily sale and keep the inventory ledger in sync.
-- units = 0 removes the entry. Refuses to drive stock below zero.
create or replace function sensare_partner_record_sale(
  p_partner_id uuid, p_product_id uuid, p_sale_date date,
  p_units integer, p_unit_price numeric, p_notes text, p_user_id uuid
) returns void language plpgsql as $$
declare
  v_existing sensare_partner_sales%rowtype;
  v_on_hand integer;
  v_sale_id uuid;
  v_name text;
begin
  if p_units < 0 then raise exception 'Units cannot be negative'; end if;
  if p_sale_date > current_date + 1 then raise exception 'Sale date cannot be in the future'; end if;

  -- serialize per partner+product
  perform pg_advisory_xact_lock(hashtext(p_partner_id::text || p_product_id::text));

  select * into v_existing from sensare_partner_sales
  where partner_id = p_partner_id and product_id = p_product_id and sale_date = p_sale_date;

  select coalesce(sum(qty_change), 0) into v_on_hand
  from sensare_partner_inventory_movements
  where partner_id = p_partner_id and product_id = p_product_id;

  if p_units > 0 and not exists (
    select 1 from sensare_partner_inventory_movements
    where partner_id = p_partner_id and product_id = p_product_id
      and qty_change > 0 and movement_date <= p_sale_date
  ) then
    select name into v_name from sensare_products where id = p_product_id;
    raise exception 'Not enough stock for % on that date (no delivery received yet)', v_name;
  end if;

  if v_on_hand + coalesce(v_existing.units_sold, 0) - p_units < 0 then
    select name into v_name from sensare_products where id = p_product_id;
    raise exception 'Not enough stock for % (on hand: %)', v_name, v_on_hand + coalesce(v_existing.units_sold, 0);
  end if;

  if p_units = 0 then
    if v_existing.id is not null then
      delete from sensare_partner_sales where id = v_existing.id; -- cascades movement
    end if;
    return;
  end if;

  insert into sensare_partner_sales (partner_id, product_id, sale_date, units_sold, unit_price_php, notes, created_by)
  values (p_partner_id, p_product_id, p_sale_date, p_units, p_unit_price, p_notes, p_user_id)
  on conflict (partner_id, sale_date, product_id) do update
    set units_sold = excluded.units_sold,
        unit_price_php = excluded.unit_price_php,
        notes = excluded.notes,
        updated_at = now()
  returning id into v_sale_id;

  delete from sensare_partner_inventory_movements where sale_id = v_sale_id;
  insert into sensare_partner_inventory_movements
    (partner_id, product_id, qty_change, movement_type, sale_id, movement_date, created_by)
  values (p_partner_id, p_product_id, -p_units, 'sale', v_sale_id, p_sale_date, p_user_id);
end;
$$;

-- Manual inventory adjustment (damaged, expired, returned, count correction).
create or replace function sensare_partner_adjust_inventory(
  p_partner_id uuid, p_product_id uuid, p_qty_change integer,
  p_reason text, p_notes text, p_batch text, p_expiry date, p_user_id uuid
) returns void language plpgsql as $$
declare
  v_on_hand integer;
begin
  if p_qty_change = 0 then raise exception 'Quantity cannot be zero'; end if;
  perform pg_advisory_xact_lock(hashtext(p_partner_id::text || p_product_id::text));

  select coalesce(sum(qty_change), 0) into v_on_hand
  from sensare_partner_inventory_movements
  where partner_id = p_partner_id and product_id = p_product_id;

  if v_on_hand + p_qty_change < 0 then
    raise exception 'Adjustment would make stock negative (on hand: %)', v_on_hand;
  end if;

  insert into sensare_partner_inventory_movements
    (partner_id, product_id, qty_change, movement_type, reason, notes, batch_code, expiry_date, created_by)
  values (p_partner_id, p_product_id, p_qty_change, 'adjustment', p_reason, p_notes, p_batch, p_expiry, p_user_id);
end;
$$;

-- Report: per partner × product stock flow for a date range (units).
-- p_partner_id null = all partners.
create or replace function sensare_partner_report(p_partner_id uuid, p_from date, p_to date)
returns table (
  partner_id uuid, product_id uuid,
  opening integer, received integer, sold integer, adjusted integer, closing integer,
  sales_value numeric
) language sql stable as $$
  with m as (
    select m.partner_id, m.product_id, m.qty_change, m.movement_type, m.movement_date
    from sensare_partner_inventory_movements m
    where (p_partner_id is null or m.partner_id = p_partner_id) and m.movement_date <= p_to
  ),
  flow as (
    select partner_id, product_id,
      coalesce(sum(qty_change) filter (where movement_date < p_from), 0)::integer as opening,
      coalesce(sum(qty_change) filter (where movement_date >= p_from and movement_type = 'delivery'), 0)::integer as received,
      coalesce(-sum(qty_change) filter (where movement_date >= p_from and movement_type = 'sale'), 0)::integer as sold,
      coalesce(sum(qty_change) filter (where movement_date >= p_from and movement_type = 'adjustment'), 0)::integer as adjusted,
      coalesce(sum(qty_change), 0)::integer as closing
    from m group by partner_id, product_id
  ),
  val as (
    select s.partner_id, s.product_id, sum(s.units_sold * coalesce(s.unit_price_php, 0)) as sales_value
    from sensare_partner_sales s
    where (p_partner_id is null or s.partner_id = p_partner_id) and s.sale_date between p_from and p_to
    group by s.partner_id, s.product_id
  )
  select f.partner_id, f.product_id, f.opening, f.received, f.sold, f.adjusted, f.closing, coalesce(v.sales_value, 0)
  from flow f left join val v on v.partner_id = f.partner_id and v.product_id = f.product_id;
$$;

-- Report: daily sales totals for a date range.
create or replace function sensare_partner_report_daily(p_partner_id uuid, p_from date, p_to date)
returns table (sale_date date, units integer, sales_value numeric)
language sql stable as $$
  select s.sale_date, sum(s.units_sold)::integer, sum(s.units_sold * coalesce(s.unit_price_php, 0))
  from sensare_partner_sales s
  where (p_partner_id is null or s.partner_id = p_partner_id) and s.sale_date between p_from and p_to
  group by s.sale_date order by s.sale_date;
$$;

-- Lock functions down: only the service role (server) may call them.
revoke execute on function sensare_partner_confirm_order(uuid) from public, anon, authenticated;
revoke execute on function sensare_partner_cancel_order(uuid) from public, anon, authenticated;
revoke execute on function sensare_partner_deliver_order(uuid, uuid) from public, anon, authenticated;
revoke execute on function sensare_partner_record_sale(uuid, uuid, date, integer, numeric, text, uuid) from public, anon, authenticated;
revoke execute on function sensare_partner_adjust_inventory(uuid, uuid, integer, text, text, text, date, uuid) from public, anon, authenticated;
revoke execute on function sensare_partner_report(uuid, date, date) from public, anon, authenticated;
revoke execute on function sensare_partner_report_daily(uuid, date, date) from public, anon, authenticated;
revoke execute on function sensare_partner_sync_order_payment() from public, anon, authenticated;
revoke execute on function sensare_partner_order_total_changed() from public, anon, authenticated;

-- Existing storefront function was callable by anyone holding the public anon key.
revoke execute on function sensare_decrement_stock(uuid, integer) from public, anon, authenticated;

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table sensare_admins enable row level security;
alter table sensare_partners enable row level security;
alter table sensare_partner_prices enable row level security;
alter table sensare_partner_orders enable row level security;
alter table sensare_partner_order_items enable row level security;
alter table sensare_partner_payments enable row level security;
alter table sensare_partner_sales enable row level security;
alter table sensare_partner_inventory_movements enable row level security;
alter table sensare_settings enable row level security;

-- Partners may read their own rows (writes go through the server only).
drop policy if exists "Partner reads own profile" on sensare_partners;
create policy "Partner reads own profile" on sensare_partners
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "Partner reads own prices" on sensare_partner_prices;
create policy "Partner reads own prices" on sensare_partner_prices
  for select to authenticated
  using (partner_id in (select id from sensare_partners where user_id = auth.uid() and status = 'approved'));

drop policy if exists "Partner reads own orders" on sensare_partner_orders;
create policy "Partner reads own orders" on sensare_partner_orders
  for select to authenticated
  using (partner_id in (select id from sensare_partners where user_id = auth.uid() and status = 'approved'));

drop policy if exists "Partner reads own order items" on sensare_partner_order_items;
create policy "Partner reads own order items" on sensare_partner_order_items
  for select to authenticated
  using (order_id in (
    select o.id from sensare_partner_orders o
    join sensare_partners p on p.id = o.partner_id
    where p.user_id = auth.uid() and p.status = 'approved'));

drop policy if exists "Partner reads own payments" on sensare_partner_payments;
create policy "Partner reads own payments" on sensare_partner_payments
  for select to authenticated
  using (partner_id in (select id from sensare_partners where user_id = auth.uid() and status = 'approved'));

drop policy if exists "Partner reads own sales" on sensare_partner_sales;
create policy "Partner reads own sales" on sensare_partner_sales
  for select to authenticated
  using (partner_id in (select id from sensare_partners where user_id = auth.uid() and status = 'approved'));

drop policy if exists "Partner reads own inventory" on sensare_partner_inventory_movements;
create policy "Partner reads own inventory" on sensare_partner_inventory_movements
  for select to authenticated
  using (partner_id in (select id from sensare_partners where user_id = auth.uid() and status = 'approved'));

-- sensare_admins and sensare_settings: no policies → service role only.

-- ============================================================================
-- FIRST ADMIN (run once, after creating the user in Supabase → Authentication
-- → Users → "Add user" with "Auto Confirm User" ticked):
--
--   insert into sensare_admins (user_id, email, name)
--   select id, email, 'Owner' from auth.users where email = 'you@example.com';
--
-- After that, more admins can be added from /admin/team.
-- ============================================================================
