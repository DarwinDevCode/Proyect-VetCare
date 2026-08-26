-- RN-004: un veterinario no puede tener dos citas no canceladas que se
-- solapen (EXCLUDE declarativo con btree_gist, ver CLAUDE.md sección 6).
-- Corre con: npx supabase test db --local (desde supabase/)
begin;
select plan(3);

-- Cita base en una fecha que no choca con el seed real (2031, muy en el
-- futuro) -- veterinario sembrado (Carlos), paciente sembrado (Toby).
insert into public.cita (id_paciente, id_veterinario, fecha_hora_inicio, duracion_minutos, estado)
values (1, '00000000-0000-0000-0000-000000000002', '2031-06-01 10:00:00+00', 30, 'programada');

-- throws_ok de 4 argumentos, no 3: la variante de 3 (sql, codigo, descripcion)
-- de pgTAP es "inteligente" y, cuando el 2do argumento mide exactamente 5
-- caracteres (como cualquier SQLSTATE), lo reenvia a la variante de 4
-- argumentos poniendo el 3er argumento en el lugar de "mensaje esperado" en
-- vez de "descripcion" -- comprobado leyendo pg_proc.prosrc de pgtap
-- directamente. Con NULL explicito en el 3er lugar, solo se compara el
-- codigo SQLSTATE y el 4to argumento si es la descripcion.
select throws_ok(
  $$insert into public.cita (id_paciente, id_veterinario, fecha_hora_inicio, duracion_minutos, estado)
    values (1, '00000000-0000-0000-0000-000000000002', '2031-06-01 10:15:00+00', 30, 'programada')$$,
  '23P01'::char(5),
  NULL,
  'RN-004: una cita que se solapa con otra del mismo veterinario es rechazada'
);

select lives_ok(
  $$insert into public.cita (id_paciente, id_veterinario, fecha_hora_inicio, duracion_minutos, estado)
    values (1, '00000000-0000-0000-0000-000000000002', '2031-06-01 11:00:00+00', 30, 'programada')$$,
  'una cita que NO se solapa (mismo veterinario, horario distinto) se acepta'
);

select lives_ok(
  $$insert into public.cita (id_paciente, id_veterinario, fecha_hora_inicio, duracion_minutos, estado)
    values (1, '00000000-0000-0000-0000-000000000002', '2031-06-01 10:00:00+00', 30, 'cancelada')$$,
  'RN-005: una cita cancelada no cuenta para el solapamiento, aunque el horario coincida exacto'
);

select * from finish();
rollback;
