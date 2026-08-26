-- Fase 5 del rediseno Organic (ver REDISENO-ORGANIC-PLAN.md): RF-042 a RF-045, Modulo 8
-- nuevo -- "Portal del propietario". Amplia deliberadamente la exclusion de "Portal o
-- aplicacion de autoservicio para el propietario" del SRS y contradice a proposito el
-- supuesto de fondo de CLAUDE.md seccion 1 ("el propietario no es usuario del sistema")
-- -- por instruccion explicita del cliente, no por reinterpretacion propia del SRS. Es la
-- pieza de mayor riesgo arquitectonico de todo el plan: identidad paralela a la de
-- personal, y una modificacion real sobre una restriccion ya aprobada y probada
-- (el EXCLUDE de solapamiento de citas). RN-006 sigue intacto tambien aqui: el portal
-- nunca expone diagnostico, hallazgos ni tratamiento (ver v_carnet_portal mas abajo).

-- ============================================================================
-- Identidad de portal
-- ============================================================================

-- Nullable: la mayoria de propietarios de hoy nunca tendran cuenta de portal (se
-- emite bajo pedido, desde la ficha del propietario -- ver FichaDialog.tsx). "on
-- delete set null" en vez de "restrict": si la cuenta de auth.users se elimina algun
-- dia por fuera de la app, el propietario (y su historial) no debe quedar bloqueado.
alter table public.propietario
  add column id_usuario_portal uuid unique references auth.users (id) on delete set null;

-- Analoga a fn_rol_actual() (row_level_security.sql), pero para la identidad de
-- portal: devuelve el id_propietario vinculado a auth.uid(), o null si quien llama
-- no es una cuenta de portal (incluida cualquier cuenta de personal, que nunca tiene
-- id_usuario_portal apuntandole). SECURITY DEFINER: sin esto, un propietario no
-- autenticado como personal no podria ni siquiera evaluar esta funcion contra
-- propietario, porque las politicas de esa tabla (staff-only, antes de esta
-- migracion) se lo negarian.
create or replace function public.fn_propietario_actual()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select id_propietario from public.propietario where id_usuario_portal = auth.uid()
$$;

-- ============================================================================
-- Hallazgo de arquitectura #2 del plan: el EXCLUDE de solapamiento (RN-004) no
-- admite una cita sin veterinario asignado. Una "solicitud de cita" desde el portal
-- (el dueno no elige veterinario ni horario exacto) necesita id_veterinario
-- nullable, un tercer estado, y el EXCLUDE recreado para que una solicitud no
-- compita por el indice hasta que el personal la confirme.
-- ============================================================================

alter table public.cita alter column id_veterinario drop not null;

alter table public.cita drop constraint cita_estado_check;
alter table public.cita add constraint cita_estado_check
  check (estado in ('solicitada', 'programada', 'cancelada', 'atendida'));

-- Postgres no permite ALTER sobre un EXCLUDE: hay que recrearlo. El nombre
-- (cita_id_veterinario_tstzrange_excl) es el que Postgres le asigno automaticamente
-- al crearlo en initial_schema.sql -- verificado contra el catalogo antes de escribir
-- este DROP, para no fallar por un nombre supuesto.
alter table public.cita drop constraint cita_id_veterinario_tstzrange_excl;
alter table public.cita add constraint cita_id_veterinario_tstzrange_excl
  exclude using gist (
    id_veterinario with =,
    tstzrange(fecha_hora_inicio, fecha_hora_fin) with &&
  ) where (estado in ('programada', 'atendida'));
-- Nota: NULL nunca es igual a NULL para un operador "=", asi que dos citas
-- 'solicitada' (siempre con id_veterinario null) jamas colisionarian entre si de
-- todas formas -- el "where" de arriba ya las excluye del indice por completo, con
-- lo que es una garantia redundante, no la unica.

-- ============================================================================
-- RLS identity-scoped -- NO se basan en fn_rol_actual() (que da null para una
-- cuenta de portal): eso ya las excluye automaticamente de las ~40 politicas de
-- personal existentes, sin tocar ninguna de ellas. Mismo criterio de "una politica
-- adicional acotada" que ya se uso para el RLS de propietario en la Fase 1
-- (..._propietario_facturado_para_administrador.sql, CLAUDE.md seccion 9).
-- ============================================================================

create policy propietario_select_portal on public.propietario
  for select to authenticated
  using (id_usuario_portal = auth.uid());

create policy paciente_select_portal on public.paciente
  for select to authenticated
  using (paciente.id_propietario = public.fn_propietario_actual());

create policy cita_select_portal on public.cita
  for select to authenticated
  using (
    exists (
      select 1 from public.paciente
      where paciente.id_paciente = cita.id_paciente
        and paciente.id_propietario = public.fn_propietario_actual()
    )
  );

-- RF-043/RN-021: el propietario puede "solicitar" una cita (motivo + mascota, sin
-- elegir veterinario/horario real) pero nunca insertar una cita real -- eso sigue
-- siendo exclusivo de Recepcionista (cita_insert). id_veterinario is null y
-- estado='solicitada' son literales exigidos aqui, no solo un valor por defecto: un
-- propietario no puede reservar un cupo real saltandose a Recepcion.
create policy cita_insert_portal on public.cita
  for insert to authenticated
  with check (
    estado = 'solicitada'
    and id_veterinario is null
    and exists (
      select 1 from public.paciente
      where paciente.id_paciente = cita.id_paciente
        and paciente.id_propietario = public.fn_propietario_actual()
    )
  );

create policy factura_select_portal on public.factura
  for select to authenticated
  using (factura.id_propietario = public.fn_propietario_actual());

create policy detalle_factura_select_portal on public.detalle_factura
  for select to authenticated
  using (
    exists (
      select 1 from public.factura
      where factura.id_factura = detalle_factura.id_factura
        and factura.id_propietario = public.fn_propietario_actual()
    )
  );

create policy pago_select_portal on public.pago
  for select to authenticated
  using (
    exists (
      select 1 from public.factura
      where factura.id_factura = pago.id_factura
        and factura.id_propietario = public.fn_propietario_actual()
    )
  );

-- ============================================================================
-- RF-044: carnet de vacunas del portal. RN-006 tambien aplica aqui -- el portal
-- jamas debe exponer consulta ni examen_laboratorio (diagnostico, hallazgos,
-- tratamiento, resultados). vacunacion SI tiene RLS staff-only (solo Veterinario);
-- esta vista cruza ese limite de forma acotada y auditable, igual que
-- fn_conceptos_facturables cruza RN-006 para Recepcion (facturacion.sql).
--
-- A diferencia de v_historial_clinico/v_estado_factura/v_alerta_stock, esta vista
-- NO lleva security_invoker: si lo llevara, la RLS de vacunacion (staff-only) le
-- devolveria siempre vacio a un propietario. En su lugar, la vista corre con los
-- privilegios de quien la crea (el comportamiento por defecto de una vista) y se
-- auto-acota con "where ... = fn_propietario_actual()" -- la misma tecnica que una
-- funcion SECURITY DEFINER, pero expresada como vista porque no devuelve una unica
-- fila. Para cualquier cuenta de personal, fn_propietario_actual() da null y la
-- vista simplemente no devuelve filas (el portal es su unico consumidor real).
-- ============================================================================
create view public.v_carnet_portal as
  select
    v.id_paciente,
    v.id_vacunacion,
    p.nombre                                                              as producto,
    v.fecha_aplicacion,
    v.dosis,
    case when p.intervalo_dias is not null
      then (v.fecha_aplicacion + p.intervalo_dias * interval '1 day')::date
    end                                                                    as proxima_fecha
  from public.vacunacion v
  join public.producto p on p.id_producto = v.id_producto
  join public.paciente pa on pa.id_paciente = v.id_paciente
  where pa.id_propietario = public.fn_propietario_actual();

grant select on public.v_carnet_portal to authenticated;

-- RI-008: la Edge Function portal-acceso (supabase/functions/portal-acceso) usa la
-- service_role key para vincular id_usuario_portal -- mismo problema ya documentado
-- en CLAUDE.md seccion 9 para admin-usuarios/usuario: las versiones recientes del
-- CLI ya no exponen tablas nuevas (ni las existentes tocadas por primera vez desde
-- service_role) automaticamente a ese rol.
grant select, update on public.propietario to service_role;
