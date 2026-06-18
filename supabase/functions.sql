-- Decrement stock safely for Sensarè products
create or replace function sensare_decrement_stock(p_product_id uuid, p_qty integer)
returns void language plpgsql as $$
begin
  update sensare_products
  set stock_qty = greatest(0, stock_qty - p_qty)
  where id = p_product_id;
end;
$$;
