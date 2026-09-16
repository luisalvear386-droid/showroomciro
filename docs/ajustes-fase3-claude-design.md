# Prompts de Ajuste — Claude Design (Ronda post-prototipo)

**Cómo usar este documento:** son prompts de **edición** sobre las 16 pantallas que ya construiste, no de creación desde cero. Pegalos en Claude Design sobre cada pantalla ya existente (por nombre de archivo/pantalla). Empezá por el "Cambio Global" y después aplicá los específicos por pantalla.

---

## 🔁 Cambio Global — Menú de navegación (desktop)

**Aplicar en:** Dashboard ShowroomCiro, Caja Cierre, Caja Historial, Fiados Agenda, Producto Alta, Productos Listado, Reportes, Usuarios, Ventas POS (todas las pantallas que tienen sidebar).

```
En el menú de navegación de la sidebar, hacé estos dos cambios:
1. Eliminá el ítem "Ventas" de la lista por completo. Ya no es una sección persistente del menú — la pantalla de Venta se accede únicamente desde el botón de acción "Nueva Venta" del Dashboard, y al confirmar una venta se vuelve automáticamente al Dashboard.
2. Renombrá el ítem "Fiados" a "Cuentas" (mantené el badge numérico de alerta que ya tiene).

Aplicá este mismo cambio de forma idéntica en todas las pantallas que comparten esta sidebar, para que el menú quede consistente en todo el sistema.
```

---

## 🔁 Cambio Global — Eliminar campanita de notificaciones

**Aplicar en:** Dashboard ShowroomCiro, Fiados Agenda, Mobile Dashboard, Productos Listado, Ventas POS.

```
En el header, eliminá el botón/ícono de campana de notificaciones (el botón cuadrado con el ícono de campana y el badge numérico rojo) que está al lado del bloque de usuario. Las alertas del sistema ya se muestran en el panel de Alertas del Dashboard y en el badge del ítem "Cuentas" del menú, así que no hace falta este ícono por ahora.
```

---

## 🔁 Cambio Global — Cerrar sesión desde el nombre de usuario

**Aplicar en:** todas las pantallas desktop con header (mismas que el primer cambio global).

```
Hacé que el bloque de usuario en el header (el círculo con la inicial + nombre + rol, arriba a la derecha) sea clickeable. Al hacer clic, debe desplegar un pequeño menú/dropdown con una sola opción: "Cerrar sesión". Usá un estilo simple y consistente con la paleta del sistema (fondo crema hueso, texto marrón cacao, hover en canela).
```

---

## 1. Dashboard ShowroomCiro

```
Sobre la pantalla de Dashboard ya construida, aplicá estos cambios puntuales:
1. Renombrá el botón "Nuevo Fiado" a "Nueva Cuenta" (mismo estilo, mismo lugar, junto al botón "Nueva Venta").
2. Aplicá los tres Cambios Globales de este documento (menú sin "Ventas" y con "Cuentas", sin campanita, usuario clickeable con "Cerrar sesión").
```

---

## 2. Checkout Venta

```
Sobre la pantalla de Checkout de Venta ya construida, eliminá por completo la sección/opción "Marcar como fiado" (incluyendo los campos de nombre y teléfono de cliente que se despliegan al activarla). El checkout debe quedar únicamente con el resumen de la venta, el total, y la selección de medio de pago: Efectivo, Transferencia/QR, Tarjeta. Las cuentas (fiados) ahora se abren de forma independiente desde la sección "Cuentas", no desde acá.
```

---

## 3. Fiados Agenda → Cuentas Agenda

```
Sobre esta pantalla ya construida, aplicá estos cambios:
1. Renombrá el título de la pantalla de "Fiados" a "Cuentas", y cualquier otro texto visible que diga "fiado/fiados" a "cuenta/cuentas" (ej. botón "+ Nuevo Fiado" → "+ Nueva Cuenta").
2. Aplicá los tres Cambios Globales de este documento.
```

---

## 4. Fiado Detalle → Cuenta Detalle

```
Sobre esta pantalla ya construida, renombrá el título y cualquier texto visible de "Fiado" a "Cuenta" (ej. "Detalle de Fiado" → "Detalle de Cuenta"). El contenido y la funcionalidad (datos del cliente, monto adeudado, historial de abonos, registrar cobro) se mantienen igual.
```

---

## 5. Caja Cierre

```
Sobre la pantalla de Cierre de Caja ya construida:
1. Aplicá los tres Cambios Globales de este documento.
2. Agregá un texto de aviso breve cerca del botón "Cerrar Caja", indicando que al confirmar se cerrará la sesión automáticamente (ej. "Al cerrar la caja, tu sesión se cerrará automáticamente").
```

---

## 6. Productos Listado, Producto Alta, Caja Historial, Reportes, Usuarios, Ventas POS

```
Sobre esta pantalla ya construida, aplicá únicamente los Cambios Globales que correspondan de este documento (menú de navegación sin "Ventas" y con "Cuentas" en vez de "Fiados"; eliminar campanita si la tiene; usuario del header clickeable con opción "Cerrar sesión"). No hay otros cambios de contenido para esta pantalla.
```

---

## 7. Mobile Dashboard

```
Sobre la pantalla de Dashboard mobile ya construida, aplicá estos cambios:
1. Eliminá el ícono de campana de notificaciones del header.
2. Actualizá el menú inferior de navegación: en vez de "Dashboard, Ventas, Fiados, Reportes", debe quedar "Dashboard, Cuentas, Reportes, Configuración" (4 secciones).
3. Hacé que el bloque de usuario del header sea clickeable con opción "Cerrar sesión", igual que en desktop.
```

---

## 9. Fiados Agenda → Cuentas Agenda (ajuste adicional)

```
Sobre esta pantalla ya construida, eliminá el botón "+ Nueva Cuenta" (o "+ Nuevo Fiado") que tiene la propia pantalla de Agenda. Esa acción ya existe en el Dashboard ("Nueva Cuenta") y no hace falta repetirla acá.
```

---

## 10. Cuenta Nueva (Alta) — pantalla nueva

```
Diseñá una nueva pantalla de ShowroomCiro: "Nueva Cuenta", a la que dirige el botón "Nueva Cuenta" del Dashboard. Con sidebar lateral fijo (mismo layout que el resto de las pantallas desktop).

Contenido:
- Título "Nueva Cuenta".
- Formulario simple con los datos del cliente que se lleva algo fiado:
  - Nombre del cliente.
  - Teléfono del cliente.
  - Monto adeudado.
  - Fecha límite de pago (selector de fecha).
- Botón principal "Guardar Cuenta", que al confirmar debe volver automáticamente al Dashboard (mismo patrón que al confirmar una venta).
- Botón secundario "Cancelar" que vuelve al Dashboard sin guardar.

Seguí la paleta y tipografía del archivo de contexto adjunto (contexto-diseno-showroomciro.md).
```

---

## 11. Configuración (mobile) — pantalla nueva

```
Diseñá una nueva pantalla mobile "Configuración" para el sistema ShowroomCiro, con el mismo menú inferior de navegación que el Dashboard mobile (Dashboard, Cuentas, Reportes, Configuración — con "Configuración" activo/seleccionado).

Contenido:
- Título "Configuración".
- Una lista de opciones tipo menú, empezando con una sola disponible por ahora: "Gestionar Usuarios" (con un ícono simple y una flecha indicando que lleva a otra pantalla).
- Dejá espacio visual para que en el futuro se agreguen más opciones debajo (aunque no las diseñes todavía).
- Al tocar "Gestionar Usuarios", debería llevar a una versión mobile de la gestión de usuarios: listado de Vendedores con su estado, botón "+ Nuevo Vendedor" y la posibilidad de desactivar un usuario — mismo alcance funcional que la versión desktop (esta es la única sección del sistema donde el celular SÍ permite realizar acciones, no solo consultar).

Seguí la paleta y tipografía del archivo de contexto adjunto (contexto-diseno-showroomciro.md). Formato mobile, viewport angosto (~390px).
```
