/**
 * 🦔 THE PROOF — every helper, both directions.
 *
 *   broken.html → the helper must FIND the specific planted bugs (by case id)
 *   fixed.html  → the same helper must find NOTHING, and must have actually
 *                 checked something (a check that checks nothing can't pass)
 *
 * A test that can only say "found something" isn't a test. These can end at
 * "caught it" AND at "clean".
 */
import { devices, expect, test, type Page } from '@playwright/test'
import { CATALOGUE, hedgehog, type Report } from '../src'

let n = 0
const profile = () => `t${Date.now()}-${process.pid}-${n++}`
const ids = (r: Report) => new Set(r.findings.map((f) => f.caseId))

/** what "save" means in the demo: press Save, wait for the status to settle */
async function save(page: Page) {
  await page.locator('#save').click()
  await expect(page.locator('#status')).not.toHaveText(/^$|Saving…/, { timeout: 5000 })
}
const savedOk = async (page: Page) => (await page.locator('#status').textContent())?.startsWith('Saved') ?? false

const web = hedgehog({ platforms: ['web-desktop'] })

// ─────────────────────────────── 🚶 the walk + round trips ───────────────────────────────

test('🚶 walk + round trip: CATCHES the broken form', async ({ page }) => {
  await page.goto(`/broken.html?profile=${profile()}`)
  const r = await web.walkEveryTextbox(page, { roundTrip: { save }, throwOnFindings: false })
  const found = ids(r)
  expect(found).toContain('hedgehog') // btoa() throws on 🦔
  expect(found).toContain('zwj-emoji')
  expect(found).toContain('off-screen-box') // the nickname "popover"
  expect(found).toContain('quotes-and-backslash-n') // hand-built JSON: save fails, nothing comes back
  expect(found).toContain('windows-path')
  expect(found).toContain('long-paste') // notes cut to 1,000
  // the human message says what broke and why it matters
  expect(r.findings.find((f) => f.caseId === 'hedgehog')!.human).toBe(
    'After "🦔" (a hedgehog 🦔) went into the "Name" box, the app threw an error nobody caught. Emoji live outside the basic plane: one 🦔 is TWO JavaScript characters.',
  )
  // a url box is NOT trimmed by Chromium; the walk must not accuse it (regression: we once assumed it was)
  expect(r.findings.filter((f) => f.where.startsWith('Website box') && f.what.startsWith('holds'))).toEqual([])
})

test('🚶 walk + round trip: PASSES the fixed form', async ({ page }) => {
  await page.goto(`/fixed.html?profile=${profile()}`)
  const r = await web.walkEveryTextbox(page, { roundTrip: { save } })
  expect(r.passed).toBeGreaterThan(100)
})

test('🔢 leading zeros: 00501 comes back 501 on broken, 00501 on fixed', async ({ page }) => {
  await page.goto(`/broken.html?profile=${profile()}`)
  const bad = await web.roundTripValue(page, { box: '#zip', value: '00501', save, caseId: 'leading-zeros', throwOnFindings: false })
  expect(bad.findings[0].human).toContain('"501"')
  await page.goto(`/fixed.html?profile=${profile()}`)
  const good = await web.roundTripValue(page, { box: '#zip', value: '00501', save, caseId: 'leading-zeros' })
  expect(good.passed).toBe(1)
})

// ─────────────────────────────── 🔀 wrong field ───────────────────────────────

const mixupOpts = (url: string) => ({
  fields: { phone: '#phone', email: '#email', name: '#name', url: '#website' },
  reset: async (p: Page) => void (await p.goto(url)),
  fillValid: async (p: Page) => p.locator('#name').fill('Ren'),
  submit: async (p: Page) => p.locator('#save').click(),
  saved: async (p: Page) => {
    await p.waitForTimeout(300) // the demo server takes 150ms
    return savedOk(p)
  },
})

test('🔀 field mixup: CATCHES the broken form', async ({ page }) => {
  const r = await web.fieldMixup(page, { ...mixupOpts(`/broken.html?profile=${profile()}`), throwOnFindings: false })
  const found = ids(r)
  expect(found).toContain('address-in-phone') // refused with alert(), which some shells never show
  expect(found).toContain('phone-human-formats') // "(555) 123-4567" refused
  expect(found).toContain('url-without-scheme') // www.example.com blocks the whole form
  expect(found).not.toContain('phone-in-email') // browser email validation does say so: fair
  expect(r.findings.find((f) => f.caseId === 'address-in-phone')!.human).toMatch(/pop-up/)
  // search wasn't pointed at anything: skipped WITH a reason, not silently missing
  expect(r.skipped.map((s) => s.reason).join('\n')).toMatch(/search box/)
})

test('🔀 field mixup: PASSES the fixed form', async ({ page }) => {
  const r = await web.fieldMixup(page, mixupOpts(`/fixed.html?profile=${profile()}`))
  expect(r.passed).toBeGreaterThanOrEqual(6)
})

test('🔀 field mixup: the "saved it silently" message reads like a person wrote it', async ({ page }) => {
  // a form with NO phone validation at all
  await page.setContent(`<form onsubmit="event.preventDefault();document.getElementById('s').textContent='Saved ✓'"><label>Phone <input id="phone"></label><button>Save</button><span id="s"></span></form>`)
  const r = await web.fieldMixup(page, {
    fields: { phone: '#phone' },
    cases: CATALOGUE.filter((c) => c.id === 'address-in-phone'),
    reset: async () => {},
    submit: async (p) => p.getByRole('button', { name: 'Save' }).click(),
    saved: async (p) => (await p.locator('#s').textContent()) === 'Saved ✓',
    throwOnFindings: false,
  })
  expect(r.findings[0].human).toBe(
    'The phone box accepted "123 Main St, Apt 4" and saved it. Autofill picks the wrong line, a thumb hits the wrong box, or you were looking at the paper, not the screen. Validate it, or at least warn.',
  )
})

// ─────────────────────────────── 👆 interaction ───────────────────────────────

test('👆 double submit: broken sends two, fixed sends one', async ({ page }) => {
  await page.goto(`/broken.html?profile=${profile()}`)
  const bad = await web.doubleSubmit(page, { submit: '#save', request: '/api/save', throwOnFindings: false })
  expect(bad.findings[0].what).toMatch(/^2 requests/)
  await page.goto(`/fixed.html?profile=${profile()}`)
  const good = await web.doubleSubmit(page, { submit: '#save', request: '/api/save' })
  expect(good.passed).toBe(1)
})

test('👆 button mash: ten fast clicks — broken sends many, fixed sends one', async ({ page }) => {
  await page.goto(`/broken.html?profile=${profile()}`)
  const bad = await web.doubleSubmit(page, { submit: '#save', request: '/api/save', clicks: 10, throwOnFindings: false })
  expect(bad.findings[0].caseId).toBe('button-mash')
  expect(bad.findings[0].human).toMatch(/^10 fast clicks on submit sent \d+ requests\. When login is slow/)
  await page.goto(`/fixed.html?profile=${profile()}`)
  const good = await web.doubleSubmit(page, { submit: '#save', request: '/api/save', clicks: 10 })
  expect(good.passed).toBe(1)
})

for (const which of ['broken', 'fixed'] as const) {
  test(`📅 come back tomorrow: ${which === 'broken' ? 'CATCHES the date-keyed save' : 'PASSES the stable key'}`, async ({ page }) => {
    const r = await web.comeBackTomorrow(page, {
      url: `/${which}.html?profile=${profile()}`,
      create: async (p) => {
        await p.locator('#name').fill('Hedgehog')
        await save(p)
      },
      stillThere: async (p) => {
        await p.waitForTimeout(300)
        return (await p.locator('#name').inputValue()) === 'Hedgehog'
      },
      throwOnFindings: which === 'fixed',
    })
    if (which === 'broken') expect(ids(r)).toContain('come-back-tomorrow')
    else expect(r.passed).toBe(1)
  })
}

// ─────────────────────────────── 🌀 motion ───────────────────────────────

test('🌀 motion: CATCHES the broken form', async ({ page }) => {
  await page.goto(`/broken.html?profile=${profile()}`)
  const r = await web.motionCheck(page, { throwOnFindings: false })
  const found = ids(r)
  expect(found).toContain('reduced-motion-ignored')
  expect(found).toContain('endless-cycling') // the pulse AND the carousel
  expect(r.findings.some((f) => f.what.startsWith('moved on its own'))).toBe(true)
  expect(found).toContain('layout-shift')
  expect(found).toContain('moves-under-the-pointer')
})

test('🌀 motion: PASSES the fixed form', async ({ page }) => {
  await page.goto(`/fixed.html?profile=${profile()}`)
  const r = await web.motionCheck(page)
  expect(r.passed).toBeGreaterThan(5)
})

// ─────────────────────────────── ✂️ clipping ───────────────────────────────

test('✂️ clipping: CATCHES the broken form', async ({ page }) => {
  await page.goto(`/broken.html?profile=${profile()}`)
  const r = await web.clippingCheck(page, { throwOnFindings: false })
  const found = ids(r)
  expect(found).toContain('clipped-text')
  expect(found).toContain('one-letter-per-line')
})

test('✂️ clipping: PASSES the fixed form', async ({ page }) => {
  await page.goto(`/fixed.html?profile=${profile()}`)
  const r = await web.clippingCheck(page)
  expect(r.passed).toBe(3)
})

// ─────────────────────────────── 📱 the keyboard covers the box ───────────────────────────────

// a phone, minus the browser choice (Playwright won't switch browsers inside a describe block)
const { defaultBrowserType: _browser, ...pixel7 } = devices['Pixel 7']

test.describe('📱 mobile keyboard (on a phone)', () => {
  test.use(pixel7)
  const phone = hedgehog({ platforms: ['web-mobile'] })

  test('CATCHES the broken form', async ({ page }) => {
    await page.goto(`/broken.html?profile=${profile()}`)
    const r = await phone.keyboardCheck(page, { throwOnFindings: false })
    const found = ids(r)
    expect(found).toContain('hundred-vh')
    expect(found).toContain('fixed-footer-under-keyboard')
  })

  test('PASSES the fixed form', async ({ page }) => {
    await page.goto(`/fixed.html?profile=${profile()}`)
    const r = await phone.keyboardCheck(page)
    expect(r.passed).toBeGreaterThan(3)
  })
})

test('🧭 profiles: the keyboard check on a DESKTOP site is skipped with a reason, not failed', async ({ page }) => {
  await page.goto(`/broken.html?profile=${profile()}`)
  const r = await web.keyboardCheck(page) // would throw if it reported anything
  expect(r.findings).toEqual([])
  expect(r.passed).toBe(0)
  expect(r.skipped[0].reason).toBe('mobile keyboard: not in profile web-desktop (applies to web-mobile, react-native)')
  expect(web.applies('mobile-keyboard')).toBe(false)
  expect(web.applies('name')).toBe(true)
})

// ─────────────────────────────── ♿ accessibility ───────────────────────────────

test('♿ a11y smoke: CATCHES the broken form', async ({ page }) => {
  await page.goto(`/broken.html?profile=${profile()}`)
  const r = await web.a11ySmoke(page, { throwOnFindings: false })
  const found = ids(r)
  expect(found).toContain('labels') // notes: placeholder only
  expect(found).toContain('keyboard-only') // the Reset div, and no focus ring
  expect(found).toContain('one-handed') // the 16px ×
  expect(found).toContain('slider-only')
  expect(found).toContain('zoom-200') // 900px fixed width
  expect(found).toContain('dark-theme-boxes')
  expect(r.findings.some((f) => /Reset.*can't be reached with the Tab key/.test(f.human))).toBe(true)
})

test('♿ a11y smoke: PASSES the fixed form (axe included)', async ({ page }) => {
  await page.goto(`/fixed.html?profile=${profile()}`)
  const r = await web.a11ySmoke(page, { axe: true })
  expect(r.passed).toBeGreaterThanOrEqual(7)
})
