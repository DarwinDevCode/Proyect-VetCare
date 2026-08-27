# Guía para Diagramas de Secuencia UML — VetCare

## 1. Criterio de selección

Se seleccionaron catorce flujos que atraviesan varias capas y que ilustran una
regla de negocio real, no un CRUD trivial. No se documenta un diagrama por
cada función de cada `api.ts`: los flujos de solo lectura sin lógica de
servidor relevante (listar catálogos, buscar por texto) se dejan fuera a
propósito.

## 2. Correspondencia con el Documento 1 (diagrama de clases)

Cada participante de estos catorce diagramas es una de las clases descritas
en el Documento 1, y cada mensaje entre dos participantes corresponde a un
método declarado allí — es la relación de coherencia exigida entre ambos
diagramas: la estructura describe qué puede hacer cada clase, la secuencia
muestra cuándo y en qué orden se invoca.

| Rol en el diagrama de secuencia | Estereotipo (Documento 1) | Ejemplo |
|---|---|---|
| Página o diálogo con el que interactúa el actor | `«frontera»` (sección 5) | `NuevoPacienteDialog`, `AgendaPage` |
| Módulo `api.ts`, contexto de sesión, hook de dominio o función Edge | `«control»` (sección 4) | `pacientes/api.ts`, `AuthContext`, `admin-usuarios` |
| Fila o conjunto de filas de una tabla/vista | `«entidad»` (sección 3) | `Propietario`, `Cita` |
| Motor de persistencia (agrupa PostgREST + Postgres, porque desde la SPA ambos se invocan con una sola llamada HTTP y esa distinción no es observable desde el cliente) | nodo de datos, no una clase con métodos propios — sus operaciones son las funciones, triggers y restricciones documentadas por completo en el Documento 5 | "Postgres" |
| GoTrue, servidor SMTP externo | nodo externo (Documento 2) | "GoTrue", "smtp.gmail.com" |

Un mensaje `Actor → «frontera»` siempre nombra, entre paréntesis, el método
de frontera que se dispara (por ejemplo, `(guardar())`); ese nombre es
siempre uno de los citados en el Documento 1, sección 5. Un mensaje
`«frontera» → «control»` nombra el método de control invocado, con su firma
abreviada; ese nombre es siempre uno de los citados en el Documento 1,
sección 4. Ningún diagrama de esta guía invoca un método que no esté
declarado en el Documento 1.

## SEC-01 — Iniciar sesión (personal)

- **Módulo:** transversal (`auth/`).
- **Actor:** Recepcionista, Veterinario o Administrador.
- **Precondiciones:** la cuenta existe en `auth.users` y tiene una fila
  correspondiente en `usuario` (RF-001).
- **Participantes:** `LoginPage` («frontera»), `AuthContext` («control»),
  GoTrue (nodo externo), Postgres (`usuario`, `rol`).
- **Flujo principal:**
  1. Actor → `LoginPage`: completa correo y contraseña, confirma
     (`+manejarEnvio(evento)`).
  2. `LoginPage` → `AuthContext`: `+iniciarSesion(correo, password)`.
  3. `AuthContext` → GoTrue: `signInWithPassword({email, password})`.
  4. GoTrue → `AuthContext`: valida credenciales, emite JWT.
  5. GoTrue → `AuthContext`: `onAuthStateChange` dispara con la nueva sesión.
  6. `AuthContext` → Postgres: `-cargarPerfil(session)` —
     `from('usuario').select('*, rol:id_rol(*)').eq('id_usuario',
     session.user.id).single()`.
  7. Postgres → `AuthContext`: fila de `Usuario` con su `Rol` embebido.
  8. `AuthContext` → `LoginPage`: sesión con `{session, usuario, rol}`; la
     SPA navega a `/inicio`.
- **Flujo alternativo (`alt`):**
  - Credenciales inválidas (paso 4): GoTrue devuelve error →
    `iniciarSesion` devuelve `{error: 'Correo o contraseña incorrectos.'}`
    → `LoginPage` muestra el mensaje, sin navegar.
  - Cuenta autenticada sin fila en `Usuario` (paso 6 vacío): `AuthContext`
    fija `errorPerfil = 'Tu cuenta no tiene un perfil configurado en
    VetCare…'` y no completa la sesión (RF-001/RF-002).
- **Persistencia involucrada:** `auth.users` (lectura/validación por
  GoTrue), `usuario`, `rol` (lectura).

## SEC-02 — Registrar paciente con propietario nuevo y alta automática de portal

- **Módulo:** 1 (Pacientes y Propietarios), con efecto en el Módulo 8.
- **Actor:** Recepcionista.
- **Precondiciones:** ninguna; puede ser el primer paciente del propietario.
- **Participantes:** `NuevoPacienteDialog` («frontera»),
  `pacientes/api.ts` («control»), Postgres (`Propietario`, `Paciente`),
  función Edge `portal-acceso` («control»), GoTrue, `smtp.ts` («control»),
  servidor SMTP externo.
- **Flujo principal:**
  1. Recepcionista → `NuevoPacienteDialog`: completa datos del propietario
     (paso 1) y de la mascota (paso 2), confirma
     (`+validarPaso1()`/`+validarPaso2()`, luego `+guardar()`).
  2. `NuevoPacienteDialog` → `pacientes/api.ts`:
     `+crearPropietario(datos)` → Postgres: `insert into propietario`.
  3. Postgres → `NuevoPacienteDialog`: fila de `Propietario` creada
     (`id_propietario`).
  4. `NuevoPacienteDialog` → `pacientes/api.ts`: `+crearPaciente(datos)` →
     Postgres: `insert into paciente`.
  5. Postgres → `NuevoPacienteDialog`: fila de `Paciente` creada.
  6. `NuevoPacienteDialog` → `pacientes/api.ts`:
     `+asegurarAccesoPortalAutomatico(idPropietario)` → función Edge
     `portal-acceso`: `+automatico(idPropietario)`.
  7. `portal-acceso` → Postgres: `select` sobre `Usuario` para verificar
     que quien invoca es Recepcionista activo.
  8. `portal-acceso` → Postgres: `select` sobre `Propietario` (correo,
     `id_usuario_portal`).
  9. **`opt`** si `Propietario.correo` existe y `id_usuario_portal` es
     nulo:
     1. `portal-acceso` genera una contraseña temporal aleatoria
        (`crypto.getRandomValues`).
     2. `portal-acceso` → GoTrue: `auth.admin.createUser({email,
        password})`.
     3. `portal-acceso` → Postgres: `update propietario set
        id_usuario_portal = …`.
     4. `portal-acceso` → `smtp.ts`: `+enviarCredencialesPortal(datos)` →
        servidor SMTP externo (asunto "Acceso al Portal VetCare", con la
        URL de `/portal/ingresar` derivada del header `Origin`).
  10. `portal-acceso` → `pacientes/api.ts`: `{idUsuarioPortal}` o
      `{omitido: 'sin_correo'|'ya_existe'}`.
  11. `pacientes/api.ts` → `NuevoPacienteDialog`: propaga la respuesta;
      `NuevoPacienteDialog` → `PacientesPage`: `+recargar(criterio)` con el
      aviso correspondiente.
- **Flujos alternativos (`alt`):**
  - Sin correo registrado: `portal-acceso` responde `{omitido:'sin_correo'}`
    (código 200, no es un error) → se muestra un aviso informativo, el alta
    del paciente ya quedó completa.
  - Envío de correo fallido tras crear la cuenta: `portal-acceso` responde
    `{idUsuarioPortal, envioCorreoFallido:true}` — la cuenta **no se
    revierte** (es recuperable con "Reenviar acceso", SEC-11); se avisa a
    Recepción.
  - Fallo de red al invocar `portal-acceso`: se muestra un aviso, pero el
    paciente ya quedó registrado (el manejo de este paso es independiente
    del de los pasos 2-5).
- **Persistencia involucrada:** `propietario`, `paciente` (escritura vía
  PostgREST); `auth.users`, `propietario.id_usuario_portal` (escritura vía
  `service_role`, Edge Function).

## SEC-03 — Verificar disponibilidad y agendar una cita

- **Módulo:** 2 (Agenda y Citas).
- **Actor:** Recepcionista.
- **Precondiciones:** el paciente ya está registrado (Módulo 1); existe al
  menos un veterinario activo.
- **Participantes:** `NuevaCitaDialog` («frontera»),
  `useDisponibilidadCita` («control»), `Disponibilidad` («control»,
  utilidad), `agenda/api.ts` («control»), Postgres (`Cita`, trigger
  `fn_calcular_fin_cita`, restricción `EXCLUDE`).
- **Flujo principal:**
  1. Recepcionista → `NuevaCitaDialog`: elige paciente, veterinario, fecha,
     hora, duración.
  2. `NuevaCitaDialog` → `useDisponibilidadCita`: cambia alguno de esos
     valores (nueva evaluación del hook).
  3. `useDisponibilidadCita` → `agenda/api.ts`:
     `+listarCitasDelDia(fecha)` → Postgres: `select * from cita where
     fecha_hora_inicio between …` (RLS: Recepcionista/Veterinario).
  4. Postgres → `useDisponibilidadCita`: citas del día.
  5. `useDisponibilidadCita` → `Disponibilidad`: `+estaDisponible(inicio,
     fin, ocupados)` sobre las citas del veterinario elegido, excluyendo
     canceladas; si no está disponible,
     `+proximosHuecosLibres(fecha, duracionMinutos, ocupados)`.
  6. `useDisponibilidadCita` → `NuevaCitaDialog`: `{disponible,
     sugerencias}`.
  7. Recepcionista → `NuevaCitaDialog`: confirma "Registrar cita"
     (`+validar()`, luego `+guardar()`).
  8. `NuevaCitaDialog` → `agenda/api.ts`: `+crearCita(datos)` → Postgres:
     `insert into cita` (sin `fecha_hora_fin`).
  9. Postgres: trigger `fn_calcular_fin_cita` (`before insert`) materializa
     `fecha_hora_fin = fecha_hora_inicio + duracion_minutos`.
  10. Postgres: evalúa la restricción `EXCLUDE` (RN-004) sobre
      `(id_veterinario, tstzrange(fecha_hora_inicio, fecha_hora_fin))`.
  11. Postgres → `NuevaCitaDialog`: fila de `Cita` creada.
  12. `NuevaCitaDialog` → `AgendaPage`: `+recargar(f, v)`; recarga el grid.
- **Flujo alternativo (`alt`):**
  - Choque real detectado por la restricción `EXCLUDE` en el paso 10 (una
    condición de carrera que el chequeo del paso 5 no vio, por ejemplo dos
    recepcionistas agendando al mismo tiempo): Postgres devuelve el código
    `23P01`; `lib/errors.ts` lo traduce a "El veterinario seleccionado ya
    tiene una cita en ese horario."; el diálogo no se cierra.
- **Persistencia involucrada:** `cita` (lectura y escritura).

## SEC-04 — Registrar una consulta con vacunación en el mismo acto

- **Módulo:** 3 (Historial Clínico), con efecto en el Módulo 4.
- **Actor:** Veterinario.
- **Precondiciones:** paciente registrado; producto de tipo `vacuna` en
  catálogo, con existencia suficiente.
- **Participantes:** `NuevaConsultaDialog` («frontera»),
  `EventoHistorialItem` («frontera»), `NuevaVacunacionDialog` («frontera»),
  `historial/api.ts` («control»), Postgres (`Consulta`, `Vacunacion`,
  `MovimientoInventario`, `Producto`, triggers `fn_validar_producto_vacuna`,
  `fn_vacunacion_descuenta_inventario`, `fn_actualizar_existencia`).
- **Flujo principal:**
  1. Veterinario → `NuevaConsultaDialog`: motivo, diagnóstico, hallazgos,
     tratamiento, signos vitales opcionales; confirma (`+validar()`,
     `+guardar()`).
  2. `NuevaConsultaDialog` → `historial/api.ts`: `+crearConsulta(datos)` →
     Postgres: `insert into consulta` (RLS: solo `veterinario`, RN-006).
  3. Postgres → `NuevaConsultaDialog`: fila de `Consulta` creada.
  4. Veterinario → `EventoHistorialItem` (entrada recién creada): "Aplicar
     vacuna a esta consulta" (`+onAbrirVacunacion(idConsulta)`) → abre
     `NuevaVacunacionDialog` con `idConsulta` prefijado.
  5. Veterinario → `NuevaVacunacionDialog`: elige la vacuna; el diálogo
     invoca `historial/api.ts`:
     `+obtenerProximaVacuna(idPaciente, idProducto)` → Postgres: `select *
     from v_vacunas_proximas` (solo informativo).
  6. Veterinario confirma dosis y lote (`+validar()`, `+guardar()`) →
     `NuevaVacunacionDialog` → `historial/api.ts`: `+crearVacunacion(datos)`
     → Postgres: `insert into vacunacion`.
  7. Postgres: trigger `fn_validar_producto_vacuna` (`before insert`)
     verifica `producto.tipo = 'vacuna'`.
  8. Postgres: trigger `fn_vacunacion_descuenta_inventario`
     (`after insert`) inserta `MovimientoInventario`
     (`tipo_movimiento='consumo'`, `cantidad = -dosis`).
  9. Postgres: trigger `fn_actualizar_existencia` (`before insert` sobre
     `movimiento_inventario`) recalcula `producto.existencia_actual`.
  10. Postgres → `NuevaVacunacionDialog`: fila de `Vacunacion` creada.
  11. `NuevaVacunacionDialog` → `HistorialPage`: `+recargarHistorial()`
      (incluye la vacunación aplicada, una sola vez).
- **Flujo alternativo (`alt`):**
  - Producto elegido no es de tipo `vacuna` (no debería ocurrir porque el
    selector ya filtra por `tipo='vacuna'`, pero el trigger es la garantía
    real): Postgres rechaza con un `raise exception` ("El producto
    seleccionado no está clasificado como vacuna."), sin código SQLSTATE
    propio (`P0001`); `lib/errors.ts` muestra el mensaje tal cual.
  - Existencia insuficiente para el descuento automático (paso 9): el
    trigger `fn_actualizar_existencia` rechaza la transacción completa
    (`insert` de `Vacunacion` incluido) con el mensaje "No hay existencia
    suficiente del producto…".
- **Persistencia involucrada:** `consulta`, `vacunacion`,
  `movimiento_inventario`, `producto` (lectura y escritura, en una sola
  transacción para los pasos 7-9).

## SEC-05 — Registrar consumo manual de un producto en una consulta

- **Módulo:** 3 (Historial Clínico), con efecto en el Módulo 4.
- **Actor:** Veterinario.
- **Participantes:** `RegistrarConsumoDialog` («frontera»),
  `historial/api.ts` («control»), `inventario/api.ts` («control»),
  Postgres (`MovimientoInventario`, `Producto`, trigger
  `fn_actualizar_existencia`).
- **Flujo principal:**
  1. Veterinario → entrada de consulta en el timeline: "Registrar consumo
     de producto" → abre `RegistrarConsumoDialog` con `idConsulta`.
  2. `RegistrarConsumoDialog` → `historial/api.ts`:
     `+listarProductosConsumibles()` → Postgres: `select … from producto
     where tipo in ('medicamento','insumo')`.
  3. Veterinario elige producto y cantidad positiva; confirma
     (`+validar()`, `+guardar()`).
  4. `RegistrarConsumoDialog` → `inventario/api.ts`:
     `+registrarMovimiento({…, cantidad: -cantidad,
     tipo_movimiento:'consumo', id_consulta})` → Postgres: `insert into
     movimiento_inventario` (RLS: `veterinario` + `tipo_movimiento=
     'consumo'`).
  5. Postgres: trigger `fn_actualizar_existencia` recalcula
     `producto.existencia_actual`; rechaza si quedaría negativa (RN-010).
  6. Postgres → `RegistrarConsumoDialog`: fila de `MovimientoInventario`
     creada.
  7. `RegistrarConsumoDialog` → `HistorialPage`: `+recargarHistorial()`; el
     consumo aparece bajo "Productos utilizados" de esa consulta.
- **Flujo alternativo (`opt`):**
  - Cantidad mayor a la existencia disponible: `+validar()` ya la rechaza
    en el cliente (comparando contra `existencia_actual` cargada) antes de
    llamar al servidor; si de todas formas llegara (por ejemplo, un
    consumo concurrente redujo la existencia entre la carga y el envío), el
    trigger del paso 5 la rechaza igual.
- **Persistencia involucrada:** `movimiento_inventario`, `producto`.

## SEC-06 — Emitir una factura a partir de una atención

- **Módulo:** 5 (Facturación y Reportes).
- **Actor:** Recepcionista.
- **Precondiciones:** existe al menos una `Consulta` sin facturar.
- **Participantes:** `NuevaFacturaDialog` («frontera»),
  `facturacion/api.ts` («control»), Postgres (funciones
  `fn_atenciones_facturables`, `fn_conceptos_facturables`,
  `fn_emitir_factura`; entidades `Factura`, `DetalleFactura`; trigger
  `trg_totales_factura`; secuencia `seq_factura_numero`).
- **Flujo principal:**
  1. Recepcionista → `NuevaFacturaDialog`: abre el diálogo, elige "Cobrar
     una atención".
  2. `NuevaFacturaDialog` → `facturacion/api.ts`:
     `+listarAtencionesFacturables()` → `rpc('fn_atenciones_facturables')`
     → Postgres: `Consulta` `join` `Paciente`/`Propietario`, sin datos
     clínicos (RN-006).
  3. Recepcionista elige una atención.
  4. `NuevaFacturaDialog` → `facturacion/api.ts`:
     `+obtenerConceptosDeAtencion(idConsulta)` →
     `rpc('fn_conceptos_facturables', {p_id_consulta})` → Postgres: agrega
     los `MovimientoInventario` de tipo `consumo` de esa consulta (directos
     y vía vacunación).
  5. Postgres → `NuevaFacturaDialog`: conceptos con cantidad y precio
     (informativos).
  6. Recepcionista confirma "Emitir factura" (`+validar()`, `+emitir()`).
  7. `NuevaFacturaDialog` → `facturacion/api.ts`:
     `+emitirFactura({idConsulta, porcentajeImpuesto, lineas:null})` →
     `rpc('fn_emitir_factura', {...})`.
  8. Postgres (`fn_emitir_factura`, `security definer`):
     1. Verifica `fn_rol_actual() = 'recepcionista'`.
     2. Resuelve `id_propietario` desde `Consulta → Paciente →
        Propietario` (nunca del parámetro del cliente, RN-012).
     3. Vuelve a llamar a `fn_conceptos_facturables` internamente (los
        conceptos que se ven en pantalla son informativos; los que se
        graban se recalculan aquí).
     4. `insert into factura` → trigger `trg_numero_factura` asigna
        `numero` desde `seq_factura_numero` (RN-016).
     5. `insert into detalle_factura` por cada concepto, resolviendo
        `precio_unitario` contra `Producto` en este momento (RN-014).
     6. Trigger `trg_totales_factura` (`after insert` sobre
        `detalle_factura`) actualiza `Factura.subtotal`.
     7. `update factura set impuesto = round(subtotal * pct / 100, 2)`.
  9. Postgres → `NuevaFacturaDialog`: `id_factura`.
  10. `NuevaFacturaDialog` → `FacturacionPage`: `+recargar()`.
- **Flujos alternativos (`alt`):**
  - Rol distinto de `recepcionista` invoca la función directamente (por
    ejemplo, forzado por API): `fn_emitir_factura` la rechaza con código
    `42501` antes de insertar nada.
  - La atención ya fue facturada antes (`factura.id_consulta` es `unique`,
    RN-013): el `insert` del paso 8.4 falla con `23505`; toda la
    transacción se revierte (ninguna cabecera huérfana).
  - Ninguna línea que facturar (`conceptos.length = 0`): la función lanza
    una excepción con mensaje propio ("La factura debe tener al menos un
    concepto a facturar."), sin código SQLSTATE — se muestra tal cual
    (`P0001`).
- **Persistencia involucrada:** `factura`, `detalle_factura`,
  `seq_factura_numero` (todo en una sola transacción de servidor).

## SEC-07 — Registrar un cobro mixto sobre una factura

- **Módulo:** 5 (Facturación y Reportes).
- **Actor:** Recepcionista.
- **Precondiciones:** existe una factura con saldo pendiente.
- **Participantes:** `RegistrarPagoDialog` («frontera»),
  `FacturaDetalleDialog` («frontera»), `facturacion/api.ts` («control»),
  Postgres (`Pago`, vista `EstadoFactura`).
- **Flujo principal:**
  1. Recepcionista → `RegistrarPagoDialog`: reparte el saldo entre
     efectivo/tarjeta/transferencia (`+actualizarMonto(forma, monto)`,
     `+actualizarReferencia(forma, referencia)`; el diálogo propone el
     saldo completo en efectivo por defecto).
  2. Recepcionista confirma (`+validar()`, `+guardar()`).
  3. `RegistrarPagoDialog` → `facturacion/api.ts`:
     `+registrarPagosMixtos(lineas)` → Postgres: `insert into pago` con un
     arreglo de filas (una sola sentencia SQL con varios `VALUES`, RLS:
     `recepcionista`).
  4. Postgres → `RegistrarPagoDialog`: filas de `Pago` creadas.
  5. `RegistrarPagoDialog` → `FacturaDetalleDialog`: `+recargar()`
     (vuelve a invocar `+listarDetalle(idFactura)`/`+listarPagos(idFactura)`);
     `FacturacionPage` recarga `+listarFacturas(filtros)` sobre
     `EstadoFactura`, que recalcula `estado_cobro`/`saldo_pendiente`
     (RN-015).
- **Flujo alternativo (`opt`):**
  - Alguna línea inválida (por ejemplo, un monto que llevaría el total
    asignado por encima del saldo pendiente): `+validar()` la bloquea en
    el cliente antes de enviar; si de todas formas una línea fuera
    rechazada por una restricción de la base (`monto > 0`), el `insert`
    múltiple se revierte completo, sin dejar cobrada una forma de pago sí
    y otra no.
- **Persistencia involucrada:** `pago` (escritura); `v_estado_factura`
  (lectura derivada).

## SEC-08 — Recibir una orden de compra

- **Módulo:** 7 (Compras y Proveedores), con efecto en el Módulo 4.
- **Actor:** Administrador.
- **Precondiciones:** orden de compra en estado `emitida`.
- **Participantes:** `OrdenCompraDetalleDialog` («frontera»),
  `OrdenesCompraTab` («frontera»), `compras/api.ts` («control»), Postgres
  (`OrdenCompra`, `DetalleOrdenCompra`, `MovimientoInventario`, trigger
  `fn_recibir_orden_compra`, trigger `fn_actualizar_existencia`).
- **Flujo principal:**
  1. Administrador → `OrdenCompraDetalleDialog`: "Marcar como recibida"
     (`+cambiarEstado('recibida')`).
  2. `OrdenCompraDetalleDialog` → `compras/api.ts`:
     `+actualizarEstadoOrdenCompra(id, 'recibida')` → Postgres: `update
     orden_compra set estado='recibida'` (RLS: `administrador`).
  3. Postgres: trigger `fn_recibir_orden_compra` (`after update`,
     condición `new.estado='recibida' and old.estado is distinct from
     'recibida'`): por cada línea de `DetalleOrdenCompra`, `insert into
     movimiento_inventario (tipo_movimiento:'ingreso', id_orden_compra)`.
  4. Postgres: trigger `fn_actualizar_existencia` (uno por cada
     `MovimientoInventario` insertado) suma la cantidad recibida a
     `Producto.existencia_actual`.
  5. Postgres → `OrdenCompraDetalleDialog`: fila de `OrdenCompra`
     actualizada.
  6. `OrdenCompraDetalleDialog` → `OrdenesCompraTab`: `+recargar()`.
- **Flujo alternativo (`opt`):**
  - Un segundo intento de marcar la misma orden como `'recibida'` (ya
    estaba en ese estado): la condición `old.estado is distinct from
    'recibida'` del trigger no se cumple, no se generan movimientos
    nuevos ni se duplica el ingreso de existencia (RN-022).
- **Persistencia involucrada:** `orden_compra`, `movimiento_inventario`,
  `producto`.

## SEC-09 — Crear una cuenta de usuario de personal

- **Módulo:** 6 (Administración del sistema).
- **Actor:** Administrador.
- **Participantes:** `NuevoUsuarioDialog` («frontera»),
  `administracion/api.ts` («control»), función Edge `admin-usuarios`
  («control»), GoTrue, Postgres (`Usuario`, `EntradaAuditoria`).
- **Flujo principal:**
  1. Administrador → `NuevoUsuarioDialog`: nombres, apellidos, correo,
     contraseña temporal, rol; confirma (`+validar()`, `+guardar()`).
  2. `NuevoUsuarioDialog` → `administracion/api.ts`: `+crearUsuario(datos)`
     → función Edge `admin-usuarios`: `+crear(correo, password, nombres,
     apellidos, idRol)`.
  3. `admin-usuarios` → Postgres: `select` sobre `Usuario.activo`/
     `Rol.codigo` del invocador (usando su propio JWT, sin saltarse RLS)
     para verificar que es Administrador activo.
  4. `admin-usuarios` → GoTrue: `auth.admin.createUser({email, password,
     email_confirm:true})` (usando la `service_role` key).
  5. `admin-usuarios` → Postgres: `insert into usuario (id_usuario, id_rol,
     nombres, apellidos, correo)` (con `service_role`, tras el `GRANT`
     explícito).
  6. Postgres: trigger `trg_auditar_usuario` (`after insert`) inserta una
     fila en `EntradaAuditoria`.
  7. `admin-usuarios` → `administracion/api.ts`: `{idUsuario}`.
  8. `NuevoUsuarioDialog` → `UsuariosTab`: `+recargar()`.
- **Flujos alternativos (`alt`):**
  - Invocador no es Administrador activo (paso 3): `admin-usuarios`
    responde `403` sin llegar a GoTrue.
  - `insert` en `usuario` falla (paso 5, por ejemplo correo duplicado):
    `admin-usuarios` revierte creando primero — `auth.admin.deleteUser` de
    la cuenta recién creada en el paso 4 — para no dejar una cuenta de
    `auth.users` huérfana sin perfil.
- **Persistencia involucrada:** `auth.users`, `usuario`,
  `bitacora_auditoria`.

## SEC-10 — Desactivar una cuenta de usuario de personal

- **Módulo:** 6 (Administración del sistema).
- **Actor:** Administrador.
- **Precondiciones:** el usuario objetivo no es el único Administrador
  activo.
- **Participantes:** `UsuariosTab` («frontera»), `administracion/api.ts`
  («control»), función Edge `admin-usuarios` («control»), GoTrue, Postgres
  (`Usuario`, trigger `fn_proteger_ultimo_administrador`).
- **Flujo principal:**
  1. Administrador → `UsuariosTab`: menú de una cuenta activa →
     "Desactivar cuenta" (`+alternarActivo(usuario)`).
  2. `UsuariosTab` → `administracion/api.ts`:
     `+desactivarUsuario(idUsuario)` → función Edge `admin-usuarios`:
     `+desactivar(idUsuario)`.
  3. `admin-usuarios` → Postgres: verifica que el invocador es
     Administrador activo (igual que SEC-09, paso 3).
  4. `admin-usuarios` → GoTrue: `auth.admin.updateUserById(idUsuario,
     {ban_duration:'876000h'})` — bloqueo real en GoTrue, impide iniciar
     sesión de inmediato.
  5. `admin-usuarios` → Postgres: `update usuario set activo=false where
     id_usuario=idUsuario`.
  6. Postgres: trigger `fn_proteger_ultimo_administrador`
     (`before update`) evalúa si la cuenta objetivo es el único
     Administrador activo.
  7. Postgres: trigger `trg_auditar_usuario` inserta en
     `EntradaAuditoria`.
  8. `admin-usuarios` → `UsuariosTab`: `{ok:true}` → `+recargar()`.
- **Flujo alternativo (`alt`):**
  - La cuenta objetivo es el único Administrador activo (paso 6): el
    trigger lanza una excepción ("No es posible desactivar o reasignar al
    único Administrador activo del sistema."); la actualización del paso 5
    se revierte — el usuario queda con `ban_duration` aplicado en GoTrue
    (paso 4) pero `usuario.activo` sigue en `true`, así que
    `fn_rol_actual()` le sigue resolviendo su rol con normalidad y la
    aplicación no lo trata como desactivado; el bloqueo de GoTrue por sí
    solo no revierte, es una llamada aparte no transaccional con el
    `update` de Postgres.
- **Persistencia involucrada:** `auth.users` (bloqueo), `usuario`,
  `bitacora_auditoria`.

## SEC-11 — Reenviar acceso al portal (recuperación)

- **Módulo:** 8 (Portal del propietario).
- **Actor:** Recepcionista.
- **Precondiciones:** el propietario ya tiene `id_usuario_portal` (cuenta
  creada, con o sin envío de correo exitoso).
- **Participantes:** `FichaDialog` («frontera»),
  `ReenviarAccesoPortalDialog` («frontera»), `pacientes/api.ts`
  («control»), función Edge `portal-acceso` («control»), GoTrue, `smtp.ts`
  («control»), servidor SMTP externo.
- **Flujo principal:**
  1. Recepcionista → `FichaDialog`: "Reenviar acceso" → abre
     `ReenviarAccesoPortalDialog`.
  2. Recepcionista → `ReenviarAccesoPortalDialog`: confirma
     (`+reenviar()`).
  3. `ReenviarAccesoPortalDialog` → `pacientes/api.ts`:
     `+reenviarAccesoPortal(idPropietario)` → función Edge
     `portal-acceso`: `+restablecer(idPropietario)`.
  4. `portal-acceso` → Postgres: verifica invocador Recepcionista activo;
     lee `Propietario.id_usuario_portal`/`correo`.
  5. `portal-acceso` genera una contraseña temporal nueva.
  6. `portal-acceso` → GoTrue: `auth.admin.updateUserById(id_usuario_portal,
     {password})`.
  7. `portal-acceso` → `smtp.ts`: `+enviarCredencialesPortal(datos)` →
     servidor SMTP externo (asunto "Nueva contraseña del Portal VetCare").
  8. `portal-acceso` → `ReenviarAccesoPortalDialog`: `{ok:true}` o
     `{ok:true, envioCorreoFallido:true}`.
- **Flujos alternativos (`alt`):**
  - El propietario todavía no tiene cuenta de portal (`id_usuario_portal`
    nulo): `portal-acceso` responde con un error explícito pidiendo usar
    "Dar acceso al portal" primero (SEC-02, o el flujo `+manual(...)` de
    `admin-usuarios`, vía `AccesoPortalDialog`).
  - Envío de correo falla en el paso 7: la contraseña ya quedó actualizada
    en GoTrue (paso 6, no se revierte); se informa a Recepción para que
    reintente.
- **Persistencia involucrada:** `auth.users` (contraseña); no escribe en
  `propietario` (la cuenta ya estaba vinculada).

## SEC-12 — Propietario solicita una cita desde el portal y Recepción la confirma

- **Módulo:** 8 (Portal del propietario), con efecto en el Módulo 2. Flujo
  de dos actores en dos sesiones distintas.
- **Actor 1:** Propietario (portal). **Actor 2:** Recepcionista (personal).
- **Precondiciones:** el propietario tiene cuenta de portal y al menos una
  mascota.
- **Participantes:** `SolicitarCitaDialog` («frontera»), `portal/api.ts`
  («control»), Postgres (`Cita`), `AgendaPage` («frontera»),
  `agenda/api.ts` («control»), `CitaDetalleDialog` («frontera»).
- **Flujo principal:**
  1. Propietario → `SolicitarCitaDialog`: elige mascota, motivo, fecha
     preferida opcional; confirma (`+validar()`, `+guardar()`).
  2. `SolicitarCitaDialog` → `portal/api.ts`:
     `+crearSolicitudCita(datos)` → Postgres: `insert into cita` con
     `estado:'solicitada'`, `id_veterinario:null`,
     `id_usuario_registro:null` explícitos (política `cita_insert_portal`
     los exige literales).
  3. Postgres → `SolicitarCitaDialog`: fila de `Cita` creada; el `EXCLUDE`
     de solapamiento no aplica (su cláusula `where` excluye
     `'solicitada'`).
  4. — *(sesión de Recepción, más tarde)* — `AgendaPage` →
     `agenda/api.ts`: `+listarSolicitudesPendientes()` → Postgres: `select
     * from cita where estado='solicitada'`; el banner "N solicitudes de
     cita desde el portal" se muestra.
  5. Recepcionista → banner en `AgendaPage`: abre `CitaDetalleDialog` sobre
     la solicitud.
  6. Recepcionista → `CitaDetalleDialog`: "Confirmar" → elige veterinario,
     fecha y hora reales (verificación de disponibilidad igual que SEC-03,
     vía `useDisponibilidadCita`), confirma (`+guardarConfirmacion()`).
  7. `CitaDetalleDialog` → `agenda/api.ts`: `+confirmarSolicitud(id,
     {id_veterinario, fecha_hora_inicio, duracion_minutos})` → Postgres:
     `update cita set estado='programada', ...`.
  8. Postgres: el `update` activa el `EXCLUDE` de solapamiento para esta
     fila (ahora `estado='programada'`, con `id_veterinario` no nulo).
  9. Postgres → `CitaDetalleDialog`: fila de `Cita` actualizada.
  10. `CitaDetalleDialog` → `AgendaPage`: `+recargar(f, v)` y
      `+recargarSolicitudes()`; la cita aparece en el grid del día
      correspondiente.
- **Flujo alternativo (`alt`):**
  - El horario elegido en el paso 7 ya está ocupado: la restricción
    `EXCLUDE` del paso 8 rechaza el `update` con `23P01`, mismo mensaje
    mapeado que en SEC-03.
  - Recepcionista rechaza la solicitud en vez de confirmarla:
    `CitaDetalleDialog` → `+confirmarCancelacion()` → `agenda/api.ts`:
    `+cancelarCita(id)` → `update cita set estado='cancelada'`; el
    propietario deberá solicitar otra cita desde el portal.
- **Persistencia involucrada:** `cita` (escritura por el propietario y,
  después, por Recepción).

## SEC-13 — Cancelar una cita y agendar con el cupo liberado a lista de espera

- **Módulo:** 2 (Agenda y Citas), con la Lista de espera (RF-034/RF-035).
- **Actor:** Recepcionista.
- **Precondiciones:** existe al menos una entrada `pendiente` en
  `ListaEspera` compatible con el veterinario de la cita.
- **Participantes:** `CitaDetalleDialog` («frontera»), `AgendaPage`
  («frontera»), `NuevaCitaDialog` («frontera»), `agenda/api.ts`
  («control»), Postgres (`Cita`, `ListaEspera`).
- **Flujo principal:**
  1. Recepcionista → `CitaDetalleDialog`: "Cancelar cita" → confirma
     (`+confirmarCancelacion()`).
  2. `CitaDetalleDialog` → `agenda/api.ts`: `+cancelarCita(id)` →
     Postgres: `update cita set estado='cancelada'`.
  3. `CitaDetalleDialog` → `agenda/api.ts`:
     `+listarCoincidenciasListaEspera(idVeterinario)` → Postgres: `select *
     from lista_espera where estado='pendiente' and (id_veterinario = …
     or id_veterinario is null)`.
  4. Postgres → `CitaDetalleDialog`: coincidencias (`ListaEsperaConPaciente[]`).
  5. Recepcionista → coincidencia: "Agendar con este cupo".
  6. `CitaDetalleDialog` → `AgendaPage`:
     `+agendarDesdeListaEspera(entrada, citaCancelada)`: cierra el
     detalle, abre `NuevaCitaDialog` prefijado con paciente, veterinario y
     hora del cupo liberado.
  7. Recepcionista → `NuevaCitaDialog`: confirma (`+validar()`,
     `+guardar()`; mismo flujo de verificación de disponibilidad que
     SEC-03).
  8. `NuevaCitaDialog` → `agenda/api.ts`: `+crearCita(datos)` → Postgres:
     `insert into cita`.
  9. `NuevaCitaDialog` → `agenda/api.ts`:
     `+marcarAtendidaListaEspera(idListaEspera)` → Postgres: `update
     lista_espera set estado='atendida'`.
  10. `NuevaCitaDialog` → `AgendaPage`: `+recargar(f, v)`.
- **Persistencia involucrada:** `cita`, `lista_espera`.

## SEC-14 — Consultar el historial clínico de un paciente

- **Módulo:** 3 (Historial Clínico).
- **Actor:** Veterinario.
- **Participantes:** `HistorialPage` («frontera»), `EventoHistorialItem`
  («frontera»), `historial/api.ts` («control»), `historial/
  eventoHistorial.ts` («control»), Postgres (vista `EventoHistorial`).
- **Flujo principal:**
  1. Veterinario → `HistorialPage`: busca y selecciona un paciente
     (`+buscar(criterio)`).
  2. `HistorialPage` → `historial/api.ts`:
     `+listarHistorial(idPaciente)` → Postgres: `select * from
     v_historial_clinico where id_paciente=… order by fecha desc` (RLS de
     las tres tablas base: solo `veterinario`, RN-006).
  3. `HistorialPage` → `historial/api.ts`:
     `+listarConsumosPorConsulta(idPaciente)` → Postgres: `select … from
     movimiento_inventario … where consulta.id_paciente=… and
     tipo_movimiento='consumo' and id_consulta is not null`.
  4. Postgres → `HistorialPage`: eventos unificados (`EventoHistorial[]`)
     y consumos manuales.
  5. `HistorialPage` → `EventoHistorialItem` (por cada evento, como
     `props`); `EventoHistorialItem` → `historial/eventoHistorial.ts`:
     `+interpretarEvento(evento)` para resolver el significado posicional
     de las columnas según `tipo_evento`, y muestra los consumos de esa
     consulta bajo "Productos utilizados".
- **Flujo alternativo (`opt`):**
  - Rol distinto de Veterinario intenta esta ruta: `RutaProtegida` en
    `App.tsx` ya la bloquea antes de renderizar `HistorialPage`; si se
    fuerza la consulta por API, `v_historial_clinico` (con
    `security_invoker=on`) devuelve `[]` porque la RLS de `consulta`,
    `vacunacion` y `examen_laboratorio` la deniega.
- **Persistencia involucrada:** `v_historial_clinico`,
  `movimiento_inventario` (lectura).

## 3. Validación de coherencia con el Documento 1

- Cada método citado entre paréntesis en los catorce flujos anteriores
  aparece, con el mismo nombre, en la sección 4 o 5 del Documento 1; se
  revisó flujo por flujo antes de cerrar esta guía.
- Cada participante nombrado en la fila "Participantes" de un flujo aparece
  como clase «frontera» o «control» del Documento 1, o como nodo de
  persistencia/externo del Documento 2; ningún diagrama de secuencia
  introduce un componente que no exista en ninguno de los dos.
- Cuando un mismo diálogo aparece en más de un flujo con el mismo método
  (por ejemplo, `+validar()`/`+guardar()` en varios diálogos de alta, o
  `+cancelarCita(id)` en SEC-12 y SEC-13), el nombre se mantiene idéntico
  en cada aparición — es la misma clase y el mismo método, no una
  coincidencia de nombres.
