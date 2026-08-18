-- VetCare - Reglas de negocio activas: triggers y vistas
-- Fuente: VetCare_Diseno_Base_de_Datos.md seccion 8.7
-- Estas reglas viven en la base de datos (no en el frontend) porque RNF-005/RNF-007/RNF-008
-- exigen que la integridad no dependa de que el cliente SPA "se porte bien".

-- ----------------------------------------------------------------------------
-- RN-004 / RF-011: materializa cita.fecha_hora_fin para que la restriccion
-- EXCLUDE de solapamiento (ver migracion de esquema) pueda usar un indice GiST
-- sobre columnas simples en lugar de una expresion timestamptz + interval, que
-- PostgreSQL no permite indexar por no ser IMMUTABLE.
-- ----------------------------------------------------------------------------
create function public.fn_calcular_fin_cita()
returns trigger
language plpgsql
as $$
begin
  new.fecha_hora_fin := new.fecha_hora_inicio + (new.duracion_minutos * interval '1 minute');
  return new;
end;
$$;

create trigger trg_calcular_fin_cita
  before insert or update on public.cita
  for each row
  execute function public.fn_calcular_fin_cita();

-- ----------------------------------------------------------------------------
-- Kardex: mantiene producto.existencia_actual sincronizada con cada movimiento
-- ----------------------------------------------------------------------------
create function public.fn_actualizar_existencia()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_existencia_actual numeric(10, 2);
  v_nueva_existencia   numeric(10, 2);
begin
  select existencia_actual into v_existencia_actual
  from public.producto
  where id_producto = new.id_producto
  for update;

  v_nueva_existencia := v_existencia_actual + new.cantidad;

  if v_nueva_existencia < 0 then
    raise exception 'No hay existencia suficiente del producto para este movimiento (disponible: %, solicitado: %).',
      v_existencia_actual, abs(new.cantidad)
      using errcode = 'check_violation';
  end if;

  new.existencia_resultante := v_nueva_existencia;

  update public.producto
  set existencia_actual = v_nueva_existencia
  where id_producto = new.id_producto;

  return new;
end;
$$;

create trigger trg_actualizar_existencia
  before insert on public.movimiento_inventario
  for each row
  execute function public.fn_actualizar_existencia();

-- ----------------------------------------------------------------------------
-- RN-019: solo productos de tipo 'vacuna' pueden registrarse en una vacunacion
-- ----------------------------------------------------------------------------
create function public.fn_validar_producto_vacuna()
returns trigger
language plpgsql
as $$
declare
  v_tipo varchar(12);
begin
  select tipo into v_tipo from public.producto where id_producto = new.id_producto;

  if v_tipo is distinct from 'vacuna' then
    raise exception 'El producto seleccionado no esta clasificado como vacuna.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger trg_vacunacion_valida_tipo
  before insert or update on public.vacunacion
  for each row
  execute function public.fn_validar_producto_vacuna();

-- ----------------------------------------------------------------------------
-- RF-024 / RN-008: la aplicacion de una vacuna descuenta automaticamente su dosis
-- del inventario, en la misma transaccion que el registro clinico (RNF-005).
-- ----------------------------------------------------------------------------
create function public.fn_vacunacion_descuenta_inventario()
returns trigger
language plpgsql
as $$
begin
  insert into public.movimiento_inventario (
    id_producto, tipo_movimiento, cantidad, fecha_hora,
    id_usuario, id_vacunacion, observacion
  ) values (
    new.id_producto, 'consumo', -new.dosis, now(),
    new.id_veterinario, new.id_vacunacion, 'Descuento automatico por vacunacion aplicada'
  );

  return new;
end;
$$;

create trigger trg_vacunacion_descuenta
  after insert on public.vacunacion
  for each row
  execute function public.fn_vacunacion_descuenta_inventario();

-- ----------------------------------------------------------------------------
-- RNF-007: el subtotal de la factura se mantiene sincronizado con sus lineas.
-- (el total es una columna generada: subtotal + impuesto, ver migracion de esquema)
-- ----------------------------------------------------------------------------
create function public.fn_actualizar_subtotal_factura()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_id_factura bigint;
begin
  v_id_factura := coalesce(new.id_factura, old.id_factura);

  update public.factura
  set subtotal = coalesce((
    select sum(subtotal_linea) from public.detalle_factura where id_factura = v_id_factura
  ), 0)
  where id_factura = v_id_factura;

  return null;
end;
$$;

create trigger trg_totales_factura
  after insert or update or delete on public.detalle_factura
  for each row
  execute function public.fn_actualizar_subtotal_factura();

-- ============================================================================
-- VISTAS
-- ============================================================================

-- RF-020 / RI-003 / CU-3.4: historial clinico unico y cronologico por paciente.
-- No existe una tabla "historial": es la lectura conjunta de tres hechos clinicos.
create view public.v_historial_clinico as
  select
    c.id_paciente,
    'consulta'::text as tipo_evento,
    c.fecha_hora      as fecha,
    c.id_consulta     as id_evento,
    c.motivo          as resumen,
    c.diagnostico,
    c.tratamiento,
    null::text        as producto_o_examen,
    c.id_veterinario
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
    v.id_veterinario
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
    e.id_veterinario
  from public.examen_laboratorio e;

alter view public.v_historial_clinico set (security_invoker = on);

-- RF-031 / RN-015: saldo pendiente de cada factura, derivado de sus pagos.
create view public.v_estado_factura as
  select
    f.id_factura,
    f.numero,
    f.id_propietario,
    f.total,
    coalesce(sum(p.monto), 0) as total_pagado,
    f.total - coalesce(sum(p.monto), 0) as saldo_pendiente,
    case
      when coalesce(sum(p.monto), 0) = 0 then 'pendiente'
      when coalesce(sum(p.monto), 0) >= f.total then 'pagada'
      else 'parcial'
    end as estado_cobro
  from public.factura f
  left join public.pago p on p.id_factura = f.id_factura
  group by f.id_factura, f.numero, f.id_propietario, f.total;

alter view public.v_estado_factura set (security_invoker = on);

-- RF-026 / RN-011: productos en o por debajo de su nivel minimo. No se almacena
-- la alerta: se deriva siempre del estado actual para no quedar desactualizada.
create view public.v_alerta_stock as
  select id_producto, codigo, nombre, tipo, existencia_actual, nivel_minimo
  from public.producto
  where activo and existencia_actual <= nivel_minimo;

alter view public.v_alerta_stock set (security_invoker = on);
