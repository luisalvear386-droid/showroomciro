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

## Módulo 9 — Frontend: Reportes y Usuarios (desktop)
- [x] Pantalla **Reportes** (solo Dueño/a): ventas por período, top productos, ticket promedio, cuentas pendientes — fuera del bloqueo de apertura de caja (ver `design.md`).
- [ ] Pantalla **Gestión de Usuarios** (solo Dueño/a) — frontend listo; alta vía RPC `crear_vendedor()` (migración `0011_crear_vendedor.sql`). **Pendiente: aplicar 0011 en Supabase y probar el alta.**

---

## Módulo 10 — Frontend: Mobile (acceso remoto)
- [ ] **Dashboard mobile** (solo consulta).
- [ ] **Cuentas mobile** (solo consulta).
- [ ] **Reportes mobile** (solo consulta).
- [ ] **Configuración mobile** → Gestión de Usuarios (única sección con acción real permitida desde el celular).

---

## Módulo 11 — Offline-first (POS del mostrador)
- [ ] Cacheo local del catálogo de productos (Dexie/IndexedDB), actualizado cuando hay conexión.
- [ ] Cola local de ventas pendientes cuando no hay internet.
- [ ] Sincronización automática de la cola al recuperar conexión.
- [ ] Indicador visual en el POS de estado de conexión / ventas pendientes de sincronizar.
- [ ] Service Worker para que la PWA funcione sin conexión.

---

## Módulo 12 — QA y pruebas automatizadas
- [ ] Validación visual manual de cada pantalla contra su prototipo de Claude Design.
- [ ] Validación con **Chrome DevTools MCP**: ejecutar flujos reales (alta de producto, venta completa, apertura/cierre de caja, alta de cuenta) y capturar screenshots.
- [ ] Confirmar que `/docs/prd.md` está completo y actualizado.
- [ ] Configurar **TestSprite MCP** con la API key.
- [ ] Ejecutar la batería de pruebas E2E contra `@docs/prd.md`, puerto local y credenciales de prueba (Dueño/a y Vendedor).
- [ ] Revisar el reporte de TestSprite y corregir los tests fallidos.
- [ ] Reset de datos de prueba (ventas, ajustes de stock, cajas y productos de prueba cargados durante el desarrollo) y carga del stock real contado a mano, antes de habilitar el sistema en producción.

---

**Estado: Módulos 0 a 8 completos. Arrancando Módulo 9 (Frontend: Reportes y Usuarios).**
