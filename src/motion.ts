/**
 * 🌀 THINGS THAT MOVE THAT SHOULDN'T.
 *
 * Four checks, each about motion the person didn't ask for:
 *
 *   1. REDUCE MOTION RESPECTED — with prefers-reduced-motion: reduce emulated
 *      and the page reloaded, nothing is animating once it has loaded.
 *   2. NOTHING LOOPS FOREVER — no infinitely repeating animation, and nothing
 *      moves on its own while nobody touches the page (auto-advancing
 *      carousels, tickers, JS-driven cycling).
 *   3. NO JUMPING — cumulative layout shift on load, and after typing in each
 *      box, stays under a threshold.
 *   4. NOTHING MOVES UNDER THE POINTER — each button stays put between
 *      pointer-down and pointer-up. (The pointer is released AWAY from the
 *      button, so nothing actually gets clicked.)
 *
 * Note: this reloads the page (twice), so run it where a reload is harmless.
 */
import type { Page } from '@playwright/test'
import { CATALOGUE } from './catalogue'
import { finish, firstSentence, newReport, resolvePlatforms, type CommonOptions, type Report } from './report'

export interface MotionOptions extends CommonOptions {
  /** buttons to press-and-hold (default: visible buttons, up to 30) */
  buttons?: string
  /** layout-shift score that counts as jumping (default 0.1, the "good" line for CLS) */
  clsThreshold?: number
  /** how long to watch an untouched page for things moving on their own (default 3000ms) */
  watchMs?: number
  /** also type in each text box and measure the shift that follows (default true) */
  typeInBoxes?: boolean
}

const why = (id: string) => firstSentence(CATALOGUE.find((c) => c.id === id)!.why)

const CLS_SCRIPT = `(() => {
  window.__hedgehogShifts = []
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__hedgehogShifts.push({ value: e.value, recent: e.hadRecentInput, t: e.startTime })
    }).observe({ type: 'layout-shift', buffered: true })
    window.__hedgehogClsSupported = true
  } catch { window.__hedgehogClsSupported = false }
})()`

/** describe an element in a few words */
const DESCRIBE = `(el) => {
  if (!el || !el.tagName) return 'something'
  const label = el.getAttribute('aria-label') || (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 40)
  return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '') + (label ? ' ("' + label + '")' : '')
}`

export async function motionCheck(page: Page, opts: MotionOptions = {}): Promise<Report> {
  const report = newReport('motionCheck', resolvePlatforms(opts))
  const CHECK = 'motionCheck'

  // ── 1. reduce motion respected ──
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await page.waitForTimeout(600)
  const stillMoving: string[] = await page.evaluate(`(() => {
    const describe = ${DESCRIBE}
    return document.getAnimations().filter(a => a.playState === 'running').map(a => describe(a.effect && a.effect.target))
  })()`)
  for (const what of [...new Set(stillMoving)]) {
    report.findings.push({
      check: CHECK,
      where: what,
      caseId: 'reduced-motion-ignored',
      what: 'animating with prefers-reduced-motion: reduce',
      human: `With "reduce motion" switched on, ${what} is still animating. ${why('reduced-motion-ignored')}`,
    })
  }
  if (!stillMoving.length) report.passed++

  // ── 2. nothing loops forever / moves on its own ──
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.addInitScript(CLS_SCRIPT)
  await page.reload()
  await page.waitForTimeout(1000)
  const forever: string[] = await page.evaluate(`(() => {
    const describe = ${DESCRIBE}
    return document.getAnimations().filter(a => a.playState === 'running' && a.effect && a.effect.getComputedTiming().iterations === Infinity).map(a => describe(a.effect.target))
  })()`)
  for (const what of [...new Set(forever)]) {
    report.findings.push({
      check: CHECK,
      where: what,
      caseId: 'endless-cycling',
      what: 'infinite animation',
      human: `${what} animates forever. ${why('endless-cycling')}`,
    })
  }
  if (!forever.length) report.passed++

  // things that move with nobody touching them (skipping what we already named above)
  const snap = `(() => {
    const out = {}
    let seen = 0
    // ids come from one counter on window, so elements that appear later never reuse an old id
    window.__hedgehogMotionNext = window.__hedgehogMotionNext || 0
    // already reported as animations above; their children ride along with them
    const animated = document.getAnimations().map(a => a.effect && a.effect.target).filter(Boolean)
    for (const el of document.querySelectorAll('body *')) {
      if (seen > 600) break
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) continue
      if (animated.some(t => t.contains(el))) continue
      if (!el.dataset.hedgehogMotion) el.dataset.hedgehogMotion = String(window.__hedgehogMotionNext++)
      out[el.dataset.hedgehogMotion] = [Math.round(r.x), Math.round(r.y + window.scrollY)]
      seen++
    }
    return out
  })()`
  // Sample several times, not twice: a carousel can come back round to the same
  // slide by the second look (3 slides × 1.2s, looked at 3s apart, often does).
  const watchMs = opts.watchMs ?? 3000
  const first: Record<string, [number, number]> = await page.evaluate(snap)
  const movedSet = new Set<string>()
  for (let t = 0; t < watchMs; t += 250) {
    await page.waitForTimeout(250)
    const now: Record<string, [number, number]> = await page.evaluate(snap)
    for (const k of Object.keys(first)) {
      if (now[k] && (Math.abs(now[k][0] - first[k][0]) > 2 || Math.abs(now[k][1] - first[k][1]) > 2)) movedSet.add(k)
    }
  }
  const moved = [...movedSet]
  if (moved.length) {
    // name only the outermost moving things, not every child of a carousel
    // (a function written as a STRING isn't called with an argument by Playwright, so the ids go in the string)
    const names: string[] = await page.evaluate(
      `(() => {
        const describe = ${DESCRIBE}
        const ids = ${JSON.stringify(moved)}
        const els = ids.map(id => document.querySelector('[data-hedgehog-motion="' + id + '"]')).filter(Boolean)
        return els.filter(el => !els.some(o => o !== el && o.contains(el))).slice(0, 5).map(describe)
      })()`,
    )
    for (const what of names) {
      report.findings.push({
        check: CHECK,
        where: what,
        caseId: 'endless-cycling',
        what: `moved on its own within ${watchMs}ms of nobody touching the page`,
        human: `${what} moved on its own while nobody was touching the page. ${why('endless-cycling')}`,
      })
    }
  } else report.passed++

  // ── 3. layout shift on load and after typing ──
  const supported = await page.evaluate('window.__hedgehogClsSupported === true')
  const threshold = opts.clsThreshold ?? 0.1
  if (!supported) {
    report.skipped.push({ check: CHECK, reason: 'layout shift: this browser has no Layout Instability API (Chromium does)' })
  } else {
    const onLoad: number = await page.evaluate('window.__hedgehogShifts.filter(s => !s.recent).reduce((a, s) => a + s.value, 0)')
    if (onLoad > threshold)
      report.findings.push({
        check: CHECK,
        where: 'page load',
        caseId: 'layout-shift',
        what: `cumulative layout shift ${onLoad.toFixed(3)} (threshold ${threshold})`,
        human: `The page jumps around while it loads (layout shift ${onLoad.toFixed(2)}). ${why('layout-shift')}`,
      })
    else report.passed++

    if (opts.typeInBoxes !== false) {
      const boxes = page.locator('input:not([type]):visible, input[type="text"]:visible, input[type="email"]:visible, input[type="tel"]:visible, input[type="search"]:visible, textarea:visible')
      const n = Math.min(await boxes.count(), 20)
      for (let i = 0; i < n; i++) {
        const box = boxes.nth(i)
        const name = (await box.getAttribute('aria-label')) || (await box.getAttribute('name')) || (await box.getAttribute('id')) || `box ${i + 1}`
        const mark: number = await page.evaluate('window.__hedgehogShifts.length')
        await box.fill('hedgehog 🦔')
        await box.blur()
        await page.waitForTimeout(400)
        // counted INCLUDING shifts right after input: this is exactly the "I typed and the page jumped" case
        const shift: number = await page.evaluate(`window.__hedgehogShifts.slice(${mark}).reduce((a, s) => a + s.value, 0)`)
        await box.fill('')
        if (shift > threshold)
          report.findings.push({
            check: CHECK,
            where: `${name} box`,
            caseId: 'layout-shift',
            what: `layout shift ${shift.toFixed(3)} after typing`,
            human: `Typing in the "${name}" box makes the page jump (layout shift ${shift.toFixed(2)}). ${why('layout-shift')}`,
          })
        else report.passed++
      }
    }
  }

  // ── 4. nothing moves under the pointer ──
  const buttons = page.locator(opts.buttons ?? 'button:visible, [role="button"]:visible, input[type="submit"]:visible, input[type="button"]:visible')
  const nb = Math.min(await buttons.count(), 30)
  const vp = page.viewportSize() ?? { width: 1280, height: 720 }
  for (let i = 0; i < nb; i++) {
    const b = buttons.nth(i)
    await b.scrollIntoViewIfNeeded().catch(() => {})
    const r0 = await b.boundingBox()
    if (!r0) continue
    const name = ((await b.getAttribute('aria-label')) || (await b.innerText().catch(() => '')) || `button ${i + 1}`).trim().slice(0, 40)
    await page.mouse.move(r0.x + r0.width / 2, r0.y + r0.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(150)
    const r1 = await b.boundingBox()
    // release far away from the button so it is NOT clicked
    await page.mouse.move(vp.width - 2, vp.height - 2)
    await page.mouse.up()
    if (r1 && (Math.abs(r1.x - r0.x) > 2 || Math.abs(r1.y - r0.y) > 2)) {
      report.findings.push({
        check: CHECK,
        where: `"${name}" button`,
        caseId: 'moves-under-the-pointer',
        what: `moved ${Math.round(r1.x - r0.x)},${Math.round(r1.y - r0.y)}px between pointer-down and pointer-up`,
        human: `The "${name}" button moves while it's being pressed, so the release can land on something else. ${why('moves-under-the-pointer')}`,
      })
    } else report.passed++
  }

  await page.emulateMedia({ reducedMotion: null })
  return finish(report, opts)
}
