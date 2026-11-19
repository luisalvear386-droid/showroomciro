# tasks.md — ShowroomCiro

> ⏸️ **Plan v2 en pausa desde el 18/11/2026: se entrega el MVP (Módulos 0 a 11 + tareas 0.1 a 0.4).**

**Cómo usar este documento:** el trabajo vigente es el **Plan v2** (`docs/plan-v2.md`, alcance acordado el 17/11/2026), dividido en las Fases 0 a 5. Cada tarea tiene criterios de aceptación: se marca `[x]` solo cuando se cumplen todos. Las fases van en orden; dentro de una fase, también salvo que se indique lo contrario. Los Módulos 0 a 11 quedan al final como historial.

**Fuera de alcance por ahora** (no agregar sin confirmarlo con Marcos): multi-cliente, factura electrónica, requisitos técnicos de producción (entornos, backups, monitoreo, CI), integración con Mercado Pago, código de barras, descuentos, precios por medio de pago, señas, ticket digital, varias cajas, recordatorios por WhatsApp y todas las funciones avanzadas.

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

## Fase 0 · Cierre y arreglos rápidos

- [x] **0.1 Commit del retiro del modo offline.**
  - [x] Todo el trabajo pendiente del Módulo 11 está en un commit (`56ea8f5`), con `estado-conexion.tsx`, `conexion.ts`, `use-en-linea.ts`, la migración `0013` y `e2e/`.
  - [x] No entra ningún `.env`, `.env.e2e` ni credencial (`.env` y `.env.*` en `.gitignore`).
  - [x] `tsc -b`, `npm run lint` y `npm run build` pasan.
- [x] **0.2 Aplicar la migración `0013_storage_borrar_fotos.sql` en Supabase.**
  - [x] La política `fotos_productos_delete` existe en `storage.objects`.
  - [x] Al reemplazar la foto de un producto, el archivo anterior desaparece del bucket `fotos-productos` y la foto nueva se ve en el listado y en el POS.
  - [x] La foto de un producto dado de baja no se borra.
- [x] **0.3 Venta duplicada** (`src/pages/ventas-page.tsx`).
  - [x] El id de la venta (`ventaId`) es uno solo mientras el POS está abierto: no cambia aunque se agreguen, quiten o cambien cantidades, ni después de un intento fallido.
  - [x] Se renueva solo cuando la venta se confirma (se vuelve al Dashboard) o cuando el vendedor sale del POS a propósito: "Nueva Venta" del Dashboard abre el POS de cero. El prototipo del POS no tiene botón "Vaciar carrito", así que no se agregó.
  - [x] Si el primer intento sí llegó a la base y el carrito cambió, el reintento devuelve esa misma venta (no crea otra ni descuenta stock dos veces). El modal avisa que la venta quedó distinta del carrito, el ticket muestra lo registrado y no se vuelve solo al Dashboard.
  - [x] Un error que no es transitorio (sin stock, permiso) no bloquea el carrito.
  - [x] Probado a mano con los productos "PRUEBA - …" (corte de red al confirmar, cambio del carrito y reintento).
- [x] **0.4 Confirmación antes de "Dar de baja" un producto** (menú "⋯" del listado de Productos).
  - [x] "Dar de baja" abre un modal de confirmación con el nombre del producto. No había un componente reutilizable (solo el modal interno del Cierre de Caja): se creó `ConfirmarModal` (`src/components/confirmar-modal.tsx`) con su estilo, y el Cierre de Caja pasó a usarlo sin cambiar textos.
  - [x] Cancelar (botón, Escape o clic afuera) no cambia nada. Confirmar da de baja igual que antes; si falla, el error queda en el modal.
  - [x] "Reactivar" no pide confirmación.
  - [x] Probado a mano (baja, cancelar, reactivar y cierre de caja con el modal nuevo).

## Fase 1 · Usuarios y control

- [ ] **1.1 Auditoría.**
  - [ ] Tabla `auditoria`: usuario, fecha, acción, entidad, id de la entidad, datos antes y datos después (`jsonb`).
  - [ ] Se registra desde funciones o triggers SQL, nunca desde el frontend. Nadie tiene INSERT, UPDATE ni DELETE directo sobre la tabla (RLS).
  - [ ] Cubre como mínimo: anulación de venta, devolución y cambio, ajuste de stock, edición de precio, movimiento de caja, y alta y baja de usuario. Las acciones de fases posteriores se suman a la auditoría cuando se implementan.
  - [ ] Pantalla de consulta solo para el Dueño/a, con filtro por fecha, usuario y acción. El Vendedor no la ve ni puede leer la tabla (RLS).
- [ ] **1.2 Permiso "Puede editar precios".**
  - [ ] Columna en `perfiles` (falso por defecto). Solo el Dueño/a la cambia, desde Usuarios.
  - [ ] Se controla en la base: un Vendedor sin el permiso que intenta cambiar `productos.precio` (por la API o por la app) recibe un error, aunque el campo no esté oculto.
  - [ ] En el formulario de producto, el campo precio queda deshabilitado para el Vendedor sin el permiso. Puede seguir dando de alta productos y editar el resto de los datos.
  - [ ] El Dueño/a siempre puede editar precios.
  - [ ] Aplica también a la edición de precios en lote (4.4).
  - [ ] Cada cambio de precio queda en auditoría (1.1).
- [ ] **1.3 Contraseñas y email del Dueño/a.**
  - [ ] Cada usuario puede cambiar su propia contraseña desde el menú de usuario, ingresando la actual y la nueva (mínimo 6 caracteres, igual que `crear_vendedor`).
  - [ ] El Dueño/a puede resetear la contraseña de un Vendedor desde Usuarios, sin conocer la anterior. Queda en auditoría (1.1).
  - [ ] El Dueño/a tiene un email real cargado en Supabase Auth en lugar del interno, y sigue entrando con su nombre de usuario (el Login busca el email real del Dueño/a sin mostrarlo).
  - [ ] "Olvidé mi contraseña" en el Login: envía el email de recuperación solo si el usuario es el Dueño/a. Para un Vendedor, el mensaje indica que le pida el reseteo al Dueño/a, sin revelar si el usuario existe.
  - [ ] El link del email abre una pantalla para elegir la contraseña nueva, y después se entra normalmente.
  - [ ] Los Vendedores siguen con emails internos (`<usuario>@showroomciro.internal`): `crear_vendedor` no cambia.

## Fase 2 · Cobros y caja

- [ ] **2.1 Pagos por venta + medios nuevos.**
  - [ ] Tabla `venta_pagos` (venta, medio, monto > 0). Enum de medios: `efectivo | debito | transferencia | qr_mp`.
  - [ ] Se saca `medio_pago` de `ventas`. La migración pasa cada venta existente a un pago por su total, con "tarjeta" → `debito`. Al 17/11/2026 la base tiene 0 ventas: la migración tiene que funcionar igual con 0 filas.
  - [ ] `registrar_venta` recibe la lista de pagos y rechaza la venta si la suma no es igual al total que calcula la base, o si hay un medio fuera del enum. Sigue siendo atómica e idempotente por `p_venta_id`.
  - [ ] POS (checkout): se pueden agregar varios pagos, se ve cuánto falta, y "Confirmar Venta" se habilita solo cuando lo pagado es igual al total. El vuelto se calcula solo sobre el efectivo. No aparece la opción de crédito.
  - [ ] El ticket muestra cada pago con su medio y monto.
  - [ ] `cerrar_caja`, el Historial de caja y los reportes leen los pagos de `venta_pagos`.
- [ ] **2.2 Movimientos de caja y cobros de cuentas en la caja.**
  - [ ] Tabla `caja_movimientos`: tipo (`gasto | retiro | ingreso_cambio | devolucion`), monto > 0, motivo, usuario, caja y fecha.
  - [ ] Solo se cargan en la caja abierta. `devolucion` no se carga a mano: la genera 3.3.
  - [ ] `cuenta_pagos` suma `medio_pago` (mismo enum que 2.1) y `caja_id`. Los cobros ya existentes se migran (medio y caja a definir en la migración según lo que haya en la base).
  - [ ] `registrar_pago` exige caja abierta y la registra en el cobro. Sin caja abierta, la base rechaza el cobro y la app lo explica. El modal de cobro pide el medio de pago.
  - [ ] `cerrar_caja` calcula el efectivo esperado como apertura + ventas en efectivo + cobros de cuentas en efectivo + ingresos − gastos − retiros − devoluciones.
  - [ ] Cada movimiento queda en auditoría (1.1).
- [ ] **2.3 Resumen del cierre por medio de pago.**
  - [ ] En el Historial de caja (solo Dueño/a), cada caja muestra el total por medio (efectivo, débito, transferencia, QR MP) y los movimientos de 2.2. Hoy el Historial ya separa por medio con la columna vieja: se adapta a `venta_pagos`.
  - [ ] La pantalla de Cierre sigue siendo "a ciegas": quien cierra no ve el esperado, la diferencia ni los totales por medio.

## Fase 3 · Clientes y postventa

- [ ] **3.1 Ficha de cliente.**
  - [ ] Tabla `clientes`. La venta puede tener un cliente opcional, que se elige o se crea desde el POS.
  - [ ] La ficha muestra el historial de compras del cliente y sus cuentas.
  - [ ] Cuentas se unifica con clientes: cada cuenta pertenece a un cliente y no hay dos fichas paralelas. Las cuentas existentes se migran a clientes sin perder pagos ni saldos.
- [ ] **3.2 Anular venta.**
  - [ ] Solo mientras la caja en la que se hizo la venta siga abierta. Si ya se cerró, la base lo rechaza y la app ofrece una devolución (3.3).
  - [ ] Pide un motivo obligatorio.
  - [ ] Revierte el stock de todos los ítems y saca los pagos de esa caja, así que el esperado del cierre ya no los cuenta. La venta queda marcada como anulada, no se borra.
  - [ ] Queda en auditoría (1.1).
- [ ] **3.3 Cambios y devoluciones.**
  - [ ] Parte de una venta existente: se eligen los ítems que vuelven y, si es un cambio, los que salen.
  - [ ] El stock se ajusta solo.
  - [ ] Si la diferencia es a favor del cliente, sale en efectivo de la caja abierta como movimiento `devolucion` (2.2), sin importar el medio original. Si la prenda nueva es más cara, la diferencia se cobra con cualquier medio. No hay saldo a favor ni vales.
  - [ ] Requiere caja abierta.
  - [ ] Avisa si la devolución supera el efectivo esperado de la caja.
  - [ ] Queda en auditoría (1.1).

## Fase 4 · Productos

- [ ] **4.1 Temporadas, colecciones y talles configurables.**
  - [ ] Tablas `temporadas` y `curvas_talles` (letras, numérico, jean). Un producto pertenece a una temporada y a una curva de talles.
  - [ ] Liquidación = marcar una temporada como liquidación.
  - [ ] Las variantes existentes se migran sin que cambie ningún SKU ya generado.
- [ ] **4.2 Fotos por color.**
  - [ ] La foto pasa a pertenecer a producto + color. El POS y el modal de variante muestran la foto del color elegido.
  - [ ] Usa el bucket `fotos-productos` y el borrado de la foto reemplazada (0013).
  - [ ] Las fotos actuales de producto se conservan (pasan a todos los colores o quedan como foto general).
- [ ] **4.3 Inventario por conteo.**
  - [ ] Se carga el stock contado por variante, el sistema muestra las diferencias contra el stock del sistema, y al confirmar genera los `ajustes_stock` correspondientes.
  - [ ] Cancelar antes de confirmar no cambia el stock.
  - [ ] Queda en auditoría (1.1).
- [ ] **4.4 Excel y precios en lote.**
  - [ ] Exportar e importar productos con sus variantes. La importación valida el archivo y muestra los errores antes de guardar.
  - [ ] Subir o bajar precios en % o monto, filtrando por categoría o temporada, con vista previa antes de aplicar.
  - [ ] Respeta el permiso "Puede editar precios" (1.2) y queda en auditoría.
  - [ ] El formato del archivo incluye temporada, curva de talles y fotos por color (4.1 y 4.2).

## Fase 5 · Cierre y prueba

- [ ] **5.1 Backlog visual** (`design.md` → "Backlog visual"): cada punto queda ajustado o aceptado explícitamente.
- [ ] **5.2 Flujo completo con el usuario Vendedor:** alta de producto, venta con pago dividido, cobro de cuenta, ajuste de stock, movimiento de caja, devolución y cierre de caja. Sin errores de permisos y sin acceso a costos, reportes ni auditoría.
- [ ] **5.3 Prueba en celular real:** Safari (iPhone) y Chrome (Android). Acceso de solo consulta, Configuración → Usuarios, e instalación como PWA.
- [ ] **5.4 Re-correr TestSprite** con el plan regenerado desde el `prd.md` actualizado (ver "Plan de TestSprite" abajo), incluidos TC007, TC008 y TC011. Todos pasan, o cada falla queda explicada.

---

## Riesgos y advertencias
- **Devolución en efectivo de una venta cobrada por otro medio**: el que devuelve puede sacar efectivo de la caja contra un débito o una transferencia. No hay permiso que lo limite (decisión tomada), así que la **auditoría (1.1) es el único control**. Por eso va antes.
- **Devolución sin efectivo suficiente**: el sistema tiene que avisar si el monto supera el efectivo esperado de la caja.
- **Impresora térmica sin probar**: el ticket va a cambiar (pago dividido, devoluciones). Se recomienda al menos una prueba real antes de entregar.
- **Fuera de alcance, pero obligatorio antes de cargar datos reales**: separar la base de desarrollo de la de producción y tener backups. Se retoma al planificar el deploy.

---

## Referencias

### Plan de TestSprite (para 5.4)
Corrida anterior: 31 tests, 28 pasaron, TC011 falló, TC007 y TC008 bloqueados. Regenerar el plan desde el `prd.md` actualizado, con las contraseñas nuevas, y revisar que quede así:
- **Se eliminan TC008** ("Continue a sale offline and sync it later") **y TC019** ("Review offline sales waiting to sync"): prueban el modo offline, que se descartó.
- **TC011 se reescribe** como "Cerrar la caja a conteo ciego y ver la diferencia en el Historial".
- **TC007 se divide**: en TestSprite, alta de producto con variante y sin foto (verifica el SKU). Con Playwright, alta con foto (`setInputFiles`).

### Datos de prueba cargados en la base
Verificado en el SQL Editor el 17/11/2026: **0 productos, 0 variantes, 0 ventas, 7 cajas y 2 usuarios.** El catálogo y las ventas de prueba de los Módulos 4 a 11 y de TestSprite ya no están. Quedan:
- **7 cajas** de las pruebas anteriores (aperturas y cierres de desarrollo).
- **2 usuarios.**
- Lo que cargue el script de productos de prueba para probar la 0.3: productos con nombre **"PRUEBA - …"**, para borrarlos antes de producción.

El reset antes de producción queda fuera del Plan v2.

---

## Historial: Módulos 0 a 11 (completos)

### Módulo 0 — Setup del proyecto (VSCode + Claude Code) ✅ COMPLETO
- [x] Crear el proyecto con Vite + React + TypeScript.
- [x] Crear carpeta `/docs` y copiar ahí: `requirements.md`, `design.md`, `contexto-diseno-showroomciro.md`, `prd.md`, `tasks.md`.
- [x] Crear carpeta `/prototipos` con los exports de Claude Design.
- [x] Copiar `CLAUDE.md` a la raíz del proyecto.
- [x] Ejecutar `/init` en Claude Code.
- [x] Ejecutar `/context` para confirmar uso de tokens.
- [x] Inicializar git y crear el repositorio remoto en GitHub.

---

### Módulo 1 — Base de datos (Supabase) ✅ COMPLETO
- [x] Crear el proyecto en Supabase.
- [x] Crear las tablas según el modelo de datos de `design.md` (incluye `productos_costos`, agregada durante la ejecución para poder ocultar el costo al Vendedor vía RLS row-level).
- [x] Definir relaciones (foreign keys) y constraints (stock no negativo, montos no negativos, `on delete restrict` en `cuenta_pagos` para no perder historial de cobros).
- [x] Configurar **Row Level Security (RLS)** por rol (sin políticas de DELETE en tablas de auditoría: `ventas`, `venta_items`, `cajas`, `ajustes_stock`, `cuenta_pagos`, `perfiles`).
- [x] Configurar el bucket de **Storage** (`fotos-productos`, público) para fotos de producto — versionado en `supabase/migrations/0005_storage.sql` (bucket + políticas, idempotente).
- [x] Cargar datos de prueba (seed): 2 categorías, 1 producto con 2 variantes, 1 usuario Dueño/a (`ciro`) y 1 Vendedor (`vendedor1`).

---

### Módulo 2 — Funciones y vistas SQL (lógica de negocio) ✅ COMPLETO
> Corrección de alcance: se resuelve con funciones/vistas nativas de Postgres, no con Edge Functions (Deno) — evita sumar un runtime serverless aparte para lógica que SQL ya resuelve. Ver nota en `design.md`, sección Arquitectura técnica.
- [x] Trigger `BEFORE INSERT` en `variantes`: genera el SKU interno automático (ej. `SC-001-AZ-M`).
- [x] Función RPC `cerrar_caja(caja_id, monto_contado)`.
- [x] Vista `cuentas_vista`.
- [x] Vistas/funciones de reportes (incluye extras: `reportes_cuentas_pendientes_vista`, `reporte_ventas_rango`, `reporte_top_productos_rango`).
- [x] Endurecimiento de RLS post-auditoría (ventas/cajas/venta_items sin UPDATE, SELECT acotado del Vendedor, `caja_actual_resumen()`, caja única abierta) — ver detalle en `design.md`.

---

### Módulo 3 — Autenticación y roles ✅ COMPLETO
- [x] Configurar Supabase Auth con el mapeo usuario→email técnico (`nombre_usuario@showroomciro.internal`).
- [x] Tabla de perfiles vinculada a `auth.users`, con campo `rol` (dueño/vendedor) — ya existe desde el Módulo 1.
- [x] Pantalla de **Login** conectada (según prototipo).
- [x] Middleware/guard de rutas por rol en el frontend (complementa RLS, no lo reemplaza).

---

### Módulo 4 — Frontend: Núcleo, layout y sesión ✅ COMPLETO
- [x] Setup de routing.
- [x] Layout con sidebar (desktop) y menú inferior (mobile), según prototipos — sin ítem "Ventas", con "Cuentas" en vez de "Fiados".
- [x] Pantalla **Apertura de Caja** (bloqueante post-login).
- [x] Pantalla **Dashboard** con KPIs del día y panel de Alertas (stock bajo, cuentas por vencer) — umbral por variante en `variantes.stock_minimo` (migración `0006_stock_minimo.sql`).
- [x] Bloque de usuario en el header clickeable → "Cerrar sesión".
- [x] Lógica de **logout automático** al confirmar Cierre de Caja — `useAuth().logout()` disponible; se conecta al confirmar el cierre en el Módulo 8.

---

### Módulo 5 — Frontend: Productos y Stock ✅ COMPLETO
- [x] Pantalla **Productos — Listado**.
- [x] Pantalla **Productos — Alta/Edición** (formulario en 2 pasos: datos generales + variantes).
- [x] Acción/modal **Ajuste de Stock** — atómico vía trigger en `ajustes_stock` (migración `0007_ajustes_stock.sql`, ver `design.md`).

---

### Módulo 6 — Frontend: Ventas (POS) ✅ COMPLETO
- [x] Pantalla **Ventas (POS)**: buscador + grilla visual + carrito.
- [x] Modal de **selección de variante** (talle/color).
- [x] **Checkout**: solo medios de pago directos (efectivo/transferencia/tarjeta), sin opción de fiado.
- [x] Impresión de ticket vía `window.print()` con formato de impresora térmica.
- [x] Redirección automática al Dashboard al confirmar la venta.

---

### Módulo 7 — Frontend: Cuentas ✅ COMPLETO
- [x] Pantalla **Cuentas — Agenda** (lista + toggle calendario, consultando `cuentas_vista`), sin botón propio de alta. Las cuentas pagadas van en una sección plegable aparte.
- [x] Pantalla **Cuentas — Alta**, accedida desde el botón "Nueva Cuenta" del Dashboard.
- [x] Pantalla **Cuentas — Detalle/Cobro** (registro de abonos) — atómico vía RPC `registrar_pago()` (migración `0009_registrar_pago.sql`) + endurecimiento de `cuentas`/`cuenta_pagos` (migración `0010_rls_cuentas.sql`, ver `design.md`).

---

### Módulo 8 — Frontend: Caja ✅ COMPLETO
- [x] Pantalla **Caja — Cierre** (conteo + diferencia vía RPC `cerrar_caja` + aviso de logout automático) — a conteo ciego, con modal de confirmación y logout solo si la RPC responde OK (ver `design.md`).
- [x] Pantalla **Caja — Historial** — solo Dueño/a, solo lectura (ver `design.md`).

---

### Módulo 9 — Frontend: Reportes y Usuarios (desktop) ✅ COMPLETO
- [x] Pantalla **Reportes** (solo Dueño/a): ventas por período, top productos, ticket promedio, cuentas pendientes — fuera del bloqueo de apertura de caja (ver `design.md`).
- [x] Pantalla **Gestión de Usuarios** (solo Dueño/a): alta de Vendedores vía RPC `crear_vendedor()` (migración `0011_crear_vendedor.sql`) y desactivar/reactivar vía `perfiles.activo` — fuera del bloqueo de apertura de caja (ver `design.md`).

---

### Módulo 10 — Frontend: Mobile (acceso remoto) ✅ COMPLETO
- [x] **Dashboard mobile** (solo consulta).
- [x] **Cuentas mobile** (solo consulta).
- [x] **Reportes mobile** (solo consulta).
- [x] **Configuración mobile** → Gestión de Usuarios (única sección con acción real permitida desde el celular).

---

### Módulo 11 — Offline-first (POS del mostrador) ✅ COMPLETO (offline descartado por ahora)
> Se implementó completo (cola de ventas en IndexedDB con Dexie, sincronización automática, pantalla "Ventas sin sincronizar", arranque sin conexión) y después se **sacó del sistema** por complejidad, para evaluarlo en el futuro (ver `design.md` → "Modo offline (descartado por ahora)"; el código queda en el historial de git, commits del Módulo 11).
- [x] Se mantiene la **PWA instalable**: `vite-plugin-pwa` con manifest, íconos y precache de la interfaz; versiones nuevas se aplican en el login. Íconos **provisorios** desde el mockup del logo: regenerar con `scripts/generar-iconos-pwa.cjs --fuente` cuando esté el archivo original (commit aparte).
- [x] Se eliminó todo lo de vender o guardar sin conexión: base local Dexie (catálogo, perfil y caja guardados, cola de ventas), sincronización, modo "sesión offline", pantalla `/ventas/pendientes`, indicador de ventas por sincronizar, ticket "Pendiente de sincronizar" y bloqueo del cierre por ventas sin sincronizar. Sin `dexie` ni `dexie-react-hooks`.
- [x] Sin conexión: pastilla "Sin conexión" en el header, acciones que escriben en la base bloqueadas, el carrito no se pierde, reintento de venta con el mismo id (no duplica) y pantalla "Sin conexión" con "Reintentar" al arrancar sin red.
- [x] La base no se tocó: la migración `0012_registrar_venta_fecha.sql` queda (`p_fecha` opcional, sin uso). Antes de sacar la cola se verificó que no quedaran ventas sin sincronizar: la app solo se usó en la PC de desarrollo (Edge, `localhost:5173`), con ventas de prueba.
- [x] Caché de fotos de producto: se mantiene, con **nombre de archivo único** por foto y borrado de la anterior (migración `0013_storage_borrar_fotos.sql`, aplicada en Supabase en la tarea 0.2).

---

**Estado: MVP entregado el 18/11/2026 (Módulos 0 a 11 + tareas 0.1 a 0.4). Plan v2 (Fases 1 a 5) en pausa.**
