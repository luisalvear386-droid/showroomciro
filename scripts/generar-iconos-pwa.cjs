/*
 * Genera los íconos de la PWA (public/pwa-192x192.png y public/pwa-512x512.png) a partir del
 * logo de la tienda ("Ciro Rey Showroom"): logo centrado sobre negro sólido, dentro del 80%
 * central del lienzo (zona segura de los íconos "maskable": Android recorta en círculo, iOS
 * redondea las esquinas).
 *
 * Usa `sharp` (devDependency):
 *
 *   node scripts/generar-iconos-pwa.cjs --mockup assets/marca/logo-ciro-rey-mockup.jpg
 *   node scripts/generar-iconos-pwa.cjs --fuente ruta/al/logo-original.png
 *
 * --mockup  La foto de la insignia metálica (lo único disponible en el Módulo 11): recorta el
 *           círculo negro, deja afuera el borde metálico y lleva a negro el degradé y el
 *           reflejo del mockup. Las coordenadas del círculo son las de esa foto.
 * --fuente  El archivo original del logo (PNG transparente o con fondo negro, SVG, etc.):
 *           ubica las partes claras del logo (texto blanco, corona y "SHOWROOM" dorados) y
 *           las escala para que entren en la zona segura. No hace falta ninguna coordenada.
 */
const path = require('path')
const sharp = require('sharp')

const TAMANIOS = [512, 192]
const DESTINO = path.join(__dirname, '..', 'public')
/** Radio de la zona segura "maskable": 40% del lado (círculo del 80% central). */
const ZONA_SEGURA = 0.4

async function desdeMockup(archivo) {
  const LADO = 580 // px de la foto: el logo (radio ~221) queda dentro de la zona segura
  const CX = 341.5, CY = 330, RADIO = 225 // círculo negro de la foto: radio ~231, sin el borde
  // Grises oscuros (degradé y reflejo) → negro, con rampa suave hasta el gris 100 para no
  // comerse el borde de las letras. Con color (dorado): solo se le saca el velo gris.
  const GRIS_NEGRO = 50, GRIS_LIMPIO = 100, VELO = 24

  const izq = Math.round(CX - LADO / 2), arriba = Math.round(CY - LADO / 2)
  const cx = CX - izq, cy = CY - arriba
  const { data, info } = await sharp(archivo)
    .extract({ left: izq, top: arriba, width: LADO, height: LADO })
    .raw()
    .toBuffer({ resolveWithObject: true })

  const salida = Buffer.alloc(LADO * LADO * 3)
  for (let y = 0; y < LADO; y++) {
    for (let x = 0; x < LADO; x++) {
      const i = (y * LADO + x) * info.channels, o = (y * LADO + x) * 3
      const d = Math.hypot(x - cx, y - cy)
      if (d > RADIO) continue
      const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
      const max = Math.max(r, g, b), sat = max - Math.min(r, g, b)
      let f
      if (sat >= 28) f = (Math.max(0, (max - VELO) / (255 - VELO)) * 255) / max
      else if (max <= GRIS_NEGRO) f = 0
      else if (max < GRIS_LIMPIO) f = ((max - GRIS_NEGRO) / (GRIS_LIMPIO - GRIS_NEGRO)) ** 1.5
      else f = 1
      const borde = Math.min(1, (RADIO - d) / 1.5)
      salida[o] = Math.round(r * f * borde)
      salida[o + 1] = Math.round(g * f * borde)
      salida[o + 2] = Math.round(b * f * borde)
    }
  }
  return sharp(salida, { raw: { width: LADO, height: LADO, channels: 3 } }).png().toBuffer()
}

async function desdeFuente(archivo) {
  // Sobre negro, para que un PNG transparente quede igual que uno con fondo negro
  const plano = await sharp(archivo, { density: 600 }).flatten({ background: '#000000' }).raw().toBuffer({ resolveWithObject: true })
  const { data, info } = plano
  const esLogo = (i) => Math.max(data[i], data[i + 1], data[i + 2]) > 90

  let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (esLogo((y * info.width + x) * info.channels)) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
      }
    }
  }
  if (x1 < 0) throw new Error('No se encontró el logo (partes claras) en el archivo.')

  // Radio que ocupa el logo alrededor de su centro: eso es lo que tiene que entrar en la zona segura
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  let radio = 0
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (esLogo((y * info.width + x) * info.channels)) radio = Math.max(radio, Math.hypot(x - cx, y - cy))
    }
  }
  const LADO = 1024
  const escala = (ZONA_SEGURA * 0.95 * LADO) / radio
  const recorte = { left: Math.floor(x0), top: Math.floor(y0), width: x1 - x0 + 1, height: y1 - y0 + 1 }
  const logo = await sharp(data, { raw: info })
    .extract(recorte)
    .resize(Math.round(recorte.width * escala), Math.round(recorte.height * escala), { kernel: 'lanczos3' })
    .png()
    .toBuffer()
  const meta = await sharp(logo).metadata()
  return sharp({ create: { width: LADO, height: LADO, channels: 3, background: '#000000' } })
    .composite([{
      input: logo,
      left: Math.round(LADO / 2 - (cx - x0) * escala),
      top: Math.round(LADO / 2 - (cy - y0) * escala),
    }])
    .png()
    .toBuffer()
    .then((b) => (meta.width > LADO || meta.height > LADO ? Promise.reject(new Error('El logo no entra en el lienzo.')) : b))
}

async function main() {
  const [modo, archivo] = process.argv.slice(2)
  if (!['--mockup', '--fuente'].includes(modo) || !archivo) {
    console.error('Uso: node scripts/generar-iconos-pwa.cjs --mockup|--fuente <archivo>')
    process.exit(1)
  }
  const base = modo === '--mockup' ? await desdeMockup(archivo) : await desdeFuente(archivo)
  for (const tam of TAMANIOS) {
    const destino = path.join(DESTINO, `pwa-${tam}x${tam}.png`)
    await sharp(base).resize(tam, tam, { kernel: 'lanczos3' }).png({ compressionLevel: 9 }).toFile(destino)
    console.log('Generado', path.relative(process.cwd(), destino))
  }
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
