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
- **Backend/Datos:** **Supabase** — PostgreSQL administrado + Autenticación + Storage (fotos de producto) + API autogenerada (PostgREST) + Edge Functions (TypeScript/Deno) para lógica de negocio custom (cálculo de diferencia de caja, generación de SKU, chequeo de alertas de fiados).
- **Autenticación:** Supabase Auth, adaptado para login por usuario/contraseña (sin email visible): el nombre de usuario se mapea internamente a un email técnico (ej. `vendedor1@showroomciro.internal`) de forma transparente para el usuario final. Roles (Dueño/Vendedor) controlados con una tabla de perfiles + **Row Level Security (RLS)** de Postgres, que es lo que efectivamente impone los permisos definidos en `requirements.md` a nivel base de datos (no solo en el frontend).

### Modo Offline-First (Ventas/POS)
> Se simplifica respecto a la primera versión: como el celular del Dueño/a ahora **solo consulta** (no vende), ya no hay dos puntos generando ventas al mismo tiempo. Se elimina la necesidad de resolución de conflictos de stock entre dispositivos.

1. El catálogo de productos se cachea localmente al iniciar sesión y se actualiza cuando hay conexión.
2. Cada venta hecha sin internet se guarda en una cola local (IndexedDB) con estado "pendiente de sincronizar".
3. Al recuperar conexión, la cola se sincroniza automáticamente contra Supabase, en orden, sin conflicto posible (el mostrador es el único punto que vende).
4. Apertura/cierre de caja y gestión de productos/usuarios **requieren conexión** (no se sincronizan offline, según lo definido en requirements.md).

### Modelo de datos (entidades principales)
- `usuarios` (id, nombre_usuario, rol: dueño/vendedor, activo)
- `categorias` (id, nombre)
- `productos` (id, nombre, descripción, categoría_id, precio, foto_url, activo)
- `variantes` (id, producto_id, talle, color, sku, stock)
- `ventas` (id, usuario_id, fecha, total, medio_pago, estado_sync)
- `venta_items` (id, venta_id, variante_id, cantidad, precio_unitario)
- `ajustes_stock` (id, variante_id, usuario_id, tipo: suma/resta, cantidad, motivo, fecha)
- `cajas` (id, usuario_apertura_id, usuario_cierre_id, monto_inicial, monto_esperado, monto_contado, diferencia, fecha_apertura, fecha_cierre)
- `cuentas` (id, cliente_nombre, cliente_telefono, monto_total, fecha_limite, estado: al_dia/por_vencer/vencido/pagado)
- `cuenta_pagos` (id, cuenta_id, monto, fecha)

### Impresión de ticket
Ticket generado como HTML/CSS con ancho de impresora térmica (58mm/80mm) e impreso vía el diálogo de impresión estándar del navegador (`window.print()`). Compatible con cualquier impresora ya instalada en Windows, sin agente local adicional.

### APIs principales (sobre la API autogenerada de Supabase + Edge Functions custom)
- `POST /auth/login` — login por usuario/contraseña
- `GET /productos`, `POST /productos`, `PUT /productos/:id`, `DELETE /productos/:id`
- `POST /variantes` (con generación automática de SKU vía Edge Function)
- `POST /ajustes-stock`
- `POST /ventas` (registrada desde el mostrador; consulta de solo lectura disponible para el celular)
- `POST /caja/apertura`, `POST /caja/cierre` (con cálculo de diferencia vía Edge Function)
- `GET /caja/historial`
- `POST /cuentas`, `POST /cuentas/:id/pagos`, `GET /cuentas` (con cálculo de estado al_dia/por_vencer/vencido)
- `GET /reportes/ventas?periodo=`, `GET /reportes/top-productos`
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
3. **Dashboard/Inicio** — KPIs del día (ventas de hoy, estado de caja actual) + panel de alertas (stock bajo, fiados por vencer/vencidos).
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

15. **Configuración (mobile)** — pantalla nueva, con acceso a Gestión de Usuarios (mismo alcance que la versión desktop: alta y baja de Vendedores).

### Componentes transversales
- Sidebar fijo (desktop) con accesos a Dashboard, Productos, Caja, Cuentas, Reportes (+ Usuarios si es Dueño/a). Sin ítem "Ventas".
- Alertas (stock bajo y cuentas por vencer) visibles en el panel del Dashboard y como badge numérico en el ítem "Cuentas" del menú — sin ícono de campana/notificaciones separado.
- Bloque de usuario en el header clickeable → "Cerrar sesión". Logout automático al confirmar Cierre de Caja.

---
**Estado: Diseño técnico y de navegación actualizado (Cuentas, sin campanita, sin ítem Ventas, logout, Configuración mobile, pantalla de Alta de Cuenta separada de la Agenda). Pendiente aplicar estos ajustes en Claude Design (ver `ajustes-fase3-claude-design.md`) y tu aprobación final para pasar a la Fase 4 (tasks.md).**
