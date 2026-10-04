/**
 * ♿ THE ACCESSIBILITY SMOKE TEST — the checks a disabled tester runs first,
 * because they're the ones that lock people out entirely.
 *
 *   names     every control has a name a screen reader can say (a placeholder
 *             is not a label)
 *   keyboard  Tab reaches every interactive thing, and you can SEE where focus is
 *   targets   buttons and boxes at least 24×24 CSS px, or spaced so they can't be
 *             mis-hit (WCAG 2.5.8 and its spacing exception): one thumb, one hand, a tremor
 *   sliders   no value you can only set by dragging
 *   reflow    at 640px (a 1280px window at 200% zoom) and 375px (a phone):
 *             no sideways scrolling, every box on screen
 *   dark      on a dark theme, no glaring white text boxes
 *   axe       optional: if @axe-core/playwright is installed, its serious and
 *             critical findings are included
 *
 * It's a smoke test, not an audit. Passing it means nobody is locked out by
 * the obvious things; it doesn't mean the app is accessible. Ask disabled
 * people. Pay them.
 */
import type { Page } from '@playwright/test'
import { CATALOGUE } from './catalogue'
import { finish, firstSentence, newReport, resolvePlatforms, type CommonOptions, type Report } from './report'

export interface A11yOptions extends CommonOptions {
  /** run axe if installed ('auto', default), require it (true), or never (false) */
  axe?: boolean | 'auto'
  /** which axe impacts count (default serious + critical) */
  axeImpacts?: string[]
  /** widths to check reflow at (default [640, 375]) */
  reflowWidths?: number[]
  /** smallest acceptable target, CSS px (default 24) */
  minTarget?: number
  /** skip a sub-check */
  skip?: ('names' | 'keyboard' | 'targets' | 'sliders' | 'reflow' | 'dark' | 'axe')[]
  /** most Tab presses to try (default 200) */
  maxTabs?: number
}

const why = (id: string) => firstSentence(CATALOGUE.find((c) => c.id === id)!.why)
const CHECK = 'a11ySmoke'

export async function a11ySmoke(page: Page, opts: A11yOptions = {}): Promise<Report> {
  const report = newReport(CHECK, resolvePlatforms(opts))
  const skip = new Set(opts.skip ?? [])
  const add = (caseId: string, where: string, what: string, human: string) => report.findings.push({ check: CHECK, caseId, where, what, human })

  // ── tag every interactive thing and describe it ──
  const controls: { tag: string; name: string; nameFrom: string; role: string; x: number; y: number; w: number; h: number; tabbable: boolean }[] = await page.evaluate(() => {
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
    const sel = 'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), [onclick], [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="tab"], [contenteditable="true"]'
    const out: { tag: string; name: string; nameFrom: string; role: string; x: number; y: number; w: number; h: number; tabbable: boolean }[] = []
    let i = 0
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || (el as HTMLInputElement).disabled) continue
      el.dataset.hedgehogA11y = String(i++)
      const labelled = el.getAttribute('aria-labelledby')
      let name = ''
      let nameFrom = ''
      const tries: [string, () => string][] = [
        ['aria-labelledby', () => (labelled ? labelled.split(/\s+/).map((id) => text(document.getElementById(id))).join(' ') : '')],
        ['aria-label', () => el.getAttribute('aria-label') ?? ''],
        ['label', () => (el.id ? text(document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) : '') || text(el.closest('label'))],
        ['content', () => (['BUTTON', 'A'].includes(el.tagName) || el.getAttribute('role') || el.hasAttribute('onclick') ? text(el) || [...el.querySelectorAll('img[alt]')].map((im) => im.getAttribute('alt')).join(' ') : '')],
        ['value', () => (el instanceof HTMLInputElement && ['submit', 'button', 'reset'].includes(el.type) ? el.value : '')],
        ['title', () => el.getAttribute('title') ?? ''],
        ['placeholder', () => el.getAttribute('placeholder') ?? ''],
      ]
      for (const [from, get] of tries) {
        const v = get().trim()
        if (v) {
          name = v.slice(0, 50)
          nameFrom = from
          break
        }
      }
      // a small checkbox inside its label: the label is the target
      const target = el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type) && el.closest('label') ? el.closest('label')!.getBoundingClientRect() : r
      const natural = el.matches('a[href], button, input, select, textarea, [contenteditable="true"]')
      const ti = el.getAttribute('tabindex')
      out.push({ tag: el.dataset.hedgehogA11y, name, nameFrom, role: el.getAttribute('role') ?? el.tagName.toLowerCase(), x: target.left, y: target.top, w: target.width, h: target.height, tabbable: natural || (ti !== null && ti !== '-1') })
    }
    return out
  })
  const label = (c: (typeof controls)[number]) => (c.name ? `"${c.name}"` : `an unnamed ${c.role}`)

  // ── names ──
  if (!skip.has('names')) {
    let ok = true
    for (const c of controls) {
      if (!c.name) {
        ok = false
        add('labels', c.role, 'no accessible name', `A ${c.role} on this page has no name a screen reader can say, so a blind user hears only "${c.role}". ${why('labels')}`)
      } else if (c.nameFrom === 'placeholder') {
        ok = false
        add('labels', `"${c.name}" box`, 'named only by its placeholder', `The "${c.name}" box is labelled only by placeholder text, which vanishes as soon as someone types. ${why('labels')}`)
      }
    }
    if (ok) report.passed++
  }

  // ── keyboard: reach everything, see where focus is ──
  if (!skip.has('keyboard')) {
    const baseline: Record<string, string> = await page.evaluate(() => {
      const out: Record<string, string> = {}
      ;(document.activeElement as HTMLElement | null)?.blur()
      for (const el of document.querySelectorAll<HTMLElement>('[data-hedgehog-a11y]')) {
        const s = getComputedStyle(el)
        out[el.dataset.hedgehogA11y!] = [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor, s.textDecorationLine].join('|')
      }
      return out
    })
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.locator('body').click({ position: { x: 1, y: 1 } }).catch(() => {})
    const reached = new Set<string>()
    const noRing = new Set<string>()
    let first: string | null = null
    for (let i = 0; i < (opts.maxTabs ?? 200); i++) {
      await page.keyboard.press('Tab')
      const now: { tag: string | null; look: string } = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null
        if (!el || !el.dataset.hedgehogA11y) return { tag: null, look: '' }
        const s = getComputedStyle(el)
        return { tag: el.dataset.hedgehogA11y, look: [s.outlineStyle, s.outlineWidth, s.outlineColor, s.boxShadow, s.borderColor, s.backgroundColor, s.textDecorationLine].join('|') }
      })
      if (!now.tag) continue
      if (now.tag === first) break // went all the way round
      first ??= now.tag
      reached.add(now.tag)
      const [style, width] = now.look.split('|')
      const ringless = now.look === baseline[now.tag] || (style === 'none' && width === '0px' && now.look === baseline[now.tag])
      if (ringless) noRing.add(now.tag)
    }
    let ok = true
    for (const c of controls) {
      if (!reached.has(c.tag)) {
        ok = false
        add('keyboard-only', label(c), c.tabbable ? 'not reached by Tab' : 'clickable, but not focusable at all', `${label(c)} can't be reached with the Tab key, so keyboard and switch users can't use it. ${why('keyboard-only')}`)
      } else if (noRing.has(c.tag)) {
        ok = false
        add('keyboard-only', label(c), 'looks the same focused and unfocused', `When ${label(c)} has keyboard focus, nothing on screen changes, so a keyboard user can't tell where they are. ${why('keyboard-only')}`)
      }
    }
    if (ok) report.passed++
  }

  // ── targets ──
  if (!skip.has('targets')) {
    const min = opts.minTarget ?? 24
    let ok = true
    const centre = (c: (typeof controls)[number]) => ({ x: c.x + c.w / 2, y: c.y + c.h / 2 })
    // distance from a point to a rectangle (0 if inside)
    const toRect = (p: { x: number; y: number }, c: (typeof controls)[number]) =>
      Math.hypot(Math.max(c.x - p.x, 0, p.x - (c.x + c.w)), Math.max(c.y - p.y, 0, p.y - (c.y + c.h)))
    const small = (c: (typeof controls)[number]) => c.w < min || c.h < min
    for (const c of controls) {
      if (c.role === 'a') continue // inline links in text are exempt in WCAG 2.5.8
      if (small(c)) {
        // WCAG 2.5.8's spacing exception: an undersized target is fine if a 24px circle
        // around its centre touches no other target, and no other undersized target's circle
        const p = centre(c)
        const crowded = controls.some((o) => o !== c && (toRect(p, o) < min / 2 || (small(o) && Math.hypot(centre(o).x - p.x, centre(o).y - p.y) < min)))
        if (!crowded) continue
        ok = false
        add('one-handed', label(c), `${Math.round(c.w)}×${Math.round(c.h)}px (minimum ${min})`, `${label(c)} is only ${Math.round(c.w)}×${Math.round(c.h)} pixels. ${why('one-handed')}`)
      }
    }
    if (ok) report.passed++
  }

  // ── sliders you can only drag ──
  if (!skip.has('sliders')) {
    const lonely: string[] = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLInputElement>('input[type="range"]')]
        .filter((r) => {
          // "beside it" means: in the same label, or in a small wrapper (≤ 4 controls) with it.
          // A number box elsewhere in the same big form doesn't count.
          const companion = 'input[type="number"], input[inputmode="numeric"], input[inputmode="decimal"]'
          if (r.closest('label')?.querySelector(companion)) return false
          const wrap = r.parentElement
          if (wrap && wrap.querySelectorAll('input, select, textarea, button').length <= 4 && wrap.querySelector(companion)) return false
          return true
        })
        .map((r) => r.getAttribute('aria-label') || (r.id && document.querySelector(`label[for="${CSS.escape(r.id)}"]`)?.textContent?.trim()) || r.closest('label')?.textContent?.trim() || 'a slider'),
    )
    for (const s of lonely) add('slider-only', s, 'range input with no number box', `The "${s}" setting can only be changed by dragging a slider. ${why('slider-only')}`)
    if (!lonely.length) report.passed++
  }

  // ── reflow at 200% zoom and on a phone ──
  if (!skip.has('reflow')) {
    const original = page.viewportSize()
    for (const w of opts.reflowWidths ?? [640, 375]) {
      await page.setViewportSize({ width: w, height: original?.height ?? 800 })
      await page.waitForTimeout(150)
      const r = await page.evaluate((w) => {
        const sideways = document.documentElement.scrollWidth - document.documentElement.clientWidth
        const off = [...document.querySelectorAll<HTMLElement>('input, textarea, select, button')]
          .filter((el) => {
            const b = el.getBoundingClientRect()
            return b.width > 0 && (b.right > w + 1 || b.left < -1)
          })
          .map((el) => el.getAttribute('aria-label') || el.getAttribute('name') || el.id || (el.textContent ?? '').trim().slice(0, 30) || el.tagName.toLowerCase())
        return { sideways, off }
      }, w)
      const at = w === 375 ? 'on a phone-width screen (375px)' : `at ${w}px wide (a ${w * 2}px window at 200% zoom)`
      if (r.sideways > 1) add('zoom-200', `${w}px`, `${r.sideways}px of sideways scrolling`, `${at[0].toUpperCase() + at.slice(1)}, the page scrolls sideways by ${r.sideways}px. ${why('zoom-200')}`)
      for (const o of r.off) add('zoom-200', `${o} (${w}px)`, 'control off the edge', `"${o}" sits off the edge of the screen ${at}.`)
      if (r.sideways <= 1 && !r.off.length) report.passed++
    }
    if (original) await page.setViewportSize(original)
  }

  // ── dark theme: no glaring white boxes ──
  if (!skip.has('dark')) {
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.waitForTimeout(150)
    const r = await page.evaluate(() => {
      const lum = (c: string) => {
        const m = c.match(/[\d.]+/g)
        if (!m || (m.length > 3 && Number(m[3]) === 0)) return null
        const [R, G, B] = m.slice(0, 3).map((v) => {
          const x = Number(v) / 255
          return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
        })
        return 0.2126 * R + 0.7152 * G + 0.0722 * B
      }
      const bg = lum(getComputedStyle(document.body).backgroundColor) ?? lum(getComputedStyle(document.documentElement).backgroundColor) ?? 1
      const bright = [...document.querySelectorAll<HTMLElement>('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, select')]
        .filter((el) => el.getBoundingClientRect().width > 0 && (lum(getComputedStyle(el).backgroundColor) ?? 0) > 0.6)
        .map((el) => el.getAttribute('aria-label') || el.getAttribute('name') || el.id || el.tagName.toLowerCase())
      return { dark: bg < 0.2, bright }
    })
    if (!r.dark) report.skipped.push({ check: CHECK, reason: 'dark theme: the page has no dark theme to check (fine; this only checks pages that have one)' })
    else {
      for (const b of r.bright) add('dark-theme-boxes', `${b} box`, 'light box on a dark page', `On the dark theme, the "${b}" box is glaring white. ${why('dark-theme-boxes')}`)
      if (!r.bright.length) report.passed++
    }
    await page.emulateMedia({ colorScheme: null })
  }

  // ── axe, if you have it ──
  if (!skip.has('axe') && opts.axe !== false) {
    let AxeBuilder: (new (o: { page: Page }) => { analyze(): Promise<{ violations: { id: string; impact?: string | null; help: string; nodes: unknown[] }[] }> }) | null = null
    try {
      // optional dependency: only used if installed
      const mod = await import('@axe-core/playwright' as string)
      AxeBuilder = mod.default ?? mod.AxeBuilder
    } catch {
      AxeBuilder = null
    }
    if (!AxeBuilder) {
      if (opts.axe === true) add('labels', 'axe', '@axe-core/playwright not installed', 'You asked for an axe scan, but @axe-core/playwright is not installed: npm i -D @axe-core/playwright')
      else report.skipped.push({ check: CHECK, reason: 'axe: @axe-core/playwright is not installed (optional; npm i -D @axe-core/playwright to add it)' })
    } else {
      const impacts = opts.axeImpacts ?? ['serious', 'critical']
      const res = await new AxeBuilder({ page }).analyze()
      const bad = res.violations.filter((v) => impacts.includes(v.impact ?? ''))
      for (const v of bad) add('labels', `axe: ${v.id}`, `${v.impact}, ${v.nodes.length} element(s)`, `axe (${v.impact}): ${v.help} — on ${v.nodes.length} element(s).`)
      if (!bad.length) report.passed++
    }
  }

  return finish(report, opts)
}
