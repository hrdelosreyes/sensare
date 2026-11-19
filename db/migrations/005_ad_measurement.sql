-- Meta Conversions API: browser details (cookie IDs, IP, user agent) kept with a shop order
-- ONLY when the shopper accepted advertising cookies, so the payment webhook can report the
-- purchase to Meta. Cleared once the webhook has handled the payment.
alter table sensare_orders add column if not exists ad_context jsonb;
