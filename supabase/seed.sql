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
--
-- La 4a identidad (v_propietario) es de portal, no de personal (Fase 5): se crea
-- el auth.users/identities aqui igual que las otras tres, pero NO se inserta en
-- public.usuario -- esa tabla es solo de personal. Su vinculo real
-- (propietario.id_usuario_portal) se completa mas abajo, en la seccion 4.1,
-- cuando el propietario al que se vincula ya existe. Permite probar RLS de
-- portal en local sin pasar por la Edge Function portal-acceso cada vez.
-- ============================================================================
do $$
declare
  v_instance_id uuid := '00000000-0000-0000-0000-000000000000';
  v_password    text := crypt('VetCare#2026', gen_salt('bf'));
  v_recepcion   uuid := '00000000-0000-0000-0000-000000000001';
  v_veterinario uuid := '00000000-0000-0000-0000-000000000002';
  v_admin       uuid := '00000000-0000-0000-0000-000000000003';
  v_propietario uuid := '00000000-0000-0000-0000-000000000004';
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
    (v_instance_id, v_admin, 'authenticated', 'authenticated', 'admin@vetcare.local', v_password, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', ''),
    (v_instance_id, v_propietario, 'authenticated', 'authenticated', 'propietario@vetcare.local', v_password, now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', '', '', '', '');

  insert into auth.identities (
    id, provider_id, user_id, identity_data, provider, created_at, updated_at
  ) values
    (gen_random_uuid(), v_recepcion::text, v_recepcion, jsonb_build_object('sub', v_recepcion::text, 'email', 'recepcion@vetcare.local'), 'email', now(), now()),
    (gen_random_uuid(), v_veterinario::text, v_veterinario, jsonb_build_object('sub', v_veterinario::text, 'email', 'veterinario@vetcare.local'), 'email', now(), now()),
    (gen_random_uuid(), v_admin::text, v_admin, jsonb_build_object('sub', v_admin::text, 'email', 'admin@vetcare.local'), 'email', now(), now()),
    (gen_random_uuid(), v_propietario::text, v_propietario, jsonb_build_object('sub', v_propietario::text, 'email', 'propietario@vetcare.local'), 'email', now(), now());

  insert into public.usuario (id_usuario, id_rol, nombres, apellidos, correo)
  select v_recepcion, id_rol, 'Ana', 'Recepción', 'recepcion@vetcare.local' from public.rol where codigo = 'recepcionista'
  union all
  select v_veterinario, id_rol, 'Carlos', 'Veterinario', 'veterinario@vetcare.local' from public.rol where codigo = 'veterinario'
  union all
  select v_admin, id_rol, 'Beatriz', 'Administradora', 'admin@vetcare.local' from public.rol where codigo = 'administrador';
end $$;

-- ============================================================================
-- 4. Datos de negocio ficticios -- SOLO ENTORNO LOCAL DE DESARROLLO/DEMOSTRACION.
-- No son datos de la clinica real; sirven para probar los cinco modulos con un
-- conjunto coherente (propietarios -> pacientes -> citas -> historial clinico ->
-- inventario -> facturacion), incluyendo los casos de borde que documenta
-- CLAUDE.md (edad desconocida, examen pendiente de resultado, factura pendiente/
-- parcial/pagada, alerta de stock bajo minimo).
--
-- Se inserta con SQL directo (no a traves de fn_emitir_factura ni de la API REST)
-- porque este bloque corre como superusuario sin sesion de auth.uid(): RLS no
-- interviene aqui (igual que en la seccion 3), pero los triggers de reglas de
-- negocio si se ejecutan con normalidad, asi que el resultado es indistinguible
-- de datos cargados desde la aplicacion. Por eso los campos que la aplicacion
-- nunca deja escribir al cliente (id_veterinario, id_usuario, numero de factura,
-- existencia_actual/resultante, fecha_hora_fin, subtotal, total) se completan
-- aqui exactamente igual: por defecto o por trigger, nunca a mano.
-- ============================================================================
do $$
declare
  v_recepcion   uuid := '00000000-0000-0000-0000-000000000001';
  v_veterinario uuid := '00000000-0000-0000-0000-000000000002';
  v_admin       uuid := '00000000-0000-0000-0000-000000000003';

  v_p1 bigint; v_p2 bigint; v_p3 bigint; v_p4 bigint; v_p5 bigint;
  v_p6 bigint; v_p7 bigint; v_p8 bigint;

  v_m1 bigint; v_m2 bigint; v_m3 bigint; v_m4 bigint; v_m5 bigint; v_m6 bigint;
  v_m7 bigint; v_m8 bigint; v_m9 bigint; v_m10 bigint; v_m11 bigint; v_m12 bigint;

  v_c1 bigint; v_c2 bigint; v_c3 bigint; v_c4 bigint; v_c5 bigint;

  v_q1 bigint; v_q2 bigint; v_q3 bigint; v_q4 bigint; v_q5 bigint; v_q6 bigint; v_q7 bigint;

  v_f1 bigint; v_f2 bigint; v_f3 bigint; v_f4 bigint; v_f5 bigint; v_f6 bigint;

  v_oc_id bigint;

  v_id_canino  smallint := (select id_especie from public.especie where nombre = 'Canino');
  v_id_felino  smallint := (select id_especie from public.especie where nombre = 'Felino');
  v_id_ave     smallint := (select id_especie from public.especie where nombre = 'Ave');
  v_id_conejo  smallint := (select id_especie from public.especie where nombre = 'Conejo');
begin
  -- --------------------------------------------------------------------------
  -- 4.1 Propietarios (Modulo 1). Cedulas ecuatorianas ficticias (10 digitos).
  -- --------------------------------------------------------------------------
  -- id_usuario_portal vincula a la 4a identidad de la seccion 3 (Fase 5) -- este
  -- es el unico propietario del seed con acceso al portal ya activo.
  insert into public.propietario (identificacion, nombres, apellidos, telefono, correo, direccion, id_usuario_portal)
    values ('1712345678', 'María Fernanda', 'Chávez Rodríguez', '0991234567', 'maria.chavez@gmail.com', 'Av. Amazonas N34-56, Quito', '00000000-0000-0000-0000-000000000004')
    returning id_propietario into v_p1;
  insert into public.propietario (identificacion, nombres, apellidos, telefono, correo, direccion)
    values ('1723456789', 'Jorge Luis', 'Torres Vega', '0987654321', 'jorge.torres@hotmail.com', 'Calle Los Cerezos 123, Quito')
    returning id_propietario into v_p2;
  insert into public.propietario (identificacion, nombres, apellidos, telefono, correo, direccion)
    values ('1734567890', 'Andrea Paola', 'Suárez Mendoza', '0998765432', 'andrea.suarez@gmail.com', 'Av. 6 de Diciembre y Colón, Quito')
    returning id_propietario into v_p3;
  insert into public.propietario (identificacion, nombres, apellidos, telefono, direccion)
    values ('1745678901', 'Diego Fernando', 'Ramírez Ortiz', '0976543210', 'Av. Occidental 789, Quito')
    returning id_propietario into v_p4;
  insert into public.propietario (identificacion, nombres, apellidos, telefono, correo, telefono_alterno, direccion)
    values ('1756789012', 'Lucía Isabel', 'Paredes Guzmán', '0965432109', 'lucia.paredes@gmail.com', '022345678', 'Sector La Floresta, Quito')
    returning id_propietario into v_p5;
  insert into public.propietario (identificacion, nombres, apellidos, telefono, direccion)
    values ('1767890123', 'Carlos Alberto', 'Jiménez Salazar', '0954321098', 'Calle Rumipamba 456, Quito')
    returning id_propietario into v_p6;
  insert into public.propietario (identificacion, nombres, apellidos, telefono, correo, direccion)
    values ('1778901234', 'Gabriela Nicole', 'Castillo Vera', '0943210987', 'gabriela.castillo@outlook.com', 'Av. República del Salvador 234, Quito')
    returning id_propietario into v_p7;
  insert into public.propietario (identificacion, nombres, apellidos, telefono, correo, direccion)
    values ('1789012345', 'Roberto Miguel', 'Herrera León', '0932109876', 'roberto.herrera@gmail.com', 'Conjunto Los Álamos, Quito')
    returning id_propietario into v_p8;

  -- --------------------------------------------------------------------------
  -- 4.2 Pacientes (Modulo 1). RF-006: raza siempre de la especie declarada.
  -- Thor y Luna sin fecha_nacimiento -- RF-010: "edad desconocida" (rescatados).
  -- --------------------------------------------------------------------------
  insert into public.paciente (id_propietario, id_especie, id_raza, nombre, sexo, fecha_nacimiento, color)
    values (v_p1, v_id_canino, (select id_raza from public.raza where id_especie = v_id_canino and nombre = 'Labrador Retriever'), 'Toby', 'M', '2022-03-15', 'Dorado')
    returning id_paciente into v_m1;
  insert into public.paciente (id_propietario, id_especie, id_raza, nombre, sexo, fecha_nacimiento, color)
    values (v_p1, v_id_felino, (select id_raza from public.raza where id_especie = v_id_felino and nombre = 'Siamés'), 'Misha', 'H', '2023-07-01', 'Crema')
    returning id_paciente into v_m2;
  insert into public.paciente (id_propietario, id_especie, id_raza, nombre, sexo, fecha_nacimiento, color)
    values (v_p2, v_id_canino, (select id_raza from public.raza where id_especie = v_id_canino and nombre = 'Pastor Alemán'), 'Rocky', 'M', '2021-01-10', 'Negro y café')
    returning id_paciente into v_m3;
  insert into public.paciente (id_propietario, id_especie, id_raza, nombre, sexo, fecha_nacimiento, color)
    values (v_p3, v_id_felino, (select id_raza from public.raza where id_especie = v_id_felino and nombre = 'Mestizo'), 'Luna', 'H', null, 'Blanco y negro')
    returning id_paciente into v_m4;
  insert into public.paciente (id_propietario, id_especie, id_raza, nombre, sexo, fecha_nacimiento, color)
    values (v_p4, v_id_canino, (select id_raza from public.raza where id_especie = v_id_canino and nombre = 'Bulldog Francés'), 'Max', 'M', '2020-11-20', 'Atigrado')
    returning id_paciente into v_m5;
  insert into public.paciente (id_propietario, id_especie, id_raza, nombre, sexo, fecha_nacimiento, color)
    values (v_p5, v_id_ave, (select id_raza from public.raza where id_especie = v_id_ave and nombre = 'Periquito'), 'Coco', 'M', '2024-02-14', 'Verde')
    returning id_paciente into v_m6;
  insert into public.paciente (id_propietario, id_especie, id_raza, nombre, sexo, fecha_nacimiento, color)
    values (v_p5, v_id_canino, (select id_raza from public.raza where id_especie = v_id_canino and nombre = 'Golden Retriever'), 'Nala', 'H', '2022-09-05', 'Dorado claro')
    returning id_paciente into v_m7;
  insert into public.paciente (id_propietario, id_especie, id_raza, nombre, sexo, fecha_nacimiento, color)
    values (v_p6, v_id_felino, (select id_raza from public.raza where id_especie = v_id_felino and nombre = 'Persa'), 'Simba', 'M', '2019-05-30', 'Naranja')
    returning id_paciente into v_m8;
  insert into public.paciente (id_propietario, id_especie, id_raza, nombre, sexo, fecha_nacimiento, color)
    values (v_p7, v_id_canino, (select id_raza from public.raza where id_especie = v_id_canino and nombre = 'Poodle'), 'Bella', 'H', '2023-12-01', 'Blanco')
    returning id_paciente into v_m9;
  insert into public.paciente (id_propietario, id_especie, id_raza, nombre, sexo, fecha_nacimiento, color)
    values (v_p7, v_id_conejo, (select id_raza from public.raza where id_especie = v_id_conejo and nombre = 'Holandés'), 'Thor', 'M', null, 'Blanco y negro')
    returning id_paciente into v_m10;
  insert into public.paciente (id_propietario, id_especie, id_raza, nombre, sexo, fecha_nacimiento, color)
    values (v_p8, v_id_canino, (select id_raza from public.raza where id_especie = v_id_canino and nombre = 'Chihuahua'), 'Kiara', 'H', '2021-06-18', 'Café')
    returning id_paciente into v_m11;
  insert into public.paciente (id_propietario, id_especie, id_raza, nombre, sexo, fecha_nacimiento, color)
    values (v_p8, v_id_canino, (select id_raza from public.raza where id_especie = v_id_canino and nombre = 'Mestizo'), 'Rex', 'M', '2018-04-02', 'Negro')
    returning id_paciente into v_m12;

  -- --------------------------------------------------------------------------
  -- 4.3 Catalogo de productos (Modulo 4). Sin existencia inicial en el insert
  -- (existencia_actual la mantiene siempre fn_actualizar_existencia, nunca un
  -- valor de formulario) -- se establece abajo con movimientos de ingreso.
  -- --------------------------------------------------------------------------
  -- intervalo_dias (Fase 2, RF-041): solo las vacunas tienen un esquema de refuerzo
  -- conocido -- las demas quedan en null a proposito (v_vacunas_proximas las omite).
  insert into public.producto (codigo, nombre, tipo, presentacion, unidad_medida, nivel_minimo, precio_unitario, intervalo_dias) values
    ('MED-001', 'Amoxicilina 500mg', 'medicamento', 'Caja x20 tabletas', 'caja', 10, 8.50, null),
    ('MED-002', 'Meloxicam 1.5mg/ml', 'medicamento', 'Frasco 100ml', 'frasco', 5, 12.00, null),
    ('MED-003', 'Ivermectina 1%', 'medicamento', 'Frasco 50ml', 'frasco', 5, 15.75, null),
    ('MED-004', 'Dexametasona 4mg/ml', 'medicamento', 'Ampolla 1ml', 'ampolla', 15, 3.20, null),
    ('MED-005', 'Suero Ringer Lactato', 'medicamento', 'Bolsa 500ml', 'bolsa', 10, 4.50, null),
    ('INS-001', 'Jeringa 5ml', 'insumo', null, 'unidad', 50, 0.35, null),
    ('INS-002', 'Guantes de nitrilo', 'insumo', 'Caja x100', 'par', 100, 0.25, null),
    ('INS-003', 'Gasa estéril', 'insumo', 'Paquete x10', 'paquete', 20, 1.10, null),
    ('INS-004', 'Catéter IV 22G', 'insumo', null, 'unidad', 15, 1.80, null),
    ('VAC-001', 'Vacuna Óctuple canina', 'vacuna', null, 'dosis', 8, 18.00, 365),
    ('VAC-002', 'Vacuna Antirrábica', 'vacuna', null, 'dosis', 10, 10.00, 365),
    ('VAC-003', 'Vacuna Triple felina', 'vacuna', null, 'dosis', 6, 16.50, 365);

  -- Existencia inicial: movimientos de ingreso (RF-022), 25 dias antes de hoy.
  -- Lote/vencimiento (Fase 2, version ligera de lotes -- CLAUDE.md seccion 14) solo se
  -- registra en medicamentos y vacunas, igual que en la practica real de una clinica;
  -- el lote de Vacuna Triple felina vence pronto a proposito, para dejar activa la
  -- alerta de v_lotes_por_vencer/RF-026 desde el primer arranque.
  insert into public.movimiento_inventario (id_producto, tipo_movimiento, cantidad, fecha_hora, id_usuario, observacion, lote_codigo, fecha_vencimiento) values
    ((select id_producto from public.producto where codigo = 'MED-001'), 'ingreso', 50,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor', 'AMX-2026-08', '2027-08-01'),
    ((select id_producto from public.producto where codigo = 'MED-002'), 'ingreso', 20,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor', 'MLX-2026-08', '2027-06-15'),
    ((select id_producto from public.producto where codigo = 'MED-003'), 'ingreso', 15,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor', 'IVM-2026-08', '2027-03-01'),
    ((select id_producto from public.producto where codigo = 'MED-004'), 'ingreso', 40,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor', 'DXM-2026-08', '2027-01-20'),
    ((select id_producto from public.producto where codigo = 'MED-005'), 'ingreso', 25,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor', 'RNG-2026-08', '2028-01-01'),
    ((select id_producto from public.producto where codigo = 'INS-001'), 'ingreso', 200, now() - interval '25 days', v_admin, 'Compra inicial a proveedor', null, null),
    ((select id_producto from public.producto where codigo = 'INS-002'), 'ingreso', 300, now() - interval '25 days', v_admin, 'Compra inicial a proveedor', null, null),
    ((select id_producto from public.producto where codigo = 'INS-003'), 'ingreso', 80,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor', null, null),
    ((select id_producto from public.producto where codigo = 'INS-004'), 'ingreso', 60,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor', null, null),
    ((select id_producto from public.producto where codigo = 'VAC-001'), 'ingreso', 30,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor', 'OC-2026-11', '2027-05-01'),
    ((select id_producto from public.producto where codigo = 'VAC-002'), 'ingreso', 40,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor', 'AR-2026-07', '2027-02-01'),
    ((select id_producto from public.producto where codigo = 'VAC-003'), 'ingreso', 8,   now() - interval '25 days', v_admin, 'Compra inicial a proveedor -- lote reducido a proposito', 'TF-2026-04', current_date + interval '15 days');

  -- Ajustes (RF-022: incrementos y disminuciones para mermas/correcciones).
  insert into public.movimiento_inventario (id_producto, tipo_movimiento, cantidad, fecha_hora, id_usuario, observacion) values
    ((select id_producto from public.producto where codigo = 'INS-002'), 'ajuste', -20, now() - interval '10 days', v_admin, 'Merma: caja dañada durante traslado de bodega'),
    ((select id_producto from public.producto where codigo = 'MED-003'), 'ajuste', 5,   now() - interval '9 days',  v_admin, 'Corrección de conteo físico tras auditoría de inventario');

  -- --------------------------------------------------------------------------
  -- 4.4 Agenda (Modulo 2). Un solo veterinario en el seed: se elige una fecha
  -- distinta por cita para no tener que calcular solapamientos a mano (el
  -- EXCLUDE de la base los rechazaria igual si los hubiera).
  -- --------------------------------------------------------------------------
  insert into public.cita (id_paciente, id_veterinario, fecha_hora_inicio, duracion_minutos, motivo, estado, id_usuario_registro)
    values (v_m1, v_veterinario, '2026-08-10 09:00:00-05', 30, 'Control anual y vacunación', 'atendida', v_recepcion)
    returning id_cita into v_c1;
  insert into public.cita (id_paciente, id_veterinario, fecha_hora_inicio, duracion_minutos, motivo, estado, id_usuario_registro)
    values (v_m4, v_veterinario, '2026-08-12 10:00:00-05', 45, 'Decaimiento y falta de apetito', 'atendida', v_recepcion)
    returning id_cita into v_c2;
  insert into public.cita (id_paciente, id_veterinario, fecha_hora_inicio, duracion_minutos, motivo, estado, id_usuario_registro)
    values (v_m3, v_veterinario, '2026-08-15 11:00:00-05', 30, 'Cojera en pata trasera derecha', 'atendida', v_recepcion)
    returning id_cita into v_c3;
  insert into public.cita (id_paciente, id_veterinario, fecha_hora_inicio, duracion_minutos, motivo, estado, id_usuario_registro)
    values (v_m8, v_veterinario, '2026-08-18 15:00:00-05', 30, 'Vómitos recurrentes', 'atendida', v_recepcion)
    returning id_cita into v_c4;
  insert into public.cita (id_paciente, id_veterinario, fecha_hora_inicio, duracion_minutos, motivo, estado, id_usuario_registro)
    values (v_m7, v_veterinario, '2026-08-20 09:30:00-05', 20, 'Vacunación antirrábica anual', 'atendida', v_recepcion)
    returning id_cita into v_c5;

  -- Citas futuras, todavia programadas (sin consulta, RF-013).
  insert into public.cita (id_paciente, id_veterinario, fecha_hora_inicio, duracion_minutos, motivo, estado, id_usuario_registro) values
    (v_m9,  v_veterinario, '2026-08-27 09:00:00-05', 30, 'Consulta general', 'programada', v_recepcion),
    (v_m5,  v_veterinario, '2026-08-28 10:00:00-05', 30, 'Revisión dermatológica', 'programada', v_recepcion),
    (v_m11, v_veterinario, '2026-08-29 14:00:00-05', 20, 'Vacunación', 'programada', v_recepcion);

  -- Cita cancelada (RF-015/RN-005: libera el horario, conserva el registro).
  insert into public.cita (id_paciente, id_veterinario, fecha_hora_inicio, duracion_minutos, motivo, estado, id_usuario_registro) values
    (v_m12, v_veterinario, '2026-08-22 09:00:00-05', 30, 'Control', 'cancelada', v_recepcion);

  -- --------------------------------------------------------------------------
  -- 4.5 Historial clinico (Modulo 3). Cinco consultas vinculadas a su cita
  -- (RF-017) y dos sin cita previa, por atencion no programada.
  -- --------------------------------------------------------------------------
  -- Signos vitales (Fase 2, RF-040) solo en estas dos: opcionales, no todo el
  -- historial los trae -- demuestra tanto el caso con datos como el caso vacio.
  insert into public.consulta (id_paciente, id_veterinario, id_cita, fecha_hora, motivo, hallazgos, diagnostico, tratamiento, peso_kg, temperatura_c, frecuencia_cardiaca_lpm, frecuencia_respiratoria_rpm)
    values (v_m1, v_veterinario, v_c1, '2026-08-10 09:00:00-05', 'Control anual y vacunación',
      'Buen estado general, mucosas rosadas, buena hidratación.', 'Paciente sano, apto para vacunación anual.',
      'Se aplica vacuna óctuple de refuerzo.', 28.5, 38.4, 90, 22)
    returning id_consulta into v_q1;
  insert into public.consulta (id_paciente, id_veterinario, id_cita, fecha_hora, motivo, hallazgos, diagnostico, tratamiento, peso_kg, temperatura_c, frecuencia_cardiaca_lpm, frecuencia_respiratoria_rpm)
    values (v_m4, v_veterinario, v_c2, '2026-08-12 10:00:00-05', 'Decaimiento y falta de apetito de 3 días de evolución',
      'Deshidratación leve, temperatura 39.8°C, abdomen sensible a la palpación.', 'Gastroenteritis aguda.',
      'Fluidoterapia con Ringer Lactato y Meloxicam 0.1mg/kg SC.', 3.8, 39.8, 130, 36)
    returning id_consulta into v_q2;
  insert into public.consulta (id_paciente, id_veterinario, id_cita, fecha_hora, motivo, hallazgos, diagnostico, tratamiento, peso_kg)
    values (v_m3, v_veterinario, v_c3, '2026-08-15 11:00:00-05', 'Cojera en pata trasera derecha de 5 días',
      'Dolor a la palpación de la articulación de la rodilla, sin inflamación visible.', 'Sospecha de lesión de ligamento cruzado.',
      'Reposo relativo, Meloxicam 0.1mg/kg VO por 5 días, control en 2 semanas. Se solicita radiografía.', 32.0)
    returning id_consulta into v_q3;
  insert into public.consulta (id_paciente, id_veterinario, id_cita, fecha_hora, motivo, hallazgos, diagnostico, tratamiento, peso_kg)
    values (v_m8, v_veterinario, v_c4, '2026-08-18 15:00:00-05', 'Vómitos recurrentes en las últimas 24 horas',
      'Abdomen distendido, deshidratación moderada.', 'Gastritis aguda, no se descarta cuerpo extraño.',
      'Dexametasona 0.1mg/kg IM, dieta blanda, control en 48h si no mejora.', 4.2)
    returning id_consulta into v_q4;
  insert into public.consulta (id_paciente, id_veterinario, id_cita, fecha_hora, motivo, hallazgos, diagnostico, tratamiento, peso_kg)
    values (v_m7, v_veterinario, v_c5, '2026-08-20 09:30:00-05', 'Vacunación antirrábica anual',
      null, 'Paciente sano.', 'Se aplica vacuna antirrábica.', 26.0)
    returning id_consulta into v_q5;
  insert into public.consulta (id_paciente, id_veterinario, id_cita, fecha_hora, motivo, hallazgos, diagnostico, tratamiento, peso_kg)
    values (v_m9, v_veterinario, null, '2026-08-14 16:00:00-05', 'Herida en pata delantera por corte con vidrio',
      'Herida limpia de 2cm en el cojinete, sin signos de infección.', 'Laceración superficial.',
      'Limpieza y sutura, antibiótico profiláctico.', 6.5)
    returning id_consulta into v_q6;
  insert into public.consulta (id_paciente, id_veterinario, id_cita, fecha_hora, motivo, hallazgos, diagnostico, tratamiento, peso_kg)
    values (v_m11, v_veterinario, null, '2026-08-21 12:00:00-05', 'Consulta de rutina, dueño reporta buen estado',
      'Sin hallazgos relevantes.', 'Paciente sano.', 'Ninguno; se recomienda control en 6 meses.', 2.1)
    returning id_consulta into v_q7;

  -- Vacunaciones dentro de una consulta (RF-018 + RF-024: el trigger
  -- fn_vacunacion_descuenta_inventario descuenta la dosis automaticamente).
  insert into public.vacunacion (id_paciente, id_veterinario, id_producto, id_consulta, fecha_aplicacion, dosis, lote) values
    (v_m1, v_veterinario, (select id_producto from public.producto where codigo = 'VAC-001'), v_q1, '2026-08-10', 1, 'OC-2026-11'),
    (v_m7, v_veterinario, (select id_producto from public.producto where codigo = 'VAC-002'), v_q5, '2026-08-20', 1, 'AR-2026-07');

  -- Vacunaciones independientes, sin consulta (RF-018 lo permite explicitamente).
  -- Estas tres bajan Vacuna Triple felina de 8 a 5 dosis, por debajo de su nivel
  -- minimo (6) -- deja la alerta de RF-026 activa a proposito para poder probarla.
  insert into public.vacunacion (id_paciente, id_veterinario, id_producto, id_consulta, fecha_aplicacion, dosis, lote) values
    (v_m2, v_veterinario, (select id_producto from public.producto where codigo = 'VAC-003'), null, '2026-08-11', 1, 'TF-2026-04'),
    (v_m4, v_veterinario, (select id_producto from public.producto where codigo = 'VAC-003'), null, '2026-08-13', 1, 'TF-2026-04'),
    (v_m8, v_veterinario, (select id_producto from public.producto where codigo = 'VAC-003'), null, '2026-08-19', 1, 'TF-2026-04');

  -- Consumo manual de productos en una atencion (RF-023).
  insert into public.movimiento_inventario (id_producto, tipo_movimiento, cantidad, fecha_hora, id_usuario, id_consulta, observacion) values
    ((select id_producto from public.producto where codigo = 'MED-005'), 'consumo', -1,   '2026-08-12 10:20:00-05', v_veterinario, v_q2, 'Fluidoterapia'),
    ((select id_producto from public.producto where codigo = 'MED-002'), 'consumo', -0.2, '2026-08-12 10:20:00-05', v_veterinario, v_q2, 'Dosis SC'),
    ((select id_producto from public.producto where codigo = 'INS-001'), 'consumo', -1,   '2026-08-12 10:20:00-05', v_veterinario, v_q2, null),
    ((select id_producto from public.producto where codigo = 'MED-002'), 'consumo', -0.3, '2026-08-15 11:15:00-05', v_veterinario, v_q3, 'Dosis VO'),
    ((select id_producto from public.producto where codigo = 'MED-004'), 'consumo', -0.5, '2026-08-18 15:15:00-05', v_veterinario, v_q4, 'Aplicación IM'),
    ((select id_producto from public.producto where codigo = 'INS-002'), 'consumo', -2,   '2026-08-18 15:15:00-05', v_veterinario, v_q4, null),
    ((select id_producto from public.producto where codigo = 'MED-001'), 'consumo', -1,   '2026-08-14 16:15:00-05', v_veterinario, v_q6, 'Antibiótico profiláctico'),
    ((select id_producto from public.producto where codigo = 'INS-003'), 'consumo', -2,   '2026-08-14 16:15:00-05', v_veterinario, v_q6, 'Curación de herida'),
    ((select id_producto from public.producto where codigo = 'INS-001'), 'consumo', -1,   '2026-08-14 16:15:00-05', v_veterinario, v_q6, 'Sutura');

  -- Examenes de laboratorio (RF-019): dos completados, dos pendientes de resultado.
  insert into public.examen_laboratorio (id_paciente, id_veterinario, id_consulta, tipo_examen, fecha_solicitud, fecha_resultado, resultado, observacion) values
    (v_m4, v_veterinario, v_q2, 'Hemograma completo', '2026-08-12', '2026-08-13',
      'Leucocitosis leve; resto de parámetros dentro de rango normal.', null),
    (v_m8, v_veterinario, v_q4, 'Radiografía abdominal', '2026-08-18', '2026-08-18',
      'No se observan cuerpos extraños radiopacos. Gas intestinal aumentado.', null);
  insert into public.examen_laboratorio (id_paciente, id_veterinario, id_consulta, tipo_examen, fecha_solicitud, observacion) values
    (v_m3, v_veterinario, v_q3, 'Radiografía de rodilla derecha', '2026-08-15', 'Pendiente de toma de placas con el equipo externo de imagenología'),
    (v_m11, v_veterinario, v_q7, 'Perfil bioquímico preventivo', '2026-08-21', null);

  -- --------------------------------------------------------------------------
  -- 4.6 Facturacion (Modulo 5). Cuatro facturas a partir de una atencion
  -- (RF-028, conceptos = lo realmente consumido/vacunado en esa consulta) y una
  -- de servicios sueltos sin atencion asociada. Situaciones de cobro variadas
  -- (RF-031/RN-015): pagada, parcial y pendiente.
  -- --------------------------------------------------------------------------

  -- F1: consulta de Toby (vacuna octuple). Pagada de una vez.
  insert into public.factura (id_propietario, id_consulta, fecha_emision, id_usuario_emisor)
    values (v_p1, v_q1, '2026-08-10 09:35:00-05', v_recepcion) returning id_factura into v_f1;
  insert into public.detalle_factura (id_factura, numero_linea, id_producto, descripcion, cantidad, precio_unitario) values
    (v_f1, 1, (select id_producto from public.producto where codigo = 'VAC-001'), 'Vacuna Óctuple canina', 1, 18.00);
  update public.factura set impuesto = round(subtotal * 0.15, 2) where id_factura = v_f1;
  insert into public.pago (id_factura, fecha_pago, monto, forma_pago, id_usuario)
    values (v_f1, '2026-08-10 09:40:00-05', (select total from public.factura where id_factura = v_f1), 'efectivo', v_recepcion);

  -- F2: consulta de Luna (gastroenteritis). Pago parcial.
  insert into public.factura (id_propietario, id_consulta, fecha_emision, id_usuario_emisor)
    values (v_p3, v_q2, '2026-08-12 11:00:00-05', v_recepcion) returning id_factura into v_f2;
  insert into public.detalle_factura (id_factura, numero_linea, id_producto, descripcion, cantidad, precio_unitario) values
    (v_f2, 1, (select id_producto from public.producto where codigo = 'MED-005'), 'Suero Ringer Lactato', 1, 4.50),
    (v_f2, 2, (select id_producto from public.producto where codigo = 'MED-002'), 'Meloxicam 1.5mg/ml', 0.2, 12.00),
    (v_f2, 3, (select id_producto from public.producto where codigo = 'INS-001'), 'Jeringa 5ml', 1, 0.35);
  update public.factura set impuesto = round(subtotal * 0.15, 2) where id_factura = v_f2;
  insert into public.pago (id_factura, fecha_pago, monto, forma_pago, id_usuario)
    values (v_f2, '2026-08-12 11:05:00-05', 5.00, 'efectivo', v_recepcion);

  -- F3: consulta de Simba (gastritis). Pagada con tarjeta.
  insert into public.factura (id_propietario, id_consulta, fecha_emision, id_usuario_emisor)
    values (v_p6, v_q4, '2026-08-18 15:40:00-05', v_recepcion) returning id_factura into v_f3;
  insert into public.detalle_factura (id_factura, numero_linea, id_producto, descripcion, cantidad, precio_unitario) values
    (v_f3, 1, (select id_producto from public.producto where codigo = 'MED-004'), 'Dexametasona 4mg/ml', 0.5, 3.20),
    (v_f3, 2, (select id_producto from public.producto where codigo = 'INS-002'), 'Guantes de nitrilo', 2, 0.25);
  update public.factura set impuesto = round(subtotal * 0.15, 2) where id_factura = v_f3;
  insert into public.pago (id_factura, fecha_pago, monto, forma_pago, referencia, id_usuario)
    values (v_f3, '2026-08-18 15:45:00-05', (select total from public.factura where id_factura = v_f3), 'tarjeta', 'AUTH-773421', v_recepcion);

  -- F4: consulta de Nala (vacuna antirrábica). Sin cobrar todavia (pendiente).
  insert into public.factura (id_propietario, id_consulta, fecha_emision, id_usuario_emisor)
    values (v_p5, v_q5, '2026-08-20 09:55:00-05', v_recepcion) returning id_factura into v_f4;
  insert into public.detalle_factura (id_factura, numero_linea, id_producto, descripcion, cantidad, precio_unitario) values
    (v_f4, 1, (select id_producto from public.producto where codigo = 'VAC-002'), 'Vacuna Antirrábica', 1, 10.00);
  update public.factura set impuesto = round(subtotal * 0.15, 2) where id_factura = v_f4;

  -- F5: consulta de Bella (laceración). Pagada en dos cobros (RF-030).
  insert into public.factura (id_propietario, id_consulta, fecha_emision, id_usuario_emisor)
    values (v_p7, v_q6, '2026-08-14 16:30:00-05', v_recepcion) returning id_factura into v_f5;
  insert into public.detalle_factura (id_factura, numero_linea, id_producto, descripcion, cantidad, precio_unitario) values
    (v_f5, 1, (select id_producto from public.producto where codigo = 'MED-001'), 'Amoxicilina 500mg', 1, 8.50),
    (v_f5, 2, (select id_producto from public.producto where codigo = 'INS-003'), 'Gasa estéril', 2, 1.10),
    (v_f5, 3, (select id_producto from public.producto where codigo = 'INS-001'), 'Jeringa 5ml', 1, 0.35);
  update public.factura set impuesto = round(subtotal * 0.15, 2) where id_factura = v_f5;
  insert into public.pago (id_factura, fecha_pago, monto, forma_pago, id_usuario) values
    (v_f5, '2026-08-14 16:35:00-05', 7.00, 'efectivo', v_recepcion),
    (v_f5, '2026-08-16 09:00:00-05', (select total - 7.00 from public.factura where id_factura = v_f5), 'transferencia', v_recepcion);

  -- F6: servicio suelto sin atencion asociada (no hay catalogo de servicios en el
  -- diseno de BD aprobado -- linea de texto libre con precio, ver CLAUDE.md 9).
  insert into public.factura (id_propietario, id_consulta, fecha_emision, id_usuario_emisor)
    values (v_p8, null, '2026-08-23 10:00:00-05', v_recepcion) returning id_factura into v_f6;
  insert into public.detalle_factura (id_factura, numero_linea, id_producto, descripcion, cantidad, precio_unitario) values
    (v_f6, 1, null, 'Baño medicado y corte de uñas', 1, 12.00),
    (v_f6, 2, null, 'Desparasitación externa (aplicación tópica)', 1, 6.00);
  update public.factura set impuesto = round(subtotal * 0.15, 2) where id_factura = v_f6;
  insert into public.pago (id_factura, fecha_pago, monto, forma_pago, id_usuario)
    values (v_f6, '2026-08-23 10:05:00-05', (select total from public.factura where id_factura = v_f6), 'efectivo', v_recepcion);

  -- --------------------------------------------------------------------------
  -- 4.7 Lista de espera (Modulo 2, Fase 3, RF-034/RF-035). Tres pendientes (una
  -- con veterinario especifico, una "cualquiera") y una ya atendida, para
  -- mostrar los tres estados desde el primer arranque.
  -- --------------------------------------------------------------------------
  insert into public.lista_espera (id_paciente, id_veterinario, fecha_preferida, franja_preferida, motivo, estado, id_usuario_registro) values
    (v_m5,  v_veterinario, '2026-08-30', 'manana', 'Seguimiento de revisión dermatológica, prefiere la mañana', 'pendiente', v_recepcion),
    (v_m10, null,          null,          null,     'Dueño pide la primera cita disponible con cualquier veterinario', 'pendiente', v_recepcion),
    (v_m6,  v_veterinario, '2026-09-02', 'tarde',  'Control de peso, solo puede en la tarde', 'pendiente', v_recepcion),
    (v_m2,  v_veterinario, '2026-08-15', null,     'Ya se le asignó cupo y fue atendida', 'atendida', v_recepcion);

  -- --------------------------------------------------------------------------
  -- 4.8 Compras y Proveedores (Modulo 7, Fase 4, RF-036 a RF-039). Tres
  -- proveedores y tres ordenes en cada estado del ciclo de vida: borrador
  -- (sin emitir todavia), emitida (esperando al proveedor) y recibida (ya
  -- disparo RN-022 -- ingreso automatico de inventario via trigger).
  -- --------------------------------------------------------------------------
  insert into public.proveedor (nombre, identificacion, telefono, correo, direccion) values
    ('Distribuidora Veterinaria Andina S.A.', '1790012345001', '022456789', 'ventas@dva.com.ec', 'Av. Eloy Alfaro N45-12, Quito'),
    ('FarmaVet Ecuador Cía. Ltda.', '1791234567001', '023456780', 'pedidos@farmavet.ec', 'Parque Industrial, Bodega 14, Quito'),
    ('Insumos Médicos del Norte', '1792345678001', '0987112233', null, 'Av. Galo Plaza Lasso, Quito');

  -- OC1: borrador, todavia editable, nunca emitida.
  insert into public.orden_compra (id_proveedor, estado, observacion, id_usuario_registro)
    values ((select id_proveedor from public.proveedor where nombre = 'Insumos Médicos del Norte'), 'borrador', 'Reposición de insumos para el próximo mes', v_admin)
    returning id_orden_compra into v_oc_id; -- variable escalar, se reutiliza para las 3 ordenes de este bloque
  insert into public.detalle_orden_compra (id_orden_compra, numero_linea, id_producto, cantidad, precio_unitario) values
    (v_oc_id, 1, (select id_producto from public.producto where codigo = 'INS-002'), 200, 0.24),
    (v_oc_id, 2, (select id_producto from public.producto where codigo = 'INS-004'), 40,  1.75);

  -- OC2: emitida, esperando que el proveedor entregue.
  insert into public.orden_compra (id_proveedor, estado, observacion, id_usuario_registro)
    values ((select id_proveedor from public.proveedor where nombre = 'FarmaVet Ecuador Cía. Ltda.'), 'emitida', 'Urgente: stock de Vacuna Triple felina por debajo del mínimo', v_admin)
    returning id_orden_compra into v_oc_id;
  insert into public.detalle_orden_compra (id_orden_compra, numero_linea, id_producto, cantidad, precio_unitario) values
    (v_oc_id, 1, (select id_producto from public.producto where codigo = 'VAC-003'), 20, 16.00);

  -- OC3: recibida -- se inserta en borrador y se actualiza a 'recibida' aparte,
  -- exactamente como lo haria la app (OrdenCompraDetalleDialog.tsx), para que
  -- el trigger trg_recibir_orden_compra dispare de verdad y suba
  -- existencia_actual via fn_actualizar_existencia (RN-022 real, no simulada).
  insert into public.orden_compra (id_proveedor, estado, observacion, id_usuario_registro)
    values ((select id_proveedor from public.proveedor where nombre = 'Distribuidora Veterinaria Andina S.A.'), 'borrador', 'Reposición mensual de medicamentos de uso frecuente', v_admin)
    returning id_orden_compra into v_oc_id;
  insert into public.detalle_orden_compra (id_orden_compra, numero_linea, id_producto, cantidad, precio_unitario) values
    (v_oc_id, 1, (select id_producto from public.producto where codigo = 'MED-001'), 30, 8.20),
    (v_oc_id, 2, (select id_producto from public.producto where codigo = 'MED-003'), 10, 15.50);
  update public.orden_compra set estado = 'emitida' where id_orden_compra = v_oc_id;
  -- fn_recibir_orden_compra inserta el movimiento de ingreso sin pasar
  -- id_usuario (columna con default auth.uid(), igual que en la app real) --
  -- sin una sesion autenticada, auth.uid() daria null y violaria el NOT NULL.
  -- set_config(..., true) simula el JWT de quien recibe (Administrador), solo
  -- para esta transaccion, igual que ya hacen las pruebas pgTAP.
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  update public.orden_compra set estado = 'recibida' where id_orden_compra = v_oc_id;

  -- --------------------------------------------------------------------------
  -- 4.9 Solicitud de cita desde el Portal (Modulo 8, Fase 5, RF-043/RN-021).
  -- Sin id_veterinario ni id_usuario_registro -- asi la crea el propietario
  -- desde /portal/citas, pendiente de que Recepcion la confirme.
  -- --------------------------------------------------------------------------
  insert into public.cita (id_paciente, id_veterinario, fecha_hora_inicio, duracion_minutos, motivo, estado, id_usuario_registro)
    values (v_m2, null, '2026-08-30 10:00:00-05', 30, 'Misha no ha querido comer en dos días', 'solicitada', null);
end $$;

-- ============================================================================
-- 5. Volumen de datos demo ampliado -- pedido explicito del cliente: entre 20
-- y 40 filas por entidad (10-15 en parametro_sistema), no solo un puñado de
-- casos de borde. A esta escala ya no es practico escribir cada fila a mano
-- como en la seccion 4 (ahi cada propietario/paciente es parte de una
-- narrativa especifica -- y algunas, como Toby/Rocky/propietario 6, las
-- referencian pruebas pgTAP/Deno por su id; esta seccion nunca las toca, solo
-- agrega filas nuevas despues). Se genera con bucles sobre listas de nombres y
-- plantillas de texto realistas en vez de literales uno por uno. Los mismos
-- triggers de reglas de negocio se disparan igual que si viniera de la app
-- (fn_actualizar_existencia, fn_vacunacion_descuenta_inventario,
-- fn_calcular_fin_cita, fn_asignar_numero_factura, fn_recibir_orden_compra).
-- ============================================================================
do $$
declare
  v_recepcion   uuid := '00000000-0000-0000-0000-000000000001';
  v_veterinario uuid := '00000000-0000-0000-0000-000000000002';
  v_admin       uuid := '00000000-0000-0000-0000-000000000003';

  v_nombres   text[] := array['Mateo','Valentina','Sebastián','Camila','Emilio','Isabella','Nicolás','Sofía','Adrián','Martina','Joaquín','Renata','Emiliano','Antonella','Santiago','Doménica','Leonardo','Mía','Rafael','Julieta','Maximiliano','Ariana','Benjamín','Victoria'];
  v_apellidos text[] := array['Vásconez','Andrade','Cevallos','Moreta','Salazar','Yépez','Naranjo','Villacís','Cazorla','Guerrero','Toapanta','Freire','Zambrano','Barrionuevo','Espinosa','Montenegro','Reyes','Cárdenas','Aguilar','Bermeo','Chiluisa','Loachamín','Puma','Sarmiento'];
  v_mascotas  text[] := array['Zeus','Milo','Nina','Draco','Kira','Pipo','Maya','Boby','Canela','Duke','Lola','Jack','Bruna','Oreo','Sultán','Perla','Rocco','Chispa','Fido','Kiwi','Estrella','Bruno','Mimi','Princesa'];
  v_colores   text[] := array['Negro','Blanco','Café','Atigrado','Dorado','Gris','Manchado','Tricolor','Crema','Naranja'];
  v_dominios  text[] := array['@gmail.com','@hotmail.com','@outlook.com'];

  v_motivo      text[] := array['Vacunación de refuerzo anual','Control de rutina','Pulgas y garrapatas','Diarrea de 2 días de evolución','Cojera leve en pata delantera','Revisión dental, mal aliento','Estornudos y secreción nasal','Chequeo previo a esterilización','Picazón y enrojecimiento en la piel','Bajo apetito y decaimiento leve'];
  v_hallazgos   text[] := array['Buen estado general, sin hallazgos relevantes.','Leve enrojecimiento en el oído externo.','Mucosas rosadas, hidratación adecuada.','Abdomen ligeramente sensible a la palpación.','Dolor leve al manipular la extremidad afectada.','Sarro moderado, gingivitis leve.','Secreción nasal serosa, sin fiebre.','Sin hallazgos que contraindiquen el procedimiento.','Eritema y pequeñas costras en el dorso.','Alerta, sin signos de dolor agudo.'];
  v_diagnostico text[] := array['Paciente sano, apto para el procedimiento.','Otitis externa leve.','Gastroenteritis leve, probable indiscreción alimentaria.','Sospecha de esguince leve.','Enfermedad periodontal grado I.','Rinitis viral leve.','Dermatitis alérgica leve.','Sin alteraciones significativas.','Infestación leve de ectoparásitos.','Cuadro compatible con estrés/cambio de ambiente.'];
  v_tratamiento text[] := array['Se aplica vacuna correspondiente, control en un año.','Limpieza ótica y gotas por 7 días.','Dieta blanda por 48 horas, control si no mejora.','Reposo relativo, antiinflamatorio por 5 días.','Limpieza dental programada, cepillado en casa.','Se indica descongestionante y control en una semana.','Antihistamínico y champú medicado.','Ninguno, control en 6 meses.','Aplicación de antiparasitario tópico.','Observación en casa, dieta habitual.'];
  v_examenes    text[] := array['Hemograma completo','Perfil bioquímico','Radiografía de tórax','Ecografía abdominal','Urianálisis','Coprológico','Citología ótica','Raspado de piel'];
  v_espera_motivo text[] := array['Pide la primera cita disponible','Seguimiento de tratamiento en curso','No pudo agendar en la fecha original','Solicitud de control post-quirúrgico','Consulta por segunda opinión'];

  v_prop_ids     bigint[] := array[]::bigint[];
  v_pac_ids      bigint[] := array[]::bigint[];
  v_consulta_ids bigint[] := array[]::bigint[];
  v_prov_ids     bigint[];

  v_id_canino  smallint := (select id_especie from public.especie where nombre = 'Canino');
  v_id_felino  smallint := (select id_especie from public.especie where nombre = 'Felino');
  v_id_ave     smallint := (select id_especie from public.especie where nombre = 'Ave');
  v_id_conejo  smallint := (select id_especie from public.especie where nombre = 'Conejo');

  i int;
  v_id bigint;
  v_cita_id bigint;
  v_consulta_id bigint;
  v_especie smallint;
  v_raza integer;
  v_fecha_cita timestamptz;
  v_idx int;
  v_estado_final varchar(10);
  v_oc_id bigint;
begin
  -- --------------------------------------------------------------------------
  -- 5.1 Propietarios adicionales (22, total 30 con los de la seccion 4).
  -- --------------------------------------------------------------------------
  for i in 1..22 loop
    insert into public.propietario (identificacion, nombres, apellidos, telefono, correo, direccion)
    values (
      '19' || lpad(i::text, 8, '0'),
      v_nombres[1 + (i % array_length(v_nombres, 1))],
      v_apellidos[1 + ((i * 7) % array_length(v_apellidos, 1))],
      '099' || lpad((1000000 + i)::text, 7, '0'),
      'propietario' || i || v_dominios[1 + (i % array_length(v_dominios, 1))],
      'Sector ' || v_apellidos[1 + ((i * 3) % array_length(v_apellidos, 1))] || ', Quito'
    )
    returning id_propietario into v_id;
    v_prop_ids := array_append(v_prop_ids, v_id);
  end loop;

  -- --------------------------------------------------------------------------
  -- 5.2 Pacientes adicionales (23, total 35). Repartidos entre los nuevos
  -- propietarios; fecha_nacimiento nula cada 9no (edad desconocida, RF-010).
  -- --------------------------------------------------------------------------
  for i in 1..23 loop
    v_especie := (array[v_id_canino, v_id_felino, v_id_canino, v_id_felino, v_id_ave, v_id_conejo])[1 + (i % 6)];
    select id_raza into v_raza from public.raza where id_especie = v_especie order by random() limit 1;
    insert into public.paciente (id_propietario, id_especie, id_raza, nombre, sexo, fecha_nacimiento, color)
    values (
      v_prop_ids[1 + (i % array_length(v_prop_ids, 1))],
      v_especie,
      v_raza,
      v_mascotas[1 + ((i * 5) % array_length(v_mascotas, 1))],
      case when i % 2 = 0 then 'M' else 'H' end,
      case when i % 9 = 0 then null else (current_date - ((5 + i * 37) || ' days')::interval)::date end,
      v_colores[1 + ((i * 2) % array_length(v_colores, 1))]
    )
    returning id_paciente into v_id;
    v_pac_ids := array_append(v_pac_ids, v_id);
  end loop;

  -- --------------------------------------------------------------------------
  -- 5.3 Catalogo de productos ampliado (13 mas, total 25) + su ingreso inicial.
  -- --------------------------------------------------------------------------
  insert into public.producto (codigo, nombre, tipo, presentacion, unidad_medida, nivel_minimo, precio_unitario, intervalo_dias) values
    ('MED-006', 'Cefalexina 500mg', 'medicamento', 'Caja x20 tabletas', 'caja', 8, 9.20, null),
    ('MED-007', 'Prednisolona 5mg', 'medicamento', 'Frasco x30 tabletas', 'frasco', 6, 7.50, null),
    ('MED-008', 'Omeprazol 20mg', 'medicamento', 'Caja x14 cápsulas', 'caja', 5, 6.80, null),
    ('MED-009', 'Furosemida 40mg', 'medicamento', 'Caja x20 tabletas', 'caja', 5, 5.40, null),
    ('MED-010', 'Tramadol 50mg', 'medicamento', 'Ampolla 2ml', 'ampolla', 10, 2.60, null),
    ('MED-011', 'Multivitamínico', 'medicamento', 'Frasco 100ml', 'frasco', 8, 8.00, null),
    ('INS-005', 'Vendaje elástico', 'insumo', 'Rollo 5cm', 'unidad', 20, 1.30, null),
    ('INS-006', 'Alcohol antiséptico', 'insumo', 'Frasco 250ml', 'frasco', 15, 2.10, null),
    ('INS-007', 'Termómetro digital', 'insumo', null, 'unidad', 5, 6.00, null),
    ('INS-008', 'Sonda urinaria', 'insumo', null, 'unidad', 10, 3.50, null),
    ('VAC-004', 'Vacuna Leucemia felina', 'vacuna', null, 'dosis', 6, 19.50, 365),
    ('VAC-005', 'Vacuna Tos de las perreras', 'vacuna', null, 'dosis', 8, 14.00, 180),
    ('VAC-006', 'Vacuna Parvovirus', 'vacuna', null, 'dosis', 6, 17.00, 365);

  insert into public.movimiento_inventario (id_producto, tipo_movimiento, cantidad, fecha_hora, id_usuario, observacion, lote_codigo, fecha_vencimiento)
  select id_producto, 'ingreso', (10 + (id_producto * 3) % 40), now() - interval '20 days', v_admin,
         'Compra inicial a proveedor', 'LT-' || id_producto, current_date + interval '400 days'
  from public.producto
  where codigo in ('MED-006','MED-007','MED-008','MED-009','MED-010','MED-011','INS-005','INS-006','INS-007','INS-008','VAC-004','VAC-005','VAC-006');

  -- --------------------------------------------------------------------------
  -- 5.4 Proveedores adicionales (17 mas, total 20).
  -- --------------------------------------------------------------------------
  insert into public.proveedor (nombre, identificacion, telefono, correo, direccion) values
    ('Veterinaria Insumos del Pacífico', '1793456780001', '042345678', 'contacto@vip.com.ec', 'Vía a la Costa, Guayaquil'),
    ('BioFarma Andina', '1794567891001', '032345678', 'ventas@biofarma.ec', 'Av. Universitaria, Ambato'),
    ('MedVet Suministros', '1795678902001', '072345678', null, 'Calle Larga, Cuenca'),
    ('Agropecuaria El Establo', '1796789013001', '062345678', 'info@elestablo.ec', 'Panamericana Norte km 5, Ibarra'),
    ('Distribuidora Salud Animal', '1797890124001', '022998877', 'pedidos@saludanimal.ec', 'Av. 10 de Agosto, Quito'),
    ('VetSupply Ecuador', '1798901235001', '023998877', 'ventas@vetsupply.ec', 'Sector Carcelén, Quito'),
    ('Laboratorios ProVet', '1799012346001', '042998877', 'contacto@provet.ec', 'Km 8.5 vía Daule, Guayaquil'),
    ('Importadora Veterinaria del Sur', '1780123457001', '072998877', null, 'Av. Solano, Cuenca'),
    ('NutriVet Alimentos y Suministros', '1781234568001', '023112233', 'contacto@nutrivet.ec', 'Av. Maldonado, Quito'),
    ('Corporación Farmavet Internacional', '1782345679001', '042112233', 'importaciones@farmavet-intl.com', 'Zona Franca, Guayaquil'),
    ('Grupo Insumos Médicos GIM', '1783456780001', '023223344', null, 'Av. 6 de Diciembre, Quito'),
    ('Vetpharma Cía. Ltda.', '1784567891001', '032223344', 'ventas@vetpharma.ec', 'Av. Cevallos, Ambato'),
    ('Distribuidora Central de Fármacos', '1785678902001', '022334455', 'pedidos@dcf.ec', 'Centro Histórico, Quito'),
    ('Salud Animal del Norte', '1786789013001', '062334455', null, 'Av. Teodoro Gómez, Ibarra'),
    ('Comercial Veterinaria Austro', '1787890124001', '072334455', 'ventas@austrovet.ec', 'Av. Remigio Crespo, Cuenca'),
    ('Importadora BioSalud', '1788901235001', '023445566', 'contacto@biosalud.ec', 'Av. Amazonas, Quito'),
    ('Suministros Clínicos Veterinarios SCV', '1789012346001', '023556677', null, 'Av. Naciones Unidas, Quito');

  select array_agg(id_proveedor) into v_prov_ids from public.proveedor;

  -- --------------------------------------------------------------------------
  -- 5.5 Citas atendidas adicionales (12, en julio 2026 para no chocar con las
  -- fechas de agosto de la seccion 4) + su consulta correspondiente, y cada
  -- 3ra con una vacunacion, cada 4ta con un examen, cada 2da con un consumo
  -- manual de producto (RF-023) -- para no repetir siempre el mismo patron.
  -- --------------------------------------------------------------------------
  for i in 1..12 loop
    -- timestamp + time no es un operador valido en Postgres -- se arma como
    -- texto 'YYYY-MM-DD HH:MI:00-05' y se castea a timestamptz, mismo patron
    -- que los literales de la seccion 4.
    v_fecha_cita := (to_char(date '2026-07-01' + (i * 2), 'YYYY-MM-DD') || ' ' ||
      (array['08:30','09:00','10:00','11:00','14:00','15:00','16:00'])[1 + (i % 7)] || ':00-05')::timestamptz;

    insert into public.cita (id_paciente, id_veterinario, fecha_hora_inicio, duracion_minutos, motivo, estado, id_usuario_registro)
    values (
      v_pac_ids[1 + (i % array_length(v_pac_ids, 1))],
      v_veterinario,
      v_fecha_cita,
      (array[20, 30, 30, 45])[1 + (i % 4)],
      v_motivo[1 + (i % array_length(v_motivo, 1))],
      'atendida',
      v_recepcion
    )
    returning id_cita into v_cita_id;

    v_idx := 1 + (i % array_length(v_motivo, 1));
    insert into public.consulta (id_paciente, id_veterinario, id_cita, fecha_hora, motivo, hallazgos, diagnostico, tratamiento, peso_kg)
    values (
      v_pac_ids[1 + (i % array_length(v_pac_ids, 1))],
      v_veterinario,
      v_cita_id,
      v_fecha_cita,
      v_motivo[v_idx],
      v_hallazgos[v_idx],
      v_diagnostico[v_idx],
      v_tratamiento[v_idx],
      round((2 + (i * 3.7))::numeric, 1)
    )
    returning id_consulta into v_consulta_id;
    v_consulta_ids := array_append(v_consulta_ids, v_consulta_id);

    if i % 3 = 0 then
      insert into public.vacunacion (id_paciente, id_veterinario, id_producto, id_consulta, fecha_aplicacion, dosis, lote)
      values (
        v_pac_ids[1 + (i % array_length(v_pac_ids, 1))],
        v_veterinario,
        (select id_producto from public.producto where codigo = (array['VAC-001','VAC-002','VAC-004','VAC-005','VAC-006'])[1 + (i % 5)]),
        v_consulta_id,
        v_fecha_cita::date,
        1,
        'LT-' || i
      );
    end if;

    if i % 4 = 0 then
      insert into public.examen_laboratorio (id_paciente, id_veterinario, id_consulta, tipo_examen, fecha_solicitud, fecha_resultado, resultado, observacion)
      values (
        v_pac_ids[1 + (i % array_length(v_pac_ids, 1))],
        v_veterinario,
        v_consulta_id,
        v_examenes[1 + (i % array_length(v_examenes, 1))],
        v_fecha_cita::date,
        v_fecha_cita::date + 1,
        'Resultado dentro de parámetros normales.',
        null
      );
    else
      insert into public.examen_laboratorio (id_paciente, id_veterinario, id_consulta, tipo_examen, fecha_solicitud, observacion)
      values (
        v_pac_ids[1 + (i % array_length(v_pac_ids, 1))],
        v_veterinario,
        v_consulta_id,
        v_examenes[1 + ((i + 2) % array_length(v_examenes, 1))],
        v_fecha_cita::date,
        'Pendiente de resultado'
      );
    end if;

    if i % 2 = 0 then
      insert into public.movimiento_inventario (id_producto, tipo_movimiento, cantidad, fecha_hora, id_usuario, id_consulta, observacion)
      values (
        (select id_producto from public.producto where codigo = (array['MED-001','MED-002','MED-006','MED-007','INS-001'])[1 + (i % 5)]),
        'consumo', -1, v_fecha_cita + interval '15 minutes', v_veterinario, v_consulta_id, 'Consumo durante la atención'
      );
    end if;
  end loop;

  -- --------------------------------------------------------------------------
  -- 5.6 Consultas adicionales sin cita previa (6, total 25 con la seccion 4 y
  -- la 5.5), atencion no programada -- mismo patron que v_q6/v_q7.
  -- --------------------------------------------------------------------------
  for i in 1..6 loop
    v_idx := 1 + ((i + 5) % array_length(v_motivo, 1));
    v_fecha_cita := (to_char(date '2026-07-05' + (i * 3), 'YYYY-MM-DD') || ' 17:00:00-05')::timestamptz;
    insert into public.consulta (id_paciente, id_veterinario, id_cita, fecha_hora, motivo, hallazgos, diagnostico, tratamiento, peso_kg)
    values (
      v_pac_ids[1 + ((i + 10) % array_length(v_pac_ids, 1))],
      v_veterinario,
      null,
      v_fecha_cita,
      v_motivo[v_idx],
      v_hallazgos[v_idx],
      v_diagnostico[v_idx],
      v_tratamiento[v_idx],
      round((3 + (i * 2.3))::numeric, 1)
    )
    returning id_consulta into v_consulta_id;
    v_consulta_ids := array_append(v_consulta_ids, v_consulta_id);
  end loop;

  -- --------------------------------------------------------------------------
  -- 5.7 Vacunaciones independientes adicionales (11 mas, total 20 con las de
  -- la seccion 4 y las de 5.5). Se excluye VAC-003 (Vacuna Triple felina) a
  -- proposito -- esta por debajo de su minimo desde la seccion 4 y es la
  -- alerta de RF-026 que el seed deja activa; vacunar mas la ocultaria.
  -- --------------------------------------------------------------------------
  for i in 1..11 loop
    insert into public.vacunacion (id_paciente, id_veterinario, id_producto, id_consulta, fecha_aplicacion, dosis, lote)
    values (
      v_pac_ids[1 + ((i * 3) % array_length(v_pac_ids, 1))],
      v_veterinario,
      (select id_producto from public.producto where codigo = (array['VAC-001','VAC-002','VAC-004','VAC-005','VAC-006'])[1 + (i % 5)]),
      null,
      (current_date - ((i * 11) || ' days')::interval)::date,
      1,
      'LT-IND-' || i
    );
  end loop;

  -- --------------------------------------------------------------------------
  -- 5.8 Examenes de laboratorio independientes adicionales (12 mas, total ~20
  -- con los de la seccion 4 y los de 5.5), sin consulta asociada.
  -- --------------------------------------------------------------------------
  for i in 1..12 loop
    if i % 3 = 0 then
      insert into public.examen_laboratorio (id_paciente, id_veterinario, id_consulta, tipo_examen, fecha_solicitud, fecha_resultado, resultado, observacion)
      values (
        v_pac_ids[1 + ((i + 4) % array_length(v_pac_ids, 1))],
        v_veterinario, null,
        v_examenes[1 + (i % array_length(v_examenes, 1))],
        (current_date - ((i * 6) || ' days')::interval)::date,
        (current_date - ((i * 6 - 1) || ' days')::interval)::date,
        'Sin hallazgos patológicos relevantes.',
        null
      );
    else
      insert into public.examen_laboratorio (id_paciente, id_veterinario, id_consulta, tipo_examen, fecha_solicitud, observacion)
      values (
        v_pac_ids[1 + ((i + 4) % array_length(v_pac_ids, 1))],
        v_veterinario, null,
        v_examenes[1 + ((i + 3) % array_length(v_examenes, 1))],
        (current_date - ((i * 6) || ' days')::interval)::date,
        'Pendiente de resultado'
      );
    end if;
  end loop;

  -- --------------------------------------------------------------------------
  -- 5.9 Facturas adicionales (19 mas, total 25): 15 sobre las consultas
  -- nuevas de 5.5/5.6, 1 sobre v_q7 (unica consulta de la seccion 4 que
  -- seguia sin facturar) y 3 de servicio suelto sin atencion asociada.
  -- Situaciones de cobro variadas, igual criterio que la seccion 4.
  -- --------------------------------------------------------------------------
  for i in 1..15 loop
    insert into public.factura (id_propietario, id_consulta, fecha_emision, id_usuario_emisor)
    values (
      (select p.id_propietario from public.consulta c join public.paciente p on p.id_paciente = c.id_paciente where c.id_consulta = v_consulta_ids[i]),
      v_consulta_ids[i],
      (select fecha_hora from public.consulta where id_consulta = v_consulta_ids[i]) + interval '20 minutes',
      v_recepcion
    )
    returning id_factura into v_id;
    insert into public.detalle_factura (id_factura, numero_linea, id_producto, descripcion, cantidad, precio_unitario)
    select v_id, 1, p.id_producto, p.nombre, 1, p.precio_unitario
    from public.producto p where p.codigo = (array['MED-001','MED-002','MED-003','INS-001','INS-002','VAC-001'])[1 + (i % 6)];
    update public.factura set impuesto = round(subtotal * 0.15, 2) where id_factura = v_id;

    if i % 5 = 0 then
      null; -- cada 5ta queda pendiente, sin pago -- variedad de estado_cobro
    elsif i % 5 = 1 then
      insert into public.pago (id_factura, fecha_pago, monto, forma_pago, id_usuario)
      values (v_id, (select fecha_emision from public.factura where id_factura = v_id) + interval '10 minutes',
        round((select total from public.factura where id_factura = v_id) * 0.5, 2), 'efectivo', v_recepcion); -- pago parcial
    else
      insert into public.pago (id_factura, fecha_pago, monto, forma_pago, id_usuario)
      values (v_id, (select fecha_emision from public.factura where id_factura = v_id) + interval '10 minutes',
        (select total from public.factura where id_factura = v_id),
        (array['efectivo','tarjeta','transferencia'])[1 + (i % 3)], v_recepcion);
    end if;
  end loop;

  -- Factura sobre v_q7 (Kiara, seccion 4 -- la unica consulta que quedo sin
  -- facturar ahi). Se recupera por fecha/motivo, no por variable: v_q7 no es
  -- visible en este bloque nuevo, es local al bloque DO de la seccion 4.
  insert into public.factura (id_propietario, id_consulta, fecha_emision, id_usuario_emisor)
  select p.id_propietario, c.id_consulta, c.fecha_hora + interval '20 minutes', v_recepcion
  from public.consulta c join public.paciente p on p.id_paciente = c.id_paciente
  where c.motivo = 'Consulta de rutina, dueño reporta buen estado'
    and not exists (select 1 from public.factura f where f.id_consulta = c.id_consulta)
  returning id_factura into v_id;
  insert into public.detalle_factura (id_factura, numero_linea, descripcion, cantidad, precio_unitario)
  values (v_id, 1, 'Consulta general', 1, 15.00);
  update public.factura set impuesto = round(subtotal * 0.15, 2) where id_factura = v_id;
  insert into public.pago (id_factura, fecha_pago, monto, forma_pago, id_usuario)
  values (v_id, (select fecha_emision from public.factura where id_factura = v_id) + interval '5 minutes',
    (select total from public.factura where id_factura = v_id), 'efectivo', v_recepcion);

  -- Tres facturas de servicio suelto, sin atencion asociada (mismo caso que
  -- F6 de la seccion 4 -- no hay catalogo de servicios, ver CLAUDE.md sec. 9).
  for i in 1..3 loop
    insert into public.factura (id_propietario, id_consulta, fecha_emision, id_usuario_emisor)
    values (v_prop_ids[1 + (i * 4) % array_length(v_prop_ids, 1)], null, now() - ((i * 2) || ' days')::interval, v_recepcion)
    returning id_factura into v_id;
    insert into public.detalle_factura (id_factura, numero_linea, descripcion, cantidad, precio_unitario) values
      (v_id, 1, (array['Baño y peluquería', 'Corte de uñas', 'Desparasitación externa'])[1 + (i % 3)], 1, (array[15.00, 5.00, 6.00])[1 + (i % 3)]);
    update public.factura set impuesto = round(subtotal * 0.15, 2) where id_factura = v_id;
    insert into public.pago (id_factura, fecha_pago, monto, forma_pago, id_usuario)
    values (v_id, now() - ((i * 2) || ' days')::interval + interval '5 minutes', (select total from public.factura where id_factura = v_id), 'efectivo', v_recepcion);
  end loop;

  -- --------------------------------------------------------------------------
  -- 5.10 Lista de espera adicional (18 mas, total 22).
  -- --------------------------------------------------------------------------
  for i in 1..18 loop
    insert into public.lista_espera (id_paciente, id_veterinario, fecha_preferida, franja_preferida, motivo, estado, id_usuario_registro)
    values (
      v_pac_ids[1 + ((i + 7) % array_length(v_pac_ids, 1))],
      case when i % 3 = 0 then null else v_veterinario end,
      case when i % 4 = 0 then null else (current_date + ((3 + i) || ' days')::interval)::date end,
      case when i % 4 = 0 then null else (array['manana', 'tarde'])[1 + (i % 2)] end,
      v_espera_motivo[1 + (i % array_length(v_espera_motivo, 1))],
      case when i % 6 = 0 then 'atendida' when i % 7 = 0 then 'cancelada' else 'pendiente' end,
      v_recepcion
    );
  end loop;

  -- --------------------------------------------------------------------------
  -- 5.11 Ordenes de compra adicionales (22 mas, total 25), en las 4 fases del
  -- ciclo de vida. Las que terminan 'recibida' se insertan en 'borrador' y se
  -- actualizan aparte, igual que la orden 3 de la seccion 4 -- mismo motivo
  -- exacto (fn_recibir_orden_compra depende de auth.uid() para id_usuario).
  -- --------------------------------------------------------------------------
  perform set_config('request.jwt.claim.sub', v_admin::text, true);
  for i in 1..22 loop
    v_estado_final := (array['borrador', 'emitida', 'recibida', 'cancelada'])[1 + (i % 4)];
    insert into public.orden_compra (id_proveedor, estado, observacion, id_usuario_registro)
    values (
      v_prov_ids[1 + (i % array_length(v_prov_ids, 1))],
      case when v_estado_final = 'recibida' then 'borrador' else v_estado_final end,
      'Orden de compra generada para datos de demostración #' || i,
      v_admin
    )
    returning id_orden_compra into v_oc_id;

    insert into public.detalle_orden_compra (id_orden_compra, numero_linea, id_producto, cantidad, precio_unitario)
    select v_oc_id, 1, id_producto, (5 + (i * 3) % 30), precio_unitario
    from public.producto where codigo = (array['MED-001','MED-003','MED-006','INS-002','INS-005','VAC-001','VAC-004'])[1 + (i % 7)];

    if v_estado_final = 'recibida' then
      update public.orden_compra set estado = 'recibida' where id_orden_compra = v_oc_id;
    end if;
  end loop;
  perform set_config('request.jwt.claim.sub', '', true);

  -- --------------------------------------------------------------------------
  -- 5.12 Parametros de negocio adicionales (9 mas, total 12 -- el pedido fue
  -- 10-15). Los tres originales (impuesto_defecto_pct, horario_atencion_*)
  -- son los unicos que la app lee hoy (Administracion > Parametros,
  -- NuevaFacturaDialog); estos nueve quedan como configuracion de referencia,
  -- no conectados todavia a ninguna pantalla -- mismo criterio que RNF-024,
  -- ampliar un catalogo no exige tocar la estructura ni el resto de la app.
  -- --------------------------------------------------------------------------
  insert into public.parametro_sistema (clave, valor, descripcion) values
    ('nombre_clinica', 'VetCare', 'Nombre comercial de la clínica, para comprobantes y correos.'),
    ('telefono_clinica', '022345678', 'Teléfono principal de contacto de la clínica.'),
    ('direccion_clinica', 'Av. Amazonas N34-56, Quito', 'Dirección física de la clínica.'),
    ('moneda', 'USD', 'Moneda en la que se registran precios y facturas.'),
    ('duracion_cita_default_min', '30', 'Duración sugerida, en minutos, al crear una cita sin especificarla.'),
    ('dias_atencion', 'Lunes a Sábado', 'Días de la semana en que la clínica atiende.'),
    ('limite_stock_critico_pct', '20', 'Porcentaje sobre el nivel mínimo a partir del cual una alerta de stock se considera crítica.'),
    ('politica_cancelacion_horas', '24', 'Horas de anticipación sugeridas para cancelar una cita sin penalización.'),
    ('correo_notificaciones', 'notificaciones@vetcare.local', 'Correo remitente sugerido para notificaciones internas.');
end $$;
