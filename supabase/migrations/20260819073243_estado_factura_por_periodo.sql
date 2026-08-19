-- RF-031: "consultar las facturas emitidas filtrando por periodo, propietario o
-- situacion de cobro".
--
-- v_estado_factura ya resolvia la situacion de cobro y el saldo (RN-015), pero no
-- exponia fecha_emision, asi que no se podia filtrar por periodo sobre ella. Una
-- vista no tiene claves foraneas, de modo que PostgREST tampoco puede unirla con
-- factura desde el cliente para recuperar la fecha: o esta en la vista, o el
-- frontend tendria que reimplementar la comparacion total/pagos de RN-015 por su
-- cuenta y arriesgarse a que divergiera de la base. Se agrega a la vista.
--
-- Se anaden tambien id_consulta (para distinguir una factura de atencion de una de
-- servicio suelto) e id_usuario_emisor (RF-003/RNF-009: quien la emitio).

drop view public.v_estado_factura;

create view public.v_estado_factura as
  select
    f.id_factura,
    f.numero,
    f.id_propietario,
    f.id_consulta,
    f.fecha_emision,
    f.id_usuario_emisor,
    f.subtotal,
    f.impuesto,
    f.total,
    coalesce(sum(p.monto), 0) as total_pagado,
    f.total - coalesce(sum(p.monto), 0) as saldo_pendiente,
    case
      when coalesce(sum(p.monto), 0) = 0 then 'pendiente'
      when coalesce(sum(p.monto), 0) >= f.total then 'pagada'
      else 'parcial'
    end as estado_cobro
  from public.factura f
  left join public.pago p on p.id_factura = f.id_factura
  group by
    f.id_factura, f.numero, f.id_propietario, f.id_consulta, f.fecha_emision,
    f.id_usuario_emisor, f.subtotal, f.impuesto, f.total;

-- Sin esto la vista se ejecutaria con los privilegios de su propietario y se
-- saltaria el RLS de factura y pago (ver seccion 6 de CLAUDE.md).
alter view public.v_estado_factura set (security_invoker = on);

grant select on public.v_estado_factura to authenticated;
