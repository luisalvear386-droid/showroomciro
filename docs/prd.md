# PRD — ShowroomCiro
Documento de requerimientos del producto, pensado para referenciar en pruebas E2E (`@docs/prd.md` en TestSprite).

## Producto
Sistema de gestión interno para ShowroomCiro, tienda de ropa de un local físico único. Roles: **Dueño/a** y **Vendedor**.

## Historias de usuario

### Autenticación y sesión
- Como Vendedor o Dueño/a, quiero iniciar sesión con usuario y contraseña para acceder al sistema según mi rol.
- Como usuario logueado, quiero poder cerrar sesión haciendo clic en mi nombre en el header.
- Como Dueño/a o Vendedor, al confirmar el Cierre de Caja quiero que mi sesión se cierre automáticamente.

### Apertura y cierre de caja
- Como Vendedor o Dueño/a, quiero que el sistema me exija abrir la caja (con un monto inicial) antes de poder registrar cualquier venta.
- Como Vendedor o Dueño/a, quiero cerrar la caja contando el efectivo físico y ver la diferencia calculada automáticamente contra lo esperado.
- Como Dueño/a, quiero ver el historial de aperturas y cierres de caja pasados.

### Productos e inventario
- Como Vendedor o Dueño/a, quiero dar de alta un producto con nombre, descripción, categoría, precio y foto.
- Como Vendedor o Dueño/a, quiero cargar variantes de talle y color para un producto, con su stock inicial, y que el sistema genere el SKU automáticamente.
- Como Vendedor o Dueño/a, quiero ajustar el stock de una variante puntual (sumar o restar), indicando el motivo.
- Como Vendedor o Dueño/a, quiero ver una alerta cuando el stock de una variante esté bajo.
- Como Vendedor o Dueño/a, quiero poder dar de baja un producto.

### Ventas (POS)
- Como Vendedor o Dueño/a, quiero iniciar una nueva venta desde el Dashboard y elegir productos de una grilla visual con foto.
- Como Vendedor o Dueño/a, quiero elegir talle y color de un producto antes de agregarlo al carrito, viendo el stock disponible de esa combinación.
- Como Vendedor o Dueño/a, quiero confirmar la venta eligiendo un medio de pago (efectivo, transferencia/QR o tarjeta).
- Como Vendedor o Dueño/a, quiero que al confirmar la venta se imprima un ticket y vuelva automáticamente al Dashboard.
- Como Vendedor o Dueño/a, quiero poder seguir vendiendo aunque se corte la conexión a internet, y que esas ventas se sincronicen solas al recuperar conexión.

### Cuentas (clientes deudores / fiado)
- Como Vendedor o Dueño/a, quiero abrir una cuenta nueva desde el Dashboard, cargando nombre y teléfono del cliente, el monto adeudado y la fecha límite de pago.
- Como Vendedor o Dueño/a, quiero ver la agenda de cuentas activas, en lista o en calendario según su fecha de vencimiento.
- Como Vendedor o Dueño/a, quiero registrar un cobro o abono parcial sobre una cuenta existente.
- Como Vendedor o Dueño/a, quiero ver una alerta visual cuando una cuenta esté por vencer o ya vencida.

### Reportes (solo Dueño/a)
- Como Dueño/a, quiero ver las ventas del día, la semana y el mes.
- Como Dueño/a, quiero ver los productos más vendidos en un período.
- Como Dueño/a, quiero ver el ticket promedio (total vendido ÷ cantidad de ventas) del período seleccionado.
- Como Dueño/a, quiero ver el total adeudado en cuentas pendientes y cuántas están por vencer.

### Usuarios
- Como Dueño/a, quiero dar de alta nuevos Vendedores con su propio usuario y contraseña.
- Como Dueño/a, quiero poder desactivar un Vendedor.

### Acceso remoto (mobile, solo Dueño/a)
- Como Dueño/a, quiero consultar desde mi celular el Dashboard, las Cuentas y los Reportes, sin poder vender ni operar caja desde ahí.
- Como Dueño/a, quiero poder gestionar usuarios (alta/baja de Vendedores) desde la sección Configuración de mi celular — es la única acción real permitida en mobile.

## Fuera de alcance (no probar / no implementar en v1)
- Base general de clientes o historial de compras fuera de Cuentas.
- Venta online / e-commerce.
- Múltiples sucursales.
- Lector de código de barras.
- Módulo de proveedores.
- Registrar ventas u operar caja desde el celular.
