# ShowroomCiro · Plan v2 (camino a producción en Ciro Rey)

> Alcance acordado el 17/11/2026. Reemplaza al Módulo 12 y al "próximo módulo" de tasks.md.
> Todo lo que no figura acá queda **fuera de alcance por ahora**: multi-cliente, factura electrónica, requisitos técnicos de producción (entornos, backups, monitoreo, CI), integración con Mercado Pago, código de barras, descuentos, precios por medio de pago, señas, ticket digital, varias cajas, recordatorios por WhatsApp y todas las funciones avanzadas.

---

## Decisiones de negocio (fuente de verdad)

| Tema | Decisión |
|---|---|
| Medios de pago | **Efectivo, débito, transferencia y QR de Mercado Pago.** Se saca el crédito. |
| QR de Mercado Pago | **Manual.** El cliente escanea el QR fijo del local y el vendedor marca "QR MP". Sin integración. |
| Pago dividido | Una venta puede tener varios pagos con distintos medios. La suma de los pagos tiene que ser igual al total. |
| Devoluciones | **Se devuelve el dinero, siempre en efectivo y desde la caja abierta**, sin importar con qué medio se pagó. **No hay saldo a favor ni vales.** |
| Cambios | Si la prenda nueva es más cara, se cobra la diferencia con cualquier medio. Si es más barata, la diferencia se devuelve en efectivo. |
| Precios | Un solo precio por producto (no varía según el medio de pago). Sin descuentos. |
| Permisos finos | Un solo permiso configurable: **"Puede editar precios"**, por usuario Vendedor y lo activa el Dueño/a. El resto de los permisos del Vendedor no cambia. |
| Migración de medios | Las ventas guardadas con "tarjeta" se migran a `debito`. (Al 17/11/2026 la base tiene 0 ventas.) |
| Cobros de cuentas | `cuenta_pagos` guarda **medio de pago** (los mismos 4 medios) y **caja**. Cobrar una cuenta **exige caja abierta**, y los cobros en efectivo **suman al efectivo esperado** del cierre. |
| Email del Dueño/a | El Dueño/a tiene **email real** y puede usar "Olvidé mi contraseña". Los Vendedores siguen con emails internos (`<usuario>@showroomciro.internal`) y solo los resetea el Dueño/a. |
| Prueba en dispositivo real | Solo celular. ⚠️ La impresora térmica queda sin probar (ver Riesgos). |

---

## Fases

### Fase 0 · Cierre y arreglos rápidos
- **0.1** Commit del retiro del modo offline (trabajo pendiente).
- **0.2** Aplicar la migración 0013 en Supabase *(punto 35)*.
- **0.3** Venta duplicada: conservar el `id` de la venta cuando falla y no generar uno nuevo aunque cambie el carrito, hasta que se confirme o se cancele a propósito. Revisar `ventas-page.tsx:155` *(punto 32)*.
- **0.4** Confirmación antes de "Dar de baja" un producto *(punto 33)*.

### Fase 1 · Usuarios y control
- **1.1 Auditoría** *(punto 21)*: tabla `auditoria` (quién, cuándo, acción, entidad, id, datos antes y después). Se registra desde las funciones SQL, no desde el frontend. Cubre como mínimo: anulación, devolución y cambio, ajuste de stock, edición de precio, movimiento de caja, alta y baja de usuario. Pantalla de consulta solo para el Dueño/a.
- **1.2 Permiso "Puede editar precios"** *(punto 22)*: columna en `perfiles`. Se controla **en la base** (RLS o función), no solo ocultando el campo. Aplica al formulario de producto y a la edición de precios en lote (4.4).
- **1.3 Contraseñas y email del Dueño/a** *(punto 20)*: que cada usuario pueda cambiar su contraseña, y que el Dueño/a pueda resetear la de un Vendedor desde Usuarios. `crear_vendedor` usa emails internos inventados, así que para los Vendedores el reseteo del Dueño/a es el único camino. El Dueño/a pasa a tener **email real** y "Olvidé mi contraseña" en el Login; sigue entrando con su nombre de usuario.

### Fase 2 · Cobros y caja
- **2.1 Pagos por venta + medios nuevos** *(puntos 4 y 7)*: nueva tabla `venta_pagos` (venta, medio, monto). Sacar el medio de pago de `ventas`. Enum de medios: `efectivo | debito | transferencia | qr_mp`. Migrar las ventas existentes (un pago por venta; "tarjeta" pasa a `debito`; al 17/11/2026 no hay ventas). UI del POS: agregar varios pagos, ver lo que falta, y vuelto solo sobre el efectivo. Actualizar `registrar_venta` y el ticket.
- **2.2 Movimientos de caja** *(punto 10)*: tabla `caja_movimientos` con los tipos `gasto | retiro | ingreso_cambio | devolucion`, más monto, motivo y usuario. **Cobros de cuentas en la caja**: `cuenta_pagos` suma `medio_pago` y `caja_id`, `registrar_pago` exige caja abierta. El efectivo esperado del cierre = apertura + ventas en efectivo + cobros de cuentas en efectivo + ingresos − gastos − retiros − devoluciones.
- **2.3 Resumen del cierre por medio de pago** *(punto 11)*: en el Historial de caja (Dueño/a), totales por medio. El cierre sigue siendo "a ciegas" para el que cierra.

### Fase 3 · Clientes y postventa
- **3.1 Ficha de cliente** *(punto 18)*: tabla `clientes` con historial de compras (venta con cliente opcional). **Unificar con Cuentas**: la cuenta pasa a pertenecer a un cliente, sin dos fichas paralelas. Migrar las fichas actuales de Cuentas.
- **3.2 Anular venta** *(punto 3)*: solo mientras la caja en la que se hizo la venta **siga abierta**. Revierte el stock y los pagos de esa caja. Pide un motivo obligatorio y queda en auditoría. Después del cierre no se anula: se hace una devolución.
- **3.3 Cambios y devoluciones** *(punto 2)*: a partir de una venta existente, se eligen los ítems que vuelven (y opcionalmente los que salen). El stock se ajusta solo. La diferencia a favor del cliente sale en efectivo como movimiento `devolucion` (2.2). Requiere caja abierta. Queda en auditoría.

### Fase 4 · Productos
- **4.1 Temporadas, colecciones y talles configurables** *(punto 16)*: tablas `temporadas` y `curvas_talles` (letras, numérico, jean). Liquidación = marcar una temporada como liquidación. ⚠️ Migrar las variantes existentes sin romper los SKU.
- **4.2 Fotos por color** *(punto 17)*: la foto pasa a pertenecer a producto + color. Usa el bucket de la migración 0013.
- **4.3 Inventario por conteo** *(punto 15)*: se carga lo contado, el sistema muestra diferencias y, al confirmar, genera `ajustes_stock`. Queda en auditoría.
- **4.4 Excel y precios en lote** *(punto 14)*: exportar e importar productos con variantes, y subir o bajar precios en % o monto por filtro (categoría o temporada). Respeta el permiso 1.2. Va al final porque el formato depende de 4.1 y 4.2.

### Fase 5 · Cierre y prueba
- **5.1** Backlog visual *(punto 34)*.
- **5.2** Flujo completo con el usuario Vendedor *(punto 37)*.
- **5.3** Prueba en celular real *(punto 36)*.
- **5.4** Re-correr TestSprite (incluidos TC007, TC008 y TC011).

---

## Riesgos y advertencias
- **Devolución en efectivo de una venta cobrada por otro medio**: el que devuelve puede sacar efectivo de la caja contra un débito o una transferencia. No hay permiso que lo limite (decisión tomada), así que la **auditoría (1.1) es el único control**. Por eso va antes.
- **Devolución sin efectivo suficiente**: el sistema tiene que avisar si el monto supera el efectivo esperado de la caja.
- **Impresora térmica sin probar**: el ticket va a cambiar (pago dividido, devoluciones). Se recomienda al menos una prueba real antes de entregar.
- **Fuera de alcance, pero obligatorio antes de cargar datos reales**: separar la base de desarrollo de la de producción y tener backups. Se retoma al planificar el deploy.
