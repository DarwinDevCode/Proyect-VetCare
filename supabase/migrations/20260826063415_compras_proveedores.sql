-- Fase 4 del rediseno Organic (ver REDISENO-ORGANIC-PLAN.md): RF-036 a RF-039, Modulo 7
-- nuevo -- "Compras y Proveedores". Amplia deliberadamente la exclusion de "Compras,
-- ordenes de compra y gestion de proveedores" (SRS, seccion "Fuera del alcance"), la
-- misma que CLAUDE.md seccion 2 ya documentaba como parte del .docx de arquitectura
-- superado ("D6 Proveedores"). Se reabre ahora por instruccion explicita del cliente,
-- no porque el SRS final haya dejado de excluirla.
--
-- ============================================================================
-- Tablas
-- ============================================================================

create table public.proveedor (
  id_proveedor    bigint generated always as identity primary key,
  nombre          varchar(150) not null,
  identificacion  varchar(20) not null unique,
  telefono        varchar(20) not null,
  correo          varchar(150),
  direccion       text,
  activo          boolean not null default true,
  fecha_registro  timestamptz not null default now()
);

-- RF-037/RF-038/RF-039: ciclo de vida de una orden -- se arma en 'borrador' (lineas
-- editables via fn_crear_orden_compra), se 'emite' al proveedor, y al marcarse
-- 'recibida' dispara el ingreso automatico de inventario (RN-022). 'cancelada' es el
-- unico camino de "eliminar" una orden que ya no se necesita (RF-033).
create table public.orden_compra (
  id_orden_compra      bigint generated always as identity primary key,
  id_proveedor         bigint not null references public.proveedor (id_proveedor) on delete restrict,
  estado               varchar(10) not null default 'borrador'
                          check (estado in ('borrador', 'emitida', 'recibida', 'cancelada')),
  observacion          text,
  id_usuario_registro  uuid not null references public.usuario (id_usuario) on delete restrict default auth.uid(),
  fecha_registro       timestamptz not null default now()
);

-- Mismo patron que detalle_factura: lineas inmutables una vez creadas (sin politica
-- UPDATE/DELETE), numeradas dentro de su orden.
create table public.detalle_orden_compra (
  id_detalle       bigint generated always as identity primary key,
  id_orden_compra  bigint not null references public.orden_compra (id_orden_compra) on delete restrict,
  numero_linea     smallint not null,
  id_producto      bigint not null references public.producto (id_producto) on delete restrict,
  cantidad         numeric(10, 2) not null check (cantidad > 0),
  precio_unitario  numeric(10, 2) not null check (precio_unitario >= 0),
  -- Columna generada, mismo criterio que detalle_factura.subtotal_linea (CLAUDE.md
  -- seccion 6): funcionalmente equivalente a un trigger y mas simple.
  subtotal_linea   numeric(10, 2) generated always as (cantidad * precio_unitario) stored,
  unique (id_orden_compra, numero_linea)
);

-- movimiento_inventario ya distingue su origen con id_consulta/id_vacunacion
-- (chk_movimiento_origen, RN-009); una tercera columna de origen no colisiona con esa
-- restriccion porque chk_movimiento_origen no la menciona -- un ingreso por compra
-- sigue cumpliendo "tipo_movimiento in ('ingreso','ajuste') and id_consulta is null
-- and id_vacunacion is null" sin cambios.
alter table public.movimiento_inventario
  add column id_orden_compra bigint references public.orden_compra (id_orden_compra) on delete restrict;

-- ============================================================================
-- RN-022: recibir una orden genera su ingreso de inventario automaticamente, una
-- sola vez, en la misma transaccion -- mismo patron exacto que
-- fn_vacunacion_descuenta_inventario (business_rules.sql): un trigger que inserta
-- movimiento_inventario a partir de un evento en otra tabla. No necesita SECURITY
-- DEFINER: solo Administrador puede actualizar orden_compra (RLS mas abajo), y
-- Administrador ya tiene permiso de insertar movimientos 'ingreso' directamente
-- (movimiento_insert, row_level_security.sql) -- a diferencia de la vacunacion, aqui
-- no hay ningun limite de rol que cruzar.
-- ============================================================================
create function public.fn_recibir_orden_compra()
returns trigger
language plpgsql
as $$
begin
  insert into public.movimiento_inventario (id_producto, tipo_movimiento, cantidad, id_orden_compra, observacion)
  select d.id_producto, 'ingreso', d.cantidad, new.id_orden_compra,
         'Recepcion de orden de compra #' || new.id_orden_compra
  from public.detalle_orden_compra d
  where d.id_orden_compra = new.id_orden_compra;

  return new;
end;
$$;

-- La condicion "old.estado <> 'recibida'" es la que garantiza "una sola vez": un
-- segundo UPDATE a 'recibida' (el mismo valor que ya tenia) no vuelve a disparar el
-- trigger, sin necesitar ningun chequeo adicional en el cliente.
create trigger trg_recibir_orden_compra
  after update on public.orden_compra
  for each row
  when (new.estado = 'recibida' and old.estado is distinct from 'recibida')
  execute function public.fn_recibir_orden_compra();

-- ============================================================================
-- RF-037: crear una orden de compra (cabecera + lineas) en una sola operacion.
-- Mismo motivo exacto que fn_emitir_factura (facturacion.sql): PostgREST no ofrece
-- transacciones que abarquen varias peticiones, y una orden son N inserciones que
-- deben completarse todas o ninguna. A diferencia de fn_emitir_factura, esta funcion
-- NO es SECURITY DEFINER: no cruza ningun limite de rol (RN-006 no aplica aqui), asi
-- que cada insert dentro de la funcion se sigue evaluando contra RLS con el rol de
-- quien llama -- si no es Administrador, el primer insert ya falla y revierte todo.
-- ============================================================================
create function public.fn_crear_orden_compra(
  p_id_proveedor bigint,
  p_observacion  text,
  p_lineas       jsonb
)
returns bigint
language plpgsql
as $$
declare
  v_id_orden bigint;
  v_linea    jsonb;
  v_numero   smallint := 0;
begin
  if p_lineas is null or jsonb_array_length(p_lineas) = 0 then
    raise exception 'La orden de compra debe tener al menos un producto.';
  end if;

  insert into public.orden_compra (id_proveedor, observacion)
  values (p_id_proveedor, p_observacion)
  returning id_orden_compra into v_id_orden;

  for v_linea in select * from jsonb_array_elements(p_lineas)
  loop
    v_numero := v_numero + 1;
    insert into public.detalle_orden_compra (id_orden_compra, numero_linea, id_producto, cantidad, precio_unitario)
    values (
      v_id_orden,
      v_numero,
      (v_linea ->> 'id_producto')::bigint,
      (v_linea ->> 'cantidad')::numeric,
      (v_linea ->> 'precio_unitario')::numeric
    );
  end loop;

  return v_id_orden;
end;
$$;

revoke execute on function public.fn_crear_orden_compra(bigint, text, jsonb) from public, anon;
grant execute on function public.fn_crear_orden_compra(bigint, text, jsonb) to authenticated;

-- ============================================================================
-- RLS -- exclusivo de Administrador (matriz de acceso ampliada por el cliente para
-- este modulo nuevo, igual que el resto de "Inventario y Medicamentos" que ya
-- gestiona). Sin politica DELETE en ninguna tabla (RF-033); detalle_orden_compra
-- tampoco tiene UPDATE, mismo criterio de inmutabilidad que detalle_factura.
-- ============================================================================
alter table public.proveedor enable row level security;

create policy proveedor_select on public.proveedor
  for select to authenticated
  using (public.fn_rol_actual() = 'administrador');

create policy proveedor_insert on public.proveedor
  for insert to authenticated
  with check (public.fn_rol_actual() = 'administrador');

create policy proveedor_update on public.proveedor
  for update to authenticated
  using (public.fn_rol_actual() = 'administrador')
  with check (public.fn_rol_actual() = 'administrador');

alter table public.orden_compra enable row level security;

create policy orden_compra_select on public.orden_compra
  for select to authenticated
  using (public.fn_rol_actual() = 'administrador');

create policy orden_compra_insert on public.orden_compra
  for insert to authenticated
  with check (public.fn_rol_actual() = 'administrador');

create policy orden_compra_update on public.orden_compra
  for update to authenticated
  using (public.fn_rol_actual() = 'administrador')
  with check (public.fn_rol_actual() = 'administrador');

alter table public.detalle_orden_compra enable row level security;

create policy detalle_orden_compra_select on public.detalle_orden_compra
  for select to authenticated
  using (public.fn_rol_actual() = 'administrador');

create policy detalle_orden_compra_insert on public.detalle_orden_compra
  for insert to authenticated
  with check (public.fn_rol_actual() = 'administrador');

-- Objetos nuevos, creados despues del "grant ... on all tables in schema public" de
-- row_level_security.sql -- ese grant no alcanza tablas futuras (mismo problema ya
-- documentado en CLAUDE.md seccion 9).
grant select, insert, update on public.proveedor to authenticated;
grant select, insert, update on public.orden_compra to authenticated;
grant select, insert on public.detalle_orden_compra to authenticated;
