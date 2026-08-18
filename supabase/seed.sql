-- VetCare - datos iniciales de configuracion (no son datos de negocio de prueba).
-- Se ejecuta con `supabase db reset`. En un proyecto Supabase alojado, las secciones
-- 1 y 2 (catalogos) se aplican igual; la seccion 3 (usuarios demo) es solo para
-- desarrollo local y NO debe ejecutarse contra un entorno de la clinica real.

-- ============================================================================
-- 1. Roles (D-03 / CU-0.1): la gestion de cuentas esta fuera del alcance del
-- sistema, pero el catalogo de roles es infraestructura minima indispensable.
-- ============================================================================
insert into public.rol (codigo, nombre, descripcion) values
  ('recepcionista', 'Recepcionista', 'Atiende al publico, gestiona pacientes, propietarios, agenda y facturacion'),
  ('veterinario',   'Veterinario',   'Realiza y registra la atencion clinica'),
  ('administrador', 'Administrador', 'Controla el inventario y evalua los resultados economicos');

-- ============================================================================
-- 2. Catalogos clinicos (especie/raza). RNF-024: ampliarlos no requiere cambios
-- de estructura; esta es solo la carga inicial razonable para operar desde el
-- primer dia.
-- ============================================================================
insert into public.especie (nombre) values
  ('Canino'), ('Felino'), ('Ave'), ('Conejo'), ('Roedor'), ('Reptil'), ('Otro');

insert into public.raza (id_especie, nombre)
select e.id_especie, r.nombre
from public.especie e
join (values
  ('Canino', 'Mestizo'), ('Canino', 'Labrador Retriever'), ('Canino', 'Pastor Alemán'),
  ('Canino', 'Poodle'), ('Canino', 'Bulldog Francés'), ('Canino', 'Chihuahua'),
  ('Canino', 'Golden Retriever'), ('Canino', 'Schnauzer'), ('Canino', 'Beagle'),
  ('Felino', 'Mestizo'), ('Felino', 'Siamés'), ('Felino', 'Persa'),
  ('Felino', 'Angora'), ('Felino', 'Maine Coon'), ('Felino', 'Bengalí'),
  ('Ave', 'Canario'), ('Ave', 'Periquito'), ('Ave', 'Loro'), ('Ave', 'Cacatúa'),
  ('Conejo', 'Mestizo'), ('Conejo', 'Holandés'), ('Conejo', 'Cabeza de León'),
  ('Roedor', 'Hámster'), ('Roedor', 'Cuy'), ('Roedor', 'Chinchilla'),
  ('Reptil', 'Tortuga'), ('Reptil', 'Iguana')
) as r (especie, nombre) on r.especie = e.nombre;

-- ============================================================================
-- 3. Usuarios de demostracion -- SOLO ENTORNO LOCAL DE DESARROLLO.
-- Credenciales documentadas en CLAUDE.md. Un entorno real se puebla siguiendo
-- el procedimiento de "Roles y permisos" de CLAUDE.md (API admin de GoTrue).
-- ============================================================================
do $$
declare
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000';
  v_password    text := crypt('VetCare#2026', gen_salt('bf'));
  v_recepcion   uuid := '00000000-0000-0000-0000-000000000001';
  v_veterinario uuid := '00000000-0000-0000-0000-000000000002';
  v_admin       uuid := '00000000-0000-0000-0000-000000000003';
begin
  -- confirmation_token/recovery_token/email_change_token_new/email_change no tienen
  -- default en el esquema de GoTrue y su driver no acepta NULL al leerlos de vuelta;
  -- deben insertarse explicitamente como cadena vacia.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values
    (v_instance_id, v_recepcion, 'authenticated', 'authenticated', 'recepcion@vetcare.local', v_password, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', ''),
    (v_instance_id, v_veterinario, 'authenticated', 'authenticated', 'veterinario@vetcare.local', v_password, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', ''),
    (v_instance_id, v_admin, 'authenticated', 'authenticated', 'admin@vetcare.local', v_password, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '');

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, created_at, updated_at
  ) values
    (gen_random_uuid(), v_recepcion::text, v_recepcion, jsonb_build_object('sub', v_recepcion::text, 'email', 'recepcion@vetcare.local'), 'email', now(), now()),
    (gen_random_uuid(), v_veterinario::text, v_veterinario, jsonb_build_object('sub', v_veterinario::text, 'email', 'veterinario@vetcare.local'), 'email', now(), now()),
    (gen_random_uuid(), v_admin::text, v_admin, jsonb_build_object('sub', v_admin::text, 'email', 'admin@vetcare.local'), 'email', now(), now());

  insert into public.usuario (id_usuario, id_rol, nombres, apellidos, correo)
  select v_recepcion, id_rol, 'Ana', 'Recepción', 'recepcion@vetcare.local' from public.rol where codigo = 'recepcionista'
  union all
  select v_veterinario, id_rol, 'Carlos', 'Veterinario', 'veterinario@vetcare.local' from public.rol where codigo = 'veterinario'
  union all
  select v_admin, id_rol, 'Beatriz', 'Administradora', 'admin@vetcare.local' from public.rol where codigo = 'administrador';
end $$;
