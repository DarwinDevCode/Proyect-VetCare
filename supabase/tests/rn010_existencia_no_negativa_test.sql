-- RN-010: las existencias de un producto nunca pueden ser negativas
-- (fn_actualizar_existencia, ver CLAUDE.md sección 6).
-- Corre con: npx supabase test db --local (desde supabase/)
begin;
select plan(2);

-- Producto sembrado "Ivermectina 1%" (id_producto 3), existencia_actual 20.
-- throws_ok de 4 argumentos (sql, codigo, NULL, descripcion), no 3 -- ver el
-- comentario de rn004_solapamiento_citas_test.sql sobre por qué.
select throws_ok(
  $$insert into public.movimiento_inventario (id_producto, tipo_movimiento, cantidad, id_usuario)
    values (3, 'ajuste', -1000, '00000000-0000-0000-0000-000000000003')$$,
  '23514'::char(5),
  NULL,
  'RN-010: un ajuste que dejaría la existencia negativa es rechazado'
);

select lives_ok(
  $$insert into public.movimiento_inventario (id_producto, tipo_movimiento, cantidad, id_usuario)
    values (3, 'ajuste', -1, '00000000-0000-0000-0000-000000000003')$$,
  'un ajuste que sí alcanza la existencia disponible se acepta'
);

select * from finish();
rollback;
