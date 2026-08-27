# Guía para Diagramas de Despliegue UML — VetCare

## 1. Alcance verificable

El repositorio solo documenta y permite verificar un entorno: desarrollo local,
levantado con `npx supabase start` (Docker, gestionado por la CLI de Supabase,
según `supabase/config.toml`) más el servidor de desarrollo de Vite
(`npm run dev`, `frontend/vite.config.ts`) para el frontend. No hay archivo
`docker-compose.yml` propio del proyecto (los contenedores de Supabase los define
y administra la propia CLI, no un compose versionado en este repositorio), ni
`Dockerfile`, ni carpeta `.github/` con flujos de CI/CD, ni configuración de un
proyecto Supabase alojado (`supabase link` no se ejecutó: `CLAUDE.md` lo señala
como pendiente). Este documento describe exclusivamente esa topología local, que
es la única que se puede verificar contra `supabase/config.toml`,
`frontend/vite.config.ts` y `frontend/.env.local.example`.

## 2. Nodos

### 2.1. Dispositivo cliente / Navegador

| Campo | Valor |
|---|---|
| Nombre | Navegador web (Chrome, Edge o equivalente actualizado) |
| Tipo | `device` → `execution environment` |
| Tecnología | Motor JavaScript/DOM estándar |
| Responsabilidad | Ejecutar la SPA de React: enrutamiento (`react-router-dom`), estado de sesión (`AuthContext`/`PortalAuthContext`), renderizado de MUI, y todas las llamadas de red hacia Supabase. |
| Artefactos desplegados | Paquete estático de la SPA (HTML + JS + CSS), servido en desarrollo por el servidor de Vite (`npm run dev`, puerto por defecto `5173`) y, para producción, generado por `vite build` (no hay evidencia en el repositorio de un servidor de archivos estáticos de producción configurado). |
| Comunicación saliente | HTTPS/JSON hacia el nodo "API Gateway (Kong)" del servidor Supabase. |

### 2.2. Servidor Supabase local (contenedores Docker gestionados por la CLI)

Nodo padre `device`/`node` que agrupa los siguientes componentes, todos definidos
en `supabase/config.toml`:

| Componente | Tipo | Puerto local | Responsabilidad | Artefactos |
|---|---|---|---|---|
| API Gateway (Kong) | `execution environment` | `54321` (`[api] port`) | Punto de entrada único de la API; enruta hacia PostgREST, GoTrue, Storage y Edge Runtime. | Configuración de rutas generada por la CLI (no versionada en el repositorio). |
| PostgREST (Data API) | `execution environment` | detrás del gateway, `54321` | Expone automáticamente como API REST las tablas, vistas y funciones del esquema `public` (RI-007), aplicando `GRANT` y Row Level Security de Postgres. | N/D (proceso de la imagen oficial de Supabase). |
| GoTrue (Auth) | `execution environment` | detrás del gateway, `54321` | Identidad y sesión (RES-03, RNF-003): login por correo/contraseña, emisión de JWT, API admin usada por las funciones Edge (`auth.admin.createUser`, `updateUserById`, con `ban_duration`). | Configuración de `[auth]` en `config.toml` (`jwt_expiry=3600`, `enable_confirmations=false`, `minimum_password_length=6`). |
| Edge Runtime (Deno) | `execution environment` | detrás del gateway, `54321` | Ejecuta las funciones serverless del proyecto. | `supabase/functions/admin-usuarios/index.ts`, `supabase/functions/portal-acceso/{index.ts,smtp.ts}`. |
| PostgreSQL | `database server` | `54322` (`[db] port`) | Motor de base de datos: 15 tablas base más las agregadas por las ampliaciones de alcance, vistas, funciones `plpgsql`/`sql`, triggers, Row Level Security. Versión mayor `17` (`[db] major_version`). | Los 14 archivos de `supabase/migrations/` aplicados en orden, más `supabase/seed.sql` (solo en desarrollo). |
| Supabase Studio | `execution environment` | `54323` (`[studio] port`) | Herramienta de inspección visual de la base durante el desarrollo (`CLAUDE.md` sección 8); no participa del flujo funcional de la aplicación. | N/D. |
| Inbucket (servidor de correo de pruebas) | `execution environment` | `54324` (`[local_smtp] port`) | Intercepta cualquier correo que GoTrue intente enviar en desarrollo (confirmaciones, recuperación). No lo usa el envío de credenciales del portal, que sale por un servidor SMTP externo real (ver 2.3). | N/D. |
| Almacenamiento (Storage API) | `execution environment` | detrás del gateway | Habilitado en `[storage]` (`file_size_limit = "50MiB"`, `[storage.s3_protocol] enabled = true`) pero sin ningún *bucket* declarado ni código en `frontend/src` que llame a `supabase.storage`; no forma parte del flujo funcional verificado. | N/D. |
| Realtime | `execution environment` | detrás del gateway | Habilitado en `[realtime]` pero sin ningún canal (`supabase.channel(...)`) usado en `frontend/src`; no forma parte del flujo funcional verificado. | N/D. |

### 2.3. Servicio de correo SMTP externo (Gmail)

| Campo | Valor |
|---|---|
| Nombre | `smtp.gmail.com` |
| Tipo | `external service node` |
| Tecnología | SMTP con STARTTLS sobre el puerto `587` (`supabase/functions/.env.example`: `VETCARE_SMTP_HOST=smtp.gmail.com`, `VETCARE_SMTP_PORT=587`) |
| Responsabilidad | Recibir y entregar el correo de credenciales del Portal del propietario (RI-008). |
| Consumido por | La función Edge `portal-acceso`, a través de `nodemailer` (`npm:nodemailer@^9`) en `supabase/functions/portal-acceso/smtp.ts`. |
| Credenciales | Variables `VETCARE_SMTP_*`, cargadas por la CLI desde `supabase/functions/.env` (no versionado; solo `.env.example` sí lo está). |
| Nota técnica verificada | El código descarta explícitamente la librería `denomailer` (import por URL) porque bloqueaba el proceso del Edge Runtime al negociar STARTTLS contra este mismo host; se usa `nodemailer` vía `npm:` en su lugar (comentario en `smtp.ts`). |

## 3. Conexiones, protocolos y puertos

| Origen | Destino | Protocolo | Puerto | Datos que viajan |
|---|---|---|---|---|
| Navegador (SPA) | API Gateway (Kong) | HTTPS/JSON (REST) | `54321` en desarrollo | Peticiones PostgREST (`from('tabla').select/insert/update`), llamadas RPC (`supabase.rpc('fn_emitir_factura', …)`), login/sesión (`supabase.auth.*`), invocación de funciones Edge (`supabase.functions.invoke('admin-usuarios'|'portal-acceso', …)`). |
| API Gateway | PostgREST | HTTP interno | — | Reenvío de peticiones de datos. |
| API Gateway | GoTrue | HTTP interno | — | Reenvío de peticiones de autenticación. |
| API Gateway | Edge Runtime | HTTP interno | — | Reenvío de invocaciones de función. |
| PostgREST / GoTrue / Edge Runtime | PostgreSQL | Protocolo de conexión de Postgres (`libpq`) | `54322` | Consultas SQL con el rol `authenticated` (PostgREST, sujeto a RLS) o con la `service_role` key (Edge Functions, que la usan expresamente porque necesita saltarse RLS para operar sobre `auth.users` y, tras el `GRANT` explícito, sobre `usuario`/`propietario`). |
| Edge Runtime (`portal-acceso`) | `smtp.gmail.com` | SMTP + STARTTLS | `587` | Correo de credenciales de acceso al portal (texto plano + HTML), con la contraseña temporal generada. |
| Navegador (desarrollador) | Supabase Studio | HTTPS | `54323` | Inspección manual de la base durante el desarrollo. |

## 4. Distribución de artefactos

| Artefacto | Nodo de despliegue | Origen en el repositorio |
|---|---|---|
| Bundle de la SPA (React + MUI) | Navegador cliente | `frontend/src/**`, compilado por Vite |
| Esquema de base de datos (tablas, vistas, funciones, triggers, RLS) | PostgreSQL | `supabase/migrations/*.sql` (14 archivos, aplicados en orden de *timestamp*) |
| Datos iniciales de desarrollo (catálogos + usuarios demo + datos de prueba) | PostgreSQL | `supabase/seed.sql` (solo entorno local; `CLAUDE.md` prohíbe ejecutarlo contra un proyecto con datos reales) |
| Función Edge `admin-usuarios` | Edge Runtime | `supabase/functions/admin-usuarios/index.ts` |
| Función Edge `portal-acceso` | Edge Runtime | `supabase/functions/portal-acceso/{index.ts,smtp.ts}` |
| Variables de entorno del frontend | Navegador (en tiempo de compilación de Vite) | `frontend/.env.local.example` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Variables de entorno de las funciones Edge | Edge Runtime | `supabase/functions/.env` (cargado automáticamente por `supabase start`; no versionado) |

## 5. Dependencias entre nodos

- El navegador depende del API Gateway para toda operación de datos, sesión o
  invocación de función; no existe ninguna llamada directa del navegador a
  PostgreSQL, a GoTrue o al Edge Runtime que salte el gateway.
- Las funciones Edge dependen de PostgreSQL (vía `service_role`) y, únicamente
  `portal-acceso`, del servidor SMTP externo. `admin-usuarios` no tiene ninguna
  dependencia externa además de PostgreSQL/GoTrue.
- PostgREST y GoTrue dependen de PostgreSQL como único almacén de datos; no hay
  caché intermedia ni una base de datos secundaria.
- Studio e Inbucket son nodos de apoyo al desarrollo: ninguna ruta del flujo
  funcional de la aplicación (frontend → gateway → PostgREST/GoTrue/Edge
  Runtime → Postgres) pasa por ellos.

## 6. Qué no incluir en el diagrama

No existe evidencia en el repositorio de los siguientes elementos, por lo que no
deben representarse como nodos desplegados:

- Un servidor de aplicaciones o backend propio (Node/Express, Java, .NET, etc.):
  toda la lógica de servidor vive en PostgreSQL y en las dos funciones Edge ya
  listadas.
- Un balanceador de carga, proxy inverso o CDN propio del proyecto.
- Un proyecto Supabase alojado (nube) vinculado: `CLAUDE.md` documenta
  explícitamente que el repositorio no está enlazado (`supabase link`) a
  ningún proyecto Supabase alojado.
- Contenedores o *pipelines* de integración continua: no hay carpeta `.github/`
  ni ningún otro archivo de definición de CI/CD en el repositorio.
- Buckets de almacenamiento de archivos o canales de Realtime activos: están
  habilitados por configuración pero ningún código del frontend los invoca (ver
  tabla 2.2).
- Servicios de mapas: no hay ninguna dependencia ni llamada a una API de mapas
  en `package.json` ni en el código.
