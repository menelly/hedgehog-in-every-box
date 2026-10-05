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

// ─────────────────── 🗣️ the questions accessibility should have asked ───────────────────
// Someone on r/vibecoding posted a giant "audit your app" prompt where accessibility got
// ONE line. Ren answered with the questions it should have asked. These test those.

/** a11ySmoke with only Ren's three page checks switched on */
const rensQuestions = { skip: ['names', 'keyboard', 'targets', 'sliders', 'reflow', 'dark', 'axe'] as const }
const only = (r: Report, caseId: string) => r.findings.filter((f) => f.caseId === caseId)

test('🗣️ contrast, honorifics, pictures: CATCHES the broken form', async ({ page }) => {
  await page.goto(`/broken.html?profile=${profile()}`)
  const r = await web.a11ySmoke(page, { skip: [...rensQuestions.skip], throwOnFindings: false })

  // 🎨 the pale grey small print, with its colours and ratio, in words
  const pale = only(r, 'color-contrast')
  expect(pale.some((f) => f.where.includes('By joining') && /#bbbbbb on #ffffff: [\d.]+:1, needs 4\.5:1/.test(f.what))).toBe(true)
  expect(pale.find((f) => f.where.includes('By joining'))!.human).toMatch(/^The text "By joining, you agree to be visited by hedgehogs\." is hard to see against its background/)

  // 🎩 the title dropdown: required, no real way to pick "no title", no Mx
  const title = only(r, 'honorific-opt-out')
  expect(title.map((f) => f.what.split(' (')[0]).sort()).toEqual(['no Mx or equivalent', 'no blank or "prefer not to say" a person can choose', 'required'])
  expect(title.every((f) => f.where.startsWith('"Title *'))).toBe(true)

  // 🖼️ one picture named after its file, one with no alt at all
  const pics = only(r, 'image-alt')
  expect(pics.map((f) => f.what).sort()).toEqual(['alt is the file name: "hedgehog-logo-final-v2"', 'no alt attribute'])
})

test('🗣️ contrast, honorifics, pictures: PASSES the fixed form', async ({ page }) => {
  await page.goto(`/fixed.html?profile=${profile()}`)
  const r = await web.a11ySmoke(page, { skip: [...rensQuestions.skip], axe: true })
  expect(r.passed).toBe(3) // contrast, the title dropdown, the pictures: each actually checked
  expect(r.skipped.filter((s) => s.reason.startsWith('honorific'))).toEqual([]) // it FOUND the title field
})

test('🎩 honorifics: no title field, or a "Job title", is skipped cleanly, not failed', async ({ page }) => {
  await page.setContent(`<label for="j">Job title</label><input id="j" required><label for="b">Book title</label><select id="b" required><option>Dune</option></select>`)
  const r = await web.a11ySmoke(page, { skip: ['names', 'keyboard', 'targets', 'sliders', 'reflow', 'dark', 'axe', 'contrast', 'images'] })
  expect(r.findings).toEqual([])
  expect(r.skipped.map((s) => s.reason)).toContain('honorific: no title/salutation field on this page (nothing to opt out of, which is the best answer)')
})

test('🎩 honorifics: radio buttons and a plain "Salutation" box are checked too', async ({ page }) => {
  await page.setContent(`
    <fieldset><legend>Title</legend>
      <label><input type="radio" name="t" value="mr" required> Mr</label>
      <label><input type="radio" name="t" value="ms"> Ms</label>
    </fieldset>
    <label for="s">Salutation</label><input id="s" required>
    <fieldset><legend>Honorific</legend>
      <label><input type="radio" name="h" value=""> Prefer not to say</label>
      <label><input type="radio" name="h" value="mx"> Mx</label>
      <label><input type="radio" name="h" value="dr"> Dr</label>
    </fieldset>`)
  const r = await web.a11ySmoke(page, { skip: ['names', 'keyboard', 'targets', 'sliders', 'reflow', 'dark', 'axe', 'contrast', 'images'], throwOnFindings: false })
  const where = (w: string) => r.findings.filter((f) => f.where === w).map((f) => f.what.split(' (')[0]).sort()
  expect(where('"Title" set of buttons')).toEqual(['no Mx or equivalent', 'no blank or "prefer not to say" a person can choose', 'required'])
  expect(where('"Salutation" box')).toEqual(['required']) // a box can hold Mx or nothing; it just mustn't be required
  expect(r.passed).toBe(1) // the Honorific group does it right
})

test('🧭 profiles: Ren\'s page checks skip React Native (the web proxy can\'t see a native screen)', async ({ page }) => {
  await page.goto(`/broken.html?profile=${profile()}`)
  const rn = hedgehog({ platforms: ['react-native'] })
  const r = await rn.a11ySmoke(page, { skip: [...rensQuestions.skip] })
  expect(r.findings).toEqual([])
  expect(r.skipped.map((s) => s.reason)).toEqual([
    'contrast: not in profile react-native (applies to web-desktop, web-mobile, desktop-shell)',
    'honorific: not in profile react-native (applies to web-desktop, web-mobile, desktop-shell)',
    'images: not in profile react-native (applies to web-desktop, web-mobile, desktop-shell)',
  ])
  const d = await rn.dictationCheck(page)
  expect(d.passed).toBe(0)
  expect(d.skipped[0].reason).toBe('dictation: not in profile react-native (applies to web-desktop, web-mobile, desktop-shell)')
  // and a Tauri/Electron app DOES get them
  expect(hedgehog({ platforms: ['desktop-shell'] }).cases().map((c) => c.id)).toEqual(expect.arrayContaining(['color-contrast', 'honorific-opt-out', 'dictation', 'image-alt']))
})

// ─────────────────────────────── 🎙️ dictation ───────────────────────────────

test('🎙️ dictation: CATCHES the box that eats the space between phrases', async ({ page }) => {
  await page.goto(`/broken.html?profile=${profile()}`)
  const r = await web.dictationCheck(page, { throwOnFindings: false })
  const nick = r.findings.filter((f) => f.where === 'Nickname box')
  expect(nick).toHaveLength(1)
  expect(nick[0].caseId).toBe('dictation')
  // the eaten trailing space is at the very END, so the message must show the end
  expect(nick[0].what).toBe('a whole phrase pasted in at once: holds "…omorrow morning.", wanted "…omorrow morning. " (first difference at character 59)')
  expect(nick[0].human).toMatch(/^The "Nickname" box didn't keep what was dictated \(a whole phrase pasted in at once\): it holds/)
  // the phone and email boxes aren't for sentences: skipped with a reason, not silently
  expect(r.skipped.some((s) => s.reason.startsWith('Phone box: a tel box'))).toBe(true)
})

test('🎙️ dictation: PASSES the fixed form', async ({ page }) => {
  await page.goto(`/fixed.html?profile=${profile()}`)
  const r = await web.dictationCheck(page)
  expect(r.passed).toBe(3) // Name, Nickname, Notes: phrase, correction, second phrase, leave
})

test('🎙️ dictation: an "auto-capitalise" mask that rewrites what was said is caught', async ({ page }) => {
  // rewrites the whole value on every input event: dictation's odd capitals are "fixed" out from under the person
  await page.setContent(`<label for="d">Diary</label><input id="d" oninput="this.value=this.value.charAt(0).toUpperCase()+this.value.slice(1).toLowerCase()">`)
  const r = await web.dictationCheck(page, { throwOnFindings: false })
  expect(r.findings).toHaveLength(1)
  expect(r.findings[0].what).toBe('a whole phrase pasted in at once: holds "Pick up the prescription", wanted "pick up the Prescription" (first difference at character 1)')
})
