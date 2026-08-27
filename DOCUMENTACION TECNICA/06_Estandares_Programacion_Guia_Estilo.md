# Estándares de Programación y Guía de Estilo — VetCare

Convenciones observadas directamente en el código de `frontend/src`,
`supabase/migrations`, `supabase/functions` y en el historial de Git del
repositorio. No se documenta ninguna convención que el equipo no haya usado de
forma consistente.

## 1. Estructura del código

### 1.1. Frontend (`frontend/src/`)

Organización por módulo funcional, no por tipo técnico (no hay una carpeta
`components/` ni `services/` a nivel raíz que agrupe todo el proyecto):

```text
frontend/src/
├── auth/        identidad y sesión de personal
├── portal/      identidad y sesión del propietario (Módulo 8)
├── layout/      shell de navegación de personal
├── lib/         cliente Supabase, mapeo de errores
├── types/       interfaces de dominio compartidas
└── modules/<nombre-del-módulo>/
    ├── <Nombre>Page.tsx          página principal del módulo (o pestaña raíz)
    ├── <Accion><Entidad>Dialog.tsx  un archivo por diálogo de alta/edición
    ├── <Entidad>Autocomplete.tsx / <Entidad>Select.tsx  subcomponentes reutilizables del módulo
    ├── api.ts                     todas las funciones de acceso a datos del módulo
    └── <utilidad>.ts              funciones auxiliares sin estado (formato.ts, edad.ts, disponibilidad.ts, eventoHistorial.ts)
```

Cada módulo es autocontenido: su propio `api.ts` concentra todo el acceso a
datos de ese módulo. Cuando un módulo necesita datos de otro, importa
directamente su `api.ts` (ver Documento 4, sección "dependencias cruzadas");
no existe una capa de agregación intermedia entre módulos, salvo
`modules/dashboard/api.ts`, que compone funciones ya existentes de otros
cuatro módulos sin duplicarlas.

### 1.2. Backend (`supabase/`)

```text
supabase/
├── config.toml
├── seed.sql
├── migrations/     un archivo por cambio de esquema, nunca se edita uno ya aplicado
└── functions/<nombre-de-la-función>/
    ├── index.ts     punto de entrada (Deno.serve)
    └── <apoyo>.ts   módulos de apoyo cuando el archivo crecería demasiado (ej. smtp.ts)
```

Una migración nueva es siempre un archivo nuevo (`npx supabase migration
new <nombre>`); ninguna migración existente se reescribe después de aplicada.
Cuando una regla necesita cambiar (por ejemplo, `fn_rol_actual()` o
`v_estado_factura`), la migración siguiente usa `create or replace
function`/`drop view; create view` sobre el objeto ya existente, nunca edita
el archivo original.

## 2. Nomenclatura

| Elemento | Convención | Ejemplo real |
|---|---|---|
| Componentes de React | `PascalCase`, sustantivo + rol (`Page`, `Dialog`, `Tab`, `Item`, `Select`, `Autocomplete`) | `NuevoPacienteDialog`, `AgendaGrid`, `ListaEsperaTab`, `EventoHistorialItem` |
| Hooks | `camelCase` con prefijo `use` | `useAuth`, `usePortalAuth`, `useDisponibilidadCita` |
| Funciones de `api.ts` | `camelCase`, verbo en español + entidad (`listar`, `crear`, `actualizar`, `buscar`, `registrar`, `emitir`, `cancelar`, `confirmar`, `obtener`) | `listarProductos`, `crearVacunacion`, `emitirFactura`, `cancelarListaEspera` |
| Variables y funciones locales | `camelCase`, en español (`cargando`, `guardando`, `errorGeneral`, `recargar`, `validar`, `guardar`, `cerrar`) | — |
| Interfaces de dominio | `PascalCase`, singular, igual al sustantivo de la tabla/vista en español (`Paciente`, `Factura`, `ListaEspera`) | `frontend/src/types/dominio.ts` |
| Proyecciones/variantes de una interfaz | `PascalCase`, nombre base + calificador (`Con<Relación>`, `Listado`, `Resumen`, `ParaAlgo`) | `PacienteConFicha`, `FacturaListada`, `CitaResumen`, `PacienteParaCita` |
| Tipos unión (enumeraciones) | `PascalCase` con prefijo `Tipo`/`Estado`/`Forma`/`Rol` cuando corresponde | `TipoProducto`, `EstadoCita`, `FormaPago`, `RolCodigo` |
| Constantes de configuración/etiquetas | `SCREAMING_SNAKE_CASE` | `PORCENTAJE_IMPUESTO_POR_DEFECTO`, `ETIQUETA_ESTADO_COBRO`, `HORA_INICIO_ATENCION` |
| Archivos de componente | igual al nombre exportado (`PascalCase.tsx`) | `FichaDialog.tsx` exporta `FichaDialog` |
| Archivos utilitarios/hook | `camelCase.ts` | `disponibilidad.ts`, `useDisponibilidadCita.ts` |
| Tablas y columnas SQL | `snake_case`, tabla en singular, clave primaria `id_<tabla>` | `movimiento_inventario`, `id_movimiento` |
| Restricciones SQL | `chk_<motivo>`, `idx_<tabla>_<columnas>`, `fk` implícita sin nombre explícito salvo cuando PostgREST la necesita | `chk_movimiento_signo`, `idx_cita_veterinario_fecha` |
| Funciones SQL | `fn_<verbo_o_accion>` | `fn_actualizar_existencia`, `fn_emitir_factura` |
| Triggers SQL | `trg_<accion>` | `trg_totales_factura`, `trg_auditar_usuario` |
| Vistas SQL | `v_<contenido>` | `v_historial_clinico`, `v_carnet_portal` |
| Políticas RLS | `<tabla>_<operacion>[_<calificador>]` | `movimiento_insert`, `propietario_select_facturado`, `cita_insert_portal` |
| Rutas de la SPA | `kebab-case` en minúsculas, en español, sin verbos (`/pacientes`, `/administracion`) | `layout/modulos.ts` |
| Endpoints | No hay endpoints propios de la aplicación: PostgREST los genera desde el nombre de la tabla/vista/función (`/rest/v1/<tabla>`, `/rest/v1/rpc/<función>`); los dos únicos endpoints propios son las funciones Edge, nombradas igual que su carpeta (`/functions/v1/admin-usuarios`, `/functions/v1/portal-acceso`). | — |

No se usan prefijos húngaros, ni sufijos `Impl`/`Base`/`Abstract` (no hay
clases ni interfaces en ese sentido en TypeScript), ni `I` delante de una
interfaz.

## 3. Formato

- **Indentación:** 2 espacios, consistente en `.ts`/`.tsx` y en `.sql`.
- **Comillas:** comilla simple en TypeScript (`'texto'`), plantillas con
  backtick solo cuando hay interpolación (``` `${a}-${b}` ```).
- **Punto y coma:** presente al final de cada sentencia.
- **Longitud de línea:** sin una regla dura configurada (no hay Prettier ni
  `.editorconfig` en el repositorio), pero el código observado se mantiene en
  general por debajo de ~100-110 columnas; los atributos JSX largos se
  reparten en varias líneas, uno por prop.
- **Llaves:** estilo Egipcio (`{` en la misma línea que la declaración) en
  TypeScript; en SQL, `begin`/`end` de cada función en su propia línea.
- **Componentes de React:** siempre función con nombre exportado
  (`export function NombrePage() { … }`), nunca `export default` para
  componentes de módulo (el único `export default` del proyecto es
  `App.tsx`, el punto de entrada del enrutador).
- **Props:** desestructuradas directamente en la firma de la función
  (`function Dialogo({ abierto, onCerrar, onCreado }: Props)`), con una
  interfaz `Props` declarada justo antes del componente.
- **Organización de imports:** paquetes externos primero (React, MUI,
  íconos, `dayjs`), luego imports internos por cercanía relativa (`../../lib`,
  `../../types`, luego `./` del propio módulo). No hay una herramienta
  automática de ordenamiento configurada (no hay ESLint/Prettier con esa
  regla); el orden se mantiene manualmente pero de forma consistente en todo
  el código revisado.
- **SQL:** palabras clave en minúscula (`select`, `create table`, `not
  null`), no en mayúscula; es la convención empleada en las 14 migraciones y
  en `seed.sql` sin excepción.
- **Linter:** `oxlint` (`frontend/.oxlintrc.json`), con los plugins
  `react`, `typescript`, `oxc` y las reglas explícitas
  `react/rules-of-hooks: error` y
  `react/only-export-components: warn` (con
  `allowConstantExport: true`); se ejecuta con `npm run lint`. No hay
  configuración de Prettier ni de ESLint en el proyecto.

## 4. Comentarios

- **Comentarios mínimos, y siempre sobre el *por qué*, nunca sobre el *qué*.**
  Es la convención más consistente de todo el proyecto (declarada en
  `CLAUDE.md` sección 12 y verificable en cada archivo): no hay bloques de
  documentación tipo JSDoc/TSDoc sobre funciones triviales ni comentarios que
  repitan lo que el nombre de la variable ya dice.
- Un comentario aparece únicamente cuando explica una restricción del
  dominio, una decisión que se aparta de lo obvio, o un error real que se
  corrigió (ejemplos reales: por qué `id_usuario_registro` se envía `null`
  explícito en `portal/api.ts`; por qué las vacunas se excluyen del selector
  de `RegistrarConsumoDialog`; por qué `v_carnet_portal` no lleva
  `security_invoker`).
- En SQL, cada bloque de reglas de negocio lleva un comentario corto
  encabezando la sección (`-- RN-004 / RF-011: …`), referenciando el
  identificador de requisito o regla de negocio que motiva el objeto.
- No se usan comentarios de tipo `// TODO` ni `// FIXME` como mecanismo de
  seguimiento: las decisiones pendientes o de alcance se documentan en
  `CLAUDE.md`, no en el código.

## 5. Programación

### 5.1. Principios de diseño observables

- **La integridad crítica vive en la base de datos, no en el cliente.**
  Cantidad de inventario, totales de factura, no solapamiento de citas y
  numeración de facturas se garantizan con triggers, columnas generadas y
  restricciones (`CHECK`, `EXCLUDE`, `UNIQUE`); el cliente repite el mismo
  chequeo solo quiere dar retroalimentación inmediata (por ejemplo,
  `useDisponibilidadCita`), nunca como única garantía.
- **El control de acceso se aplica en el servidor (RLS), no solo ocultando
  botones.** Cada pantalla condiciona sus controles de escritura según el rol
  de la sesión (`sesion.rol.codigo === 'recepcionista'`), pero esa condición
  es una mejora de experiencia, no la barrera real — la barrera real es la
  política RLS de la tabla.
- **No se ofrece una interacción que el servidor de todas formas
  rechazaría.** Patrón repetido en varios módulos: no mostrar la pestaña
  "Historial" a Recepción (Módulo 1), no dejar clic en un hueco vacío del
  grid a un Veterinario (Módulo 2), excluir vacunas del selector de consumo
  manual (Módulo 3).
- **Ningún campo que la base calcula se acepta desde un formulario.** Se
  aplica sin excepciones a `existencia_actual`/`existencia_resultante`,
  `cita.fecha_hora_fin`, `factura.numero`/`subtotal`/`total`,
  `detalle_factura.precio_unitario` (cuando hay `id_producto`),
  `detalle_factura.subtotal_linea`.
- **Sin abstracciones para casos hipotéticos.** No hay una capa de
  repositorio genérica sobre `@supabase/supabase-js`, ni un *wrapper* de
  peticiones HTTP propio: cada función de `api.ts` llama directamente a
  `supabase.from(...)`/`supabase.rpc(...)`/`supabase.functions.invoke(...)`.

### 5.2. Manejo de excepciones

- Toda función asíncrona que puede fallar en la interfaz sigue el mismo
  patrón: `try { … } catch (error) { setError(mensajeError(error)) } finally
  { setGuardando(false) }`.
- `frontend/src/lib/errors.ts` (`mensajeError`) es el único traductor de
  errores del proyecto: mapea códigos de PostgreSQL/PostgREST
  (`23505`, `23503`, `23514`/`check_violation`, `42501`, `23P01`, `P0001`) a
  mensajes en español pensados para el usuario final (RNF-014), y cae en un
  mensaje genérico para cualquier otro código.
- Las funciones Edge (`admin-usuarios`, `portal-acceso`) no lanzan: devuelven
  siempre una respuesta JSON con `{error: string}` y el código HTTP
  correspondiente (`400`, `401`, `403`, `405`, `500`); el cliente
  (`invocarAdminUsuarios`/`invocarPortalAcceso`) intenta leer ese cuerpo antes
  de mostrar un mensaje genérico.
- Las funciones de PostgreSQL que rechazan una operación de negocio usan
  `raise exception` con el mensaje ya redactado en español para el usuario
  final (por ejemplo, en `fn_actualizar_existencia`,
  `fn_validar_producto_vacuna`, `fn_emitir_factura`,
  `fn_proteger_ultimo_administrador`); cuando el mensaje no lleva un
  `errcode` explícito, PostgreSQL le asigna `P0001`, que `mensajeError`
  reconoce y muestra literal.

### 5.3. Validaciones

- **Doble validación deliberada:** el cliente valida antes de enviar (una
  función `validar()` por diálogo, que llena un `Record<string,string>` de
  errores y los muestra bajo cada campo) para dar retroalimentación
  inmediata; la base vuelve a validar con `CHECK`/triggers, que es la
  garantía real ante condiciones de carrera o llamadas directas a la API.
- El patrón de "signo implícito" se repite en Inventario y en Historial: el
  usuario nunca escribe un número negativo — el formulario pide una
  cantidad positiva y un modificador aparte ("Aumentar"/"Disminuir", o el
  contexto de "consumo"), y el código antepone el signo antes de enviar,
  porque `chk_movimiento_signo` exige ese signo según `tipo_movimiento`.
- Formularios en varios pasos (`NuevoPacienteDialog`, con paso de
  propietario y paso de mascota) validan cada paso por separado
  (`validarPaso1`, `validarPaso2`) y solo avanzan si el paso actual es
  válido.

### 5.4. Manejo de respuestas

- Toda función de `api.ts` que lee datos devuelve directamente el arreglo u
  objeto tipado (`Promise<Tipo[]>`/`Promise<Tipo>`), nunca una envoltura
  `{data, error}` propia: el `if (error) throw error;` ocurre dentro de la
  función, así que quien la llama solo necesita `try/catch`.
- Las respuestas de lectura con relaciones embebidas de PostgREST se
  castean explícitamente (`data as unknown as Tipo[]`) porque el tipo que
  infiere `@supabase/supabase-js` para un `select` con `embed` no coincide
  con la interfaz de dominio ya definida a mano.

### 5.5. Acceso a datos

- Un único cliente de Supabase por sesión de navegador
  (`frontend/src/lib/supabaseClient.ts`, exportado como `supabase`),
  construido desde `import.meta.env.VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`;
  todas las funciones de todos los `api.ts` lo importan y lo usan
  directamente, sin inyección de dependencias ni contenedor de servicios.
- Tres vías de acceso a datos, todas a través de ese mismo cliente:
  1. **PostgREST directo:** `supabase.from('tabla').select/insert/update()`
     — la mayoría de las operaciones.
  2. **RPC:** `supabase.rpc('fn_nombre', {parametros})` — para operaciones
     que necesitan una transacción de servidor (`fn_emitir_factura`,
     `fn_crear_orden_compra`) o cruzar un límite de RLS de forma acotada
     (`fn_conceptos_facturables`, `fn_atenciones_facturables`).
  3. **Funciones Edge:** `supabase.functions.invoke('nombre', {body})` —
     únicamente para las dos operaciones que deben tocar `auth.users` con la
     `service_role` key (`admin-usuarios`, `portal-acceso`).
- Ningún componente de React llama a `fetch` o a otra librería HTTP: toda
  comunicación de red pasa por `@supabase/supabase-js`.

### 5.6. DTO / tipos de transferencia

- No hay clases DTO: las interfaces de `types/dominio.ts` cumplen ese papel,
  y los `api.ts` las recortan con utilidades de TypeScript (`Pick`, `Omit`,
  `Partial`) para expresar exactamente qué campos acepta cada operación —
  por ejemplo, `Omit<Paciente, 'id_paciente' | 'activo' | 'fecha_registro'>`
  para `crearPaciente`, o `Pick<Cita, 'fecha_hora_inicio' |
  'duracion_minutos'>` para `reprogramarCita`. Este patrón deja explícito, a
  nivel de tipos, qué columnas calcula el servidor y nunca deben venir del
  formulario.
- Las proyecciones de lectura con relaciones embebidas (`PacienteConFicha`,
  `CitaConDetalle`, `FacturaListada`, etc.) también se declaran como
  interfaces `extends` de la interfaz base, nunca duplicando sus campos a
  mano.

### 5.7. Interfaces

- Se usan exclusivamente para forma de datos (dominio, *props* de
  componentes, parámetros/retorno de funciones); TypeScript no tiene
  interfaces de comportamiento implementadas por clases en este proyecto,
  porque no hay clases.
- Cada componente con parámetros declara su propia interfaz `Props` en el
  mismo archivo, justo antes del componente; no se comparten interfaces
  `Props` entre componentes distintos.

### 5.8. Inyección de dependencias

No existe un contenedor ni un patrón de inyección: el cliente `supabase` es
un módulo *singleton* importado donde se necesita (ver 5.5). React Context
(`AuthContext`, `PortalAuthContext`) es el único mecanismo de "inyección" del
proyecto, y se usa exclusivamente para exponer la sesión autenticada a los
componentes descendientes vía `useAuth()`/`usePortalAuth()`.

### 5.9. Manejo de transacciones

PostgREST no ofrece transacciones que abarquen varias peticiones HTTP. Cuando
una operación necesita que varias filas se escriban todas o ninguna
(cabecera + líneas), el proyecto la resuelve con una función `plpgsql`
invocada por `rpc`, nunca con varias llamadas secuenciales desde el cliente:
`fn_emitir_factura` (factura + detalle) y `fn_crear_orden_compra` (orden +
detalle) son los dos casos reales. La única excepción deliberada es
`registrarPagosMixtos`, que inserta varias filas de `pago` en un único
`insert` de PostgREST con un arreglo — sigue siendo una sola sentencia SQL
atómica, no varias llamadas.

### 5.10. Convenciones para funciones de servicio (`api.ts`)

- Una función por operación de negocio, con nombre en español que describe
  la acción (no genérico como `get`/`save`).
- Cada función maneja su propio `if (error) throw error;` inmediatamente
  después de la llamada a Supabase; no se agrupan varias llamadas dentro de
  un único `try/catch` a nivel de módulo.
- Las funciones de solo lectura reciben filtros como parámetros con nombre
  explícito (`FiltrosFactura`, `filtros: {tabla?, desde?, hasta?}`), nunca un
  objeto de opciones sin tipar.

## 6. Base de datos

Ya cubierto en detalle en el Documento 5; como resumen de estándares:

- Snake_case, singular, `id_<tabla>` como clave primaria (sin excepciones en
  las 21 tablas del proyecto).
- Sin borrado físico: ninguna tabla tiene política `DELETE`; "eliminar" es
  siempre un cambio de estado (`activo=false`, `estado='cancelada'`).
- Toda tabla nueva expuesta a PostgREST necesita su propio `GRANT` explícito
  a `authenticated` (y, si la toca una función Edge, también a
  `service_role`): las versiones recientes de la CLI de Supabase ya no
  otorgan ese privilegio de forma automática a objetos creados después del
  primer `GRANT ... ON ALL TABLES IN SCHEMA public`.
- Toda vista que deba respetar la RLS de sus tablas base lleva
  `security_invoker = on`, salvo la única vista que necesita cruzar ese
  límite de forma acotada (`v_carnet_portal`), documentada como excepción
  explícita.
- Los triggers que necesitan escribir en una tabla que el rol invocador no
  puede tocar directamente bajo RLS se marcan `security definer` con
  `search_path` fijado; los que no cruzan ningún límite de rol
  (`fn_recibir_orden_compra`, `fn_crear_orden_compra`) se dejan sin ese
  atributo.
- Índices: uno por cada combinación de columnas usada como filtro frecuente
  (`idx_<tabla>_<columna(s)>`), no un índice por columna de forma
  indiscriminada.

## 7. Control de versiones

### 7.1. Ramas

El historial visible en `origin` no conserva ramas por módulo: según
documenta `CLAUDE.md` (sección "Flujo de ramas de este proyecto"), los
Módulos 2, 3 y 4 se desarrollaron en ramas `modulo-<n>-<nombre-corto>`
(`modulo-2-agenda-citas`, `modulo-3-historial-clinico`,
`modulo-4-inventario`), fusionadas y luego eliminadas; después se adoptó una
única rama continua de trabajo (`Desarrollo-DA`), fusionada a `main` una vez
completado el alcance original. El repositorio, en su estado actual, solo
conserva `main`.

### 7.2. Mensajes de commit

Verificados sobre los 30 commits del historial completo (`git log`, orden
cronológico). Patrón consistente:

- Siempre en español, en modo imperativo/indicativo de tercera persona
  singular con el verbo primero, sin punto final: `Implementa …`, `Agrega …`,
  `Corrige …`, `Actualiza …`, `Fusiona …`, `Rediseno Organic - Fase N: …`.
- Sin prefijos de *conventional commits* (`feat:`, `fix:`, etc.) y sin
  ámbito entre corchetes.
- Cuando el commit cierra o implementa requisitos, los referencia entre
  paréntesis al final: `Implementa Modulo 2 - Agenda y Citas (RF-011 a
  RF-015)`, `Implementa RF-023 - Registro de consumo de productos en una
  atencion`.
- Los commits de fusión de rama usan el verbo `Fusiona`, no el mensaje por
  defecto de Git (`Fusiona Modulo 2 - Agenda y Citas`,
  `Fusiona Desarrollo-DA: alcance completo de los cinco modulos`); una
  fusión trae además un commit propio de actualización de `CLAUDE.md`
  registrando el cambio (`Actualiza CLAUDE.md: registra la fusion de
  Desarrollo-DA a main`).
- Los commits de la fase de rediseño visual siguen un formato fijo:
  `Rediseno Organic - Fase <n>[<letra>]: <alcance>` (`Rediseno Organic - Fase
  0: tema visual y shell de navegacion`, … `Fase 6: Dashboard (cierra el plan
  completo)`).
- No se observan mensajes en inglés, ni mensajes de una sola palabra, ni
  mensajes generados automáticamente por herramientas.

### 7.3. Pull Requests, revisión de código, tags

No hay evidencia en el repositorio de un flujo basado en Pull Requests: no
existe carpeta `.github/` (ni plantillas de PR/issue, ni flujos de CI), y el
propio `git log` muestra un commit explícito de fusión local
(`cae68400 Merge branch 'main' of https://github.com/DarwinDevCode/Proyect-VetCare`)
consistente con integración directa sobre `main`, no con fusiones vía
interfaz web de un PR. No hay tags (`git tag` no devuelve ninguno) ni,
por lo tanto, un esquema de versionado semántico en uso.

### 7.4. Autoría

El historial registra tres identidades de autor (`Darwin Sánchez Vera`,
`DarwinSM21`, `Khriz Coronel`); todas escriben en el mismo idioma y con el
mismo formato de mensaje descrito en 7.2, sin diferencias de convención
observables entre ellas.
