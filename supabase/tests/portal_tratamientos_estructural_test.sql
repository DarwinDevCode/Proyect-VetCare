-- Ampliación posterior a la Fase 5 (RN-006 acotado, ver CLAUDE.md sección 14):
-- v_tratamientos_portal expone tratamiento/motivo/fecha/peso, NUNCA
-- diagnóstico ni hallazgos -- se prueba a nivel de estructura, no solo de
-- política, para que un cambio futuro no pueda ampliar esto por descuido.
-- Corre con: npx supabase test db --local (desde supabase/)
begin;
select plan(6);

select has_view('public', 'v_tratamientos_portal', 'v_tratamientos_portal existe');
select has_column('public', 'v_tratamientos_portal', 'tratamiento', 'expone tratamiento');
select has_column('public', 'v_tratamientos_portal', 'motivo', 'expone motivo (contexto)');
select has_column('public', 'v_tratamientos_portal', 'fecha_hora', 'expone fecha_hora (contexto)');
select hasnt_column('public', 'v_tratamientos_portal', 'diagnostico', 'RN-006: NO expone diagnóstico');
select hasnt_column('public', 'v_tratamientos_portal', 'hallazgos', 'RN-006: NO expone hallazgos');

select * from finish();
rollback;
