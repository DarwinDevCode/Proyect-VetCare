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
| Edge Functions (Deno test) | `deno test --allow-net --allow-env supabase/functions` (desde la raíz) | `supabase start` corriendo (las de integración llaman al stack local real) |
| Base de datos (pgTAP) | `cd supabase && npx supabase test db --local` | `supabase start` corriendo |

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
| 1. Pacientes y Propietarios | Alta en 2 pasos, detección de duplicado por identificación, ficha con pestañas por rol, búsqueda por mascota/cédula/propietario | `frontend/src/modules/pacientes/edad.test.ts` (cálculo de edad, RF-010) |
| 2. Agenda y Citas | Disponibilidad en vivo con sugerencias, reprogramar/cancelar, vista semanal, lista de espera, solicitudes desde el portal | `frontend/src/modules/agenda/disponibilidad.test.ts` (chequeo cliente, RF-011); `rn004_solapamiento_citas_test.sql` (garantía real del `EXCLUDE`) |
| 3. Historial Clínico | Consulta + vínculo con cita, vacunación con descuento automático, examen con resultado diferido, signos vitales, próxima dosis | `fechas.test.ts` (formato de fecha del timeline, ver sección 2); ninguna del flujo clínico completo |
| 4. Inventario y Medicamentos | Alta de producto, ingreso/ajuste/consumo, alertas de stock mínimo y lotes por vencer | `rn010_existencia_no_negativa_test.sql` (garantía real del trigger) |
| 5. Facturación y Reportes | Emisión desde atención o servicio suelto, numeración, pagos mixtos, reporte de ingresos, impresión | ninguna (RN-013/atomicidad de `fn_emitir_factura` sigue solo verificada por `curl`, ver sección 3) |
| 6. Administración del sistema | Ciclo de vida de cuentas (crear/activar/desactivar/reset), roles, catálogos, parámetros, auditoría | `fn_auditar_cambio_test.sql` (bitácora, ver sección 2) |
| 7. Compras y Proveedores | Orden de compra borrador→emitida→recibida, descuento automático al recibir, protección contra doble recepción | ninguna |
| 8. Portal del propietario | Login separado de personal, mis mascotas/citas/facturas, solicitar y cancelar cita, cambiar/recuperar contraseña, imprimir factura | `fn_cancelar_cita_portal_test.sql`; `portal_tratamientos_estructural_test.sql`; `CambiarPasswordDialog.test.tsx`; `OlvidePasswordDialog.test.tsx`; `portal-acceso/index.test.ts`; `portal-olvide-password/index.test.ts` |
| Campana de notificaciones (personal y portal) + leídas/no leídas | Alertas por rol, marcar leída al navegar, persistencia en localStorage | ninguna — candidato para la próxima pasada (ver "Qué queda sin cubrir") |

## 2. Pruebas de regresión

Cada fila es un bug real que ya ocurrió una vez (documentado en `CLAUDE.md`, sección
"Problemas conocidos" y las notas de cada fase). Donde existe una prueba automatizada, está
pensada específicamente para que ese bug no pueda volver a colarse en silencio.

| Bug | Causa raíz | Prueba de regresión |
|---|---|---|
| Mensajes de `raise exception` propios (`P0001`) no llegaban al usuario | `lib/errors.ts` no contemplaba el código `P0001` | `frontend/src/lib/errors.test.ts` (cada rama del switch, incluido `P0001`) |
| Embed de PostgREST sin `!inner` dejaba pasar `propietario: null` | Filtrar por un campo de un embed sin `!inner` no filtra las filas del padre | sin prueba automatizada — pendiente |
| RF-031 (Administrador ve facturas) contradecía la RLS de `propietario` (Módulo 1) | Política de `propietario` no incluía a Administrador | `rf031_propietario_facturado_administrador_test.sql` **(nuevo)** |
| `fn_auditar_cambio` reventaba con `record "new" has no field...` al sembrar `parametro_sistema` | Acceso a `new.<campo>` directo en un trigger compartido entre tablas con columnas distintas | `fn_auditar_cambio_test.sql` **(nuevo)** |
| Fechas de vacunación/examen del timeline retrocedían un día en husos detrás de UTC | Formatear una columna `date` (vía `timestamptz` a medianoche UTC) con la hora local del navegador | `frontend/src/lib/fechas.test.ts` **(nuevo)**, sobre `soloFechaLocal` extraída de `EventoHistorialItem.tsx` |
| La sesión se perdía al cambiar de pestaña (personal y portal) | `onAuthStateChange` reaccionaba a cualquier evento (`TOKEN_REFRESHED`/`INITIAL_SESSION` redundante), no solo a un cambio real de usuario | sin prueba automatizada — no se pudo forzar la condición exacta en el entorno de prueba (ver CLAUDE.md, limitación documentada explícitamente) |
| `useDisponibilidadCita` no recargaba al reabrir el diálogo de nueva cita para el mismo veterinario/día | Dependencias del efecto no incluían nada que cambiara en cada apertura | sin prueba automatizada dedicada |
| `service_role` no recibía `GRANT` automático sobre tablas nuevas | El privilegio SQL se comprueba antes que RLS; versiones recientes del CLI no lo dan gratis | cubierto indirectamente por `portal-acceso/index.test.ts` (ejercita la Edge Function real contra el stack local) |
| XSS en el HTML de los correos de credenciales (`nombrePropietario` con `<script>`) | Interpolación sin escapar en la plantilla del correo | `_shared/portalPassword.test.ts` (regresión de XSS explícita sobre `plantillaHtml`) |
| Enumeración de cuentas vía "olvidé mi contraseña" | — (propiedad de diseño, no un bug corregido) | `portal-olvide-password/index.test.ts` (correo existente vs. inexistente → misma respuesta) |

## 3. Revisiones técnicas

Verificaciones de límites de seguridad/arquitectura, no de un requisito funcional puntual.

| Qué se revisó | Resultado / dónde queda constancia |
|---|---|
| RN-006 sigue intacto en cada ampliación (`v_carnet_portal`, `v_tratamientos_portal`) | `portal_tratamientos_estructural_test.sql` confirma **a nivel de estructura** que la vista de tratamientos ni siquiera tiene columnas `diagnostico`/`hallazgos` — no solo que la política lo bloquee |
| `GRANT` + RLS (una tabla nueva no hereda privilegios automáticos) | Verificado manualmente cada vez que se agregó una tabla (Módulos 6/7/8, ver CLAUDE.md); sin prueba automatizada genérica que recorra `information_schema` |
| Funciones `SECURITY DEFINER` comprueban el rol ellas mismas (no confían en que RLS ya filtró) | `fn_emitir_factura`, `fn_conceptos_facturables`, `admin-usuarios`, `portal-acceso`, `fn_cancelar_cita_portal` — verificado por `curl`/pgTAP caso por caso; `fn_cancelar_cita_portal_test.sql` y `portal-acceso/index.test.ts` cubren dos de ellas |
| Numeración de factura (`seq_factura_numero`) no reutiliza números aunque salte huecos | Verificado manualmente (RN-016); sin prueba automatizada |
| Ninguna tabla tiene política `DELETE` (RF-033, sin borrado físico) | Verificado manualmente tabla por tabla; sin prueba automatizada que lo confirme de una sola vez |
| `fn_emitir_factura` es atómica (RES-07/RNF-005) | Verificado por `curl`: una línea inválida revierte la cabecera completa; sin prueba pgTAP dedicada |

## Qué queda deliberadamente sin cubrir

Mismo criterio "acotado, no todo" que el resto del proyecto (ver CLAUDE.md). No es una lista
de pendientes urgentes, es una decisión de alcance explícita para que la próxima pasada sepa
dónde seguir sin adivinar:

- El flujo funcional completo de los Módulos 5 (Facturación) y 7 (Compras) no tiene ninguna
  prueba automatizada todavía — toda su verificación es manual.
- La campana de notificaciones (personal y portal) y el estado leída/no leída, agregadas en
  esta misma sesión, no tienen prueba automatizada — son la pieza más nueva del proyecto.
- Las ~35 políticas RLS restantes fuera de las cubiertas arriba.
- Los bugs de timing/efectos de React (`useDisponibilidadCita`, el de sesión al cambiar de
  pestaña) son difíciles de reproducir de forma determinista en una prueba automatizada; se
  dejan documentados como regresión conocida, no como prueba ejecutable.
