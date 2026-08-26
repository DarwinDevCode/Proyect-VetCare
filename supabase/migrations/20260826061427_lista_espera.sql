-- Fase 3 del rediseno Organic (ver REDISENO-ORGANIC-PLAN.md): RF-034/RF-035, amplia
-- RF-011 con una lista de espera real, sin notificacion por WhatsApp/Email/SMS -- eso
-- sigue fuera de alcance (SRS, seccion "Fuera del alcance"). Mismo patron de acceso
-- que el Modulo 2: Recepcionista gestiona, Veterinario solo consulta.
create table public.lista_espera (
  id_lista_espera    bigint generated always as identity primary key,
  id_paciente        bigint not null references public.paciente (id_paciente) on delete restrict,
  -- Nullable a proposito: el dueno puede pedir "cualquier veterinario disponible"
  -- (RN-021 no aplica aqui -- esa es la solicitud de portal de la Fase 5).
  id_veterinario     uuid references public.usuario (id_usuario) on delete restrict,
  fecha_preferida    date,
  franja_preferida   varchar(10) check (franja_preferida in ('manana', 'tarde')),
  motivo             text not null,
  estado             varchar(10) not null default 'pendiente'
                       check (estado in ('pendiente', 'atendida', 'cancelada')),
  id_usuario_registro uuid not null references public.usuario (id_usuario) on delete restrict default auth.uid(),
  fecha_registro     timestamptz not null default now()
);

create index idx_lista_espera_veterinario_estado on public.lista_espera (id_veterinario, estado);

-- ----------------------------------------------------------------------------
-- RLS -- mismo patron exacto que cita (row_level_security.sql, Modulo 2). Sin
-- politica DELETE: RF-033 prohibe la eliminacion definitiva; "quitar" una entrada
-- es un UPDATE a estado='cancelada' o 'atendida'.
-- ----------------------------------------------------------------------------
alter table public.lista_espera enable row level security;

create policy lista_espera_select on public.lista_espera
  for select to authenticated
  using (public.fn_rol_actual() in ('recepcionista', 'veterinario'));

create policy lista_espera_insert on public.lista_espera
  for insert to authenticated
  with check (public.fn_rol_actual() = 'recepcionista');

create policy lista_espera_update on public.lista_espera
  for update to authenticated
  using (public.fn_rol_actual() = 'recepcionista')
  with check (public.fn_rol_actual() = 'recepcionista');

-- Objeto nuevo, creado despues del "grant ... on all tables in schema public" de
-- row_level_security.sql -- ese grant no alcanza tablas futuras (mismo problema ya
-- documentado en CLAUDE.md seccion 9 para bitacora_auditoria/parametro_sistema). No
-- hace falta un GRANT aparte sobre la secuencia de la columna identity: Postgres no
-- exige USAGE sobre ella para un INSERT normal, solo el privilegio sobre la tabla.
grant select, insert, update on public.lista_espera to authenticated;
