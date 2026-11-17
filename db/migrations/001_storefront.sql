-- Sensarè storefront: products, orders, restock alerts, newsletter, testimonials.
-- Applied automatically by scripts/migrate.mjs on deploy.

create table if not exists sensare_products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  tagline text,
  description text,
  price_php numeric(10,2) not null,
  compare_at_price_php numeric(10,2),
  stock_qty integer not null default 0,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create table if not exists sensare_product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references sensare_products(id) on delete cascade,
  url text not null,
  alt text,
  sort_order integer default 0
);

create table if not exists sensare_orders (
  id uuid primary key default gen_random_uuid(),
  reference_number text unique not null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  shipping_address jsonb not null,
  items jsonb not null,
  subtotal_php numeric(10,2) not null,
  shipping_php numeric(10,2) not null default 0,
  total_php numeric(10,2) not null,
  payment_status text not null default 'pending',
  fulfillment_status text not null default 'unfulfilled',
  hitpay_payment_id text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists sensare_restock_notifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  product_id uuid references sensare_products(id) on delete cascade,
  notified_at timestamptz,
  created_at timestamptz default now(),
  unique(email, product_id)
);

create table if not exists sensare_newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  subscribed_at timestamptz default now(),
  unsubscribed_at timestamptz
);

create table if not exists sensare_testimonials (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null,
  location text,
  quote text not null,
  rating integer default 5 check (rating between 1 and 5),
  is_featured boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now()
);


-- Decrement stock safely (row lock). Returns false if stock is insufficient.
create or replace function sensare_decrement_stock(p_product_id uuid, p_qty integer)
returns boolean language plpgsql as $$
declare
  v_stock integer;
begin
  select stock_qty into v_stock
  from sensare_products
  where id = p_product_id
  for update;

  if v_stock < p_qty then
    return false;
  end if;

  update sensare_products
  set stock_qty = greatest(0, stock_qty - p_qty)
  where id = p_product_id;

  return true;
end;
$$;

-- Auto-replenish: add 50 units whenever stock drops below 10.
create or replace function sensare_auto_replenish()
returns trigger language plpgsql as $$
begin
  if new.stock_qty < 10 then
    new.stock_qty := new.stock_qty + 50;
  end if;
  return new;
end;
$$;

drop trigger if exists sensare_stock_replenish_trigger on sensare_products;
create trigger sensare_stock_replenish_trigger
  before update of stock_qty on sensare_products
  for each row
  execute function sensare_auto_replenish();
