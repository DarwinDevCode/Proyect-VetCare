-- Fase 2 del rediseno Organic: version "ligera" de lotes y vencimiento (ver
-- REDISENO-ORGANIC-PLAN.md, hallazgo de arquitectura y tabla de migraciones) --
-- metadata descriptiva sobre movimiento_inventario, poblada solo en ingresos.
-- Deliberadamente NO toca fn_actualizar_existencia (business_rules.sql): esa sigue
-- siendo la unica garantia real de RN-010, un lote es solo informacion adicional
-- sobre CUAL ingreso trajo el stock, no una unidad de control de existencias aparte.
alter table public.movimiento_inventario
  add column lote_codigo varchar(30),
  add column fecha_vencimiento date;

-- Ingresos con vencimiento en los proximos 30 dias. Igual que v_alerta_stock, se
-- deriva siempre de current_date -- nunca se almacena "por vencer" como un estado.
create view public.v_lotes_por_vencer as
  select
    m.id_movimiento,
    m.id_producto,
    p.nombre           as producto,
    m.lote_codigo,
    m.fecha_vencimiento,
    m.cantidad,
    m.fecha_hora
  from public.movimiento_inventario m
  join public.producto p on p.id_producto = m.id_producto
  where m.tipo_movimiento = 'ingreso'
    and m.fecha_vencimiento is not null
    and m.fecha_vencimiento <= current_date + 30;

alter view public.v_lotes_por_vencer set (security_invoker = on);

grant select on public.v_lotes_por_vencer to authenticated;
