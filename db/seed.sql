-- Starter catalogue for a brand-new database (skipped when data was imported from Supabase).

-- Seed products
insert into sensare_products (slug, name, tagline, description, price_php, compare_at_price_php, stock_qty, sort_order) values
(
  'two-hearts',
  'Two Hearts',
  'One Box. Shared by Two.',
  'Two heart-shaped pieces of 60% Davao dark chocolate, infused with damiana, maca, and ashwagandha — botanicals cherished for centuries for vitality and balance. One piece each, shared 30 minutes before your evening together.',
  295, null, 0, 1
),
(
  'ritual-bundle',
  'The Ritual Bundle',
  'Two Nights. Two Rituals.',
  'Two boxes of Two Hearts — enough for two intentional evenings together. Gift it to your partner, or make the ritual a habit. Free shipping nationwide.',
  590, null, 20, 2
)
on conflict (slug) do nothing;
update sensare_products set free_shipping = true where slug = 'ritual-bundle';

-- Seed testimonials
insert into sensare_testimonials (customer_name, location, quote, rating, is_featured, sort_order) values
('Camille R.', 'Makati', 'We lit candles, turned off our phones, and just... reconnected. I didn''t expect chocolate to do that.', 5, true, 1),
('Marco & Issa', 'BGC', 'Gave this to my wife for our anniversary. She cried. Good tears. Highly recommend.', 5, true, 2),
('Patricia L.', 'Cebu', 'The ritual guide made it feel intentional, not cheesy. We''ve done it three times now.', 5, true, 3),
('James T.', 'Davao', 'Rich, dark, and actually works. We noticed the difference. No complaints.', 5, false, 4),
('Rina V.', 'QC', 'Perfect gift. Arrived beautifully packaged. My partner loved it.', 5, false, 5)
on conflict do nothing;
