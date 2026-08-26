-- fn_cancelar_cita_portal (ampliación posterior a la Fase 5, ver CLAUDE.md
-- sección 14): un propietario puede cancelar su propia cita 'solicitada' o
-- 'programada', nunca una ajena ni una ya no cancelable. SECURITY DEFINER de
-- una sola columna fija -- no una política RLS UPDATE (ver el porqué en
-- CLAUDE.md, misma sección).
-- Corre con: npx supabase test db --local (desde supabase/)
begin;
select plan(4);

-- Fixtures creados como postgres (superusuario, sin RLS) -- cita_insert_portal
-- exige estado='solicitada' e id_veterinario null, no sirve para armar un
-- fixture 'programada' de prueba.
-- Cita propia: Toby (paciente 1) es de propietario 1 (María Fernanda, la
-- cuenta de portal sembrada).
insert into public.cita (id_paciente, id_veterinario, fecha_hora_inicio, duracion_minutos, estado)
values (1, '00000000-0000-0000-0000-000000000002', '2031-07-01 09:00:00+00', 30, 'programada')
returning id_cita as id_cita_propia \gset

-- Cita ajena: Rocky (paciente 3) es de propietario 2 (Jorge Luis Torres), no
-- del propietario que se simula abajo.
insert into public.cita (id_paciente, id_veterinario, fecha_hora_inicio, duracion_minutos, estado)
values (3, '00000000-0000-0000-0000-000000000002', '2031-07-01 10:00:00+00', 30, 'programada')
returning id_cita as id_cita_ajena \gset

-- Simula la sesión del propietario 1 (id_usuario_portal sembrado en seed.sql).
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';

select lives_ok(
  format('select public.fn_cancelar_cita_portal(%s)', :id_cita_propia),
  'cancela su propia cita programada sin error'
);

select is(
  (select estado::text from public.cita where id_cita = :id_cita_propia),
  'cancelada',
  'la cita queda en estado cancelada (RN-005: el registro se conserva, no se borra)'
);

-- throws_ok de 4 argumentos (sql, codigo, NULL, descripcion), no 3 -- ver el
-- comentario de rn004_solapamiento_citas_test.sql sobre por qué.
select throws_ok(
  format('select public.fn_cancelar_cita_portal(%s)', :id_cita_propia),
  'P0001'::char(5),
  NULL,
  'cancelar la misma cita otra vez falla (ya no está solicitada/programada)'
);

select throws_ok(
  format('select public.fn_cancelar_cita_portal(%s)', :id_cita_ajena),
  'P0001'::char(5),
  NULL,
  'cancelar una cita de OTRO propietario falla (no le pertenece)'
);

select * from finish();
rollback;
