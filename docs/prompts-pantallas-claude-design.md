# Prompts para Claude Design — ShowroomCiro

# Prompts para Claude Design — ShowroomCiro

> **Nota:** estos son los prompts originales de creación (Fase 3). Después del primer prototipo se aplicó una ronda de ajustes — ver `ajustes-fase3-claude-design.md` para los cambios post-prototipo (Cuentas en vez de Fiados, sin campanita, sin ítem "Ventas" en el menú, logout, pantalla Configuración mobile). Los textos de abajo quedan como referencia histórica de la primera versión.

**Cómo usar este documento:** para cada pantalla, copiá el texto dentro del bloque y pegalo en Claude Design junto con el archivo `contexto-diseno-showroomciro.md` adjunto. Están ordenados siguiendo el flujo real del sistema.

---

## 1. Login

```
Diseñá la pantalla de Login del sistema de gestión ShowroomCiro (tienda de ropa).

Contenido:
- Logo/nombre "ShowroomCiro" centrado o a un costado, con espacio reservado para un logo futuro (por ahora usar el nombre en tipografía de marca).
- Campo "Usuario" y campo "Contraseña" (sin email).
- Botón principal "Ingresar".
- Sin opción de "recuperar contraseña" visible por ahora (es un sistema interno de un solo local).
- Layout simple, centrado, con la calidez de la paleta — que no se sienta como un login corporativo genérico.

Seguí estrictamente la paleta y tipografía del archivo de contexto adjunto.
```

---

## 2. Apertura de Caja (pantalla bloqueante post-login)

```
Diseñá la pantalla de Apertura de Caja de ShowroomCiro. Aparece obligatoriamente después del login y antes de poder acceder al resto del sistema (si la caja del día aún no fue abierta).

Contenido:
- Título claro: "Apertura de Caja".
- Campo para ingresar el monto inicial en efectivo.
- Texto de apoyo indicando fecha y usuario que abre la caja.
- Botón principal "Abrir Caja" que desbloquea el resto del sistema.
- Sensación de paso obligatorio pero breve, no una pantalla pesada — el usuario quiere pasar rápido a vender.

Seguí la paleta y tipografía del archivo de contexto adjunto.
```

---

## 3. Dashboard / Inicio

```
Diseñá el Dashboard/Inicio del sistema ShowroomCiro, con sidebar lateral fijo (según el archivo de contexto) y esta pantalla como contenido principal.

Contenido:
- KPIs del día en cards destacadas: "Ventas de hoy" (monto total), "Caja actual" (efectivo esperado en caja).
- Panel de Alertas con dos tipos, visualmente diferenciados por color: alertas de "Stock bajo" (color de advertencia) y "Fiados por vencer/vencidos" (diferenciando por vencer de vencido con los colores correspondientes del contexto).
- Accesos rápidos a las acciones más usadas: "Nueva Venta" y "Nuevo Fiado" como botones destacados.
- Header superior con nombre de la tienda, ícono de notificaciones con badge, y usuario logueado.

Seguí estrictamente la paleta, tipografía y reglas de layout del archivo de contexto adjunto.
```

---

## 4. Ventas (POS) — pantalla principal

```
Diseñá la pantalla de Ventas (Punto de Venta) de ShowroomCiro, con sidebar lateral fijo.

Contenido:
- Buscador arriba de todo, por nombre de producto o SKU.
- Debajo, una grilla visual de productos tipo catálogo: cada card con foto del producto, nombre y precio. Organizada por categorías (con filtro/tabs de categoría arriba de la grilla).
- Carrito lateral (a la derecha) mostrando los ítems agregados con talle/color elegido, cantidad, subtotal por ítem, y total general.
- Botón destacado "Cobrar" al pie del carrito.
- Mostrá el estado con 2-3 productos ya agregados al carrito como ejemplo.

Seguí estrictamente la paleta y tipografía del archivo de contexto adjunto.
```

---

## 5. Modal — Selección de Variante (talle/color)

```
Diseñá un modal/popup que aparece al hacer clic en un producto dentro de la pantalla de Ventas de ShowroomCiro, para elegir la variante antes de agregarlo al carrito.

Contenido:
- Foto grande del producto arriba, nombre y precio.
- Selector de Talle (chips/botones: S, M, L, XL) mostrando cuáles tienen stock disponible y cuáles no (deshabilitados o tachados).
- Selector de Color (chips con el color o nombre del color) con la misma lógica de disponibilidad.
- Indicador de stock disponible para la combinación talle+color elegida.
- Selector de cantidad.
- Botón "Agregar al carrito".

Seguí la paleta y tipografía del archivo de contexto adjunto. El modal debe verse flotando sobre un fondo oscurecido.
```

---

## 6. Checkout — Confirmar Venta

```
Diseñá la pantalla/modal de Checkout de ShowroomCiro, donde se confirma una venta ya armada en el carrito.

Contenido:
- Resumen de los ítems de la venta con el total a pagar bien destacado.
- Selector de medio de pago: Efectivo, Transferencia/QR, Tarjeta — como opciones tipo tarjeta/botón grande y clara.
- Una opción adicional, visualmente distinta (separada, ej. con un divisor y color de advertencia sutil): "Marcar como Fiado" — que despliega campos de nombre y teléfono del cliente si no existe aún, y fecha límite de pago.
- Botón final "Confirmar Venta".
- Mensaje de confirmación de éxito con opción "Imprimir ticket".

Seguí la paleta y tipografía del archivo de contexto adjunto.
```

---

## 7. Productos — Listado

```
Diseñá la pantalla de Listado de Productos de ShowroomCiro, con sidebar lateral fijo.

Contenido:
- Tabla o grid de productos mostrando: foto miniatura, nombre, categoría, precio, stock total (suma de variantes), y estado (Activo/Inactivo con color correspondiente).
- Filtros arriba: por categoría y por estado.
- Buscador por nombre o SKU.
- Botón destacado "+ Nuevo Producto" arriba a la derecha.
- Acciones por fila: Editar y Dar de baja (ícono o menú de tres puntos).

Seguí la paleta y tipografía del archivo de contexto adjunto.
```

---

## 8. Productos — Alta / Edición (formulario en 2 pasos)

```
Diseñá el formulario de Alta de Producto de ShowroomCiro, en dos pasos dentro de una misma pantalla o wizard.

Paso 1 — Datos generales:
- Campos: Nombre, Descripción, Categoría (selector), Precio, y un uploader de foto del producto.

Paso 2 — Variantes (talle y color):
- Interfaz para agregar múltiples combinaciones de Talle + Color, cada una con su stock inicial.
- Mostrar una tabla/lista de las variantes ya agregadas con su SKU autogenerado (ej. "SC-001-AZ-M"), talle, color y stock.
- Botón "+ Agregar variante".

Botones de navegación entre pasos ("Atrás" / "Siguiente") y botón final "Guardar Producto".

Seguí la paleta y tipografía del archivo de contexto adjunto.
```

---

## 9. Stock — Ajuste rápido

```
Diseñá un modal/panel de Ajuste de Stock de ShowroomCiro, para sumar o restar stock de una variante puntual (ej. reposición o merma).

Contenido:
- Datos de la variante seleccionada (foto, nombre, talle, color, stock actual).
- Selector de tipo de ajuste: "Sumar stock" o "Restar stock".
- Campo de cantidad.
- Campo opcional de motivo (ej. "Reposición", "Merma/rotura", "Corrección").
- Botón "Confirmar ajuste".

Seguí la paleta y tipografía del archivo de contexto adjunto.
```

---

## 10. Fiados — Agenda (lista + calendario)

```
Diseñá la pantalla de Fiados (Agenda de Deudores) de ShowroomCiro, con sidebar lateral fijo.

Contenido:
- Un toggle arriba para cambiar entre "Vista Lista" y "Vista Calendario".
- Vista Lista (mostrar esta como principal): tabla con Cliente, Teléfono, Monto adeudado, Fecha límite de pago, y Estado (Al día / Por vencer / Vencido) diferenciado con los colores del contexto (oliva, coral, vino respectivamente).
- Vista Calendario (referenciarla como alternativa, con un mini-preview): calendario mensual con los fiados marcados en el día de su vencimiento.
- Botón "+ Nuevo Fiado" destacado.
- Buscador por nombre de cliente.

Seguí la paleta y tipografía del archivo de contexto adjunto.
```

---

## 11. Fiados — Detalle / Cobro

```
Diseñá la pantalla/modal de Detalle de un Fiado en ShowroomCiro.

Contenido:
- Datos del cliente (nombre, teléfono).
- Monto total adeudado y fecha límite de pago, bien visibles.
- Historial de abonos/cobros parciales realizados hasta el momento (si los hay), con fecha y monto de cada uno.
- Campo para registrar un nuevo cobro/abono, con opción de marcar si es pago total o parcial.
- Botón "Registrar Cobro".

Seguí la paleta y tipografía del archivo de contexto adjunto.
```

---

## 12. Caja — Cierre

```
Diseñá la pantalla de Cierre de Caja de ShowroomCiro.

Contenido:
- Resumen de lo esperado en caja según las ventas del día (efectivo, transferencia, tarjeta desglosados).
- Campo para ingresar el conteo real de efectivo físico.
- Cálculo automático de la diferencia entre lo esperado y lo contado, destacado con color según sea positiva, negativa o exacta (usando los colores del contexto).
- Botón "Cerrar Caja".

Seguí la paleta y tipografía del archivo de contexto adjunto.
```

---

## 13. Caja — Historial

```
Diseñá la pantalla de Historial de Caja de ShowroomCiro, con sidebar lateral fijo.

Contenido:
- Tabla con: Fecha, Usuario que abrió, Usuario que cerró, Monto inicial, Monto esperado, Monto contado, Diferencia (coloreada según corresponda).
- Filtro por rango de fechas.
- Posibilidad de hacer clic en una fila para ver el detalle completo de esa jornada.

Seguí la paleta y tipografía del archivo de contexto adjunto.
```

---

## 14. Reportes (solo Dueño/a)

```
Diseñá la pantalla de Reportes de ShowroomCiro, con sidebar lateral fijo. Esta pantalla solo la ve el rol Dueño/a.

Contenido:
- Selector de período: Día / Semana / Mes.
- Gráfico de ventas a lo largo del período seleccionado.
- Ranking/lista de "Productos más vendidos" con cantidad vendida.
- Card o sección de "Fiados pendientes de cobro": total adeudado y cantidad de fiados próximos a vencer.

Seguí la paleta y tipografía del archivo de contexto adjunto. Los gráficos deben usar la paleta cálida del contexto (canela, oliva, coral) en vez de colores genéricos de gráfico.
```

---

## 15. Gestión de Usuarios (solo Dueño/a)

```
Diseñá la pantalla de Gestión de Usuarios de ShowroomCiro, con sidebar lateral fijo. Solo la ve el rol Dueño/a.

Contenido:
- Tabla con los Vendedores dados de alta: Nombre de usuario, Nombre completo, Estado (Activo/Inactivo).
- Botón "+ Nuevo Vendedor" que abre un formulario simple: Nombre completo, Nombre de usuario, Contraseña.
- Acción de desactivar un usuario existente.

Seguí la paleta y tipografía del archivo de contexto adjunto.
```

---

## 16. Vista Mobile — Shell de navegación (acceso remoto del Dueño/a, solo consulta)

```
Diseñá la vista mobile del sistema ShowroomCiro para el acceso remoto de solo consulta del Dueño/a, mostrando el Dashboard como pantalla de ejemplo.

Contenido:
- Menú inferior fijo tipo app con 4 íconos: Dashboard, Ventas, Fiados, Reportes. Las 4 secciones son de solo consulta/lectura (no hay flujo de venta ni de cobro desde el celular).
- Contenido de la pantalla Dashboard adaptado a mobile: KPIs del día apilados verticalmente (Ventas de hoy, Caja actual) y panel de alertas debajo (stock bajo, fiados por vencer).
- Header simple arriba con el nombre "ShowroomCiro" y el ícono de notificaciones.

Formato mobile (viewport angosto, ~390px de ancho). Seguí la paleta y tipografía del archivo de contexto adjunto.
```
