# VetCare – Sistema de Gestión Veterinaria
## Diseño de la Base de Datos
### Análisis de necesidades de información, normalización (1NF–3NF) y modelos conceptual, lógico y físico
#### Artefactos N.º 9, 10 y 11 – Fase 2: Análisis y Diseño

---

## Índice del razonamiento

Este documento sigue deliberadamente el orden en que se toma una decisión de diseño real, no el orden en que se presenta el resultado:

1. Qué información necesita el sistema (sección 1)
2. Estructura inicial, todavía con defectos (sección 2)
3. Normalización paso a paso: 1NF → 2NF → 3NF (sección 3)
4. Estructura final normalizada (sección 4)
5. Decisiones de escalabilidad (sección 5)
6. Modelo conceptual (sección 6)
7. Modelo lógico (sección 7)
8. Modelo físico (sección 8)
9. Coherencia y trazabilidad entre todo lo anterior (sección 9)

---

# 1. Necesidades de información del sistema

## 1.1 De dónde sale cada necesidad

El punto de partida no son tablas, sino preguntas: *¿qué tiene que recordar el sistema para que los casos de uso funcionen?* Cada necesidad se rastrea hasta un caso de uso o un flujo del DFD.

| # | Necesidad de información | Origen | Permanencia |
|---|---|---|---|
| N1 | Identificar a los dueños de las mascotas y poder contactarlos | CU-1.1, CU-1.4 · almacén D1 | Permanente |
| N2 | Identificar a cada mascota y saber a qué dueño pertenece | CU-1.2, CU-1.5 · D1 | Permanente |
| N3 | Saber qué citas hay, para qué paciente, con qué profesional, cuándo y en qué estado | CU-2.1 a CU-2.4 · D2 | Permanente (histórico de agenda) |
| N4 | Saber si un horario está libre antes de agendar | CU-2.5 · flujo *Verificar disponibilidad* | Se deduce de N3 |
| N5 | Dejar constancia de cada atención clínica: motivo, hallazgos, diagnóstico y tratamiento | CU-3.1 · D3 | Permanente e inalterable |
| N6 | Dejar constancia de cada vacuna aplicada y del producto utilizado | CU-3.2 · D3 + flujo FI-1 hacia inventario | Permanente |
| N7 | Dejar constancia de cada examen de laboratorio y su resultado | CU-3.3 · D3 | Permanente |
| N8 | Recuperar todo lo anterior por paciente y en orden cronológico | CU-3.4 | — (consulta) |
| N9 | Conocer qué productos maneja la clínica y cuál es su nivel mínimo | CU-4.1 · D4 | Permanente |
| N10 | Conocer la existencia actual de cada producto | CU-4.4 · D4 | Permanente |
| N11 | Registrar cada movimiento que altera la existencia: ingreso, ajuste y consumo | CU-4.2, CU-4.3 · D4 | Permanente (histórico) |
| N12 | Detectar cuándo un producto queda por debajo de su nivel mínimo | CU-4.5 | Se deduce de N9 + N10 |
| N13 | Emitir un comprobante valorado por la atención prestada | CU-5.1 · D5 | Permanente e inalterable |
| N14 | Registrar el cobro de ese comprobante | CU-5.2 · D5 | Permanente |
| N15 | Consolidar los ingresos de un período | CU-5.4 | Se deduce de N13 + N14 |
| N16 | Saber quién es cada usuario del sistema y qué rol desempeña | CU-0.1 · D6 | Permanente |

## 1.2 Qué se crea, consulta, modifica y elimina

| Información | Se crea | Se modifica | Se elimina |
|---|---|---|---|
| Propietarios y pacientes | Sí (CU-1.1, CU-1.2) | Sí (CU-1.4, CU-1.5) | **No** |
| Citas | Sí (CU-2.1) | Sí: fecha/hora y estado (CU-2.3, CU-2.4) | **No** — se cancelan, no se borran |
| Registros clínicos | Sí (CU-3.1 a CU-3.3) | **No** | **No** |
| Productos e inventario | Sí (CU-4.1) | Sí: existencias (CU-4.2, CU-4.3) | **No** |
| Facturas y pagos | Sí (CU-5.1, CU-5.2) | **No** | **No** |
| Usuarios | Fuera del alcance | Fuera del alcance | Fuera del alcance |

> **Decisión de diseño transversal:** ningún caso de uso elimina información. El sistema no realiza borrados físicos. Lo que en el lenguaje del negocio se llama "cancelar" o "dar de baja" se representa con un **estado** o con un indicador de actividad. Esto es indispensable en un sistema clínico y contable, donde el histórico debe poder reconstruirse.

## 1.3 Información necesaria que los documentos no mencionan explícitamente

Se incorpora únicamente lo que resulta imprescindible para que un caso de uso funcione, y se justifica en cada caso.

| Dato añadido | Por qué es imprescindible |
|---|---|
| **Duración de la cita** | CU-2.5 debe determinar si un horario está ocupado. Con solo la hora de inicio es imposible saber si dos citas se solapan. |
| **Precio unitario del producto** | CU-5.1 debe calcular el total de la factura a partir de los productos utilizados. Sin precio no hay importe. |
| **Precio unitario en cada línea de factura** | El precio de un producto cambia con el tiempo; una factura emitida debe conservar el importe con el que se emitió. |
| **Usuario responsable en consulta, vacunación, examen, movimiento de inventario, factura y pago** | En un historial clínico y en un documento contable es obligatorio saber quién hizo el registro. Además, los tres roles ya existen como actores en los casos de uso. |
| **Existencia resultante en cada movimiento** | Permite auditar el inventario y reconstruir el saldo en cualquier fecha pasada sin recorrer todo el histórico. |
| **Fecha de nacimiento del paciente en lugar de "edad"** | La edad cambia sola con el paso del tiempo; almacenarla obligaría a actualizarla. La fecha de nacimiento es un dato fijo del que la edad se calcula. |
| **Forma de pago** | Un registro de cobro sin indicar cómo se cobró es incompleto para el reporte de ingresos (CU-5.4). |

## 1.4 Información que NO se convierte en dato almacenado

| Elemento | Por qué no se almacena |
|---|---|
| **Historial clínico** | No es una entidad: es el resultado de consultar consultas, vacunaciones y exámenes de un mismo paciente ordenados por fecha. Se resuelve con una vista, no con una tabla. |
| **Alerta de stock mínimo** | Es una comparación entre dos datos que ya existen (existencia actual y nivel mínimo). Almacenarla crearía alertas obsoletas cuando el stock se repone. |
| **Disponibilidad de horario** | Se deduce de las citas ya registradas. |
| **Reporte de ingresos** | Es una agregación de facturas y pagos sobre un rango de fechas. |
| **Contraseñas** | La autenticación es nativa de la plataforma (hoja "Plataforma de Desarrollo"). El sistema guarda el perfil del usuario y su rol, nunca credenciales. |
| **Proveedores, compras, empleados, hospitalización, servicios tarifados** | Fuera del alcance del proyecto. |

---

# 2. Estructura inicial de la base de datos

Antes de normalizar hay que tener algo que normalizar. La estructura inicial se construye de la forma más directa posible: **un archivo por cada almacén de datos del DFD**. Es un diseño que funciona —soporta todos los casos de uso— pero que arrastra los defectos típicos de un primer intento.

### A1 · FICHA (del almacén D1)
`PK compuesta (id_propietario, id_paciente)`

| Atributo | Observación |
|---|---|
| id_propietario, cedula, nombre_completo_propietario, direccion, telefonos, correo | Datos del dueño |
| id_paciente, nombre_mascota, especie, raza, sexo, edad, color | Datos de la mascota |

### A2 · AGENDA (del almacén D2)
`PK (id_cita)` · fecha_hora, nombre_paciente, nombre_propietario, nombre_veterinario, motivo, estado

### A3 · HISTORIAL (del almacén D3)
`PK compuesta (id_paciente, fecha_atencion)`

| Atributo | Observación |
|---|---|
| nombre_paciente, especie | Repetidos en cada atención |
| motivo, hallazgos, diagnostico, tratamiento | Datos de la consulta |
| vacuna_1, vacuna_2, vacuna_3 | Vacunas aplicadas ese día |
| examen_1, resultado_1, examen_2, resultado_2 | Exámenes de ese día |
| productos_utilizados | Texto libre: *"Amoxicilina 500mg x2; Jeringa 5ml x1"* |
| nombre_veterinario, especialidad_veterinario | Quién atendió |

### A4 · INVENTARIO (del almacén D4)
`PK (id_producto)` · nombre, tipo, presentacion, unidad_medida, nivel_minimo, existencia_actual, precio, **ultimo_ingreso_fecha, ultimo_ingreso_cantidad, ultimo_consumo_fecha, ultimo_consumo_cantidad**

### A5 · FACTURACION (del almacén D5)
`PK (id_factura)`

| Atributo | Observación |
|---|---|
| numero, fecha | Datos del comprobante |
| cedula_propietario, nombre_propietario, direccion_propietario | Datos del cliente |
| producto_1, cantidad_1, precio_1, producto_2, cantidad_2, precio_2, producto_3, cantidad_3, precio_3 | Líneas de la factura |
| total, fecha_pago, monto_pago, forma_pago, estado | Cobro |

### A6 · USUARIOS (del almacén D6)
`PK (id_usuario)` · nombres, apellidos, correo, rol_nombre, rol_descripcion, activo

### 2.1 Problemas visibles a simple vista

| Problema | Dónde aparece |
|---|---|
| Datos del propietario repetidos por cada mascota | A1 |
| Columnas numeradas para el mismo tipo de dato | A3 (vacunas, exámenes), A5 (líneas de factura) |
| Varios valores dentro de una sola columna | A1 (telefonos), A3 (productos_utilizados) |
| Nombres copiados desde otra entidad | A2, A3, A5 |
| Un dato que envejece solo | A1 (edad) |
| Solo cabe el último movimiento; el histórico se pierde | A4 |
| Solo cabe un pago por factura | A5 |
| Descripción del rol repetida en cada usuario | A6 |

---

# 3. Normalización

## 3.1 Primera Forma Normal (1NF)

**Qué exige:** que cada celda contenga un solo valor, que no existan columnas numeradas para el mismo tipo de información, que cada fila tenga clave primaria y que el orden de filas y columnas sea irrelevante.

### Problema 1.1 · Atributo con varios valores

| | |
|---|---|
| **Estructura inicial** | `A1.telefonos = "0999123456 / 042-765432"` · `A3.productos_utilizados = "Amoxicilina x2; Jeringa x1"` |
| **Por qué está mal** | No se puede buscar, contar ni sumar. Para saber cuántas unidades de Amoxicilina se consumieron habría que interpretar texto libre. Y sin cantidad estructurada, el descuento automático de inventario (flujo FI-1 del DFD) es imposible. |
| **Corrección** | Un teléfono por columna atómica; los productos utilizados pasan a filas de una tabla propia (**movimiento_inventario**), una por producto consumido, con su cantidad numérica. |

> Sobre los teléfonos: la solución **incorrecta** sería crear `telefono_1, telefono_2, telefono_3`, que cambia un problema de atomicidad por uno de grupos repetidos. Se adopta un `telefono` obligatorio y un `telefono_alterno` opcional, ambos atómicos. Si en el futuro la clínica necesitara N teléfonos, la solución correcta sería una tabla `telefono_propietario`, no más columnas.

### Problema 1.2 · Grupos repetidos

| | |
|---|---|
| **Estructura inicial** | `A3`: vacuna_1, vacuna_2, vacuna_3 · examen_1, resultado_1, examen_2, resultado_2 · `A5`: producto_1..3 con sus cantidades y precios |
| **Por qué está mal** | Fija un límite artificial (¿y la cuarta vacuna?), desperdicia espacio cuando hay una sola, y obliga a escribir consultas absurdas: para buscar un producto en las facturas habría que revisar tres columnas distintas. |
| **Corrección** | Cada grupo repetido se convierte en filas de una tabla hija: **vacunacion**, **examen_laboratorio** y **detalle_factura**. |

### Problema 1.3 · Solo cabe el último movimiento

| | |
|---|---|
| **Estructura inicial** | `A4`: ultimo_ingreso_fecha, ultimo_ingreso_cantidad, ultimo_consumo_fecha, ultimo_consumo_cantidad |
| **Por qué está mal** | Es un grupo repetido encubierto y, peor, **pierde información**: cada nuevo movimiento sobrescribe el anterior. El sistema no podría explicar cómo llegó a la existencia que muestra. |
| **Corrección** | Tabla **movimiento_inventario** con una fila por cada ingreso, ajuste o consumo. |

### Problema 1.4 · Un solo pago por factura

| | |
|---|---|
| **Estructura inicial** | `A5`: fecha_pago, monto_pago, forma_pago dentro de la factura |
| **Por qué está mal** | Impide registrar un abono parcial o un pago en dos formas (mitad efectivo, mitad tarjeta), situación normal en una clínica. |
| **Corrección** | Tabla **pago**, con una fila por cada cobro recibido sobre la factura. |

### Problema 1.5 · Identificación única

Todas las estructuras iniciales tienen clave primaria, de modo que este punto se cumple. Sí se corrige el **tipo** de clave: `A1` usaba la cédula del propietario como identificador. Se sustituye por una clave sustituta numérica y la cédula pasa a ser un atributo con restricción de unicidad. Razón: una cédula puede haberse digitado mal y necesitar corrección, y si es clave primaria ese cambio se propaga a todas las tablas que la referencian.

### Problema 1.6 · Dato que depende del momento de la consulta

`A1.edad` no es incorrecto según 1NF, pero sí es un error de diseño: es un valor que caduca. Se sustituye por `fecha_nacimiento`, dato fijo del que la edad se calcula cuando se necesita.

## 3.2 Segunda Forma Normal (2NF)

**Qué exige:** cumplir 1NF y que ningún atributo dependa solo de una parte de una clave primaria compuesta. Solo aplica a las estructuras con clave compuesta: `A1` y `A3`.

### Problema 2.1 · Dependencia parcial en A1 (FICHA)

Clave compuesta: `(id_propietario, id_paciente)`

| Atributo | ¿De qué depende realmente? |
|---|---|
| cedula, nombre_completo_propietario, direccion, telefonos, correo | Solo de `id_propietario` |
| nombre_mascota, especie, raza, sexo, fecha_nacimiento | Solo de `id_paciente` |

**Consecuencia práctica del error:** si un propietario tiene tres mascotas, sus datos de contacto se almacenan tres veces. Si cambia de domicilio, hay que actualizar tres filas y basta con olvidar una para que el sistema tenga dos direcciones distintas para la misma persona. Además, un propietario que aún no ha registrado ninguna mascota **no puede existir** en la tabla, cuando CU-1.1 permite justamente registrarlo primero.

**Corrección:** separar en dos tablas, **propietario** y **paciente**, y conservar la relación mediante `paciente.id_propietario` como clave foránea.

### Problema 2.2 · Dependencia parcial en A3 (HISTORIAL)

Clave compuesta: `(id_paciente, fecha_atencion)`

| Atributo | ¿De qué depende? |
|---|---|
| nombre_paciente, especie | Solo de `id_paciente` |
| motivo, hallazgos, diagnóstico, tratamiento | De la clave completa |

**Consecuencia:** el nombre y la especie del paciente se repiten en cada una de sus atenciones. Un paciente con veinte visitas guarda veinte copias del mismo dato.

**Corrección:** los datos identificativos permanecen únicamente en **paciente**; el registro clínico conserva solo `id_paciente` como clave foránea. Además, la clave `(id_paciente, fecha_atencion)` se sustituye por una clave sustituta `id_consulta`: la fecha no es un buen identificador, porque nada impide dos atenciones al mismo paciente el mismo día.

> Tras esta corrección **ninguna tabla del diseño final conserva clave primaria compuesta**, por lo que 2NF se cumple de forma trivial en la estructura definitiva. Se documenta igualmente el análisis porque es donde se detectaron dos de las separaciones más importantes del modelo.

## 3.3 Tercera Forma Normal (3NF)

**Qué exige:** cumplir 2NF y que ningún atributo que no forma parte de la clave dependa de otro atributo que tampoco forma parte de la clave.

### Problema 3.1 · Raza y especie

| | |
|---|---|
| **Estructura** | `paciente(id_paciente, nombre, especie, raza, sexo, ...)` |
| **Dependencia detectada** | `raza → especie`. Si la raza es "Siamés", la especie es necesariamente "Gato". La especie depende de la raza, y ninguna de las dos es clave. |
| **Por qué importa** | Nada impide registrar un paciente de especie "Perro" y raza "Siamés". Además, "Labrador" escrito veinte veces terminará teniendo variantes ("labrador", "Labrador Retriever") que romperán cualquier filtro o reporte. |
| **Corrección** | Catálogos **especie** y **raza**, con `raza.id_especie` como clave foránea. El paciente referencia ambos. |

**Matiz importante:** `paciente` conserva `id_especie` además de `id_raza`. En apariencia es redundante, pero **la raza es opcional** —un mestizo no tiene raza definida— y sin `id_especie` un paciente sin raza quedaría sin especie, que es un dato clínicamente indispensable. La coherencia entre ambos se garantiza con una clave foránea compuesta `(id_raza, id_especie)` hacia `raza`, de modo que es imposible asignar una raza que no pertenezca a la especie declarada.

### Problema 3.2 · Descripción del rol dentro del usuario

| | |
|---|---|
| **Estructura** | `A6.usuarios(id_usuario, nombres, correo, rol_nombre, rol_descripcion)` |
| **Dependencia detectada** | `rol_nombre → rol_descripcion`. La descripción depende del rol, no del usuario. |
| **Corrección** | Catálogo **rol**; `usuario.id_rol` como clave foránea. |

### Problema 3.3 · Datos del propietario dentro de la factura

| | |
|---|---|
| **Estructura** | `A5.facturacion(id_factura, ..., cedula_propietario, nombre_propietario, direccion_propietario, ...)` |
| **Dependencia detectada** | `cedula_propietario → nombre_propietario, direccion_propietario`. |
| **Corrección** | La factura conserva únicamente `id_propietario`; los datos del cliente se leen desde **propietario**. |

### Problema 3.4 · Nombres copiados en la agenda

`A2.agenda` guardaba nombre_paciente, nombre_propietario y nombre_veterinario. Los tres dependen de sus respectivas entidades, no de la cita. Se sustituyen por `id_paciente` e `id_veterinario`; el nombre del propietario se obtiene a través del paciente.

### 3.5 · Dos casos que PARECEN violar 3NF y no lo hacen

Distinguirlos es tan importante como corregir los anteriores:

| Caso | Por qué no es una violación |
|---|---|
| **`detalle_factura.precio_unitario`**, existiendo ya `producto.precio_unitario` | No es una copia: es el precio **vigente al momento de emitir la factura**. Si mañana sube el precio del producto, la factura de ayer debe seguir mostrando lo que realmente se cobró. Son dos hechos distintos que coinciden en valor solo temporalmente. |
| **`producto.existencia_actual`**, pudiendo calcularse sumando los movimientos | Las formas normales regulan dependencias entre atributos **de una misma fila**, no valores derivados de otra tabla. Es una desnormalización deliberada, explicada en 3.6. |

### 3.6 · Valores derivados: criterio adoptado

Se almacena un valor calculado **solo si** se cumple alguna de estas dos condiciones:

1. Sirve de base a una regla de negocio que debe evaluarse en cada escritura.
2. Recalcularlo exigiría recorrer un histórico que crece indefinidamente.

| Valor derivado | ¿Se almacena? | Razón |
|---|---|---|
| `producto.existencia_actual` | **Sí** | Cumple ambas condiciones: la alerta de stock mínimo (CU-4.5) se evalúa en cada movimiento, y el histórico de movimientos crece sin límite. Se mantiene mediante un *trigger*, nunca desde la aplicación, para que no pueda descuadrarse. |
| `movimiento_inventario.existencia_resultante` | **Sí** | Permite auditar el inventario y reconstruir el saldo en cualquier fecha pasada. Es un dato histórico, no un cálculo repetido. |
| `detalle_factura.subtotal_linea` | **Sí**, como columna generada por el motor | El propio gestor la calcula y la mantiene; no puede quedar desactualizada. |
| Estado de cobro de la factura | **No** | Recalcularlo solo exige sumar los pagos de esa factura, que son pocos. Se resuelve con una vista. |
| Alerta de stock mínimo | **No** | Es una comparación inmediata entre dos columnas de la misma fila. |
| Total de ingresos del período | **No** | Agregación bajo demanda. |

---

# 4. Estructura final normalizada

De 6 archivos iniciales se obtienen **15 tablas**. El aumento no es fragmentación gratuita: cada tabla nueva resuelve un problema concreto identificado en la sección 3.

| Estructura inicial | Se convierte en | Motivo |
|---|---|---|
| A1 FICHA | propietario · paciente · especie · raza | 2NF (dependencia parcial) y 3NF (raza → especie) |
| A2 AGENDA | cita | 3NF (nombres copiados) |
| A3 HISTORIAL | consulta · vacunacion · examen_laboratorio | 1NF (grupos repetidos) y 2NF (dependencia parcial) |
| A4 INVENTARIO | producto · movimiento_inventario | 1NF (pérdida de histórico) |
| A5 FACTURACION | factura · detalle_factura · pago | 1NF (grupos repetidos, pago único) y 3NF (datos del cliente) |
| A6 USUARIOS | usuario · rol | 3NF (descripción del rol) |

### Verificación de que no se perdió información

| Necesidad (sección 1.1) | Dónde queda resuelta |
|---|---|
| N1 | propietario |
| N2 | paciente + especie + raza |
| N3 | cita |
| N4 | consulta sobre cita |
| N5 | consulta |
| N6 | vacunacion + movimiento_inventario |
| N7 | examen_laboratorio |
| N8 | vista sobre consulta + vacunacion + examen_laboratorio |
| N9 | producto |
| N10 | producto.existencia_actual |
| N11 | movimiento_inventario |
| N12 | comparación producto.existencia_actual ↔ producto.nivel_minimo |
| N13 | factura + detalle_factura |
| N14 | pago |
| N15 | agregación sobre factura + pago |
| N16 | usuario + rol |

Las 16 necesidades quedan cubiertas y ninguna tabla existe sin una necesidad que la respalde.

---

# 5. Decisiones pensadas para la evolución del sistema

El proyecto tiene un alcance cerrado, pero un sistema clínico siempre crece. Estas decisiones no añaden tablas ni funciones: eligen, entre alternativas igualmente válidas hoy, la que no obliga a rehacer la base de datos mañana.

| Decisión | Alternativa rígida evitada | Qué permite en el futuro |
|---|---|---|
| **Claves sustitutas numéricas** en lugar de cédula, código o número de factura como clave primaria | Usar la cédula como PK | Corregir una cédula mal digitada sin propagar el cambio; admitir extranjeros con pasaporte. |
| **Catálogo `rol`** en lugar de un valor fijo dentro del usuario | `rol` como texto con valores fijos en el código | Incorporar un nuevo perfil (por ejemplo, auxiliar) insertando una fila, sin modificar la estructura. |
| **Catálogos `especie` y `raza`** | Texto libre | Ampliar a especies exóticas sin tocar el esquema y sin ensuciar los reportes. |
| **`movimiento_inventario` como bitácora de eventos** | Guardar solo el saldo actual | Construir un kardex, valorar el inventario a una fecha, o detectar mermas recurrentes. |
| **`pago` como tabla independiente (1:N)** | Un pago embebido en la factura | Registrar abonos parciales o pagos mixtos. |
| **`consulta`, `vacunacion` y `examen_laboratorio` separadas, con vínculo opcional a la consulta** | Una única tabla "atención" con columnas para todo | Añadir un nuevo tipo de evento clínico (por ejemplo, una desparasitación) como tabla nueva, sin alterar las existentes ni llenar de nulos las actuales. |
| **`detalle_factura.id_producto` opcional, con descripción y precio propios** | Obligar a que toda línea sea un producto de inventario | Facturar servicios (consulta, vacunación) hoy, e incorporar un catálogo de servicios más adelante sin migrar las facturas ya emitidas. |
| **Sin borrado físico; estados e indicador `activo`** | `DELETE` real | Conservar la trazabilidad clínica y contable, requisito no negociable en este dominio. |
| **`NUMERIC` para importes y cantidades** | `FLOAT` | Evitar errores de redondeo en dinero; admitir dosis fraccionadas. |
| **`TIMESTAMPTZ` en fechas con hora** | Fecha y hora en texto o sin zona | Ordenar correctamente y soportar un futuro despliegue en varias sedes. |

**Lo que deliberadamente NO se diseñó:** tablas de proveedores, compras, hospitalización, servicios tarifados, recordatorios de vacunación o portal del propietario. Todas son ampliaciones previsibles, pero ninguna está en el alcance. La estructura las admite mediante tablas nuevas que se apoyan en las claves ya existentes; anticiparlas ahora sería sobre-diseñar.

---

# 6. Modelo conceptual

Este modelo describe **qué conceptos maneja el sistema y cómo se vinculan**, sin hablar todavía de columnas ni tipos de datos.

## 6.1 Entidades

| Entidad | Qué representa | Por qué es necesaria | Información que agrupa |
|---|---|---|---|
| **Rol** | Perfil de trabajo dentro de la clínica | El sistema habilita funciones según el rol (CU-0.1 y componente *Control de acceso por rol*). Separarlo evita repetir su descripción en cada usuario. | Nombre y descripción del perfil |
| **Usuario** | Persona que opera el sistema | Todo registro clínico y contable debe poder atribuirse a alguien. Es el equivalente en datos de los tres actores del modelo de casos de uso. | Identificación, nombre, correo, rol, estado |
| **Propietario** | Dueño de una o varias mascotas | Es el cliente de la clínica y el titular de las facturas. Existe por sí mismo, incluso antes de registrar su primera mascota (CU-1.1). | Identificación, nombres, contacto, dirección |
| **Paciente** | Mascota atendida | Es el sujeto de toda la actividad clínica: las citas, las atenciones y las vacunas se refieren a él. | Nombre, especie, raza, sexo, fecha de nacimiento |
| **Especie** | Tipo de animal | Dato clínicamente indispensable; como catálogo evita variantes de escritura. | Nombre de la especie |
| **Raza** | Raza dentro de una especie | Se separa de la especie porque la determina (ver 3NF, problema 3.1). | Nombre de la raza y especie a la que pertenece |
| **Cita** | Reserva de un espacio de atención | Es el objeto que gestiona todo el módulo 2 y la base para verificar disponibilidad. | Paciente, veterinario, inicio, duración, motivo, estado |
| **Consulta** | Atención clínica realizada | Es el registro central del historial: contiene el diagnóstico y el tratamiento (CU-3.1). | Motivo, hallazgos, diagnóstico, tratamiento, peso |
| **Vacunación** | Aplicación de una vacuna a un paciente | Es un hecho clínico con entidad propia: puede ocurrir dentro de una consulta o en una visita exclusiva de vacunación (relación `extend` de CU-3.2). | Producto aplicado, dosis, lote, fecha |
| **Examen de laboratorio** | Examen practicado y su resultado | Mismo razonamiento: puede originarse en una consulta o registrarse después, cuando llega el resultado. | Tipo, fechas, resultado |
| **Producto** | Medicamento, insumo o vacuna del inventario | Es lo que se controla en el módulo 4 y lo que se consume y se factura. | Código, nombre, tipo, unidad, nivel mínimo, existencia, precio |
| **Movimiento de inventario** | Hecho que altera la existencia de un producto | Sin él, el sistema mostraría un saldo sin poder explicarlo. Es también el punto donde se materializa el descuento por consumo. | Tipo, cantidad, existencia resultante, fecha, responsable, origen |
| **Factura** | Comprobante emitido por una atención | Documento contable del módulo 5. Inalterable una vez emitido. | Número, fecha, titular, importes |
| **Detalle de factura** | Cada concepto cobrado dentro de una factura | Una factura casi nunca tiene una sola línea; separarlas es lo que permite cobrar varios conceptos (1NF). | Descripción, cantidad, precio, subtotal |
| **Pago** | Cobro recibido sobre una factura | Facturar y cobrar son hechos distintos que ocurren en momentos distintos (CU-5.1 y CU-5.2 son casos de uso separados). | Fecha, monto, forma de pago |

## 6.2 Relaciones

| Entidad A | Relación | Entidad B | Cardinalidad | Qué significa y por qué existe |
|---|---|---|---|---|
| Rol | **clasifica a** | Usuario | 1 : N | Cada usuario desempeña exactamente un rol; un mismo rol lo desempeñan varias personas. Es 1:N y no N:M porque en los casos de uso los tres roles tienen funciones separadas: nadie factura y diagnostica a la vez. Si en el futuro una persona necesitara dos roles, se resolvería con una tabla intermedia sin rehacer nada más. |
| Propietario | **posee** | Paciente | 1 : N | Toda mascota debe tener un dueño registrado —CU-1.2 exige seleccionarlo antes de dar de alta al paciente— y un dueño puede traer varias mascotas. Esta relación es la que permite facturar al titular correcto y contactarlo por una cita. |
| Especie | **agrupa a** | Raza | 1 : N | Cada raza pertenece a una sola especie; una especie tiene muchas razas. Es la relación que impide registrar combinaciones imposibles. |
| Especie | **clasifica a** | Paciente | 1 : N | Todo paciente pertenece a una especie: es un dato clínico obligatorio que condiciona dosis y tratamientos. |
| Raza | **caracteriza a** | Paciente | 0..1 : N | Opcional en el lado de la raza: un mestizo no tiene raza definida y el sistema debe poder registrarlo igual. Por eso la especie se guarda aparte y no se deduce de la raza. |
| Paciente | **tiene programada** | Cita | 1 : N | Cada cita es para un paciente concreto; un paciente puede tener muchas citas a lo largo del tiempo, incluidas las canceladas, que se conservan. |
| Usuario (veterinario) | **atiende** | Cita | 1 : N | La cita se reserva con un profesional determinado. Sin este vínculo sería imposible verificar disponibilidad (CU-2.5), que se calcula por profesional y no por clínica. |
| Cita | **da origen a** | Consulta | 0..1 : 0..1 | Una cita puede terminar en una atención, o no (el paciente no asistió, se canceló). Y una atención puede ocurrir sin cita previa, si el paciente llega por urgencia. Por eso ambos extremos son opcionales. Esta relación es la que permite saber después cuántas citas agendadas se convirtieron efectivamente en atención. |
| Paciente | **recibe** | Consulta | 1 : N | Toda atención se registra sobre un paciente identificado; un paciente acumula muchas atenciones. Es la relación que hace posible el historial clínico (CU-3.4). |
| Usuario (veterinario) | **registra** | Consulta | 1 : N | Un registro clínico sin autor no tiene valor legal ni permite dar seguimiento. |
| Paciente | **recibe** | Vacunación | 1 : N | Igual que la consulta: la vacuna se aplica a un paciente concreto y forma parte de su historial. |
| Consulta | **incluye** | Vacunación | 0..1 : N | Opcional en el lado de la consulta porque, según el modelo de casos de uso, la vacunación *extiende* a la consulta: puede aplicarse durante la atención o en una visita exclusiva de vacunación. El vínculo se guarda cuando existe, y queda vacío cuando no. |
| Producto | **se aplica en** | Vacunación | 1 : N | Toda vacuna aplicada corresponde a un producto del inventario. Este vínculo es el que hace obligatorio el descuento de existencias (relación `include` CU-3.2 → CU-4.3 y flujo FI-1 del DFD). |
| Paciente | **se somete a** | Examen de laboratorio | 1 : N | El examen pertenece al historial del paciente. |
| Consulta | **origina** | Examen de laboratorio | 0..1 : N | Mismo caso que la vacunación: el examen puede solicitarse dentro de una consulta o registrarse por separado cuando llega el resultado. |
| Producto | **experimenta** | Movimiento de inventario | 1 : N | Cada movimiento afecta a un producto; un producto acumula todo su histórico de movimientos. Es la relación que sostiene el control de stock. |
| Usuario | **realiza** | Movimiento de inventario | 1 : N | Todo cambio de existencias debe ser atribuible a alguien: el veterinario que consume o el administrador que ingresa o ajusta. |
| Consulta / Vacunación | **provoca** | Movimiento de inventario | 0..1 : N | Vínculo opcional que solo se usa en los movimientos de tipo consumo: indica **por qué** se descontó el producto. Es lo que permite auditar que cada descuento corresponde a una atención real y no a una salida sin justificar. |
| Propietario | **es titular de** | Factura | 1 : N | La factura se emite a nombre del dueño, no de la mascota: el dueño es quien paga. Un propietario acumula muchas facturas. |
| Consulta | **se factura en** | Factura | 0..1 : 0..1 | Opcional en ambos lados: una atención puede quedar sin facturar todavía, y una factura puede corresponder a una visita sin consulta (una vacunación aislada). Cuando el vínculo existe, es el que permite recuperar automáticamente lo realizado (relación `include` CU-5.1 → CU-3.4). |
| Usuario | **emite** | Factura | 1 : N | Responsable de la emisión del comprobante. |
| Factura | **se compone de** | Detalle de factura | 1 : N | Una factura tiene al menos una línea y normalmente varias. El detalle no existe sin su factura: es una relación de dependencia total. |
| Producto | **se cobra en** | Detalle de factura | 0..1 : N | Opcional porque no toda línea es un producto de inventario: la consulta o la aplicación de la vacuna son servicios, y el proyecto no contempla un catálogo de servicios. Esas líneas se describen con texto y precio propios. |
| Factura | **recibe** | Pago | 1 : N | Una factura puede cobrarse en uno o varios pagos; un pago pertenece siempre a una factura. Se modela 1:N y no 1:1 porque el cobro parcial es una situación normal y un diseño 1:1 obligaría a rehacer la tabla el día que ocurra. |
| Usuario | **registra** | Pago | 1 : N | Responsable del cobro. |

## 6.3 Relaciones que merecen explicación adicional

**¿Por qué no existe una relación directa entre Propietario y Cita o entre Propietario y Consulta?**
Porque el vínculo ya existe a través del paciente: la cita es de la mascota, y la mascota tiene dueño. Añadir una relación directa duplicaría el camino y abriría la puerta a que ambos discreparan (una cita cuyo propietario no fuera el dueño de esa mascota).

**¿Por qué la factura sí se relaciona directamente con el Propietario?**
Aquí el camino indirecto no basta. Una factura puede cubrir la atención de dos mascotas del mismo dueño, y el titular del comprobante es una figura contable propia. Además, el vínculo con el paciente ya queda registrado en las líneas de detalle y en la consulta asociada.

**¿Por qué no existe una entidad "Historial clínico"?**
Porque el historial no es un hecho que ocurra: es la *lectura conjunta* de tres hechos que sí ocurren (consultas, vacunaciones y exámenes). Crear una tabla para él obligaría a duplicar en ella lo que ya está en las otras tres.

**¿Por qué no existe una entidad "Alerta de stock"?**
Porque la alerta no aporta información nueva: es el resultado de comparar la existencia actual con el nivel mínimo, dos datos que ya están en la misma fila de `producto`. Si se almacenara, habría que borrarla al reponer el stock, y una alerta olvidada sería peor que ninguna.

---

# 7. Modelo lógico

## 7.1 Cómo se pasa del conceptual al lógico

Las reglas de traducción aplicadas son las estándar:

1. **Cada entidad se convierte en una tabla** y recibe una clave primaria sustituta.
2. **Cada relación 1:N se convierte en una clave foránea** en la tabla del lado "muchos". Ejemplo: como un propietario tiene muchos pacientes, es `paciente` quien guarda `id_propietario`.
3. **Cada relación 0..1 se convierte en una clave foránea que admite nulo.** Ejemplo: `vacunacion.id_consulta` queda vacío cuando la vacuna se aplicó fuera de una consulta.
4. **Cada relación 1:1 opcional se convierte en una clave foránea con restricción de unicidad**, para impedir que dos filas apunten al mismo destino. Ejemplo: `consulta.id_cita` es único, porque una cita no puede producir dos atenciones.
5. **Los atributos multivaluados o repetidos se convierten en tablas hijas.**

**Sobre relaciones muchos a muchos:** el modelo conceptual **no contiene ninguna relación N:M**, por lo que no se requiere ninguna tabla intermedia de simple asociación. Conviene aclarar dos casos que a primera vista lo parecen:

| Caso aparente | Por qué no es N:M |
|---|---|
| Un paciente recibe muchos productos y un producto se aplica a muchos pacientes | La relación no es directa: pasa por hechos con datos propios (fecha, cantidad, responsable). `movimiento_inventario` no es una tabla puente, es una **entidad de evento** con atributos y clave propia. |
| Una factura contiene muchos productos y un producto aparece en muchas facturas | Igual: `detalle_factura` tiene cantidad, precio histórico y subtotal. Es una entidad asociativa con información propia, no un simple par de claves. |

## 7.2 Tablas del modelo lógico

| Tabla | Clave primaria | Claves foráneas | Propósito |
|---|---|---|---|
| `rol` | id_rol | — | Catálogo de perfiles de usuario |
| `usuario` | id_usuario | id_rol → rol | Personal que opera el sistema |
| `propietario` | id_propietario | — | Dueños de las mascotas |
| `especie` | id_especie | — | Catálogo de especies |
| `raza` | id_raza | id_especie → especie | Catálogo de razas por especie |
| `paciente` | id_paciente | id_propietario → propietario · (id_raza, id_especie) → raza · id_especie → especie | Mascotas atendidas |
| `cita` | id_cita | id_paciente → paciente · id_veterinario → usuario · id_usuario_registro → usuario | Agenda de atenciones |
| `consulta` | id_consulta | id_paciente → paciente · id_veterinario → usuario · id_cita → cita (único) | Atención clínica realizada |
| `vacunacion` | id_vacunacion | id_paciente → paciente · id_veterinario → usuario · id_producto → producto · id_consulta → consulta | Vacunas aplicadas |
| `examen_laboratorio` | id_examen | id_paciente → paciente · id_veterinario → usuario · id_consulta → consulta | Exámenes y resultados |
| `producto` | id_producto | — | Catálogo de medicamentos, insumos y vacunas |
| `movimiento_inventario` | id_movimiento | id_producto → producto · id_usuario → usuario · id_consulta → consulta · id_vacunacion → vacunacion | Histórico de cambios de existencias |
| `factura` | id_factura | id_propietario → propietario · id_consulta → consulta · id_usuario_emisor → usuario | Comprobantes emitidos |
| `detalle_factura` | id_detalle | id_factura → factura · id_producto → producto | Conceptos cobrados en cada factura |
| `pago` | id_pago | id_factura → factura · id_usuario → usuario | Cobros recibidos |

## 7.3 Atributos y restricciones por tabla

Se indica el porqué de los atributos que no son evidentes.

**`rol`** — id_rol, codigo (único), nombre, descripcion.
*El `codigo` permite que la aplicación identifique el rol por un valor estable ("VETERINARIO") aunque el nombre visible cambie.*

**`usuario`** — id_usuario, id_rol, nombres, apellidos, correo (único), activo, fecha_registro.
*No hay columna de contraseña: la autenticación es nativa de la plataforma. `activo` sustituye al borrado cuando alguien deja la clínica, porque sus registros clínicos deben conservar autor.*

**`propietario`** — id_propietario, identificacion (única), nombres, apellidos, telefono, telefono_alterno, correo, direccion, activo, fecha_registro.
*`identificacion` es única para impedir duplicados del mismo cliente, pero no es clave primaria (ver 1NF, problema 1.5).*

**`especie`** — id_especie, nombre (único).
**`raza`** — id_raza, id_especie, nombre. Único: (id_especie, nombre). Único adicional: (id_raza, id_especie), necesario para la clave foránea compuesta desde `paciente`.

**`paciente`** — id_paciente, id_propietario, id_especie, id_raza (nulo), nombre, sexo, fecha_nacimiento (nulo), color, activo, fecha_registro.
*`fecha_nacimiento` admite nulo porque en mascotas rescatadas suele desconocerse. `sexo` se restringe a valores válidos.*

**`cita`** — id_cita, id_paciente, id_veterinario, fecha_hora_inicio, duracion_minutos, motivo, estado, id_usuario_registro, fecha_registro.
*`duracion_minutos` es lo que permite detectar solapamientos. `estado` admite programada, cancelada o atendida; reprogramar no crea un estado nuevo: cambia la fecha y hora de la misma cita.*

**`consulta`** — id_consulta, id_paciente, id_veterinario, id_cita (nulo, único), fecha_hora, motivo, hallazgos, diagnostico, tratamiento, peso_kg.
*`peso_kg` se registra por atención y no en el paciente: es un dato clínico que varía y cuya evolución interesa.*

**`vacunacion`** — id_vacunacion, id_paciente, id_veterinario, id_producto, id_consulta (nulo), fecha_aplicacion, dosis, lote.
*`lote` es trazabilidad sanitaria básica ante un retiro de producto.*

**`examen_laboratorio`** — id_examen, id_paciente, id_veterinario, id_consulta (nulo), tipo_examen, fecha_solicitud, fecha_resultado (nulo), resultado (nulo), observacion.
*El resultado admite nulo porque el examen se registra al solicitarse y se completa después.*

**`producto`** — id_producto, codigo (único), nombre, tipo, presentacion, unidad_medida, nivel_minimo, existencia_actual, precio_unitario, activo.
*`tipo` distingue medicamento, insumo y vacuna, los tres términos del alcance. `activo` retira un producto del uso sin borrar su histórico.*

**`movimiento_inventario`** — id_movimiento, id_producto, tipo_movimiento, cantidad, existencia_resultante, fecha_hora, id_usuario, id_consulta (nulo), id_vacunacion (nulo), observacion.
*`cantidad` se almacena con signo: positiva en ingresos, negativa en consumos. Así la existencia es simplemente la suma de los movimientos y el saldo nunca puede interpretarse mal.*

**`factura`** — id_factura, numero (único), id_propietario, id_consulta (nulo), fecha_emision, subtotal, impuesto, total, id_usuario_emisor.

**`detalle_factura`** — id_detalle, id_factura, numero_linea, id_producto (nulo), descripcion, cantidad, precio_unitario, subtotal_linea. Único: (id_factura, numero_linea).
*`descripcion` es obligatoria incluso cuando hay producto: conserva el texto exacto que se imprimió en el comprobante.*

**`pago`** — id_pago, id_factura, fecha_pago, monto, forma_pago, referencia, id_usuario.
*`referencia` guarda el número de transferencia o de autorización de tarjeta.*

---

# 8. Modelo físico

**Gestor:** PostgreSQL, conforme a la hoja "Plataforma de Desarrollo" del archivo de planificación. *(El artefacto 11 del "Resumen de artefactos" menciona MySQL 8.0; la discrepancia se resuelve en la sección 9.3.)*

**Convenciones:** nombres en minúsculas y `snake_case`; tablas en singular; clave primaria `id_<tabla>`; claves foráneas con el mismo nombre que la clave a la que apuntan.

### 8.1 Catálogos y usuarios

**`rol`**

| Columna | Tipo | PK/FK | Obligatorio | Restricciones y valor por defecto |
|---|---|---|---|---|
| id_rol | SMALLINT GENERATED ALWAYS AS IDENTITY | PK | Sí | |
| codigo | VARCHAR(20) | | Sí | UNIQUE |
| nombre | VARCHAR(50) | | Sí | |
| descripcion | VARCHAR(150) | | No | |

**`usuario`**

| Columna | Tipo | PK/FK | Obligatorio | Restricciones y valor por defecto |
|---|---|---|---|---|
| id_usuario | UUID | PK | Sí | Coincide con el identificador que emite el servicio de autenticación de la plataforma |
| id_rol | SMALLINT | FK → rol | Sí | ON DELETE RESTRICT |
| nombres | VARCHAR(60) | | Sí | |
| apellidos | VARCHAR(60) | | Sí | |
| correo | VARCHAR(120) | | Sí | UNIQUE |
| activo | BOOLEAN | | Sí | DEFAULT TRUE |
| fecha_registro | TIMESTAMPTZ | | Sí | DEFAULT now() |

**`especie`**

| Columna | Tipo | PK/FK | Obligatorio | Restricciones |
|---|---|---|---|---|
| id_especie | SMALLINT IDENTITY | PK | Sí | |
| nombre | VARCHAR(40) | | Sí | UNIQUE |

**`raza`**

| Columna | Tipo | PK/FK | Obligatorio | Restricciones |
|---|---|---|---|---|
| id_raza | INTEGER IDENTITY | PK | Sí | |
| id_especie | SMALLINT | FK → especie | Sí | ON DELETE RESTRICT |
| nombre | VARCHAR(60) | | Sí | UNIQUE (id_especie, nombre) |
| | | | | UNIQUE (id_raza, id_especie) — soporte de la FK compuesta desde `paciente` |

### 8.2 Pacientes y propietarios

**`propietario`**

| Columna | Tipo | PK/FK | Obligatorio | Restricciones y valor por defecto |
|---|---|---|---|---|
| id_propietario | BIGINT IDENTITY | PK | Sí | |
| identificacion | VARCHAR(13) | | Sí | UNIQUE · CHECK longitud ≥ 10 |
| nombres | VARCHAR(60) | | Sí | |
| apellidos | VARCHAR(60) | | Sí | |
| telefono | VARCHAR(15) | | Sí | |
| telefono_alterno | VARCHAR(15) | | No | |
| correo | VARCHAR(120) | | No | CHECK formato de correo |
| direccion | VARCHAR(150) | | No | |
| activo | BOOLEAN | | Sí | DEFAULT TRUE |
| fecha_registro | TIMESTAMPTZ | | Sí | DEFAULT now() |

**`paciente`**

| Columna | Tipo | PK/FK | Obligatorio | Restricciones y valor por defecto |
|---|---|---|---|---|
| id_paciente | BIGINT IDENTITY | PK | Sí | |
| id_propietario | BIGINT | FK → propietario | Sí | ON DELETE RESTRICT |
| id_especie | SMALLINT | FK → especie | Sí | ON DELETE RESTRICT |
| id_raza | INTEGER | FK compuesta (id_raza, id_especie) → raza | No | Garantiza que la raza pertenezca a la especie declarada |
| nombre | VARCHAR(60) | | Sí | |
| sexo | CHAR(1) | | Sí | CHECK IN ('M','H') |
| fecha_nacimiento | DATE | | No | CHECK ≤ fecha actual |
| color | VARCHAR(40) | | No | |
| activo | BOOLEAN | | Sí | DEFAULT TRUE |
| fecha_registro | TIMESTAMPTZ | | Sí | DEFAULT now() |

### 8.3 Agenda

**`cita`**

| Columna | Tipo | PK/FK | Obligatorio | Restricciones y valor por defecto |
|---|---|---|---|---|
| id_cita | BIGINT IDENTITY | PK | Sí | |
| id_paciente | BIGINT | FK → paciente | Sí | ON DELETE RESTRICT |
| id_veterinario | UUID | FK → usuario | Sí | ON DELETE RESTRICT |
| fecha_hora_inicio | TIMESTAMPTZ | | Sí | |
| duracion_minutos | SMALLINT | | Sí | DEFAULT 30 · CHECK > 0 |
| motivo | VARCHAR(150) | | No | |
| estado | VARCHAR(12) | | Sí | DEFAULT 'programada' · CHECK IN ('programada','cancelada','atendida') |
| id_usuario_registro | UUID | FK → usuario | No | |
| fecha_registro | TIMESTAMPTZ | | Sí | DEFAULT now() |

> **Regla de integridad destacada:** dos citas del mismo veterinario no pueden solaparse en el tiempo. En PostgreSQL se resuelve de forma declarativa con una restricción `EXCLUDE` sobre el rango `[inicio, inicio + duración)` aplicada solo a las citas no canceladas. Es la implementación técnica de CU-2.5 y la única forma de garantizar que dos usuarios simultáneos no reserven el mismo espacio.

### 8.4 Historial clínico

**`consulta`**

| Columna | Tipo | PK/FK | Obligatorio | Restricciones y valor por defecto |
|---|---|---|---|---|
| id_consulta | BIGINT IDENTITY | PK | Sí | |
| id_paciente | BIGINT | FK → paciente | Sí | ON DELETE RESTRICT |
| id_veterinario | UUID | FK → usuario | Sí | ON DELETE RESTRICT |
| id_cita | BIGINT | FK → cita | No | UNIQUE — una cita origina como máximo una consulta |
| fecha_hora | TIMESTAMPTZ | | Sí | DEFAULT now() |
| motivo | TEXT | | Sí | |
| hallazgos | TEXT | | No | |
| diagnostico | TEXT | | Sí | |
| tratamiento | TEXT | | No | |
| peso_kg | NUMERIC(5,2) | | No | CHECK > 0 |

**`vacunacion`**

| Columna | Tipo | PK/FK | Obligatorio | Restricciones |
|---|---|---|---|---|
| id_vacunacion | BIGINT IDENTITY | PK | Sí | |
| id_paciente | BIGINT | FK → paciente | Sí | ON DELETE RESTRICT |
| id_veterinario | UUID | FK → usuario | Sí | ON DELETE RESTRICT |
| id_producto | BIGINT | FK → producto | Sí | ON DELETE RESTRICT · CHECK: el producto debe ser de tipo 'vacuna' |
| id_consulta | BIGINT | FK → consulta | No | ON DELETE RESTRICT |
| fecha_aplicacion | DATE | | Sí | DEFAULT CURRENT_DATE |
| dosis | NUMERIC(6,2) | | Sí | CHECK > 0 |
| lote | VARCHAR(30) | | No | |

**`examen_laboratorio`**

| Columna | Tipo | PK/FK | Obligatorio | Restricciones |
|---|---|---|---|---|
| id_examen | BIGINT IDENTITY | PK | Sí | |
| id_paciente | BIGINT | FK → paciente | Sí | ON DELETE RESTRICT |
| id_veterinario | UUID | FK → usuario | Sí | ON DELETE RESTRICT |
| id_consulta | BIGINT | FK → consulta | No | |
| tipo_examen | VARCHAR(80) | | Sí | |
| fecha_solicitud | DATE | | Sí | DEFAULT CURRENT_DATE |
| fecha_resultado | DATE | | No | CHECK ≥ fecha_solicitud |
| resultado | TEXT | | No | |
| observacion | TEXT | | No | |

### 8.5 Inventario

**`producto`**

| Columna | Tipo | PK/FK | Obligatorio | Restricciones y valor por defecto |
|---|---|---|---|---|
| id_producto | BIGINT IDENTITY | PK | Sí | |
| codigo | VARCHAR(20) | | Sí | UNIQUE |
| nombre | VARCHAR(100) | | Sí | |
| tipo | VARCHAR(12) | | Sí | CHECK IN ('medicamento','insumo','vacuna') |
| presentacion | VARCHAR(60) | | No | |
| unidad_medida | VARCHAR(20) | | Sí | |
| nivel_minimo | NUMERIC(10,2) | | Sí | DEFAULT 0 · CHECK ≥ 0 |
| existencia_actual | NUMERIC(10,2) | | Sí | DEFAULT 0 · CHECK ≥ 0 · mantenida por *trigger* |
| precio_unitario | NUMERIC(10,2) | | Sí | CHECK ≥ 0 |
| activo | BOOLEAN | | Sí | DEFAULT TRUE |

**`movimiento_inventario`**

| Columna | Tipo | PK/FK | Obligatorio | Restricciones y valor por defecto |
|---|---|---|---|---|
| id_movimiento | BIGINT IDENTITY | PK | Sí | |
| id_producto | BIGINT | FK → producto | Sí | ON DELETE RESTRICT |
| tipo_movimiento | VARCHAR(10) | | Sí | CHECK IN ('ingreso','ajuste','consumo') |
| cantidad | NUMERIC(10,2) | | Sí | CHECK ≠ 0 · CHECK: positiva si es ingreso, negativa si es consumo |
| existencia_resultante | NUMERIC(10,2) | | Sí | CHECK ≥ 0 |
| fecha_hora | TIMESTAMPTZ | | Sí | DEFAULT now() |
| id_usuario | UUID | FK → usuario | Sí | ON DELETE RESTRICT |
| id_consulta | BIGINT | FK → consulta | No | |
| id_vacunacion | BIGINT | FK → vacunacion | No | |
| observacion | VARCHAR(150) | | No | |

> **Regla de integridad destacada:** un movimiento de tipo `consumo` debe indicar su origen —`id_consulta` o `id_vacunacion`—, y los movimientos de tipo `ingreso` y `ajuste` deben tener ambos vacíos. Se implementa con una restricción `CHECK` combinada. Esto impide que existan salidas de inventario sin una atención que las justifique, que es precisamente la consistencia exigida en la hoja "Plataforma de Desarrollo".

### 8.6 Facturación

**`factura`**

| Columna | Tipo | PK/FK | Obligatorio | Restricciones y valor por defecto |
|---|---|---|---|---|
| id_factura | BIGINT IDENTITY | PK | Sí | |
| numero | VARCHAR(15) | | Sí | UNIQUE |
| id_propietario | BIGINT | FK → propietario | Sí | ON DELETE RESTRICT |
| id_consulta | BIGINT | FK → consulta | No | UNIQUE — una atención no se factura dos veces |
| fecha_emision | TIMESTAMPTZ | | Sí | DEFAULT now() |
| subtotal | NUMERIC(10,2) | | Sí | CHECK ≥ 0 |
| impuesto | NUMERIC(10,2) | | Sí | DEFAULT 0 · CHECK ≥ 0 |
| total | NUMERIC(10,2) | | Sí | CHECK total = subtotal + impuesto |
| id_usuario_emisor | UUID | FK → usuario | Sí | ON DELETE RESTRICT |

**`detalle_factura`**

| Columna | Tipo | PK/FK | Obligatorio | Restricciones |
|---|---|---|---|---|
| id_detalle | BIGINT IDENTITY | PK | Sí | |
| id_factura | BIGINT | FK → factura | Sí | **ON DELETE CASCADE** — la línea no existe sin su factura |
| numero_linea | SMALLINT | | Sí | UNIQUE (id_factura, numero_linea) |
| id_producto | BIGINT | FK → producto | No | ON DELETE RESTRICT |
| descripcion | VARCHAR(120) | | Sí | |
| cantidad | NUMERIC(10,2) | | Sí | CHECK > 0 |
| precio_unitario | NUMERIC(10,2) | | Sí | CHECK ≥ 0 |
| subtotal_linea | NUMERIC(12,2) | | Sí | Columna generada: cantidad × precio_unitario |

**`pago`**

| Columna | Tipo | PK/FK | Obligatorio | Restricciones y valor por defecto |
|---|---|---|---|---|
| id_pago | BIGINT IDENTITY | PK | Sí | |
| id_factura | BIGINT | FK → factura | Sí | ON DELETE RESTRICT |
| fecha_pago | TIMESTAMPTZ | | Sí | DEFAULT now() |
| monto | NUMERIC(10,2) | | Sí | CHECK > 0 |
| forma_pago | VARCHAR(15) | | Sí | CHECK IN ('efectivo','tarjeta','transferencia') |
| referencia | VARCHAR(40) | | No | |
| id_usuario | UUID | FK → usuario | Sí | ON DELETE RESTRICT |

### 8.7 Reglas de integridad activa (triggers y vistas)

| Elemento | Qué hace | Por qué existe |
|---|---|---|
| `trg_actualizar_existencia` | Tras insertar un movimiento, recalcula `producto.existencia_actual` y escribe `existencia_resultante` | Impide que el saldo se desincronice del histórico. Debe estar en la base de datos y no en la aplicación: la hoja "Plataforma de Desarrollo" exige consistencia transaccional, y la SPA podría desconectarse a mitad de la operación. |
| `trg_vacunacion_descuenta` | Al registrar una vacunación, genera automáticamente el movimiento de consumo correspondiente | Materializa la relación `include` CU-3.2 → CU-4.3 y el flujo FI-1 del DFD. Al ejecutarse dentro de la misma transacción, o se registran ambas cosas o ninguna. |
| `trg_totales_factura` | Recalcula subtotal y total al insertar o modificar líneas | Evita que el encabezado y el detalle discrepen. |
| `v_historial_clinico` | Vista que unifica consultas, vacunaciones y exámenes de un paciente ordenados por fecha | Es la implementación de CU-3.4 y la razón por la que no se creó una tabla "historial". |
| `v_estado_factura` | Vista que calcula lo pagado y el saldo pendiente de cada factura | Evita almacenar un estado que podría quedar desactualizado. |
| `v_alerta_stock` | Vista que lista los productos cuya existencia es menor o igual a su nivel mínimo | Es la implementación de CU-4.5 sin almacenar alertas. |

### 8.8 Índices recomendados

Además de los que crean automáticamente las claves primarias y las restricciones de unicidad:

| Índice | Sobre | Para qué consulta |
|---|---|---|
| Por paciente y fecha | consulta, vacunacion, examen_laboratorio | Historial clínico (CU-3.4) |
| Por veterinario y fecha de inicio | cita | Consulta de agenda (CU-2.2) y verificación de disponibilidad (CU-2.5) |
| Por producto y fecha | movimiento_inventario | Kardex y auditoría de existencias |
| Por fecha de emisión | factura | Reporte de ingresos por período (CU-5.4) |
| Por propietario | paciente, factura | Búsqueda de ficha y de facturas del cliente |

---

# 9. Coherencia y trazabilidad

## 9.1 Coherencia entre los tres modelos

| Elemento | Conceptual | Lógico | Físico |
|---|---|---|---|
| Cantidad de entidades / tablas | 15 entidades | 15 tablas | 15 tablas |
| Relaciones | 26 relaciones | 26 claves foráneas | 26 restricciones FK |
| Relaciones N:M | Ninguna | Ninguna tabla puente | — |
| Identificadores | Implícitos | Claves sustitutas | IDENTITY / UUID |
| Opcionalidad (0..1) | Extremo opcional | FK que admite nulo | Columna NULL |
| Relación 1:0..1 | Cita → Consulta · Consulta → Factura | FK con UNIQUE | UNIQUE |

Los tres modelos describen la misma base de datos; solo cambia el nivel de detalle. Ninguna tabla del modelo físico carece de entidad en el conceptual, y ninguna entidad del conceptual desapareció al llegar al físico.

## 9.2 Trazabilidad con los artefactos anteriores

| Almacén del DFD | Tablas resultantes | Casos de uso que las utilizan |
|---|---|---|
| D1 Pacientes y Propietarios | propietario, paciente, especie, raza | CU-1.1 a CU-1.5 |
| D2 Agenda de Citas | cita | CU-2.1 a CU-2.5 |
| D3 Historial Clínico | consulta, vacunacion, examen_laboratorio | CU-3.1 a CU-3.4 |
| D4 Inventario | producto, movimiento_inventario | CU-4.1 a CU-4.5 |
| D5 Facturas y Pagos | factura, detalle_factura, pago | CU-5.1 a CU-5.4 |
| D6 Usuarios y Credenciales | usuario, rol | CU-0.1 |

Los flujos entre procesos del DFD también tienen correspondencia directa:

| Flujo del DFD | Cómo se implementa en la base de datos |
|---|---|
| FI-1 · Solicitud de descuento por vacuna aplicada | Inserción en `movimiento_inventario` con `id_vacunacion`, disparada por `trg_vacunacion_descuenta` |
| FI-2 · Confirmación de descuento y datos del producto | La misma transacción; si el descuento falla, la vacunación no se registra |
| CU-5.1 `include` CU-3.4 | `factura.id_consulta` permite recuperar lo realizado en la atención |

## 9.3 Inconsistencias detectadas y resueltas

| Inconsistencia | Análisis | Resolución |
|---|---|---|
| La hoja "Plataforma de Desarrollo" indica **PostgreSQL**; el artefacto 11 del "Resumen de artefactos" menciona **MySQL 8.0** | La hoja de plataforma es la fuente específica sobre tecnología y es coherente con el resto del stack (Supabase se apoya en PostgreSQL). | Se diseña para **PostgreSQL**. Si finalmente se usara MySQL, los cambios serían menores: `AUTO_INCREMENT` en lugar de `IDENTITY`, `DATETIME` en lugar de `TIMESTAMPTZ`, `CHAR(36)` en lugar de `UUID`, y la restricción de solapamiento de citas debería implementarse con *trigger* en vez de `EXCLUDE`. |
| El documento de arquitectura dice que un *trigger* "deja registrada la alerta" de stock mínimo | Almacenar la alerta obliga a eliminarla al reponer el stock, y una alerta olvidada da información falsa. | La alerta se **deriva** mediante la vista `v_alerta_stock`. La frase del artefacto 4 debe leerse como "genera y presenta la alerta", no como que la persiste. |
| El almacén D6 del DFD no recibe ninguna escritura | La gestión de usuarios está fuera del alcance y la autenticación es nativa de la plataforma. | Las tablas `usuario` y `rol` existen y se pueblan como **datos iniciales de configuración**, no mediante un caso de uso. Coherente con lo documentado en el DFD. |
| Los casos de uso hablan de "cancelar" citas y el DFD de "liberar el horario" | Podría interpretarse como eliminación del registro. | Se implementa como **cambio de estado**, no como borrado. El horario queda libre porque la restricción de solapamiento solo considera las citas no canceladas. |
| El alcance menciona "edad" de la mascota entre los datos a registrar | Almacenar la edad obliga a mantenerla actualizada. | Se almacena `fecha_nacimiento` y la edad se **calcula**. El dato solicitado sigue estando disponible. |

## 9.4 Verificación final de la estructura

| Criterio | Resultado |
|---|---|
| Toda la información de los casos de uso tiene dónde almacenarse | ✔ Sección 4, tabla de verificación |
| Todos los flujos del DFD son soportados | ✔ Sección 9.2 |
| No se perdió información durante la normalización | ✔ Las 16 necesidades siguen cubiertas |
| No quedan dependencias parciales | ✔ Ninguna tabla tiene clave primaria compuesta |
| No quedan dependencias transitivas | ✔ Resueltas en 3.3; las dos excepciones están justificadas en 3.5 |
| Todas las tablas tienen clave primaria | ✔ 15 de 15 |
| Todas las relaciones tienen clave foránea con regla de borrado definida | ✔ RESTRICT salvo `detalle_factura`, que usa CASCADE por dependencia total |
| No hay tablas sin necesidad que las respalde | ✔ Sección 4 |
| No se inventaron funcionalidades fuera del alcance | ✔ Sección 5, último párrafo |
