-- RF-031 concede la consulta de facturas emitidas a Recepcionista Y Administrador,
-- pero la politica de `propietario` solo la habia concedido a Recepcionista y
-- Veterinario (modulo 1). El resultado era una contradiccion detectada probando la
-- pantalla con la cuenta de Administrador: veia las facturas pero ninguna estaba
-- "a nombre de" nadie -- y como el filtro por propietario obliga a un embed con
-- `!inner`, el listado le salia directamente vacio.
--
-- No se le concede lectura de TODO el padron de propietarios: la matriz 3.8 no le da
-- acceso al modulo 1 y RF-007 (consulta de ficha) sigue siendo de Recepcion y
-- Veterinario. Se le concede exactamente lo que RF-031 necesita: los propietarios
-- que tienen al menos una factura emitida. Un propietario registrado al que nunca
-- se le ha facturado sigue siendo invisible para Administracion.
--
-- Es el mismo criterio de fn_conceptos_facturables y fn_atenciones_facturables:
-- abrir lo minimo que el requisito exige, no la tabla entera.

create policy propietario_select_facturado on public.propietario
  for select to authenticated
  using (
    public.fn_rol_actual() = 'administrador'
    and exists (
      select 1 from public.factura f
      where f.id_propietario = propietario.id_propietario
    )
  );
