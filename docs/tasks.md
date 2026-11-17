# tasks.md — ShowroomCiro (Fase 4)

**Cómo usar este documento:** cada Módulo está pensado para trabajarse en una **sesión separada de Claude Code** (`New Session` / `/clear` entre uno y otro, como indica la Etapa 3 del flujo de desarrollo). Seguí el orden: los módulos 1-3 son la base y no son paralelizables entre sí; a partir del módulo 4 sí se pueden paralelizar varios frontends en chats distintos porque ya tienen el schema real contra el cual trabajar.

---

## Módulo 0 — Setup del proyecto (VSCode + Claude Code)
- [x] Crear el proyecto con Vite + React + TypeScript.
- [x] Crear carpeta `/docs` y copiar ahí: `requirements.md`, `design.md`, `contexto-diseno-showroomciro.md`, `prd.md`, `tasks.md`.
- [x] Crear carpeta `/prototipos` con los exports de Claude Design.
- [x] Copiar `CLAUDE.md` a la raíz del proyecto.
- [x] Ejecutar `/init` en Claude Code.
- [x] Ejecutar `/context` para confirmar uso de tokens.
- [x] Inicializar git y crear el repositorio remoto en GitHub.

---

## Módulo 1 — Base de datos (Supabase) ✅ COMPLETO
- [x] Crear el proyecto en Supabase.
- [x] Crear las tablas según el modelo de datos de `design.md` (incluye `productos_costos`, agregada durante la ejecución para poder ocultar el costo al Vendedor vía RLS row-level).
- [x] Definir relaciones (foreign keys) y constraints (stock no negativo, montos no negativos, `on delete restrict` en `cuenta_pagos` para no perder historial de cobros).
- [x] Configurar **Row Level Security (RLS)** por rol (sin políticas de DELETE en tablas de auditoría: `ventas`, `venta_items`, `cajas`, `ajustes_stock`, `cuenta_pagos`, `perfiles`).
- [x] Configurar el bucket de **Storage** (`fotos-productos`, público) para fotos de producto — versionado en `supabase/migrations/0005_storage.sql` (bucket + políticas, idempotente).
- [x] Cargar datos de prueba (seed): 2 categorías, 1 producto con 2 variantes, 1 usuario Dueño/a (`ciro`) y 1 Vendedor (`vendedor1`).

---

## Módulo 2 — Funciones y vistas SQL (lógica de negocio)
> Corrección de alcance: se resuelve con funciones/vistas nativas de Postgres, no con Edge Functions (Deno) — evita sumar un runtime serverless aparte para lógica que SQL ya resuelve. Ver nota en `design.md`, sección Arquitectura técnica.
- [x] Trigger `BEFORE INSERT` en `variantes`: genera el SKU interno automático (ej. `SC-001-AZ-M`).
- [x] Función RPC `cerrar_caja(caja_id, monto_contado)`.
- [x] Vista `cuentas_vista`.
- [x] Vistas/funciones de reportes (incluye extras: `reportes_cuentas_pendientes_vista`, `reporte_ventas_rango`, `reporte_top_productos_rango`).
- [x] Endurecimiento de RLS post-auditoría (ventas/cajas/venta_items sin UPDATE, SELECT acotado del Vendedor, `caja_actual_resumen()`, caja única abierta) — ver detalle en `design.md`.

---

## Módulo 3 — Autenticación y roles ✅ COMPLETO
- [x] Configurar Supabase Auth con el mapeo usuario→email técnico (`nombre_usuario@showroomciro.internal`).
- [x] Tabla de perfiles vinculada a `auth.users`, con campo `rol` (dueño/vendedor) — ya existe desde el Módulo 1.
- [x] Pantalla de **Login** conectada (según prototipo).
- [x] Middleware/guard de rutas por rol en el frontend (complementa RLS, no lo reemplaza).

---

## Módulo 4 — Frontend: Núcleo, layout y sesión ✅ COMPLETO
- [x] Setup de routing.
- [x] Layout con sidebar (desktop) y menú inferior (mobile), según prototipos — sin ítem "Ventas", con "Cuentas" en vez de "Fiados".
- [x] Pantalla **Apertura de Caja** (bloqueante post-login).
- [x] Pantalla **Dashboard** con KPIs del día y panel de Alertas (stock bajo, cuentas por vencer) — umbral por variante en `variantes.stock_minimo` (migración `0006_stock_minimo.sql`).
- [x] Bloque de usuario en el header clickeable → "Cerrar sesión".
- [x] Lógica de **logout automático** al confirmar Cierre de Caja — `useAuth().logout()` disponible; se conecta al confirmar el cierre en el Módulo 8.

---

## Módulo 5 — Frontend: Productos y Stock ✅ COMPLETO
- [x] Pantalla **Productos — Listado**.
- [x] Pantalla **Productos — Alta/Edición** (formulario en 2 pasos: datos generales + variantes).
- [x] Acción/modal **Ajuste de Stock** — atómico vía trigger en `ajustes_stock` (migración `0007_ajustes_stock.sql`, ver `design.md`).

---

## Módulo 6 — Frontend: Ventas (POS)
- [x] Pantalla **Ventas (POS)**: buscador + grilla visual + carrito.
- [x] Modal de **selección de variante** (talle/color).
- [x] **Checkout**: solo medios de pago directos (efectivo/transferencia/tarjeta), sin opción de fiado.
- [x] Impresión de ticket vía `window.print()` con formato de impresora térmica.
- [x] Redirección automática al Dashboard al confirmar la venta.

---

## Módulo 7 — Frontend: Cuentas ✅ COMPLETO
- [x] Pantalla **Cuentas — Agenda** (lista + toggle calendario, consultando `cuentas_vista`), sin botón propio de alta. Las cuentas pagadas van en una sección plegable aparte.
- [x] Pantalla **Cuentas — Alta**, accedida desde el botón "Nueva Cuenta" del Dashboard.
- [x] Pantalla **Cuentas — Detalle/Cobro** (registro de abonos) — atómico vía RPC `registrar_pago()` (migración `0009_registrar_pago.sql`) + endurecimiento de `cuentas`/`cuenta_pagos` (migración `0010_rls_cuentas.sql`, ver `design.md`).

---

## Módulo 8 — Frontend: Caja ✅ COMPLETO
- [x] Pantalla **Caja — Cierre** (conteo + diferencia vía RPC `cerrar_caja` + aviso de logout automático) — a conteo ciego, con modal de confirmación y logout solo si la RPC responde OK (ver `design.md`).
- [x] Pantalla **Caja — Historial** — solo Dueño/a, solo lectura (ver `design.md`).

---

## Módulo 9 — Frontend: Reportes y Usuarios (desktop) ✅ COMPLETO
- [x] Pantalla **Reportes** (solo Dueño/a): ventas por período, top productos, ticket promedio, cuentas pendientes — fuera del bloqueo de apertura de caja (ver `design.md`).
- [x] Pantalla **Gestión de Usuarios** (solo Dueño/a): alta de Vendedores vía RPC `crear_vendedor()` (migración `0011_crear_vendedor.sql`) y desactivar/reactivar vía `perfiles.activo` — fuera del bloqueo de apertura de caja (ver `design.md`).

---

## Módulo 10 — Frontend: Mobile (acceso remoto)
- [x] **Dashboard mobile** (solo consulta).
- [x] **Cuentas mobile** (solo consulta).
- [x] **Reportes mobile** (solo consulta).
- [x] **Configuración mobile** → Gestión de Usuarios (única sección con acción real permitida desde el celular).

---

## Módulo 11 — Offline-first (POS del mostrador) ⛔ DESCARTADO (por ahora)
> Se implementó completo (cola de ventas en IndexedDB con Dexie, sincronización automática, pantalla "Ventas sin sincronizar", arranque sin conexión) y después se **sacó del sistema** por complejidad, para evaluarlo en el futuro (ver `design.md` → "Modo offline (descartado por ahora)"; el código queda en el historial de git, commits del Módulo 11).
- [x] Se mantiene la **PWA instalable**: `vite-plugin-pwa` con manifest, íconos y precache de la interfaz; versiones nuevas se aplican en el login. Íconos **provisorios** desde el mockup del logo: regenerar con `scripts/generar-iconos-pwa.cjs --fuente` cuando esté el archivo original (commit aparte).
- [x] Se eliminó todo lo de vender o guardar sin conexión: base local Dexie (catálogo, perfil y caja guardados, cola de ventas), sincronización, modo "sesión offline", pantalla `/ventas/pendientes`, indicador de ventas por sincronizar, ticket "Pendiente de sincronizar" y bloqueo del cierre por ventas sin sincronizar. Sin `dexie` ni `dexie-react-hooks`.
- [x] Sin conexión: pastilla "Sin conexión" en el header, acciones que escriben en la base bloqueadas, el carrito no se pierde, reintento de venta con el mismo id (no duplica) y pantalla "Sin conexión" con "Reintentar" al arrancar sin red.
- [x] La base no se tocó: la migración `0012_registrar_venta_fecha.sql` queda (`p_fecha` opcional, sin uso). Antes de sacar la cola se verificó que no quedaran ventas sin sincronizar: la app solo se usó en la PC de desarrollo (Edge, `localhost:5173`), con ventas de prueba.
- [x] Caché de fotos de producto: se mantiene, con **nombre de archivo único** por foto y borrado de la anterior (migración `0013_storage_borrar_fotos.sql`, **pendiente de aplicar** en Supabase).

---

## Módulo 12 — QA y pruebas automatizadas
- [x] Validación visual manual de cada pantalla contra su prototipo de Claude Design (correcciones en `adff38d`; lo que quedó sin ajustar está en el backlog visual de `design.md`).
- [ ] Validación con **Chrome DevTools MCP**: ejecutar flujos reales (alta de producto, venta completa, apertura/cierre de caja, alta de cuenta) y capturar screenshots.
- [x] Confirmar que `/docs/prd.md` está completo y actualizado (cierre a conteo ciego con la diferencia en el Historial; sin venta offline).
- [x] Configurar **TestSprite MCP** con la API key.
- [x] Ejecutar la batería de pruebas E2E contra `@docs/prd.md` (31 tests: 28 pasaron, TC011 falló, TC007 y TC008 bloqueados).
- [ ] Revisar el reporte de TestSprite y corregir los tests fallidos — **abierto hasta re-correr TC011 y TC007** (ver plan abajo). Se re-corren después del próximo módulo (fotos por color), que cambia el formulario de alta de producto.
- [ ] Pruebas con **Playwright** del comportamiento sin conexión y de la venta con conexión, sobre el build de producción (`npm run test:e2e`, `e2e/sin-conexion.spec.ts`; credenciales en `.env.e2e`, fuera del repo).
- [ ] Reset de datos de prueba (ventas, ajustes de stock, cajas y productos de prueba cargados durante el desarrollo; ver inventario abajo) y carga del stock real contado a mano, antes de habilitar el sistema en producción.

### Plan de TestSprite (para cuando se regenere)
Regenerar el plan desde el `prd.md` actualizado, con las contraseñas nuevas, y revisar que quede así:
- **Se eliminan TC008** ("Continue a sale offline and sync it later") **y TC019** ("Review offline sales waiting to sync"): prueban el modo offline, que se descartó. Si al regenerar aparece algún test de venta sin conexión, se saca.
- **TC011 se reescribe** como "Cerrar la caja a conteo ciego y ver la diferencia en el Historial": el Dueño/a abre la caja, hace una venta en efectivo y va a Cerrar Caja; se verifica que **no** se muestran el monto esperado ni la diferencia, ingresa el conteo y confirma; la sesión se cierra sola. Vuelve a entrar y en `/caja/historial` ve el esperado, el contado y la diferencia de esa caja. (Falló porque el PRD viejo pedía ver la diferencia antes de cerrar.)
- **TC007 se divide** (TestSprite no tiene un archivo de imagen para subir):
  - En **TestSprite**: alta de producto con variante y **sin foto** (la foto es opcional), verificando que se genera el SKU.
  - Con **Playwright**, a mano: alta con foto y variante (`setInputFiles` con una imagen de prueba); la foto se ve en el listado y en el POS.
- TC011 y TC007 se re-corren **después del módulo de fotos por color**.

### Inventario de datos de prueba cargados en la base
Todo esto se borra en el reset antes de producción:
- Seed del Módulo 1 (2 categorías, 1 producto con 2 variantes, usuarios `ciro` y `vendedor1`) y lo cargado a mano durante los Módulos 4–11 (productos, ventas, cuentas, cobros, ajustes de stock, cajas).
- Lo que cargaron las corridas de TestSprite (altas de producto, ventas, cuentas, cobros, vendedores, cajas).
- Caja abierta por `ciro` el 20/10/2026 a las 21:45, probando el sistema.

---

## Pendientes antes de producción
- [ ] Aplicar en Supabase la migración `0013_storage_borrar_fotos.sql` (borrado de la foto reemplazada).
- [ ] Prueba en **celular real**: Safari (iPhone) y Chrome (Android) — acceso de solo consulta, Configuración → Usuarios e instalación como PWA.
- [ ] Prueba con la **impresora térmica real** (ticket de venta).
- [ ] Un flujo completo hecho por el **Vendedor**: alta de producto, cobro de cuenta y ajuste de stock.
- [ ] **Confirmación antes de "Dar de baja"** un producto (hoy se da de baja directo desde el menú "⋯" del listado).
- [ ] Resolver el **backlog visual** de `design.md` (ajustar o aceptar cada punto).
- [ ] **Deploy a Vercel** (pausado).
- [ ] **Regenerar el plan de TestSprite** con las contraseñas nuevas (ver "Plan de TestSprite" arriba).

---

**Estado: Módulos 0 a 10 completos. Módulo 11 (offline) descartado por ahora: queda la PWA instalable con aviso "Sin conexión". Módulo 12 (QA) en curso; próximo módulo: fotos por color.**
