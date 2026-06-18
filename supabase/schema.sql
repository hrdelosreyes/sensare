-- Sensarè Chocolates — tables prefixed with sensare_ to share BukidBox Supabase project

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

-- Seed products
insert into sensare_products (slug, name, tagline, description, price_php, compare_at_price_php, stock_qty, sort_order) values
(
  'intimate-indulgence',
  'Intimate Indulgence',
  'Two Hearts. One Ritual.',
  'Two heart-shaped pieces of 60% Davao dark chocolate, infused with damiana, maca, and ashwagandha — botanicals cherished for centuries to awaken desire and deepen connection. Best shared 30 minutes before your moment.',
  295, null, 0, 1
),
(
  'ritual-bundle',
  'The Ritual Bundle',
  'Three Nights. Three Rituals.',
  'Three boxes of Intimate Indulgence — enough for three intentional evenings together. Gift it to a partner, or build a habit of closeness. Includes a printed Ritual Card.',
  795, 885, 20, 2
),
(
  'lovers-gift-set',
  'Lover''s Gift Set',
  'The Complete Sensarè Experience.',
  'Six heart-shaped chocolates in a premium gift box, paired with a hand-poured ritual candle and an embossed Ritual Guide booklet. For anniversaries, Valentine''s, or any moment worth celebrating.',
  1495, 1800, 15, 3
)
on conflict (slug) do nothing;

-- Seed testimonials
insert into sensare_testimonials (customer_name, location, quote, rating, is_featured, sort_order) values
('Camille R.', 'Makati', 'We lit candles, turned off our phones, and just... reconnected. I didn''t expect chocolate to do that.', 5, true, 1),
('Marco & Issa', 'BGC', 'Gave this to my wife for our anniversary. She cried. Good tears. Highly recommend.', 5, true, 2),
('Patricia L.', 'Cebu', 'The ritual guide made it feel intentional, not cheesy. We''ve done it three times now.', 5, true, 3),
('James T.', 'Davao', 'Rich, dark, and actually works. We noticed the difference. No complaints.', 5, false, 4),
('Rina V.', 'QC', 'Perfect gift. Arrived beautifully packaged. My partner loved it.', 5, false, 5)
on conflict do nothing;
