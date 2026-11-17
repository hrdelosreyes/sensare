-- Starter catalogue for a brand-new database (skipped when data was imported from Supabase).

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
