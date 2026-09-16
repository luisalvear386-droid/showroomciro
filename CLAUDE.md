# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es este proyecto
Sistema de gestión interno para **ShowroomCiro**, una tienda de ropa de un (1) local físico único. No es un producto multi-tenant ni SaaS — es un sistema a medida para un solo negocio.

**Estado actual:** el repo es el scaffold por defecto de `npm create vite -- --template react-ts` (aún no es un repo git). Todavía no se instalaron `@supabase/supabase-js`, Dexie.js ni un router — eso corresponde al **Bloque 0** de `docs/tasks.md`. No asumas que existe infraestructura (rutas, cliente Supabase, estructura de carpetas `/components /pages /lib /hooks`) hasta haberla creado vos mismo.

## Comandos
```bash
npm run dev       # servidor de desarrollo (Vite)
npm run build     # type-check (tsc -b) + build de producción
npm run lint      # ESLint sobre todo el repo
npm run preview   # sirve el build de producción localmente
```
No hay test runner configurado todavía (ver Bloque 13/6 de `tasks.md` para E2E con TestSprite / Chrome DevTools MCP más adelante).

## Documentación de referencia (leer ANTES de programar cualquier módulo)
- `docs/requirements.md` — requisitos funcionales y reglas de negocio aprobadas (Fase 1).
- `docs/design.md` — arquitectura técnica completa, modelo de datos, paleta visual, inventario de pantallas (Fase 2). Fuente de verdad para nombres de tablas, endpoints y flujos de pantalla.
- `docs/contexto-diseno-showroomciro.md` — identidad visual: colores exactos, tipografía, reglas de layout.
- `docs/prd.md` — historias de usuario y criterios de aceptación (para pruebas E2E).
- `docs/tasks.md` — desglose de tareas por módulo/bloque (Fase 4) y **orden de desarrollo acordado**. Contiene la lista completa de bloques (0 a 13); no lo dupliques de memoria, consultalo directamente.
- `docs/ajustes-fase3-claude-design.md`, `docs/prompts-pantallas-claude-design.md` — historial de ajustes de diseño aplicados a los prototipos; útil para entender por qué un prototipo quedó como quedó.
- `prototipos/*.dc.html` — exports de Claude Design de las 17 pantallas aprobadas (Login, Dashboard, Ventas POS, Checkout, Apertura/Cierre/Historial de Caja, Productos Listado/Alta, Modal Variante, Stock Ajuste, Fiados Agenda/Detalle, Nueva Cuenta, Reportes, Usuarios, vistas Mobile). **Usar como referencia visual real, no reinventar el diseño** (colores, textos de botones, disposición de elementos). Son artboards standalone (`deck-stage.js`/`doc-page.js`/`support.js` los soportan) — no son componentes React a importar, son referencia para reconstruir la UI en `src/`.

## Arquitectura técnica (objetivo, por implementar según `docs/tasks.md`)
- **Frontend:** React + Vite + TypeScript, PWA offline-first (Dexie.js sobre IndexedDB para el POS del mostrador). Deploy en Vercel.
- **Backend/Datos:** Supabase — PostgreSQL + Autenticación + Storage (fotos de producto) + API autogenerada (PostgREST) + Edge Functions (TypeScript/Deno) para lógica de negocio custom (generación de SKU, diferencia de caja, estado de cuentas).
- **Autenticación:** login por usuario/contraseña (sin email visible al usuario), mapeado internamente a un email técnico para Supabase Auth. Roles: **Dueño/a** y **Vendedor**, impuestos con Row Level Security (RLS) en Postgres — no solo validados en el frontend.
- **Modelo de datos** (10 tablas, ver detalle y columnas exactas en `docs/design.md` sección "Modelo de datos"): `usuarios`, `categorias`, `productos`, `variantes`, `ventas`, `venta_items`, `ajustes_stock`, `cajas`, `cuentas`, `cuenta_pagos`.
- **Impresión de ticket:** HTML/CSS a medida de impresora térmica (58mm/80mm), vía `window.print()` — sin agente local ni SDK de impresora.

## Reglas de negocio clave (resumen — el detalle completo está en `docs/requirements.md`)
- Roles: **Dueño/a** (acceso total, incluidos reportes y costos) y **Vendedor** (vende, gestiona stock/productos, gestiona cuentas — sin ver reportes ni costos).
- Productos con variantes por **talle + color**; el sistema **genera el SKU automáticamente** (no hay lector de código de barras).
- **Apertura de caja obligatoria** antes de poder vender (pantalla bloqueante post-login, se salta si ya fue abierta ese día). **Cierre de caja** con conteo de efectivo + diferencia calculada, y **cierra la sesión automáticamente** al confirmar.
- Módulo **"Cuentas"** (clientes que se llevan algo fiado) es **independiente del checkout de venta** — no hay opción de fiado en el checkout. Se abre desde el botón "Nueva Cuenta" del Dashboard, que lleva a un formulario propio (la Agenda de Cuentas no tiene botón propio de alta).
- Acceso remoto (celular, solo Dueño/a): **solo consulta**, con **una única excepción**: la gestión de usuarios (alta/baja de Vendedores) sí permite acción real desde el celular, dentro de "Configuración".
- **Sin ítem "Ventas" en el menú de navegación** — la pantalla de venta (POS) se accede solo vía el botón de acción "Nueva Venta" del Dashboard, y al confirmar la venta se vuelve automáticamente al Dashboard.
- **Sin ícono de campana de notificaciones** — las alertas (stock bajo, cuentas por vencer) se muestran en el panel de Alertas del Dashboard y como badge en el ítem "Cuentas" del menú.
- **Modo offline-first** solo en el POS del mostrador: debe poder seguir vendiendo sin internet (catálogo cacheado + cola de ventas pendientes en IndexedDB) y sincronizar al reconectar. Apertura/cierre de caja y gestión de productos/usuarios **requieren conexión**, no se sincronizan offline.

## Convenciones de código
- Nombres de archivos y carpetas: `kebab-case`.
- Componentes React: `PascalCase`.
- Tablas y columnas en Supabase: `snake_case` en español, coherente con el modelo de datos de `docs/design.md` (`productos`, `variantes`, `cuentas`, `cuenta_pagos`, etc.).
- TypeScript estricto — evitar `any` salvo justificación explícita en un comentario.
- Commits siguiendo Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, etc.).

## Orden de desarrollo acordado
1. **Modelo de datos en Supabase** (tablas + RLS + Storage).
2. **Edge Functions** de lógica de negocio (generación de SKU, diferencia de caja, estado de cuentas).
3. **Autenticación** (usuario/contraseña + roles).
4. **Frontend** conectado directo a Supabase real — sin datos mockeados, el schema ya está definido.
5. **Capa offline-first** (Dexie + Service Worker) sobre el POS del mostrador.
6. **Pruebas E2E** (Chrome DevTools MCP + TestSprite).

Ver el detalle módulo por módulo (bloques 0 a 13) en `docs/tasks.md`. **No cambiar este orden sin señalarlo explícitamente como una desviación a confirmar con Marcos.**

## Qué NO hacer
- No agregar funcionalidades fuera de lo listado en `docs/requirements.md` (sección "Fuera de alcance") sin preguntar primero.
- No inventar pantallas, textos o componentes que no estén en los prototipos de Claude Design — si falta algo, preguntar antes de improvisar.
- No mockear datos de API una vez que el schema de Supabase ya existe — conectar contra la base real desde el principio.
