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
| Alerta/advertencia | Coral quemado | `#D4694A` | Stock bajo, fiado por vencer |
| Error/vencido | Vino | `#7A2E2A` | Fiado vencido, error de validación |

### Tipografía
_A definir con nombres concretos de fuente (Google Fonts) al cerrar el inventario de pantallas._

### Navegación
- **Desktop:** sidebar lateral fijo con accesos a Productos, Ventas, Caja, Fiados, Reportes.
- **Mobile (acceso remoto del Dueño/a):** menú inferior tipo app, con las secciones habilitadas para remoto.

## 2. Arquitectura técnica
_Pendiente — se define después de cerrar el inventario de pantallas y flujos._

## 3. Inventario de pantallas y flujos

### Flujo general de entrada
**Login → Apertura de Caja (bloqueante) → Dashboard/Inicio**
La apertura de caja es obligatoria antes de poder vender; se resuelve como paso intermedio tras el login, no como parte del menú normal.

### Listado de pantallas (Desktop — uso principal en mostrador)

1. **Login** — usuario y contraseña simples (sin email). Cada Vendedor tiene su propio usuario.
2. **Apertura de Caja** — pantalla bloqueante post-login: registro de monto inicial en efectivo. Se salta si la caja ya fue abierta ese día por otro usuario.
3. **Dashboard/Inicio** — KPIs del día (ventas de hoy, estado de caja actual) + panel de alertas (stock bajo, fiados por vencer/vencidos).
4. **Ventas (POS)** — pantalla principal de venta:
   - Buscador rápido por nombre o SKU (arriba).
   - Grilla visual de productos con foto (catálogo, navegable por categoría).
   - Al hacer clic en un producto → **modal de selección de variante** (talle/color) con stock disponible.
   - Carrito lateral con los ítems agregados.
   - **Checkout**: selección de medio de pago (efectivo/transferencia/tarjeta) **o marcar como fiado** (dispara alta rápida de ficha de cliente deudor si es nuevo).
   - Al confirmar: impresión de ticket en impresora térmica.
5. **Productos — Listado** — tabla/grid de productos con foto, categoría, precio, stock total, estado (activo/inactivo).
6. **Productos — Alta/Edición** — formulario en dos pasos: (1) datos generales (nombre, descripción, categoría, precio, foto), (2) carga de variantes (talle + color) con stock inicial por variante. Alta, edición y baja disponibles para Dueño/a y Vendedor.
7. **Stock — Ajuste** — pantalla o acción rápida para sumar/restar stock de una variante puntual (ej. reposición, merma).
8. **Fiados — Agenda** — vista de lista (deudor, monto, vencimiento) por defecto, con **toggle a vista calendario** por fecha de vencimiento. Alertas visuales de próximos a vencer / vencidos según la paleta (coral/vino).
9. **Fiados — Detalle/Cobro** — detalle del fiado seleccionado, registro de cobro/abono parcial o total.
10. **Caja — Cierre** — conteo de efectivo físico, cálculo automático de diferencia vs. lo esperado según ventas del día.
11. **Caja — Historial** — listado de aperturas/cierres pasados por día y usuario.
12. **Reportes** (solo Dueño/a) — ventas por día/semana/mes, productos más vendidos, fiados pendientes de cobro.
13. **Gestión de Usuarios** (solo Dueño/a) — alta de nuevos Vendedores.

### Listado de pantallas (Mobile — acceso remoto del Dueño/a)
Menú inferior tipo app con 4 secciones: **Dashboard, Ventas, Fiados, Reportes** (versión adaptada de las pantallas desktop equivalentes; no incluye apertura/cierre de caja ni gestión de productos/usuarios, que quedan atadas al mostrador físico).

### Componentes transversales
- Sidebar fijo (desktop) con accesos a Productos, Ventas, Caja, Fiados, Reportes (+ Usuarios si es Dueño/a).
- Sistema de notificaciones/badges (alertas de stock bajo y fiados por vencer) visible desde el Dashboard y el ícono de campana en el header.

---
**Estado: Fase 2 (Diseño) cerrada. Fase 3 (prompts para Claude Design) generada — ver `prompts-pantallas-claude-design.md` y `contexto-diseno-showroomciro.md`.**
