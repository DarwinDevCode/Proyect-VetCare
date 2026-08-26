# Índice de artefactos técnicos — VetCare

Este conjunto de documentos se obtuvo mediante ingeniería inversa directa sobre el
sistema VetCare tal como está implementado a la fecha de este análisis (código
fuente en `frontend/src`, migraciones en `supabase/migrations`, funciones en
`supabase/functions`, semilla en `supabase/seed.sql`, configuración en
`supabase/config.toml` y `frontend/*.json`, e historial de Git del repositorio).

## Principio de coherencia

Cuando un documento anterior del proyecto (`CLAUDE.md`, `REDISENO-ORGANIC-PLAN.md`,
o los artefactos de `ARTEFACTOS VETCARE/`) difiere de lo que el código implementa
realmente, estos documentos reflejan la implementación real. Los seis documentos
usan exactamente los mismos nombres que el código para clases, tablas, funciones,
módulos y componentes; un nombre que aparece como `PacienteConFicha` en
`types/dominio.ts` no se renombra en ningún documento de este conjunto.

## Relación con `ARTEFACTOS VETCARE/`

`ARTEFACTOS VETCARE/` es la carpeta de artefactos de diseño original del proyecto
(especificación de requisitos, casos de uso, DFD, diseño de base de datos) y se
mantiene de solo lectura. Dos de sus subcarpetas ya contienen diagramas previos
relacionados con este análisis:

- `8_DIAGRAMAS DE CLASES/`: diagramas de clases de los Módulos 1 a 5 (Pacientes y
  Propietarios, Agenda y Citas, Historial Clínico, Inventario, Facturación y
  Reportes) y de un módulo transversal/de integración. No cubren los Módulos 6, 7
  y 8 (Administración, Compras y Proveedores, Portal del propietario), que se
  incorporaron al sistema después de esos diagramas.
- `9_ DIAGRAMA DE DESPLIEGUE/`: un diagrama de despliegue detallado y uno
  simplificado.

Los documentos de este conjunto (`DOCUMENTACION TECNICA/`) son guías derivadas del
código actual, con alcance sobre los ocho módulos implementados. Se generan aparte
de `ARTEFACTOS VETCARE/` porque esa carpeta es la fuente de verdad de diseño
original y no se modifica.

## Los ocho módulos implementados

| # | Módulo | Ruta principal | Roles con acceso |
|---|---|---|---|
| 1 | Pacientes y Propietarios | `/pacientes` | Recepcionista (lee/escribe), Veterinario (lee) |
| 2 | Agenda y Citas | `/agenda` | Recepcionista (lee/escribe), Veterinario (lee) |
| 3 | Historial Clínico | `/historial` | Veterinario (exclusivo) |
| 4 | Inventario y Medicamentos | `/inventario` | Veterinario (consumo), Administrador (catálogo/ingresos) |
| 5 | Facturación y Reportes | `/facturacion`, `/reportes` | Recepcionista (emite/cobra), Administrador (consulta/reporta) |
| 6 | Administración del sistema | `/administracion` | Administrador (exclusivo) |
| 7 | Compras y Proveedores | `/compras` | Administrador (exclusivo) |
| 8 | Portal del propietario | `/portal/*` | Propietario (identidad separada del personal) |

Los Módulos 1 a 5 corresponden a la Especificación de Requisitos de Software
original (RF-001 a RF-035, incluida la Lista de espera RF-034/RF-035). Los Módulos
6, 7 y 8 amplían el alcance original por instrucción del cliente del proyecto,
documentada en `CLAUDE.md` (secciones 13 y 14).

## Stack tecnológico verificado

| Capa | Tecnología | Versión (declarada en `package.json` / `config.toml`) |
|---|---|---|
| Frontend | React + TypeScript, SPA con Vite | React 19.2.8, TypeScript 7.0.2, Vite 8.2.0 |
| UI | Material UI | `@mui/material` 9.3.1, `@mui/x-date-pickers` 9.11.0 |
| Enrutamiento | React Router | `react-router-dom` 7.18.2 |
| Fechas | Day.js (locale `es`) | `dayjs` 1.11.23 |
| Cliente Supabase | `@supabase/supabase-js` | 2.112.3 |
| Backend / BaaS | Supabase (Auth, PostgREST, Edge Functions) | CLI local, Postgres 17 |
| Base de datos | PostgreSQL | `major_version = 17` (`supabase/config.toml`) |
| Funciones serverless | Deno (Edge Functions) | runtime `supabase-edge-runtime` 1.74 / Deno 2.1 |
| Linter | oxlint | 1.75.0 |

No existe backend propio de aplicación (no hay Node/Express, Java, .NET, etc.): la
lógica de servidor vive en PostgreSQL (funciones `plpgsql`/`sql`, triggers, Row
Level Security) y en dos funciones Edge (`admin-usuarios`, `portal-acceso`) que
usan la `service_role` key de Supabase para las operaciones que tocan `auth.users`.

## Los seis documentos

| Archivo | Contenido |
|---|---|
| [`01_Diagramas_Clases_Guia.md`](01_Diagramas_Clases_Guia.md) | Modelo de clases/entidades del dominio, agrupado por módulo, con atributos, relaciones y multiplicidades reales. |
| [`02_Diagramas_Despliegue_Guia.md`](02_Diagramas_Despliegue_Guia.md) | Nodos, artefactos desplegados, protocolos y puertos del entorno realmente verificable (desarrollo local con Supabase CLI). |
| [`03_Diagramas_Secuencia_Guia.md`](03_Diagramas_Secuencia_Guia.md) | Catorce flujos funcionales priorizados, con participantes, mensajes, fragmentos `alt`/`opt` y persistencia involucrada. |
| [`04_Diagramas_Paquetes_Guia.md`](04_Diagramas_Paquetes_Guia.md) | Organización real de paquetes/carpetas del frontend y del backend (Supabase), con las dependencias reales entre ellos. |
| [`05_Implementacion_BD_SQL.md`](05_Implementacion_BD_SQL.md) | Inventario de los scripts DDL/DML reales, migración por migración, en su orden de ejecución. |
| [`06_Estandares_Programacion_Guia_Estilo.md`](06_Estandares_Programacion_Guia_Estilo.md) | Convenciones de nomenclatura, formato, manejo de errores, acceso a datos y control de versiones observadas en el código y en el historial de Git. |

## Nota sobre el modelo de clases

VetCare no implementa una capa de objetos con clases en el sentido tradicional
(no hay clases TypeScript, ni un backend orientado a objetos): el frontend es un
conjunto de componentes funcionales de React y funciones sueltas, y la lógica de
servidor vive en PostgreSQL. El Documento 1 lo señala de forma explícita y modela
esa realidad con el patrón **Entidad — Control — Frontera** (Entity-Control-
Boundary): las interfaces de `types/dominio.ts` como clases **«entidad»** (solo
atributos), los `api.ts` de cada módulo, los contextos de sesión, los hooks de
dominio y las funciones Edge como clases **«control»** (sus operaciones son las
funciones que realmente exportan o declaran), y las páginas/diálogos de React con
los que interactúa un actor como clases **«frontera»**. Esta separación es la que
permite que cada mensaje de los diagramas de secuencia del Documento 3 corresponda
a un método real de una clase real del Documento 1 — la relación de coherencia que
ambos documentos exigen entre sí.
