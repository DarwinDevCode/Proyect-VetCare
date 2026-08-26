# Pruebas de VetCare

Catálogo de todo lo que se ha probado en el proyecto, organizado en tres categorías
(funcionales, regresión, revisiones técnicas) y con referencia a la prueba automatizada
correspondiente cuando existe. La verificación completa, fase por fase y con el detalle de
cada cuenta usada y cada resultado observado, vive en `CLAUDE.md` — este documento es un
índice de navegación rápida, no la reemplaza.

No hay un runner común entre los tres ecosistemas del proyecto (no existe uno natural entre
Vite/frontend, Deno/Edge Functions y Postgres), así que cada uno se corre por separado:

| Ecosistema | Comando | Requiere |
|---|---|---|
| Frontend (Vitest) | `cd frontend && npm run test` | nada adicional |
| Edge Functions + integración (Deno test) | `deno test --allow-net --allow-env supabase/tests` (desde la raíz) | `supabase start` corriendo — la mayoría llama al stack local real; `deno test` ignora los `.sql` de esta misma carpeta, no hace falta filtrarlos |
| Base de datos (pgTAP) | `cd supabase && npx supabase test db --local` | `supabase start` corriendo |

Toda la suite Vitest vive en `frontend/src/test/`, y toda la suite Deno (Edge Functions +
integración) vive en `supabase/tests/` junto a las pruebas pgTAP — ninguna co-ubicada junto a su
módulo o función, que era el patrón inicial de los primeros archivos de ambas suites. Pedido
explícito del cliente ("todos esos test deben estar en la carpeta test", y luego "¿y en
supabase?"). El nombre de archivo indica qué prueba (`agenda-disponibilidad.test.ts`,
`dashboard-api.test.ts`, `portal-acceso.test.ts`, etc.); los pares que se hubieran llamado igual
en su ubicación original se distinguen con un prefijo del módulo (`pacientes-edad.test.ts` vs.
`historial-edad.test.ts`, `layout-notificaciones.test.ts` vs. `portal-notificaciones.test.ts`) o,
para las Edge Functions, con el nombre de la función en vez del genérico `index.test.ts` que
tenían las tres (`portal-acceso.test.ts`, `portal-olvide-password.test.ts`).

Cada archivo de prueba de base de datos corre dentro de `BEGIN; ... ROLLBACK;`: nunca deja
datos residuales, aunque cree sus propios fixtures.

## 1. Pruebas funcionales

Lo que verifica que cada módulo hace lo que el RF le exige. La enorme mayoría de esto se
probó **manualmente** — navegador con las cuentas de prueba y `curl` con JWT real de cada
rol — y está documentado en detalle en `CLAUDE.md`, sección "Estado del proyecto" y sección
14 (rediseño Organic). Solo una parte pequeña tiene además una prueba automatizada dedicada:
esta primera pasada de automatización, según su propia filosofía documentada, cubrió "lo más
crítico y lo más reciente", no cobertura exhaustiva.

| Módulo | Verificado (manual, ver CLAUDE.md) | Prueba automatizada |
|---|---|---|
| Login (personal y portal) | Credenciales incorrectas, campos vacíos, credenciales correctas, "¿Olvidaste tu contraseña?" | `frontend/src/test/LoginPage.test.tsx`; `LoginPortalPage.test.tsx`; `supabase/tests/auth_login_integration.test.ts` (contra el Auth real) — ver `ANALISIS_LOGIN.md` |
| 1. Pacientes y Propietarios | Alta en 2 pasos, detección de duplicado por identificación, ficha con pestañas por rol, búsqueda por mascota/cédula/propietario | `frontend/src/test/pacientes-edad.test.ts` (cálculo de edad, RF-010) |
| 2. Agenda y Citas | Disponibilidad en vivo con sugerencias, reprogramar/cancelar, vista semanal, lista de espera, solicitudes desde el portal | `frontend/src/test/agenda-disponibilidad.test.ts` (chequeo cliente, RF-011); `agenda-useDisponibilidadCita.test.ts` (el hook completo, con debounce y su regresión de "reabrir el diálogo"); `rn004_solapamiento_citas_test.sql` (garantía real del `EXCLUDE`) |
| 3. Historial Clínico | Consulta + vínculo con cita, vacunación con descuento automático, examen con resultado diferido, signos vitales, próxima dosis | `frontend/src/test/fechas.test.ts` (formato de fecha del timeline); `eventoHistorial.test.ts` (mapeo posicional de `v_historial_clinico`); `historial-edad.test.ts`; ninguna del flujo clínico de alta completo |
| 4. Inventario y Medicamentos | Alta de producto, ingreso/ajuste/consumo, alertas de stock mínimo y lotes por vencer | `rn010_existencia_no_negativa_test.sql` (garantía real del trigger) |
| 5. Facturación y Reportes | Emisión desde atención o servicio suelto, numeración, pagos mixtos, reporte de ingresos, impresión | `supabase/tests/fn_emitir_factura_integration.test.ts` (RPC real: RN-012/RN-013/RN-014, atomicidad, rol); `frontend/src/test/facturacion-formato.test.ts` |
| 6. Administración del sistema | Ciclo de vida de cuentas (crear/activar/desactivar/reset), roles, catálogos, parámetros, auditoría | `fn_auditar_cambio_test.sql` (bitácora, ver sección 2) |
| 7. Compras y Proveedores | Orden de compra borrador→emitida→recibida, descuento automático al recibir, protección contra doble recepción | ninguna |
| 8. Portal del propietario | Login separado de personal, mis mascotas/citas/facturas, solicitar y cancelar cita, cambiar/recuperar contraseña, imprimir factura | `fn_cancelar_cita_portal_test.sql`; `portal_tratamientos_estructural_test.sql`; `frontend/src/test/CambiarPasswordDialog.test.tsx`; `OlvidePasswordDialog.test.tsx`; `supabase/tests/portal-acceso.test.ts`; `supabase/tests/portal-olvide-password.test.ts` |
| Campana de notificaciones (personal y portal) + leídas/no leídas | Alertas por rol, marcar leída al navegar, persistencia en localStorage | `frontend/src/test/layout-notificaciones.test.ts`; `portal-notificaciones.test.ts`; `notificacionesLeidas.test.ts` |
| Navegación por rol (RI-002/SRS 3.8) | Cada rol ve exactamente los módulos que le corresponden | `frontend/src/test/modulos.test.ts` |
| Agregación del Dashboard (Fase 6) | KPIs por rol (citas de hoy, ingresos, stock, órdenes, facturas pendientes) | `frontend/src/test/dashboard-api.test.ts` |

## 2. Pruebas de regresión

Cada fila es un bug real que ya ocurrió una vez (documentado en `CLAUDE.md`, sección
"Problemas conocidos" y las notas de cada fase). Donde existe una prueba automatizada, está
pensada específicamente para que ese bug no pueda volver a colarse en silencio.

| Bug | Causa raíz | Prueba de regresión |
|---|---|---|
| Mensajes de `raise exception` propios (`P0001`) no llegaban al usuario | `lib/errors.ts` no contemplaba el código `P0001` | `frontend/src/test/errors.test.ts` (cada rama del switch, incluido `P0001`) |
| Embed de PostgREST sin `!inner` dejaba pasar `propietario: null` | Filtrar por un campo de un embed sin `!inner` no filtra las filas del padre | sin prueba automatizada — pendiente |
| RF-031 (Administrador ve facturas) contradecía la RLS de `propietario` (Módulo 1) | Política de `propietario` no incluía a Administrador | `rf031_propietario_facturado_administrador_test.sql` **(nuevo)** |
| `fn_auditar_cambio` reventaba con `record "new" has no field...` al sembrar `parametro_sistema` | Acceso a `new.<campo>` directo en un trigger compartido entre tablas con columnas distintas | `fn_auditar_cambio_test.sql` **(nuevo)** |
| Fechas de vacunación/examen del timeline retrocedían un día en husos detrás de UTC | Formatear una columna `date` (vía `timestamptz` a medianoche UTC) con la hora local del navegador | `frontend/src/test/fechas.test.ts` **(nuevo)**, sobre `soloFechaLocal` extraída de `EventoHistorialItem.tsx` |
| La sesión se perdía al cambiar de pestaña (personal y portal) | `onAuthStateChange` reaccionaba a cualquier evento (`TOKEN_REFRESHED`/`INITIAL_SESSION` redundante), no solo a un cambio real de usuario | sin prueba automatizada — no se pudo forzar la condición exacta en el entorno de prueba (ver CLAUDE.md, limitación documentada explícitamente) |
| `useDisponibilidadCita` no recargaba al reabrir el diálogo de nueva cita para el mismo veterinario/día | Dependencias del efecto no incluían nada que cambiara en cada apertura | `frontend/src/test/agenda-useDisponibilidadCita.test.ts` **(nuevo)** — cierra/reabre con el mismo veterinario/fecha y confirma que sí vuelve a consultar |
| `service_role` no recibía `GRANT` automático sobre tablas nuevas | El privilegio SQL se comprueba antes que RLS; versiones recientes del CLI no lo dan gratis | cubierto indirectamente por `supabase/tests/portal-acceso.test.ts` (ejercita la Edge Function real contra el stack local) |
| XSS en el HTML de los correos de credenciales (`nombrePropietario` con `<script>`) | Interpolación sin escapar en la plantilla del correo | `supabase/tests/portalPassword.test.ts` (regresión de XSS explícita sobre `plantillaHtml`) |
| Enumeración de cuentas vía "olvidé mi contraseña" | — (propiedad de diseño, no un bug corregido) | `supabase/tests/portal-olvide-password.test.ts` (correo existente vs. inexistente → misma respuesta) |

## 3. Revisiones técnicas

Verificaciones de límites de seguridad/arquitectura, no de un requisito funcional puntual.

| Qué se revisó | Resultado / dónde queda constancia |
|---|---|
| RN-006 sigue intacto en cada ampliación (`v_carnet_portal`, `v_tratamientos_portal`) | `portal_tratamientos_estructural_test.sql` confirma **a nivel de estructura** que la vista de tratamientos ni siquiera tiene columnas `diagnostico`/`hallazgos` — no solo que la política lo bloquee |
| `GRANT` + RLS (una tabla nueva no hereda privilegios automáticos) | Verificado manualmente cada vez que se agregó una tabla (Módulos 6/7/8, ver CLAUDE.md); sin prueba automatizada genérica que recorra `information_schema` |
| Funciones `SECURITY DEFINER` comprueban el rol ellas mismas (no confían en que RLS ya filtró) | `fn_emitir_factura`, `fn_conceptos_facturables`, `admin-usuarios`, `portal-acceso`, `fn_cancelar_cita_portal` — verificado por `curl`/pgTAP caso por caso; `fn_cancelar_cita_portal_test.sql` y `supabase/tests/portal-acceso.test.ts` cubren dos de ellas |
| Numeración de factura (`seq_factura_numero`) no reutiliza números aunque salte huecos | Verificado manualmente (RN-016); sin prueba automatizada |
| Ninguna tabla tiene política `DELETE` (RF-033, sin borrado físico) | Verificado manualmente tabla por tabla; sin prueba automatizada que lo confirme de una sola vez |
| `fn_emitir_factura` es atómica (RES-07/RNF-005) | `supabase/tests/fn_emitir_factura_integration.test.ts` **(nuevo)** — una línea inválida no deja una cabecera de factura huérfana |

## Qué queda deliberadamente sin cubrir

Mismo criterio "acotado, no todo" que el resto del proyecto (ver CLAUDE.md). No es una lista
de pendientes urgentes, es una decisión de alcance explícita para que la próxima pasada sepa
dónde seguir sin adivinar:

- El flujo funcional completo del Módulo 7 (Compras) no tiene ninguna prueba automatizada
  todavía — toda su verificación es manual. El Módulo 5 (Facturación) ya tiene cubierta su
  pieza más crítica (`fn_emitir_factura`), pero el resto del flujo (reporte de ingresos,
  impresión, pagos mixtos) sigue siendo solo manual.
- Las ~35 políticas RLS restantes fuera de las cubiertas arriba.
- El bug de sesión al cambiar de pestaña (personal y portal) es difícil de reproducir de forma
  determinista en una prueba automatizada (depende de que GoTrue decida refrescar el token, algo
  fuera de control directo del test); se deja documentado como regresión conocida, no como
  prueba ejecutable — a diferencia de `useDisponibilidadCita`, que si se pudo cubrir.
- Los componentes/diálogos de alta más grandes (`NuevoPacienteDialog`, `NuevaCitaDialog`,
  `NuevaConsultaDialog`, `NuevoProductoDialog`, `NuevaOrdenCompraDialog`, `RegistrarPagoDialog`)
  siguen sin prueba de componente dedicada — esta pasada priorizó lógica pura y hooks (más
  barato de escribir y mantener) sobre diálogos grandes con mucho estado de formulario.
