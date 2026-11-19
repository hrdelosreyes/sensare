-- Catalogue update (Nov 2026)
--  * Products can ship free nationwide regardless of order total.
--  * "Intimate Indulgence" becomes "Two Hearts" (new URL /shop/two-hearts; the old one redirects).
--  * "The Ritual Bundle" is now two boxes for ₱590 with free shipping nationwide.
--  * "Lover's Gift Set" is retired: hidden from the shop and from partner ordering.
--    (Kept in the database so past orders and partner stock history still show it.)
alter table sensare_products add column if not exists free_shipping boolean not null default false;

update sensare_products set
  slug = 'two-hearts',
  name = 'Two Hearts',
  tagline = 'One Box. Shared by Two.',
  description = 'Two heart-shaped pieces of 60% Davao dark chocolate, infused with damiana, maca, and ashwagandha — botanicals cherished for centuries for vitality and balance. One piece each, shared 30 minutes before your evening together.'
where slug = 'intimate-indulgence';

update sensare_products set
  tagline = 'Two Nights. Two Rituals.',
  description = 'Two boxes of Two Hearts — enough for two intentional evenings together. Gift it to your partner, or make the ritual a habit. Free shipping nationwide.',
  price_php = 590,
  compare_at_price_php = null,
  free_shipping = true
where slug = 'ritual-bundle';

update sensare_products set is_active = false, is_wholesale = false
where slug = 'lovers-gift-set';
