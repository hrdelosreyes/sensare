-- RLS policies for Sensarè tables
-- Allow public read on products and testimonials
alter table sensare_products enable row level security;
alter table sensare_testimonials enable row level security;
alter table sensare_orders enable row level security;
alter table sensare_restock_notifications enable row level security;
alter table sensare_newsletter_subscribers enable row level security;

-- Public can read active products
create policy "Public read products"
  on sensare_products for select
  using (is_active = true);

-- Public can read testimonials
create policy "Public read testimonials"
  on sensare_testimonials for select
  using (true);

-- Service role bypasses RLS for all other operations (orders, restock, newsletter)
-- No additional policies needed — supabaseAdmin() uses service role key
