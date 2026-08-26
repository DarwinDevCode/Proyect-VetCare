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
  insert into public.producto (codigo, nombre, tipo, presentacion, unidad_medida, nivel_minimo, precio_unitario) values
    ('MED-001', 'Amoxicilina 500mg', 'medicamento', 'Caja x20 tabletas', 'caja', 10, 8.50),
    ('MED-002', 'Meloxicam 1.5mg/ml', 'medicamento', 'Frasco 100ml', 'frasco', 5, 12.00),
    ('MED-003', 'Ivermectina 1%', 'medicamento', 'Frasco 50ml', 'frasco', 5, 15.75),
    ('MED-004', 'Dexametasona 4mg/ml', 'medicamento', 'Ampolla 1ml', 'ampolla', 15, 3.20),
    ('MED-005', 'Suero Ringer Lactato', 'medicamento', 'Bolsa 500ml', 'bolsa', 10, 4.50),
    ('INS-001', 'Jeringa 5ml', 'insumo', null, 'unidad', 50, 0.35),
    ('INS-002', 'Guantes de nitrilo', 'insumo', 'Caja x100', 'par', 100, 0.25),
    ('INS-003', 'Gasa estéril', 'insumo', 'Paquete x10', 'paquete', 20, 1.10),
    ('INS-004', 'Catéter IV 22G', 'insumo', null, 'unidad', 15, 1.80),
    ('VAC-001', 'Vacuna Óctuple canina', 'vacuna', null, 'dosis', 8, 18.00),
    ('VAC-002', 'Vacuna Antirrábica', 'vacuna', null, 'dosis', 10, 10.00),
    ('VAC-003', 'Vacuna Triple felina', 'vacuna', null, 'dosis', 6, 16.50);

  -- Existencia inicial: movimientos de ingreso (RF-022), 25 dias antes de hoy.
  insert into public.movimiento_inventario (id_producto, tipo_movimiento, cantidad, fecha_hora, id_usuario, observacion) values
    ((select id_producto from public.producto where codigo = 'MED-001'), 'ingreso', 50,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor'),
    ((select id_producto from public.producto where codigo = 'MED-002'), 'ingreso', 20,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor'),
    ((select id_producto from public.producto where codigo = 'MED-003'), 'ingreso', 15,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor'),
    ((select id_producto from public.producto where codigo = 'MED-004'), 'ingreso', 40,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor'),
    ((select id_producto from public.producto where codigo = 'MED-005'), 'ingreso', 25,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor'),
    ((select id_producto from public.producto where codigo = 'INS-001'), 'ingreso', 200, now() - interval '25 days', v_admin, 'Compra inicial a proveedor'),
    ((select id_producto from public.producto where codigo = 'INS-002'), 'ingreso', 300, now() - interval '25 days', v_admin, 'Compra inicial a proveedor'),
    ((select id_producto from public.producto where codigo = 'INS-003'), 'ingreso', 80,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor'),
    ((select id_producto from public.producto where codigo = 'INS-004'), 'ingreso', 60,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor'),
    ((select id_producto from public.producto where codigo = 'VAC-001'), 'ingreso', 30,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor'),
    ((select id_producto from public.producto where codigo = 'VAC-002'), 'ingreso', 40,  now() - interval '25 days', v_admin, 'Compra inicial a proveedor'),
    ((select id_producto from public.producto where codigo = 'VAC-003'), 'ingreso', 8,   now() - interval '25 days', v_admin, 'Compra inicial a proveedor -- lote reducido a proposito');

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
  insert into public.consulta (id_paciente, id_veterinario, id_cita, fecha_hora, motivo, hallazgos, diagnostico, tratamiento, peso_kg)
    values (v_m1, v_veterinario, v_c1, '2026-08-10 09:00:00-05', 'Control anual y vacunación',
      'Buen estado general, mucosas rosadas, buena hidratación.', 'Paciente sano, apto para vacunación anual.',
      'Se aplica vacuna óctuple de refuerzo.', 28.5)
    returning id_consulta into v_q1;
  insert into public.consulta (id_paciente, id_veterinario, id_cita, fecha_hora, motivo, hallazgos, diagnostico, tratamiento, peso_kg)
    values (v_m4, v_veterinario, v_c2, '2026-08-12 10:00:00-05', 'Decaimiento y falta de apetito de 3 días de evolución',
      'Deshidratación leve, temperatura 39.8°C, abdomen sensible a la palpación.', 'Gastroenteritis aguda.',
      'Fluidoterapia con Ringer Lactato y Meloxicam 0.1mg/kg SC.', 3.8)
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
end $$;
