-- VetCare - Modulo de Administracion del sistema.
--
-- Nota de alcance: la seccion 1.2 del SRS excluye explicitamente la "gestion de
-- empleados... y administracion de cuentas de usuario", y D-03 asume que esa
-- administracion ocurre fuera de la aplicacion. Esta migracion amplia el alcance
-- de forma deliberada, por instruccion explicita del cliente del proyecto (ver
-- CLAUDE.md), no por interpretacion propia de los requisitos originales.
--
-- Cubre: ciclo de vida de cuentas de usuario, alta de roles, catalogos de
-- especie/raza, parametros de negocio configurables, y una bitacora de
-- auditoria generica sobre esas mismas tablas administrativas. No incluye un
-- editor de permisos por rol (seguiria requiriendo pasar de politicas RLS
-- fijas en migraciones a un modelo de permisos dirigido por datos: un cambio
-- de arquitectura mucho mayor que una pantalla de administracion) ni pantallas
-- de respaldo/monitoreo (responsabilidad de la plataforma, no de la SPA).

-- La Edge Function admin-usuarios usa la service_role key para crear/activar/
-- desactivar cuentas (ver supabase/functions/admin-usuarios). En versiones
-- recientes del CLI, service_role ya NO recibe privilegios automaticos sobre
-- tablas nuevas ("Data API roles... without explicit GRANTs", config.toml de
-- este proyecto) -- antes de este GRANT, un insert/update contra `usuario` con
-- la service_role key fallaba con "permission denied for table usuario" pese
-- a que service_role bypassa RLS: el privilegio de PostgreSQL se comprueba
-- antes que cualquier politica (mismo principio que el GRANT a `authenticated`
-- de ..._row_level_security.sql).
grant select, insert, update on public.usuario to service_role;

-- ============================================================================
-- 1. fn_rol_actual(): una cuenta desactivada deja de tener rol efectivo. Con
-- esto, un solo cambio (usuario.activo = false) corta el acceso en las ~40
-- politicas RLS existentes sin tener que tocarlas una por una: todas dependen
-- de esta funcion.
-- ============================================================================
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
    and u.activo
$$;

-- ============================================================================
-- 2. Proteccion del ultimo Administrador activo. Eco de D-03 ("el sistema
-- depende de que exista al menos un usuario con rol Administrador"): sin esto,
-- un Administrador podria desactivarse a si mismo (o reasignarse otro rol)
-- siendo el unico activo y dejar el sistema sin nadie que pueda revertirlo.
-- ============================================================================
create or replace function public.fn_proteger_ultimo_administrador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_era_admin_activo   boolean;
  v_sigue_admin_activo boolean;
  v_otros_admins       integer;
begin
  v_era_admin_activo := old.activo and exists (
    select 1 from public.rol r where r.id_rol = old.id_rol and r.codigo = 'administrador'
  );
  v_sigue_admin_activo := new.activo and exists (
    select 1 from public.rol r where r.id_rol = new.id_rol and r.codigo = 'administrador'
  );

  if v_era_admin_activo and not v_sigue_admin_activo then
    select count(*) into v_otros_admins
    from public.usuario u
    join public.rol r on r.id_rol = u.id_rol
    where r.codigo = 'administrador' and u.activo and u.id_usuario <> old.id_usuario;

    if v_otros_admins = 0 then
      raise exception 'No es posible desactivar o reasignar al único Administrador activo del sistema.';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_proteger_ultimo_administrador
  before update on public.usuario
  for each row execute function public.fn_proteger_ultimo_administrador();

-- ============================================================================
-- 3. Bitacora de auditoria generica sobre tablas administrativas. RF-003 ya
-- audita operaciones clinicas/inventario/factura; esto cubre el resto: cambios
-- de cuenta, de rol, de catalogo y de parametros, que hoy no dejan rastro.
-- ============================================================================
create table public.bitacora_auditoria (
  id_bitacora         bigint generated always as identity primary key,
  tabla               varchar(40) not null,
  id_registro         varchar(40),
  accion              varchar(10) not null check (accion in ('insert', 'update')),
  valores_anteriores  jsonb,
  valores_nuevos      jsonb not null,
  id_usuario          uuid references public.usuario (id_usuario) on delete restrict,
  fecha_hora          timestamptz not null default now()
);

create index idx_bitacora_tabla_fecha on public.bitacora_auditoria (tabla, fecha_hora);

grant select on public.bitacora_auditoria to authenticated;

alter table public.bitacora_auditoria enable row level security;

create policy bitacora_select on public.bitacora_auditoria
  for select to authenticated
  using (public.fn_rol_actual() = 'administrador');
-- Sin politica de insert/update/delete para 'authenticated': solo escribe
-- fn_auditar_cambio, que es SECURITY DEFINER y corre con los privilegios de su
-- dueno, no los del rol que disparo el cambio original.

create or replace function public.fn_auditar_cambio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  -- No se accede a new.<campo> directamente: en un trigger compartido entre
  -- tablas con columnas distintas, Postgres resuelve el acceso a un campo del
  -- RECORD contra el tipo real de la fila antes de elegir la rama del CASE,
  -- asi que "new.id_usuario" revienta con "record new has no field id_usuario"
  -- incluso dentro de una rama que nunca se ejecuta para, p. ej., parametro_sistema.
  -- El acceso por clave sobre to_jsonb(new) no tiene ese problema: una clave
  -- ausente simplemente da null.
  v_datos jsonb := to_jsonb(new);
  v_id    text;
begin
  v_id := case tg_table_name
    when 'usuario'           then v_datos ->> 'id_usuario'
    when 'rol'                then v_datos ->> 'id_rol'
    when 'parametro_sistema'  then v_datos ->> 'clave'
    when 'especie'            then v_datos ->> 'id_especie'
    when 'raza'                then v_datos ->> 'id_raza'
    else null
  end;

  insert into public.bitacora_auditoria (tabla, id_registro, accion, valores_anteriores, valores_nuevos, id_usuario)
  values (
    tg_table_name,
    v_id,
    lower(tg_op),
    case when tg_op = 'UPDATE' then to_jsonb(old) else null end,
    v_datos,
    auth.uid()
  );

  return new;
end;
$$;

create trigger trg_auditar_usuario   after insert or update on public.usuario   for each row execute function public.fn_auditar_cambio();
create trigger trg_auditar_rol       after insert or update on public.rol       for each row execute function public.fn_auditar_cambio();
create trigger trg_auditar_especie   after insert or update on public.especie   for each row execute function public.fn_auditar_cambio();
create trigger trg_auditar_raza      after insert or update on public.raza      for each row execute function public.fn_auditar_cambio();

-- ============================================================================
-- 4. Parametros de negocio configurables. Saca de hardcodeado dos valores que
-- CLAUDE.md ya marcaba como pendientes de decidir con el cliente: el impuesto
-- por defecto de una factura (RF-028) y el horario de atencion que usa RF-011
-- para sugerir huecos libres.
-- ============================================================================
create table public.parametro_sistema (
  clave                 varchar(60) primary key,
  valor                 varchar(200) not null,
  descripcion           varchar(200),
  fecha_actualizacion   timestamptz not null default now(),
  id_usuario_actualizo  uuid references public.usuario (id_usuario) on delete restrict
);

grant select, update on public.parametro_sistema to authenticated;

alter table public.parametro_sistema enable row level security;

create policy parametro_select on public.parametro_sistema
  for select to authenticated using (true);

create policy parametro_update on public.parametro_sistema
  for update to authenticated
  using (public.fn_rol_actual() = 'administrador')
  with check (public.fn_rol_actual() = 'administrador');
-- Sin insert/delete desde la aplicacion: el conjunto de claves es fijo, se
-- amplia por migracion (igual que cualquier otra columna del esquema).

create trigger trg_auditar_parametro after insert or update on public.parametro_sistema for each row execute function public.fn_auditar_cambio();

insert into public.parametro_sistema (clave, valor, descripcion) values
  ('impuesto_defecto_pct', '15', 'Porcentaje de impuesto sugerido al emitir una factura (RF-028).'),
  ('horario_atencion_inicio', '08:00', 'Hora de inicio de la jornada, usada para sugerir horarios libres de citas (RF-011).'),
  ('horario_atencion_fin', '18:00', 'Hora de fin de la jornada de atencion (RF-011).');

-- ============================================================================
-- 5. RLS adicional: administrador gestiona cuentas, roles y catalogos.
-- ============================================================================
create policy usuario_update on public.usuario
  for update to authenticated
  using (public.fn_rol_actual() = 'administrador')
  with check (public.fn_rol_actual() = 'administrador');

create policy rol_insert on public.rol
  for insert to authenticated
  with check (public.fn_rol_actual() = 'administrador');
-- Sin update sobre rol.codigo: renombrar un codigo existente rompe en silencio
-- toda politica RLS que lo compara como texto literal (ver fn_rol_actual()).

create policy especie_insert on public.especie
  for insert to authenticated
  with check (public.fn_rol_actual() = 'administrador');

create policy especie_update on public.especie
  for update to authenticated
  using (public.fn_rol_actual() = 'administrador')
  with check (public.fn_rol_actual() = 'administrador');

create policy raza_insert on public.raza
  for insert to authenticated
  with check (public.fn_rol_actual() = 'administrador');

create policy raza_update on public.raza
  for update to authenticated
  using (public.fn_rol_actual() = 'administrador')
  with check (public.fn_rol_actual() = 'administrador');
