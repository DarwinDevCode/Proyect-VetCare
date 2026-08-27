# Implementación de Base de Datos — Scripts SQL (DDL + DML) — VetCare

## 1. Fuente y orden de ejecución

Los scripts reales son los 14 archivos de `supabase/migrations/` (nombrados con
un *timestamp* `YYYYMMDDHHMMSS_descripcion.sql`, que fija su orden de
aplicación) más `supabase/seed.sql`. Se aplican con `npx supabase db reset`
(entorno local, recrea la base y ejecuta migraciones + `seed.sql`) o
`npx supabase db push` (proyecto alojado, solo migraciones). El motor es
PostgreSQL 17 (`supabase/config.toml`, `[db] major_version = 17`).

| # | Archivo | Contenido |
|---|---|---|
| 1 | `20260818151454_initial_schema.sql` | 15 tablas base, índices, extensión `pgcrypto`/`btree_gist` |
| 2 | `20260818151644_business_rules.sql` | Triggers y vistas de reglas de negocio |
| 3 | `20260818151648_row_level_security.sql` | `GRANT`, `fn_rol_actual()`, políticas RLS de los 5 módulos originales |
| 4 | `20260819072616_facturacion.sql` | Secuencia de numeración, `fn_conceptos_facturables`, `fn_emitir_factura` |
| 5 | `20260819073243_estado_factura_por_periodo.sql` | Recrea `v_estado_factura` con más columnas |
| 6 | `20260819073501_atenciones_facturables.sql` | `fn_atenciones_facturables` |
| 7 | `20260819075223_propietario_facturado_para_administrador.sql` | Política adicional de `propietario` para Administrador |
| 8 | `20260825163425_administracion.sql` | Módulo 6: `bitacora_auditoria`, `parametro_sistema`, roles/catálogos administrables |
| 9 | `20260826055525_historial_signos_vitales.sql` | Columnas de signos vitales en `consulta`; recrea `v_historial_clinico` |
| 10 | `20260826055528_vacunas_intervalo_y_proxima.sql` | Columna `intervalo_dias` en `producto`; vista `v_vacunas_proximas` |
| 11 | `20260826055531_inventario_lotes_vencimiento.sql` | Columnas de lote/vencimiento en `movimiento_inventario`; vista `v_lotes_por_vencer` |
| 12 | `20260826061427_lista_espera.sql` | Tabla `lista_espera` (Módulo 2, RF-034/RF-035) |
| 13 | `20260826063415_compras_proveedores.sql` | Módulo 7: `proveedor`, `orden_compra`, `detalle_orden_compra` |
| 14 | `20260826070355_portal_propietario.sql` | Módulo 8: identidad de portal, `EXCLUDE` recreado, RLS *identity-scoped* |
| — | `seed.sql` | DML: roles, catálogos, usuarios de demostración, datos de negocio de demostración (solo entorno local) |

No existe una sentencia `CREATE DATABASE` ni `CREATE SCHEMA` propia del
proyecto: la base y el esquema `public` los crea la imagen de Postgres de
Supabase; las migraciones parten de ese esquema ya existente.

## 2. Migración 1 — `initial_schema.sql`

```sql
create extension if not exists pgcrypto;
create extension if not exists btree_gist;
```

### Catálogos y usuarios

```sql
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
  unique (id_raza, id_especie) -- soporta la FK compuesta desde paciente
);
```

### Pacientes y Propietarios (Módulo 1)

```sql
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
```

### Inventario — catálogo (Módulo 4, creado antes de Agenda/Historial porque estos lo referencian)

```sql
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
```

### Agenda (Módulo 2)

```sql
create table public.cita (
  id_cita             bigint generated always as identity primary key,
  id_paciente         bigint not null references public.paciente (id_paciente) on delete restrict,
  id_veterinario      uuid not null references public.usuario (id_usuario) on delete restrict,
  fecha_hora_inicio   timestamptz not null,
  duracion_minutos    smallint not null default 30 check (duracion_minutos > 0),
  fecha_hora_fin      timestamptz not null, -- calculada por trigger fn_calcular_fin_cita
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
```

`id_veterinario uuid not null` y `estado in ('programada','cancelada','atendida')`
se modifican en la migración 14 (`portal_propietario.sql`) para admitir el
estado `'solicitada'` sin veterinario asignado.

### Historial Clínico (Módulo 3)

```sql
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
```

### Inventario — movimientos (Módulo 4)

```sql
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
```

Las columnas `lote_codigo`, `fecha_vencimiento` (migración 11) e
`id_orden_compra` (migración 13) se agregan después con `alter table`.

### Facturación (Módulo 5)

```sql
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
```

`factura.total` se implementó como columna generada (equivalente
funcionalmente a un trigger, y consistente también cuando se edita `impuesto`
sin tocar `detalle_factura`); el diseño de base de datos original la describía
como mantenida por trigger.

## 3. Migración 2 — `business_rules.sql`

### `fn_calcular_fin_cita` (RN-004/RF-011)

```sql
create function public.fn_calcular_fin_cita()
returns trigger language plpgsql as $$
begin
  new.fecha_hora_fin := new.fecha_hora_inicio + (new.duracion_minutos * interval '1 minute');
  return new;
end;
$$;

create trigger trg_calcular_fin_cita
  before insert or update on public.cita
  for each row execute function public.fn_calcular_fin_cita();
```

`timestamptz + interval` no es `immutable` en PostgreSQL (depende del huso
horario de sesión), así que `fecha_hora_fin` no puede expresarse dentro del
índice `EXCLUDE`; el trigger la materializa antes de que ese índice se evalúe.

### `fn_actualizar_existencia` — kardex

```sql
create function public.fn_actualizar_existencia()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_existencia_actual numeric(10, 2);
  v_nueva_existencia   numeric(10, 2);
begin
  select existencia_actual into v_existencia_actual
  from public.producto where id_producto = new.id_producto for update;

  v_nueva_existencia := v_existencia_actual + new.cantidad;

  if v_nueva_existencia < 0 then
    raise exception 'No hay existencia suficiente del producto para este movimiento (disponible: %, solicitado: %).',
      v_existencia_actual, abs(new.cantidad) using errcode = 'check_violation';
  end if;

  new.existencia_resultante := v_nueva_existencia;
  update public.producto set existencia_actual = v_nueva_existencia where id_producto = new.id_producto;
  return new;
end;
$$;

create trigger trg_actualizar_existencia
  before insert on public.movimiento_inventario
  for each row execute function public.fn_actualizar_existencia();
```

`security definer` porque el rol Veterinario, que inserta movimientos de tipo
`consumo`, no tiene permiso directo de `UPDATE` sobre `producto` bajo RLS; el
trigger cruza ese límite de forma controlada.

### `fn_validar_producto_vacuna` (RN-019)

```sql
create function public.fn_validar_producto_vacuna()
returns trigger language plpgsql as $$
declare v_tipo varchar(12);
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
  for each row execute function public.fn_validar_producto_vacuna();
```

### `fn_vacunacion_descuenta_inventario` (RF-024/RN-008)

```sql
create function public.fn_vacunacion_descuenta_inventario()
returns trigger language plpgsql as $$
begin
  insert into public.movimiento_inventario (
    id_producto, tipo_movimiento, cantidad, fecha_hora, id_usuario, id_vacunacion, observacion
  ) values (
    new.id_producto, 'consumo', -new.dosis, now(),
    new.id_veterinario, new.id_vacunacion, 'Descuento automatico por vacunacion aplicada'
  );
  return new;
end;
$$;

create trigger trg_vacunacion_descuenta
  after insert on public.vacunacion
  for each row execute function public.fn_vacunacion_descuenta_inventario();
```

### `fn_actualizar_subtotal_factura` (RNF-007)

```sql
create function public.fn_actualizar_subtotal_factura()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare v_id_factura bigint;
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
  for each row execute function public.fn_actualizar_subtotal_factura();
```

### Vistas de reglas de negocio

```sql
-- RF-020: historial clinico unico y cronologico por paciente (union de tres hechos clinicos)
create view public.v_historial_clinico as
  select c.id_paciente, 'consulta'::text as tipo_evento, c.fecha_hora as fecha,
         c.id_consulta as id_evento, c.motivo as resumen, c.diagnostico, c.tratamiento,
         null::text as producto_o_examen, c.id_veterinario
  from public.consulta c
  union all
  select v.id_paciente, 'vacunacion'::text, v.fecha_aplicacion::timestamptz, v.id_vacunacion,
         'Vacunacion aplicada'::text, null, null, p.nombre, v.id_veterinario
  from public.vacunacion v join public.producto p on p.id_producto = v.id_producto
  union all
  select e.id_paciente, 'examen'::text, e.fecha_solicitud::timestamptz, e.id_examen,
         e.tipo_examen, null, e.resultado, e.observacion, e.id_veterinario
  from public.examen_laboratorio e;

alter view public.v_historial_clinico set (security_invoker = on);

-- RF-031/RN-015: saldo pendiente derivado de los pagos de cada factura
create view public.v_estado_factura as
  select f.id_factura, f.numero, f.id_propietario, f.total,
         coalesce(sum(p.monto), 0) as total_pagado,
         f.total - coalesce(sum(p.monto), 0) as saldo_pendiente,
         case
           when coalesce(sum(p.monto), 0) = 0 then 'pendiente'
           when coalesce(sum(p.monto), 0) >= f.total then 'pagada'
           else 'parcial'
         end as estado_cobro
  from public.factura f left join public.pago p on p.id_factura = f.id_factura
  group by f.id_factura, f.numero, f.id_propietario, f.total;

alter view public.v_estado_factura set (security_invoker = on);

-- RF-026/RN-011: productos en o por debajo de su nivel minimo, siempre derivado
create view public.v_alerta_stock as
  select id_producto, codigo, nombre, tipo, existencia_actual, nivel_minimo
  from public.producto where activo and existencia_actual <= nivel_minimo;

alter view public.v_alerta_stock set (security_invoker = on);
```

`v_historial_clinico` se recrea en la migración 9 (agrega columnas de signos
vitales) y `v_estado_factura` se recrea en la migración 5 (agrega columnas de
período/consulta/emisor).

## 4. Migración 3 — `row_level_security.sql`

```sql
grant usage on schema public to authenticated;
grant select, insert, update on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create or replace function public.fn_rol_actual()
returns text language sql stable security definer set search_path = public
as $$
  select r.codigo from public.usuario u join public.rol r on r.id_rol = u.id_rol
  where u.id_usuario = auth.uid()
$$;
```

Sin políticas `DELETE` en ninguna tabla del proyecto (RF-033: no hay borrado
físico). `fn_rol_actual()` se redefine en la migración 8 para exigir además
`u.activo`.

### Políticas por módulo (resumen; cada `create policy` completo está en el
archivo fuente)

| Tabla | `select` | `insert` | `update` |
|---|---|---|---|
| `rol`, `usuario`, `especie`, `raza` | cualquier autenticado | — | — |
| `propietario` | recepcionista, veterinario | recepcionista | recepcionista |
| `paciente` | recepcionista, veterinario | recepcionista | recepcionista |
| `cita` | recepcionista, veterinario | recepcionista | recepcionista |
| `consulta` | veterinario | veterinario | — (RN-007) |
| `vacunacion` | veterinario | veterinario | — |
| `examen_laboratorio` | veterinario | veterinario | veterinario (única excepción a RN-007, RF-019) |
| `producto` | veterinario, administrador, recepcionista | administrador | administrador |
| `movimiento_inventario` | veterinario, administrador | administrador (`ingreso`/`ajuste`) **o** veterinario (`consumo`) | — |
| `factura` | recepcionista, administrador | recepcionista | — (subtotal/total por trigger/columna generada) |
| `detalle_factura` | recepcionista, administrador (vía `exists` sobre `factura`) | recepcionista | — |
| `pago` | recepcionista, administrador | recepcionista | — |

Ejemplo representativo (`movimiento_inventario`, la única política que
distingue por el valor de una columna además del rol):

```sql
create policy movimiento_insert on public.movimiento_inventario
  for insert to authenticated
  with check (
    (public.fn_rol_actual() = 'administrador' and tipo_movimiento in ('ingreso', 'ajuste'))
    or (public.fn_rol_actual() = 'veterinario' and tipo_movimiento = 'consumo')
  );
```

## 5. Migración 4 — `facturacion.sql`

```sql
create sequence public.seq_factura_numero as bigint start with 1;

create function public.fn_asignar_numero_factura()
returns trigger language plpgsql as $$
begin
  new.numero := 'F-' || lpad(nextval('public.seq_factura_numero')::text, 8, '0');
  return new;
end;
$$;

create trigger trg_numero_factura
  before insert on public.factura
  for each row execute function public.fn_asignar_numero_factura();
```

`nextval` no se revierte cuando la transacción falla — es justamente lo que
permite que el número no se reutilice (RN-016); la numeración salta huecos
ante un intento fallido, algo esperado, no un defecto.

```sql
create function public.fn_conceptos_facturables(p_id_consulta bigint)
returns table (id_producto bigint, descripcion varchar(120), cantidad numeric(10,2), precio_unitario numeric(10,2))
language sql stable security definer set search_path = public
as $$
  select pr.id_producto, pr.nombre::varchar(120), sum(-m.cantidad)::numeric(10,2), pr.precio_unitario
  from public.movimiento_inventario m
  join public.producto pr on pr.id_producto = m.id_producto
  left join public.vacunacion v on v.id_vacunacion = m.id_vacunacion
  where m.tipo_movimiento = 'consumo'
    and coalesce(m.id_consulta, v.id_consulta) = p_id_consulta
    and public.fn_rol_actual() in ('recepcionista', 'administrador')
  group by pr.id_producto, pr.nombre, pr.precio_unitario
  order by pr.nombre;
$$;
```

`security definer` cruza el límite de RN-006 (Recepción no puede leer
`consulta`/`vacunacion`/`movimiento_inventario`) de forma acotada: solo
devuelve producto, cantidad y precio.

```sql
create function public.fn_emitir_factura(
  p_id_propietario bigint default null,
  p_id_consulta bigint default null,
  p_porcentaje_impuesto numeric default 0,
  p_lineas jsonb default null
)
returns bigint
language plpgsql security definer set search_path = public
as $$
declare
  v_id_factura bigint; v_id_propietario bigint; v_subtotal numeric(10,2);
  v_lineas jsonb; v_total_lineas integer;
begin
  if public.fn_rol_actual() is distinct from 'recepcionista' then
    raise exception 'Solo el rol Recepcionista puede emitir facturas.' using errcode = '42501';
  end if;

  if p_porcentaje_impuesto < 0 then
    raise exception 'El porcentaje de impuesto no puede ser negativo.';
  end if;

  if p_id_consulta is not null then
    select pa.id_propietario into v_id_propietario
    from public.consulta c join public.paciente pa on pa.id_paciente = c.id_paciente
    where c.id_consulta = p_id_consulta;
    if v_id_propietario is null then
      raise exception 'La atencion indicada no existe.' using errcode = '23503';
    end if;
  else
    v_id_propietario := p_id_propietario;
    if v_id_propietario is null then
      raise exception 'Debe indicarse el propietario o la atencion a facturar.';
    end if;
  end if;

  v_lineas := coalesce(p_lineas, (
    select coalesce(jsonb_agg(to_jsonb(cf)), '[]'::jsonb)
    from public.fn_conceptos_facturables(p_id_consulta) cf
  ));

  select count(*) into v_total_lineas from jsonb_array_elements(v_lineas);
  if v_total_lineas = 0 then
    raise exception 'La factura debe tener al menos un concepto a facturar.';
  end if;

  insert into public.factura (id_propietario, id_consulta)
  values (v_id_propietario, p_id_consulta) returning id_factura into v_id_factura;

  insert into public.detalle_factura (id_factura, numero_linea, id_producto, descripcion, cantidad, precio_unitario)
  select v_id_factura, (row_number() over ())::smallint, (l->>'id_producto')::bigint,
         (l->>'descripcion')::varchar(120), (l->>'cantidad')::numeric(10,2),
         coalesce(
           (select pr.precio_unitario from public.producto pr where pr.id_producto = (l->>'id_producto')::bigint),
           (l->>'precio_unitario')::numeric(10,2)
         )
  from jsonb_array_elements(v_lineas) as l;

  select subtotal into v_subtotal from public.factura where id_factura = v_id_factura;
  update public.factura set impuesto = round(v_subtotal * p_porcentaje_impuesto / 100, 2)
  where id_factura = v_id_factura;

  return v_id_factura;
end;
$$;

revoke execute on function public.fn_conceptos_facturables(bigint) from public, anon;
revoke execute on function public.fn_emitir_factura(bigint, bigint, numeric, jsonb) from public, anon;
grant execute on function public.fn_conceptos_facturables(bigint) to authenticated;
grant execute on function public.fn_emitir_factura(bigint, bigint, numeric, jsonb) to authenticated;
```

`fn_emitir_factura` cubre la única forma de emitir una factura con cabecera y
líneas en una transacción (RES-07/RNF-005): PostgREST no ofrece transacciones
entre peticiones HTTP separadas. `RN-014` se cumple resolviendo
`precio_unitario` contra `producto` en este momento, no aceptando el valor del
cliente cuando hay `id_producto`.

## 6. Migración 5 — `estado_factura_por_periodo.sql`

```sql
drop view public.v_estado_factura;

create view public.v_estado_factura as
  select f.id_factura, f.numero, f.id_propietario, f.id_consulta, f.fecha_emision,
         f.id_usuario_emisor, f.subtotal, f.impuesto, f.total,
         coalesce(sum(p.monto), 0) as total_pagado,
         f.total - coalesce(sum(p.monto), 0) as saldo_pendiente,
         case
           when coalesce(sum(p.monto), 0) = 0 then 'pendiente'
           when coalesce(sum(p.monto), 0) >= f.total then 'pagada'
           else 'parcial'
         end as estado_cobro
  from public.factura f left join public.pago p on p.id_factura = f.id_factura
  group by f.id_factura, f.numero, f.id_propietario, f.id_consulta, f.fecha_emision,
           f.id_usuario_emisor, f.subtotal, f.impuesto, f.total;

alter view public.v_estado_factura set (security_invoker = on);
grant select on public.v_estado_factura to authenticated;
```

Agrega `fecha_emision` (para poder filtrar por período, RF-031), `id_consulta`
e `id_usuario_emisor`.

## 7. Migración 6 — `atenciones_facturables.sql`

```sql
create function public.fn_atenciones_facturables()
returns table (
  id_consulta bigint, fecha_hora timestamptz, id_propietario bigint,
  paciente varchar(60), propietario_nombres varchar(60),
  propietario_apellidos varchar(60), propietario_identificacion varchar(13)
)
language sql stable security definer set search_path = public
as $$
  select c.id_consulta, c.fecha_hora, pr.id_propietario, pa.nombre, pr.nombres, pr.apellidos, pr.identificacion
  from public.consulta c
  join public.paciente pa on pa.id_paciente = c.id_paciente
  join public.propietario pr on pr.id_propietario = pa.id_propietario
  where not exists (select 1 from public.factura f where f.id_consulta = c.id_consulta)
    and public.fn_rol_actual() in ('recepcionista', 'administrador')
  order by c.fecha_hora desc;
$$;

revoke execute on function public.fn_atenciones_facturables() from public, anon;
grant execute on function public.fn_atenciones_facturables() to authenticated;
```

Deja fuera intencionalmente cualquier dato clínico (motivo, diagnóstico,
hallazgos, tratamiento) — RN-006 se preserva también aquí.

## 8. Migración 7 — `propietario_facturado_para_administrador.sql`

```sql
create policy propietario_select_facturado on public.propietario
  for select to authenticated
  using (
    public.fn_rol_actual() = 'administrador'
    and exists (select 1 from public.factura f where f.id_propietario = propietario.id_propietario)
  );
```

Corrige que Administración pudiera consultar facturas (RF-031) pero no leer el
`propietario` embebido, porque la política original de `propietario` (Módulo
1) solo alcanzaba a Recepcionista y Veterinario.

## 9. Migración 8 — `administracion.sql`

```sql
grant select, insert, update on public.usuario to service_role;

create or replace function public.fn_rol_actual()
returns text language sql stable security definer set search_path = public
as $$
  select r.codigo from public.usuario u join public.rol r on r.id_rol = u.id_rol
  where u.id_usuario = auth.uid() and u.activo
$$;

create or replace function public.fn_proteger_ultimo_administrador()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_era_admin_activo boolean; v_sigue_admin_activo boolean; v_otros_admins integer;
begin
  v_era_admin_activo := old.activo and exists (
    select 1 from public.rol r where r.id_rol = old.id_rol and r.codigo = 'administrador');
  v_sigue_admin_activo := new.activo and exists (
    select 1 from public.rol r where r.id_rol = new.id_rol and r.codigo = 'administrador');

  if v_era_admin_activo and not v_sigue_admin_activo then
    select count(*) into v_otros_admins
    from public.usuario u join public.rol r on r.id_rol = u.id_rol
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

create or replace function public.fn_auditar_cambio()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_datos jsonb := to_jsonb(new); -- acceso por clave, no new.<campo>: evita error en tablas sin ese campo
  v_id text;
begin
  v_id := case tg_table_name
    when 'usuario'          then v_datos ->> 'id_usuario'
    when 'rol'               then v_datos ->> 'id_rol'
    when 'parametro_sistema' then v_datos ->> 'clave'
    when 'especie'           then v_datos ->> 'id_especie'
    when 'raza'              then v_datos ->> 'id_raza'
    else null
  end;

  insert into public.bitacora_auditoria (tabla, id_registro, accion, valores_anteriores, valores_nuevos, id_usuario)
  values (tg_table_name, v_id, lower(tg_op),
          case when tg_op = 'UPDATE' then to_jsonb(old) else null end, v_datos, auth.uid());
  return new;
end;
$$;

create trigger trg_auditar_usuario  after insert or update on public.usuario  for each row execute function public.fn_auditar_cambio();
create trigger trg_auditar_rol      after insert or update on public.rol      for each row execute function public.fn_auditar_cambio();
create trigger trg_auditar_especie  after insert or update on public.especie  for each row execute function public.fn_auditar_cambio();
create trigger trg_auditar_raza     after insert or update on public.raza     for each row execute function public.fn_auditar_cambio();

create table public.parametro_sistema (
  clave                varchar(60) primary key,
  valor                varchar(200) not null,
  descripcion          varchar(200),
  fecha_actualizacion  timestamptz not null default now(),
  id_usuario_actualizo uuid references public.usuario (id_usuario) on delete restrict
);

grant select, update on public.parametro_sistema to authenticated;

create trigger trg_auditar_parametro after insert or update on public.parametro_sistema for each row execute function public.fn_auditar_cambio();

insert into public.parametro_sistema (clave, valor, descripcion) values
  ('impuesto_defecto_pct', '15', 'Porcentaje de impuesto sugerido al emitir una factura (RF-028).'),
  ('horario_atencion_inicio', '08:00', 'Hora de inicio de la jornada, usada para sugerir horarios libres de citas (RF-011).'),
  ('horario_atencion_fin', '18:00', 'Hora de fin de la jornada de atencion (RF-011).');
```

Políticas RLS agregadas: `usuario_update` (administrador), `rol_insert`
(administrador, sin `update` — renombrar un `codigo` existente rompería en
silencio toda política que lo compara como texto literal), `especie_insert`/
`especie_update`, `raza_insert`/`raza_update`, `parametro_select` (cualquier
autenticado), `parametro_update` (administrador), `bitacora_select`
(administrador).

## 10. Migración 9 — `historial_signos_vitales.sql`

```sql
alter table public.consulta
  add column temperatura_c numeric(4, 1) check (temperatura_c > 0),
  add column frecuencia_cardiaca_lpm smallint check (frecuencia_cardiaca_lpm > 0),
  add column frecuencia_respiratoria_rpm smallint check (frecuencia_respiratoria_rpm > 0);

create or replace view public.v_historial_clinico as
  select c.id_paciente, 'consulta'::text as tipo_evento, c.fecha_hora as fecha, c.id_consulta as id_evento,
         c.motivo as resumen, c.diagnostico, c.tratamiento, null::text as producto_o_examen, c.id_veterinario,
         c.temperatura_c, c.frecuencia_cardiaca_lpm, c.frecuencia_respiratoria_rpm
  from public.consulta c
  union all
  select v.id_paciente, 'vacunacion'::text, v.fecha_aplicacion::timestamptz, v.id_vacunacion,
         'Vacunacion aplicada'::text, null, null, p.nombre, v.id_veterinario,
         null::numeric(4,1), null::smallint, null::smallint
  from public.vacunacion v join public.producto p on p.id_producto = v.id_producto
  union all
  select e.id_paciente, 'examen'::text, e.fecha_solicitud::timestamptz, e.id_examen,
         e.tipo_examen, null, e.resultado, e.observacion, e.id_veterinario,
         null::numeric(4,1), null::smallint, null::smallint
  from public.examen_laboratorio e;

alter view public.v_historial_clinico set (security_invoker = on);
```

`create or replace view` exige conservar las columnas existentes en el mismo
orden; las tres nuevas se agregan al final, `null` para vacunación/examen.

## 11. Migración 10 — `vacunas_intervalo_y_proxima.sql`

```sql
alter table public.producto add column intervalo_dias integer check (intervalo_dias > 0);

create view public.v_vacunas_proximas as
  select v.id_paciente, v.id_producto, p.nombre as producto, max(v.fecha_aplicacion) as ultima_aplicacion,
         p.intervalo_dias,
         (max(v.fecha_aplicacion) + p.intervalo_dias * interval '1 day')::date as proxima_fecha
  from public.vacunacion v join public.producto p on p.id_producto = v.id_producto
  where p.intervalo_dias is not null
  group by v.id_paciente, v.id_producto, p.nombre, p.intervalo_dias;

alter view public.v_vacunas_proximas set (security_invoker = on);
grant select on public.v_vacunas_proximas to authenticated;
```

## 12. Migración 11 — `inventario_lotes_vencimiento.sql`

```sql
alter table public.movimiento_inventario
  add column lote_codigo varchar(30),
  add column fecha_vencimiento date;

create view public.v_lotes_por_vencer as
  select m.id_movimiento, m.id_producto, p.nombre as producto, m.lote_codigo, m.fecha_vencimiento,
         m.cantidad, m.fecha_hora
  from public.movimiento_inventario m join public.producto p on p.id_producto = m.id_producto
  where m.tipo_movimiento = 'ingreso'
    and m.fecha_vencimiento is not null
    and m.fecha_vencimiento <= current_date + 30;

alter view public.v_lotes_por_vencer set (security_invoker = on);
grant select on public.v_lotes_por_vencer to authenticated;
```

No participan de `fn_actualizar_existencia`: un lote es metadato sobre qué
ingreso trajo el stock, no una unidad de control de existencias aparte.

## 13. Migración 12 — `lista_espera.sql`

```sql
create table public.lista_espera (
  id_lista_espera     bigint generated always as identity primary key,
  id_paciente         bigint not null references public.paciente (id_paciente) on delete restrict,
  id_veterinario      uuid references public.usuario (id_usuario) on delete restrict,
  fecha_preferida     date,
  franja_preferida    varchar(10) check (franja_preferida in ('manana', 'tarde')),
  motivo              text not null,
  estado              varchar(10) not null default 'pendiente'
                        check (estado in ('pendiente', 'atendida', 'cancelada')),
  id_usuario_registro uuid not null references public.usuario (id_usuario) on delete restrict default auth.uid(),
  fecha_registro      timestamptz not null default now()
);

create index idx_lista_espera_veterinario_estado on public.lista_espera (id_veterinario, estado);

alter table public.lista_espera enable row level security;

create policy lista_espera_select on public.lista_espera
  for select to authenticated using (public.fn_rol_actual() in ('recepcionista', 'veterinario'));

create policy lista_espera_insert on public.lista_espera
  for insert to authenticated with check (public.fn_rol_actual() = 'recepcionista');

create policy lista_espera_update on public.lista_espera
  for update to authenticated
  using (public.fn_rol_actual() = 'recepcionista')
  with check (public.fn_rol_actual() = 'recepcionista');

grant select, insert, update on public.lista_espera to authenticated;
```

## 14. Migración 13 — `compras_proveedores.sql`

```sql
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

create table public.orden_compra (
  id_orden_compra      bigint generated always as identity primary key,
  id_proveedor         bigint not null references public.proveedor (id_proveedor) on delete restrict,
  estado               varchar(10) not null default 'borrador'
                          check (estado in ('borrador', 'emitida', 'recibida', 'cancelada')),
  observacion          text,
  id_usuario_registro  uuid not null references public.usuario (id_usuario) on delete restrict default auth.uid(),
  fecha_registro       timestamptz not null default now()
);

create table public.detalle_orden_compra (
  id_detalle       bigint generated always as identity primary key,
  id_orden_compra  bigint not null references public.orden_compra (id_orden_compra) on delete restrict,
  numero_linea     smallint not null,
  id_producto      bigint not null references public.producto (id_producto) on delete restrict,
  cantidad         numeric(10, 2) not null check (cantidad > 0),
  precio_unitario  numeric(10, 2) not null check (precio_unitario >= 0),
  subtotal_linea   numeric(10, 2) generated always as (cantidad * precio_unitario) stored,
  unique (id_orden_compra, numero_linea)
);

alter table public.movimiento_inventario
  add column id_orden_compra bigint references public.orden_compra (id_orden_compra) on delete restrict;

create function public.fn_recibir_orden_compra()
returns trigger language plpgsql as $$
begin
  insert into public.movimiento_inventario (id_producto, tipo_movimiento, cantidad, id_orden_compra, observacion)
  select d.id_producto, 'ingreso', d.cantidad, new.id_orden_compra,
         'Recepcion de orden de compra #' || new.id_orden_compra
  from public.detalle_orden_compra d where d.id_orden_compra = new.id_orden_compra;
  return new;
end;
$$;

create trigger trg_recibir_orden_compra
  after update on public.orden_compra
  for each row
  when (new.estado = 'recibida' and old.estado is distinct from 'recibida')
  execute function public.fn_recibir_orden_compra();

create function public.fn_crear_orden_compra(p_id_proveedor bigint, p_observacion text, p_lineas jsonb)
returns bigint language plpgsql as $$
declare v_id_orden bigint; v_linea jsonb; v_numero smallint := 0;
begin
  if p_lineas is null or jsonb_array_length(p_lineas) = 0 then
    raise exception 'La orden de compra debe tener al menos un producto.';
  end if;

  insert into public.orden_compra (id_proveedor, observacion)
  values (p_id_proveedor, p_observacion) returning id_orden_compra into v_id_orden;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_numero := v_numero + 1;
    insert into public.detalle_orden_compra (id_orden_compra, numero_linea, id_producto, cantidad, precio_unitario)
    values (v_id_orden, v_numero, (v_linea ->> 'id_producto')::bigint,
            (v_linea ->> 'cantidad')::numeric, (v_linea ->> 'precio_unitario')::numeric);
  end loop;

  return v_id_orden;
end;
$$;

revoke execute on function public.fn_crear_orden_compra(bigint, text, jsonb) from public, anon;
grant execute on function public.fn_crear_orden_compra(bigint, text, jsonb) to authenticated;
```

`fn_recibir_orden_compra` no es `security definer` (a diferencia de
`fn_vacunacion_descuenta_inventario`): Administrador ya tiene permiso directo
de insertar movimientos `ingreso`, no hay ningún límite de rol que cruzar.
`fn_crear_orden_compra` tampoco lo es, por el mismo motivo.

Políticas RLS: `proveedor`, `orden_compra` y `detalle_orden_compra` con
`select`/`insert` exclusivos de `administrador`; `orden_compra` además con
`update` (transiciones de estado); `detalle_orden_compra` sin `update`
(inmutable, mismo criterio que `detalle_factura`). `GRANT select, insert,
update on proveedor/orden_compra` y `GRANT select, insert on
detalle_orden_compra` a `authenticated`.

## 15. Migración 14 — `portal_propietario.sql`

```sql
alter table public.propietario
  add column id_usuario_portal uuid unique references auth.users (id) on delete set null;

create or replace function public.fn_propietario_actual()
returns bigint language sql stable security definer set search_path = public
as $$
  select id_propietario from public.propietario where id_usuario_portal = auth.uid()
$$;

alter table public.cita alter column id_veterinario drop not null;

alter table public.cita drop constraint cita_estado_check;
alter table public.cita add constraint cita_estado_check
  check (estado in ('solicitada', 'programada', 'cancelada', 'atendida'));

alter table public.cita drop constraint cita_id_veterinario_tstzrange_excl;
alter table public.cita add constraint cita_id_veterinario_tstzrange_excl
  exclude using gist (
    id_veterinario with =,
    tstzrange(fecha_hora_inicio, fecha_hora_fin) with &&
  ) where (estado in ('programada', 'atendida'));
```

Postgres no permite `alter` sobre una restricción `EXCLUDE`: se elimina y se
recrea con la nueva cláusula `where`, para que una `'solicitada'` (siempre sin
veterinario) no compita por el índice hasta que Recepción la confirme.

```sql
create policy propietario_select_portal on public.propietario
  for select to authenticated using (id_usuario_portal = auth.uid());

create policy paciente_select_portal on public.paciente
  for select to authenticated
  using (paciente.id_propietario = public.fn_propietario_actual());

create policy cita_select_portal on public.cita
  for select to authenticated
  using (exists (
    select 1 from public.paciente
    where paciente.id_paciente = cita.id_paciente
      and paciente.id_propietario = public.fn_propietario_actual()
  ));

create policy cita_insert_portal on public.cita
  for insert to authenticated
  with check (
    estado = 'solicitada' and id_veterinario is null
    and exists (
      select 1 from public.paciente
      where paciente.id_paciente = cita.id_paciente
        and paciente.id_propietario = public.fn_propietario_actual()
    )
  );

create policy factura_select_portal on public.factura
  for select to authenticated using (factura.id_propietario = public.fn_propietario_actual());

create policy detalle_factura_select_portal on public.detalle_factura
  for select to authenticated
  using (exists (
    select 1 from public.factura
    where factura.id_factura = detalle_factura.id_factura
      and factura.id_propietario = public.fn_propietario_actual()
  ));

create policy pago_select_portal on public.pago
  for select to authenticated
  using (exists (
    select 1 from public.factura
    where factura.id_factura = pago.id_factura
      and factura.id_propietario = public.fn_propietario_actual()
  ));

create view public.v_carnet_portal as
  select v.id_paciente, v.id_vacunacion, p.nombre as producto, v.fecha_aplicacion, v.dosis,
         case when p.intervalo_dias is not null
           then (v.fecha_aplicacion + p.intervalo_dias * interval '1 day')::date
         end as proxima_fecha
  from public.vacunacion v
  join public.producto p on p.id_producto = v.id_producto
  join public.paciente pa on pa.id_paciente = v.id_paciente
  where pa.id_propietario = public.fn_propietario_actual();

grant select on public.v_carnet_portal to authenticated;
grant select, update on public.propietario to service_role;
```

`v_carnet_portal` es la única vista del proyecto que **no** lleva
`security_invoker = on`: si lo llevara, la RLS de `vacunacion` (exclusiva de
Veterinario) le devolvería siempre vacío a un propietario; en su lugar corre
con los privilegios de su creador y se autoacota con la condición `where`.

## 16. `seed.sql` — datos iniciales (DML)

Se ejecuta con `supabase db reset`, después de las 14 migraciones. Tres
secciones:

### 16.1. Catálogos base (aplican también a un proyecto alojado)

```sql
insert into public.rol (codigo, nombre, descripcion) values
  ('recepcionista', 'Recepcionista', 'Atiende al publico, gestiona pacientes, propietarios, agenda y facturacion'),
  ('veterinario',   'Veterinario',   'Realiza y registra la atencion clinica'),
  ('administrador', 'Administrador', 'Controla el inventario y evalua los resultados economicos');

insert into public.especie (nombre) values
  ('Canino'), ('Felino'), ('Ave'), ('Conejo'), ('Roedor'), ('Reptil'), ('Otro');

insert into public.raza (id_especie, nombre)
select e.id_especie, r.nombre
from public.especie e
join (values
  ('Canino','Mestizo'), ('Canino','Labrador Retriever'), ('Canino','Pastor Alemán'),
  ('Canino','Poodle'), ('Canino','Bulldog Francés'), ('Canino','Chihuahua'),
  ('Canino','Golden Retriever'), ('Canino','Schnauzer'), ('Canino','Beagle'),
  ('Felino','Mestizo'), ('Felino','Siamés'), ('Felino','Persa'),
  ('Felino','Angora'), ('Felino','Maine Coon'), ('Felino','Bengalí'),
  ('Ave','Canario'), ('Ave','Periquito'), ('Ave','Loro'), ('Ave','Cacatúa'),
  ('Conejo','Mestizo'), ('Conejo','Holandés'), ('Conejo','Cabeza de León'),
  ('Roedor','Hámster'), ('Roedor','Cuy'), ('Roedor','Chinchilla'),
  ('Reptil','Tortuga'), ('Reptil','Iguana')
) as r (especie, nombre) on r.especie = e.nombre;
```

### 16.2. Usuarios de demostración (solo entorno local)

Inserta directamente en `auth.users`/`auth.identities` (cuatro cuentas, con
`crypt('VetCare#2026', gen_salt('bf'))`) y en `public.usuario` (solo las tres
de personal; la cuarta, `propietario@vetcare.local`, se vincula más adelante
vía `propietario.id_usuario_portal`):

| Correo | Rol / identidad |
|---|---|
| `recepcion@vetcare.local` | `recepcionista` |
| `veterinario@vetcare.local` | `veterinario` |
| `admin@vetcare.local` | `administrador` |
| `propietario@vetcare.local` | portal (vinculada a María Fernanda Chávez Rodríguez) |

### 16.3. Datos de negocio de demostración (solo entorno local)

Insertados con SQL directo (sin pasar por `fn_emitir_factura` ni por la API
REST, porque el bloque corre sin sesión de `auth.uid()`), pero completando a
mano exactamente los mismos campos que la aplicación completa por
`default`/trigger (nunca los inventa un valor arbitrario):

- **8 propietarios** con identificación ecuatoriana ficticia de 10 dígitos.
- **12 pacientes**, con dos sin `fecha_nacimiento` (edad desconocida, RF-010).
- **12 productos** de catálogo (5 medicamentos, 4 insumos, 3 vacunas) e
  ingresos iniciales de existencia (`movimiento_inventario` tipo `ingreso`,
  25 días antes de la fecha de siembra) más 2 ajustes.
- **9 citas**: 5 atendidas, 3 programadas, 1 cancelada.
- **7 consultas**, 5 vinculadas a su cita (RF-017) y 2 sin cita previa.
- **5 vacunaciones** (2 dentro de una consulta, 3 independientes — estas
  últimas dejan el stock de "Vacuna Triple felina" en 5, por debajo de su
  nivel mínimo de 6, para poder probar la alerta RF-026).
- **9 movimientos de consumo manual** (RF-023) sobre 4 consultas.
- **4 exámenes de laboratorio**, 2 completados y 2 pendientes de resultado.
- **6 facturas**: una pagada de una vez, una con pago parcial, una pagada con
  tarjeta, una pendiente, una pagada en dos cobros (RF-030) y una de
  servicios sueltos sin atención asociada (sin catálogo de servicios en el
  esquema, se registra como línea de texto libre).

Ejemplo representativo de una factura con pago mixto (F5, pagada en dos
cobros):

```sql
insert into public.factura (id_propietario, id_consulta, fecha_emision, id_usuario_emisor)
  values (v_p7, v_q6, '2026-08-14 16:30:00-05', v_recepcion) returning id_factura into v_f5;
insert into public.detalle_factura (id_factura, numero_linea, id_producto, descripcion, cantidad, precio_unitario) values
  (v_f5, 1, (select id_producto from public.producto where codigo = 'MED-001'), 'Amoxicilina 500mg', 1, 8.50),
  (v_f5, 2, (select id_producto from public.producto where codigo = 'INS-003'), 'Gasa estéril', 2, 1.10),
  (v_f5, 3, (select id_producto from public.producto where codigo = 'INS-001'), 'Jeringa 5ml', 1, 0.35);
update public.factura set impuesto = round(subtotal * 0.15, 2) where id_factura = v_f5;
insert into public.pago (id_factura, fecha_pago, monto, forma_pago, id_usuario) values
  (v_f5, '2026-08-14 16:35:00-05', 7.00, 'efectivo', v_recepcion),
  (v_f5, '2026-08-16 09:00:00-05', (select total - 7.00 from public.factura where id_factura = v_f5), 'transferencia', v_recepcion);
```

No hay `DELETE` en `seed.sql`: es un script de carga de un entorno recién
recreado, no de mantenimiento sobre datos existentes.

## 17. Objetos por tipo — inventario consolidado

| Tipo de objeto | Cantidad | Nombres |
|---|---|---|
| Tablas | 18 | `rol`, `usuario`, `especie`, `raza`, `propietario`, `paciente`, `producto`, `cita`, `consulta`, `vacunacion`, `examen_laboratorio`, `movimiento_inventario`, `factura`, `detalle_factura`, `pago`, `bitacora_auditoria`, `parametro_sistema`, `lista_espera`, `proveedor`, `orden_compra`, `detalle_orden_compra` (21 en total, contando las tres del Módulo 7) |
| Vistas | 6 | `v_historial_clinico`, `v_estado_factura`, `v_alerta_stock`, `v_vacunas_proximas`, `v_lotes_por_vencer`, `v_carnet_portal` |
| Funciones | 12 | `fn_calcular_fin_cita`, `fn_actualizar_existencia`, `fn_validar_producto_vacuna`, `fn_vacunacion_descuenta_inventario`, `fn_actualizar_subtotal_factura`, `fn_rol_actual`, `fn_asignar_numero_factura`, `fn_conceptos_facturables`, `fn_emitir_factura`, `fn_atenciones_facturables`, `fn_proteger_ultimo_administrador`, `fn_auditar_cambio`, `fn_recibir_orden_compra`, `fn_crear_orden_compra`, `fn_propietario_actual` (15 en total) |
| Triggers | 12 | `trg_calcular_fin_cita`, `trg_actualizar_existencia`, `trg_vacunacion_valida_tipo`, `trg_vacunacion_descuenta`, `trg_totales_factura`, `trg_numero_factura`, `trg_proteger_ultimo_administrador`, `trg_auditar_usuario`, `trg_auditar_rol`, `trg_auditar_especie`, `trg_auditar_raza`, `trg_auditar_parametro`, `trg_recibir_orden_compra` (13 en total) |
| Secuencias | 1 | `seq_factura_numero` (más las secuencias implícitas de cada columna `generated always as identity`) |
| Extensiones | 2 | `pgcrypto`, `btree_gist` |
| Políticas RLS | ~50 | una por combinación de tabla/operación/rol, documentadas en las secciones 4, 9, 13, 14 y 15 |

No hay tipos personalizados (`create type`) ni procedimientos (`create
procedure`, distintos de función): todas las rutinas del proyecto son
funciones (`create function`), coherente con que se invocan como `select`
(`stable`) o `rpc` desde PostgREST, que no soporta procedimientos.
