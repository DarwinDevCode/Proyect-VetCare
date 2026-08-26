# Guía para Diagramas de Paquetes UML — VetCare

## 1. Criterio

VetCare no está organizado en capas clásicas (Presentación / Aplicación /
Dominio / Persistencia): es una SPA de React organizada **por módulo
funcional** (un subdirectorio de `frontend/src/modules/` por módulo, más
`auth/` y `portal/` como árboles de identidad separados) que habla
directamente con Supabase como backend as a service. No hay una capa de
"aplicación" ni de "dominio" separadas del resto: cada módulo mezcla su
página, sus diálogos y su archivo `api.ts` en la misma carpeta. Este documento
representa esa organización real, no una reestructuración en capas.

El backend (`supabase/`) es un paquete aparte, con su propia subdivisión real:
`migrations/` (esquema versionado), `functions/` (dos funciones Edge
independientes) y `seed.sql` (datos de desarrollo, no un paquete de código).

## 2. Paquetes del frontend (`frontend/src/`)

```text
frontend/src/
├── main.tsx, App.tsx, theme.ts, index.css   (raíz: arranque y tema, sin paquete propio)
├── lib/            → cliente Supabase + mapeo de errores
├── types/          → dominio.ts (interfaces compartidas)
├── auth/           → identidad y sesión de personal
├── layout/          → shell de navegación de personal (AppLayout, catálogo de módulos)
├── modules/
│   ├── pacientes/
│   ├── agenda/
│   ├── historial/
│   ├── inventario/
│   ├── compras/
│   ├── facturacion/
│   ├── administracion/
│   └── dashboard/
└── portal/          → identidad, layout y páginas del propietario (Módulo 8)
```

### `lib/`
- **Responsabilidad:** infraestructura mínima compartida — el cliente único de
  Supabase (`supabaseClient.ts`, construido con `VITE_SUPABASE_URL`/
  `VITE_SUPABASE_ANON_KEY`) y la traducción de errores de PostgreSQL/PostgREST
  a mensajes en español (`errors.ts`, función `mensajeError`).
- **Contenido:** `supabaseClient.ts`, `errors.ts`.
- **Dependido por:** todos los demás paquetes (`auth`, `layout`, todos los
  `modules/*`, `portal`). No depende de ningún otro paquete del proyecto.

### `types/`
- **Responsabilidad:** las interfaces de dominio (`dominio.ts`) que
  reflejan 1:1 las tablas y vistas de la base de datos (ver Documento 1).
- **Dependido por:** todos los paquetes que importan tipos de dominio
  (prácticamente todos). No depende de ningún otro paquete del proyecto.

### `auth/`
- **Responsabilidad:** sesión de personal — `AuthContext.tsx` (carga el
  `usuario`/`rol` desde la tabla `usuario` tras iniciar sesión), `LoginPage.tsx`,
  `RutaProtegida.tsx` (guarda de rutas por rol).
- **Depende de:** `lib/`, `types/`.
- **Dependido por:** `layout/`, `App.tsx`, y cada módulo de personal que use
  `useAuth()` para condicionar botones de escritura (`pacientes`, `agenda`,
  `historial` no lo necesita porque no tiene condicionales de escritura,
  `inventario`, `compras` no lo usa directamente porque `ComprasPage` no
  condiciona nada dentro de sí misma, `facturacion`, `administracion`,
  `dashboard`).

### `layout/`
- **Responsabilidad:** shell de navegación de personal — `AppLayout.tsx`
  (barra superior, menú lateral, buscador, campana de alertas de stock) y
  `modulos.ts` (catálogo `MODULOS`, con la ruta/etiqueta/ícono/roles de cada
  módulo, RI-002).
- **Depende de:** `auth/` (`useAuth`), `types/` (`RolCodigo`),
  `modules/inventario` (`listarProductos`, para el badge de alertas de stock).
- **Dependido por:** `App.tsx`.

### `modules/pacientes/`
- **Contiene:** `PacientesPage.tsx`, `FichaDialog.tsx`,
  `NuevoPacienteDialog.tsx`, `PropietarioAutocomplete.tsx`,
  `EspecieRazaSelect.tsx`, `AccesoPortalDialog.tsx`,
  `ReenviarAccesoPortalDialog.tsx`, `edad.ts`, `api.ts`.
- **Depende de:** `lib/`, `types/`, `auth/`; y, solo dentro de
  `FichaDialog.tsx`, de `modules/agenda` (`listarCitasPorPaciente`) y
  `modules/historial` (`listarHistorial`, `interpretarEvento`,
  `ETIQUETA_TIPO_EVENTO`, `COLOR_TIPO_EVENTO`) para mostrar las pestañas
  "Citas"/"Historial"/"Vacunas" de la ficha.
- **Dependido por:** `layout/` (buscador de la barra superior navega a
  `/pacientes?q=`), `modules/agenda` (`PacienteAutocomplete` no depende de este
  paquete: define su propia proyección `PacienteParaCita`),
  `modules/historial` (reutiliza el mismo patrón de búsqueda con `!inner`),
  `modules/facturacion` (`PropietarioAutocomplete`), `portal/` (`edad.ts`).

### `modules/agenda/`
- **Contiene:** `AgendaPage.tsx`, `AgendaGrid.tsx`, `AgendaSemanal.tsx`,
  `BloqueCita.tsx`, `CitaDetalleDialog.tsx`, `NuevaCitaDialog.tsx`,
  `NuevaListaEsperaDialog.tsx`, `ListaEsperaTab.tsx`,
  `PacienteAutocomplete.tsx`, `SelectorHorarioCita.tsx`, `disponibilidad.ts`,
  `useDisponibilidadCita.ts`, `api.ts`.
- **Depende de:** `lib/`, `types/`, `auth/`.
- **Dependido por:** `modules/pacientes` (pestaña "Citas"),
  `modules/dashboard` (KPIs de citas del día y lista de espera).

### `modules/historial/`
- **Contiene:** `HistorialPage.tsx`, `EventoHistorialItem.tsx`,
  `NuevaConsultaDialog.tsx`, `NuevaVacunacionDialog.tsx`,
  `NuevoExamenDialog.tsx`, `CompletarExamenDialog.tsx`,
  `RegistrarConsumoDialog.tsx`, `eventoHistorial.ts`, `edad.ts`, `api.ts`.
- **Depende de:** `lib/`, `types/`; y `modules/inventario`
  (`registrarMovimiento`, usado por `RegistrarConsumoDialog.tsx` para
  descontar productos consumidos en una consulta).
- **Dependido por:** `modules/pacientes` (pestañas "Historial"/"Vacunas").

### `modules/inventario/`
- **Contiene:** `InventarioPage.tsx`, `NuevoProductoDialog.tsx`,
  `ProductoDetalleDialog.tsx`, `api.ts`.
- **Depende de:** `lib/`, `types/`, `auth/`.
- **Dependido por:** `layout/` (badge de alertas), `modules/historial`
  (consumo), `modules/compras` (catálogo de productos para armar una orden),
  `modules/dashboard` (KPIs de stock/lotes por vencer).

### `modules/compras/`
- **Contiene:** `ComprasPage.tsx`, `OrdenesCompraTab.tsx`,
  `NuevaOrdenCompraDialog.tsx`, `OrdenCompraDetalleDialog.tsx`,
  `ProveedoresTab.tsx`, `ProveedorDetalleDialog.tsx`,
  `NuevoProveedorDialog.tsx`, `api.ts`.
- **Depende de:** `lib/`, `types/`, `modules/inventario` (`listarProductos`).
- **Dependido por:** `modules/dashboard` (KPI de órdenes pendientes).

### `modules/facturacion/`
- **Contiene:** `FacturacionPage.tsx`, `NuevaFacturaDialog.tsx`,
  `FacturaDetalleDialog.tsx`, `RegistrarPagoDialog.tsx`,
  `ReporteIngresos.tsx`, `ReportesPage.tsx`, `formato.ts`, `api.ts`.
- **Depende de:** `lib/`, `types/`, `auth/`, `modules/pacientes`
  (`PropietarioAutocomplete`, para la vía "Cobrar servicios").
- **Dependido por:** `modules/dashboard` (KPIs de ingresos y facturas
  pendientes), `portal/` (`formato.ts`, reutilizado tal cual para mostrar
  montos/estados en "Mis facturas").

### `modules/administracion/`
- **Contiene:** `AdministracionPage.tsx`, `UsuariosTab.tsx`,
  `NuevoUsuarioDialog.tsx`, `EditarUsuarioDialog.tsx`,
  `RestablecerContrasenaDialog.tsx`, `RolesTab.tsx`, `CatalogosTab.tsx`,
  `ParametrosTab.tsx`, `AuditoriaTab.tsx`, `api.ts`.
- **Depende de:** `lib/`, `types/`, `auth/` (para mostrar el chip "Tú" sobre
  la cuenta propia en `UsuariosTab.tsx`).
- **Dependido por:** ningún otro paquete de `modules/` (es una hoja).

### `modules/dashboard/`
- **Contiene:** `DashboardPage.tsx`, `api.ts`.
- **Depende de:** `lib/`, `types/`, `auth/`, `modules/agenda`,
  `modules/inventario`, `modules/facturacion`, `modules/compras` (agrega
  funciones ya existentes de esos cuatro módulos; no define ninguna consulta
  propia a la base).
- **Dependido por:** `App.tsx` (ruta `/inicio`).

### `portal/`
- **Contiene:** `PortalAuthContext.tsx`, `PortalApp.tsx`,
  `PortalRutaProtegida.tsx`, `PortalLayout.tsx`, `LoginPortalPage.tsx`,
  `MascotasPortalPage.tsx`, `CitasPortalPage.tsx`,
  `SolicitarCitaDialog.tsx`, `FacturasPortalPage.tsx`, `api.ts`.
- **Depende de:** `lib/`, `types/`, `modules/pacientes` (`edad.ts`,
  `calcularEdadTexto`), `modules/facturacion` (`formato.ts`, etiquetas y
  formato de moneda). **No depende de `auth/`**: mantiene su propio contexto
  de sesión (`PortalAuthContext`) precisamente para no leer nunca la sesión de
  personal, aunque ambos comparten el mismo cliente `supabase` de `lib/`.
- **Dependido por:** `App.tsx` (rama de rutas `/portal/*`, paralela y
  hermana de la rama de personal, no anidada dentro de ella).

### Raíz (`App.tsx`, `main.tsx`, `theme.ts`, `index.css`)
- **Responsabilidad:** arranque de la aplicación (`main.tsx`: proveedores de
  tema, fecha/hora en español, enrutador, `AuthProvider`), definición de rutas
  (`App.tsx`: rama de personal protegida por `RutaProtegida`/`AppLayout`, rama
  `/portal/*` con su propio `PortalAuthProvider`/`PortalApp`), tema visual
  "Organic" (`theme.ts`, tokens `ORGANIC`) y hoja de impresión (`index.css`).
- **Depende de:** todos los paquetes anteriores.
- No es un paquete funcional en sí, sino el punto de composición de todos los
  demás.

## 3. Dirección de las dependencias — diagrama de flujo

```text
                     ┌────────────┐        ┌───────────┐
                     │   types/   │◄───────│   lib/    │  (lib no depende de types)
                     └─────▲──────┘        └─────▲─────┘
                           │                      │
        ┌──────────────────┼──────────────────────┼───────────────────────┐
        │                  │                      │                       │
   ┌────┴────┐       ┌─────┴──────┐         ┌─────┴──────┐          ┌─────┴─────┐
   │  auth/  │       │ modules/*  │         │  portal/   │          │  layout/  │
   └────┬────┘       └─────┬──────┘         └─────┬──────┘          └─────┬─────┘
        │                  │                       │                      │
        └───────► layout/ ◄┘                       │                      │
                     │                              │                      │
                     └──────────────► App.tsx (main.tsx) ◄──────────────────┘
```

Dentro de `modules/*`, las dependencias cruzadas van siempre de un módulo
"consumidor" hacia el `api.ts` (y, en un caso, hacia utilidades de formato) de
un módulo "proveedor", nunca en ambos sentidos entre el mismo par de módulos:

```text
pacientes  ──uses──►  agenda/api.ts
pacientes  ──uses──►  historial/api.ts, eventoHistorial.ts
historial  ──uses──►  inventario/api.ts
compras    ──uses──►  inventario/api.ts
facturacion──uses──►  pacientes/PropietarioAutocomplete.tsx
dashboard  ──uses──►  agenda/api.ts, inventario/api.ts, facturacion/api.ts, compras/api.ts
layout     ──uses──►  inventario/api.ts
portal     ──uses──►  pacientes/edad.ts, facturacion/formato.ts
```

No hay ningún ciclo: por ejemplo, `agenda` no importa nada de `pacientes`, y
`inventario` no importa nada de `historial` ni de `compras`.

## 4. Paquetes del backend (`supabase/`)

```text
supabase/
├── config.toml       → configuración de la CLI (puertos, auth, storage…)
├── seed.sql          → datos iniciales (roles, catálogos, usuarios y datos de demostración)
├── migrations/       → 14 archivos SQL, esquema versionado
└── functions/
    ├── .env.example
    ├── admin-usuarios/
    │   └── index.ts
    └── portal-acceso/
        ├── index.ts
        └── smtp.ts
```

### `migrations/`
No está subdividido en carpetas, pero cada archivo tiene una responsabilidad
propia y una dependencia estricta de orden (por *timestamp* en el nombre; ver
Documento 5 para el detalle completo de cada uno):

1. `20260818151454_initial_schema.sql` — esquema base (sin dependencias previas).
2. `20260818151644_business_rules.sql` — depende de (1): triggers y vistas sobre
   las tablas que crea (1).
3. `20260818151648_row_level_security.sql` — depende de (1): políticas sobre
   esas mismas tablas.
4. `20260819072616_facturacion.sql` a
   `20260819075223_propietario_facturado_para_administrador.sql` — dependen de
   (1)-(3).
5. `20260825163425_administracion.sql` — depende de (1)-(3) (modifica
   `fn_rol_actual`, agrega tablas nuevas y sus políticas).
6. `20260826055525_historial_signos_vitales.sql` a
   `20260826070355_portal_propietario.sql` — cada una depende de (1)-(3) y, en
   el caso de `..._portal_propietario.sql`, además reconstruye una restricción
   `EXCLUDE` creada en (1).

### `functions/admin-usuarios/`
- **Responsabilidad:** ciclo de vida de cuentas de personal (crear, activar,
  desactivar, restablecer contraseña) sobre `auth.users`, usando la
  `service_role` key.
- **Depende de:** la tabla `usuario` de PostgreSQL (con `GRANT` explícito a
  `service_role`, agregado en `..._administracion.sql`).

### `functions/portal-acceso/`
- **Responsabilidad:** ciclo de vida de cuentas de portal (`manual`,
  `automatico`, `restablecer`) sobre `auth.users` y la columna
  `propietario.id_usuario_portal`.
- **`index.ts`** depende de **`smtp.ts`** (`enviarCredencialesPortal`), que a su
  vez depende del paquete externo `npm:nodemailer@^9` y del servidor SMTP
  externo (ver Documento 2).
- **Depende de:** la tabla `propietario` de PostgreSQL (con `GRANT` explícito a
  `service_role`, agregado en `..._portal_propietario.sql`).

Las dos funciones Edge son paquetes independientes entre sí: ninguna importa
código de la otra.

## 5. Validación de coherencia

- Todas las dependencias cruzadas listadas en la sección 2 se verificaron
  contra las sentencias `import` reales de cada archivo, no se infirieron por
  convención.
- No se representa ninguna dependencia de `modules/*` hacia `layout/` o
  `App.tsx`: la relación real es la inversa (`layout/` y `App.tsx` importan
  las páginas de cada módulo para enrutarlas), y así se dibuja.
- `portal/` se documenta como paquete hermano de `modules/`, no como
  subpaquete de él, porque ninguna página de `modules/*` lo importa y porque
  el propio código lo señala como una rama de identidad deliberadamente
  aparte (comentario en `App.tsx` y en `PortalAuthContext.tsx`).
