-- Replace sensare_decrement_stock with a race-condition-safe version
-- Uses SELECT FOR UPDATE to lock the row before checking/decrementing stock
-- Returns boolean: true = success, false = insufficient stock

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
