-- Regresion del bug real documentado en CLAUDE.md (seccion 9, "Problemas
-- conocidos"): RF-031 concede a Administrador la consulta de facturas
-- emitidas, pero la politica original de `propietario` (Modulo 1) solo daba
-- lectura a Recepcionista y Veterinario -- Administrador veia el listado de
-- facturas completamente vacio porque el filtro por propietario usa `!inner`.
-- Corregido en 20260819075223_propietario_facturado_para_administrador.sql
-- con una politica acotada: Administrador ve un propietario SOLO si tiene al
-- menos una factura emitida, nunca el padron completo.
-- Corre con: npx supabase test db --local (desde supabase/)
begin;
select plan(3);

-- Fixtures propios, no se depende del seed: un propietario con una factura y
-- otro sin ninguna, creados como postgres (superusuario, sin RLS).
insert into public.propietario (identificacion, nombres, apellidos, telefono, direccion)
values ('9999999999', 'Test', 'ConFactura', '0999999999', 'Direccion de prueba')
returning id_propietario as id_prop_con_factura \gset

insert into public.propietario (identificacion, nombres, apellidos, telefono, direccion)
values ('9999999998', 'Test', 'SinFactura', '0999999998', 'Direccion de prueba')
returning id_propietario as id_prop_sin_factura \gset

insert into public.factura (numero, id_propietario, id_usuario_emisor, subtotal, impuesto)
values ('TEST-RF031', :id_prop_con_factura, '00000000-0000-0000-0000-000000000001', 10, 1.5);

-- Simula la sesion de Administrador (mismo mecanismo que fn_cancelar_cita_portal_test.sql).
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';

select is(
  (select count(*)::int from public.propietario where id_propietario = :id_prop_con_factura),
  1,
  'Administrador SI ve un propietario con al menos una factura emitida (RF-031)'
);

select is(
  (select count(*)::int from public.propietario where id_propietario = :id_prop_sin_factura),
  0,
  'Administrador NO ve un propietario sin ninguna factura -- no se abrio el padron completo'
);

-- Regresion de seguridad: la politica nueva no debe afectar el acceso de
-- Recepcionista (Modulo 1, sin condicion de facturas).
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';

select is(
  (select count(*)::int from public.propietario where id_propietario in (:id_prop_con_factura, :id_prop_sin_factura)),
  2,
  'Recepcionista sigue viendo ambos propietarios, tenga o no facturas (RF-007, sin cambios)'
);

select * from finish();
rollback;
