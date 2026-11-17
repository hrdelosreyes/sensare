-- Sensarè partner & reseller portal (Neon / plain Postgres).
-- Applied automatically by scripts/migrate.mjs on deploy.

alter table sensare_products add column if not exists case_size integer not null default 12;
alter table sensare_products add column if not exists wholesale_case_price_php numeric(10,2);
alter table sensare_products add column if not exists is_wholesale boolean not null default true;

create table if not exists sensare_settings (
  key text primary key,
  value text,
  updated_at timestamptz not null default now()
);
insert into sensare_settings (key, value) values
  ('partner_bank_details', 'Bank: (set in Admin → Partner Settings)'),
  ('partner_lead_time_days', '14'),
  ('partner_cover_days', '14'),
  ('partner_safety_days', '7')
on conflict (key) do nothing;

-- Partners --------------------------------------------------------------------
create table if not exists sensare_partners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references sensare_users(id) on delete cascade,
  business_name text not null,
  contact_name text not null,
  email text not null,
  phone text,
  tin text,
  business_type text,
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
  consignment_period_days integer not null default 7 check (consignment_period_days between 1 and 90),
  consignment_reminded_at timestamptz,
  admin_notes text,
  reviewed_by uuid references sensare_users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sensare_partners_status_idx on sensare_partners(status);

create table if not exists sensare_partner_locations (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references sensare_partners(id) on delete cascade,
  name text not null,
  contact_name text,
  phone text,
  address text,
  city text,
  province text,
  delivery_notes text,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, partner_id)
);
create index if not exists sensare_partner_locations_partner_idx on sensare_partner_locations(partner_id);
create unique index if not exists sensare_partner_locations_default_idx
  on sensare_partner_locations(partner_id) where is_default;

create table if not exists sensare_partner_prices (
  partner_id uuid not null references sensare_partners(id) on delete cascade,
  product_id uuid not null references sensare_products(id) on delete cascade,
  case_price_php numeric(10,2),
  is_available boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (partner_id, product_id)
);

-- Orders ----------------------------------------------------------------------
create sequence if not exists sensare_partner_order_seq;

create table if not exists sensare_partner_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null
    default ('SPO-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('sensare_partner_order_seq')::text, 5, '0')),
  partner_id uuid not null references sensare_partners(id) on delete restrict,
  location_id uuid not null,
  order_group_id uuid not null default gen_random_uuid(),
  suggestion_id uuid,
  status text not null default 'submitted'
    check (status in ('submitted', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  payment_terms text not null check (payment_terms in ('cod', 'consignment', 'net30')),
  subtotal_php numeric(12,2) not null default 0,
  shipping_php numeric(12,2) not null default 0,
  total_php numeric(12,2) not null default 0,
  amount_paid_php numeric(12,2) not null default 0,
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  due_date date,
  shipping_address text,
  partner_notes text,
  admin_notes text,
  tracking_info text,
  stock_deducted boolean not null default false,
  confirmed_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid references sensare_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (location_id, partner_id) references sensare_partner_locations(id, partner_id)
);
create index if not exists sensare_partner_orders_partner_idx on sensare_partner_orders(partner_id, created_at desc);
create index if not exists sensare_partner_orders_status_idx on sensare_partner_orders(status);
create index if not exists sensare_partner_orders_group_idx on sensare_partner_orders(order_group_id);

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

-- Consignment settlements & payments ---------------------------------------------
create table if not exists sensare_partner_consignment_settlements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references sensare_partners(id) on delete cascade,
  period_from date not null,
  period_to date not null check (period_to >= period_from),
  units integer not null default 0,
  amount_php numeric(12,2) not null default 0,
  method text not null check (method in ('hitpay', 'bank_transfer', 'cash', 'check', 'other')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'failed')),
  reference text,
  hitpay_payment_id text,
  notes text,
  paid_on date,
  created_by uuid references sensare_users(id) on delete set null,
  confirmed_by uuid references sensare_users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sensare_partner_settlements_partner_idx on sensare_partner_consignment_settlements(partner_id, period_to desc);
create index if not exists sensare_partner_settlements_ref_idx on sensare_partner_consignment_settlements(reference);

create table if not exists sensare_partner_consignment_lines (
  id uuid primary key default gen_random_uuid(),
  settlement_id uuid not null references sensare_partner_consignment_settlements(id) on delete cascade,
  order_item_id uuid not null references sensare_partner_order_items(id) on delete cascade,
  order_id uuid not null references sensare_partner_orders(id) on delete cascade,
  location_id uuid not null references sensare_partner_locations(id),
  product_id uuid not null references sensare_products(id),
  units integer not null check (units > 0),
  unit_price_php numeric(12,4) not null,
  amount_php numeric(12,2) not null
);
create index if not exists sensare_partner_consignment_lines_item_idx on sensare_partner_consignment_lines(order_item_id);

create table if not exists sensare_partner_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references sensare_partner_orders(id) on delete cascade,
  partner_id uuid not null references sensare_partners(id) on delete cascade,
  settlement_id uuid references sensare_partner_consignment_settlements(id) on delete cascade,
  amount_php numeric(12,2) not null check (amount_php > 0),
  method text not null check (method in ('hitpay', 'bank_transfer', 'cash', 'check', 'return_credit', 'other')),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'rejected', 'failed')),
  reference text,
  hitpay_payment_id text,
  notes text,
  paid_on date,
  created_by uuid references sensare_users(id) on delete set null,
  confirmed_by uuid references sensare_users(id) on delete set null,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists sensare_partner_payments_order_idx on sensare_partner_payments(order_id);
create index if not exists sensare_partner_payments_settlement_idx on sensare_partner_payments(settlement_id);
create index if not exists sensare_partner_payments_ref_idx on sensare_partner_payments(reference);

-- Sales & inventory (per location) ---------------------------------------------------
create table if not exists sensare_partner_sales (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references sensare_partners(id) on delete cascade,
  location_id uuid not null,
  product_id uuid not null references sensare_products(id) on delete restrict,
  sale_date date not null,
  units_sold integer not null check (units_sold >= 0),
  unit_price_php numeric(10,2),
  notes text,
  created_by uuid references sensare_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (location_id, partner_id) references sensare_partner_locations(id, partner_id),
  constraint sensare_partner_sales_unique_day unique (partner_id, location_id, sale_date, product_id)
);
create index if not exists sensare_partner_sales_partner_date_idx on sensare_partner_sales(partner_id, sale_date);

create table if not exists sensare_partner_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references sensare_partners(id) on delete cascade,
  location_id uuid not null,
  product_id uuid not null references sensare_products(id) on delete restrict,
  qty_change integer not null,
  movement_type text not null check (movement_type in ('delivery', 'sale', 'adjustment')),
  reason text,
  order_id uuid references sensare_partner_orders(id) on delete set null,
  sale_id uuid references sensare_partner_sales(id) on delete cascade,
  batch_code text,
  expiry_date date,
  notes text,
  movement_date date not null default ((now() at time zone 'Asia/Manila')::date),
  created_by uuid references sensare_users(id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (location_id, partner_id) references sensare_partner_locations(id, partner_id)
);
create index if not exists sensare_partner_inv_loc_idx on sensare_partner_inventory_movements(partner_id, location_id, product_id);
create unique index if not exists sensare_partner_inv_sale_idx on sensare_partner_inventory_movements(sale_id) where sale_id is not null;

create or replace view sensare_partner_stock as
select partner_id, location_id, product_id, sum(qty_change)::integer as on_hand,
       min(movement_date) filter (where movement_type = 'delivery') as first_received
from sensare_partner_inventory_movements
group by partner_id, location_id, product_id;

-- Order suggestions ---------------------------------------------------------------------
create table if not exists sensare_partner_order_suggestions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references sensare_partners(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'approved', 'dismissed', 'superseded')),
  lead_time_days integer not null,
  cover_days integer not null,
  safety_days integer not null,
  generated_at timestamptz not null default now(),
  notified_at timestamptz,
  decided_at timestamptz,
  decided_by uuid references sensare_users(id) on delete set null,
  order_group_id uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists sensare_partner_suggestions_open_idx
  on sensare_partner_order_suggestions(partner_id) where status = 'open';

create table if not exists sensare_partner_order_suggestion_lines (
  id uuid primary key default gen_random_uuid(),
  suggestion_id uuid not null references sensare_partner_order_suggestions(id) on delete cascade,
  location_id uuid not null references sensare_partner_locations(id) on delete cascade,
  product_id uuid not null references sensare_products(id) on delete cascade,
  suggested_cases integer not null check (suggested_cases > 0),
  case_size integer not null,
  on_hand integer not null,
  on_order integer not null,
  avg_daily numeric(10,3) not null,
  trend_pct numeric(8,1),
  days_cover numeric(8,1),
  stockout_date date
);
create index if not exists sensare_partner_suggestion_lines_idx on sensare_partner_order_suggestion_lines(suggestion_id);

-- ================================================================================
-- Functions & triggers
-- ================================================================================


create or replace function sensare_partner_default_location()
returns trigger language plpgsql as $$
begin
  insert into sensare_partner_locations (partner_id, name, contact_name, phone, address, city, province, is_default)
  values (new.id, 'Main', new.contact_name, new.phone, new.address, new.city, new.province, true);
  return new;
end;
$$;

drop trigger if exists sensare_partners_default_location on sensare_partners;
create trigger sensare_partners_default_location
  after insert on sensare_partners
  for each row execute function sensare_partner_default_location();

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

create or replace function sensare_partner_settlement_status_sync()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    update sensare_partner_payments
    set status = new.status, confirmed_at = new.confirmed_at, confirmed_by = new.confirmed_by,
        paid_on = coalesce(new.paid_on, paid_on), hitpay_payment_id = coalesce(new.hitpay_payment_id, hitpay_payment_id)
    where settlement_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists sensare_partner_settlement_status on sensare_partner_consignment_settlements;
create trigger sensare_partner_settlement_status
  after update of status on sensare_partner_consignment_settlements
  for each row execute function sensare_partner_settlement_status_sync();

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
    (partner_id, location_id, product_id, qty_change, movement_type, order_id, notes, created_by, movement_date)
  select v_order.partner_id, v_order.location_id, product_id, sum(case_qty * case_size)::integer, 'delivery', p_order_id,
         'Order ' || v_order.order_number, p_user_id, (now() at time zone 'Asia/Manila')::date
  from sensare_partner_order_items where order_id = p_order_id
  group by product_id;

  update sensare_partner_orders
  set status = 'delivered',
      delivered_at = now(),
      shipped_at = coalesce(shipped_at, now()),
      due_date = case payment_terms
        when 'net30' then (now() at time zone 'Asia/Manila')::date + 30
        when 'cod' then (now() at time zone 'Asia/Manila')::date
        else null end,
      updated_at = now()
  where id = p_order_id;
end;
$$;

create or replace function sensare_partner_record_sale(
  p_partner_id uuid, p_location_id uuid, p_product_id uuid, p_sale_date date,
  p_units integer, p_unit_price numeric, p_notes text, p_user_id uuid
) returns void language plpgsql as $$
declare
  v_existing sensare_partner_sales%rowtype;
  v_on_hand integer;
  v_sale_id uuid;
  v_name text;
begin
  if p_units < 0 then raise exception 'Units cannot be negative'; end if;
  if p_sale_date > (now() at time zone 'Asia/Manila')::date then raise exception 'Sale date cannot be in the future'; end if;
  if not exists (select 1 from sensare_partner_locations where id = p_location_id and partner_id = p_partner_id) then
    raise exception 'Unknown location';
  end if;
  if exists (
    select 1 from sensare_partner_consignment_settlements
    where partner_id = p_partner_id and status in ('pending', 'confirmed')
      and p_sale_date between period_from and period_to
  ) then
    raise exception 'Sales on % are part of a consignment settlement and can no longer be changed', p_sale_date;
  end if;

  perform pg_advisory_xact_lock(hashtext(p_location_id::text || p_product_id::text));

  select * into v_existing from sensare_partner_sales
  where partner_id = p_partner_id and location_id = p_location_id and product_id = p_product_id and sale_date = p_sale_date;

  select coalesce(sum(qty_change), 0) into v_on_hand
  from sensare_partner_inventory_movements
  where location_id = p_location_id and product_id = p_product_id;

  select name into v_name from sensare_products where id = p_product_id;

  if p_units > 0 and not exists (
    select 1 from sensare_partner_inventory_movements
    where location_id = p_location_id and product_id = p_product_id
      and qty_change > 0 and movement_date <= p_sale_date
  ) then
    raise exception 'Not enough stock for % on that date (no delivery received yet)', v_name;
  end if;

  if v_on_hand + coalesce(v_existing.units_sold, 0) - p_units < 0 then
    raise exception 'Not enough stock for % (on hand: %)', v_name, v_on_hand + coalesce(v_existing.units_sold, 0);
  end if;

  if p_units = 0 then
    if v_existing.id is not null then
      delete from sensare_partner_sales where id = v_existing.id; -- cascades movement
    end if;
    return;
  end if;

  insert into sensare_partner_sales (partner_id, location_id, product_id, sale_date, units_sold, unit_price_php, notes, created_by)
  values (p_partner_id, p_location_id, p_product_id, p_sale_date, p_units, p_unit_price, p_notes, p_user_id)
  on conflict (partner_id, location_id, sale_date, product_id) do update
    set units_sold = excluded.units_sold,
        unit_price_php = excluded.unit_price_php,
        notes = excluded.notes,
        updated_at = now()
  returning id into v_sale_id;

  delete from sensare_partner_inventory_movements where sale_id = v_sale_id;
  insert into sensare_partner_inventory_movements
    (partner_id, location_id, product_id, qty_change, movement_type, sale_id, movement_date, created_by)
  values (p_partner_id, p_location_id, p_product_id, -p_units, 'sale', v_sale_id, p_sale_date, p_user_id);
end;
$$;

create or replace function sensare_partner_adjust_inventory(
  p_partner_id uuid, p_location_id uuid, p_product_id uuid, p_qty_change integer,
  p_reason text, p_notes text, p_batch text, p_expiry date, p_user_id uuid
) returns void language plpgsql as $$
declare
  v_on_hand integer;
begin
  if p_qty_change = 0 then raise exception 'Quantity cannot be zero'; end if;
  if not exists (select 1 from sensare_partner_locations where id = p_location_id and partner_id = p_partner_id) then
    raise exception 'Unknown location';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_location_id::text || p_product_id::text));

  select coalesce(sum(qty_change), 0) into v_on_hand
  from sensare_partner_inventory_movements
  where location_id = p_location_id and product_id = p_product_id;

  if v_on_hand + p_qty_change < 0 then
    raise exception 'Adjustment would make stock negative (on hand: %)', v_on_hand;
  end if;

  insert into sensare_partner_inventory_movements
    (partner_id, location_id, product_id, qty_change, movement_type, reason, notes, batch_code, expiry_date, created_by,
     movement_date)
  values (p_partner_id, p_location_id, p_product_id, p_qty_change, 'adjustment', p_reason, p_notes, p_batch, p_expiry, p_user_id,
     (now() at time zone 'Asia/Manila')::date);
end;
$$;

create or replace function sensare_partner_report(p_partner_id uuid, p_location_id uuid, p_from date, p_to date)
returns table (
  partner_id uuid, location_id uuid, product_id uuid,
  opening integer, received integer, sold integer, adjusted integer, closing integer,
  sales_value numeric
) language sql stable as $$
  with m as (
    select m.partner_id, m.location_id, m.product_id, m.qty_change, m.movement_type, m.movement_date
    from sensare_partner_inventory_movements m
    where (p_partner_id is null or m.partner_id = p_partner_id)
      and (p_location_id is null or m.location_id = p_location_id)
      and m.movement_date <= p_to
  ),
  flow as (
    select partner_id, location_id, product_id,
      coalesce(sum(qty_change) filter (where movement_date < p_from), 0)::integer as opening,
      coalesce(sum(qty_change) filter (where movement_date >= p_from and movement_type = 'delivery'), 0)::integer as received,
      coalesce(-sum(qty_change) filter (where movement_date >= p_from and movement_type = 'sale'), 0)::integer as sold,
      coalesce(sum(qty_change) filter (where movement_date >= p_from and movement_type = 'adjustment'), 0)::integer as adjusted,
      coalesce(sum(qty_change), 0)::integer as closing
    from m group by partner_id, location_id, product_id
  ),
  val as (
    select s.partner_id, s.location_id, s.product_id, sum(s.units_sold * coalesce(s.unit_price_php, 0)) as sales_value
    from sensare_partner_sales s
    where (p_partner_id is null or s.partner_id = p_partner_id)
      and (p_location_id is null or s.location_id = p_location_id)
      and s.sale_date between p_from and p_to
    group by s.partner_id, s.location_id, s.product_id
  )
  select f.partner_id, f.location_id, f.product_id, f.opening, f.received, f.sold, f.adjusted, f.closing, coalesce(v.sales_value, 0)
  from flow f left join val v
    on v.partner_id = f.partner_id and v.location_id = f.location_id and v.product_id = f.product_id;
$$;

create or replace function sensare_partner_report_daily(p_partner_id uuid, p_location_id uuid, p_from date, p_to date)
returns table (sale_date date, units integer, sales_value numeric)
language sql stable as $$
  select s.sale_date, sum(s.units_sold)::integer, sum(s.units_sold * coalesce(s.unit_price_php, 0))
  from sensare_partner_sales s
  where (p_partner_id is null or s.partner_id = p_partner_id)
    and (p_location_id is null or s.location_id = p_location_id)
    and s.sale_date between p_from and p_to
  group by s.sale_date order by s.sale_date;
$$;

create or replace function sensare_partner_sales_history(p_partner_id uuid, p_from date)
returns table (location_id uuid, product_id uuid, sale_date date, units integer)
language sql stable as $$
  select location_id, product_id, sale_date, sum(units_sold)::integer
  from sensare_partner_sales
  where (p_partner_id is null or partner_id = p_partner_id) and sale_date >= p_from
  group by location_id, product_id, sale_date;
$$;

create or replace function sensare_partner_consignment_preview(p_partner_id uuid, p_from date, p_to date)
returns table (
  order_item_id uuid, order_id uuid, order_number text, location_id uuid, product_id uuid,
  product_name text, units integer, unit_price_php numeric, amount_php numeric
) language plpgsql stable as $$
declare
  s record;
  i record;
  v_remaining integer;
  v_take integer;
begin
  for s in
    select ps.location_id, ps.product_id, sum(ps.units_sold)::integer as sold
    from sensare_partner_sales ps
    where ps.partner_id = p_partner_id and ps.sale_date between p_from and p_to
    group by ps.location_id, ps.product_id
  loop
    v_remaining := s.sold;
    for i in
      select it.id, it.order_id, o.order_number, it.product_name,
             (it.case_qty * it.case_size) as units,
             it.case_price_php / it.case_size as unit_price,
             coalesce((select sum(cl.units) from sensare_partner_consignment_lines cl
                       join sensare_partner_consignment_settlements st on st.id = cl.settlement_id
                       where cl.order_item_id = it.id
                         and (st.status = 'confirmed' or (st.status = 'pending' and st.method <> 'hitpay'))), 0) as settled
      from sensare_partner_order_items it
      join sensare_partner_orders o on o.id = it.order_id
      where o.partner_id = p_partner_id and o.location_id = s.location_id and it.product_id = s.product_id
        and o.payment_terms = 'consignment' and o.status = 'delivered'
        and (o.delivered_at at time zone 'Asia/Manila')::date <= p_to
      order by o.delivered_at, o.order_number, it.id
    loop
      exit when v_remaining <= 0;
      v_take := least(v_remaining, i.units - i.settled);
      if v_take > 0 then
        order_item_id := i.id; order_id := i.order_id; order_number := i.order_number;
        location_id := s.location_id; product_id := s.product_id; product_name := i.product_name;
        units := v_take; unit_price_php := i.unit_price; amount_php := round(v_take * i.unit_price, 2);
        return next;
        v_remaining := v_remaining - v_take;
      end if;
    end loop;
  end loop;
end;
$$;

create or replace function sensare_partner_create_settlement(
  p_partner_id uuid, p_from date, p_to date, p_method text, p_status text,
  p_reference text, p_notes text, p_paid_on date, p_user_id uuid
) returns uuid language plpgsql as $$
declare
  v_id uuid;
  r record;
  v_open numeric;
  v_amount numeric;
  v_total numeric := 0;
  v_units integer := 0;
begin
  if p_to < p_from then raise exception 'Period end must be on or after the start'; end if;
  if p_to > (now() at time zone 'Asia/Manila')::date then raise exception 'Period cannot end in the future'; end if;
  if p_status not in ('pending', 'confirmed') then raise exception 'Invalid status'; end if;

  perform pg_advisory_xact_lock(hashtext('settle' || p_partner_id::text));

  -- Online payments abandoned at the HitPay checkout expire after 2 hours.
  update sensare_partner_consignment_settlements
  set status = 'failed'
  where partner_id = p_partner_id and method = 'hitpay' and status = 'pending'
    and created_at < now() - interval '2 hours';

  if exists (
    select 1 from sensare_partner_consignment_settlements
    where partner_id = p_partner_id and status in ('pending', 'confirmed')
      and period_from <= p_to and period_to >= p_from
  ) then
    raise exception 'This period overlaps a consignment settlement that was already made';
  end if;

  insert into sensare_partner_consignment_settlements
    (partner_id, period_from, period_to, method, status, reference, notes, paid_on, created_by,
     confirmed_by, confirmed_at)
  values (p_partner_id, p_from, p_to, p_method, p_status, p_reference, p_notes, p_paid_on, p_user_id,
     case when p_status = 'confirmed' then p_user_id end, case when p_status = 'confirmed' then now() end)
  returning id into v_id;

  insert into sensare_partner_consignment_lines
    (settlement_id, order_item_id, order_id, location_id, product_id, units, unit_price_php, amount_php)
  select v_id, pv.order_item_id, pv.order_id, pv.location_id, pv.product_id, pv.units, pv.unit_price_php, pv.amount_php
  from sensare_partner_consignment_preview(p_partner_id, p_from, p_to) pv;

  for r in
    select l.order_id, sum(l.amount_php) as amount, sum(l.units)::integer as units
    from sensare_partner_consignment_lines l where l.settlement_id = v_id group by l.order_id
  loop
    select o.total_php - coalesce((select sum(p.amount_php) from sensare_partner_payments p
                                   where p.order_id = o.id
                                     and (p.status = 'confirmed' or (p.status = 'pending' and p.method <> 'hitpay'))), 0)
      into v_open
    from sensare_partner_orders o where o.id = r.order_id for update;
    v_amount := least(r.amount, greatest(v_open, 0));
    v_units := v_units + r.units;
    if v_amount > 0 then
      insert into sensare_partner_payments
        (order_id, partner_id, amount_php, method, status, reference, notes, paid_on, settlement_id,
         created_by, confirmed_by, confirmed_at)
      values (r.order_id, p_partner_id, v_amount, p_method, p_status, p_reference,
         'Consignment settlement ' || to_char(p_from, 'Mon DD') || '–' || to_char(p_to, 'Mon DD, YYYY'),
         p_paid_on, v_id, p_user_id,
         case when p_status = 'confirmed' then p_user_id end, case when p_status = 'confirmed' then now() end);
      v_total := v_total + v_amount;
    end if;
  end loop;

  if v_units = 0 then
    raise exception 'No consignment sales to settle in this period';
  end if;

  update sensare_partner_consignment_settlements set amount_php = v_total, units = v_units where id = v_id;
  return v_id;
end;
$$;
