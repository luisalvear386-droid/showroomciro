# ShowroomCiro — Sistema de gestión

Sistema de gestión interno para **ShowroomCiro**, una tienda de ropa con un único local físico. Cubre el día a día del mostrador (ventas, caja, stock) y le permite al Dueño/a consultar el negocio desde el celular.

Es un sistema a medida para un solo negocio, no un producto multi-tienda.

## Funcionalidades

- **Productos y stock:** productos con variantes por **talle + color**, **SKU generado automáticamente** por variante, foto de producto, categorías, ajustes de stock (reposición, merma) y alerta de stock bajo con umbral configurable.
- **Ventas (POS):** venta rápida por variante, con medios de pago efectivo, transferencia/QR y tarjeta. El precio se toma siempre de la base, y el stock se descuenta en la misma transacción que registra la venta.
- **Caja:** **apertura obligatoria** antes de vender, y **cierre a ciegas** con conteo de efectivo: el sistema calcula la diferencia contra lo esperado y cierra la sesión al confirmar. Historial de cajas para el Dueño/a.
- **Cuentas (clientes deudores):** alta de cuenta con nombre, teléfono, monto y fecha límite. Cobros parciales o totales, agenda en lista o calendario, y alertas de cuentas por vencer o vencidas.
- **Reportes (solo Dueño/a):** ventas por día, semana o mes, ticket promedio, productos más vendidos y cuentas pendientes.
- **Usuarios (solo Dueño/a):** alta, desactivación y reactivación de Vendedores.
- **Dashboard:** accesos rápidos (Nueva Venta, Nueva Cuenta, Cerrar Caja) y panel de alertas.
- **Acceso desde el celular:** el Dueño/a consulta Dashboard, Cuentas y Reportes. La única acción permitida es la gestión de usuarios.
- **PWA instalable**, con aviso **"Sin conexión"**: sin internet se bloquean las operaciones (vender, cobrar, abrir/cerrar caja, guardar) sin perder el carrito ni duplicar ventas.

## Roles

| Acción | Dueño/a | Vendedor |
|---|:---:|:---:|
| Vender, abrir y cerrar caja | ✅ | ✅ |
| Productos y stock | ✅ | ✅ |
| Cuentas y cobros | ✅ | ✅ |
| Ver costos y reportes | ✅ | ❌ |
| Gestionar usuarios | ✅ | ❌ |

Los permisos los impone la base de datos con **Row Level Security (RLS)** de PostgreSQL, no solo la interfaz.

## Tecnologías

- **Frontend:** React 19, TypeScript, Vite, React Router, `vite-plugin-pwa`
- **Backend:** Supabase (PostgreSQL, Auth y Storage para las fotos)
- **Lógica de negocio:** funciones y vistas SQL / PL/pgSQL (generación de SKU, registro atómico de ventas y cobros, cierre de caja, estado de cuentas, reportes)
- **Pruebas:** Playwright (E2E) y TestSprite
- **Deploy:** Vercel

## Estructura del proyecto

```
src/
  auth/         sesión, login y control de roles
  caja/         estado de la caja abierta y bloqueo de apertura
  components/   layout, modales (checkout, variantes, ajuste de stock, cuentas), ticket
  hooks/        hooks reutilizables (conexión, mobile, consultas)
  lib/          acceso a Supabase por módulo (productos, ventas, caja, cuentas, reportes, usuarios)
  pages/        una página por pantalla
supabase/
  migrations/   esquema, RLS, funciones y Storage (0001 a 0013, en orden)
  seed.sql      datos de prueba
docs/           requisitos, diseño, historias de usuario y tareas
prototipos/     diseños aprobados de las pantallas
e2e/            pruebas de Playwright
```

## Cómo correrlo localmente

**Requisitos:** Node.js 20 o superior y un proyecto de [Supabase](https://supabase.com).

1. **Instalar dependencias**
   ```bash
   npm install
   ```

2. **Preparar la base de datos.** En el SQL Editor de Supabase, ejecutar en orden los archivos de `supabase/migrations/` (de `0001_init_schema.sql` a `0013_storage_borrar_fotos.sql`). Después, si se quieren datos de prueba, ejecutar `supabase/seed.sql`.

3. **Configurar las variables de entorno.** Copiar `.env.example` a `.env` y completarlo con los datos del proyecto (Supabase → Project Settings → API):
   ```
   VITE_SUPABASE_URL=https://<tu-proyecto>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```

4. **Levantar la app**
   ```bash
   npm run dev
   ```

### Usuarios de prueba

`seed.sql` crea dos usuarios con la contraseña `changeme123`:

| Usuario | Rol |
|---|---|
| `ciro` | Dueño/a |
| `vendedor1` | Vendedor |

> Cambiar estas contraseñas antes de usar el sistema con datos reales.

El login es por **usuario y contraseña**. Internamente cada usuario se mapea a un email técnico (`<usuario>@showroomciro.internal`) para Supabase Auth, pero el usuario final nunca lo ve.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Chequeo de tipos y build de producción |
| `npm run preview` | Sirve el build de producción localmente |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Pruebas E2E con Playwright (requiere credenciales en `.env.e2e`) |

## Documentación

- [`docs/requirements.md`](docs/requirements.md): requisitos funcionales y reglas de negocio
- [`docs/design.md`](docs/design.md): arquitectura, modelo de datos y pantallas
- [`docs/prd.md`](docs/prd.md): historias de usuario y criterios de aceptación
- [`docs/tasks.md`](docs/tasks.md): desglose de tareas por módulo y estado del desarrollo

## Fuera de alcance (v1)

Venta online, múltiples sucursales, lector de código de barras, módulo de proveedores, base general de clientes y venta sin conexión.
