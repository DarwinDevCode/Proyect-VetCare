-- VetCare - Esquema inicial
-- Fuente de verdad: ARTEFACTOS VETCARE/5_ MODELOS DE LA BD/VetCare_Diseno_Base_de_Datos.md (secciones 6, 7, 8)
-- 15 tablas, sin borrado fisico (RF-033), integridad activa mediante triggers y vistas.
-- Orden de creacion resuelto por dependencias de FK (no coincide literalmente con el
-- orden narrativo del documento de diseno, que agrupa por modulo funcional).

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

-- ============================================================================
-- 1. CATALOGOS Y USUARIOS
-- ============================================================================

create table public.rol (
  id_rol      smallint generated always as identity primary key,
  codigo      varchar(20) not null unique,
  nombre      varchar(50) not null,
  descripcion varchar(150)
);

create table public.usuario (
  id_usuario     uuid primary key references auth.users (id) on delete cascade,
  id_rol         smallint not null references public.rol (id_rol) on delete restrict,
  nombres        varchar(60) not null,
  apellidos      varchar(60) not null,
  correo         varchar(120) not null unique,
  activo         boolean not null default true,
  fecha_registro timestamptz not null default now()
);

create table public.especie (
  id_especie smallint generated always as identity primary key,
  nombre     varchar(40) not null unique
);

create table public.raza (
  id_raza    integer generated always as identity primary key,
  id_especie smallint not null references public.especie (id_especie) on delete restrict,
  nombre     varchar(60) not null,
  unique (id_especie, nombre),
  unique (id_raza, id_especie) -- soporte de la FK compuesta desde paciente
);

-- ============================================================================
-- 2. PACIENTES Y PROPIETARIOS (Modulo 1)
-- ============================================================================

create table public.propietario (
  id_propietario    bigint generated always as identity primary key,
  identificacion    varchar(13) not null unique check (char_length(identificacion) >= 10),
  nombres           varchar(60) not null,
  apellidos         varchar(60) not null,
  telefono          varchar(15) not null,
  telefono_alterno  varchar(15),
  correo            varchar(120) check (correo is null or correo ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  direccion         varchar(150),
  activo            boolean not null default true,
  fecha_registro    timestamptz not null default now()
);

create table public.paciente (
  id_paciente      bigint generated always as identity primary key,
  id_propietario   bigint not null references public.propietario (id_propietario) on delete restrict,
  id_especie       smallint not null references public.especie (id_especie) on delete restrict,
  id_raza          integer,
  nombre           varchar(60) not null,
  sexo             char(1) not null check (sexo in ('M', 'H')),
  fecha_nacimiento date check (fecha_nacimiento <= current_date),
  color            varchar(40),
  activo           boolean not null default true,
  fecha_registro   timestamptz not null default now(),
  foreign key (id_raza, id_especie) references public.raza (id_raza, id_especie)
);

create index idx_paciente_propietario on public.paciente (id_propietario);

-- ============================================================================
-- 3. INVENTARIO - catalogo de productos (Modulo 4)
-- Se crea antes de Agenda/Historial porque vacunacion y detalle_factura lo referencian.
-- ============================================================================

create table public.producto (
  id_producto        bigint generated always as identity primary key,
  codigo             varchar(20) not null unique,
  nombre             varchar(100) not null,
  tipo               varchar(12) not null check (tipo in ('medicamento', 'insumo', 'vacuna')),
  presentacion       varchar(60),
  unidad_medida      varchar(20) not null,
  nivel_minimo       numeric(10, 2) not null default 0 check (nivel_minimo >= 0),
  existencia_actual  numeric(10, 2) not null default 0 check (existencia_actual >= 0), -- mantenida por trigger
  precio_unitario    numeric(10, 2) not null check (precio_unitario >= 0),
  activo             boolean not null default true
);

-- ============================================================================
-- 4. AGENDA (Modulo 2)
-- ============================================================================

create table public.cita (
  id_cita             bigint generated always as identity primary key,
  id_paciente         bigint not null references public.paciente (id_paciente) on delete restrict,
  id_veterinario      uuid not null references public.usuario (id_usuario) on delete restrict,
  fecha_hora_inicio   timestamptz not null,
  duracion_minutos    smallint not null default 30 check (duracion_minutos > 0),
  -- Columna derivada, calculada por fn_calcular_fin_cita (ver migracion de reglas de
  -- negocio). timestamptz + interval no es IMMUTABLE en PostgreSQL (depende del
  -- huso horario de sesion), por lo que no puede usarse dentro de una expresion de
  -- indice EXCLUDE; se materializa aqui mediante un trigger BEFORE INSERT/UPDATE.
  fecha_hora_fin      timestamptz not null,
  motivo              varchar(150),
  estado              varchar(12) not null default 'programada' check (estado in ('programada', 'cancelada', 'atendida')),
  id_usuario_registro uuid references public.usuario (id_usuario) default auth.uid(),
  fecha_registro      timestamptz not null default now(),
  exclude using gist (
    id_veterinario with =,
    tstzrange(fecha_hora_inicio, fecha_hora_fin) with &&
  ) where (estado <> 'cancelada')
);

create index idx_cita_veterinario_fecha on public.cita (id_veterinario, fecha_hora_inicio);
create index idx_cita_paciente on public.cita (id_paciente);

-- ============================================================================
-- 5. HISTORIAL CLINICO (Modulo 3)
-- ============================================================================

create table public.consulta (
  id_consulta    bigint generated always as identity primary key,
  id_paciente    bigint not null references public.paciente (id_paciente) on delete restrict,
  id_veterinario uuid not null references public.usuario (id_usuario) on delete restrict default auth.uid(),
  id_cita        bigint unique references public.cita (id_cita) on delete restrict,
  fecha_hora     timestamptz not null default now(),
  motivo         text not null,
  hallazgos      text,
  diagnostico    text not null,
  tratamiento    text,
  peso_kg        numeric(5, 2) check (peso_kg > 0)
);

create index idx_consulta_paciente_fecha on public.consulta (id_paciente, fecha_hora);

create table public.vacunacion (
  id_vacunacion    bigint generated always as identity primary key,
  id_paciente      bigint not null references public.paciente (id_paciente) on delete restrict,
  id_veterinario   uuid not null references public.usuario (id_usuario) on delete restrict default auth.uid(),
  id_producto      bigint not null references public.producto (id_producto) on delete restrict,
  id_consulta      bigint references public.consulta (id_consulta) on delete restrict,
  fecha_aplicacion date not null default current_date,
  dosis            numeric(6, 2) not null check (dosis > 0),
  lote             varchar(30)
);

create index idx_vacunacion_paciente_fecha on public.vacunacion (id_paciente, fecha_aplicacion);

create table public.examen_laboratorio (
  id_examen        bigint generated always as identity primary key,
  id_paciente      bigint not null references public.paciente (id_paciente) on delete restrict,
  id_veterinario   uuid not null references public.usuario (id_usuario) on delete restrict default auth.uid(),
  id_consulta      bigint references public.consulta (id_consulta) on delete restrict,
  tipo_examen      varchar(80) not null,
  fecha_solicitud  date not null default current_date,
  fecha_resultado  date check (fecha_resultado >= fecha_solicitud),
  resultado        text,
  observacion      text
);

create index idx_examen_paciente_fecha on public.examen_laboratorio (id_paciente, fecha_solicitud);

-- ============================================================================
-- 6. INVENTARIO - movimientos (Modulo 4)
-- ============================================================================

create table public.movimiento_inventario (
  id_movimiento          bigint generated always as identity primary key,
  id_producto            bigint not null references public.producto (id_producto) on delete restrict,
  tipo_movimiento        varchar(10) not null check (tipo_movimiento in ('ingreso', 'ajuste', 'consumo')),
  cantidad               numeric(10, 2) not null check (cantidad <> 0),
  existencia_resultante  numeric(10, 2) not null check (existencia_resultante >= 0), -- calculada por trigger
  fecha_hora             timestamptz not null default now(),
  id_usuario             uuid not null references public.usuario (id_usuario) on delete restrict default auth.uid(),
  id_consulta            bigint references public.consulta (id_consulta) on delete restrict,
  id_vacunacion          bigint references public.vacunacion (id_vacunacion) on delete restrict,
  observacion            varchar(150),
  constraint chk_movimiento_signo check (
    (tipo_movimiento = 'ingreso' and cantidad > 0) or
    (tipo_movimiento = 'consumo' and cantidad < 0) or
    (tipo_movimiento = 'ajuste')
  ),
  constraint chk_movimiento_origen check (
    (tipo_movimiento = 'consumo' and (id_consulta is not null or id_vacunacion is not null)) or
    (tipo_movimiento in ('ingreso', 'ajuste') and id_consulta is null and id_vacunacion is null)
  )
);

create index idx_movimiento_producto_fecha on public.movimiento_inventario (id_producto, fecha_hora);

-- ============================================================================
-- 7. FACTURACION (Modulo 5)
-- ============================================================================

create table public.factura (
  id_factura         bigint generated always as identity primary key,
  numero             varchar(15) not null unique,
  id_propietario     bigint not null references public.propietario (id_propietario) on delete restrict,
  id_consulta        bigint unique references public.consulta (id_consulta) on delete restrict,
  fecha_emision      timestamptz not null default now(),
  subtotal           numeric(10, 2) not null default 0 check (subtotal >= 0),
  impuesto           numeric(10, 2) not null default 0 check (impuesto >= 0),
  total              numeric(10, 2) generated always as (subtotal + impuesto) stored,
  id_usuario_emisor  uuid not null references public.usuario (id_usuario) on delete restrict default auth.uid()
);

create index idx_factura_fecha_emision on public.factura (fecha_emision);
create index idx_factura_propietario on public.factura (id_propietario);

create table public.detalle_factura (
  id_detalle       bigint generated always as identity primary key,
  id_factura       bigint not null references public.factura (id_factura) on delete cascade,
  numero_linea     smallint not null,
  id_producto      bigint references public.producto (id_producto) on delete restrict,
  descripcion      varchar(120) not null,
  cantidad         numeric(10, 2) not null check (cantidad > 0),
  precio_unitario  numeric(10, 2) not null check (precio_unitario >= 0),
  subtotal_linea   numeric(12, 2) generated always as (cantidad * precio_unitario) stored,
  unique (id_factura, numero_linea)
);

create table public.pago (
  id_pago      bigint generated always as identity primary key,
  id_factura   bigint not null references public.factura (id_factura) on delete restrict,
  fecha_pago   timestamptz not null default now(),
  monto        numeric(10, 2) not null check (monto > 0),
  forma_pago   varchar(15) not null check (forma_pago in ('efectivo', 'tarjeta', 'transferencia')),
  referencia   varchar(40),
  id_usuario   uuid not null references public.usuario (id_usuario) on delete restrict default auth.uid()
);

create index idx_pago_factura on public.pago (id_factura);
