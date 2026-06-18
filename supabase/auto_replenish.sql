-- Sensarè auto-replenishment trigger
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- When any SKU's stock_qty drops below 10, it is automatically topped up by 50 units.

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
