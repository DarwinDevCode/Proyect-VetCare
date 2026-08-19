-- RF-028: para emitir la factura de una atencion, Recepcion primero tiene que poder
-- ELEGIR esa atencion. Es la segunda cara del mismo choque que resolvio
-- fn_conceptos_facturables: RN-006 le niega a Recepcion toda lectura sobre
-- `consulta`, asi que sin esta funcion el rol que factura tendria que escribir a
-- ciegas un id_consulta que no puede consultar en ningun lado.
--
-- Igual que alli, se expone lo minimo para identificar la atencion en el mostrador
-- -- fecha, mascota y propietario -- y NADA clinico: ni motivo, ni diagnostico, ni
-- hallazgos, ni tratamiento. El personal de recepcion reconoce la atencion por
-- "Rocky, de Ana Torres, del 19/08", que es exactamente como la nombra el cliente
-- al llegar al mostrador, sin necesidad de saber por que se atendio al animal.
--
-- Solo devuelve atenciones NO facturadas: RN-013 impide facturar dos veces la misma
-- atencion, asi que ofrecerlas seria ofrecer una operacion que la base rechazaria.

create function public.fn_atenciones_facturables()
returns table (
  id_consulta               bigint,
  fecha_hora                timestamptz,
  id_propietario            bigint,
  paciente                  varchar(60),
  propietario_nombres       varchar(60),
  propietario_apellidos     varchar(60),
  propietario_identificacion varchar(13)
)
language sql
stable
security definer set search_path = public
as $$
  select
    c.id_consulta,
    c.fecha_hora,
    pr.id_propietario,
    pa.nombre,
    pr.nombres,
    pr.apellidos,
    pr.identificacion
  from public.consulta c
  join public.paciente pa on pa.id_paciente = c.id_paciente
  join public.propietario pr on pr.id_propietario = pa.id_propietario
  where not exists (
    select 1 from public.factura f where f.id_consulta = c.id_consulta
  )
    and public.fn_rol_actual() in ('recepcionista', 'administrador')
  order by c.fecha_hora desc;
$$;

revoke execute on function public.fn_atenciones_facturables() from public, anon;
grant execute on function public.fn_atenciones_facturables() to authenticated;
