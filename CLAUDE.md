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

**Convención vigente de aquí en adelante:** una sola rama de trabajo continua, `Desarrollo-DA`,
para todo el desarrollo — no una rama nueva por módulo. `main` (local y remoto) se deja sin
tocar hasta que el usuario decida fusionar `Desarrollo-DA` explícitamente. Confirmar siempre con
`git status`/`git branch -vv` en qué rama se está parado antes de empezar a trabajar o de hacer
cualquier `push`, y preguntar al usuario el nombre de destino antes de subir nada — no asumir
que es `main`.

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

### Pendiente
- Definir con el cliente el porcentaje de impuesto a aplicar (hoy 15 como valor inicial del
  formulario, ver arriba).
- Vinculación a un proyecto Supabase alojado para despliegue (hoy el desarrollo es local vía
  Docker; ver sección 8).
- Definir con el cliente los valores TBD del SRS: RNF-016 (tiempo de respuesta objetivo),
  RNF-018 (disponibilidad comprometida), RNF-019 (política de respaldo).

### Problemas conocidos
- Ninguno abierto. (El bug real encontrado durante la verificación de Módulo 1 — un embed de
  PostgREST sin `!inner` que dejaba pasar `propietario: null` y rompía el render al buscar por
  nombre del propietario sin resultados — ya está corregido y documentado en la sección 6. Los
  bugs reales encontrados durante la verificación de Módulos 2 y 3 se describen abajo, también
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
