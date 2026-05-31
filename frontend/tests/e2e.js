/**
 * Tests E2E automatizados — Concesionaria App
 * Ejecutar: node tests/e2e.js
 * Requiere: frontend en :3000 y backend en :5001
 */
const { chromium } = require('C:/Users/Dell/AppData/Roaming/npm/node_modules/playwright')

const BASE = 'http://localhost:3000'
const ADMIN = { email: 'admin@concesionaria.com', password: 'admin123' }
const USER  = { email: 'maria@email.com',          password: 'user1234' }

let passed = 0
let failed = 0
const results = []

function ok(name, msg = '') {
  passed++
  results.push({ status: '✅ PASS', name, msg })
  console.log(`  ✅ ${name}${msg ? ' — ' + msg : ''}`)
}

function fail(name, msg = '') {
  failed++
  results.push({ status: '❌ FAIL', name, msg })
  console.log(`  ❌ ${name}${msg ? ' — ' + msg : ''}`)
}

async function withPage(browser, fn) {
  const ctx  = await browser.newContext()
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('console', m => { if (m.type() === 'error' && m.text().toLowerCase().includes('cors')) consoleErrors.push(m.text()) })
  try {
    await fn(page, ctx, consoleErrors)
  } finally {
    await ctx.close()
  }
}

async function login(page, creds) {
  await page.goto(`${BASE}/login`)
  await page.waitForLoadState('networkidle')
  await page.fill('input[type=email]', creds.email)
  await page.fill('input[type=password]', creds.password)
  await page.click('button[type=submit]')
  await page.waitForTimeout(3500)
}

// ─── SUITE ───────────────────────────────────────────────────────────────────

async function testSuite() {
  const browser = await chromium.launch({ headless: false, slowMo: 80 })

  // ── T1: Login admin → redirige a /admin ──────────────────────────────────
  console.log('\n[T1] Login admin → /admin')
  await withPage(browser, async (page) => {
    await page.goto(`${BASE}/login`)
    await page.waitForLoadState('networkidle')
    await page.fill('input[type=email]', ADMIN.email)
    await page.fill('input[type=password]', ADMIN.password)
    await page.click('button[type=submit]')
    // El layout de admin hace una llamada extra a /api/auth/me antes de renderizar
    await page.waitForURL('**/admin**', { timeout: 8000 }).catch(() => {})
    const url = page.url()
    url.includes('/admin')
      ? ok('T1: Admin redirige a /admin', url)
      : fail('T1: Admin redirige a /admin', `URL actual: ${url}`)
  })

  // ── T2: Navbar muestra nombre del admin tras login ───────────────────────
  console.log('\n[T2] Navbar muestra nombre del admin')
  await withPage(browser, async (page) => {
    await login(page, ADMIN)
    await page.waitForTimeout(1500)
    const navText = await page.textContent('header').catch(() => '')
    navText.includes('Rafael')
      ? ok('T2: Nombre admin en navbar', `"${navText.trim().slice(0, 60)}..."`)
      : fail('T2: Nombre admin en navbar', 'No se encontró el nombre en el header')
  })

  // ── T3: Login usuario → redirige a / ─────────────────────────────────────
  console.log('\n[T3] Login usuario regular → /')
  await withPage(browser, async (page) => {
    await login(page, USER)
    const url = page.url()
    url === `${BASE}/` || url === BASE
      ? ok('T3: Usuario redirige a /', url)
      : fail('T3: Usuario redirige a /', `URL actual: ${url}`)
  })

  // ── T4: Navbar muestra nombre de María tras login ────────────────────────
  console.log('\n[T4] Navbar muestra nombre de María')
  await withPage(browser, async (page) => {
    await login(page, USER)
    await page.waitForTimeout(2000)
    const navText = await page.textContent('header nav, header').catch(() => '')
    navText.toLowerCase().includes('mar')
      ? ok('T4: Nombre usuario en navbar', 'nombre encontrado en header')
      : fail('T4: Nombre usuario en navbar', `Texto del header: "${navText.slice(0, 100)}"`)
  })

  // ── T5: Acceso a /admin sin sesión → redirige a /login ───────────────────
  console.log('\n[T5] /admin sin sesión → /login')
  await withPage(browser, async (page) => {
    await page.goto(`${BASE}/admin`)
    await page.waitForTimeout(3000)
    const url = page.url()
    url.includes('/login')
      ? ok('T5: Sin sesión redirige a /login', url)
      : fail('T5: Sin sesión redirige a /login', `URL actual: ${url}`)
  })

  // ── T6: Usuario sin ADMIN accede /admin → redirige a / ──────────────────
  console.log('\n[T6] Usuario regular en /admin → redirige a /')
  await withPage(browser, async (page) => {
    await login(page, USER)
    await page.goto(`${BASE}/admin`)
    await page.waitForTimeout(3000)
    const url = page.url()
    !url.includes('/admin') && (url === `${BASE}/` || url === BASE)
      ? ok('T6: No-admin redirige a /', url)
      : fail('T6: No-admin redirige a /', `URL actual: ${url}`)
  })

  // ── T7: Admin dashboard carga datos reales (stats > 0) ──────────────────
  console.log('\n[T7] Dashboard admin muestra datos reales')
  await withPage(browser, async (page) => {
    await login(page, ADMIN)
    await page.waitForURL('**/admin', { timeout: 6000 }).catch(() => {})
    await page.waitForTimeout(3000)
    const bodyText = await page.textContent('main, body').catch(() => '')
    // Verifica que al menos un número > 0 aparece en los cards de stats
    const hasData = /[1-9]\d*/.test(bodyText)
    hasData
      ? ok('T7: Dashboard tiene datos reales')
      : fail('T7: Dashboard tiene datos reales', 'No se encontraron cifras > 0')
  })

  // ── T8: Botón logout del admin funciona ──────────────────────────────────
  console.log('\n[T8] Logout del admin')
  await withPage(browser, async (page) => {
    await login(page, ADMIN)
    await page.waitForURL('**/admin', { timeout: 6000 }).catch(() => {})
    await page.waitForTimeout(1500)
    // Click en botón logout (icono LogOut en el header)
    const logoutBtn = page.locator('header button[title="Cerrar sesión"]')
    const count = await logoutBtn.count()
    if (count === 0) {
      fail('T8: Logout funciona', 'Botón de logout no encontrado en header')
      return
    }
    await logoutBtn.click()
    await page.waitForTimeout(2500)
    const url = page.url()
    url.includes('/login')
      ? ok('T8: Logout funciona', `Redirigió a: ${url}`)
      : fail('T8: Logout funciona', `URL después de logout: ${url}`)
  })

  // ── T9: Sin sesión → reservar → redirige a /login?redirect= ─────────────
  console.log('\n[T9] Reservar sin sesión → redirige a /login')
  await withPage(browser, async (page) => {
    // Buscar un vehículo DISPONIBLE para poder ver el botón Reservar
    const res = await page.goto(`${BASE}/api/catalogo/vehiculos?per_page=20&estado=DISPONIBLE`)
    const data = await res?.json().catch(() => ({ items: [] }))
    const vehiculo = data?.items?.[0]
    if (!vehiculo) {
      fail('T9: Reservar sin sesión', 'No hay vehículos DISPONIBLES en el catálogo')
      return
    }
    await page.goto(`${BASE}/vehiculo/${vehiculo.id}`)
    // Esperar a que el precio del vehículo sea visible (confirma que el servidor renderizó)
    await page.waitForSelector('p.text-3xl, h1', { timeout: 10000 }).catch(() => {})
    await page.waitForTimeout(2000)

    const currentUrl = page.url()
    if (currentUrl.includes('/login') || !currentUrl.includes('/vehiculo/')) {
      fail('T9: Reservar sin sesión', `No llegó a la página del vehículo. URL: ${currentUrl}`)
      return
    }

    // Esperar explícitamente por el botón Reservar
    const reservarBtn = page.locator('button', { hasText: 'Reservar' })
    await reservarBtn.waitFor({ timeout: 5000 }).catch(() => {})
    const btnCount = await reservarBtn.count()
    if (btnCount === 0) {
      const allBtns = await page.locator('button').allTextContents()
      const bodySnippet = (await page.textContent('main').catch(() => '')).slice(0, 200)
      fail('T9: Reservar sin sesión', `Botón no encontrado. Botones: [${allBtns.join(' | ')}]. Body: ${bodySnippet}`)
      return
    }
    await reservarBtn.first().click()
    await page.waitForTimeout(3000)
    const url = page.url()
    url.includes('/login')
      ? ok('T9: Sin sesión, reservar redirige a /login', url)
      : fail('T9: Sin sesión, reservar redirige a /login', `URL: ${url}`)
  })

  // ── T10: Registro → login → navbar muestra nuevo usuario ─────────────────
  console.log('\n[T10] Registro nuevo usuario → login → navbar')
  await withPage(browser, async (page) => {
    const ts    = Date.now()
    const email = `testuser_${ts}@test.com`
    const pass  = 'TestPass99!'

    await page.goto(`${BASE}/registro`)
    await page.waitForLoadState('networkidle')
    await page.fill('#nombre', `Usuario Test ${ts}`)
    await page.fill('#email', email)
    await page.fill('#password', pass)
    await page.fill('#passwordConfirm', pass)
    await page.click('button[type=submit]')
    await page.waitForTimeout(3000)

    // Debe redirigir a /login tras registro
    const afterReg = page.url()
    if (!afterReg.includes('/login')) {
      fail('T10: Registro redirige a /login', `URL: ${afterReg}`)
      return
    }

    // Login con el nuevo usuario
    await page.fill('input[type=email]', email)
    await page.fill('input[type=password]', pass)
    await page.click('button[type=submit]')
    await page.waitForTimeout(3500)

    const afterLogin = page.url()
    if (afterLogin.includes('/login')) {
      fail('T10: Login con nuevo usuario', 'Sigue en /login tras credenciales correctas')
      return
    }

    await page.waitForTimeout(1500)
    const navText = await page.textContent('header').catch(() => '')
    navText.includes(`Test ${ts}`)
      ? ok('T10: Nuevo usuario aparece en navbar', `"Usuario Test ${ts}"`)
      : fail('T10: Nuevo usuario aparece en navbar', `Texto header: "${navText.slice(0, 100)}"`)
  })

  // ── T11: Sin CORS errors en ningún flujo ─────────────────────────────────
  console.log('\n[T11] Sin errores CORS en consola')
  await withPage(browser, async (page, _ctx, corsErrors) => {
    await login(page, USER)
    await page.waitForTimeout(2000)
    await page.goto(`${BASE}/`)
    await page.waitForTimeout(1500)
    corsErrors.length === 0
      ? ok('T11: Sin errores CORS en consola')
      : fail('T11: Sin errores CORS en consola', corsErrors.join(' | '))
  })

  // ── T12: /api/auth/me devuelve 401 JSON (no redirect HTML) ───────────────
  console.log('\n[T12] API 401 devuelve JSON, no redirect HTML')
  await withPage(browser, async (page) => {
    const response = await page.goto(`${BASE}/api/admin/vehiculos`)
    const status   = response?.status()
    const ct       = response?.headers()['content-type'] ?? ''
    status === 401 && ct.includes('application/json')
      ? ok('T12: 401 JSON correcto', `status=${status} content-type=${ct}`)
      : fail('T12: 401 JSON correcto', `status=${status} content-type=${ct}`)
  })

  await browser.close()

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60))
  console.log(`  RESULTADO FINAL: ${passed} pasaron / ${failed} fallaron`)
  console.log('═'.repeat(60))
  results.forEach(r => console.log(`  ${r.status}  ${r.name}`))
  console.log('═'.repeat(60) + '\n')

  process.exit(failed > 0 ? 1 : 0)
}

testSuite().catch(err => {
  console.error('Error fatal en tests:', err.message)
  process.exit(1)
})
