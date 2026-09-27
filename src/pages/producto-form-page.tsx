import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useTieneRol } from '../auth/use-auth'
import { AjusteStockModal } from '../components/ajuste-stock-modal'
import { FotoProducto, PuntoColor } from '../components/producto-visual'
import { useConsulta } from '../hooks/use-consulta'
import { parsearMonto } from '../lib/formato'
import {
  actualizarProducto,
  codigoProducto,
  crearProducto,
  ErrorAltaParcial,
  FOTO_TIPOS_ACEPTADOS,
  mensajeDeError,
  obtenerCategorias,
  obtenerCosto,
  obtenerProducto,
  validarFoto,
  type Categoria,
  type ProductoDetalle,
  type Variante,
  type VarianteNueva,
} from '../lib/productos'
import './producto-form-page.css'

const TALLES_SUGERIDOS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Único']
const COLORES_SUGERIDOS = ['Negro', 'Blanco', 'Crudo', 'Beige', 'Gris', 'Azul', 'Verde', 'Terracota']
const STOCK_MINIMO_POR_DEFECTO = '3'

type Paso = 1 | 2
type CampoPaso1 = 'nombre' | 'categoria' | 'precio' | 'costo' | 'foto'

/** Lo que la pantalla recibe por `location.state` al volver de un alta. */
interface EstadoNavegacion {
  paso?: Paso
  aviso?: string
  error?: string
}

interface DatosEdicion {
  producto: ProductoDetalle
  /** `undefined` para el Vendedor: no se consulta. */
  costo: number | null | undefined
}

interface VarianteEnCarga extends VarianteNueva {
  clave: number
}

function parsearEntero(texto: string): number | null {
  const limpio = texto.trim()
  return /^\d+$/.test(limpio) ? Number(limpio) : null
}

function formatearMontoEditable(monto: number): string {
  return monto.toLocaleString('es-AR', { maximumFractionDigits: 2 })
}

function mismaCombinacion(a: { talle: string; color: string }, b: { talle: string; color: string }): boolean {
  const igual = (x: string, y: string) => x.trim().localeCompare(y.trim(), 'es', { sensitivity: 'base' }) === 0
  return igual(a.talle, b.talle) && igual(a.color, b.color)
}

function claseStock(stock: number, minimo: number): string {
  if (stock === 0) return 'stock--agotado'
  if (stock <= minimo) return 'stock--bajo'
  return ''
}

/** Productos — Alta/Edición, según prototipos/Producto Alta.dc.html */
export function ProductoFormPage() {
  const { id } = useParams()
  const esDueno = useTieneRol('dueño')
  const categorias = useConsulta(obtenerCategorias)

  const cargar = useCallback(async (): Promise<DatosEdicion | null> => {
    if (!id) return null
    const [producto, costo] = await Promise.all([
      obtenerProducto(id),
      esDueno ? obtenerCosto(id) : Promise.resolve(undefined),
    ])
    if (!producto) throw new Error('Producto no encontrado')
    return { producto, costo }
  }, [id, esDueno])
  const edicion = useConsulta(cargar)

  if (categorias.error || edicion.error) {
    return (
      <div className="pantalla-centrada pantalla-centrada--interna">
        <p className="pantalla-centrada__mensaje">
          {id ? 'No se pudo cargar el producto.' : 'No se pudieron cargar las categorías.'} Revisá la conexión.
        </p>
        <button
          type="button"
          className="boton-secundario"
          onClick={() => {
            categorias.recargar()
            edicion.recargar()
          }}
        >
          Reintentar
        </button>
      </div>
    )
  }

  // Al pasar de alta a edición (o entre productos) `edicion.datos` sigue siendo el del
  // producto anterior hasta que llega la consulta nueva: no mostrarlo mientras tanto.
  const edicionAlDia = id ? edicion.datos?.producto.id === id : edicion.datos === null
  if (!categorias.datos || !edicionAlDia) {
    return (
      <div className="pantalla-centrada pantalla-centrada--interna" role="status">
        <p className="pantalla-centrada__mensaje">Cargando…</p>
      </div>
    )
  }

  return (
    <FormularioProducto
      // Remonta al pasar de alta a edición (o entre productos) para arrancar con el estado limpio
      key={id ?? 'nuevo'}
      categorias={categorias.datos}
      edicion={edicion.datos ?? null}
      esDueno={esDueno}
    />
  )
}

interface FormularioProductoProps {
  categorias: Categoria[]
  edicion: DatosEdicion | null
  esDueno: boolean
}

function FormularioProducto({ categorias, edicion, esDueno }: FormularioProductoProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const estadoNav = (location.state ?? {}) as EstadoNavegacion
  const producto = edicion?.producto ?? null

  const [paso, setPaso] = useState<Paso>(estadoNav.paso ?? 1)

  // Paso 1
  const [nombre, setNombre] = useState(producto?.nombre ?? '')
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '')
  const [categoriaId, setCategoriaId] = useState(producto?.categoria_id ?? '')
  const [precio, setPrecio] = useState(producto ? formatearMontoEditable(producto.precio) : '')
  const [costo, setCosto] = useState(
    edicion?.costo !== undefined && edicion.costo !== null ? formatearMontoEditable(edicion.costo) : '',
  )
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const [errores, setErrores] = useState<Partial<Record<CampoPaso1, string>>>({})

  // Paso 2
  const [guardadas, setGuardadas] = useState<Variante[]>(producto?.variantes ?? [])
  const [minimosEditados, setMinimosEditados] = useState<Record<string, string>>({})
  const [nuevas, setNuevas] = useState<VarianteEnCarga[]>([])
  const [talle, setTalle] = useState('')
  const [color, setColor] = useState('')
  const [stockInicial, setStockInicial] = useState('1')
  const [stockMinimo, setStockMinimo] = useState(STOCK_MINIMO_POR_DEFECTO)
  const [errorVariante, setErrorVariante] = useState<string | null>(null)
  const [ajustando, setAjustando] = useState<Variante | null>(null)

  const [guardando, setGuardando] = useState(false)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(estadoNav.error ?? null)

  // Libera la URL temporal de la vista previa al salir de la pantalla
  const previewActual = useRef<string | null>(null)
  useEffect(
    () => () => {
      if (previewActual.current) URL.revokeObjectURL(previewActual.current)
    },
    [],
  )

  const cerrarAjuste = useCallback(() => setAjustando(null), [])

  // ---------------------------------------------------------------------------
  // Paso 1
  // ---------------------------------------------------------------------------

  function validarPaso1(): boolean {
    const nuevosErrores: typeof errores = {}
    if (!nombre.trim()) nuevosErrores.nombre = 'Ingresá el nombre del producto.'
    if (!categoriaId) nuevosErrores.categoria = 'Elegí una categoría.'
    if (parsearMonto(precio) === null) nuevosErrores.precio = 'Ingresá un precio válido (ej. 18.500).'
    if (esDueno && costo.trim() && parsearMonto(costo) === null) {
      nuevosErrores.costo = 'Ingresá un costo válido o dejalo vacío.'
    }
    setErrores(nuevosErrores)
    return Object.keys(nuevosErrores).length === 0
  }

  /** Actualiza un campo y borra su error, si lo tenía. */
  function editarCampo(campo: CampoPaso1, asignar: (valor: string) => void, valor: string) {
    asignar(valor)
    if (errores[campo]) setErrores((prev) => ({ ...prev, [campo]: undefined }))
  }

  function irAPaso(destino: Paso) {
    if (destino === 2 && !validarPaso1()) return
    setPaso(destino)
  }

  function elegirFoto(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    const problema = validarFoto(archivo)
    setErrores((prev) => ({ ...prev, foto: problema ?? undefined }))
    if (problema) return

    if (previewActual.current) URL.revokeObjectURL(previewActual.current)
    previewActual.current = URL.createObjectURL(archivo)
    setFoto(archivo)
    setFotoPreview(previewActual.current)
  }

  // ---------------------------------------------------------------------------
  // Paso 2
  // ---------------------------------------------------------------------------

  function agregarVariante() {
    const nueva = { talle: talle.trim(), color: color.trim() }
    const stock = parsearEntero(stockInicial)
    const minimo = parsearEntero(stockMinimo)

    if (!nueva.talle || !nueva.color) return setErrorVariante('Completá talle y color.')
    if (stock === null) return setErrorVariante('El stock inicial tiene que ser un número entero (0 o más).')
    if (minimo === null) return setErrorVariante('El stock mínimo tiene que ser un número entero (0 o más).')
    if ([...guardadas, ...nuevas].some((v) => mismaCombinacion(v, nueva))) {
      return setErrorVariante('Esa combinación de talle y color ya está cargada.')
    }

    setNuevas((prev) => [...prev, { ...nueva, stock, stock_minimo: minimo, clave: Date.now() }])
    setErrorVariante(null)
    setStockInicial('1')
  }

  function quitarVariante(clave: number) {
    setNuevas((prev) => prev.filter((v) => v.clave !== clave))
  }

  function editarMinimoNueva(clave: number, texto: string) {
    const minimo = parsearEntero(texto)
    if (minimo === null && texto.trim() !== '') return
    setNuevas((prev) => prev.map((v) => (v.clave === clave ? { ...v, stock_minimo: minimo ?? 0 } : v)))
  }

  function alAjustar(stockNuevo: number) {
    if (!ajustando) return
    const ajustadaId = ajustando.id
    setGuardadas((prev) => prev.map((v) => (v.id === ajustadaId ? { ...v, stock: stockNuevo } : v)))
    setAjustando(null)
  }

  // ---------------------------------------------------------------------------
  // Guardar
  // ---------------------------------------------------------------------------

  async function guardar() {
    if (!validarPaso1()) {
      setPaso(1)
      return
    }

    const stockMinimos: { id: string; stock_minimo: number }[] = []
    for (const [varianteId, texto] of Object.entries(minimosEditados)) {
      const valor = parsearEntero(texto)
      if (valor === null) {
        setErrorGeneral('Revisá los stocks mínimos: tienen que ser números enteros (0 o más).')
        return
      }
      if (valor !== guardadas.find((v) => v.id === varianteId)?.stock_minimo) {
        stockMinimos.push({ id: varianteId, stock_minimo: valor })
      }
    }

    if (!producto && nuevas.length === 0) {
      setErrorGeneral('Agregá al menos una variante para poder guardar el producto.')
      return
    }

    const datos = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      categoria_id: categoriaId,
      precio: parsearMonto(precio) ?? 0,
    }
    // El Vendedor nunca manda costo: `undefined` = no tocar `productos_costos`
    const costoFinal = esDueno ? (costo.trim() ? parsearMonto(costo) : null) : undefined
    const variantes = nuevas.map(({ talle: t, color: c, stock, stock_minimo }) => ({
      talle: t,
      color: c,
      stock,
      stock_minimo,
    }))

    setGuardando(true)
    setErrorGeneral(null)
    try {
      if (producto) {
        await actualizarProducto({ id: producto.id, datos, costo: costoFinal, foto, variantes, stockMinimos })
        navigate('/productos')
      } else {
        const nuevoId = await crearProducto({ datos, costo: costoFinal, foto, variantes })
        const estado: EstadoNavegacion = {
          paso: 2,
          aviso: 'Producto guardado. Los SKU de las variantes se generaron automáticamente.',
        }
        navigate(`/productos/${nuevoId}/editar`, { replace: true, state: estado })
      }
    } catch (error) {
      if (error instanceof ErrorAltaParcial) {
        const estado: EstadoNavegacion = {
          paso: 2,
          error: `El producto se creó, pero hubo un problema: ${mensajeDeError(error)} Revisá los datos y guardá de nuevo.`,
        }
        navigate(`/productos/${error.productoId}/editar`, { replace: true, state: estado })
        return
      }
      setErrorGeneral(mensajeDeError(error))
      setGuardando(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const categoriaActualExiste = categorias.some((c) => c.id === categoriaId)
  const coloresSugeridos = Array.from(new Set([...guardadas.map((v) => v.color), ...COLORES_SUGERIDOS]))
  const totalVariantes = guardadas.length + nuevas.length
  const stockTotal = guardadas.reduce((t, v) => t + v.stock, 0) + nuevas.reduce((t, v) => t + v.stock, 0)
  const fotoMostrada = fotoPreview ?? producto?.foto_url ?? null

  const pasos: { num: Paso; etiqueta: string; ayuda: string }[] = [
    { num: 1, etiqueta: 'Datos generales', ayuda: 'Nombre, precio, foto' },
    { num: 2, etiqueta: 'Variantes', ayuda: 'Talle, color y stock' },
  ]

  return (
    <div className="producto-form">
      <div className="producto-form__titulos">
        <h1 className="producto-form__titulo">
          {producto ? 'Editar producto' : 'Nuevo producto'}
          {producto && <span className="producto-form__codigo sku">{codigoProducto(producto.codigo)}</span>}
          {producto && !producto.activo && <span className="estado">Inactivo</span>}
        </h1>
        <p className="producto-form__bajada">Primero los datos generales, después las variantes de talle y color.</p>
      </div>

      <div className="producto-form__pasos">
        {pasos.map((p) => (
          <div key={p.num} className="producto-form__paso-contenedor">
            <button
              type="button"
              className="producto-form__paso"
              aria-current={paso === p.num ? 'step' : undefined}
              onClick={() => irAPaso(p.num)}
              disabled={guardando}
            >
              <span className="producto-form__paso-num">{p.num}</span>
              <span className="producto-form__paso-textos">
                <span className="producto-form__paso-etiqueta">{p.etiqueta}</span>
                <span className="producto-form__paso-ayuda">{p.ayuda}</span>
              </span>
            </button>
            <span className="producto-form__paso-linea" aria-hidden="true" />
          </div>
        ))}
      </div>

      {estadoNav.aviso && <div className="mensaje-ok">{estadoNav.aviso}</div>}
      {errorGeneral && (
        <div className="mensaje-error" role="alert">
          {errorGeneral}
        </div>
      )}

      {paso === 1 && (
        <div className="producto-form__card producto-form__datos">
          <div className="producto-form__campos">
            <div className="campo">
              <label htmlFor="p-nombre" className="campo__label">
                Nombre del producto
              </label>
              <input
                id="p-nombre"
                type="text"
                className="campo__input"
                placeholder="Ej. Camisa de lino"
                value={nombre}
                onChange={(e) => editarCampo('nombre', setNombre, e.target.value)}
                aria-invalid={!!errores.nombre}
                maxLength={120}
                disabled={guardando}
              />
              {errores.nombre && <span className="producto-form__error-campo">{errores.nombre}</span>}
            </div>

            <div className="campo">
              <label htmlFor="p-desc" className="campo__label">
                Descripción
              </label>
              <textarea
                id="p-desc"
                rows={3}
                className="campo__input producto-form__textarea"
                placeholder="Detalle de tela, calce, cuidados…"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                disabled={guardando}
              />
            </div>

            <div className="producto-form__grilla">
              <div className="campo">
                <label htmlFor="p-cat" className="campo__label">
                  Categoría
                </label>
                <select
                  id="p-cat"
                  className="campo__input producto-form__select"
                  value={categoriaActualExiste ? categoriaId : ''}
                  onChange={(e) => editarCampo('categoria', setCategoriaId, e.target.value)}
                  aria-invalid={!!errores.categoria}
                  disabled={guardando}
                >
                  <option value="" disabled>
                    Elegí una categoría
                  </option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
                {errores.categoria && <span className="producto-form__error-campo">{errores.categoria}</span>}
              </div>

              <div className="campo">
                <label htmlFor="p-precio" className="campo__label">
                  Precio de venta
                </label>
                <div className="producto-form__monto">
                  <span className="producto-form__moneda" aria-hidden="true">
                    $
                  </span>
                  <input
                    id="p-precio"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="campo__input producto-form__monto-input"
                    placeholder="0"
                    value={precio}
                    onChange={(e) => editarCampo('precio', setPrecio, e.target.value)}
                    aria-invalid={!!errores.precio}
                    disabled={guardando}
                  />
                </div>
                {errores.precio && <span className="producto-form__error-campo">{errores.precio}</span>}
              </div>

              {/* Solo Dueño/a: el Vendedor no ve costos (RLS de productos_costos) */}
              {esDueno && (
                <div className="campo">
                  <label htmlFor="p-costo" className="campo__label">
                    Costo
                  </label>
                  <div className="producto-form__monto">
                    <span className="producto-form__moneda" aria-hidden="true">
                      $
                    </span>
                    <input
                      id="p-costo"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      className="campo__input producto-form__monto-input"
                      placeholder="0"
                      value={costo}
                      onChange={(e) => editarCampo('costo', setCosto, e.target.value)}
                      aria-invalid={!!errores.costo}
                      disabled={guardando}
                    />
                  </div>
                  {errores.costo ? (
                    <span className="producto-form__error-campo">{errores.costo}</span>
                  ) : (
                    <span className="campo__ayuda">Solo lo ve el Dueño/a. Opcional.</span>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="campo">
            <span className="campo__label">Foto del producto</span>
            <label className={fotoMostrada ? 'producto-form__foto producto-form__foto--con-foto' : 'producto-form__foto'}>
              <input
                type="file"
                accept={FOTO_TIPOS_ACEPTADOS}
                className="producto-form__foto-input"
                onChange={elegirFoto}
                disabled={guardando}
              />
              {fotoMostrada ? (
                <>
                  <FotoProducto url={fotoMostrada} nombre={nombre} className="producto-form__foto-imagen" />
                  <span className="producto-form__foto-cambiar">Cambiar foto</span>
                </>
              ) : (
                <>
                  <span className="producto-form__foto-mas">+</span>
                  <span className="producto-form__foto-texto">Subir foto</span>
                  <span className="producto-form__foto-ayuda">JPG, PNG o WebP · máx 5 MB</span>
                </>
              )}
            </label>
            {errores.foto && <span className="producto-form__error-campo">{errores.foto}</span>}
            {foto && !errores.foto && <span className="campo__ayuda">Se sube al guardar.</span>}
          </div>
        </div>
      )}

      {paso === 2 && (
        <div className="producto-form__variantes">
          <div className="producto-form__card producto-form__agregar">
            <span className="producto-form__seccion">Agregar variante</span>
            <div className="producto-form__agregar-campos">
              <div className="campo">
                <label htmlFor="v-talle" className="campo__label">
                  Talle
                </label>
                <input
                  id="v-talle"
                  type="text"
                  list="talles-sugeridos"
                  className="campo__input producto-form__input-chico"
                  placeholder="Ej. M"
                  value={talle}
                  onChange={(e) => {
                    setTalle(e.target.value)
                    setErrorVariante(null)
                  }}
                  maxLength={20}
                  disabled={guardando}
                />
                <datalist id="talles-sugeridos">
                  {TALLES_SUGERIDOS.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <div className="campo">
                <label htmlFor="v-color" className="campo__label">
                  Color
                </label>
                <input
                  id="v-color"
                  type="text"
                  list="colores-sugeridos"
                  className="campo__input producto-form__input-chico"
                  placeholder="Ej. Negro"
                  value={color}
                  onChange={(e) => {
                    setColor(e.target.value)
                    setErrorVariante(null)
                  }}
                  maxLength={40}
                  disabled={guardando}
                />
                <datalist id="colores-sugeridos">
                  {coloresSugeridos.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="campo">
                <label htmlFor="v-stock" className="campo__label">
                  Stock inicial
                </label>
                <input
                  id="v-stock"
                  type="number"
                  min={0}
                  step={1}
                  className="campo__input producto-form__input-chico"
                  value={stockInicial}
                  onChange={(e) => setStockInicial(e.target.value)}
                  disabled={guardando}
                />
              </div>
              <div className="campo">
                <label htmlFor="v-minimo" className="campo__label">
                  Stock mínimo
                </label>
                <input
                  id="v-minimo"
                  type="number"
                  min={0}
                  step={1}
                  className="campo__input producto-form__input-chico"
                  value={stockMinimo}
                  onChange={(e) => setStockMinimo(e.target.value)}
                  title="Con este stock o menos, la variante aparece en Alertas del Dashboard"
                  disabled={guardando}
                />
              </div>
              <button type="button" className="producto-form__agregar-boton" onClick={agregarVariante} disabled={guardando}>
                + Agregar variante
              </button>
            </div>
            {errorVariante && <div className="mensaje-error mensaje-error--coral">{errorVariante}</div>}
          </div>

          <div className="producto-form__card producto-form__tabla-card">
            <div className="producto-form__tabla-encabezado">
              <h2 className="producto-form__tabla-titulo">Variantes cargadas</h2>
              <span className="producto-form__tabla-resumen">
                {totalVariantes} {totalVariantes === 1 ? 'variante' : 'variantes'} · {stockTotal} u. de stock total
              </span>
            </div>
            <div className="producto-form__tabla-scroll">
              <table className="producto-form__tabla">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Talle</th>
                    <th>Color</th>
                    <th className="num">Stock</th>
                    <th className="num" title="Umbral de alerta de stock bajo">
                      Stock mín.
                    </th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {guardadas.map((v) => (
                    <tr key={v.id}>
                      <td className="producto-form__sku">{v.sku}</td>
                      <td className="producto-form__talle">{v.talle}</td>
                      <td>
                        <span className="producto-form__color">
                          <PuntoColor color={v.color} />
                          {v.color}
                        </span>
                      </td>
                      <td className={`num producto-form__stock ${claseStock(v.stock, v.stock_minimo)}`}>{v.stock} u.</td>
                      <td className="num">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="producto-form__minimo"
                          aria-label={`Stock mínimo de ${v.talle} ${v.color}`}
                          value={minimosEditados[v.id] ?? String(v.stock_minimo)}
                          onChange={(e) => setMinimosEditados((prev) => ({ ...prev, [v.id]: e.target.value }))}
                          disabled={guardando}
                        />
                      </td>
                      <td className="num">
                        <button
                          type="button"
                          className="producto-form__ajustar"
                          onClick={() => setAjustando(v)}
                          disabled={guardando}
                        >
                          Ajustar stock
                        </button>
                      </td>
                    </tr>
                  ))}
                  {nuevas.map((v) => (
                    <tr key={v.clave} className="producto-form__fila-nueva">
                      <td className="producto-form__sku producto-form__sku--pendiente">Se genera al guardar</td>
                      <td className="producto-form__talle">{v.talle}</td>
                      <td>
                        <span className="producto-form__color">
                          <PuntoColor color={v.color} />
                          {v.color}
                        </span>
                      </td>
                      <td className={`num producto-form__stock ${claseStock(v.stock, v.stock_minimo)}`}>{v.stock} u.</td>
                      <td className="num">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          className="producto-form__minimo"
                          aria-label={`Stock mínimo de ${v.talle} ${v.color}`}
                          value={v.stock_minimo}
                          onChange={(e) => editarMinimoNueva(v.clave, e.target.value)}
                          disabled={guardando}
                        />
                      </td>
                      <td className="num">
                        <button
                          type="button"
                          className="producto-form__quitar"
                          title="Quitar variante"
                          aria-label={`Quitar ${v.talle} ${v.color}`}
                          onClick={() => quitarVariante(v.clave)}
                          disabled={guardando}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalVariantes === 0 && (
              <div className="producto-form__vacio">
                Todavía no cargaste variantes. Agregá al menos una para poder vender el producto.
              </div>
            )}
          </div>
        </div>
      )}

      <div className="producto-form__botones">
        <button
          type="button"
          className="producto-form__secundario"
          onClick={() => setPaso(1)}
          disabled={paso === 1 || guardando}
        >
          Atrás
        </button>
        <div className="producto-form__botones-derecha">
          <button
            type="button"
            className="producto-form__secundario"
            onClick={() => navigate('/productos')}
            disabled={guardando}
          >
            {producto ? 'Volver' : 'Cancelar'}
          </button>
          {paso === 1 ? (
            <button type="button" className="boton-primario" onClick={() => irAPaso(2)} disabled={guardando}>
              Siguiente
            </button>
          ) : (
            <button type="button" className="boton-primario" onClick={() => void guardar()} disabled={guardando}>
              {guardando ? 'Guardando…' : producto ? 'Guardar cambios' : 'Guardar Producto'}
            </button>
          )}
        </div>
      </div>

      {ajustando && producto && (
        <AjusteStockModal
          productoNombre={producto.nombre}
          fotoUrl={producto.foto_url}
          variante={ajustando}
          onCerrar={cerrarAjuste}
          onAjustado={alAjustar}
        />
      )}
    </div>
  )
}
