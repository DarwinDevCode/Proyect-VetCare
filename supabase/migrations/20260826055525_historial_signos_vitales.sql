-- Fase 2 del rediseno Organic (ver REDISENO-ORGANIC-PLAN.md): amplia RF-016 con
-- signos vitales (RF-040, CLAUDE.md seccion 14). Columnas nullable sobre consulta,
-- sin trigger nuevo: no participan de ninguna regla de negocio critica, son solo
-- datos clinicos que el veterinario puede registrar.
alter table public.consulta
  add column temperatura_c numeric(4, 1) check (temperatura_c > 0),
  add column frecuencia_cardiaca_lpm smallint check (frecuencia_cardiaca_lpm > 0),
  add column frecuencia_respiratoria_rpm smallint check (frecuencia_respiratoria_rpm > 0);

-- v_historial_clinico (business_rules.sql) necesita exponer los signos vitales para
-- que el timeline (RF-020) los muestre en la entrada de consulta -- si no, quedarian
-- capturados pero invisibles fuera de una consulta directa a la tabla. CREATE OR
-- REPLACE conserva las columnas existentes en el mismo orden (obligatorio en
-- Postgres) y agrega las tres nuevas al final, null para vacunacion/examen.
create or replace view public.v_historial_clinico as
  select
    c.id_paciente,
    'consulta'::text as tipo_evento,
    c.fecha_hora      as fecha,
    c.id_consulta     as id_evento,
    c.motivo          as resumen,
    c.diagnostico,
    c.tratamiento,
    null::text        as producto_o_examen,
    c.id_veterinario,
    c.temperatura_c,
    c.frecuencia_cardiaca_lpm,
    c.frecuencia_respiratoria_rpm
  from public.consulta c
  union all
  select
    v.id_paciente,
    'vacunacion'::text,
    v.fecha_aplicacion::timestamptz,
    v.id_vacunacion,
    'Vacunacion aplicada'::text,
    null,
    null,
    p.nombre,
    v.id_veterinario,
    null::numeric(4, 1),
    null::smallint,
    null::smallint
  from public.vacunacion v
  join public.producto p on p.id_producto = v.id_producto
  union all
  select
    e.id_paciente,
    'examen'::text,
    e.fecha_solicitud::timestamptz,
    e.id_examen,
    e.tipo_examen,
    null,
    e.resultado,
    e.observacion,
    e.id_veterinario,
    null::numeric(4, 1),
    null::smallint,
    null::smallint
  from public.examen_laboratorio e;

alter view public.v_historial_clinico set (security_invoker = on);
