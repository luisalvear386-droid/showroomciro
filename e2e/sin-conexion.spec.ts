import { expect, test, type BrowserContext, type Page } from '@playwright/test'

/*
 * Venta con conexión y comportamiento sin conexión (el modo offline quedó descartado: sin
 * internet la app avisa y bloquea). Corre en orden sobre la base real:
 *   1. venta completa con ticket, en la caja que esté abierta (si no hay, se abre una);
 *   2. corte de red con el carrito armado: aviso, botones bloqueados, carrito intacto y venta
 *      confirmada al volver la red;
 *   3. corte justo al confirmar: el reintento usa el mismo id y no duplica la venta;
 *   4. cierre de esa caja y apertura de una nueva;
 *   5. abrir la app sin red: pantalla "Sin conexión" con "Reintentar", no el login;
 *   6. cierre de la caja nueva (la base queda sin caja abierta).
 */

const USUARIO = process.env.E2E_USUARIO ?? ''
const CONTRASENA = process.env.E2E_CONTRASENA ?? ''
const MONTO_APERTURA = '10000'
const SIN_CONEXION = 'Sin conexión: esperá a que vuelva internet.'

test.describe.configure({ mode: 'serial' })
test.skip(!USUARIO || !CONTRASENA, 'Faltan E2E_USUARIO y E2E_CONTRASENA en .env.e2e')

let contexto: BrowserContext
let page: Page

/** `window.print()` no abre el diálogo: guarda el texto del ticket para revisarlo. */
function capturarTickets() {
  const ventana = window as unknown as { __tickets: string[]; print: () => void }
  ventana.__tickets = []
  ventana.print = () => {
    ventana.__tickets.push(document.querySelector('.ticket')?.textContent ?? '')
  }
}

async function tickets(p: Page): Promise<string[]> {
  return p.evaluate(() => (window as unknown as { __tickets: string[] }).__tickets)
}

async function entrar(p: Page): Promise<'dashboard' | 'apertura'> {
  await p.goto('/login')
  await p.locator('#usuario').fill(USUARIO)
  await p.locator('#clave').fill(CONTRASENA)
  await p.getByRole('button', { name: 'Ingresar' }).click()
  const dashboard = p.getByRole('heading', { name: /^Buen día/ })
  const apertura = p.getByRole('heading', { name: 'Apertura de Caja' })
  await expect(dashboard.or(apertura)).toBeVisible()
  return (await apertura.isVisible()) ? 'apertura' : 'dashboard'
}

async function abrirCaja(p: Page) {
  await p.locator('#monto').fill(MONTO_APERTURA)
  await p.getByRole('button', { name: 'Abrir Caja' }).click()
  await expect(p.getByRole('heading', { name: /^Buen día/ })).toBeVisible()
}

async function cerrarCaja(p: Page, contado: string) {
  await p.getByRole('button', { name: 'Cerrar Caja' }).click()
  await expect(p.getByRole('heading', { name: 'Cierre de Caja' })).toBeVisible()
  // Conteo ciego: antes de confirmar no se ven el esperado ni la diferencia
  await expect(p.getByText(/esperado|diferencia/i)).toHaveCount(0)
  await p.locator('#contado').fill(contado)
  await p.locator('form').getByRole('button', { name: 'Cerrar Caja' }).click()
  await p.getByRole('alertdialog').getByRole('button', { name: 'Cerrar Caja' }).click()
  await expect(p).toHaveURL(/\/login$/)
}

/** Cantidad de ventas de la caja abierta, según el KPI "Ventas de hoy" del Dashboard. */
async function ventasDeLaCaja(p: Page): Promise<number> {
  await p.goto('/')
  const detalle = p.locator('.kpi').first().locator('.kpi__detalle')
  await expect(detalle).toHaveText(/\d+ ventas?/)
  return Number((await detalle.textContent())?.match(/(\d+) ventas?/)?.[1])
}

/** Desde el Dashboard: entra al POS y agrega una prenda con stock al carrito. */
async function armarCarrito(p: Page): Promise<string> {
  await p.getByRole('button', { name: 'Nueva Venta' }).click()
  await expect(p).toHaveURL(/\/ventas$/)
  const producto = p.locator('.pos-producto').filter({ hasNotText: 'Sin stock' }).first()
  const nombre = (await producto.locator('.pos-producto__nombre').textContent()) ?? ''
  await producto.click()
  await p.getByRole('button', { name: 'Agregar al carrito' }).click()
  await expect(p.locator('.pos-item')).toHaveCount(1)
  return nombre
}

test.beforeAll(async ({ browser }) => {
  // Sin Service Worker: así page.route() ve todos los pedidos a Supabase
  contexto = await browser.newContext({ serviceWorkers: 'block' })
  await contexto.addInitScript(capturarTickets)
  page = await contexto.newPage()
})

test.afterAll(async () => {
  await contexto.close()
})

test('venta completa con conexión, con ticket', async () => {
  if ((await entrar(page)) === 'apertura') await abrirCaja(page)
  const antes = await ventasDeLaCaja(page)

  const nombre = await armarCarrito(page)
  await page.getByRole('button', { name: 'Cobrar' }).click()
  await page.getByRole('button', { name: 'Confirmar Venta' }).click()
  await expect(page.getByRole('heading', { name: 'Venta registrada' })).toBeVisible()
  // Se imprime el ticket y se vuelve solo al Dashboard
  await expect(page.getByRole('heading', { name: /^Buen día/ })).toBeVisible()

  const [ticket] = await tickets(page)
  expect(ticket).toContain('ShowroomCiro')
  expect(ticket).toContain(nombre)
  expect(ticket).toContain('TOTAL')
  expect(ticket).not.toContain('Pendiente de sincronizar')
  expect(await ventasDeLaCaja(page)).toBe(antes + 1)
})

test('corte de red: aviso, botones bloqueados y carrito intacto hasta que vuelve', async () => {
  const antes = await ventasDeLaCaja(page)

  // Dashboard sin conexión: pastilla y acciones bloqueadas
  await contexto.setOffline(true)
  await expect(page.locator('.estado-conexion')).toHaveText('Sin conexión')
  for (const accion of ['Nueva Venta', 'Nueva Cuenta', 'Cerrar Caja']) {
    await expect(page.getByRole('button', { name: accion })).toBeDisabled()
  }
  await expect(page.getByText(SIN_CONEXION)).toBeVisible()
  await contexto.setOffline(false)
  await expect(page.locator('.estado-conexion')).toHaveCount(0)

  // Se corta con el carrito armado y el cobro abierto
  const nombre = await armarCarrito(page)
  await page.getByRole('button', { name: 'Cobrar' }).click()
  await contexto.setOffline(true)
  await expect(page.locator('.estado-conexion')).toHaveText('Sin conexión')
  await expect(page.getByRole('button', { name: 'Confirmar Venta' })).toBeDisabled()
  await expect(page.getByRole('dialog').getByText(SIN_CONEXION)).toBeVisible()
  await expect(page.getByRole('dialog').getByText(nombre)).toBeVisible()

  // Vuelve la red: el mismo carrito se confirma
  await contexto.setOffline(false)
  await expect(page.locator('.estado-conexion')).toHaveCount(0)
  await page.getByRole('button', { name: 'Confirmar Venta' }).click()
  await expect(page.getByRole('heading', { name: 'Venta registrada' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Buen día/ })).toBeVisible()
  expect(await ventasDeLaCaja(page)).toBe(antes + 1)
})

test('corte justo al confirmar: el reintento no duplica la venta', async () => {
  const antes = await ventasDeLaCaja(page)
  await armarCarrito(page)
  await page.getByRole('button', { name: 'Cobrar' }).click()

  // La primera vez la venta llega a la base pero la respuesta se pierde
  const ids: string[] = []
  let primera = true
  await page.route('**/rest/v1/rpc/registrar_venta', async (ruta) => {
    ids.push((JSON.parse(ruta.request().postData() ?? '{}') as { p_venta_id: string }).p_venta_id)
    if (primera) {
      primera = false
      await ruta.fetch()
      await ruta.abort('internetdisconnected')
      return
    }
    await ruta.continue()
  })

  await page.getByRole('button', { name: 'Confirmar Venta' }).click()
  await expect(page.getByText(/No se pudo confirmar la venta/)).toBeVisible()
  // El sondeo detecta que volvió la conexión y se puede reintentar
  await expect(page.getByRole('button', { name: 'Confirmar Venta' })).toBeEnabled({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Confirmar Venta' }).click()
  await expect(page.getByRole('heading', { name: 'Venta registrada' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /^Buen día/ })).toBeVisible()
  await page.unroute('**/rest/v1/rpc/registrar_venta')

  expect(ids).toHaveLength(2)
  expect(ids[1]).toBe(ids[0])
  // Dos pedidos, una sola venta
  expect(await ventasDeLaCaja(page)).toBe(antes + 1)
})

test('cerrar la caja y abrir una nueva, con conexión', async () => {
  await page.goto('/')
  await cerrarCaja(page, '0')
  expect(await entrar(page)).toBe('apertura')
  await abrirCaja(page)
  await expect(page.locator('.kpi').nth(1).locator('.kpi__valor')).toHaveText('Abierta')
})

test('abrir la app sin red: pantalla "Sin conexión" con Reintentar, no el login', async ({ browser }) => {
  // Contexto aparte con Service Worker: es el que sirve la app sin red
  const conSw = await browser.newContext()
  const p = await conSw.newPage()
  expect(await entrar(p)).toBe('dashboard')
  await p.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await expect.poll(() => p.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true)

  await conSw.setOffline(true)
  await p.reload()
  await expect(p.getByText(/^Sin conexión\. La app necesita internet/)).toBeVisible()
  await expect(p.getByRole('button', { name: 'Reintentar' })).toBeVisible()
  await expect(p).not.toHaveURL(/\/login/)

  // Reintentar sin red: sigue en la misma pantalla
  await p.getByRole('button', { name: 'Reintentar' }).click()
  await expect(p.getByText(/^Sin conexión\. La app necesita internet/)).toBeVisible()

  await conSw.setOffline(false)
  await p.getByRole('button', { name: 'Reintentar' }).click()
  await expect(p.getByRole('heading', { name: /^Buen día/ })).toBeVisible()
  await conSw.close()
})

test('cerrar la caja de la prueba', async () => {
  await page.goto('/')
  await cerrarCaja(page, MONTO_APERTURA)
})
