-- Regresion del bug real documentado en CLAUDE.md (seccion 9, "Problemas
-- conocidos"): fn_auditar_cambio esta pegado como trigger a cinco tablas con
-- columnas distintas (usuario/rol/especie/raza/parametro_sistema) y resolvia
-- el id de la fila auditada con un CASE que accedia a new.<campo> por campo
-- directo -- Postgres revienta ese acceso contra el tipo real de la fila
-- ANTES de elegir la rama del CASE, asi que sembrar parametro_sistema fallaba
-- con "record new has no field id_usuario" pese a que esa rama nunca debia
-- ejecutarse para esa tabla. Corregido resolviendo por to_jsonb(new) ->>
-- 'campo' en vez de new.campo (ver 20260825163425_administracion.sql).
-- Corre con: npx supabase test db --local (desde supabase/)
begin;
select plan(4);

-- parametro_sistema es la tabla que realmente rompio el bug -- no tiene
-- id_usuario/id_rol/id_especie/id_raza, solo `clave`.
select lives_ok(
  $$insert into public.parametro_sistema (clave, valor) values ('test_regresion_auditoria', '1')$$,
  'insertar en parametro_sistema no revienta el trigger compartido (bug real ya corregido)'
);

select is(
  (select id_registro from public.bitacora_auditoria
   where tabla = 'parametro_sistema' and accion = 'insert'
   order by id_bitacora desc limit 1),
  'test_regresion_auditoria',
  'la bitacora registra la CLAVE como id_registro para parametro_sistema, no un campo de otra tabla'
);

-- especie es una tabla distinta del CASE (usa id_especie) -- confirma que la
-- correccion no rompio la resolucion de id para las demas tablas.
select lives_ok(
  $$insert into public.especie (nombre) values ('TestRegresionAuditoria')$$,
  'insertar en especie tampoco revienta el trigger compartido'
);

select is(
  (select id_registro::text from public.bitacora_auditoria
   where tabla = 'especie' and accion = 'insert'
   order by id_bitacora desc limit 1),
  (select id_especie::text from public.especie where nombre = 'TestRegresionAuditoria'),
  'la bitacora registra el ID_ESPECIE como id_registro para especie'
);

select * from finish();
rollback;
