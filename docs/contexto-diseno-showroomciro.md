# Contexto de Diseño — ShowroomCiro (Sistema de Gestión)

> Adjuntá este archivo junto con cada prompt de pantalla en Claude Design, para que entre en contexto de marca y estilo sin repetirlo cada vez.

## Marca
- **Nombre del sistema:** ShowroomCiro — sistema de gestión interno para una tienda de ropa (local físico único).
- **Tono:** cálido, cercano, de boutique de barrio — NO estética de SaaS corporativo genérico. Evitar looks tipo "dashboard azul/gris de startup".

## Paleta de colores (usar exactamente estos valores)
| Rol | Nombre | Hex |
|---|---|---|
| Primario/marca | Canela | `#B87A56` |
| Fondo general | Crema hueso | `#F7F0E6` |
| Texto principal | Marrón cacao | `#4A342A` |
| Bordes/separadores | Lino | `#E4D6C3` |
| Éxito/confirmación | Verde oliva | `#6B7A4F` |
| Alerta/advertencia | Coral quemado | `#D4694A` |
| Error/vencido | Vino | `#7A2E2A` |

## Tipografía
- **Títulos/marca:** una sans-serif con carácter y calidez (ej. Fraunces, Fraunces variable, o Recoleta/Poppins SemiBold como alternativa) — nada de Inter/Roboto genéricas para títulos.
- **Cuerpo/UI:** sans-serif neutra y muy legible para tablas y formularios (ej. Inter, Work Sans, o Manrope).
- Jerarquía clara: títulos de pantalla grandes y cálidos, texto de datos/tablas compacto y neutro.

## Reglas de layout y navegación
- **Desktop:** sidebar lateral fijo a la izquierda con accesos a: Ventas, Productos, Caja, Fiados, Reportes (+ Usuarios solo si el rol es Dueño/a). Header superior con nombre de la tienda, ícono de notificaciones (campana, con badge de alertas) y usuario logueado.
- **Mobile (acceso remoto, rol Dueño/a):** menú inferior fijo tipo app con 4 secciones: Dashboard, Ventas, Fiados, Reportes.
- Fondo general en Crema hueso, cards en blanco roto o un tono más claro que el fondo con bordes en Lino.
- Botones de acción principal siempre en Canela. Estados de éxito en Verde oliva. Alertas de "atención" (stock bajo, fiado por vencer) en Coral quemado. Estados de "error/vencido" (fiado vencido) en Vino — deben distinguirse claramente entre sí.
- Esquinas redondeadas suaves (no muy cuadrado, no excesivamente redondeado), sombras sutiles, sensación artesanal/cálida más que "tech".

## Roles de usuario (afectan qué se muestra)
- **Dueño/a:** acceso total — ve reportes, costos, gestión de usuarios.
- **Vendedor:** vende, gestiona stock y productos, gestiona fiados — NO ve reportes ni costos.

## Contexto funcional del sistema (para que las pantallas tengan sentido)
- Los productos tienen variantes por **talle y color** (sin código de barras; el sistema genera un SKU interno).
- Existe un módulo de **Fiados**: clientes que compran a cuenta, con fecha de vencimiento y alertas.
- La **caja** se abre obligatoriamente antes de vender y se cierra con conteo de efectivo al final del día.
