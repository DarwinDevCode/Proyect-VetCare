# Rediseño completo de VetCare — plan de implementación

> **Estado (2026-08-26):** Plan **completo** — las 7 fases (0, 1 con 1a-1e, 2, 3, 4, 5 y 6)
> están terminadas y verificadas. Este documento queda como referencia histórica del plan
> tal como se aprobó con el cliente antes de escribir código (sección "Fases de ejecución"
> actualizada con el estado real de cada fase, incluidas las desviaciones deliberadas sobre
> lo planeado originalmente). El detalle de *qué* se hizo exactamente en cada fase, con las
> decisiones tomadas durante la implementación, está documentado en `CLAUDE.md`, sección 14
> — este archivo no lo repite. Para retomar trabajo relacionado en otra sesión: leer
> `CLAUDE.md` completo primero (fuente de verdad del estado del proyecto).

## Contexto

El usuario aportó un proyecto de Claude Design con 22 pantallas de escritorio que cubren
los cinco módulos existentes más un nuevo sistema visual ("Organic": paleta terracota/oliva,
tipografía Caprasimo para encabezados y Figtree para cuerpo, controles tipo píldora,
sombras suaves). Al leer las 22 pantallas se encontró que tres reintroducen funcionalidad
que la ERS excluye explícitamente ("Fuera del alcance"), y una contradice un supuesto
arquitectónico de fondo (que el propietario no es usuario del sistema).

Se consultó al usuario sobre las decisiones de alcance que resultan de eso (con
AskUserQuestion, no asumidas):

1. **Portal del propietario (1u)** → **Construir de verdad.** Acceso emitido por Recepción
   desde la ficha del propietario, no autoregistro público.
2. **Compras y proveedores (1p)** → **Construir de verdad.**
3. **Lista de espera (1h)** → **Tabla real, sin notificación** por WhatsApp/Email/SMS (sigue
   fuera de alcance).
4. **Lotes y vencimiento en Inventario (1n/1o)** → **Versión ligera**: metadata sobre
   `movimiento_inventario`, sin tocar `fn_actualizar_existencia` (ya probado, garantía real
   de RN-010).
5. **Ritmo de entrega** → **Por fases, con revisión entre cada una** — el mismo patrón con el
   que se construyó el resto del proyecto (un módulo, se prueba, se commitea, se sigue), no
   una sola pasada gigante.

Esto no es un reskin: son dos módulos funcionales nuevos (Portal del propietario, Compras y
Proveedores) del mismo tamaño que los Módulos 4/5, más una lista de espera, más un rediseño
visual completo. Se documentará como una ampliación deliberada de alcance en `CLAUDE.md`,
siguiendo el patrón ya usado para el Módulo 6 (Administración): cada adición cita qué línea
de "Fuera del alcance" está modificando y por qué.

## Dos hallazgos de arquitectura que condicionan el plan (verificados contra el código real)

**1. El auth de personal no puede extenderse para cubrir al portal.** `AuthContext.tsx`
exige una fila en `public.usuario` para considerar autenticado a cualquier `auth.users`: si
el join falla, la sesión queda `null`, se redirige a `/ingresar` con "Contacta al
Administrador del sistema". `SesionVetCare.rol` es no-opcional y se usa en cada página. Una
cuenta de portal (que por diseño **no** debe tener fila en `usuario`, esa tabla es solo de
personal) sería rechazada por este flujo tal como está.

→ El portal es un árbol de rutas y un contexto de autenticación **completamente aparte**
(`/portal/*`), no una extensión de `RolCodigo`/`usuario`/`AuthContext`. Extender esos tipos
corrompería el modelo de rol del que ya dependen ~40 políticas RLS vía `fn_rol_actual()`.

**2. El `EXCLUDE` de solapamiento de citas no admite una cita sin veterinario asignado.**
Verificado directamente en `supabase/migrations/20260818151454_initial_schema.sql`:

```sql
id_veterinario  uuid not null references public.usuario (id_usuario) on delete restrict,
estado          varchar(12) not null default 'programada' check (estado in ('programada', 'cancelada', 'atendida')),
exclude using gist (
  id_veterinario with =,
  tstzrange(fecha_hora_inicio, fecha_hora_fin) with &&
) where (estado <> 'cancelada')
```

`id_veterinario` es `not null`, y solo existen tres estados. Una "solicitud de cita" desde
el portal (donde el dueño no elige veterinario/horario exacto, solo motivo + mascota) no
puede insertarse tal cual sin: (a) volver `id_veterinario` nullable, (b) agregar `'solicitada'`
al `CHECK` de `estado`, (c) **recrear** el `EXCLUDE` (drop + create, Postgres no permite
`ALTER` sobre uno) con `where (estado in ('programada', 'atendida'))` en vez de
`<> 'cancelada'`, para que una solicitud no compita por el índice hasta que el personal la
confirme asignando veterinario/horario real — momento en que pasa a `'programada'` y el
`EXCLUDE` sí la protege con la misma garantía de siempre.

Es un cambio real sobre una restricción ya aprobada y probada. Se documenta como tal, no se
hace en silencio — es la pieza de mayor riesgo de todo el plan.

## Resolución pantalla por pantalla

| # | Pantalla | Resolución |
|---|---|---|
| 1a | Dashboard: alertas + KPIs | **Nueva.** Home agregando datos de Agenda/Facturación/Inventario que el rol ya puede leer — sin ampliar RLS. |
| 1b | Listado pacientes | Reskin del listado existente (RF-007). |
| 1c | Ficha de paciente | Reskin, tabs Resumen/Historial/Vacunas/Citas/Facturas. **Tab "Documentos" se omite**: sin RF/RN que lo respalde, exigiría Supabase Storage + tabla nueva — fuera de este plan. |
| 1d | Alta en 2 pasos | Reestructura de UI del diálogo único actual (RF-004/005), sin cambio de esquema. |
| 1e | Errores + duplicado | UX amigable sobre el `UNIQUE` que ya existe en `propietario.identificacion`, sin cambio de esquema. |
| 1f | Agenda semanal | Reskin/reestructura del grid actual (RF-011 a RF-015). |
| 1g | Agendar cita | Reskin. **Se quita el cuadro de notificación WhatsApp** — sigue fuera de alcance. |
| 1h | Lista de espera | **Tabla nueva real**, sin notificación. |
| 1i | Modificar/cancelar cita | Reskin. Se conecta "Liberar cupo a lista de espera"; se quita "Notificar al dueño". |
| 1j | Historial cronológico | Reskin + "Exportar PDF" con el mismo patrón `window.print()` + `@media print` de RI-005 — sin dependencia nueva. |
| 1k | Consulta en curso | Reskin + signos vitales (temperatura, FC, FR) — columnas nullable nuevas en `consulta`. |
| 1l | Carnet de vacunas | Reskin + fecha "próxima" por vacuna — `intervalo_dias` nullable en `producto` + vista nueva, mismo patrón que `v_historial_clinico`. |
| 1m | Exámenes de laboratorio | Reskin. **Se mantiene el estado binario actual**; el tercer estado "en proceso" del wireframe es solo visual, se pliega en "pendiente". |
| 1n | Stock con alertas | Reskin + botón hacia el módulo nuevo de Compras. |
| 1o | Detalle de producto + Lotes | Reskin. Lote/vencimiento **ligero**: columnas nuevas en `movimiento_inventario` (`lote_codigo`, `fecha_vencimiento`), solo en ingresos — `fn_actualizar_existencia` intacta. |
| 1p | Alerta de nivel mínimo | Reskin + **módulo nuevo real** Compras y Proveedores. |
| 1q | Nueva factura | Reskin de `NuevaFacturaDialog` a flujo de página completa. |
| 1r | Pago mixto | Una sola acción que inserta varias filas en `pago` (RN-015 ya lo permite), sin cambio de esquema. Se quitan "Yape/Plin"/"Crédito" — `forma_pago` sigue en efectivo/tarjeta/transferencia. |
| 1s | Listado de facturas | Reskin + separar "Reportes" de "Facturación" como rutas distintas (hoy es pestaña) — reestructura de UI, no cambio de alcance. |
| 1t | Reporte de ingresos | Reskin de `ReporteIngresos.tsx`. |
| 1u | Portal del propietario | **Módulo nuevo real**, auth y RLS separados (ver hallazgo #1). |
| 1v | Estados vacíos/permisos/error | Checklist transversal a aplicar en cada fase, no una pantalla aparte. |

Nota de moneda: el wireframe usa soles peruanos ("S/"); el proyecto es Ecuador/USD
(`Intl.NumberFormat('es-EC', {currency:'USD'})`). Se mantiene USD en toda la implementación.

> **Nota (Fase 1 ya ejecutada):** 1q se mantuvo como diálogo ampliado (`maxWidth="lg"`), no
> se convirtió en página completa — desviación deliberada, ver CLAUDE.md sección 14, Fase 1e.
> La pestaña "Facturas" de 1c también quedó fuera de la Fase 1 por falta de una decisión de
> producto previa (ver Fase 1a en CLAUDE.md).

## Migraciones nuevas (orden de dependencia)

Nombres a usar con `npx supabase migration new <nombre>` (los timestamps los genera el CLI).

| # | Nombre | Contenido |
|---|---|---|
| 1 | `historial_signos_vitales` | `consulta` + `temperatura_c numeric(4,1)`, `frecuencia_cardiaca_lpm smallint`, `frecuencia_respiratoria_rpm smallint` — nullable, sin trigger nuevo. |
| 2 | `vacunas_intervalo_y_proxima` | `producto` + `intervalo_dias integer` nullable. Vista `v_vacunas_proximas` (por paciente+vacuna: última aplicación + intervalo = próxima), `security_invoker = on`, mismo patrón que `v_historial_clinico`. |
| 3 | `inventario_lotes_vencimiento` | `movimiento_inventario` + `lote_codigo varchar(30)`, `fecha_vencimiento date` nullable, poblados solo en `'ingreso'`. Vista `v_lotes_por_vencer` (ingresos con vencimiento ≤ 30 días). **No toca `fn_actualizar_existencia`.** |
| 4 | `lista_espera` | Tabla `lista_espera` (paciente, veterinario nullable, fecha/franja preferida, motivo, `estado` pendiente/atendida/cancelada, usuario_registro). RLS: Recepcionista escribe, Veterinario solo lee — mismo patrón que Módulo 2. Sin `DELETE` (RF-033). |
| 5 | `compras_proveedores` | Tablas `proveedor`, `orden_compra` (estado borrador/emitida/recibida/cancelada), `detalle_orden_compra`. `movimiento_inventario` + `id_orden_compra` nullable (no colisiona con `chk_movimiento_origen`, que solo habla de `id_consulta`/`id_vacunacion`). Trigger `fn_recibir_orden_compra` (`AFTER UPDATE ... WHEN (new.estado='recibida' AND old.estado<>'recibida')`): por cada línea, inserta un `movimiento_inventario` `'ingreso'` — mismo patrón exacto que `fn_vacunacion_descuenta_inventario` (verificado, ver abajo). RLS: solo Administrador. `GRANT` explícito a `authenticated` sobre las tres tablas nuevas. |
| 6 | `portal_propietario` | `propietario` + `id_usuario_portal uuid unique references auth.users(id) on delete set null` nullable. Función `fn_propietario_actual()` (`security definer`, análoga a `fn_rol_actual()`, devuelve `id_propietario` desde `auth.uid()`). En `cita`: `id_veterinario` pasa a nullable, `CHECK` de estado agrega `'solicitada'`, se recrea el `EXCLUDE` con `where (estado in ('programada','atendida'))` (ver hallazgo #2). Políticas RLS *identity-scoped* nuevas (no basadas en `fn_rol_actual()`, que da `null` para cuentas de portal — eso ya las excluye de las ~40 políticas de staff sin tocarlas): lectura de `paciente`/`cita`/`factura`/`detalle_factura`/`pago` propios, más `cita_insert_portal` (`with check (estado='solicitada' and id_veterinario is null and el paciente es del propietario que llama)`). Vista `v_carnet_portal` (vacunas + próxima fecha, **sin** exponer `consulta`/`examen_laboratorio` — respeta RN-006 también para el portal). `grant select, update on public.propietario to service_role` (mismo problema ya documentado en CLAUDE.md sección 9: service_role no hereda privilegios sobre tablas existentes tocadas por una función nueva). |

**Trigger mirror verificado** — `fn_vacunacion_descuenta_inventario` (ya en producción):
```sql
insert into public.movimiento_inventario (
  id_producto, tipo_movimiento, cantidad, fecha_hora,
  id_usuario, id_vacunacion, observacion
) values (
  new.id_producto, 'consumo', -new.dosis, now(),
  new.id_veterinario, new.id_vacunacion, 'Descuento automatico por vacunacion aplicada'
);
```
`fn_recibir_orden_compra` sigue exactamente esta forma (insertar `movimiento_inventario` desde
un trigger disparado por un evento en otra tabla, dentro de la misma transacción).

**Edge Function nueva**: `supabase/functions/portal-acceso/index.ts`, calcada de
`supabase/functions/admin-usuarios/index.ts` (mismo patrón: verifica con la clave anon quién
llama, exige `rol='recepcionista'` activo, y solo entonces usa la `service_role` key para
crear el `auth.users` y vincularlo a `propietario.id_usuario_portal`).

**`supabase/seed.sql`**: agregar una 4ª identidad de prueba —
`propietario@vetcare.local` / `VetCare#2026`, con `id_usuario_portal` ya vinculado — para
probar RLS de portal en local sin pasar por la Edge Function cada vez. Mismo aviso de la
sección 10 de CLAUDE.md: nunca correr este seed contra datos reales.

## Numeración RF/RN/RI y documentación de alcance

Antes de escribir código: una **sección 14 nueva en CLAUDE.md**, siguiendo el formato exacto
de la sección 13 (Módulo 6) — cada pieza cita qué línea de "Fuera del alcance" amplía y
cierra con la fórmula ya usada: *"por instrucción explícita del cliente del proyecto, no por
reinterpretación propia del SRS"*.

- **Rediseño visual** (Fases 0-1): no es alcance nuevo — reinterpretación de RNF-011/RES-04. Sin numeración, solo nota de que `theme.ts` cambia y por qué.
- **RF-034/035 — Lista de espera** (Módulo 2): amplía RF-011. No contradice ningún "Fuera del alcance" — la ampliación más pequeña de las tres, documentar en pocas líneas.
- **RF-036 a 039 — Compras y Proveedores** (Módulo 7 nuevo): cita la sección 2 de CLAUDE.md, donde ya se documentó que el `.docx` de arquitectura superado incluía "D6 Proveedores" y el SRS final lo excluyó explícitamente — construir esto ahora reabre, por instrucción del cliente, justo lo que el SRS final había cerrado.
- **RF-040 — Signos vitales**: amplía RF-016.
- **RF-041 — Próxima dosis de vacuna**: amplía RF-018.
- **RF-042 a 045 — Portal del propietario** (Módulo 8 nuevo): cita la sección 1 ("El propietario no es usuario del sistema") — el punto de mayor tensión con el alcance original, mismo peso que Módulo 6, con aclaración explícita de que RN-006 sigue intacto (el portal nunca expone diagnóstico/hallazgos/tratamiento).
- **RN-020**: identity-scoping del portal. **RN-021**: una cita `'solicitada'` no reserva cupo real hasta confirmación del personal. **RN-022**: una orden de compra `'recibida'` genera su ingreso automáticamente, una sola vez, en la misma transacción.
- **RI-008**: Edge Function `portal-acceso`, segundo caso del mismo patrón que `admin-usuarios`.

## Extensión del tema MUI

`theme.ts` (versión previa a Fase 0, 27 líneas) solo definía `palette.primary/secondary/
background`, `typography.fontFamily` único, `shape.borderRadius: 10`, y overrides de
`MuiButton`/`MuiTextField`. Se extendió, no se reemplazó — **ya ejecutado en Fase 0**, ver
CLAUDE.md sección 14 para el detalle real de lo implementado:

- **Tokens Organic** como constante `ORGANIC` exportada (rampas neutral/accent/accent-2 en
  100-900, radios, sombras) — los `color-mix()` de la hoja original se precalculan a `rgba()`
  fijo, más seguro que depender de soporte de `color-mix` en todos los targets.
- **Fuentes**: `@fontsource/figtree` + `@fontsource/caprasimo` (paquetes npm, no `<link>` a
  Google Fonts — más robusto, no depende de una CDN en tiempo de ejecución), importados en
  `main.tsx` junto al `import './index.css'` ya existente. `index.html` no se toca.
- **Componentes**: `MuiButton`/`MuiChip`/`MuiOutlinedInput`/`MuiToggleButton` a `borderRadius:
  999` (píldora); `MuiDialog`/`MuiCard` a `ORGANIC.radius.lg/md`; sombras puntuales en
  `MuiDialog`/`MuiAppBar`. No se reescribe el arreglo completo de 24 `theme.shadows` — la
  mayoría de tablas usan `Paper variant="outlined"`, no vale la pena el riesgo.
- **`AppLayout.tsx`**: el contrato que no se toca es `modulosParaRol(rol.codigo)` como única
  fuente de verdad del nav (RI-002) — solo cambia el marcado visual de cada
  `ListItemButton`, nunca la lógica de filtrado. Se agrega una entrada "Dashboard" al
  principio de `MODULOS` (no como caso especial fuera del array). Topbar nuevo: buscador
  (redirige a `/pacientes?q=...` reutilizando el buscador ya existente, sin backend nuevo) +
  campana conectada a `v_alerta_stock` (ya existe, sin tabla de notificaciones nueva).
  **Nota:** la entrada "Dashboard" en el nav se pospuso realmente a la Fase 6 (ver CLAUDE.md,
  Fase 0) — no se agregó en Fase 0 como preveía este plan.
- **`App.tsx`**: el portal vive en una rama de rutas **paralela y hermana**, no anidada
  dentro de `RutaProtegida > AppLayout`:
  ```tsx
  <Route path="/portal/*" element={<PortalAuthProvider><PortalApp /></PortalAuthProvider>} />
  ```
  El `AuthProvider` de personal sigue montado por fuera y sigue corriendo para cualquier
  sesión de staff activa, pero las páginas de `/portal/*` nunca leen su `sesion`/
  `errorPerfil` — su fallo silencioso al no encontrar fila en `usuario` para una cuenta de
  portal no afecta nada visible ahí. No se intenta "arreglar" el flujo de staff para que
  reconozca cuentas de portal — sería corromper el modelo de rol del que dependen ~40
  políticas RLS.

## Fases de ejecución

| Fase | Contenido | Estado |
|---|---|---|
| **0** | Tema Organic + fuentes + restructuración de `AppLayout`/`modulos.ts`, sin tocar ningún módulo funcional. | ✅ **Completada** — commit [`c410587`](../../commit/c410587) *(Rediseno Organic - Fase 0: tema visual y shell de navegacion)*. Detalle real en CLAUDE.md §14. |
| **1** | Reskin de los 5 módulos existentes + Administración, en orden RF (Pacientes → Agenda → Historial → Inventario → Facturación/Reportes). Incluye 1b-1g, 1i, 1j-1m (sin vitals/próxima dosis todavía), 1n-1o (sin lotes todavía), 1q-1t. | ✅ **Completada**, en 5 commits: [`8e5d56d`](../../commit/8e5d56d) Fase 1a Pacientes, [`6ed3c6c`](../../commit/6ed3c6c) Fase 1b Agenda, [`4e56890`](../../commit/4e56890) Fase 1c Historial, [`713d5ac`](../../commit/713d5ac) Fase 1d Inventario, [`064aa44`](../../commit/064aa44) Fase 1e Facturación/Reportes. Detalle real y desviaciones documentadas en CLAUDE.md §14. |
| **2** | Migraciones 1-3 (vitals, próxima dosis, lotes/vencimiento) + UI en los diálogos existentes de Historial e Inventario. | ✅ **Completada** — detalle real y una desviación deliberada (`v_historial_clinico` sí se tocó) en CLAUDE.md §14. |
| **3** | Migración 4 (lista de espera) + UI dentro de Agenda (1h, wiring en 1i). | ✅ **Completada** — detalle real en CLAUDE.md §14. |
| **4** | Migración 5 (Compras y Proveedores) + módulo `modules/compras/` completo. | ✅ **Completada** — detalle real en CLAUDE.md §14. |
| **5** | Migración 6 (Portal) + Edge Function `portal-acceso` + `frontend/src/portal/*` completo + botón "Dar acceso al portal" en Pacientes. | ✅ **Completada** — la de mayor riesgo arquitectónico del plan. Detalle real (con dos bugs reales encontrados y corregidos) en CLAUDE.md §14. |
| **6** | Dashboard real (1a): KPIs, agenda del día, accesos rápidos. | ✅ **Completada** — cierra el plan completo. Detalle real (incluido un bug de entorno real, no de código) en CLAUDE.md §14. |

Razón del orden (por qué cada fase depende de la anterior):

- **0 antes que todo**: todo lo demás depende visualmente de esto; hacerlo una vez evita
  repintar cada módulo dos veces.
- **1 antes que los módulos nuevos**: cero cambio de esquema ni RF nuevo en esta fase — solo
  el lenguaje visual sobre flujos ya probados. Hacerlo antes evita construir los módulos
  nuevos (2-6) dos veces (una vez con el look viejo, otra con el nuevo).
- **2 primero entre las fases nuevas**: cambios de esquema pequeños y aislados (columnas
  nullable), bajo riesgo, desbloquean 1k/1l/1o sin depender de módulos nuevos.
- **3 después de 2**: extensión natural de Agenda, ya reskineada en Fase 1; sin dependencia
  de Compras ni Portal.
- **4 después de 3**: aislado, sin dependencia de Portal; nace directamente con el lenguaje
  visual final.
- **5 al final de las fases de construcción**: la pieza de mayor riesgo arquitectónico
  (identidad paralela, `EXCLUDE` modificado) va cuando el resto ya es estable — más fácil
  aislar cualquier regresión.
- **6 al final de todas**: depende de que Agenda/Lista de espera/Facturación/Inventario ya
  tengan datos reales — antes solo darían KPIs de mentira que habría que rehacer.

`1v` no es fase aparte: checklist transversal (empty-state, mensaje de sin-permiso ya cubierto
por `RutaProtegida`, reintento en errores de red) a aplicar en cada fase.

## Verificación por fase

Mismo patrón ya establecido en el proyecto: `npx supabase db reset` limpio + `curl` con JWT
real por cuenta para RLS + navegador con las cuentas de prueba + `npm run build` (no
`tsc --noEmit` suelto — ver nota de Fase 1b en CLAUDE.md §14 sobre por qué).

- **Fase 0** *(completada)*: `npm run build` limpio; verificar visualmente que
  `modulosParaRol` sigue mostrando exactamente lo mismo por rol que antes (comparar contra
  la matriz 3.8) — el cambio es puramente visual, cualquier diferencia de qué aparece en el
  nav es regresión.
- **Fase 1** *(completada)*: repetir literalmente las pruebas ya documentadas por módulo en
  CLAUDE.md sección 9 — el criterio de "listo" es comportamiento idéntico al de antes, solo
  con el look nuevo. Sin RLS nuevo que probar.
- **Fase 2**: `db reset` limpio; registrar consulta con vitals y verla en el timeline; aplicar
  dos vacunas del mismo producto con intervalo y confirmar que "próxima" se recalcula;
  registrar un ingreso con lote/vencimiento; confirmar por `curl` que
  `fn_actualizar_existencia` sigue intacta (existencia nunca negativa, igual que siempre).
- **Fase 3**: `curl` RLS (Veterinario forzando `INSERT` en lista de espera → 403); en
  navegador, cancelar una cita real y ver que aparecen coincidencias de la lista de espera.
- **Fase 4**: `curl` RLS (Recepcionista/Veterinario forzando `orden_compra` → 403); marcar una
  orden `'recibida'` y confirmar que `existencia_actual` sube lo esperado, una fila
  `movimiento_inventario` por línea, y que un segundo `UPDATE` a `'recibida'` sin cambio real
  no dispara nada (`WHEN (new.estado='recibida' AND old.estado<>'recibida')`).
- **Fase 5 (la más crítica)**: crear la 4ª cuenta vía la Edge Function real (no solo seed)
  desde `recepcion@vetcare.local`, confirmar `403` desde `veterinario@vetcare.local`; con el
  JWT del propietario, `curl` confirmando que `select * from paciente` da solo sus mascotas,
  que `consulta`/`examen_laboratorio` dan `[]` (RN-006 intacto también para el portal), que
  un `insert` de `cita` con `id_veterinario` no nulo o con `id_paciente` ajeno es rechazado;
  en navegador, personal confirma una `'solicitada'` asignando veterinario/horario y se
  fuerza el mismo horario dos veces — la segunda debe fallar con `23P01`, mensaje ya mapeado.
- **Fase 6** *(completada)*: verificación visual/funcional con las tres cuentas — detalle
  real (con un bug de entorno real encontrado y resuelto) en CLAUDE.md §14.

## Archivos por fase (nuevo vs. modificado)

**Fase 0** *(completada)* — Modificar: `theme.ts`, `main.tsx`, `AppLayout.tsx`,
`modulos.ts`, `package.json`.

**Fase 1** *(completada)* — Modificar por módulo: `PacientesPage.tsx`/`FichaDialog.tsx`/
`NuevoPacienteDialog.tsx` (wizard 2 pasos); `AgendaGrid.tsx`/`AgendaPage.tsx`/
`NuevaCitaDialog.tsx`; `HistorialPage.tsx`/`EventoHistorialItem.tsx` (+ exportar PDF);
`InventarioPage.tsx`/`ProductoDetalleDialog.tsx`; `FacturacionPage.tsx` (quitar tab
Reportes)/`NuevaFacturaDialog.tsx`/`RegistrarPagoDialog.tsx`. Nuevo:
`facturacion/ReportesPage.tsx` (envoltorio sobre `ReporteIngresos.tsx`), ruta `/reportes`.

**Fase 2** *(completada)* — Nuevo: migraciones 1-3. Modificar: `types/dominio.ts` (campos
vitals, `intervalo_dias`, lote/vencimiento, tipos de las 2 vistas nuevas);
`NuevaConsultaDialog.tsx`, `NuevaVacunacionDialog.tsx`, `historial/api.ts`;
`NuevoProductoDialog.tsx`, `ProductoDetalleDialog.tsx` (panel Lotes),
`InventarioPage.tsx` (alerta por vencer), `inventario/api.ts`.

**Fase 3** *(completada)* — Nuevo: migración 4; `ListaEsperaTab.tsx`,
`NuevaListaEsperaDialog.tsx`, funciones en `agenda/api.ts`. Modificar: `AgendaPage.tsx`,
`CitaDetalleDialog.tsx`, `types/dominio.ts`.

**Fase 4** *(completada)* — Nuevo: migración 5; módulo `modules/compras/` completo
(`ComprasPage.tsx`, `ProveedoresTab.tsx`, `OrdenesCompraTab.tsx`, diálogos, `api.ts`); ruta
`/compras` (`roles: ['administrador']`). Modificar: `InventarioPage.tsx`/
`ProductoDetalleDialog.tsx` (botón "Generar orden de compra"), `types/dominio.ts`.

**Fase 5** *(completada)* — Nuevo: migración 6; `supabase/functions/portal-acceso/index.ts`;
`frontend/src/portal/` completo (`PortalAuthContext.tsx`, `PortalRutaProtegida.tsx`,
`PortalApp.tsx`, `PortalLayout.tsx`, `LoginPortalPage.tsx`, páginas de mascotas/citas/
facturas del propietario, `api.ts` identity-scoped). Modificar: `App.tsx` (rama
`/portal/*`), `FichaDialog.tsx` (botón "Dar acceso al portal"), `CitaDetalleDialog.tsx`
(confirmar una `'solicitada'`), `types/dominio.ts` (`EstadoCita` + `'solicitada'`,
`Propietario.id_usuario_portal`).

**Fase 6** *(completada)* — Nuevo: `modules/dashboard/api.ts` (tres resúmenes, uno por rol,
componiendo funciones ya existentes de `agenda`/`inventario`/`facturacion`/`compras`),
`modules/dashboard/DashboardPage.tsx`. Modificar: `App.tsx` (`InicioPorRol` ahora es
`<Navigate to="/inicio" />`; ruta `/inicio` nueva), `modulos.ts` (entrada "Dashboard",
primera del array, `ruta: '/inicio'`), `layout/AppLayout.tsx` (campana conectada a
`producto`), `main.tsx` (`dayjs.locale('es')` activado globalmente). Detalle real,
incluidas dos precisiones sobre lo planeado aquí (redirect en vez de render directo en
`"/"`; campana navega a `/inicio` y no a `/inventario`), en CLAUDE.md §14.

## Plan cerrado

Con la Fase 6 se completaron las 7 fases del plan. No queda ningún trabajo pendiente de
este documento — cualquier trabajo nuevo sobre VetCare que surja de aquí en adelante
(nuevos RF, otro rediseño, otra ampliación de alcance) debería documentarse en un plan
aparte, siguiendo el mismo patrón: un archivo `.md` propio en la raíz del repo, referenciado
desde `CLAUDE.md`, no reutilizando este archivo ya cerrado.
