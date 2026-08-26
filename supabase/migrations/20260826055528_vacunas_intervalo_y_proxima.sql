-- Fase 2 del rediseno Organic: amplia RF-018 con la fecha "proxima" de cada vacuna
-- (RF-041, CLAUDE.md seccion 14). intervalo_dias es nullable a proposito: no todas
-- las vacunas del catalogo tienen un esquema de refuerzo conocido, y una vacuna sin
-- intervalo simplemente no aparece en v_vacunas_proximas.
alter table public.producto
  add column intervalo_dias integer check (intervalo_dias > 0);

-- Por paciente + vacuna: ultima aplicacion + intervalo = proxima fecha. Solo vacunas
-- con intervalo_dias definido -- mismo criterio "se deriva siempre, nunca se
-- almacena" que v_alerta_stock (business_rules.sql).
create view public.v_vacunas_proximas as
  select
    v.id_paciente,
    v.id_producto,
    p.nombre                                                as producto,
    max(v.fecha_aplicacion)                                 as ultima_aplicacion,
    p.intervalo_dias,
    (max(v.fecha_aplicacion) + p.intervalo_dias * interval '1 day')::date as proxima_fecha
  from public.vacunacion v
  join public.producto p on p.id_producto = v.id_producto
  where p.intervalo_dias is not null
  group by v.id_paciente, v.id_producto, p.nombre, p.intervalo_dias;

-- security_invoker: sin esto, PostgreSQL ejecutaria la vista con los privilegios del
-- propietario y se saltaria el RLS de vacunacion/producto (mismo patron que las tres
-- vistas de business_rules.sql).
alter view public.v_vacunas_proximas set (security_invoker = on);

-- La vista es un objeto nuevo, creado despues del "grant ... on all tables in schema
-- public" de row_level_security.sql -- ese grant no alcanza objetos futuros, hace
-- falta uno explicito (mismo problema ya documentado en CLAUDE.md seccion 9 para
-- bitacora_auditoria/parametro_sistema).
grant select on public.v_vacunas_proximas to authenticated;
