import './producto-visual.css'

/** Colores conocidos para el punto de muestra; cualquier otro nombre usa un neutro. */
const COLOR_POR_NOMBRE: Record<string, string> = {
  crudo: '#EFE3CF',
  beige: '#E3CFB0',
  blanco: '#FBF8F2',
  negro: '#3A322C',
  gris: '#9A958F',
  verde: '#6B7A4F',
  oliva: '#6B7A4F',
  azul: '#3E5068',
  celeste: '#A9C4DA',
  terracota: '#C0664A',
  rojo: '#A8352C',
  bordo: '#6E2430',
  rosa: '#E2AFA8',
  marron: '#6B4A36',
  camel: '#B88A5A',
  amarillo: '#E4C15A',
  naranja: '#D9803F',
  violeta: '#6F5B87',
}

function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Busca por la primera palabra: "Azul marino" → azul. */
function hexDeColor(color: string): string | undefined {
  const [primera] = normalizar(color).split(/\s+/)
  return COLOR_POR_NOMBRE[primera]
}

export function PuntoColor({ color }: { color: string }) {
  return <span className="punto-color" style={{ background: hexDeColor(color) }} aria-hidden="true" />
}

interface FotoProductoProps {
  url: string | null
  nombre: string
  className: string
}

/** Foto del producto, o el rayado de "sin foto" de los prototipos. */
export function FotoProducto({ url, nombre, className }: FotoProductoProps) {
  if (!url) return <span className={`${className} foto-vacia`} aria-hidden="true" />
  return <img className={className} src={url} alt={nombre} loading="lazy" />
}
