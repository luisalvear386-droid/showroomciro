import './pie-pagina.css'

/** Derechos de autor al pie de todas las pantallas (Login, Apertura de Caja, carga y layout interno). */
export function PiePagina() {
  return (
    <footer className="pie-pagina">
      © {new Date().getFullYear()} ShowroomCiro. Todos los derechos reservados.
    </footer>
  )
}
