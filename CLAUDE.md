# CLAUDE.md — VetCare, memoria viva del proyecto

Este documento es la fuente principal de contexto técnico y funcional del proyecto para
cualquier persona (o IA) que retome el trabajo. El código se mantiene con pocos comentarios
a propósito: lo que no está explicado por nombres claros y estructura, está explicado aquí.
**Actualízalo cada vez que se implemente, cambie o se descubra algo relevante.**

## 1. Qué es VetCare

Sistema de gestión para una clínica veterinaria de pequeña/mediana escala. Reemplaza hojas de
cálculo y agendas físicas con un sistema web centralizado. Cinco módulos cerrados de alcance:

1. **Pacientes y Propietarios** — fichas de mascotas y dueños.
2. **Agenda y Citas** — programación con verificación de disponibilidad.
3. **Historial Clínico** — consultas, vacunas, exámenes (uso exclusivo del Veterinario).
4. **Inventario y Medicamentos** — stock con descuento automático y alertas.
5. **Facturación y Reportes** — comprobantes, cobros, reporte de ingresos.

Tres roles de personal interno: **Recepcionista**, **Veterinario**, **Administrador**. El
propietario de la mascota **no** es usuario del sistema.

Además de los cinco, existe un **Módulo 6 — Administración del sistema** (`/administracion`,
exclusivo de Administrador) que **amplía deliberadamente** el alcance cerrado por RES-05: cubre
gestión de cuentas de usuario, roles, catálogos de especie/raza, parámetros de negocio y
auditoría — funciones que la sección "Fuera del alcance" del SRS excluye explícitamente
("gestión de... administración de cuentas de usuario") y que D-03 asume que ocurren fuera de la
aplicación. Se implementó por instrucción explícita del cliente del proyecto, no por
reinterpretación propia del SRS. Detalle completo en la sección 13.

El rediseño visual "Organic" (sección 14) amplió el alcance dos veces más, también por
instrucción explícita del cliente: **Módulo 7 — Compras y Proveedores** (`/compras`,
exclusivo de Administrador) y **Módulo 8 — Portal del propietario** (`/portal/*`, identidad
y autenticación completamente separadas de personal — el propietario de la mascota sigue sin
ser "usuario del sistema" en el sentido de la matriz 3.8 del SRS, pero ahora tiene una cuenta
propia con acceso de solo lectura a sus mascotas/citas/facturas). Ambos amplían líneas
explícitas de "Fuera del alcance" (compras y proveedores; portal de autoservicio) — detalle
completo, incluida la numeración RF/RN/RI nueva, en la sección 14. La Agenda y Citas (Módulo
2) también ganó una **Lista de espera** (RF-034/RF-035), una ampliación menor que no
contradice ningún punto de "Fuera del alcance".

Fuente de verdad de requisitos: [`ARTEFACTOS VETCARE/1_ ESPECIFICACIÓN DE REQUISITOS/Especificación de Requisitos de Software.pdf`](ARTEFACTOS%20VETCARE/1_%20ESPECIFICACIÓN%20DE%20REQUISITOS/Especificación%20de%20Requisitos%20de%20Software.pdf)
(RF-001 a RF-033, RNF-001 a RNF-024, RN-001 a RN-019). Fuente de verdad de base de datos:
[`ARTEFACTOS VETCARE/5_ MODELOS DE LA BD/VetCare_Diseno_Base_de_Datos.md`](ARTEFACTOS%20VETCARE/5_%20MODELOS%20DE%20LA%20BD/VetCare_Diseno_Base_de_Datos.md).

## 2. Decisión de artefacto contradictorio (documentada, no resuelta en silencio)

`TAREAS/DOCUMENTO DE ARQUITECTURA DE SOFTWARE - VETCARE.docx` (fuera de esta carpeta de
artefactos) es una versión **anterior y superada** del diseño arquitectónico. Contradice el
alcance final en varios puntos: usa numeración `RF-Mx-yy` distinta a la del SRS final
(`RF-0xx`), menciona un envío de recordatorios por correo electrónico y una gestión de
proveedores (`D6 Proveedores`) que el SRS final excluye explícitamente en la sección
"Fuera del alcance", y describe 8 almacenes de datos (D1–D8) donde el DFD final y el diseño de
BD final documentan 6 (D1–D6) y 15 tablas.

**Se ignora ese docx.** Se usa como fuente de arquitectura el SVG
`ARTEFACTOS VETCARE/4_ DISEÑO ARQUITECTÓNICO DEL SISTEMA/Arquitectura del sistema.svg`, que sí
es coherente con el SRS final y con el documento de diseño de BD final (arquitectura en capas:
Presentación / Lógica / Servicios / Datos, con Supabase exponiendo la API REST autogenerada).
El diseño de BD final ya documenta y resuelve, en su sección 9.3, la otra contradicción menor
(PostgreSQL vs. MySQL 8.0 mencionado en la hoja "Resumen de artefactos" del Excel de
planificación): se implementa en **PostgreSQL**, tal como exige RES-02 del SRS.

## 3. Arquitectura

Estilo centrado en datos (repositorio) a nivel de sistema + capas dentro de cada módulo:

```
Navegador (SPA React + MUI)
   │  HTTPS, JSON, token de sesión
   ▼
Supabase (BaaS)
   ├─ Auth (gestiona identidad y sesión; RES-03, RNF-003)
   ├─ PostgREST — API REST autogenerada sobre PostgreSQL (RI-007)
   ├─ Edge Functions — Deno, con la `service_role` key; solo para lo que PostgREST no puede
   │  hacer (tocar `auth.users`): `admin-usuarios` (Módulo 6), `portal-acceso` (Módulo 8).
   │  Cada una comprueba el rol de quien llama ella misma, porque al usar `service_role`
   │  se salta RLS por completo (detalle en secciones 13 y 14).
   └─ PostgreSQL — repositorio único, RLS por rol, triggers para reglas de negocio críticas
```

La lógica de negocio **crítica** (descuento de inventario, totales de factura, no-solapamiento
de citas, existencias nunca negativas) vive en la base de datos (funciones/triggers/CHECK/
EXCLUDE), no solo en el cliente: RNF-005, RNF-007, RNF-008 exigen que la integridad no dependa
de que la SPA "se porte bien". El control de acceso por rol (RF-002, RNF-002) se aplica con
Row Level Security en PostgreSQL, no solo ocultando botones en React.

No hay backend propio: Supabase **es** la capa de servicios y de lógica/acceso a datos
(PostgREST + Postgres). El "backend" de este proyecto, en la práctica, es el conjunto de
migraciones SQL versionadas en `supabase/migrations/`.

## 4. Stack tecnológico (fuente: Excel de planificación, hoja "Plataforma de Desarrollo")

| Capa | Tecnología |
|---|---|
| Frontend | React + TypeScript (Vite) + Material UI, SPA (RES-01, RES-04) |
| Backend / BaaS | Supabase (Auth + PostgREST autogenerado) |
| Base de datos | PostgreSQL (RES-02), gestionada con Supabase CLI |
| Control de versiones | Git |

No se sustituyen estas tecnologías por preferencia personal, según instrucción explícita del
cliente del proyecto.

## 5. Estructura del repositorio

```
SISTEMA VETCARE/
├── ARTEFACTOS VETCARE/        # Artefactos de diseño (solo lectura, fuente de verdad)
├── CLAUDE.md                  # Este documento
├── REDISENO-ORGANIC-PLAN.md   # Plan del rediseño Organic (sección 14); fases pendientes
├── supabase/                  # Proyecto Supabase CLI
│   ├── config.toml
│   ├── migrations/            # Esquema versionado, aplicado con `supabase db reset`/`push`
│   ├── functions/             # Edge Functions: admin-usuarios, portal-acceso (sección 3)
│   └── seed.sql                # Catálogos iniciales + usuarios de prueba (solo entorno local)
└── frontend/                  # SPA React + Vite + TypeScript + MUI
    └── src/
        ├── lib/                # Cliente Supabase, helpers
        ├── auth/               # Sesión, login, rutas protegidas (personal)
        ├── portal/             # Auth y páginas del Portal del propietario (Módulo 8) —
        │                       # árbol aparte de auth/, no una extensión (sección 14)
        ├── layout/             # Layout con navegación por rol
        └── modules/            # Un subdirectorio por módulo funcional (1:1 con la ERS
                                 # para los Módulos 1-5; 6-8 amplían el alcance, sección 1)
```

## 6. Base de datos

15 tablas normalizadas (1NF–3NF), sin borrado físico en ninguna (RF-033): las bajas y
cancelaciones son cambios de estado. Detalle completo, con justificación de cada decisión de
diseño, en `VetCare_Diseno_Base_de_Datos.md`. Resumen de reglas activas implementadas como
triggers (todas en `supabase/migrations/..._business_rules.sql`):

| Trigger / función | Qué garantiza |
|---|---|
| `fn_actualizar_existencia` | `producto.existencia_actual` nunca queda desincronizada del histórico de movimientos; rechaza existencias negativas con mensaje comprensible (RNF-008, RNF-014). |
| `fn_validar_producto_vacuna` | RN-019: solo productos tipo `vacuna` pueden usarse en una vacunación. |
| `fn_vacunacion_descuenta_inventario` | RF-024/RN-008: aplicar una vacuna genera automáticamente su movimiento de consumo, en la misma transacción. |
| `fn_actualizar_subtotal_factura` | RNF-007: `factura.subtotal` sigue siempre a sus líneas; `factura.total` es una columna generada (`subtotal + impuesto`), no depende de un trigger para mantenerse consistente. |
| `EXCLUDE` en `cita` | RN-004/RNF-008: un veterinario no puede tener dos citas no canceladas que se solapen (constraint declarativo con `btree_gist`, no un chequeo en la aplicación). |
| `fn_asignar_numero_factura` | RF-029/RN-016: numera cada factura desde una secuencia (`F-00000001`), sobrescribiendo siempre lo que mande el cliente. |

**Decisión propia (no está en el documento de diseño):** el documento describe `factura.total`
como columna mantenida por trigger; se implementó como columna **generada**
(`GENERATED ALWAYS AS (subtotal + impuesto) STORED`) porque es funcionalmente equivalente,
más simple, y se mantiene consistente también cuando se edita `impuesto` sin tocar las líneas
(un trigger sobre `detalle_factura` no cubriría ese caso).

**Funciones `SECURITY DEFINER`:** los triggers que escriben en una tabla que el rol invocador
no tiene permiso de modificar directamente bajo RLS (p. ej. un Veterinario disparando una
actualización de `producto.existencia_actual`, que solo el Administrador puede tocar
directamente) están marcados `SECURITY DEFINER` con `search_path` fijado. Es el patrón estándar
de Supabase para que un trigger "cruce" el límite de RLS de forma controlada y auditable.

Vistas (no se almacenan como tablas porque son siempre derivables de datos que ya existen):
`v_historial_clinico` (RF-020), `v_estado_factura` (RF-031), `v_alerta_stock` (RF-026). Las
tres tienen `security_invoker = on`: sin eso, PostgreSQL las ejecutaría con los privilegios del
propietario de la vista y se saltarían el RLS de las tablas base.

**GRANT además de RLS:** RLS por sí solo no basta. `authenticated` necesita el privilegio SQL
base (`GRANT SELECT/INSERT/UPDATE ... TO authenticated`, sin `DELETE` en ningún lado) antes de
que una política pueda aplicarse; sin el GRANT, PostgREST devuelve "permission denied" aunque
la política lo permitiría. Está al principio de `..._row_level_security.sql`. Cualquier tabla
nueva que se agregue en una migración futura necesita su propio GRANT explícito.

**Facturación: por qué hay funciones RPC y no solo tablas** (`..._facturacion.sql`). Tres cosas
que las migraciones anteriores no podían resolver:

- **`fn_emitir_factura(...)` — atomicidad.** PostgREST no ofrece transacciones que abarquen
  varias peticiones, y emitir una factura son N inserciones (cabecera + líneas) que RES-07/
  RNF-005 exigen que se completen todas o ninguna. Hacerlo desde la SPA dejaría cabeceras sin
  líneas ante cualquier fallo a mitad de camino. Verificado: una línea inválida no deja
  cabecera huérfana. La función es `SECURITY DEFINER`, así que **comprueba el rol ella misma**
  (`fn_rol_actual() = 'recepcionista'`) — sin eso, saltarse RLS significaría que cualquier
  usuario autenticado podría facturar.
- **`fn_conceptos_facturables(id_consulta)` — RF-028 choca de frente con RN-006.** Quien factura
  es el Recepcionista, pero RN-006 le niega toda lectura sobre `consulta`, `vacunacion` y
  `movimiento_inventario`: el rol que emite la factura literalmente no puede ver qué se consumió
  en la atención que va a cobrar. Esta función `SECURITY DEFINER` cruza ese límite de forma
  acotada — devuelve **solo producto, cantidad y precio**, nunca motivo, diagnóstico, hallazgos
  ni tratamiento. Verificado que RN-006 sigue intacto por lo demás: un `SELECT` directo de
  Recepción sobre `consulta` sigue devolviendo `[]`. Recoge tanto los consumos manuales
  (RF-023, con `id_consulta`) como los automáticos por vacuna (RF-024, que solo llevan
  `id_vacunacion` y se enlazan a la consulta a través de `vacunacion.id_consulta`).
- **`seq_factura_numero` — RN-016 pide "no reutilizable", no "sin huecos".** Se numera con una
  secuencia y no con un `max(numero) + 1` porque `nextval` no se revierte cuando la transacción
  falla: eso es justamente lo que hace que un número no se reutilice, y además evita la
  condición de carrera entre dos recepcionistas facturando a la vez. **Consecuencia esperada,
  no un bug: la numeración salta huecos** (un intento fallido consume su número). Si el cliente
  exigiera una serie sin huecos, habría que renegociar RN-016 — no es un detalle de
  implementación que se pueda "arreglar" sin perder la garantía.

**RN-014 se resuelve en el servidor, no en el formulario:** cuando una línea trae `id_producto`,
`fn_emitir_factura` toma el `precio_unitario` del catálogo **en el momento de emitir** y nunca
el que mande el cliente; queda copiado en la línea, así que revalorizar el producto después no
altera la factura ya emitida (verificado: producto a 99.00 y factura previa intacta en 1.50).
Para las líneas de servicio (sin `id_producto`) el precio sí viene del formulario, que es lo que
describe S-03.

**No hay catálogo de servicios, y es deliberado.** RF-028 habla de "los servicios prestados",
pero el diseño de BD final no tiene tabla `servicio`: `detalle_factura` admite `id_producto`
nulo con `descripcion` y `precio_unitario` libres. Agregar una tabla sería ampliar un esquema ya
aprobado (RES-05), así que un servicio se factura como línea de texto con su precio. **Si el
cliente pide un catálogo de servicios con precios fijos, es un cambio de alcance, no una tarea
pendiente.**

**El porcentaje de impuesto es un parámetro de la llamada (`p_porcentaje_impuesto`), no un valor
fijo en la base:** el SRS exige registrar el impuesto (RF-028) pero no fija ninguna tasa. Queda
como valor a definir con el cliente, junto a los TBD de RNF-016/018/019.

**`paciente.id_raza` y el embed de PostgREST:** es una FK **compuesta** `(id_raza, id_especie)
→ raza`. PostgREST no puede resolver automáticamente un embed sobre una FK compuesta a partir
del nombre de columna; hay que indicar el nombre de la restricción explícitamente:
`raza:raza!paciente_id_raza_id_especie_fkey(*)` (ver `frontend/src/modules/pacientes/api.ts`).

**Filtros sobre un embed sin `!inner`:** si se filtra por un campo de una tabla embebida (por
ejemplo, buscar pacientes por nombre de su propietario) sin agregar `!inner` al embed,
PostgREST **no** filtra las filas del padre: solo pone el embed en `null` cuando no coincide.
Eso dejaba pasar pacientes con `propietario: null` al frontend y lo hacía fallar al leer
`propietario.nombres`. Cualquier filtro sobre un embed en este proyecto debe usar
`!inner` (ver `buscarFichas` en `api.ts`).

**`cita.fecha_hora_fin` es una columna materializada, nunca un dato que envíe el cliente:**
`timestamptz + interval` no es `IMMUTABLE` en PostgreSQL, así que no puede usarse dentro de la
expresión del `EXCLUDE` de solapamiento (RN-004). En su lugar, un trigger `BEFORE INSERT OR
UPDATE` (`fn_calcular_fin_cita`) la calcula siempre a partir de `fecha_hora_inicio +
duracion_minutos` y sobrescribe cualquier valor recibido. `frontend/src/modules/agenda/api.ts`
nunca la incluye en un `insert`/`update`; solo la lee de vuelta para pintar el bloque en el
grid y para calcular disponibilidad (`disponibilidad.ts`) — evita que el cliente tenga que
recalcularla y que pueda desincronizarse de cómo la calcula la base.

## 7. Roles y permisos

Matriz completa en la sección 3.8 del SRS. Implementada como Row Level Security en
`supabase/migrations/..._row_level_security.sql`, usando `fn_rol_actual()` (lee el rol del
usuario autenticado vía `auth.uid()`). **No hay políticas `DELETE` en ninguna tabla**: RF-033
prohíbe la eliminación definitiva.

| Rol (código) | Acceso |
|---|---|
| `recepcionista` | Módulo 1 (lee y escribe), Módulo 2 (lee y escribe), Módulo 5 (lee y escribe) |
| `veterinario` | Módulo 1 (solo lee), Módulo 2 (solo lee), Módulo 3 (lee y escribe, exclusivo), Módulo 4 (consumo) |
| `administrador` | Módulo 4 (catálogo/ingresos), Módulo 5 (solo lee + reporte) |

La gestión de cuentas de usuario está **fuera del alcance** (SRS, "Fuera del alcance"; D-03).
No existe pantalla de registro/alta de usuarios en la SPA. Un usuario nuevo se da de alta así:

```bash
# 1. Crear el usuario de autenticación (API admin de GoTrue, requiere service_role key)
curl -X POST "$SUPABASE_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"nombre@vetcare.local","password":"...","email_confirm":true}'

# 2. Vincular el id devuelto a un rol en public.usuario (con la service_role key, que
#    bypassa RLS; o desde el SQL editor / psql conectado directamente)
insert into public.usuario (id_usuario, id_rol, nombres, apellidos, correo)
values ('<uuid-devuelto>', <id_rol>, 'Nombre', 'Apellido', 'nombre@vetcare.local');
```

## 8. Supabase CLI — comandos importantes

Todo cambio de base de datos se gestiona con migraciones versionadas, nunca a mano en el panel.

```bash
cd supabase
npx supabase start                       # levanta Postgres/Auth/PostgREST/Studio locales (Docker)
npx supabase status                      # URLs y claves del entorno local
npx supabase migration new <nombre>      # nueva migración con timestamp
npx supabase db reset                    # recrea la BD local desde cero + aplica seed.sql
npx supabase db push                     # aplica migraciones pendientes a un proyecto remoto vinculado
npx supabase link --project-ref <ref>    # vincula este repo a un proyecto Supabase alojado
npx supabase gen types typescript --local > ../frontend/src/types/database.ts
```

Studio local (inspección visual de la BD durante el desarrollo, no para cambios de estructura):
la URL exacta la imprime `supabase status`.

## 9. Estado del proyecto

### Implementado y funcionando
- **Base de datos completa**: 15 tablas, triggers, vistas, RLS, `EXCLUDE` de solapamiento de
  citas — migradas y verificadas sin errores en el entorno local (`supabase db reset` limpio).
- **Control de acceso (RF-001, RF-002, RF-003, RNF-002)**: login con Supabase Auth, sesión y rol
  cargados desde `usuario`/`rol`, navegación filtrada por rol, y verificado que el rol se exige
  también en el servidor (probado con `curl`: un Veterinario autenticado que intenta `PATCH` un
  `paciente` recibe `[]` — 0 filas — aunque tenga el `GRANT`; el bloqueo es de RLS).
- **Módulo 1 — Pacientes y Propietarios (RF-004 a RF-010), completo de extremo a extremo**:
  registrar propietario nuevo o reutilizar uno existente durante el alta del paciente (RF-004,
  RF-005), especie obligatoria / raza opcional filtrada por especie (RF-006, RN-003), buscar
  ficha por nombre de mascota, cédula o nombre del propietario (RF-007), editar propietario y
  paciente por separado sin perder el vínculo (RF-008, RF-009), edad calculada a partir de la
  fecha de nacimiento o "Edad desconocida" si no se registró (RF-010). Probado en navegador con
  las cuentas `recepcionista` (lee y escribe) y `veterinario` (solo lee, sin botones de edición
  visibles y con el `UPDATE` real rechazado por RLS al forzarlo por API).
- **Módulo 2 — Agenda y Citas (RF-011 a RF-015), completo de extremo a extremo**: vista de
  agenda en grid (día × veterinario, navegación día a día, filtro de qué veterinarios se
  muestran como columnas — RF-013), registrar cita desde un hueco vacío del grid (prellena
  veterinario y hora) o desde el botón "Nueva cita" (RF-012), con verificación de
  disponibilidad en vivo que, cuando el horario elegido no está libre, sugiere los próximos
  huecos disponibles ese día (RF-011, `disponibilidad.ts`). Reprogramar cambia solo fecha/hora/
  duración, no reasigna veterinario (RF-014, no lo pide ningún RF); cancelar cambia `estado`,
  nunca borra (RF-015/RN-005). La verificación del cliente es solo retroalimentación
  inmediata: el `EXCLUDE` real de la base (RN-004) sigue siendo la garantía ante condiciones de
  carrera, y el mensaje ya estaba mapeado en `lib/errors.ts` (código `23P01`) desde antes de
  empezar este módulo. Probado en navegador con las tres cuentas: `recepcionista` crea/
  reprograma/cancela, ve el solapamiento rechazado tanto por el chequeo en vivo como por el
  `EXCLUDE` real, y las sugerencias de huecos libres son clicables; `veterinario` ve la agenda
  completa (todas las citas, no solo las propias, según la política RLS) pero sin ningún
  control de escritura visible — tampoco huecos "clicables" en el grid, aunque el `INSERT`/
  `UPDATE` forzado por API ya lo rechazaría RLS (`403` / `0` filas), para no ofrecer una
  interacción que de todas formas fallaría.
- **Módulo 4 — Inventario y Medicamentos (RF-021 a RF-027), completo de extremo a extremo**:
  registrar producto indicando tipo
  (medicamento/insumo/vacuna), unidad de medida, precio unitario y nivel mínimo (RF-021); no
  pide existencia inicial, esa se establece con un movimiento de tipo ingreso (coherente con que
  `existencia_actual` la mantiene siempre el trigger `fn_actualizar_existencia`, nunca un valor
  de formulario). Registrar ingresos y ajustes de existencia (RF-022): el formulario de ajuste
  nunca deja que el usuario escriba un signo — pide "Aumentar" o "Disminuir" más una cantidad
  siempre positiva, y convierte a `cantidad` firmada antes de enviar. Catálogo con existencia
  actual y situación frente al nivel mínimo (RF-025), banner y `Chip` de alerta cuando
  `existencia_actual <= nivel_minimo`, que se derivan en memoria del mismo array ya cargado (no
  de una consulta aparte a la vista `v_alerta_stock`) y desaparecen solos al reponer stock
  (RF-026). Histórico de movimientos por producto con responsable (RF-027), embebiendo
  `usuario:id_usuario(nombres,apellidos)`. Editar producto (incluida la reactivación/
  desactivación, coherente con "sin borrado físico") es exclusivo de Administrador; con el
  producto inactivo no se puede registrar movimiento. Probado en navegador con las tres cuentas:
  `administrador` crea producto, registra ingreso y ajuste (con el mensaje de "No hay existencia
  suficiente..." ya mapeado en `errors.ts` al forzar un ajuste mayor a lo disponible), edita y
  desactiva; `veterinario` ve el catálogo completo y el histórico (RF-025 es de solo consulta
  para ese rol) sin ningún control de escritura, y un `INSERT` forzado por API tanto contra
  `producto` como contra `movimiento_inventario` con `tipo_movimiento: 'ingreso'` es rechazado
  por RLS (403) — esta última prueba confirma además que la política de `movimiento_inventario`
  distingue por `tipo_movimiento`, no solo por tabla: Veterinario únicamente puede insertar
  `consumo`.
  **RF-023 (registrar consumo de productos en una atención)**: implementado ya fusionados los
  Módulos 3 y 4, que era la dependencia real que lo bloqueaba (todo `consumo` necesita un
  `id_consulta` o `id_vacunacion` real por el `CHECK chk_movimiento_origen`, RN-009, y no
  existía ninguna `consulta` hasta construir el Módulo 3). Vive en el Historial Clínico, no en
  la pantalla de Inventario, porque su rol es Veterinario y su origen obligatorio es una
  consulta: `RegistrarConsumoDialog.tsx` se abre solo desde una entrada de consulta del
  timeline, y reutiliza `registrarMovimiento()` de `modules/inventario/api.ts` con
  `tipo_movimiento: 'consumo'` (misma función que ingreso/ajuste — la RLS ya distingue por
  `tipo_movimiento`, no hacía falta un segundo camino en el cliente). Igual que el formulario de
  ajuste, el usuario nunca escribe un signo: se pide cantidad positiva y se envía negativa,
  porque `chk_movimiento_signo` exige `cantidad < 0` para un consumo. Los consumos ya
  registrados se listan dentro de su entrada de consulta ("Productos utilizados"), en positivo.
  **RF-024 (descuento automático por vacuna) sigue sin UI propia a propósito: es un trigger.**
  **Decisión propia, no una omisión:** el selector de productos del diálogo de consumo excluye
  los de tipo `vacuna` (`listarProductosConsumibles()` solo ofrece `medicamento` e `insumo`).
  RN-008 dice que aplicar una vacuna consume *siempre* una dosis, y ese descuento ya lo hace
  `fn_vacunacion_descuenta_inventario`; ofrecer las vacunas también aquí permitiría descontar
  dos veces la misma dosis —una por la vacunación, otra a mano— sin que ninguna restricción de
  la base pudiera detectarlo, porque **ambos movimientos son legítimos por separado**. La única
  vía para una vacuna es registrarla como vacunación. Por la misma razón,
  `listarConsumosPorConsulta()` filtra `id_consulta not is null`: el movimiento que crea el
  trigger de vacunación solo lleva `id_vacunacion`, así que queda fuera de "Productos
  utilizados" y se ve únicamente como su propia entrada de vacunación en el timeline (verificado
  en navegador: una vacuna aplicada dentro de la misma consulta aparece una sola vez).
  Verificado también por API que RLS y RN-009 se sostienen en el servidor: un Recepcionista que
  fuerza un `consumo` recibe `403` (`42501`), y un Veterinario que fuerza un `consumo` sin
  `id_consulta` ni `id_vacunacion` recibe `400` (`23514`, `chk_movimiento_origen`).
- **Módulo 3 — Historial Clínico (RF-016 a RF-020), completo de extremo a extremo**: registrar
  una consulta (motivo/diagnóstico obligatorios, hallazgos/tratamiento/peso opcionales, en una
  sola operación — RF-016), vincularla opcionalmente con la cita que la originó (RF-017; el
  selector solo ofrece citas no canceladas que todavía no tienen consulta, así que "una cita no
  origina más de una consulta" se cumple de forma proactiva en la UI, no solo por el `UNIQUE` de
  la base), aplicar una vacuna dentro de una consulta o de forma independiente (RF-018 — el
  descuento automático de inventario, RF-024, lo dispara el trigger ya existente, esta pantalla
  nunca lo toca), solicitar un examen de laboratorio y completar su resultado después sin crear
  un registro nuevo (RF-019, único `UPDATE` permitido sobre un registro clínico), e historial
  único y cronológico por paciente (RF-020, sobre `v_historial_clinico`). Exclusivo de
  Veterinario (RN-006) — a diferencia de los otros tres módulos, la página no tiene ningún
  condicional de permisos de escritura. Por el tamaño del contenido (una lista larga y
  heterogénea, no un registro compacto), este módulo se aparta a propósito del patrón "tabla +
  diálogo" de los otros tres: el timeline vive embebido en la propia página, no en un modal; los
  formularios de alta sí siguen siendo diálogos. Probado en navegador con las tres cuentas:
  `veterinario` registra una consulta vinculada a una cita real, aplica una vacuna dentro de esa
  consulta (confirmado el descuento automático de `producto.existencia_actual` vía `curl`),
  solicita un examen independiente y completa su resultado (confirmado que sigue siendo una
  sola fila, sin duplicar); `recepcionista`/`administrador` no ven `/historial` en el menú y un
  `INSERT` forzado por API contra `consulta` es rechazado por RLS (403).
  RF-023 se agregó después a esta misma página (ver Módulo 4). Tampoco `cita.estado` pasa a
  `'atendida'` automáticamente al crear una consulta —
  no existe ningún trigger para eso ni el Veterinario tiene permiso de `UPDATE` sobre `cita`
  bajo ninguna circunstancia (esa política exige `recepcionista`); es coherente con el diseño
  actual, no una omisión de este módulo.

### Flujo de ramas de este proyecto
Módulos 2, 3 y 4 se desarrollaron originalmente cada uno en su propia rama
(`modulo-2-agenda-citas`, `modulo-3-historial-clinico`, `modulo-4-inventario`), fusionadas
después a un `main` local en ese orden (por eso `types/dominio.ts` no tiene tipos duplicados:
cada rama evitó tocar los tipos que ya sabía que agregaría otra). Ese `main` fusionado **nunca
se subió a `origin/main`** — sigue exactamente donde estaba antes de empezar (`737207a` al
momento de escribir esto). En vez de eso, se creó una rama nueva, **`Desarrollo-DA`**, a partir
de ese `main` local ya fusionado, y esa sí se publicó en `origin`. Las tres ramas por módulo se
eliminaron después (local y remoto), ya fusionadas sin pérdida.

**`Desarrollo-DA` se fusionó a `main`** una vez completados los cinco módulos del alcance, por
decisión explícita del usuario. La fusión se hizo con `--no-ff` aunque era un avance directo
(`main` era ancestro de `Desarrollo-DA`, sin ninguna divergencia): un commit de fusión explícito
deja registrado *cuándo* se integró el alcance completo, igual que los commits "Fusiona Módulo
N" que ya existían en la historia. Con `--ff` esa información se habría perdido.

**Convención vigente de aquí en adelante:** se sigue trabajando en `Desarrollo-DA`, una sola
rama continua — no una rama nueva por módulo — y `main` solo avanza cuando el usuario pide
explícitamente una fusión. Confirmar siempre con `git status`/`git branch -vv` en qué rama se
está parado antes de empezar a trabajar o de hacer cualquier `push`, y preguntar al usuario el
nombre de destino antes de subir nada — no asumir que es `main`.

- **Módulo 5 — Facturación y Reportes (RF-028 a RF-032) + RI-005, completo de extremo a
  extremo**: emitir factura desde una atención registrada (los conceptos y sus precios los
  recupera el servidor, RF-028) o cobrando servicios sueltos a un propietario (RF-028/RN-012);
  numeración automática (RF-029); registrar uno o varios cobros por factura, con el saldo
  propuesto por defecto y la situación de cobro derivada por la base (RF-030/RN-015); consultar
  las facturas filtrando por período, propietario y situación de cobro, con su detalle y saldo
  (RF-031); reporte consolidado de ingresos por período, desglosado por forma de pago, exclusivo
  de Administrador (RF-032); e impresión/exportación del comprobante y del reporte (RI-005). El
  reparto de roles de la matriz 3.8 se refleja en la pantalla —Recepción emite y cobra,
  Administración reporta, ambos consultan— pero la garantía real es del servidor:
  `fn_emitir_factura` comprueba el rol ella misma y las políticas de `pago` solo admiten
  Recepción. Probado en navegador con las tres cuentas: `recepcionista` emite por las dos vías,
  cobra en dos veces (la factura pasa de "Pendiente" a "Pago parcial" y a "Pagada", y el botón
  de cobrar desaparece al quedar en cero) y filtra por propietario; `administrador` ve las
  facturas y el reporte (2 facturas, $17,25 en efectivo + $28,75 en transferencia = $46,00) pero
  no el botón de emitir; `veterinario` no ve el módulo en el menú.
  **RI-005 se resuelve con `window.print()` y una hoja `@media print`**, no con una librería de
  PDF: el propio diálogo del navegador ya ofrece "Guardar como PDF", lo que cubre "imprimir" y
  "exportar" sin una dependencia extra ni un segundo formato que mantener. Los controles que no
  deben salir en papel llevan `displayPrint: 'none'`. *Verificado que la hoja de impresión llega
  al navegador y que sus reglas e identificadores son los correctos; no se pudo renderizar una
  vista previa de impresión real en el entorno de prueba.*

  **El porcentaje de impuesto (`PORCENTAJE_IMPUESTO_POR_DEFECTO`, en
  `modules/facturacion/formato.ts`) es un valor inicial del formulario, no una decisión
  cerrada:** está en 15 (IVA vigente en Ecuador) y se puede cambiar en cada emisión. No se
  escribió en la base ni en el servidor a propósito — el SRS exige registrar el impuesto
  (RF-028) pero no fija ninguna tasa, así que sigue siendo un valor a definir con el cliente,
  como los TBD de RNF-016/018/019.

- **Módulo 5 — base de datos.** La migración
  `..._facturacion.sql` cubre lo que no puede vivir en el cliente (ver sección 6): numeración
  por secuencia (RF-029/RN-016), recuperación de conceptos de una atención sin romper RN-006
  (RF-028) y emisión transaccional (RES-07/RNF-005). Probado por API con las tres cuentas:
  Recepción recupera los conceptos de una consulta (el consumo manual y la vacuna, con sus
  precios) y emite la factura con IVA del 15% (subtotal 15.00, impuesto 2.25, total 17.25);
  facturar dos veces la misma atención da `409` (`23505`, RN-013); un Veterinario que intenta
  emitir recibe `403`; una atención inexistente, `23503`; una factura sin conceptos, un mensaje
  en español; y una línea inválida revierte la cabecera completa. También se emitió una factura
  de servicio libre sin atención asociada, a nombre del propietario.
- **Módulo 6 — Administración del sistema, completo de extremo a extremo (fuera del alcance
  original, ver sección 13 para el detalle completo)**: ciclo de vida de cuentas de usuario
  (crear, editar, activar/desactivar con bloqueo real en GoTrue, restablecer contraseña,
  reasignar rol), alta de roles, catálogo de especies/razas, parámetros de negocio configurables
  (impuesto por defecto, horario de atención) y bitácora de auditoría sobre esas mismas tablas.
  Probado de extremo a extremo por API (`curl` con JWT real de cada rol) y en navegador con la
  cuenta `administrador`: creación de cuenta, desactivación (login del usuario rechazado con
  `user_banned`), reactivación (login vuelve a funcionar), restablecimiento de contraseña (login
  con la contraseña nueva funciona), rechazo con 403 cuando `veterinario` intenta invocar la
  Edge Function, y rechazo de desactivar al único Administrador activo (mensaje de
  `fn_proteger_ultimo_administrador`). El impuesto por defecto de `NuevaFacturaDialog` ya lee este
  parámetro en vivo en vez de la constante hardcodeada.

### Pendiente
- **Rediseño visual "Organic" + ampliaciones de alcance — en curso, por fases.** Fases 0 a 5
  completadas (ver sección 14 y [`REDISENO-ORGANIC-PLAN.md`](REDISENO-ORGANIC-PLAN.md)); queda
  la Fase 6 (Dashboard). No commitear ni desplegar ninguna fase sin haberla verificado por
  separado — es la condición bajo la que el usuario aprobó el plan.
- Definir con el cliente el porcentaje de impuesto a aplicar. Ya no está hardcodeado: es el
  parámetro `impuesto_defecto_pct` en `parametro_sistema`, editable desde Administración >
  Parámetros (Módulo 6) y leído en vivo por `NuevaFacturaDialog`. Sigue siendo 15 como valor
  inicial — lo que falta es la decisión del cliente, no la mecánica para aplicarla.
- Vinculación a un proyecto Supabase alojado para despliegue (hoy el desarrollo es local vía
  Docker; ver sección 8).
- Definir con el cliente los valores TBD del SRS: RNF-016 (tiempo de respuesta objetivo),
  RNF-018 (disponibilidad comprometida), RNF-019 (política de respaldo).

### Problemas conocidos
- Ninguno abierto. (El bug real encontrado durante la verificación de Módulo 1 — un embed de
  PostgREST sin `!inner` que dejaba pasar `propietario: null` y rompía el render al buscar por
  nombre del propietario sin resultados — ya está corregido y documentado en la sección 6. Los
  bugs reales encontrados durante la verificación de Módulos 2, 3 y 6 se describen abajo, también
  corregidos.)
- (Corregido) **RF-031 y el RLS de `propietario` se contradecían.** RF-031 concede la consulta
  de facturas emitidas a Recepcionista *y* Administrador, pero la política de `propietario`
  (escrita con el Módulo 1) solo la daba a Recepcionista y Veterinario. Como el filtro por
  propietario obliga a un embed con `!inner`, a la cuenta de Administrador el listado le salía
  **completamente vacío** — no "sin nombre": vacío. Se detectó probando la pantalla con esa
  cuenta. Corrección en `..._propietario_facturado_para_administrador.sql`: una política
  adicional que le concede exactamente lo que RF-031 necesita —los propietarios que tienen al
  menos una factura emitida— y nada más. Verificado que un propietario registrado sin facturas
  le sigue siendo invisible, y que `paciente` sigue devolviéndole `[]`. Patrón a tener presente:
  un requisito de un módulo puede necesitar leer una tabla de otro módulo; ampliar el acceso con
  una política acotada por la condición del requisito es preferible tanto a abrir la tabla
  entera como a duplicar los datos.
- (Corregido) **La vía de "Cobrar servicios" nunca preguntaba a nombre de quién facturar.**
  Cuando la factura sale de una atención, `fn_emitir_factura` deriva el propietario de ella
  (RN-012) y el formulario no tiene por qué pedirlo; para servicios sueltos no hay atención de
  la que derivarlo, pero el diálogo enviaba `idPropietario: null` igualmente, así que la emisión
  siempre fallaba. Se agregó un selector de propietario a esa vía, reutilizando
  `PropietarioAutocomplete` del Módulo 1 (con el texto de "sin coincidencias" ahora configurable,
  porque aquí no hay ningún formulario de alta debajo al que remitir al usuario).
- (Corregido) **`src/index.css` no estaba importado en ninguna parte.** Existía desde el
  andamiaje inicial de Vite pero nunca llegaba al navegador; no se notaba porque `CssBaseline`
  de MUI ya cubría el reset que contenía. Al agregarle la hoja `@media print` de RI-005, esa
  hoja resultó igual de invisible: el botón de imprimir habría sacado la pantalla entera en vez
  del comprobante. Se detectó inspeccionando las reglas `@media print` realmente cargadas en el
  documento, no confiando en que el archivo existiera. Corregido con un `import './index.css'`
  en `main.tsx`.
- (Corregido) **Los mensajes de error de nuestras propias funciones SQL no llegaban al usuario.**
  `fn_emitir_factura` lanza `raise exception` con mensajes ya redactados en español ("Debe
  indicarse el propietario o la atención a facturar"), pero PostgreSQL les asigna el código
  genérico `P0001` y `lib/errors.ts` no lo contemplaba: caían en el `default` y se mostraba
  "No se pudo completar la operación. Verifica los datos e intenta nuevamente" — inútil para
  saber qué corregir, en contra de RNF-014. Se agregó el caso `P0001`, que muestra el mensaje
  tal cual. Cualquier función nueva que lance `raise exception` debe escribir su mensaje pensando
  en que el usuario lo va a leer literalmente.
- (Corregido) **`useDisponibilidadCita` no volvía a consultar la agenda al cerrar y reabrir el
  diálogo de "Nueva cita" para el mismo veterinario y el mismo día.** El efecto que recarga las
  citas dependía de `[idVeterinario, fecha]`; si esos dos valores no cambiaban entre una
  apertura del diálogo y la siguiente, React no volvía a ejecutar el efecto aunque el diálogo se
  hubiera cerrado y abierto de nuevo — el chequeo de disponibilidad seguía usando los datos de
  la primera apertura, incluso después de haber creado otra cita para ese mismo veterinario en
  el ínterin (se detectó creando dos citas seguidas para el mismo veterinario/día: la segunda
  verificación no veía la primera cita recién creada). Se agregó un parámetro `activo` (en
  `true` solo mientras el diálogo está realmente abierto, o mientras se está reprogramando) al
  arreglo de dependencias del efecto, para forzar una recarga en cada apertura sin importar si
  veterinario/fecha repiten el mismo valor que la vez anterior. Patrón a tener presente para
  cualquier hook futuro de "chequeo en vivo dentro de un diálogo que se abre y cierra
  repetidamente": las dependencias de un efecto de recarga deben incluir algo que cambie en
  cada apertura, no solo los valores del formulario.
- (Corregido) **Las fechas de vacunación/examen del timeline retrocedían un día en husos
  horarios detrás de UTC (América).** `vacunacion.fecha_aplicacion` y
  `examen_laboratorio.fecha_solicitud` son columnas `date`; `v_historial_clinico` las castea a
  `timestamptz` con medianoche UTC implícita (`"2026-08-18T00:00:00+00:00"`). Al formatear esa
  marca con `dayjs` sin más, la librería convierte a la hora local del navegador para mostrarla
  — en UTC-5 (Ecuador), medianoche UTC del 18 se ve como las 19:00 del **17**, así que el día
  calendario retrocedía uno. Se detectó probando en el navegador: una vacuna aplicada hoy
  aparecía fechada ayer. Corrección en
  `frontend/src/modules/historial/EventoHistorialItem.tsx`: para eventos que no son `consulta`
  (que sí trae una hora real en `fecha_hora`), se toman los primeros 10 caracteres de la marca
  (`"YYYY-MM-DD"`, sin offset) antes de pasarla a `dayjs` — así se interpreta como medianoche
  **local**, sin ninguna conversión de huso horario. Patrón a tener presente para cualquier
  columna `date` que se muestre a través de una vista que la castee a `timestamptz`: nunca
  formatear esa marca directamente con la hora local si el dato original no tenía hora real.
- (Corregido) **Un trigger genérico compartido entre tablas no puede acceder a `new.<campo>`
  salvo que la tabla que disparó el evento tenga ese campo — ni siquiera dentro de una rama de
  `CASE` que nunca se ejecuta.** `fn_auditar_cambio` (Módulo 6) está pegado como trigger a cinco
  tablas distintas (`usuario`, `rol`, `especie`, `raza`, `parametro_sistema`) para resolver el
  identificador de la fila auditada con un único `CASE tg_table_name WHEN 'usuario' THEN
  new.id_usuario::text WHEN 'parametro_sistema' THEN new.clave ... END`. Al sembrar
  `parametro_sistema`, la migración fallaba con `record "new" has no field "id_usuario"` — pese a
  que esa rama del `CASE` nunca debía ejecutarse para esa tabla. Postgres resuelve el acceso a un
  campo de un `RECORD` contra el tipo real de la fila *antes* de que el `CASE` elija la rama, así
  que cualquier `new.<campo>` que no exista en la tabla que disparó el evento revienta la
  expresión completa, tomada o no. Corregido resolviendo el identificador contra
  `to_jsonb(new) ->> 'campo'` en vez de `new.campo`: el acceso por clave sobre un objeto jsonb
  simplemente da `null` cuando la clave no existe, en vez de fallar. Patrón a tener presente para
  cualquier trigger genérico futuro compartido entre tablas con columnas distintas: nunca acceder
  a `new`/`old` por campo directo, siempre por `to_jsonb(...) ->> 'campo'`.
- (Corregido) **`service_role` ya no recibe privilegios automáticos sobre tablas nuevas.** La
  Edge Function `admin-usuarios` (Módulo 6) usa la `service_role` key para crear/activar/
  desactivar cuentas via PostgREST (`admin.from('usuario').insert(...)`). El primer intento real
  fallaba con `permission denied for table usuario` pese a que `service_role` bypassa RLS por
  completo: el privilegio SQL se comprueba antes que cualquier política, y esta versión del CLI
  ya no expone automáticamente las tablas nuevas a los roles de la Data API (`anon`,
  `authenticated`, `service_role`) sin un `GRANT` explícito — el propio `config.toml` lo describe
  como "matching the new cloud default". Corregido con
  `grant select, insert, update on public.usuario to service_role;` en la migración de
  Administración. Patrón a tener presente: **cualquier tabla nueva que una Edge Function vaya a
  tocar con la `service_role` key necesita su propio `GRANT` a `service_role`**, exactamente igual
  que las tablas que toca `authenticated` lo necesitan desde `..._row_level_security.sql` — no es
  algo que venga gratis por usar la clave de servicio.

## 10. Entorno local de desarrollo

```bash
# Backend (Supabase local vía Docker; ver seccion 8 para mas comandos)
cd supabase && npx supabase start

# Frontend
cd frontend && cp .env.local.example .env.local   # completar con `npx supabase status`
npm install
npm run dev
```

Cuentas de prueba sembradas por `supabase/seed.sql` (**solo entorno local**, nunca ejecutar ese
seed contra un proyecto con datos reales de la clínica):

| Correo | Contraseña | Rol |
|---|---|---|
| recepcion@vetcare.local | VetCare#2026 | recepcionista |
| veterinario@vetcare.local | VetCare#2026 | veterinario |
| admin@vetcare.local | VetCare#2026 | administrador |
| propietario@vetcare.local | VetCare#2026 | portal (Fase 5) — vinculada a María Fernanda Chávez Rodríguez, `/portal/ingresar` |

## 11. Nota sobre el stack de frontend instalado

Este proyecto instaló las versiones **más recientes disponibles** de React (19), MUI (9.3.1) y
TypeScript al iniciar el desarrollo, conforme a la instrucción de usar tecnología actual salvo
que el Excel de planificación indique una versión concreta (no la indica). Una particularidad
detectada de MUI 9.3.1 con este `tsconfig` (`moduleResolution: "bundler"`):

- **Los tipos de `Stack` y `Typography` no incluyen los props de atajo del sistema**
  (`alignItems`, `justifyContent`, `fontWeight`, `color`, etc. pasados directamente como prop).
  Esto no es un error nuestro ni de versión de TypeScript (se probó con TS 6.0.3 y 5.9.3, mismo
  resultado): los tipos publicados de esa versión de MUI genuinamente no los declaran, aunque el
  componente los sigue aceptando en tiempo de ejecución. **Convención de este proyecto:** pasar
  esos estilos dentro de `sx={{ ... }}` en vez de como props sueltas de `Stack`/`Typography`.
  Si en el futuro se actualiza `@mui/material` y el problema ya no aparece, no hace falta
  revertir el patrón — `sx` siempre funciona.
- `AutocompleteRenderInputParams` ya no expone `params.InputProps`; ahora es
  `params.slotProps.input` (ver `PropietarioAutocomplete.tsx`).

## 12. Convenciones de programación

- SQL: `snake_case`, tablas en singular, `id_<tabla>` como clave primaria — igual que el
  documento de diseño, sin desviaciones de nomenclatura.
- TypeScript/React: componentes en `PascalCase`, hooks en `camelCase` con prefijo `use`, un
  módulo funcional = un subdirectorio de `src/modules/`.
- Comentarios mínimos: solo cuando explican un *porqué* no evidente (una restricción del
  dominio, una decisión que se aparta del documento de diseño). No se documenta el *qué* línea
  por línea.
- Sin borrados físicos desde la aplicación en ningún módulo: todo "eliminar" del negocio es un
  cambio de estado (`activo = false`, `estado = 'cancelada'`, etc.).

## 13. Módulo 6 — Administración del sistema (fuera del alcance original del SRS)

**Por qué existe pese a RES-05/D-03.** El SRS cierra el alcance a cinco módulos y excluye
explícitamente, en su sección "Fuera del alcance", la "gestión de empleados... y administración
de cuentas de usuario"; D-03 asume que esa administración ocurre fuera de la aplicación. Este
módulo amplía ese alcance de forma deliberada, por instrucción explícita del cliente del
proyecto ("implementa las funcionalidades que debe tener un administrador del sistema, ya que
eso es necesario para que una aplicación pueda operar"), no por reinterpretación propia de los
requisitos. Antes de implementarlo se produjo un documento de análisis con 25 funcionalidades
candidatas agrupadas en 7 áreas (cuentas, roles, catálogos, auditoría, sesiones, notificaciones,
infraestructura), cada una marcada según su relación con el SRS. Este módulo implementa el
subconjunto que resultó **esencial o importante y técnicamente proporcionado** al tamaño del
proyecto: cuentas, roles (solo alta + consulta), catálogos de especie/raza, parámetros de
negocio y auditoría. Deliberadamente **no** implementa:

- **Editor de permisos por rol** (asignar/revocar qué puede hacer cada rol desde una pantalla).
  Los permisos de este proyecto están escritos como texto literal dentro de ~35 políticas RLS
  fijadas en migraciones versionadas (`fn_rol_actual() in (...)`) — es exactamente el diseño que
  la sección 6 describe como deliberado ("la lógica crítica vive en la base, no en el cliente").
  Convertir eso en editable requeriría pasar a un modelo de permisos dirigido por datos (tablas
  `permiso`/`rol_permiso` que cada política RLS consultara en cada fila) — un cambio de
  arquitectura del control de acceso completo, no una pantalla más. Por eso `RolesTab.tsx`
  permite dar de alta un rol nuevo pero advierte explícitamente que queda sin ningún permiso real
  hasta que una migración agregue políticas que lo mencionen.
- **Sesiones activas, notificaciones, respaldos y monitoreo.** Sesiones activas no es una
  operación simple de la API admin estándar de GoTrue; notificaciones más allá del banner de
  stock que ya cubre RF-026 no añaden nada nuevo; respaldos y monitoreo son responsabilidad de la
  plataforma (Supabase/Postgres, RNF-019 ya los declara TBD del cliente), no de la SPA — construir
  un panel propio duplicaría Supabase Studio, que ya lo hace gratis, y contradice RES-06 (equipo
  reducido, alcance cerrado).

**Cuentas de usuario (`frontend/src/modules/administracion/`, tablas `usuario`/`rol`
existentes).** Tres de las cinco operaciones del ciclo de vida (crear, activar/desactivar,
restablecer contraseña) tocan `auth.users`, fuera del esquema que expone la API de datos
(RI-007) — no se puede hacer con un `insert`/`update` normal de PostgREST. Se resuelven con la
Edge Function `supabase/functions/admin-usuarios/index.ts`, que usa la `service_role` key
(nunca expuesta al navegador) y **comprueba ella misma que quien llama es un Administrador
activo** antes de hacer nada — mismo patrón que `fn_emitir_factura` (sección 6): una función con
privilegios elevados no puede confiar en que RLS ya filtró la llamada, porque ella misma se
salta RLS. Editar nombres/apellidos/rol de una cuenta existente, en cambio, sí es un `update`
normal (política `usuario_update`, exclusiva de Administrador) porque no toca `auth.users`.

- **Activar/desactivar es doble, a propósito.** `fn_rol_actual()` (sección 7) ahora exige
  `u.activo` además del rol — con eso, desactivar a alguien le corta el acceso a *todas* las
  políticas RLS del sistema con un solo cambio, sin tocar las ~35 políticas una por una. Pero eso
  no impide que un JWT ya emitido siga siendo válido hasta que expire, ni bloquea el inicio de
  sesión. Por eso la Edge Function hace ambas cosas en la misma llamada: pone
  `usuario.activo = false` **y** banea la cuenta en GoTrue (`ban_duration: '876000h'`) — verificado
  que tras desactivar, un intento de login devuelve `user_banned` de inmediato.
- **`fn_proteger_ultimo_administrador`** (trigger `BEFORE UPDATE` en `usuario`) rechaza
  desactivar o reasignar el rol del único Administrador activo — eco de D-03 ("el sistema
  depende de que exista al menos un Administrador"). Se dispara tanto si se llama desde la Edge
  Function (con la `service_role` key, que bypassa RLS pero no triggers) como desde un `update`
  normal vía `EditarUsuarioDialog`.
- **Restablecer contraseña es la única de las cinco que no tensiona RNF-003/RES-03**: sigue
  delegando la verificación de credenciales en el servicio de autenticación de la plataforma,
  solo que el cambio lo dispara un Administrador en vez del propio usuario.

**Catálogos y parámetros.** `especie`/`raza` ya existían (Módulo 1); solo les faltaban políticas
`INSERT`/`UPDATE` para Administrador — es la funcionalidad de este módulo más alineada con lo ya
aprobado, porque RNF-024 ya exigía poder "incorporar nuevas especies, razas y productos sin
modificar la estructura de la base de datos" y hasta ahora eso solo era cierto a nivel de
esquema, nunca desde la aplicación. `parametro_sistema` es una tabla nueva, clave/valor, que saca
de hardcodeado el impuesto por defecto de una factura (`impuesto_defecto_pct`, leído en vivo por
`NuevaFacturaDialog` vía `obtenerPorcentajeImpuestoActual()` en `modules/facturacion/api.ts`, con
la constante original como respaldo si el parámetro no existiera) y el horario de atención
(`horario_atencion_inicio`/`_fin`, todavía no conectado a `disponibilidad.ts` — queda almacenado
y editable, listo para conectarse sin volver a tocar el esquema, pero se dejó fuera de esta
iteración para no ampliar más el radio de cambio).

**Auditoría (`bitacora_auditoria`, distinta de RF-003/RNF-009).** RF-003 ya audita
*operaciones* clínicas, de inventario y financieras; esto audita *cambios administrativos*
—cuentas, roles, catálogos, parámetros— que antes no dejaban ningún rastro. Un único trigger
genérico (`fn_auditar_cambio`) está pegado a las cinco tablas administrativas. Ver la sección 9
("Problemas conocidos") por el detalle de dos bugs reales encontrados al construir esto: el
acceso a `new.<campo>` en un trigger compartido entre tablas con columnas distintas, y el `GRANT`
que `service_role` ya no recibe automáticamente en versiones recientes del CLI.

**Probado:** por API con `curl` y un JWT real de cada rol — creación de cuenta, desactivación
(login rechazado con `user_banned`), reactivación, restablecimiento de contraseña, rechazo 403 de
`veterinario` invocando la Edge Function, rechazo de desactivar al único Administrador activo,
RLS de `especie`/`parametro_sistema` (Administrador puede, Veterinario no), y bitácora
registrando cada uno de esos cambios con el identificador correcto según la tabla. También en
navegador con la cuenta `administrador`: las cinco pestañas cargan datos reales sin errores de
consola.

## 14. Rediseño visual «Organic» y ampliaciones de alcance (en curso, por fases)

Plan de implementación completo (migraciones exactas, extensión de `theme.ts`, archivos por
fase, verificación, estado de cada fase) en
[`REDISENO-ORGANIC-PLAN.md`](REDISENO-ORGANIC-PLAN.md) — mismo patrón que la sección 1 con la
ERS y el diseño de BD: ese archivo es la fuente de verdad del plan hacia adelante, esta
sección es el registro de lo que realmente se implementó fase por fase (con decisiones
tomadas durante la ejecución y desviaciones del plan original), no lo duplica.

**Origen.** El cliente aportó un proyecto de Claude Design con 22 pantallas de escritorio
que cubren los seis módulos existentes más un sistema visual nuevo ("Organic": paleta
terracota/oliva, tipografía Caprasimo para encabezados y Figtree para cuerpo, controles tipo
píldora). Al revisar las 22 pantallas se encontró que tres reintroducen funcionalidad que la
ERS excluye explícitamente en "Fuera del alcance", y una contradice el supuesto de que "el
propietario no es usuario del sistema" (sección 1). Se confirmó cada decisión con el cliente
antes de tocar código, no por reinterpretación propia:

- **Portal del propietario** — se construye de verdad, con acceso emitido por Recepción
  (no autoregistro público). Amplía deliberadamente la exclusión de "Portal o aplicación de
  autoservicio para el propietario" de la sección 1.2.
- **Compras y Proveedores** — se construye de verdad. Amplía deliberadamente la exclusión de
  "Compras, órdenes de compra y gestión de proveedores" — la misma que la sección 2 ya
  documentaba como parte del `.docx` de arquitectura superado; se reabre ahora por
  instrucción explícita del cliente, no porque el SRS final la haya dejado de excluir.
- **Lista de espera** — tabla real, sin notificación por WhatsApp/Email/SMS (eso sigue
  fuera de alcance, sección 1.2).
- **Lotes y vencimiento en Inventario** — versión ligera: metadata descriptiva sobre
  `movimiento_inventario`, sin tocar `fn_actualizar_existencia` (sección 6), que sigue siendo
  la única garantía real de RN-010.
- **Signos vitales y "próxima dosis" de vacuna** — ampliaciones pequeñas de RF-016/RF-018,
  sin contradecir ningún "Fuera del alcance".

El plan completo (migraciones exactas, extensión de `theme.ts`, archivos por fase,
verificación) se diseñó y aprobó con el cliente antes de escribir código. Ejecución **por
fases, con revisión y verificación entre cada una** — no una sola pasada — por pedido
explícito del cliente. La numeración RF/RN/RI de Compras y Proveedores y del Portal del
propietario se asigna cuando esos módulos se implementen (Fases 4 y 5), no antes.

### Fase 0 — completada: tema visual y shell de navegación

Solo tema y layout. **Sin cambios de esquema, sin RF nuevo, sin módulos funcionales
tocados** — el criterio de "listo" fue que el comportamiento de la app siguiera siendo
exactamente el mismo que antes, solo con el lenguaje visual nuevo.

- **`frontend/src/theme.ts`**: se extendió, no se reemplazó. Los tokens de la hoja de estilos
  "Organic" (rampas neutral/accent/accent-2 de 100 a 900, radios, sombras) se exportan como
  la constante `ORGANIC`, no dentro de `palette` — MUI no tiene un lugar nativo para una
  rampa de 9 tonos por color (`palette.primary`/`secondary` solo admiten `main/light/dark`).
  Los `color-mix()` de la hoja original se precalcularon a `rgba()` fijo. Encabezados
  (`h1`-`h6`) en Caprasimo, cuerpo en Figtree; botones/chips/inputs a `border-radius: 999`
  (píldora); diálogos y tarjetas a los radios grandes de `ORGANIC.radius`.
- **Fuentes**: `@fontsource/figtree` + `@fontsource/caprasimo` (paquetes npm), no un `<link>`
  a Google Fonts — no depende de que `fonts.googleapis.com` esté disponible en la red de la
  clínica (coherente con RNF-021, "sin instalar software adicional" no significa "sin
  depender de una CDN externa"). Importadas en `main.tsx`, junto al `import './index.css'`
  ya existente.
- **`frontend/src/layout/AppLayout.tsx`**: se restyleó el `Drawer`/`AppBar` existentes con
  los tokens Organic (ítem de nav activo en `accent[100]`/`accent[800]`). El contrato que
  **no se tocó** es `modulosParaRol(rol.codigo)` como única fuente de verdad del nav
  (RI-002) — verificado en navegador con las tres cuentas que cada una sigue viendo
  exactamente los módulos de la matriz 3.8 (Recepcionista: Pacientes/Agenda/Facturación;
  Veterinario: Pacientes/Agenda/Historial/Inventario; Administrador:
  Inventario/Facturación/Administración), ni uno más ni uno menos.
- **Buscador de la barra superior**: no es un buscador propio, es un atajo que navega a
  `/pacientes?q=<texto>` reutilizando el buscador que ya existe ahí (RF-007) — sin
  duplicar lógica de búsqueda. **Bug real encontrado y corregido**: `PacientesPage` leía el
  parámetro `?q=` con un `useState` de inicializador perezoso, que solo se ejecuta al
  montar. Como `AppLayout` es el layout padre del `<Outlet/>` y persiste montado entre
  navegaciones, una búsqueda hecha estando ya en `/pacientes` no remonta la página y el
  inicializador nunca se re-ejecuta — el campo de texto nunca se actualizaba. Se cambió a un
  `useEffect` que reacciona a `searchParams`, que sí se dispara en ambos casos (llegando
  desde otra página o ya estando en Pacientes). Patrón a tener presente para cualquier
  futura lectura de un query param en una página que vive detrás de un layout persistente:
  un inicializador perezoso de `useState` no es suficiente.
- **Campana de notificaciones**: en esta fase es solo visual (sin badge, sin conteo en
  vivo). Conectarla a `v_alerta_stock` queda para la Fase 6 (Dashboard), donde las alertas
  de stock ya son un KPI de primera clase — evita disparar una consulta nueva en cada
  carga de página de las seis fases restantes antes de que tenga un consumidor real.
- **Entrada de nav "Dashboard"**: deliberadamente **no** se agregó en esta fase. El plan
  original la contemplaba en Fase 0, pero al implementar se encontró que apuntarla a la
  ruta `/` (que hoy usa `InicioPorRol` para redirigir según rol) rompería el resaltado del
  ítem activo: `location.pathname.startsWith(modulo.ruta)` con `ruta: '/'` coincide con
  *cualquier* ruta de la app, así que "Dashboard" aparecería siempre seleccionado. Se
  pospuso a la Fase 6, cuando exista una ruta propia (`/inicio` o similar) y una
  `DashboardPage` real a la que apuntar.

**Verificado**: `tsc --noEmit` y `npm run build` limpios; navegador con las tres cuentas
(nav correcto por rol, tipografía Caprasimo/Figtree confirmada por estilo computado, radios
de 999px en botones/chips, color de fondo `#fff2eb` en el ítem de nav activo — coincide
exactamente con `ORGANIC.accent[100]`); buscador de la barra superior probado desde otra
página y ya estando en Pacientes, ambos casos filtran correctamente tras la corrección.

### Fase 1a — completada: Pacientes y Propietarios

Primer módulo de la Fase 1 (reskin + reestructuración de los cinco módulos existentes,
en orden RF). Aquí sí hubo cambios de estructura, no solo de estilo — los wireframes 1b-1e
pedían un flujo distinto al que existía, no solo un color distinto.

- **Alta en 2 pasos** (`NuevoPacienteDialog.tsx`, 1d): separa "a nombre de quién" de los
  datos de la mascota, en vez de un único formulario largo. Un fallo en el paso 2 no obliga
  a repetir el paso 1 — el propietario ya elegido/completado se conserva.
- **Detección de duplicado** (1e): mientras se escribe la identificación de un propietario
  nuevo, se reutiliza `buscarPropietarios()` (RF-007, ya existente) para avisar si ya hay
  uno con esa identificación exacta, con un botón "Usar este propietario". Es una capa de
  UX informativa sobre el `UNIQUE` que ya existe en la base — no lo reemplaza ni lo debilita;
  si el aviso fallara por lo que sea (red, etc.), el alta igual se protege por la restricción
  real al guardar. Verificado en navegador: identificación de un propietario ya sembrado →
  aviso correcto → "Usar este propietario" → paciente creado vinculado al propietario
  existente, sin duplicar el registro (confirmado por SQL).
- **Ficha con pestañas** (`FichaDialog.tsx`, 1c): Resumen (contenido de siempre) + Citas +,
  solo para Veterinario, Historial y Vacunas. **Decisión propia, no del wireframe literal**:
  el wireframe muestra las mismas 5 pestañas (+ Facturas) para cualquiera que abra la ficha,
  pero Pacientes lo abren tanto Recepcionista como Veterinario, y RN-006 reserva Historial/
  Vacunas al Veterinario — mostrarle esas pestañas a Recepcionista habría sido el mismo
  antipatrón ya evitado en el Módulo 4 (ofrecer una interacción que la RLS de todas formas
  vaciaría). Verificado en navegador con las dos cuentas: Recepcionista ve exactamente
  Resumen+Citas, Veterinario ve las 4, con datos reales en cada una (Historial trae la
  consulta y el examen de un paciente de prueba; Vacunas, correctamente vacío para uno sin
  vacunas registradas). **Pestaña "Facturas" del wireframe, omitida en esta pasada**: una
  factura se vincula a `propietario` o a `consulta`, no a `paciente` directamente, y un dueño
  con varias mascotas no tiene una respuesta obvia a "qué significa la factura de esta
  mascota" sin una decisión de producto previa — queda fuera de este alcance hasta que se
  defina.
- **Filtro por especie** (1b): recortado a lo único que hoy tiene una capacidad real detrás
  (client-side sobre lo ya cargado). Los filtros "Veterinario ▾" y "Activos ▾" del wireframe
  no se implementaron: los pacientes no están ligados a un veterinario, y no existe ninguna
  pantalla que desactive un paciente (RF-033 lo previó en el esquema, pero ninguna UI lo usa
  todavía) — ofrecer ese filtro habría sido decorativo, sin nada real que filtrar.
- Nueva función `listarCitasPorPaciente()` en `modules/agenda/api.ts`, reutilizada por la
  pestaña Citas de la ficha — mismo nivel de acceso que el resto de Agenda (`cita_select` ya
  admite Recepcionista y Veterinario), sin política RLS nueva.

**Nota de entorno, no de código**: durante la verificación, los `Select` de MUI dejaron de
abrirse con clics simulados a medias (un `.click()` sintético solo dispara `click`, pero
`MuiSelect` escucha `mousedown` para abrirse) y varias lecturas del DOM se hicieron antes de
que React confirmara el cambio de estado tras un evento nativo. Ninguno de los dos es un bug
de la aplicación — se resolvió despachando la secuencia completa
`mousedown`→`mouseup`→`click` y esperando un tick antes de leer el resultado.

### Fase 1b — completada: Agenda y Citas

- **Vista semanal nueva** (`AgendaSemanal.tsx`, 1f), complementaria a la vista por día que
  ya existía (`AgendaGrid.tsx`), no un reemplazo: responden preguntas distintas. La vista por
  día (eje día × veterinario) sigue siendo la mejor para "quién está libre ahora mismo,
  comparando varios veterinarios"; la semanal (eje semana × día, un solo veterinario) es la
  mejor para "cuándo tiene un hueco esta semana el Dr. Vera". Alternable con un
  `ToggleButtonGroup` Día/Semana. `AgendaSemanal` reutiliza `BloqueCita` tal cual — el
  componente ya era agnóstico de qué representa cada columna. Nueva
  `listarCitasDeLaSemana()` en `agenda/api.ts`, mismo patrón que `listarCitasDelDia()` (trae
  todos los veterinarios, el filtro de cuál mostrar se aplica en la UI). El cálculo del lunes
  de la semana se hizo a mano (`(fecha.day() + 6) % 7`) en vez de agregar el plugin `isoWeek`
  de dayjs solo para esto.
- **Bug real encontrado y corregido, no cosmético**: al crear una cita desde un hueco vacío
  de la vista semanal, `NuevaCitaDialog` tomaba la fecha de `fechaPorDefecto` (el lunes de
  referencia de la semana que se está viendo) y la hora de `prefill.hora` — así que una cita
  creada haciendo clic en el jueves a las 10:00 se guardaba el **lunes** a las 10:00, con el
  día equivocado. En la vista por día nunca se notaba porque ahí `fechaPorDefecto` y
  `prefill.hora` siempre caen en el mismo día. Corregido: cuando el prefill trae `hora`, esa
  fecha (que ya incluye el día correcto del hueco clicado) tiene prioridad sobre
  `fechaPorDefecto`. Verificado de extremo a extremo: clic en miércoles 26/08 10:00 → diálogo
  prellenado con esa fecha y hora exactas → cita creada y confirmada por SQL en
  `2026-08-26 15:00:00+00` (10:00 hora local, Ecuador UTC-5).
- **1g (Agendar cita) y 1i (Modificar/cancelar cita) no necesitaron cambios de código.** Ya
  estaban limpios de lo que el wireframe pedía quitar: no existía ningún cuadro de
  notificación WhatsApp que remover (nunca se construyó), ni wiring de "Notificar al dueño" o
  "Liberar cupo a lista de espera" (esto último llega en la Fase 3, cuando exista la tabla).
  El campo "Motivo de cancelación" del wireframe 1i tampoco se agregó: requeriría una columna
  nueva en `cita`, y esta fase se comprometió a cero cambios de esquema.

**Nota de proceso, no de la app**: `tsc --noEmit` corrido suelto en la raíz del frontend pasó
limpio, pero `npm run build` (que corre `tsc -b`, con project references) encontró dos errores
reales que el primero no vio — un tipo `Dayjs` sin importar y una llamada a `recargar()` con un
argumento de menos. A partir de aquí, la verificación de cada fase usa `npm run build`, no
`tsc --noEmit` suelto.

### Fase 1c — completada: Historial Clínico

El módulo más pequeño de esta fase: los formularios (`NuevaConsultaDialog`, `NuevaVacunacionDialog`,
`NuevoExamenDialog`, `CompletarExamenDialog`, `RegistrarConsumoDialog`) no necesitaron ningún
cambio de código — la sección 9 ya documentaba por qué este módulo usa diálogos en vez de
páginas completas para el alta (el timeline, por su tamaño y heterogeneidad, vive embebido en
la propia página; los formularios de alta sí siguen el patrón "diálogo" del resto del
proyecto). El wireframe 1k muestra "consulta en curso" como flujo de página completa, pero
convertir esto ahora sería revertir esa decisión ya tomada y documentada, no un reskin —
se deja así a propósito.

- **"Exportar PDF"** (1j) en `HistorialPage.tsx`: mismo patrón exacto que RI-005 en
  Facturación — `window.print()` + un nuevo bloque `#historial-imprimible` en la hoja
  `@media print` de `index.css` (que ya ocultaba todo salvo `#comprobante-factura`/
  `#reporte-ingresos`; ahora también este). El encabezado con nombre/especie/propietario que
  ya se ve en pantalla lleva `displayPrint:'none'` (no aporta nada nuevo en papel y sus
  botones de acción no tienen sentido impresos) y se agregó una copia solo para impresión
  (`display:'none', displayPrint:'block'`) dentro del bloque imprimible — mismo truco de
  "encabezado propio para papel" que ya usa el comprobante de factura. Los botones de acción
  dentro de cada evento del timeline ("Aplicar vacuna a esta consulta", "Completar
  resultado", etc.) también llevan `displayPrint:'none'`. Verificado: la regla de impresión
  carga con el nuevo selector, y el encabezado de solo-impresión existe en el DOM con el
  contenido correcto y `display:none` en pantalla (no se pudo renderizar una vista previa de
  impresión real en este entorno, misma limitación ya documentada para RI-005 en Facturación).
- **1l (Carnet de vacunas) y 1m (Exámenes)**: sin cambios de código, por la misma razón que
  Agenda — nada que el wireframe pide quitar existía, y lo que agrega (próxima dosis, tercer
  estado "en proceso") queda fuera de esta fase por diseño (Fase 2 / decisión ya tomada).

### Fase 1d — completada: Inventario y Medicamentos

- **Filtros por tipo y "Bajo mínimo"** (1n) en `InventarioPage.tsx`: chips sobre el mismo
  array ya cargado (mismo criterio que el filtro por especie de la Fase 1a) — no hay consulta
  nueva al servidor. Se usaron chips en vez de un `select`, a diferencia de Pacientes: aquí el
  wireframe los muestra como chips y el proyecto ya tiene ese patrón establecido (selector de
  veterinarios en Agenda), así que seguirlo es más consistente que introducir un segundo
  patrón de filtro. El chip "Por vencer" del wireframe no se agregó — depende de datos de
  vencimiento que llegan en la Fase 2.
- **`ProductoDetalleDialog.tsx` (1o) no necesitó cambios de código.** Ya tenía la sección
  "Movimientos" con tabla de histórico (RF-027); lo único que faltaba del wireframe —el panel
  de Lotes— depende del mismo dato de vencimiento de la Fase 2, así que no hay nada que
  reestructurar todavía.
- **Botón "Generar/Crear orden de compra" (1n/1p) no se agregó.** El módulo de Compras y
  Proveedores al que apuntaría no existe hasta la Fase 4 — un botón que abriera algo
  inexistente sería peor que no tenerlo.

Verificado en navegador: "Bajo mínimo" aísla correctamente el único producto por debajo de su
nivel; el filtro por tipo "Vacuna" muestra exactamente las 3 vacunas del catálogo; ambos
filtros combinan de forma independiente. `npm run build` limpio.

### Fase 1e — completada: Facturación y Reportes

Último módulo de la Fase 1, el más grande. Dos piezas reales, no solo reskin:

- **Reportes separado de Facturación como ruta propia** (1s): `ReportesPage.tsx` nuevo,
  envoltorio delgado sobre `ReporteIngresos.tsx` (que ya tenía toda la lógica, sin tocar).
  Antes vivía como una pestaña condicional dentro de `FacturacionPage.tsx`, visible solo para
  Administrador; ahora es la ruta `/reportes`, exclusiva de Administrador (`App.tsx` +
  `layout/modulos.ts`). `FacturacionPage.tsx` se simplificó a solo el listado de facturas —
  perdió el estado `pestana` y la rama condicional que antes decidía qué renderizar.
- **Pago mixto** (1r), en `RegistrarPagoDialog.tsx`: una factura se cobra con varias formas de
  pago en una sola acción (ej. $7 efectivo + $4.50 tarjeta), no una forma por cobro como
  antes. RN-015 ya admitía varios `pago` por factura — esto no es una regla nueva, es la UI
  insertando varias filas a la vez. Nueva `registrarPagosMixtos()` en `api.ts`: un único
  `insert` de PostgREST con un array (una sola sentencia SQL con varios `VALUES`), no N
  llamadas secuenciales — si una línea fuera inválida, la operación entera se revierte, en vez
  de dejar cobrado el efectivo pero no la tarjeta. Se quitaron "Yape/Plin" y "Crédito" del
  wireframe: `forma_pago` sigue en efectivo/tarjeta/transferencia, sin cambio de esquema.
  Verificado de extremo a extremo: cobro de $11,50 repartido en $7 efectivo + $4,50 tarjeta
  (con referencia `AUTH-9988`) → dos filas en `pago` con los montos y la forma correctos →
  factura pasó a `pagada` con saldo `$0,00`.
- **`NuevaFacturaDialog.tsx` (1q) se mantiene como diálogo, no se convirtió en página** —
  desviación deliberada del plan original, que preveía un flujo de página completa. Se
  amplió a `maxWidth="lg"` para dar más aire a la tabla de conceptos, que es lo que el
  wireframe realmente pedía; convertirlo en página habría sido la única alta-como-página del
  proyecto sin que ningún contenido lo justificara (a diferencia del timeline de Historial,
  que sí necesitaba su propio espacio) — habría roto la consistencia con el resto de
  formularios de alta del proyecto (Pacientes, Agenda, Historial, Inventario,
  Administración), todos diálogos.

Con esto se cierra la Fase 1 completa (los cinco módulos existentes + Administración
reskineados). `npm run build` limpio en todo el módulo.

### Fase 2 — completada: signos vitales, próxima dosis de vacuna, lotes/vencimiento

Tres migraciones pequeñas y aisladas (columnas nullable + dos vistas nuevas), tal como
preveía el plan — sin tocar `fn_actualizar_existencia` ni ninguna otra regla crítica.

- **`historial_signos_vitales`**: `consulta` + `temperatura_c numeric(4,1)`,
  `frecuencia_cardiaca_lpm smallint`, `frecuencia_respiratoria_rpm smallint`, todas
  nullable, con `CHECK > 0`. **Desviación deliberada sobre el plan**: el plan no
  preveía tocar `v_historial_clinico`, pero sin eso los signos vitales quedarían
  capturados y nunca visibles en el timeline (RF-020), contradiciendo la propia
  verificación que el plan exige para esta fase ("verla en el timeline"). Se
  resolvió con `CREATE OR REPLACE VIEW`, conservando las columnas existentes en el
  mismo orden (obligatorio en Postgres) y agregando las tres nuevas al final —
  `null::numeric(4,1)`/`null::smallint` en las ramas de vacunación y examen. RF-040
  (CLAUDE.md sección 14, catálogo de numeración del plan).
- **`vacunas_intervalo_y_proxima`**: `producto` + `intervalo_dias integer` nullable
  (solo tiene sentido para `tipo = 'vacuna'`, pero no se restringió con un `CHECK`
  a nivel de tabla — se decidió no acoplar la validación de un campo a otro para no
  repetir la lógica que ya vive en el formulario). Vista `v_vacunas_proximas`
  (`security_invoker = on`, `GRANT SELECT` explícito a `authenticated` — es un
  objeto nuevo, posterior al `GRANT ... ALL TABLES` de RLS, mismo problema ya
  documentado en la sección 9 para `bitacora_auditoria`): por paciente+vacuna,
  `max(fecha_aplicacion)` + `intervalo_dias` = `proxima_fecha`, recalculada siempre
  sobre la aplicación más reciente (verificado: una segunda vacunación desplaza la
  fecha "próxima" sin dejar rastro de la anterior, tal como se espera de una vista
  derivada). RF-041.
- **`inventario_lotes_vencimiento`**: `movimiento_inventario` +
  `lote_codigo varchar(30)`, `fecha_vencimiento date`, nullable, poblados solo en un
  `'ingreso'`. Vista `v_lotes_por_vencer` (ingresos con vencimiento en los próximos
  30 días desde `current_date`, igual criterio de "se deriva siempre" que
  `v_alerta_stock`). Ninguna de las dos columnas participa de
  `fn_actualizar_existencia` (verificado por API: un ajuste que dejaría existencia
  negativa se sigue rechazando exactamente igual que antes) — un lote es solo
  metadata sobre qué ingreso trajo el stock, no una unidad de control aparte.

**UI**: `NuevaConsultaDialog.tsx` agrega una sección "Signos vitales (opcional)" con
los tres campos, todos opcionales y validados solo si se completan (mismo patrón que
"Peso"); se ven de inmediato en `EventoHistorialItem.tsx` bajo el diagnóstico, en la
entrada de tipo consulta del timeline. `NuevaVacunacionDialog.tsx` consulta
`v_vacunas_proximas` para el paciente+producto en cuanto se elige la vacuna en el
selector, y muestra un `Alert` informativo ("Última aplicación: ... Próxima dosis
sugerida: ...") — puramente informativo, no bloquea ni prellena nada; si el producto
no tiene `intervalo_dias` o nunca se aplicó antes, simplemente no aparece.
`NuevoProductoDialog.tsx`/`ProductoDetalleDialog.tsx` agregan el campo "Intervalo
entre dosis" solo cuando `tipo === 'vacuna'` (alta y edición). El formulario de
"Registrar movimiento" de `ProductoDetalleDialog.tsx` agrega "Lote" y "Fecha de
vencimiento" solo cuando el tipo elegido es `'ingreso'`; la tabla de movimientos
suma una columna "Lote / Vencimiento" que resalta en `warning` cuando faltan 30 días
o menos. `InventarioPage.tsx` agrega un chip "Por vencer" (mismo patrón que "Bajo
mínimo": se deriva de `v_lotes_por_vencer`, cargada en paralelo con el catálogo, no
de una consulta encadenada) y un segundo banner de alerta, independiente del de
stock mínimo.

**Verificado** por `curl` con JWT real: consulta con vitals creada y visible en
`v_historial_clinico`; dos vacunaciones del mismo producto con `intervalo_dias=365`
confirmando que `v_vacunas_proximas` recalcula sobre la más reciente; ingreso con
lote/vencimiento reflejado en `v_lotes_por_vencer` y en `existencia_actual`; un
ajuste que dejaría existencia negativa sigue rechazado con el mismo mensaje de
siempre (`fn_actualizar_existencia` intacta). En navegador con `veterinario@vetcare.local`:
signos vitales visibles en el timeline de Toby, hint de próxima dosis correcto en
"Nueva vacunación". Con `admin@vetcare.local`: banner "1 lote por vencer en los
próximos 30 días", chip "Por vencer" aísla correctamente el único producto con un
lote próximo a vencer, "Intervalo entre dosis: 365 días" visible en el detalle del
producto, lote/vencimiento visibles en su fila de movimientos. `npm run build`
limpio (tras un `npm install` para traer `@fontsource/figtree`/`@fontsource/caprasimo`,
declarados en `package.json` desde la Fase 0 pero ausentes de `node_modules` en este
entorno — no relacionado con el código de esta fase).

### Fase 3 — completada: lista de espera (RF-034/RF-035)

Una tabla real (`lista_espera`), sin notificación por WhatsApp/Email/SMS — eso sigue fuera
de alcance. Mismo patrón de acceso que el resto del Módulo 2 (Agenda): Recepcionista
gestiona, Veterinario solo consulta; sin política `DELETE` (RF-033), "quitar" una entrada
es un `UPDATE` a `cancelada` o `atendida`.

- **Migración `lista_espera`**: `id_paciente` obligatorio, `id_veterinario` **nullable**
  (una solicitud puede ser "con cualquier veterinario"), `fecha_preferida`/
  `franja_preferida` (`manana`/`tarde`) opcionales — son preferencia del propietario, no
  un cupo real, a diferencia de `cita`. `estado` en `pendiente`/`atendida`/`cancelada`.
  RLS calcada de `cita` (`row_level_security.sql`), con su propio `GRANT` explícito a
  `authenticated` (objeto posterior al `GRANT ... ALL TABLES` de esa migración, mismo
  problema ya documentado en la sección 9). **Verificado que la columna `identity` no
  necesita un `GRANT` de secuencia aparte**: a diferencia de una `sequence` referenciada
  a mano, Postgres no exige `USAGE` sobre la secuencia interna de una columna
  `generated always as identity` — solo el privilegio sobre la tabla. Confirmado por
  `curl`: recepcionista inserta sin error pese a que la migración no otorga nada sobre
  la secuencia.
- **`ListaEsperaTab.tsx`** vive como una segunda pestaña dentro de `AgendaPage.tsx`
  (`Tabs` "Agenda"/"Lista de espera", justo debajo del encabezado), no como ruta propia
  — es una vista más de Agenda, no un módulo aparte. Filtro "Pendientes"/"Todas" (chips,
  mismo patrón que Inventario). `NuevaListaEsperaDialog.tsx` reutiliza
  `PacienteAutocomplete` ya existente; veterinario preferido es un `select` con
  "Cualquiera" como opción explícita (mapea a `id_veterinario: null`), no una casilla
  aparte.
- **Wiring RF-015 (1i) — "liberar cupo a lista de espera"**: al cancelar una cita,
  `CitaDetalleDialog.tsx` consulta `listarCoincidenciasListaEspera(idVeterinario)` —
  entradas `pendiente` con `id_veterinario` igual al de la cita cancelada **o** `null`
  ("cualquiera" también cuenta como coincidencia). No se filtra por `fecha_preferida`:
  es una preferencia, no un requisito, y filtrar de más ocultaría coincidencias reales
  (alguien que pidió "lo antes posible", sin fecha). Cada coincidencia tiene un botón
  "Agendar con este cupo" que cierra el detalle y abre `NuevaCitaDialog` ya con
  paciente/veterinario/hora del cupo liberado — se amplió el `Prefill` de
  `NuevaCitaDialog` con `pacienteInicial`/`idListaEspera`; al confirmar la nueva cita,
  si viene de una coincidencia, se llama `marcarAtendidaListaEspera` en la misma acción.
  "Atendida" es un estado distinto de "cancelada" a propósito: cancelada significa que
  el propietario ya no espera nada, atendida significa que se le dio el cupo.

**Bug de entorno encontrado y corregido, no del código de esta fase**: al construir esta
fase, el servidor de desarrollo (`vite`) quedó con un error de transformación cacheado de
un estado intermedio de `AgendaPage.tsx` (un JSX válido a mitad de una serie de ediciones
secuenciales) y no se recuperó solo — `npm run build` (una compilación completa desde
cero) ya daba limpio, pero el HMR seguía sirviendo el error viejo y bloqueaba **toda la
aplicación**, incluido el login, porque `App.tsx` importa las rutas de forma eager. Se
resolvió reiniciando el servidor de Vite. Patrón a tener presente: si el build de
producción está limpio pero el navegador muestra un error de transformación que no
coincide con el archivo actual, sospechar del caché de HMR antes que del código.

**Verificado**: `db reset` limpio; por `curl` con JWT real — Veterinario forzando un
`INSERT` en `lista_espera` recibe `403`; Recepcionista inserta sin necesitar ningún
`GRANT` de secuencia; RLS de `UPDATE` confirmada con un intento de Veterinario que
devuelve `204` pero deja el `estado` intacto (mismo patrón de "bloqueo silencioso" ya
documentado para otras tablas). En navegador, de punta a punta con la cuenta
`recepcion@vetcare.local`: crear una cita, cancelarla, ver aparecer sus dos coincidencias
de lista de espera (una con veterinario específico, otra "cualquiera"), click en "Agendar
con este cupo" → `NuevaCitaDialog` prellenado con paciente/veterinario/hora correctos →
cita creada → la entrada correspondiente pasa a "Atendida" (confirmado en la pestaña
"Todas"). Con `veterinario@vetcare.local`: pestaña "Lista de espera" visible y con datos,
sin botón "Nueva entrada" ni columna de acciones — solo lectura, tal como exige RN-006/
la matriz de acceso del Módulo 2. `npm run build` limpio.

### Fase 4 — completada: Compras y Proveedores (RF-036 a RF-039, Módulo 7 nuevo)

Amplía deliberadamente la exclusión de "Compras, órdenes de compra y gestión de
proveedores" del SRS — la misma línea que CLAUDE.md sección 2 ya documentaba como
parte del `.docx` de arquitectura superado ("D6 Proveedores"). Se reabre ahora por
instrucción explícita del cliente, no porque el SRS final haya dejado de excluirla.
Exclusivo de Administrador, mismo criterio que el resto de "Inventario y
Medicamentos" que ya gestiona.

- **Migración `compras_proveedores`**: tres tablas nuevas —`proveedor`,
  `orden_compra` (ciclo de vida `borrador → emitida → recibida`, o `cancelada`
  desde cualquiera de las dos primeras), `detalle_orden_compra` (líneas inmutables,
  mismo criterio que `detalle_factura`, sin política `UPDATE`)— más
  `movimiento_inventario.id_orden_compra` nullable. Verificado que esa columna
  nueva no colisiona con `chk_movimiento_origen` (RN-009): la restricción no la
  menciona, así que un ingreso por compra sigue cumpliendo
  `tipo_movimiento in ('ingreso','ajuste') and id_consulta is null and
  id_vacunacion is null` sin cambios.
- **RN-022 — `fn_recibir_orden_compra`**: trigger `AFTER UPDATE ... WHEN
  (new.estado = 'recibida' and old.estado is distinct from 'recibida')`, mismo
  patrón exacto que `fn_vacunacion_descuenta_inventario` (un trigger que inserta
  `movimiento_inventario` a partir de un evento en otra tabla). **A diferencia**
  de esa función, esta **no** es `SECURITY DEFINER`: solo Administrador puede
  actualizar `orden_compra` (RLS) y Administrador ya tiene permiso directo de
  insertar movimientos `'ingreso'` (`movimiento_insert`, sección 7) — no hay
  ningún límite de rol que cruzar, así que forzarla a bypasear RLS habría sido
  privilegio de más, no de menos. La guarda `old.estado is distinct from
  'recibida'` es la que garantiza "una sola vez" (RN-022): verificado por `curl`
  que un segundo `UPDATE` a `'recibida'` no duplica los movimientos ni vuelve a
  sumar existencia.
- **`fn_crear_orden_compra(id_proveedor, observacion, lineas jsonb)` — RF-037**:
  cabecera + líneas en una sola llamada RPC, mismo motivo de atomicidad que
  `fn_emitir_factura` (PostgREST no ofrece transacciones entre peticiones).
  **Tampoco es `SECURITY DEFINER`**, a diferencia de `fn_emitir_factura`: no
  necesita cruzar ningún límite de RLS (RN-006 no aplica aquí), así que cada
  `insert` dentro de la función se sigue evaluando con el rol de quien llama — si
  no es Administrador, el primer `insert` ya falla por RLS y toda la operación se
  revierte sin necesitar un chequeo de rol explícito dentro de la función.
- **UI**: `ComprasPage.tsx` con dos pestañas (`OrdenesCompraTab.tsx`/
  `ProveedoresTab.tsx`), mismo patrón que la pestaña "Lista de espera" dentro de
  Agenda — no son rutas separadas porque comparten el mismo contexto (una orden
  siempre se emite a un proveedor ya registrado). `NuevaOrdenCompraDialog.tsx`
  sugiere el `precio_unitario` del catálogo al elegir un producto (editable
  después, igual que el precio de un servicio en `NuevaFacturaDialog`).
  `OrdenCompraDetalleDialog.tsx` ofrece solo los botones de transición válidos
  para el estado actual (mismo criterio que `CitaDetalleDialog`: nunca una acción
  que la base de todas formas rechazaría). Botón "Generar orden de compra" en
  `InventarioPage.tsx`, exclusivo de Administrador: navega a `/compras` sin
  intentar prellenar el producto — prellenar requeriría pasar estado entre
  módulos sin una ruta que lo modele, fuera de alcance de esta pasada.

**Verificado** por `curl` con JWT real: Recepcionista forzando `INSERT` en
`orden_compra` recibe `403`; `fn_crear_orden_compra` con 2 líneas crea cabecera +
detalle atómicamente; marcar `'recibida'` sube `existencia_actual` exactamente lo
esperado (verificado con dos productos a la vez) y genera una fila
`movimiento_inventario` por línea con `id_orden_compra` poblado; un segundo
`UPDATE` a `'recibida'` no genera movimientos nuevos (RN-022 intacta). En
navegador con `admin@vetcare.local`: proveedor creado, orden de compra armada con
un producto (precio sugerido automáticamente desde el catálogo), transición
completa borrador → emitida → recibida desde la UI, y `existencia_actual` de
Amoxicilina 500mg confirmada en 69 (49 + 20) tras recibir. `npm run build`
limpio.

### Fase 5 — completada: Portal del propietario (RF-042 a RF-045, Módulo 8 nuevo)

La pieza de mayor riesgo arquitectónico de todo el plan: identidad paralela a la
de personal, y una modificación real sobre el `EXCLUDE` de solapamiento de citas
ya aprobado y probado (RN-004). Contradice a propósito el supuesto de fondo de la
sección 1 ("el propietario no es usuario del sistema") — por instrucción
explícita del cliente, no por reinterpretación propia del SRS. RN-006 sigue
intacto también aquí: verificado en cada punto de esta fase que el portal nunca
expone `consulta` ni `examen_laboratorio`.

- **Migración `portal_propietario`**: `propietario.id_usuario_portal` (nullable,
  `unique`, `references auth.users`), `fn_propietario_actual()` (análoga a
  `fn_rol_actual()`, `SECURITY DEFINER`). Sobre `cita`: `id_veterinario` pasa a
  nullable, `estado` admite `'solicitada'`, y el `EXCLUDE` de solapamiento se
  recreó (Postgres no permite `ALTER` sobre uno) con
  `where (estado in ('programada', 'atendida'))` en vez de `<> 'cancelada'` — una
  `'solicitada'` (siempre sin veterinario) nunca compite por el índice hasta que
  Recepción la confirma. El nombre real de la restricción
  (`cita_id_veterinario_tstzrange_excl`) se verificó contra el catálogo
  (`pg_constraint`) antes de escribir el `DROP`, en vez de asumirlo.
- **RLS identity-scoped, no basadas en `fn_rol_actual()`**: una cuenta de portal
  siempre le resuelve `null` a esa función, lo que ya la excluye automáticamente
  de las ~40 políticas de personal existentes sin tocar ninguna — mismo criterio
  que la política acotada de `propietario` para RF-031 (sección 9). Políticas
  nuevas: `propietario_select_portal`, `paciente_select_portal`,
  `cita_select_portal`, `cita_insert_portal` (exige `estado='solicitada'` e
  `id_veterinario is null` como literales, no como default — un propietario no
  puede reservar un cupo real saltándose a Recepción), `factura_select_portal`,
  `detalle_factura_select_portal`, `pago_select_portal`.
- **`v_carnet_portal`**: a diferencia de `v_historial_clinico`/`v_estado_factura`/
  `v_alerta_stock`, **no** lleva `security_invoker = on` — si lo llevara, la RLS
  de `vacunacion` (staff-only) le devolvería siempre vacío a un propietario. Corre
  con los privilegios de quien la crea (comportamiento por defecto de una vista) y
  se auto-acota con `where ... = fn_propietario_actual()`, la misma técnica que
  una función `SECURITY DEFINER` pero expresada como vista porque no devuelve una
  única fila. Verificado que para cualquier cuenta de personal simplemente no
  devuelve filas (`fn_propietario_actual()` da `null`).
- **Bug real encontrado y corregido, no del diseño de la migración**: el primer
  `insert` de una solicitud de cita devolvía `23503` (viola
  `cita_id_usuario_registro_fkey`). `id_usuario_registro` tiene
  `default auth.uid()`, y ese default se aplica igual para una cuenta de portal
  — pero una cuenta de portal no tiene fila en `public.usuario`, así que el
  default produce una FK inválida. Se detectó por `curl` antes de escribir el
  cliente. Corrección: `frontend/src/portal/api.ts` envía siempre
  `id_usuario_registro: null` explícito en `crearSolicitudCita` (un valor
  explícito sobrescribe el default; la columna es nullable). Patrón a tener
  presente para cualquier tabla futura con un `default auth.uid()` a la que
  también pueda escribir una identidad sin fila en `usuario`.
- **RI-008 — Edge Function `portal-acceso`**: segundo caso exacto del patrón de
  `admin-usuarios` (verifica ella misma que quien llama es `recepcionista`
  activo, usa la `service_role` key solo después de esa verificación). Antes de
  poder probarla localmente hubo que reiniciar el stack de Supabase completo
  (`supabase stop && supabase start`): el contenedor `edge_runtime` había quedado
  detenido en este entorno (visible en `supabase status` como "Stopped
  services"), y `supabase db reset` no lo reinicia por sí solo. `grant select,
  update on public.propietario to service_role` — mismo problema ya documentado
  en la sección 9 (una tabla existente tocada por primera vez desde
  `service_role` no hereda el privilegio automáticamente).
- **`frontend/src/portal/` — árbol completo, deliberadamente separado del de
  personal**: `PortalAuthContext.tsx` reutiliza el mismo cliente de Supabase
  (mismo `auth.users`, mismo storage de sesión) que `AuthContext.tsx` de
  personal — separar el contexto de React alcanza para que las páginas de
  `/portal/*` nunca lean `sesión`/`rol` de personal, sin necesitar un segundo
  cliente ni tocar ese modelo (hallazgo de arquitectura #1 del plan). En
  `App.tsx`, `/portal/*` es una rama de rutas paralela y hermana, no anidada en
  `RutaProtegida`/`AppLayout` de personal. `PortalLayout.tsx` es deliberadamente
  más simple que `AppLayout.tsx` (sin `Drawer`, solo tres enlaces) — no vale la
  pena reproducir esa maquinaria para un menú tan chico. `MascotasPortalPage.tsx`
  (carnet de vacunas por mascota), `CitasPortalPage.tsx` (listado +
  `SolicitarCitaDialog.tsx`), `FacturasPortalPage.tsx` (solo lectura, detalle +
  pagos).
- **Wiring en `CitaDetalleDialog.tsx`**: una `'solicitada'` muestra "Sin
  veterinario asignado todavía" en vez de intentar leer `cita.veterinario.nombres`
  (ahora puede ser `null`) y ofrece "Confirmar"/"Rechazar solicitud" en vez de
  "Reprogramar"/"Cancelar cita". A diferencia de reprogramar (veterinario fijo,
  `soloLecturaVeterinario`), confirmar una solicitud **sí** deja elegir
  veterinario — necesita su propio estado (`idVeterinarioConfirmar`) porque
  reprogramar y confirmar son casos distintos del mismo componente. El `UPDATE`
  resultante (`estado='programada'` + veterinario + horario real) es el que
  activa el `EXCLUDE` para esa fila; `AgendaPage.tsx` agrega un banner
  "N solicitudes de cita desde el portal" (Recepción) que abre el mismo
  `CitaDetalleDialog` — las `'solicitada'` no pueden aparecer en `AgendaGrid`
  (agrupa por veterinario, y todavía no tienen uno).
- **`FichaDialog.tsx` — botón "Dar acceso al portal"**: solo si
  `puedeEditar` (Recepcionista) y el propietario todavía no tiene
  `id_usuario_portal`. **Segundo bug real encontrado y corregido, de UI, no de la
  migración**: el diálogo (`AccesoPortalDialog.tsx`) mostraba el mensaje de éxito
  y un instante después volvía en blanco al formulario vacío. Causa: `onEmitido`
  dispara `onActualizado` en `FichaDialog`, que recarga la ficha y reemplaza el
  objeto `propietario` por uno nuevo (misma fila, distinta referencia) mientras
  el diálogo de acceso seguía abierto mostrando el éxito; el `useEffect` de
  inicialización dependía del objeto `propietario` completo, así que ese nuevo
  objeto lo volvía a disparar y borraba el estado de éxito recién mostrado. Se
  detectó reproduciendo el flujo completo en el navegador, no solo por `curl` (la
  cuenta sí se había creado correctamente; el bug era puramente de UI). Corregido
  cambiando la dependencia a `propietario?.id_propietario` en vez del objeto
  completo. Patrón a tener presente: un `useEffect` de "inicializar al abrir" que
  depende de un objeto (no de su id) se re-dispara con cualquier recarga del
  padre que reemplace ese objeto por una copia nueva, incluso si nada relevante
  cambió.

**Verificado** por `curl` con JWT real: `veterinario@vetcare.local` recibe `403`
invocando `portal-acceso`; `recepcion@vetcare.local` crea la cuenta de portal
real (no solo vía seed); con el JWT del propietario, `select * from paciente` da
solo sus mascotas, `consulta`/`examen_laboratorio` dan `[]` (RN-006 intacto),
`v_carnet_portal` solo trae lo suyo (y `[]` para una cuenta de personal), un
`insert` de `cita` con `id_veterinario` no nulo o con `id_paciente` ajeno se
rechaza con `403`, y una solicitud válida se inserta correctamente. Confirmar la
solicitud asignando veterinario/horario y forzar el mismo horario dos veces
falla la segunda vez con `23P01` (mensaje ya mapeado). En navegador, de punta a
punta: `recepcion@vetcare.local` emite el acceso desde la ficha de Toby →
`propietario@vetcare.local` entra al portal, ve sus dos mascotas, el carnet de
Toby, factura pagada, y solicita una cita nueva → de vuelta en
`recepcion@vetcare.local`, el banner de solicitudes pendientes la muestra, se
confirma asignando a Carlos Veterinario (pasa a "Programada"), y el chequeo de
disponibilidad en vivo de una segunda cita para el mismo horario/veterinario ya
la marca ocupada (misma garantía confirmada a nivel de base por `curl`).
`npm run build` limpio. Sembrada además una 4ª identidad de prueba
(`propietario@vetcare.local`) en `supabase/seed.sql`, vinculada a María Fernanda
Chávez Rodríguez, para poder probar el portal en local sin pasar por la Edge
Function cada vez.
