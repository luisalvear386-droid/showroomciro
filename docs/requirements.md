# Requisitos — Sistema de Gestión para Tienda de Ropa (v1)

## 1. Contexto del negocio
- Nombre de la tienda: **ShowroomCiro**.
- Un (1) local físico, sin planes de venta online en esta versión.
- Uso principal en una computadora/notebook fija en el mostrador.
- El dueño/a necesita también consultar ventas y stock **de forma remota** desde el celular (solo consulta, no venta) → el sistema debe ser una **aplicación web responsive** (no una app de escritorio cerrada), accesible desde PC y desde el navegador del celular.

## 2. Roles y permisos

| Acción | Dueño/a | Vendedor |
|---|---|---|
| Vender (caja/POS) | ✅ | ✅ |
| Cargar / ajustar stock | ✅ | ✅ |
| Ver reportes de ventas y ganancias | ✅ | ❌ |
| Ver costos de productos | ✅ | ❌ |
| Dar de alta / gestionar / dar de baja productos y categorías | ✅ | ✅ |
| Abrir/cerrar caja | ✅ | ✅ (con registro de quién la operó) |
| Gestionar usuarios (altas de vendedores) | ✅ (también desde el celular, única excepción al "solo consulta" remoto) | ❌ |
| Registrar cuentas y cobrar/abonar cuentas | ✅ | ✅ |

## 3. Módulo de Productos e Inventario
- Cada producto maneja **variantes por talle Y color** (ej: Remera modelo X → Azul/M, Azul/L, Negro/M...).
- Como no hay lector de código de barras, el sistema **genera un SKU interno automático** por cada variante.
- Stock se controla por variante (no por producto general).
- **Alertas de stock bajo** por variante, con umbral configurable.
- Categorías de producto (para poder reportar y filtrar).
- El alta de productos nuevos y la carga/ajuste de stock puede hacerla tanto el Dueño/a como el Vendedor.

## 4. Módulo de Ventas (Punto de Venta)
- Medios de pago: efectivo, transferencia/QR, tarjeta débito/crédito (posnet).
- Venta rápida por variante (talle + color), pensada para uso ágil en mostrador.
- Ventas **anónimas** — no se registra ficha de cliente en v1.
- **Cambios/devoluciones**: se gestionan con nota de crédito o cambio directo por otro talle/color (no devolución de dinero en efectivo).
- El checkout de una venta **no incluye la opción de fiado** — las cuentas (fiados) se abren de forma independiente desde el módulo de Cuentas (sección 5), no como parte del flujo de venta.

## 5. Módulo de Cuentas (Agenda de Clientes Deudores)
- Se conoce como **"Cuentas"** en toda la interfaz (antes "Fiados" internamente).
- Se abre una cuenta de forma independiente al flujo de venta — no está atada a una venta puntual del POS.
- Se crea una **ficha mínima de cliente** únicamente al abrir una cuenta: nombre y teléfono (no hay base de clientes general, es exclusiva de cuentas).
- Por cada cuenta se registra: cliente, monto adeudado, fecha límite de pago.
- **Agenda/listado** de cuentas activas, ordenable por fecha de vencimiento.
- **Alerta visual** cuando una cuenta se acerca o vence su fecha límite de pago, mostrada como badge numérico en el ítem "Cuentas" del menú de navegación y en el panel de Alertas del Dashboard (sin ícono de notificaciones separado — ver sección 8).
- Registro de cobros/abonos contra el saldo adeudado (pago parcial o total).
- Tanto el Dueño/a como el Vendedor pueden abrir cuentas nuevas y cargar cobros/abonos.

## 6. Módulo de Caja
- **Apertura de caja**: registro de monto inicial.
- **Cierre de caja**: conteo de efectivo físico + cálculo automático de diferencia vs. lo esperado según ventas del día.
- Historial de aperturas/cierres por día y por usuario.

## 7. Reportes y Estadísticas (solo Dueño/a)
- Ventas por día / semana / mes.
- Productos más vendidos.
- Cuentas pendientes de cobro (total adeudado, próximas a vencer).
- (Ganancia neta y análisis por talle/color/categoría quedan como posible ampliación post-v1, no fueron priorizados).

## 8. Acceso y plataforma
- Aplicación web responsive.
- Uso normal: computadora del mostrador.
- Uso remoto (Dueño/a, desde el celular): **solo consulta** de ventas/stock/reportes/cuentas. No permite registrar ventas ni operar caja desde el celular — esas acciones quedan atadas al mostrador físico. Decisión tomada para eliminar el riesgo de venta concurrente/doble descuento de stock entre el mostrador (que puede operar offline) y el celular.
- **Excepción explícita:** la gestión de usuarios (alta/baja de Vendedores) sí puede hacerse desde el celular, dentro de una sección "Configuración" — no tiene el riesgo de concurrencia que motivó restringir las ventas remotas.
- No hay ícono/campanita de notificaciones separado en el header. Las alertas (stock bajo, cuentas por vencer) se muestran directamente en el panel de Alertas del Dashboard y como badge numérico en el ítem "Cuentas" del menú.

## 9. Sesión y navegación
- El usuario logueado (nombre + rol) se muestra en el header, arriba a la derecha, y es clickeable: al hacer clic despliega la opción **"Cerrar sesión"**.
- **Cierre de sesión automático:** al confirmar el Cierre de Caja, el sistema cierra la sesión del usuario automáticamente y vuelve a la pantalla de Login (representa el cierre del local/turno).
- El menú de navegación **no incluye una sección persistente "Ventas"** — la pantalla de Ventas (POS) se accede únicamente a través del botón de acción "Nueva Venta" (Dashboard), y al confirmar una venta se vuelve automáticamente al Dashboard.
- Menú de navegación (desktop): Dashboard, Productos, Caja, **Cuentas**, Reportes, Usuarios (Dueño/a).
- Menú de navegación (mobile, acceso remoto): Dashboard, **Cuentas**, Reportes, **Configuración** (con Gestión de Usuarios dentro).

## 10. Fuera de alcance en v1 (explícitamente descartado o pospuesto)
- ❌ Base general de clientes / historial de compras (fuera del caso de cuentas).
- ❌ Venta online / e-commerce.
- ❌ Múltiples sucursales.
- ❌ Lector de código de barras (posible integración futura sobre el SKU interno).
- ❌ Módulo de proveedores (no se gestionan proveedores en el sistema en v1).

---
**Estado: Requisitos, Diseño (UI/UX + arquitectura) y prototipado en Claude Design APROBADOS. En ajustes puntuales post-prototipo antes de pasar a la Fase 4 (tasks.md).**
