# Diseño — Sistema de Gestión ShowroomCiro (v1)

## 1. Identidad Visual

### Paleta de colores (aprobada)
| Rol | Color | Hex | Uso |
|---|---|---|---|
| Primario/marca | Canela | `#B87A56` | Botones principales, header, acentos de acción |
| Fondo general | Crema hueso | `#F7F0E6` | Fondos de pantalla, cards |
| Texto principal | Marrón cacao | `#4A342A` | Textos, sidebar activo |
| Bordes/separadores | Lino | `#E4D6C3` | Líneas, inputs, estados inactivos |
| Éxito/confirmación | Verde oliva | `#6B7A4F` | Venta completada, stock ok |
| Alerta/advertencia | Coral quemado | `#D4694A` | Stock bajo, cuenta por vencer |
| Error/vencido | Vino | `#7A2E2A` | Cuenta vencida, error de validación |

### Tipografía
_A definir con nombres concretos de fuente (Google Fonts) al cerrar el inventario de pantallas._

### Navegación
- **Desktop:** sidebar lateral fijo con accesos a Dashboard, Productos, Caja, **Cuentas**, Reportes, Usuarios (Dueño/a). **No incluye "Ventas"** como ítem persistente — el POS se accede solo mediante el botón de acción "Nueva Venta" del Dashboard, y al confirmar la venta se vuelve automáticamente al Dashboard.
- **Mobile (acceso remoto del Dueño/a, solo consulta salvo la excepción indicada):** menú inferior tipo app con Dashboard, **Cuentas**, Reportes, **Configuración** (dentro: Gestión de Usuarios — única acción real permitida desde el celular).
- **Sesión:** el bloque de usuario (nombre + rol) en el header es clickeable y despliega "Cerrar sesión". Al confirmar el **Cierre de Caja**, la sesión se cierra automáticamente y se vuelve al Login.
- **Sin campanita de notificaciones**: las alertas (stock bajo, cuentas por vencer) se muestran en el panel de Alertas del Dashboard y como badge numérico en el ítem "Cuentas" del menú.

## 2. Arquitectura técnica

### Stack
- **Frontend:** React + Vite + TypeScript, construido como **PWA (offline-first)**. Uso de IndexedDB (vía Dexie.js) para cachear catálogo de productos y encolar ventas pendientes cuando no hay internet. Service Worker para funcionamiento sin conexión. Deploy en **Vercel**.
- **Backend/Datos:** **Supabase** — PostgreSQL administrado + Autenticación + Storage (fotos de producto) + API autogenerada (PostgREST). La lógica de negocio custom (generación de SKU, cálculo de diferencia de caja, estado de cuentas) se resuelve con **funciones y vistas SQL/PL-pgSQL nativas de Postgres** (trigger, función RPC, vista), no con Edge Functions — evita sumar un runtime serverless aparte para lógica que Postgres ya resuelve.
- **Autenticación:** Supabase Auth, adaptado para login por usuario/contraseña (sin email visible): el nombre de usuario se mapea internamente a un email técnico (ej. `vendedor1@showroomciro.internal`) de forma transparente para el usuario final. Roles (Dueño/Vendedor) controlados con una tabla de perfiles + **Row Level Security (RLS)** de Postgres, que es lo que efectivamente impone los permisos definidos en `requirements.md` a nivel base de datos (no solo en el frontend).

### Seguridad reforzada en Módulo 2 (post-auditoría)
Se detectó que filtrar los reportes solo a nivel de vista (`reportes_*_vista`) no alcanza si el rol subyacente tiene SELECT amplio sobre las tablas base — un Vendedor podía reconstruir el mismo reporte consultando `ventas`/`venta_items` directo. Se reforzó así:
- El Vendedor solo puede ver (`SELECT`) sus propias ventas de la caja actualmente abierta (vía función `caja_abierta_id()`); el Dueño/a ve todo el historial.
- `UPDATE` deshabilitado por completo sobre `ventas`, `venta_items` y `cajas`, para ambos roles — evita alterar registros financieros ya conciliados. El cierre de caja es exclusivamente vía la función `cerrar_caja()` (`security definer`).
- `cajas_insert` exige `usuario_apertura_id = auth.uid()` (que además es el default de la columna) y que los campos de cierre vengan en null — nadie puede abrir una caja a nombre de otro usuario ni insertarla ya "cerrada".
- Índice único parcial (`uq_cajas_una_abierta`) impide tener más de una caja abierta al mismo tiempo.
- KPI "ventas de hoy" del Dashboard expuesto vía `caja_actual_resumen()` (`security definer`), con conteo ciego: no expone `monto_esperado` antes de que el Vendedor cuente el efectivo.

### Ajuste de stock atómico (Módulo 5)
Insertar en `ajustes_stock` no modificaba `variantes.stock` por sí solo — hacerlo con dos escrituras separadas desde el frontend (insert del ajuste + update del stock) no era atómico: si la segunda fallaba, quedaba un ajuste sin efecto, y dos ajustes simultáneos podían pisarse. Se agregó un trigger `AFTER INSERT` (`aplicar_ajuste_stock()`, `security definer`) que aplica el delta sobre `variantes.stock` en la misma transacción. El motivo es obligatorio y el `UPDATE` sobre `ajustes_stock` está deshabilitado para todos los roles (registro de auditoría).

**Pendiente para el Módulo 6:** `variantes.stock` sigue siendo editable por `UPDATE` directo (lo necesita el POS para descontar al vender). Evaluar ahí si conviene resolverlo con una función dedicada, con el mismo criterio que `cerrar_caja()`.

### Venta atómica (Módulo 6)
Se agregó `registrar_venta(p_venta_id, p_caja_id, p_medio_pago, p_items)` (migración 0008), con el mismo criterio que `cerrar_caja()` y `aplicar_ajuste_stock()`: inserta la venta y sus ítems, y descuenta `variantes.stock`, todo en una sola transacción. `p_venta_id` lo genera el cliente para que sea idempotente — necesario para el Módulo 11: un reintento de sincronización offline con el mismo id no duplica la venta. El precio de cada ítem se toma del precio actual de `productos`, no del que mande el cliente. El `INSERT` directo sobre `ventas`/`venta_items` y el `UPDATE` directo sobre `variantes.stock` quedaron deshabilitados para todos los roles — la única vía es esta función.

**Pendiente para el Módulo 11:** la función rechaza ventas contra una caja cerrada; una venta offline que se sincronice después del cierre de esa caja va a fallar, y además quedaría con la fecha de sincronización en vez de la fecha real de la venta. Resolver ahí.

### Cobros y validación de montos (Módulo 7)
Se agregó `registrar_pago(p_cuenta_id, p_monto)` (migración 0009), con el mismo criterio que `registrar_venta()`: función `security definer` que bloquea la fila de la cuenta (`for update`), calcula el saldo pendiente (`monto_total` − suma de `cuenta_pagos`) y rechaza el cobro si lo supera o si la cuenta ya está saldada. Devuelve la fila actualizada de `cuentas_vista`. El bloqueo serializa cobros simultáneos sobre la misma cuenta: de dos cobros que juntos superan el saldo, solo pasa uno. El `INSERT` directo sobre `cuenta_pagos` quedó deshabilitado para todos los roles.

La migración 0010 cierra las otras dos vías para alterar una deuda por fuera de esa función:
- Sin `UPDATE` directo sobre `cuenta_pagos` para ningún rol (policy borrada y privilegio revocado): un pago registrado no se edita ni se borra vía API.
- Trigger `BEFORE UPDATE OF monto_total` en `cuentas` (`validar_monto_total_cuenta()`): impide dejar `monto_total` por debajo de lo ya cobrado (evita cuentas "pagado" con saldo negativo o deuda perdonada sin un pago que lo refleje). Sin pagos cargados, el monto se puede corregir libremente; editar nombre, teléfono o fecha límite no se ve afectado.

Frontend: la Agenda separa las cuentas pagadas en una sección plegable ("Cuentas saldadas"), fuera de la lista, del calendario y de los totales de las activas. El Detalle/Cobro es un modal sobre la Agenda (`/cuentas/:id`); en mobile se muestra sin formulario de cobro (solo consulta).

### Modo Offline-First (Ventas/POS)
> Se simplifica respecto a la primera versión: como el celular del Dueño/a ahora **solo consulta** (no vende), ya no hay dos puntos generando ventas al mismo tiempo. Se elimina la necesidad de resolución de conflictos de stock entre dispositivos.

1. El catálogo de productos se cachea localmente al iniciar sesión y se actualiza cuando hay conexión.
2. Cada venta hecha sin internet se guarda en una cola local (IndexedDB) con estado "pendiente de sincronizar".
3. Al recuperar conexión, la cola se sincroniza automáticamente contra Supabase, en orden, sin conflicto posible (el mostrador es el único punto que vende).
4. Apertura/cierre de caja y gestión de productos/usuarios **requieren conexión** (no se sincronizan offline, según lo definido en requirements.md).

### Modelo de datos (entidades principales)
- `usuarios` (id, nombre_usuario, rol: dueño/vendedor, activo)
- `categorias` (id, nombre)
- `productos` (id, codigo, nombre, descripción, categoría_id, precio, foto_url, activo) — `codigo` es un correlativo autonumerado (1, 2, 3…), usado para generar el SKU corto de cada variante.
- `variantes` (id, producto_id, talle, color, sku, stock, stock_minimo)
- `ventas` (id, usuario_id, caja_id, fecha, total, medio_pago, estado_sync)
- `venta_items` (id, venta_id, variante_id, cantidad, precio_unitario)
- `ajustes_stock` (id, variante_id, usuario_id, tipo: suma/resta, cantidad, motivo, fecha)
- `cajas` (id, usuario_apertura_id, usuario_cierre_id, monto_inicial, monto_esperado, monto_contado, diferencia, fecha_apertura, fecha_cierre)
- `cuentas` (id, cliente_nombre, cliente_telefono, monto_total, fecha_limite) — el estado (al_dia/por_vencer/vencido/pagado) ya NO se guarda como columna: se calcula al vuelo en la vista `cuentas_vista`, cruzando con `cuenta_pagos`, para que nunca quede desactualizado.
- `cuenta_pagos` (id, cuenta_id, monto, fecha) — `cuenta_id` usa `on delete restrict`: no se puede borrar una cuenta que ya tiene pagos cargados, para no perder ese historial.

> Nota: `ventas.caja_id` (FK a `cajas`) vincula cada venta con la caja que estaba abierta al momento de hacerla — es lo que permite calcular `monto_esperado` en `cerrar_caja()` sin depender de qué usuario vendió. El Módulo 6 (POS) debe enviar este `caja_id` en cada venta, incluidas las que se guardan offline en la cola de Dexie (la apertura de caja requiere conexión, así que el id ya está disponible antes de perder internet).

### Impresión de ticket
Ticket generado como HTML/CSS con ancho de impresora térmica (58mm/80mm) e impreso vía el diálogo de impresión estándar del navegador (`window.print()`). Compatible con cualquier impresora ya instalada en Windows, sin agente local adicional.

### APIs principales (sobre la API autogenerada de Supabase — PostgREST)
- `POST /auth/login` — login por usuario/contraseña
- `GET /productos`, `POST /productos`, `PUT /productos/:id`, `DELETE /productos/:id`
- `POST /variantes` (el SKU se genera solo, vía trigger `BEFORE INSERT` en Postgres — no requiere llamada aparte)
- `POST /ajustes-stock`
- `POST /ventas` (registrada desde el mostrador; consulta de solo lectura disponible para el celular)
- `POST /caja/apertura`, `rpc: cerrar_caja(caja_id, monto_contado)` (función SQL que calcula la diferencia y deja la caja cerrada)
- `GET /caja/historial`
- `POST /cuentas`, `rpc: registrar_pago(cuenta_id, monto)` (ver [Cobros y validación de montos](#cobros-y-validación-de-montos-módulo-7)), `GET /cuentas_vista` (vista SQL que calcula el estado al_dia/por_vencer/vencido/pagado al vuelo, sin necesidad de mantenerlo actualizado)
- `GET /reportes_ventas_vista?periodo=`, `GET /reportes_top_productos_vista` (vistas/funciones SQL de agregación)
- `POST /usuarios`, `PATCH /usuarios/:id` (desactivar) — Dueño/a, disponible también desde mobile

### Hosting
- Frontend: **Vercel**.
- Backend/DB/Auth/Storage: **Supabase**.

## 3. Inventario de pantallas y flujos

### Flujo general de entrada
**Login → Apertura de Caja (bloqueante) → Dashboard/Inicio**
La apertura de caja es obligatoria antes de poder vender; se resuelve como paso intermedio tras el login, no como parte del menú normal.

### Listado de pantallas (Desktop — uso principal en mostrador)

1. **Login** — usuario y contraseña simples (sin email). Cada Vendedor tiene su propio usuario.
2. **Apertura de Caja** — pantalla bloqueante post-login: registro de monto inicial en efectivo. Se salta si la caja ya fue abierta ese día por otro usuario.
   > Nota: se agregó un enlace de "Cerrar sesión" en esta pantalla, fuera del prototipo original — necesario para poder cambiar de usuario o salir si alguien entró por error antes de abrir caja.
3. **Dashboard/Inicio** — KPIs del día (ventas de hoy, estado de caja actual) + panel de alertas (stock bajo, fiados por vencer/vencidos).
   > El KPI "Caja actual" muestra solo el estado (abierta desde HH:MM / cerrada) y **no muestra `monto_esperado`** ni el efectivo acumulado: el cierre es a conteo ciego y `caja_actual_resumen()` no expone esos montos (ver [Seguridad reforzada en Módulo 2](#seguridad-reforzada-en-módulo-2-post-auditoría)). El Dashboard respeta esa regla aunque el prototipo mostraba "Efectivo esperado".
4. **Ventas (POS)** — pantalla principal de venta (accedida solo vía botón "Nueva Venta" del Dashboard; al confirmar vuelve al Dashboard):
   - Buscador rápido por nombre o SKU (arriba).
   - Grilla visual de productos con foto (catálogo, navegable por categoría).
   - Al hacer clic en un producto → **modal de selección de variante** (talle/color) con stock disponible.
   - Carrito lateral con los ítems agregados.
   - **Checkout**: selección de medio de pago (efectivo/transferencia/tarjeta) únicamente. Sin opción de fiado/cuenta en este flujo.
   - Al confirmar: impresión de ticket vía diálogo de impresión del navegador.
5. **Productos — Listado** — tabla/grid de productos con foto, categoría, precio, stock total, estado (activo/inactivo).
6. **Productos — Alta/Edición** — formulario en dos pasos: (1) datos generales (nombre, descripción, categoría, precio, foto), (2) carga de variantes (talle + color) con stock inicial por variante. Alta, edición y baja disponibles para Dueño/a y Vendedor.
7. **Stock — Ajuste** — pantalla o acción rápida para sumar/restar stock de una variante puntual (ej. reposición, merma).
8. **Cuentas — Agenda** — vista de lista (deudor, monto, vencimiento) por defecto, con **toggle a vista calendario** por fecha de vencimiento. Alertas visuales de próximos a vencer / vencidos según la paleta (coral/vino). **Sin botón propio de "+ Nueva Cuenta"** — esa acción vive solo en el Dashboard.
9. **Cuentas — Alta** — formulario al que dirige el botón "Nueva Cuenta" del Dashboard: datos del cliente (nombre, teléfono), monto adeudado y fecha límite de pago. Al guardar, vuelve automáticamente al Dashboard (mismo patrón que "Nueva Venta").
10. **Cuentas — Detalle/Cobro** — detalle de la cuenta seleccionada, registro de cobro/abono parcial o total.
11. **Caja — Cierre** — conteo de efectivo físico, cálculo automático de diferencia vs. lo esperado según ventas del día. Al confirmar, **cierra la sesión automáticamente** y redirige a Login.
12. **Caja — Historial** — listado de aperturas/cierres pasados por día y usuario.
13. **Reportes** (solo Dueño/a) — ventas por día/semana/mes, productos más vendidos, cuentas pendientes de cobro.
14. **Gestión de Usuarios** (solo Dueño/a) — alta de nuevos Vendedores.

### Listado de pantallas (Mobile — acceso remoto del Dueño/a)
Menú inferior tipo app con 4 secciones: **Dashboard, Cuentas, Reportes, Configuración** — las primeras 3 son de **solo consulta/lectura**. **Configuración** contiene, por ahora, **Gestión de Usuarios** (alta/baja de Vendedores) — es la **única acción real** habilitada desde el celular, ya que no tiene el riesgo de concurrencia que motivó restringir las ventas remotas. Espacio reservado en Configuración para futuras opciones.

> El Vendedor en mobile ve únicamente Dashboard y Cuentas (Configuración queda oculta, ya que solo contiene Gestión de Usuarios, exclusiva del Dueño/a). El Dueño/a en mobile no pasa por Apertura de Caja aunque no haya ninguna abierta — el celular nunca opera caja, así que no tiene sentido bloquearlo ahí.

15. **Configuración (mobile)** — pantalla nueva, con acceso a Gestión de Usuarios (mismo alcance que la versión desktop: alta y baja de Vendedores).

### Componentes transversales
- Sidebar fijo (desktop) con accesos a Dashboard, Productos, Caja, Cuentas, Reportes (+ Usuarios si es Dueño/a). Sin ítem "Ventas".
- Alertas (stock bajo y cuentas por vencer) visibles en el panel del Dashboard y como badge numérico en el ítem "Cuentas" del menú — sin ícono de campana/notificaciones separado.
- Bloque de usuario en el header clickeable → "Cerrar sesión". Logout automático al confirmar Cierre de Caja.

---
**Estado: Diseño técnico y de navegación actualizado (Cuentas, sin campanita, sin ítem Ventas, logout, Configuración mobile, pantalla de Alta de Cuenta separada de la Agenda). Pendiente aplicar estos ajustes en Claude Design (ver `ajustes-fase3-claude-design.md`) y tu aprobación final para pasar a la Fase 4 (tasks.md).**
