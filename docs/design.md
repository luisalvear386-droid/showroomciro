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
- **Desktop:** sidebar lateral fijo con accesos a Dashboard, Productos, **Cuentas**, Historial de Caja, Reportes, Usuarios (los tres últimos solo Dueño/a). **No incluye el Cierre de Caja**: se abre desde el acceso rápido "Cerrar Caja" del Dashboard. **No incluye "Ventas"** como ítem persistente — el POS se accede solo mediante el botón de acción "Nueva Venta" del Dashboard, y al confirmar la venta se vuelve automáticamente al Dashboard.
- **Mobile (acceso remoto del Dueño/a, solo consulta salvo la excepción indicada):** menú inferior tipo app con Dashboard, **Cuentas**, Reportes, **Configuración** (dentro: Gestión de Usuarios — única acción real permitida desde el celular).
- **Sesión:** el bloque de usuario (nombre + rol) en el header es clickeable y despliega "Cerrar sesión". Al confirmar el **Cierre de Caja**, la sesión se cierra automáticamente y se vuelve al Login.
- **Sin campanita de notificaciones**: las alertas (stock bajo, cuentas por vencer) se muestran en el panel de Alertas del Dashboard y como badge numérico en el ítem "Cuentas" del menú.

## 2. Arquitectura técnica

### Stack
- **Frontend:** React + Vite + TypeScript, construido como **PWA instalable** (Service Worker con la interfaz en caché para que cargue rápido). Requiere conexión para operar: el modo offline-first quedó descartado por ahora (ver [Modo offline](#modo-offline-descartado-por-ahora)). Deploy en **Vercel**.
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
Se agregó `registrar_venta(p_venta_id, p_caja_id, p_medio_pago, p_items)` (migración 0008), con el mismo criterio que `cerrar_caja()` y `aplicar_ajuste_stock()`: inserta la venta y sus ítems, y descuenta `variantes.stock`, todo en una sola transacción. `p_venta_id` lo genera el cliente para que sea idempotente: si se corta la conexión al confirmar, el reintento con el mismo id no duplica la venta. El precio de cada ítem se toma del precio actual de `productos`, no del que mande el cliente. El `INSERT` directo sobre `ventas`/`venta_items` y el `UPDATE` directo sobre `variantes.stock` quedaron deshabilitados para todos los roles — la única vía es esta función.

> Módulo 11 (offline, hoy descartado): la migración 0012 sumó `p_fecha` para registrar la hora real de una venta sincronizada tarde. Queda en la base como parámetro opcional, sin uso. Ver [Modo offline](#modo-offline-descartado-por-ahora).

### Cobros y validación de montos (Módulo 7)
Se agregó `registrar_pago(p_cuenta_id, p_monto)` (migración 0009), con el mismo criterio que `registrar_venta()`: función `security definer` que bloquea la fila de la cuenta (`for update`), calcula el saldo pendiente (`monto_total` − suma de `cuenta_pagos`) y rechaza el cobro si lo supera o si la cuenta ya está saldada. Devuelve la fila actualizada de `cuentas_vista`. El bloqueo serializa cobros simultáneos sobre la misma cuenta: de dos cobros que juntos superan el saldo, solo pasa uno. El `INSERT` directo sobre `cuenta_pagos` quedó deshabilitado para todos los roles.

La migración 0010 cierra las otras dos vías para alterar una deuda por fuera de esa función:
- Sin `UPDATE` directo sobre `cuenta_pagos` para ningún rol (policy borrada y privilegio revocado): un pago registrado no se edita ni se borra vía API.
- Trigger `BEFORE UPDATE OF monto_total` en `cuentas` (`validar_monto_total_cuenta()`): impide dejar `monto_total` por debajo de lo ya cobrado (evita cuentas "pagado" con saldo negativo o deuda perdonada sin un pago que lo refleje). Sin pagos cargados, el monto se puede corregir libremente; editar nombre, teléfono o fecha límite no se ve afectado.

Frontend: la Agenda separa las cuentas pagadas en una sección plegable ("Cuentas saldadas"), fuera de la lista, del calendario y de los totales de las activas. El Detalle/Cobro es un modal sobre la Agenda (`/cuentas/:id`); en mobile se muestra sin formulario de cobro (solo consulta).

### Alta de usuarios (Módulo 9)
Crear un usuario de Supabase Auth necesita privilegios que el frontend (anon key + sesión del Dueño/a) no tiene. En vez de una Edge Function con la service role key, se agregó `crear_vendedor(p_nombre_usuario, p_contrasena)` (migración 0011), `security definer`, mismo criterio que `registrar_venta()`/`registrar_pago()`: verifica `es_dueno()`, valida el nombre de usuario (mismo formato que el Login) y la contraseña (mínimo 6 caracteres, el default de Supabase Auth), rechaza duplicados y crea en una sola transacción la fila de `auth.users` (email técnico `<usuario>@showroomciro.internal`, igual que `seed.sql`) y la de `perfiles` con rol `vendedor`. Solo crea Vendedores.

Desactivar/reactivar es un `UPDATE` de `perfiles.activo` que la policy `perfiles_update` ya limita al Dueño/a. Un perfil inactivo no tiene rol (`rol_actual()` devuelve null), así que el RLS le niega todo aunque tenga una sesión abierta, y el Login lo rechaza.

### Modo offline (descartado por ahora)
> **Decisión (octubre 2026):** el modo offline-first del POS (Módulo 11) se **sacó del sistema** por complejidad, para retomarlo más adelante. La app sigue siendo una **PWA instalable** (ícono, pantalla completa y carga rápida de la interfaz); lo que se fue es vender o guardar datos sin conexión. Queda **a evaluar en el futuro**: si se retoma, el diseño original (cola de ventas en IndexedDB, sincronización en orden, bloqueo del cierre con ventas sin sincronizar) está en el historial de git (commits del Módulo 11) y en la migración 0012.

**Qué quedó de la PWA (`vite-plugin-pwa`, `vite.config.ts`):** manifest e íconos, precache de la interfaz (JS, CSS, HTML, íconos) con fallback a `index.html` para todas las rutas, y caché en tiempo de ejecución de Google Fonts y de las fotos de producto. **Ningún dato de la API de Supabase (REST, RPC, Auth) pasa por la caché.** Una versión nueva se activa sola (`skipWaiting` + `clientsClaim`), pero la página recién se recarga en la pantalla de login (inicio o fin del turno), nunca a mitad de una venta (`src/lib/actualizacion-pwa.ts`). En Vercel, `sw.js`, `workbox-*.js` y el manifest van sin caché HTTP.

**Fotos de producto con nombre único:** la caché de fotos (CacheFirst) se mantiene para que la grilla del POS cargue rápido. Para que nunca se muestre una versión vieja, cada foto subida usa un nombre de archivo único (`<producto_id>/<uuid>.<ext>`, `subirFoto()` en `src/lib/productos.ts`) en vez de pisar la ruta fija `<producto_id>.<ext>`: una foto nueva es siempre otra URL. Al reemplazarla se borra la anterior del bucket, con la política de DELETE de la migración `0013_storage_borrar_fotos.sql` (los reportes leen el `foto_url` actual con un join, así que borrar la foto reemplazada no rompe ningún historial). Sin esa migración aplicada, el borrado no hace nada y la foto vieja queda huérfana, sin afectar a la app.

**Íconos de la PWA:** **provisorios**, recortados del mockup de la insignia del logo de Ciro Rey Showroom (`assets/marca/logo-ciro-rey-mockup.jpg`); a 512 px se ven algo blandos por la compresión JPG. Cuando esté el archivo original del logo se regeneran con `node scripts/generar-iconos-pwa.cjs --fuente <archivo>` (commit aparte). "ShowroomCiro" sigue siendo el nombre del sistema.

**Qué pasa sin conexión (`src/lib/conexion.ts`, `useEnLinea()`):**
- **Detección:** sin conexión si el navegador lo dice (`navigator.onLine` en false es confiable) **o** si un pedido a Supabase falló por red (el cliente de Supabase usa un `fetch` que lo avisa; cubre el wifi sin internet). Mientras tanto se sondea `/auth/v1/health` cada 5 s; la primera respuesta vuelve a "en línea".
- **Aviso:** pastilla coral **"Sin conexión"** en el header, solo mientras dure el corte (con conexión no se muestra nada). En el mostrador y en el celular.
- **Bloqueo:** quedan deshabilitados, con la línea "Sin conexión: esperá a que vuelva internet.", Nueva Venta, Nueva Cuenta y Cerrar Caja (Dashboard), Confirmar Venta, Abrir Caja, Cerrar Caja, Guardar Cuenta, Registrar Cobro, Guardar Producto, Dar de baja / Reactivar, Confirmar ajuste de stock, Crear vendedor y Desactivar / Reactivar.
- **Sin quedar a medias:** lo que está en pantalla se sigue viendo; el carrito del POS no se pierde y se confirma cuando vuelve la red. Si se corta justo al confirmar, el checkout avisa "No se pudo confirmar la venta…" y el reintento usa el **mismo id** (`registrar_venta()` es idempotente por `p_venta_id`), así que nunca se duplica. Todas las escrituras son funciones o `INSERT`/`UPDATE` atómicos: no queda nada a medio guardar en la base.
- **Arranque sin conexión:** pantalla "Sin conexión" con **Reintentar** (recarga la app, que el Service Worker sirve sin red), en vez del login. Con el token vencido supabase-js no puede renovarlo sin red, pero deja la sesión guardada (`haySesionGuardada()`): por eso no se manda al login, y la sesión se renueva sola al volver. Perfil, caja y catálogo del POS que no se pudieron cargar se vuelven a pedir solos al reconectar.
- **Base de datos:** no se tocó. `registrar_venta()` conserva `p_fecha` (0012, opcional): el frontend ya no lo manda, así que la venta queda con la hora del servidor. `ventas.estado_sync` queda siempre en `'sincronizada'`.

**Límites conocidos:** con wifi pero sin internet, la pastilla aparece recién cuando falla el primer pedido (no se sondea mientras todo anda bien).

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

> Nota: `ventas.caja_id` (FK a `cajas`) vincula cada venta con la caja que estaba abierta al momento de hacerla — es lo que permite calcular `monto_esperado` en `cerrar_caja()` sin depender de qué usuario vendió. El POS envía este `caja_id` en cada venta.

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
- `rpc: crear_vendedor(p_nombre_usuario, p_contrasena)` (ver [Alta de usuarios](#alta-de-usuarios-módulo-9)), `PATCH /perfiles?id=eq.:id` (`activo`: desactivar/reactivar) — Dueño/a, disponible también desde mobile

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
   > **Sin conexión:** "Confirmar Venta" queda deshabilitado con el aviso "Sin conexión: esperá a que vuelva internet."; el carrito no se pierde y se confirma cuando vuelve la red. Si se corta justo al confirmar, el reintento usa el mismo id de venta (no se duplica). Ver [Modo offline](#modo-offline-descartado-por-ahora).
5. **Productos — Listado** — tabla/grid de productos con foto, categoría, precio, stock total, estado (activo/inactivo).
6. **Productos — Alta/Edición** — formulario en dos pasos: (1) datos generales (nombre, descripción, categoría, precio, foto), (2) carga de variantes (talle + color) con stock inicial por variante. Alta, edición y baja disponibles para Dueño/a y Vendedor.
7. **Stock — Ajuste** — pantalla o acción rápida para sumar/restar stock de una variante puntual (ej. reposición, merma).
8. **Cuentas — Agenda** — vista de lista (deudor, monto, vencimiento) por defecto, con **toggle a vista calendario** por fecha de vencimiento. Alertas visuales de próximos a vencer / vencidos según la paleta (coral/vino). **Sin botón propio de "+ Nueva Cuenta"** — esa acción vive solo en el Dashboard.
9. **Cuentas — Alta** — formulario al que dirige el botón "Nueva Cuenta" del Dashboard: datos del cliente (nombre, teléfono), monto adeudado y fecha límite de pago. Al guardar, vuelve automáticamente al Dashboard (mismo patrón que "Nueva Venta").
10. **Cuentas — Detalle/Cobro** — detalle de la cuenta seleccionada, registro de cobro/abono parcial o total.
11. **Caja — Cierre** — se entra desde el botón de acceso rápido **"Cerrar Caja"** del Dashboard (sin ítem de menú; separado del Historial, que sí tiene ítem propio "Historial de Caja", solo Dueño/a). Conteo de efectivo físico **a ciegas**; la diferencia vs. lo esperado la calcula el sistema al cerrar y la ve el Dueño/a en el Historial de Caja. Al confirmar, **cierra la sesión automáticamente** y redirige a Login.
   > Implementado a **conteo ciego**, apartándose del prototipo: antes de confirmar solo se muestran la cantidad de ventas y el total vendido del turno (`caja_actual_resumen()`), sin desglose por medio de pago, efectivo vendido, esperado ni diferencia en vivo. `cerrar_caja()` calcula esos montos al cerrar y quedan visibles en el Historial. Un modal de confirmación avisa que se cerrará la sesión; solo si la RPC responde OK se hace `signOut()`, se descarta la caja en memoria y se redirige a `/login`; si falla, se muestra el error y la sesión sigue abierta. Sin el campo "Nota sobre la diferencia" del prototipo: `cajas` no tiene dónde guardarla. No se opera desde mobile.
   > Sin conexión, "Cerrar Caja" queda deshabilitado (y también el botón del modal de confirmación).
12. **Caja — Historial** — listado de aperturas/cierres pasados por día y usuario.
   > **Solo Dueño/a** (`/caja/historial`, enlace "Ver historial" desde el Cierre). Queda **fuera del bloqueo de apertura obligatoria**: es de solo lectura, y esa regla bloquea la venta, no la consulta — el Dueño/a puede entrar desde la compu aunque no haya caja abierta (el enlace "Volver al cierre" solo aparece si hay una). El RLS del Vendedor no le deja ver cajas ni nombres de otros usuarios, ni ventas de cajas cerradas. Lista solo cajas cerradas, filtradas por fecha de apertura. Del prototipo se omiten el botón "Exportar" (no está en requirements.md), "Ventas fiadas" (las cuentas no pasan por caja) y la nota de la jornada (sin columna en `cajas`).
13. **Reportes** (solo Dueño/a) — ventas por día/semana/mes, productos más vendidos, cuentas pendientes de cobro.
   > `/reportes`, **fuera del bloqueo de apertura obligatoria** (igual que el Historial de Caja: es consulta, no venta). Los períodos son móviles como en el prototipo: Día = hoy (gráfico por franjas de 2 h), Semana = últimos 7 días (una barra por día), Mes = últimos 30 días (4 barras "Sem 1…4"; las dos primeras cubren 8 días y las otras 7). KPIs y top 5 vía `reporte_ventas_rango()` / `reporte_top_productos_rango()`; barras por día desde `reportes_ventas_vista`; el panel de cuentas desde `reportes_cuentas_pendientes_vista` (estado actual, no depende del período). Del prototipo se omiten la serie "Fiado" del gráfico y el KPI "Vendido en fiado" (las cuentas no pasan por el checkout), y en el panel —renombrado "Cuentas pendientes"— "Cobrados en el período" y la cantidad de clientes (fuera de lo pedido en requirements.md).
14. **Gestión de Usuarios** (solo Dueño/a) — alta de nuevos Vendedores.
   > `/usuarios`, también **fuera del bloqueo de apertura obligatoria** (gestión, no venta). Alta vía `crear_vendedor()` y desactivar/reactivar vía `perfiles.activo` (ver [Alta de usuarios](#alta-de-usuarios-módulo-9)); la cuenta del Dueño/a no tiene acciones. Sin el campo "Nombre completo" del prototipo: `perfiles` no tiene dónde guardarlo, así que cada usuario se identifica por su nombre de usuario.

### Listado de pantallas (Mobile — acceso remoto del Dueño/a)
Menú inferior tipo app con 4 secciones: **Dashboard, Cuentas, Reportes, Configuración** — las primeras 3 son de **solo consulta/lectura**. **Configuración** contiene, por ahora, **Gestión de Usuarios** (alta/baja de Vendedores) — es la **única acción real** habilitada desde el celular, ya que no tiene el riesgo de concurrencia que motivó restringir las ventas remotas. Espacio reservado en Configuración para futuras opciones.

> El Vendedor en mobile ve únicamente Dashboard y Cuentas (Configuración queda oculta, ya que solo contiene Gestión de Usuarios, exclusiva del Dueño/a). Nadie en mobile (Dueño/a ni Vendedor) pasa por Apertura de Caja aunque no haya ninguna abierta — el celular nunca opera caja, así que no tiene sentido bloquearlo ahí.

15. **Configuración (mobile)** — pantalla nueva, con acceso a Gestión de Usuarios (mismo alcance que la versión desktop: alta y baja de Vendedores).
   > `/configuracion`, solo Dueño/a y fuera del bloqueo de apertura (igual que `/usuarios`). "Gestionar Usuarios" lleva a la misma pantalla `/usuarios` del desktop, adaptada con CSS (tarjetas en vez de tabla) y con "←" en el header de vuelta a Configuración; no hay una versión aparte. Sin el campo "Nombre completo" del prototipo, por lo mismo que en desktop.

> **Solo consulta, impuesto por ruta (Módulo 10):** Dashboard, Cuentas y Reportes mobile son las mismas pantallas y consultas del desktop, adaptadas con CSS; en mobile se ocultan "Nueva Venta"/"Nueva Cuenta" y el formulario de cobro. Además, en el celular las rutas de escritura (`/ventas`, `/cuentas/nueva`, `/productos*`, `/caja`) redirigen al Dashboard aunque se entre por URL (guard `SoloEscritorio`), y lo mismo `/apertura-caja`, **para cualquier rol**. "Mobile" es el mismo corte de ancho del layout (≤ 768px).

> **Extensión del criterio de la sección 8 de requirements.md (decisión del Módulo 10):** requirements.md restringe a solo consulta el acceso remoto del Dueño/a, sin mencionar al Vendedor. Se extiende el mismo criterio al Vendedor: desde el celular tampoco puede vender, abrir/cerrar caja ni dar de alta o editar productos o cuentas. La razón de negocio es la misma (evitar venta concurrente y doble descuento de stock con el mostrador). En mobile el Vendedor ve Dashboard (con la caja como cerrada si no hay una abierta) y Cuentas, de solo consulta.

### Componentes transversales
- Sidebar fijo (desktop) con accesos a Dashboard, Productos, Cuentas (+ Historial de Caja, Reportes y Usuarios si es Dueño/a). Sin ítem "Ventas" ni "Caja": el Cierre de Caja se abre desde el botón "Cerrar Caja" del Dashboard.
- Alertas (stock bajo y cuentas por vencer) visibles en el panel del Dashboard y como badge numérico en el ítem "Cuentas" del menú — sin ícono de campana/notificaciones separado.
- Bloque de usuario en el header clickeable → "Cerrar sesión". Logout automático al confirmar Cierre de Caja.
- **Subtítulo del header** (Módulo 12): la sección actual, como en los prototipos ("Productos · Nuevo producto", "Caja · Historial"…); el Dashboard muestra la fecha y el POS "Punto de venta". En mobile no se muestra. El rol del Dueño/a se muestra como "Dueño/a" en el header y en Usuarios.

### Backlog visual (validación del Módulo 12)
Diferencias contra los prototipos detectadas en la validación visual manual, anotadas sin tocar código por ahora (a decidir si se ajustan o se aceptan como están):
- **Ventas (POS):** las tarjetas de la grilla no llevan la etiqueta de categoría sobre la foto; el filtro de categorías muestra solo las que tienen productos.
- **Modal de variante:** debajo del nombre muestra el SKU de la variante elegida en vez del código del producto.
- **Productos (listado y alta):** columna y campo **Costo** (solo Dueño/a) que no están en el prototipo; en el alta la categoría arranca en "Elegí una categoría" en vez de venir preseleccionada. La ayuda de la foto dice "JPG, PNG o WebP · máx 5 MB" (lo que aceptan el código y el bucket), no "JPG o PNG · máx 2 MB" del prototipo.
- **Cuentas — Alta:** el campo de fecha ocupa todo el ancho y los atajos 7/15/30 días quedan debajo (en el prototipo van en la misma fila). La ayuda dice "3 días antes" en vez de "cinco días antes": es lo correcto, sale de `dias_aviso_por_vencer` de `cuentas_vista` (0003).
- **Cuentas — Detalle/Cobro:** falta el botón "Imprimir recibo" de la cuenta saldada.
- **Cuentas — Agenda:** flecha de orden en "Fecha límite ↑" y botones ‹ › de mes en el calendario, que el prototipo no tiene.
- **Caja — Cierre:** el subtítulo no dice quién abrió la caja ("… abierta a las 09:40 por Marcos" en el prototipo).
- **Usuarios / Configuración:** el resumen dice "N usuarios · N activos" en vez de "N cuentas · N activas" (evita confundir con el módulo Cuentas).
- **Mobile — Usuarios:** la cuenta propia dice "Tu cuenta" en vez de "Tu cuenta · no se puede desactivar"; el formulario suma un botón "Cancelar" además de la ×.
- **Estados vacíos** (Dashboard, Agenda, Historial, Reportes): textos propios ("Todo en orden", "No hay cuentas pendientes de cobro."…) que los prototipos no tienen porque siempre muestran datos.
- **Aviso "Sin conexión"**: pastilla coral en el header, a la izquierda del bloque de usuario, solo durante el corte (el tono coral de los badges de diferencia del Historial de Caja), y la línea "Sin conexión: esperá a que vuelva internet." bajo cada botón bloqueado. Fuera de los prototipos: resuelto en el estilo existente (decisión aprobada al descartar el offline). Reemplaza al indicador de conexión / ventas sin sincronizar del Módulo 11.

---
**Estado: Diseño técnico y de navegación actualizado (Cuentas, sin campanita, sin ítem Ventas, logout, Configuración mobile, pantalla de Alta de Cuenta separada de la Agenda). Pendiente aplicar estos ajustes en Claude Design (ver `ajustes-fase3-claude-design.md`) y tu aprobación final para pasar a la Fase 4 (tasks.md).**
