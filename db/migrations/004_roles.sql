-- Roles & permissions
--   Staff roles: owner, manager, fulfillment, finance, viewer, account_manager
--   Account managers: assigned partners, referral sign-up codes, commission on
--   confirmed collections (snapshotted per payment)
--   Partner members: branch staff logins limited to assigned branches

-- Staff ----------------------------------------------------------------------------
alter table sensare_admins add column if not exists role text not null default 'owner';
alter table sensare_admins add constraint sensare_admins_role_chk
  check (role in ('owner', 'manager', 'fulfillment', 'finance', 'viewer', 'account_manager'));
alter table sensare_admins add column if not exists commission_pct numeric(5,2)
  check (commission_pct is null or (commission_pct >= 0 and commission_pct <= 100));
alter table sensare_admins add column if not exists referral_code text unique;
alter table sensare_admins add column if not exists is_active boolean not null default true;
alter table sensare_admins add column if not exists phone text;

-- Account manager per partner -----------------------------------------------------------
alter table sensare_partners add column if not exists account_manager_id uuid references sensare_users(id) on delete set null;
create index if not exists sensare_partners_am_idx on sensare_partners(account_manager_id);

-- Commission snapshot on each confirmed payment -----------------------------------------------
alter table sensare_partner_payments add column if not exists account_manager_id uuid references sensare_users(id) on delete set null;
alter table sensare_partner_payments add column if not exists commission_pct numeric(5,2);
alter table sensare_partner_payments add column if not exists commission_php numeric(12,2);
create index if not exists sensare_partner_payments_am_idx on sensare_partner_payments(account_manager_id, confirmed_at);

-- When a payment becomes confirmed, record the partner's account manager and their
-- current rate. Return credits (unsold stock sent back) earn no commission.
create or replace function sensare_partner_payment_commission()
returns trigger language plpgsql as $$
declare
  v_am uuid;
  v_pct numeric(5,2);
begin
  if new.status = 'confirmed' and (tg_op = 'INSERT' or old.status is distinct from 'confirmed') then
    if new.method = 'return_credit' then
      new.account_manager_id := null; new.commission_pct := null; new.commission_php := null;
    else
      select p.account_manager_id, a.commission_pct into v_am, v_pct
      from sensare_partners p
      left join sensare_admins a on a.user_id = p.account_manager_id and a.role = 'account_manager'
      where p.id = new.partner_id;
      new.account_manager_id := v_am;
      new.commission_pct := case when v_am is null then null else coalesce(v_pct, 0) end;
      new.commission_php := case when v_am is null then null else round(new.amount_php * coalesce(v_pct, 0) / 100, 2) end;
    end if;
  elsif new.status <> 'confirmed' then
    new.account_manager_id := null; new.commission_pct := null; new.commission_php := null;
  end if;
  return new;
end;
$$;
drop trigger if exists sensare_partner_payment_commission on sensare_partner_payments;
create trigger sensare_partner_payment_commission
  before insert or update of status on sensare_partner_payments
  for each row execute function sensare_partner_payment_commission();

-- Partner members (branch staff) -------------------------------------------------------------
create table if not exists sensare_partner_members (
  user_id uuid primary key references sensare_users(id) on delete cascade,
  partner_id uuid not null references sensare_partners(id) on delete cascade,
  role text not null default 'branch_staff' check (role in ('branch_staff')),
  name text,
  is_active boolean not null default true,
  created_by uuid references sensare_users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists sensare_partner_members_partner_idx on sensare_partner_members(partner_id);

create table if not exists sensare_partner_member_locations (
  user_id uuid not null references sensare_partner_members(user_id) on delete cascade,
  location_id uuid not null references sensare_partner_locations(id) on delete cascade,
  primary key (user_id, location_id)
);

-- Reports over a set of partners (an account manager's accounts); null = all -----------------
drop function if exists sensare_partner_report(uuid, uuid, date, date);
drop function if exists sensare_partner_report_daily(uuid, uuid, date, date);

create or replace function sensare_partner_report(p_partner_ids uuid[], p_location_id uuid, p_from date, p_to date)
returns table (
  partner_id uuid, location_id uuid, product_id uuid,
  opening integer, received integer, sold integer, adjusted integer, closing integer,
  sales_value numeric
) language sql stable as $$
  with m as (
    select m.partner_id, m.location_id, m.product_id, m.qty_change, m.movement_type, m.movement_date
    from sensare_partner_inventory_movements m
    where (p_partner_ids is null or m.partner_id = any(p_partner_ids))
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
    where (p_partner_ids is null or s.partner_id = any(p_partner_ids))
      and (p_location_id is null or s.location_id = p_location_id)
      and s.sale_date between p_from and p_to
    group by s.partner_id, s.location_id, s.product_id
  )
  select f.partner_id, f.location_id, f.product_id, f.opening, f.received, f.sold, f.adjusted, f.closing, coalesce(v.sales_value, 0)
  from flow f left join val v
    on v.partner_id = f.partner_id and v.location_id = f.location_id and v.product_id = f.product_id;
$$;

create or replace function sensare_partner_report_daily(p_partner_ids uuid[], p_location_id uuid, p_from date, p_to date)
returns table (sale_date date, units integer, sales_value numeric)
language sql stable as $$
  select s.sale_date, sum(s.units_sold)::integer, sum(s.units_sold * coalesce(s.unit_price_php, 0))
  from sensare_partner_sales s
  where (p_partner_ids is null or s.partner_id = any(p_partner_ids))
    and (p_location_id is null or s.location_id = p_location_id)
    and s.sale_date between p_from and p_to
  group by s.sale_date order by s.sale_date;
$$;
