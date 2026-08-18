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

### Parcialmente implementado
- Nada a medio camino ahora mismo: lo que está en el repo funciona; lo que falta, no se ha
  empezado (ver Pendiente).

### Pendiente
- Módulo 2 — Agenda y Citas (RF-011 a RF-015).
- Módulo 3 — Historial Clínico (RF-016 a RF-020).
- Módulo 4 — Inventario y Medicamentos (RF-021 a RF-027).
- Módulo 5 — Facturación y Reportes (RF-028 a RF-032).
- RI-005: impresión/exportación de factura.
- Vinculación a un proyecto Supabase alojado para despliegue (hoy el desarrollo es local vía
  Docker; ver sección 8).
- Definir con el cliente los valores TBD del SRS: RNF-016 (tiempo de respuesta objetivo),
  RNF-018 (disponibilidad comprometida), RNF-019 (política de respaldo).

### Problemas conocidos
- Ninguno abierto. (El bug real encontrado durante la verificación de Módulo 1 — un embed de
  PostgREST sin `!inner` que dejaba pasar `propietario: null` y rompía el render al buscar por
  nombre del propietario sin resultados — ya está corregido y documentado en la sección 6.)

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
