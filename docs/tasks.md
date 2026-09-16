# Tareas de Desarrollo — ShowroomCiro (Fase 4)

> Desglose técnico para ejecutar con el agente de IA en Antigravity. Recomendación: pasale **una tarea (o un bloque chico) a la vez**, revisá el resultado, y recién ahí seguís con la próxima — no le tires todas juntas.
> Contexto que el agente debe tener siempre disponible: `documento-maestro.md` + `contexto-diseno-showroomciro.md`.

---

## Bloque 0 — Setup del proyecto
- [ ] 0.1 Crear proyecto en Supabase (nombre, región).
- [ ] 0.2 Inicializar repo con React + Vite + TypeScript.
- [ ] 0.3 Instalar dependencias base: cliente de Supabase, Dexie.js (IndexedDB), React Router, librería de estilos elegida.
- [ ] 0.4 Configurar variables de entorno (URL y key de Supabase) y `.env.example`.
- [ ] 0.5 Definir estructura de carpetas del frontend (`/components`, `/pages`, `/lib`, `/hooks`, etc.).
- [ ] 0.6 Configurar Vercel para deploy del frontend (conectar repo).

## Bloque 1 — Base de datos y seguridad
- [ ] 1.1 Crear las 10 tablas del modelo de datos (sección 7 del documento maestro) como migraciones SQL de Supabase.
- [ ] 1.2 Definir relaciones/foreign keys entre tablas.
- [ ] 1.3 Escribir políticas de **Row Level Security (RLS)** para cada tabla, según la tabla de roles y permisos (sección 2 del documento maestro).
- [ ] 1.4 Edge Function: generación automática de SKU al crear una variante.
- [ ] 1.5 Edge Function: cálculo de diferencia de caja al cerrar.
- [ ] 1.6 Edge Function: cálculo de estado de cuenta (al_dia/por_vencer/vencido) según fecha límite.
- [ ] 1.7 Configurar Supabase Storage para fotos de producto (bucket + políticas de acceso).
- [ ] 1.8 Cargar datos de prueba (seed): usuarios, categorías, productos con variantes.

## Bloque 2 — Autenticación
- [ ] 2.1 Configurar Supabase Auth con el mapeo usuario→email técnico interno.
- [ ] 2.2 Implementar pantalla de **Login** (según prototipo) con usuario/contraseña.
- [ ] 2.3 Manejo de sesión (guardar/leer sesión activa, proteger rutas privadas).
- [ ] 2.4 Lógica de roles: exponer el rol del usuario logueado al resto de la app.
- [ ] 2.5 Interacción de **"Cerrar sesión"** al clickear el bloque de usuario en el header.

## Bloque 3 — Layout base y navegación
- [ ] 3.1 Componente de Sidebar (desktop) con los ítems: Dashboard, Productos, Caja, Cuentas, Reportes, Usuarios (condicionado por rol). Sin ítem "Ventas".
- [ ] 3.2 Componente de Header con nombre de tienda, fecha, bloque de usuario.
- [ ] 3.3 Componente de menú inferior (mobile) con: Dashboard, Cuentas, Reportes, Configuración.
- [ ] 3.4 Routing general de la app (rutas protegidas por rol, layout desktop vs. mobile).
- [ ] 3.5 Aplicar tokens de diseño (paleta, tipografía) como variables globales de estilo.

## Bloque 4 — Módulo Caja
- [ ] 4.1 Pantalla **Apertura de Caja** (bloqueante post-login, se salta si ya hay una caja abierta ese día).
- [ ] 4.2 Pantalla **Caja — Cierre**: conteo de efectivo, cálculo de diferencia, y logout automático al confirmar.
- [ ] 4.3 Pantalla **Caja — Historial**: listado filtrable por fecha.

## Bloque 5 — Módulo Productos
- [ ] 5.1 Pantalla **Productos — Listado** con filtros (categoría, estado) y buscador.
- [ ] 5.2 Pantalla **Producto — Alta/Edición** (formulario 2 pasos: datos generales + variantes con SKU autogenerado).
- [ ] 5.3 Acción/pantalla **Stock — Ajuste** (sumar/restar stock de una variante con motivo).
- [ ] 5.4 Lógica de alerta de stock bajo por variante.

## Bloque 6 — Módulo Ventas (POS)
- [ ] 6.1 Pantalla **Ventas/POS**: buscador + grilla de productos por categoría (accesible solo vía botón "Nueva Venta").
- [ ] 6.2 **Modal de selección de variante** (talle/color con disponibilidad de stock).
- [ ] 6.3 Carrito de compra (agregar/quitar ítems, totales).
- [ ] 6.4 Pantalla **Checkout Venta**: medios de pago (sin opción de fiado).
- [ ] 6.5 Generación e impresión de ticket vía `window.print()`.
- [ ] 6.6 Redirección automática al Dashboard tras confirmar la venta.

## Bloque 7 — Módulo Cuentas
- [ ] 7.1 Pantalla **Cuenta — Alta** (accedida desde el botón "Nueva Cuenta" del Dashboard; sin botón propio en la Agenda).
- [ ] 7.2 Pantalla **Cuentas — Agenda**: vista lista + toggle a vista calendario, con estados coloreados.
- [ ] 7.3 Pantalla **Cuenta — Detalle/Cobro**: historial de abonos + registrar nuevo cobro/abono.
- [ ] 7.4 Badge numérico de alertas en el ítem "Cuentas" del menú.

## Bloque 8 — Dashboard
- [ ] 8.1 KPIs del día (ventas de hoy, caja actual).
- [ ] 8.2 Panel de Alertas (stock bajo + cuentas por vencer/vencidas).
- [ ] 8.3 Botones de acción "Nueva Venta" y "Nueva Cuenta".

## Bloque 9 — Módulo Reportes
- [ ] 9.1 Selector de período (Día/Semana/Mes).
- [ ] 9.2 Gráfico de ventas por período.
- [ ] 9.3 Ranking de productos más vendidos.
- [ ] 9.4 KPI de Ticket promedio.
- [ ] 9.5 Resumen de cuentas pendientes de cobro.

## Bloque 10 — Módulo Usuarios
- [ ] 10.1 Pantalla **Usuarios** (desktop): listado + alta + desactivación de Vendedores.
- [ ] 10.2 Pantalla **Configuración** (mobile) con acceso a Gestión de Usuarios (mismo alcance que desktop).

## Bloque 11 — Modo Offline-First (Ventas/POS)
- [ ] 11.1 Cacheo local del catálogo de productos (IndexedDB vía Dexie.js).
- [ ] 11.2 Cola local de ventas pendientes cuando no hay conexión.
- [ ] 11.3 Sincronización automática de la cola al recuperar conexión.
- [ ] 11.4 Indicador visual de estado de conexión / ventas pendientes de sincronizar.
- [ ] 11.5 Service Worker para que la app cargue sin conexión.

## Bloque 12 — Vista Mobile (acceso remoto)
- [ ] 12.1 Dashboard mobile (solo lectura).
- [ ] 12.2 Cuentas mobile (solo lectura).
- [ ] 12.3 Reportes mobile (solo lectura).
- [ ] 12.4 Diseño responsive general (breakpoints).

## Bloque 13 — Pulido y despliegue
- [ ] 13.1 Manejo de estados vacíos y de error en cada pantalla.
- [ ] 13.2 Probar impresión de ticket en una impresora térmica real.
- [ ] 13.3 Probar el flujo offline completo (cortar wifi, vender, reconectar, verificar sync).
- [ ] 13.4 Deploy final: frontend en Vercel, backend/DB en Supabase (producción).
- [ ] 13.5 Carga de datos reales (catálogo real de ShowroomCiro) reemplazando el seed de prueba.

---
**Estado: Fase 4 lista para ejecutar en Antigravity, bloque por bloque.**
