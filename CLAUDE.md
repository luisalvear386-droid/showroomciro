# ShowroomCiro — Contexto del Proyecto para Claude Code

## Qué es este proyecto
Sistema de gestión interno para **ShowroomCiro**, una tienda de ropa de un (1) local físico único. No es un producto multi-tenant ni SaaS — es un sistema a medida para un solo negocio.

## Stack técnico
- **Frontend:** React + Vite + TypeScript, PWA offline-first (Dexie.js sobre IndexedDB para el POS del mostrador). Deploy en Vercel.
- **Backend/Datos:** Supabase — PostgreSQL + Autenticación + Storage (fotos de producto). La lógica de negocio custom (SKU, diferencia de caja, estado de cuentas) se resuelve con funciones y vistas SQL/PL-pgSQL nativas de Postgres, no con Edge Functions.
- **Autenticación:** login por usuario/contraseña (sin email visible al usuario), mapeado internamente a un email técnico para Supabase Auth. Roles: **Dueño/a** y **Vendedor**, impuestos con Row Level Security (RLS) en Postgres — no solo validados en el frontend.

## Documentación de referencia (leer ANTES de programar cualquier módulo)
- `/docs/requirements.md` — requisitos funcionales y reglas de negocio aprobadas (Fase 1).
- `/docs/design.md` — arquitectura técnica completa, modelo de datos, paleta visual, inventario de pantallas (Fase 2).
- `/docs/contexto-diseno-showroomciro.md` — identidad visual: colores exactos, tipografía, reglas de layout.
- `/docs/prd.md` — historias de usuario y criterios de aceptación (para pruebas E2E con TestSprite).
- `/docs/tasks.md` — desglose de tareas por módulo (Fase 4) y orden de desarrollo.
- `/prototipos` — exports de Claude Design de las 17 pantallas aprobadas. **Usar como referencia visual real, no reinventar el diseño** (colores, textos de botones, disposición de elementos).

## Reglas de negocio clave (resumen — el detalle completo está en requirements.md)
- Roles: **Dueño/a** (acceso total, incluidos reportes y costos) y **Vendedor** (vende, gestiona stock/productos, gestiona cuentas — sin ver reportes ni costos).
- Productos con variantes por **talle + color**; el sistema **genera el SKU automáticamente** (no hay lector de código de barras).
- **Apertura de caja obligatoria** antes de poder vender (pantalla bloqueante post-login). **Cierre de caja** con conteo de efectivo + diferencia calculada, y **cierra la sesión automáticamente** al confirmar.
- Módulo **"Cuentas"** (clientes que se llevan algo fiado) es **independiente del checkout de venta** — no hay opción de fiado en el checkout. Se abre desde el botón "Nueva Cuenta" del Dashboard, que lleva a un formulario propio.
- Acceso remoto (celular, solo Dueño/a): **solo consulta**, con **una única excepción**: la gestión de usuarios (alta/baja de Vendedores) sí permite acción real desde el celular, dentro de "Configuración".
- **Sin ítem "Ventas" en el menú de navegación** — la pantalla de venta (POS) se accede solo vía el botón de acción "Nueva Venta" del Dashboard, y al confirmar la venta se vuelve automáticamente al Dashboard.
- **Sin ícono de campana de notificaciones** — las alertas (stock bajo, cuentas por vencer) se muestran en el panel de Alertas del Dashboard y como badge en el ítem "Cuentas" del menú.
- **Modo offline-first** en el POS del mostrador: debe poder seguir vendiendo sin internet y sincronizar al reconectar (ver design.md, sección "Modo Offline-First"). Apertura/cierre de caja y gestión de productos/usuarios SÍ requieren conexión.

## Convenciones de código
- Nombres de archivos y carpetas: `kebab-case`.
- Componentes React: `PascalCase`.
- Tablas y columnas en Supabase: `snake_case` en español, coherente con el modelo de datos de `design.md` (`productos`, `variantes`, `cuentas`, `cuenta_pagos`, etc.).
- TypeScript estricto — evitar `any` salvo justificación explícita en un comentario.
- Commits siguiendo Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, etc.).

## Orden de desarrollo acordado
1. **Modelo de datos en Supabase** (tablas + RLS + Storage).
2. **Funciones y vistas SQL** de lógica de negocio (generación de SKU, diferencia de caja, estado de cuentas).
3. **Autenticación** (usuario/contraseña + roles).
4. **Frontend** conectado directo a Supabase real — sin datos mockeados, el schema ya está definido.
5. **Capa offline-first** (Dexie + Service Worker) sobre el POS del mostrador.
6. **Pruebas E2E** (Chrome DevTools MCP + TestSprite).

Ver el detalle módulo por módulo en `/docs/tasks.md`. **No cambiar este orden sin señalarlo explícitamente como una desviación a confirmar con Marcos.**

## Qué NO hacer
- No agregar funcionalidades fuera de lo listado en `requirements.md` (sección "Fuera de alcance") sin preguntar primero.
- No inventar pantallas, textos o componentes que no estén en los prototipos de Claude Design — si falta algo, preguntar antes de improvisar.
- No mockear datos de API una vez que el schema de Supabase ya existe — conectar contra la base real desde el principio.
