-- VetCare - Modulo 5: Facturacion. Reglas que no podian resolverse con las tablas
-- y triggers de las migraciones anteriores.
--
-- Las tres piezas de aqui existen porque PostgREST no ofrece transacciones que
-- abarquen varias peticiones: emitir una factura son N inserciones (cabecera +
-- lineas) que RES-07/RNF-005 exigen que se completen todas o ninguna. Hacerlo
-- desde la SPA dejaria facturas sin lineas ante cualquier fallo de red a mitad
-- de camino. Por eso se emite con una sola llamada RPC.

-- ----------------------------------------------------------------------------
-- RF-029 / RN-016: numero de factura unico y NO reutilizable.
--
-- Se usa una secuencia y no un "max(numero) + 1": nextval no se revierte cuando
-- la transaccion falla, que es justamente lo que pide "no reutilizable" -- un
-- max+1 devolveria el mismo numero tras un fallo y, ademas, admite condiciones
-- de carrera entre dos recepcionistas facturando a la vez.
-- ----------------------------------------------------------------------------
create sequence public.seq_factura_numero as bigint start with 1;

create function public.fn_asignar_numero_factura()
returns trigger
language plpgsql
as $$
begin
  -- Se sobrescribe siempre cualquier valor recibido: el numero no es un dato que
  -- el cliente pueda elegir (mismo criterio que cita.fecha_hora_fin).
  new.numero := 'F-' || lpad(nextval('public.seq_factura_numero')::text, 8, '0');
  return new;
end;
$$;

create trigger trg_numero_factura
  before insert on public.factura
  for each row
  execute function public.fn_asignar_numero_factura();

-- ----------------------------------------------------------------------------
-- RF-028: "cuando la factura corresponda a una atencion registrada, el sistema
-- debe recuperar de ella los conceptos a facturar".
--
-- Quien factura es el Recepcionista (matriz 3.8), pero RN-006 le niega toda
-- lectura sobre consulta, vacunacion y movimiento_inventario: sin esta funcion
-- el rol que emite la factura literalmente no puede ver que se consumio en la
-- atencion que va a cobrar. SECURITY DEFINER cruza ese limite de forma acotada
-- y auditable: devuelve unicamente producto, cantidad y precio -- nunca motivo,
-- diagnostico, hallazgos ni tratamiento. La informacion clinica sigue siendo
-- invisible para Recepcion; solo se expone lo que de todas formas va impreso en
-- el comprobante que recibe el propietario.
-- ----------------------------------------------------------------------------
create function public.fn_conceptos_facturables(p_id_consulta bigint)
returns table (
  id_producto     bigint,
  descripcion     varchar(120),
  cantidad        numeric(10, 2),
  precio_unitario numeric(10, 2)
)
language sql
stable
security definer set search_path = public
as $$
  select
    pr.id_producto,
    pr.nombre::varchar(120) as descripcion,
    -- Los consumos se guardan en negativo (chk_movimiento_signo); se factura la
    -- cantidad en positivo.
    sum(-m.cantidad)::numeric(10, 2) as cantidad,
    pr.precio_unitario
  from public.movimiento_inventario m
  join public.producto pr on pr.id_producto = m.id_producto
  left join public.vacunacion v on v.id_vacunacion = m.id_vacunacion
  where m.tipo_movimiento = 'consumo'
    -- Un consumo cuelga de la consulta directamente (RF-023) o a traves de la
    -- vacunacion que lo genero (RF-024): ambos se cobran en la misma factura.
    and coalesce(m.id_consulta, v.id_consulta) = p_id_consulta
    and public.fn_rol_actual() in ('recepcionista', 'administrador')
  group by pr.id_producto, pr.nombre, pr.precio_unitario
  order by pr.nombre;
$$;

-- ----------------------------------------------------------------------------
-- RF-028 / RF-029 / RN-012 / RN-013 / RN-014, en una sola transaccion.
--
-- p_lineas es un arreglo JSON de objetos:
--   {"id_producto": <bigint|null>, "descripcion": <texto>, "cantidad": <numero>,
--    "precio_unitario": <numero|null>}
-- Cuando se omite (null) y se indica una consulta, las lineas se derivan de
-- fn_conceptos_facturables. Cuando se envia, sirve para facturar servicios --
-- que no son productos de inventario y por eso no tienen un catalogo propio en
-- este esquema (ver nota de alcance en CLAUDE.md).
-- ----------------------------------------------------------------------------
create function public.fn_emitir_factura(
  p_id_propietario       bigint default null,
  p_id_consulta          bigint default null,
  p_porcentaje_impuesto  numeric default 0,
  p_lineas               jsonb   default null
)
returns bigint
language plpgsql
security definer set search_path = public
as $$
declare
  v_id_factura     bigint;
  v_id_propietario bigint;
  v_subtotal       numeric(10, 2);
  v_lineas         jsonb;
  v_total_lineas   integer;
begin
  -- SECURITY DEFINER se salta RLS, asi que el rol se comprueba aqui de forma
  -- explicita: sin esto, cualquier usuario autenticado podria emitir facturas.
  if public.fn_rol_actual() is distinct from 'recepcionista' then
    raise exception 'Solo el rol Recepcionista puede emitir facturas.'
      using errcode = '42501';
  end if;

  if p_porcentaje_impuesto < 0 then
    raise exception 'El porcentaje de impuesto no puede ser negativo.';
  end if;

  -- RN-012: la factura se emite a nombre del propietario. Cuando hay consulta, el
  -- propietario se deriva de ella y NO se toma del parametro: el cliente no puede
  -- ver la consulta (RN-006), asi que tampoco debe poder decidir a quien se le
  -- cobra una atencion -- se evita facturarle a un tercero por equivocacion.
  if p_id_consulta is not null then
    select pa.id_propietario into v_id_propietario
    from public.consulta c
    join public.paciente pa on pa.id_paciente = c.id_paciente
    where c.id_consulta = p_id_consulta;

    if v_id_propietario is null then
      raise exception 'La atencion indicada no existe.' using errcode = '23503';
    end if;
  else
    v_id_propietario := p_id_propietario;
    if v_id_propietario is null then
      raise exception 'Debe indicarse el propietario o la atencion a facturar.';
    end if;
  end if;

  -- Sin lineas explicitas se recuperan los conceptos de la atencion (RF-028).
  v_lineas := coalesce(p_lineas, (
    select coalesce(jsonb_agg(to_jsonb(cf)), '[]'::jsonb)
    from public.fn_conceptos_facturables(p_id_consulta) cf
  ));

  select count(*) into v_total_lineas from jsonb_array_elements(v_lineas);
  if v_total_lineas = 0 then
    raise exception 'La factura debe tener al menos un concepto a facturar.';
  end if;

  -- RN-013 lo garantiza factura.id_consulta UNIQUE: si esta atencion ya se
  -- facturo, este insert falla con 23505 y toda la operacion se revierte.
  insert into public.factura (id_propietario, id_consulta)
  values (v_id_propietario, p_id_consulta)
  returning id_factura into v_id_factura;

  -- RN-014: el precio de un producto se resuelve AQUI, contra el catalogo, en el
  -- momento de emitir -- nunca se acepta el que mande el cliente. Queda copiado
  -- en la linea, asi que revalorizar el producto despues no altera la factura ya
  -- emitida. Para servicios (sin id_producto) el precio si viene del formulario,
  -- que es lo que describe S-03.
  insert into public.detalle_factura (
    id_factura, numero_linea, id_producto, descripcion, cantidad, precio_unitario
  )
  select
    v_id_factura,
    (row_number() over ())::smallint,
    (l->>'id_producto')::bigint,
    (l->>'descripcion')::varchar(120),
    (l->>'cantidad')::numeric(10, 2),
    coalesce(
      (select pr.precio_unitario from public.producto pr
        where pr.id_producto = (l->>'id_producto')::bigint),
      (l->>'precio_unitario')::numeric(10, 2)
    )
  from jsonb_array_elements(v_lineas) as l;

  -- subtotal ya lo dejo al dia trg_totales_factura al insertar las lineas; total
  -- es una columna generada. Solo falta el impuesto, que depende del subtotal.
  select subtotal into v_subtotal from public.factura where id_factura = v_id_factura;

  update public.factura
  set impuesto = round(v_subtotal * p_porcentaje_impuesto / 100, 2)
  where id_factura = v_id_factura;

  return v_id_factura;
end;
$$;

-- Estas funciones son el unico camino para emitir una factura, y por eso no se
-- deja que las ejecute cualquiera: authenticated si (el rol real se comprueba
-- dentro), anon no.
revoke execute on function public.fn_conceptos_facturables(bigint) from public, anon;
revoke execute on function public.fn_emitir_factura(bigint, bigint, numeric, jsonb) from public, anon;
grant execute on function public.fn_conceptos_facturables(bigint) to authenticated;
grant execute on function public.fn_emitir_factura(bigint, bigint, numeric, jsonb) to authenticated;
