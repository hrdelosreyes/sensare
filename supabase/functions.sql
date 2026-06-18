-- Decrement stock safely for Sensarè products
-- Returns false if stock is insufficient (race-condition safe via row lock)
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

-- Auto-replenish: add 50 units whenever stock drops below 10
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
