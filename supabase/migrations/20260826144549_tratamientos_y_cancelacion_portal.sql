-- VetCare - Portal del propietario: dos ampliaciones deliberadas, confirmadas
-- explicitamente con el cliente (mismo peso que Modulos 6/7/8), ver CLAUDE.md.
--
-- 1) v_tratamientos_portal amplia RN-006 ("Unicamente el rol Veterinario
--    registra y consulta informacion clinica") de forma acotada: expone SOLO
--    tratamiento (con motivo/fecha/peso como contexto) de las consultas de las
--    propias mascotas del propietario -- nunca diagnostico ni hallazgos, que
--    son mas sensibles y no se pidieron. Misma tecnica que v_carnet_portal
--    (portal_propietario.sql): sin security_invoker (la RLS de consulta es
--    staff-only y le devolveria vacio) y autoacotada con fn_propietario_actual().
--
-- 2) fn_cancelar_cita_portal deja que un propietario cancele su propia cita.
--    No se agrega una politica RLS UPDATE directa sobre cita: un WITH CHECK
--    solo valida la fila resultante (dueño + estado='cancelada'), no impide
--    que la misma sentencia cambie ademas otras columnas (motivo, horario) --
--    un PATCH de PostgREST con mas campos en el body pasaria igual. En cambio,
--    una funcion SECURITY DEFINER de una sola columna fija cierra esa puerta
--    por completo (mismo criterio que fn_emitir_factura/fn_conceptos_facturables:
--    cruzar un limite de forma angosta y auditable).

create view public.v_tratamientos_portal as
  select
    c.id_paciente,
    c.id_consulta,
    c.fecha_hora,
    c.motivo,
    c.tratamiento,
    c.peso_kg
  from public.consulta c
  join public.paciente pa on pa.id_paciente = c.id_paciente
  where pa.id_propietario = public.fn_propietario_actual()
    and c.tratamiento is not null;

grant select on public.v_tratamientos_portal to authenticated;

create or replace function public.fn_cancelar_cita_portal(p_id_cita bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estado text;
begin
  select cita.estado into v_estado
  from public.cita
  join public.paciente on paciente.id_paciente = cita.id_paciente
  where cita.id_cita = p_id_cita
    and paciente.id_propietario = public.fn_propietario_actual();

  if v_estado is null then
    raise exception 'Esta cita no existe o no te pertenece.';
  end if;
  if v_estado not in ('solicitada', 'programada') then
    raise exception 'Esta cita ya no se puede cancelar.';
  end if;

  update public.cita set estado = 'cancelada' where id_cita = p_id_cita;
end;
$$;

grant execute on function public.fn_cancelar_cita_portal(bigint) to authenticated;
