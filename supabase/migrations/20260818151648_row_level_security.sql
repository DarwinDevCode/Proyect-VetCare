-- VetCare - Control de acceso por rol (RF-001, RF-002, RNF-002, RNF-006)
-- Fuente: Especificacion de Requisitos de Software, seccion 3.8 (Matriz de acceso por rol).
-- RNF-002 exige que el permiso se verifique en el servidor con independencia de la
-- interfaz: por eso el control de acceso se implementa aqui, en RLS, y no solo en React.
--
-- No existen politicas DELETE en ninguna tabla: RF-033 prohibe la eliminacion definitiva
-- de cualquier registro. Las bajas y cancelaciones son cambios de estado (UPDATE).

-- Privilegios base: RLS restringe FILAS, pero primero hace falta el privilegio
-- de PostgreSQL sobre el objeto. Sin este GRANT, PostgREST devuelve "permission
-- denied" incluso para lo que una politica permitiria. Sin GRANT DELETE en
-- ningun lado: RF-033 no admite eliminacion definitiva desde la aplicacion.
grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create or replace function public.fn_rol_actual()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.codigo
  from public.usuario u
  join public.rol r on r.id_rol = u.id_rol
  where u.id_usuario = auth.uid()
$$;

-- ----------------------------------------------------------------------------
-- Catalogos: lectura para cualquier usuario autenticado, escritura solo por
-- migraciones/seed (RNF-024: ampliar catalogos no debe requerir cambios de
-- estructura, pero esta version no expone una pantalla de mantenimiento de
-- catalogos porque ningun RF la solicita).
-- ----------------------------------------------------------------------------
alter table public.rol enable row level security;
create policy rol_select_autenticado on public.rol
  for select to authenticated using (true);

alter table public.usuario enable row level security;
create policy usuario_select_autenticado on public.usuario
  for select to authenticated using (true);

alter table public.especie enable row level security;
create policy especie_select_autenticado on public.especie
  for select to authenticated using (true);

alter table public.raza enable row level security;
create policy raza_select_autenticado on public.raza
  for select to authenticated using (true);

-- ----------------------------------------------------------------------------
-- Modulo 1: Pacientes y Propietarios -- Recepcionista escribe, Veterinario lee
-- ----------------------------------------------------------------------------
alter table public.propietario enable row level security;

create policy propietario_select on public.propietario
  for select to authenticated
  using (public.fn_rol_actual() in ('recepcionista', 'veterinario'));

create policy propietario_insert on public.propietario
  for insert to authenticated
  with check (public.fn_rol_actual() = 'recepcionista');

create policy propietario_update on public.propietario
  for update to authenticated
  using (public.fn_rol_actual() = 'recepcionista')
  with check (public.fn_rol_actual() = 'recepcionista');

alter table public.paciente enable row level security;

create policy paciente_select on public.paciente
  for select to authenticated
  using (public.fn_rol_actual() in ('recepcionista', 'veterinario'));

create policy paciente_insert on public.paciente
  for insert to authenticated
  with check (public.fn_rol_actual() = 'recepcionista');

create policy paciente_update on public.paciente
  for update to authenticated
  using (public.fn_rol_actual() = 'recepcionista')
  with check (public.fn_rol_actual() = 'recepcionista');

-- ----------------------------------------------------------------------------
-- Modulo 2: Agenda y Citas -- Recepcionista gestiona, Veterinario consulta
-- ----------------------------------------------------------------------------
alter table public.cita enable row level security;

create policy cita_select on public.cita
  for select to authenticated
  using (public.fn_rol_actual() in ('recepcionista', 'veterinario'));

create policy cita_insert on public.cita
  for insert to authenticated
  with check (public.fn_rol_actual() = 'recepcionista');

create policy cita_update on public.cita
  for update to authenticated
  using (public.fn_rol_actual() = 'recepcionista')
  with check (public.fn_rol_actual() = 'recepcionista');

-- ----------------------------------------------------------------------------
-- Modulo 3: Historial Clinico -- RN-006: unicamente el rol Veterinario
-- ----------------------------------------------------------------------------
alter table public.consulta enable row level security;

create policy consulta_select on public.consulta
  for select to authenticated
  using (public.fn_rol_actual() = 'veterinario');

create policy consulta_insert on public.consulta
  for insert to authenticated
  with check (public.fn_rol_actual() = 'veterinario');
-- Sin UPDATE/DELETE: RN-007, los registros clinicos no se modifican ni se eliminan.

alter table public.vacunacion enable row level security;

create policy vacunacion_select on public.vacunacion
  for select to authenticated
  using (public.fn_rol_actual() = 'veterinario');

create policy vacunacion_insert on public.vacunacion
  for insert to authenticated
  with check (public.fn_rol_actual() = 'veterinario');

alter table public.examen_laboratorio enable row level security;

create policy examen_select on public.examen_laboratorio
  for select to authenticated
  using (public.fn_rol_actual() = 'veterinario');

create policy examen_insert on public.examen_laboratorio
  for insert to authenticated
  with check (public.fn_rol_actual() = 'veterinario');

-- Unica excepcion documentada a RN-007: RF-019 permite completar el resultado
-- de un examen despues de solicitado, sin crear un registro nuevo.
create policy examen_update on public.examen_laboratorio
  for update to authenticated
  using (public.fn_rol_actual() = 'veterinario')
  with check (public.fn_rol_actual() = 'veterinario');

-- ----------------------------------------------------------------------------
-- Modulo 4: Inventario -- Administrador gestiona catalogo/ingresos, Veterinario
-- consume, ambos + Recepcionista consultan precios para facturar.
-- ----------------------------------------------------------------------------
alter table public.producto enable row level security;

create policy producto_select on public.producto
  for select to authenticated
  using (public.fn_rol_actual() in ('veterinario', 'administrador', 'recepcionista'));

create policy producto_insert on public.producto
  for insert to authenticated
  with check (public.fn_rol_actual() = 'administrador');

create policy producto_update on public.producto
  for update to authenticated
  using (public.fn_rol_actual() = 'administrador')
  with check (public.fn_rol_actual() = 'administrador');

alter table public.movimiento_inventario enable row level security;

create policy movimiento_select on public.movimiento_inventario
  for select to authenticated
  using (public.fn_rol_actual() in ('veterinario', 'administrador'));

-- RF-022 (ingreso/ajuste) es exclusivo de Administrador; RF-023/RF-024 (consumo,
-- incluido el que dispara automaticamente la vacunacion) es exclusivo de Veterinario.
create policy movimiento_insert on public.movimiento_inventario
  for insert to authenticated
  with check (
    (public.fn_rol_actual() = 'administrador' and tipo_movimiento in ('ingreso', 'ajuste'))
    or (public.fn_rol_actual() = 'veterinario' and tipo_movimiento = 'consumo')
  );
-- Sin UPDATE/DELETE: es una bitacora inmutable (RF-027, RNF-010).

-- ----------------------------------------------------------------------------
-- Modulo 5: Facturacion y Reportes -- Recepcionista emite y cobra, Administrador
-- consulta y reporta.
-- ----------------------------------------------------------------------------
alter table public.factura enable row level security;

create policy factura_select on public.factura
  for select to authenticated
  using (public.fn_rol_actual() in ('recepcionista', 'administrador'));

create policy factura_insert on public.factura
  for insert to authenticated
  with check (public.fn_rol_actual() = 'recepcionista');
-- Sin UPDATE directo desde la aplicacion: el subtotal/total se mantienen por
-- trigger (trg_totales_factura, SECURITY DEFINER) al insertar detalle_factura.

alter table public.detalle_factura enable row level security;

create policy detalle_factura_select on public.detalle_factura
  for select to authenticated
  using (
    exists (
      select 1 from public.factura f
      where f.id_factura = detalle_factura.id_factura
        and public.fn_rol_actual() in ('recepcionista', 'administrador')
    )
  );

create policy detalle_factura_insert on public.detalle_factura
  for insert to authenticated
  with check (public.fn_rol_actual() = 'recepcionista');

alter table public.pago enable row level security;

create policy pago_select on public.pago
  for select to authenticated
  using (public.fn_rol_actual() in ('recepcionista', 'administrador'));

create policy pago_insert on public.pago
  for insert to authenticated
  with check (public.fn_rol_actual() = 'recepcionista');
