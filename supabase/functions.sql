-- Decrement stock safely
create or replace function decrement_stock(p_product_id uuid, p_qty integer)
returns void language plpgsql as $$
begin
  update products
  set stock_qty = greatest(0, stock_qty - p_qty)
  where id = p_product_id;
end;
$$;
