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
├── supabase/                  # Proyecto Supabase CLI
│   ├── config.toml
│   ├── migrations/            # Esquema versionado, aplicado con `supabase db reset`/`push`
│   └── seed.sql                # Catálogos iniciales + usuarios de prueba (solo entorno local)
└── frontend/                  # SPA React + Vite + TypeScript + MUI
    └── src/
        ├── lib/                # Cliente Supabase, helpers
        ├── auth/               # Sesión, login, rutas protegidas
        ├── layout/             # Layout con navegación por rol
        └── modules/            # Un subdirectorio por módulo funcional (1:1 con la ERS)
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
- **Rediseño visual "Organic" + ampliaciones de alcance — en curso, por fases.** Fase 0
  completada (ver sección 14); quedan las Fases 1 a 6. No commitear ni desplegar ninguna fase
  sin haberla verificado por separado — es la condición bajo la que el usuario aprobó el plan.
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
