# Análisis de pruebas — Login (personal y portal)

Pedido explícito del cliente: cubrir con pruebas automatizadas el escenario de "ingresar al
login con datos incorrectos" (y los escenarios equivalentes que se le asocian — campos vacíos,
credenciales correctas, no enumeración de cuentas) tanto para el login de personal
(`/ingresar`) como para el del portal del propietario (`/portal/ingresar`), documentando cada
caso y su resultado. Este documento es el resultado de esa verificación; el catálogo general de
toda la suite del proyecto está en `README.md` de esta misma carpeta.

## 1. Alcance

Dos capas, deliberadamente distintas, cubriendo la misma funcionalidad desde ángulos distintos:

- **Unitaria (Vitest, `frontend/src/test/`)**: prueba `LoginPage.tsx`/`LoginPortalPage.tsx`
  junto con su `AuthProvider`/`PortalAuthProvider` real, mockeando únicamente en el límite de
  `lib/supabaseClient` — se verifica la lógica del formulario y el manejo de errores tal como
  la ejecuta React, sin red real.
- **Integración (Deno, `supabase/tests/auth_login_integration.test.ts`)**: llama directamente
  al servicio de Auth real (GoTrue) del stack local, el mismo endpoint que
  `supabase.auth.signInWithPassword()` invoca en producción. Confirma que el *servidor*
  se comporta como la lógica del formulario asume, no solo que el formulario reacciona bien a
  una respuesta simulada.

No se prueban aquí (fuera de alcance de este documento, cubiertos en otras partes de la suite
o pendientes, ver `README.md`): el resto del ciclo de vida de una cuenta (creación,
desactivación, restablecimiento — cubierto por `portal-acceso`), ni la persistencia de sesión
entre pestañas (bug de regresión conocido, sin prueba automatizada por lo difícil de reproducir
en un entorno de prueba, ver `README.md` sección 2).

## 2. Casos de prueba y resultados

### 2.1 Unitarias — `frontend/src/test/LoginPage.test.tsx` (login de personal)

| # | Escenario | Resultado esperado | Resultado obtenido |
|---|---|---|---|
| 1 | Correo y contraseña incorrectos | Muestra "Correo o contraseña incorrectos." y no deja sesión iniciada | ✅ PASA |
| 2 | Formulario enviado con campos vacíos | No llama a `signInWithPassword`; muestra "Ingresa tu correo y tu contraseña para continuar." | ✅ PASA |
| 3 | Correo y contraseña correctos | No muestra ningún mensaje de error | ✅ PASA |
| 4 | Reintento exitoso tras un primer intento fallido | El mensaje de error del primer intento desaparece tras el segundo, exitoso | ✅ PASA |

### 2.2 Unitarias — `frontend/src/test/LoginPortalPage.test.tsx` (login de portal)

| # | Escenario | Resultado esperado | Resultado obtenido |
|---|---|---|---|
| 1 | Correo y contraseña incorrectos | Muestra "Correo o contraseña incorrectos." y no deja sesión iniciada | ✅ PASA |
| 2 | Formulario enviado con campos vacíos | No llama a `signInWithPassword`; muestra el mismo aviso que el login de personal | ✅ PASA |
| 3 | Correo y contraseña correctos | No muestra ningún mensaje de error | ✅ PASA |
| 4 | Clic en "¿Olvidaste tu contraseña?" | Abre el diálogo correspondiente sin intentar iniciar sesión | ✅ PASA |

### 2.3 Integración — `supabase/tests/auth_login_integration.test.ts` (Auth real)

| # | Escenario | Resultado esperado | Resultado obtenido |
|---|---|---|---|
| 1 | Contraseña incorrecta contra una cuenta real | `400`, `error_code: invalid_credentials`, sin `access_token` | ✅ PASA |
| 2 | Correo que no existe en el sistema | Responde **el mismo** error que una contraseña incorrecta (400, `invalid_credentials`) | ✅ PASA |
| 3 | Correo y contraseña vacíos | `400`, rechazado antes de validar contra la base | ✅ PASA |
| 4 | Credenciales correctas (`recepcion@vetcare.local`) | `200`, con `access_token` real y `token_type: bearer` | ✅ PASA |

**Hallazgo de esta verificación, no un bug**: el caso 2 confirma que GoTrue ya aplica la misma
propiedad de no-enumeración de cuentas que el proyecto implementó a propósito en
`portal-olvide-password` (sección 9 de `CLAUDE.md`) — un correo inexistente y una contraseña
incorrecta son indistinguibles para quien intenta adivinar cuentas válidas por fuerza bruta.

## 3. Resumen de ejecución

Corrido el 2026-08-26, sobre el stack local (`supabase start`) y la base recién restablecida
(`supabase db reset`, con el seed de volumen ampliado):

| Suite | Comando | Resultado |
|---|---|---|
| Vitest (proyecto completo, incluye los 8 casos nuevos) | `cd frontend && npm run test` | **55/55 en verde** (9 archivos) |
| `npm run build` | `cd frontend && npm run build` | limpio, sin errores de tipos |
| Deno — integración de login (4 casos nuevos) | `deno test --allow-net --allow-env supabase/tests/auth_login_integration.test.ts` | **4/4 en verde** |
| Deno — Edge Functions (sin cambios, verificado que sigue intacto) | `deno test --allow-net --allow-env supabase/functions` | **10/10 en verde** |
| pgTAP (sin cambios, verificado que sigue intacto) | `cd supabase && npx supabase test db --local` | **22/22 en verde** |

Total del proyecto tras esta pasada: **91 pruebas automatizadas** (55 Vitest + 14 Deno + 22
pgTAP), frente a las 79 que existían antes de este documento.

## 4. Conclusiones

- El escenario pedido explícitamente ("ingresar con datos incorrectos") queda cubierto en las
  dos capas — no solo se prueba que el formulario *reacciona* bien a un error simulado, sino
  que el servidor real efectivamente lo produce.
- El mensaje de error es **idéntico** para "cuenta inexistente" y "contraseña incorrecta"
  (tanto en el formulario, `AuthContext.tsx`/`PortalAuthContext.tsx`, como en el servidor,
  GoTrue) — no revela si un correo está registrado, mismo criterio de seguridad que el resto
  del proyecto.
- Los cuatro casos son deliberadamente paralelos entre personal y portal porque comparten la
  misma lógica de validación (mismo mensaje de error, mismo flujo) — documentarlos por separado
  sirve para detectar si algún día dejan de comportarse igual (p. ej., si a uno se le agrega una
  regla que al otro no).
- No se encontró ningún defecto real durante esta verificación — los cuatro casos se comportan
  exactamente como el código ya implementaba.
