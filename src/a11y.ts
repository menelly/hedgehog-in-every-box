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
 *   contrast  text you can see against its background (axe's color-contrast
 *             rule, WCAG 2 AA), every failing piece of text listed with its
 *             colours and ratio. Needs @axe-core/playwright.
 *   honorific a title/salutation field (Mr, Mrs, Dr…) must be optional, offer
 *             a blank or "prefer not to say", and include Mx
 *   images    every picture is either marked decorative or says what it shows
 *             (not nothing, not its file name)
 *   axe       optional: if @axe-core/playwright is installed, its serious and
 *             critical findings are included
 *
 * 🗣️ contrast, honorific and images came from Ren, answering an "audit your
 * app" prompt on r/vibecoding that gave accessibility ONE line. They apply to
 * web pages and desktop shells (Tauri/Electron); a web proxy can't see a
 * native React Native screen, so that profile skips them (manual checklist).
 *
 * It's a smoke test, not an audit. Passing it means nobody is locked out by
 * the obvious things; it doesn't mean the app is accessible. Ask disabled
 * people. Pay them.
 */
import type { Page } from '@playwright/test'
import { CATALOGUE, appliesTo, platformsOf } from './catalogue'
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
  skip?: ('names' | 'keyboard' | 'targets' | 'sliders' | 'reflow' | 'dark' | 'contrast' | 'honorific' | 'images' | 'axe')[]
  /** most Tab presses to try (default 200) */
  maxTabs?: number
}

const why = (id: string) => firstSentence(CATALOGUE.find((c) => c.id === id)!.why)
const CHECK = 'a11ySmoke'

/** the bits of an axe result we read (so we don't need axe's types to compile) */
interface AxeNode {
  target: unknown[]
  html: string
  any?: { data?: { fgColor?: string; bgColor?: string; contrastRatio?: number; expectedContrastRatio?: string; fontSize?: string } | null }[]
}
interface AxeResults {
  violations: { id: string; impact?: string | null; help: string; nodes: AxeNode[] }[]
  incomplete: { id: string; nodes: AxeNode[] }[]
}
interface AxeBuilderLike {
  withRules(rules: string[]): AxeBuilderLike
  disableRules(rules: string[]): AxeBuilderLike
  analyze(): Promise<AxeResults>
}
type AxeBuilderClass = new (o: { page: Page }) => AxeBuilderLike

/** 🧰 @axe-core/playwright is optional: use it if it's installed, otherwise null */
async function loadAxe(): Promise<AxeBuilderClass | null> {
  try {
    const mod = await import('@axe-core/playwright' as string)
    return mod.default ?? mod.AxeBuilder ?? null
  } catch {
    return null
  }
}

/** the visible words of an axe node, for a human message: its text if it has any, else its tag */
function nodeWords(n: AxeNode): string {
  const text = n.html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return text ? `"${text.slice(0, 50)}${text.length > 50 ? '…' : ''}"` : n.html.slice(0, 60)
}

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

  // 🧭 the three checks from Ren's list are for web pages and desktop shells; say so when they're skipped
  const notHere = (caseId: string, title: string) => {
    const c = CATALOGUE.find((x) => x.id === caseId)!
    if (appliesTo(c, report.platforms)) return false
    report.skipped.push({ check: CHECK, reason: `${title}: not in profile ${report.platforms.join(' + ')} (applies to ${platformsOf(c).join(', ')})` })
    return true
  }
  const Axe = opts.axe === false ? null : await loadAxe()

  // ── 🎨 contrast: can you see the words? ──
  let contrastRan = false
  if (!skip.has('contrast') && !notHere('color-contrast', 'contrast')) {
    if (opts.axe === false) report.skipped.push({ check: CHECK, reason: 'contrast: needs axe, and you passed axe: false' })
    else if (!Axe) {
      if (opts.axe === true) add('color-contrast', 'axe', '@axe-core/playwright not installed', 'You asked for axe, but @axe-core/playwright is not installed, so contrast could not be checked: npm i -D @axe-core/playwright')
      else report.skipped.push({ check: CHECK, reason: 'contrast: @axe-core/playwright is not installed (npm i -D @axe-core/playwright to check it)' })
    } else {
      // ONLY the color-contrast rule: one question, answered completely
      const res = await new Axe({ page }).withRules(['color-contrast']).analyze()
      contrastRan = true
      const bad = res.violations.flatMap((v) => v.nodes)
      for (const n of bad) {
        const d = n.any?.find((a) => a.data?.contrastRatio !== undefined)?.data
        const colours = d ? `${d.fgColor} on ${d.bgColor}: ${d.contrastRatio}:1, needs ${d.expectedContrastRatio}` : 'contrast too low'
        add('color-contrast', `${nodeWords(n)} (${n.target.join(' ')})`, colours, `The text ${nodeWords(n)} is hard to see against its background (${colours}${d?.fontSize ? `, at ${d.fontSize}` : ''}). ${why('color-contrast')}`)
      }
      if (!bad.length) report.passed++
      // what axe couldn't judge (text over a picture or a gradient) is said out loud, not hidden
      const unsure = res.incomplete.flatMap((v) => v.nodes)
      if (unsure.length) report.skipped.push({ check: CHECK, reason: `contrast: axe couldn't judge ${unsure.length} piece(s) of text (over a picture, a gradient, or behind something), so check these by eye: ${unsure.slice(0, 5).map(nodeWords).join(', ')}` })
    }
  }

  // ── 🎩 honorifics: a way out of Mr and Mrs ──
  if (!skip.has('honorific') && !notHere('honorific-opt-out', 'honorific')) {
    const fields: { name: string; kind: string; required: boolean; optOut: boolean; mx: boolean; options: string[] }[] = await page.evaluate(() => {
      const words = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
      // the field's own words: its label, aria-label, legend, name and id, most human first
      const wordsFor = (el: HTMLElement) =>
        [
          el.getAttribute('aria-label'),
          (el.getAttribute('aria-labelledby') ?? '').split(/\s+/).filter(Boolean).map((id) => words(document.getElementById(id))).join(' '),
          el.id ? words(document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) : '',
          el.closest('label') ? words(el.closest('label')) : '',
          words(el.closest('fieldset')?.querySelector('legend') ?? null),
          el.getAttribute('name'),
          el.id,
        ].filter((w): w is string => !!w)
      // everything, for "is this a title field?"
      const labelOf = (el: HTMLElement) => wordsFor(el).join(' ')
      // the one a person would recognise, for the message
      const shownAs = (el: HTMLElement) => (wordsFor(el)[0] ?? 'title').slice(0, 40)
      const HONORIFIC_WORD = /\b(mr|mrs|ms|miss|mx|dr|title|salutation|honorific)\b/i
      // "Job title" and "Post title" are titles too, just not this kind
      const OTHER_TITLE = /\b(job|post|book|page|song|article|movie|film|task|document|event|project|work|position|role|listing|product|video|episode|chapter)\b/i
      const HONORIFIC_OPTION = /^\s*(mr|mrs|ms|miss|mx|dr)\.?\s*$/i
      // a way to say "no title": a blank, "prefer not to say", "none", a dash
      const OPT_OUT = /^\s*$|prefer not|rather not|\bnone\b|no title|not (specified|applicable)|^\s*n\/?a\s*$|^\s*[-–—]+\s*$/i
      // Mx, or another title that isn't gendered, or room to write your own
      const NEUTRAL = /\b(mx|mre|misc|ind)\b|\bother\b|self.describ|write (my|your) own|custom/i
      const isHonorific = (label: string, options: string[]) =>
        options.filter((o) => HONORIFIC_OPTION.test(o)).length >= 2 || (HONORIFIC_WORD.test(label) && !OTHER_TITLE.test(label))
      const visible = (el: Element) => el.getBoundingClientRect().width > 0 && getComputedStyle(el).visibility !== 'hidden'
      const req = (el: HTMLElement) => el.hasAttribute('required') || el.getAttribute('aria-required') === 'true'
      const out: { name: string; kind: string; required: boolean; optOut: boolean; mx: boolean; options: string[] }[] = []

      // 📋 dropdowns
      for (const sel of document.querySelectorAll<HTMLSelectElement>('select')) {
        if (!visible(sel)) continue
        const label = labelOf(sel)
        const all = [...sel.options]
        const options = all.map((o) => o.text.trim())
        if (!isHonorific(label, options)) continue
        // an opt-out a person can actually CHOOSE: a disabled "Choose…" placeholder doesn't count
        const usable = all.filter((o) => !o.disabled)
        out.push({
          name: shownAs(sel),
          kind: 'dropdown',
          required: req(sel),
          optOut: usable.some((o) => o.value === '' || OPT_OUT.test(o.text)),
          mx: usable.some((o) => NEUTRAL.test(o.text)),
          options,
        })
      }

      // 🔘 radio buttons, one group per name
      const groups = new Map<string, HTMLInputElement[]>()
      for (const r of document.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
        if (!visible(r) && !visible(r.closest('label') ?? r)) continue
        const g = r.name || r.id
        groups.set(g, [...(groups.get(g) ?? []), r])
      }
      for (const [name, radios] of groups) {
        const optionText = (r: HTMLInputElement) => (r.id ? words(document.querySelector(`label[for="${CSS.escape(r.id)}"]`)) : '') || words(r.closest('label')) || r.value
        const options = radios.map(optionText)
        const legend = words(radios[0].closest('fieldset')?.querySelector('legend') ?? null)
        if (!isHonorific(`${legend} ${name}`, options)) continue
        out.push({
          name: (legend || name).slice(0, 40),
          kind: 'set of buttons',
          required: radios.some(req),
          optOut: radios.some((r) => !r.disabled && OPT_OUT.test(optionText(r))),
          mx: radios.some((r) => !r.disabled && NEUTRAL.test(optionText(r))),
          options,
        })
      }

      // ✍️ a plain box labelled Title: anyone can type Mx or leave it blank, so long as it isn't required
      for (const box of document.querySelectorAll<HTMLInputElement>('input:not([type]), input[type="text"]')) {
        if (!visible(box)) continue
        const label = labelOf(box)
        if (!isHonorific(label, [])) continue
        out.push({ name: shownAs(box), kind: 'box', required: req(box), optOut: true, mx: true, options: [] })
      }
      return out
    })

    if (!fields.length) report.skipped.push({ check: CHECK, reason: 'honorific: no title/salutation field on this page (nothing to opt out of, which is the best answer)' })
    for (const f of fields) {
      let ok = true
      const where = `"${f.name}" ${f.kind}`
      if (f.required) {
        ok = false
        add('honorific-opt-out', where, 'required', `The "${f.name}" ${f.kind} is required, so nobody can save without picking Mr, Mrs or similar. ${why('honorific-opt-out')}`)
      }
      if (!f.optOut) {
        ok = false
        add('honorific-opt-out', where, `no blank or "prefer not to say" a person can choose (options: ${f.options.join(', ')})`, `The "${f.name}" ${f.kind} has no way to choose no title: no blank, and no "prefer not to say" that can actually be picked.`)
      }
      if (!f.mx) {
        ok = false
        add('honorific-opt-out', where, `no Mx or equivalent (options: ${f.options.join(', ')})`, `The "${f.name}" ${f.kind} has no Mx (or any title that isn't gendered), so a non-binary person has to pick one that's wrong.`)
      }
      if (ok) report.passed++
    }
  }

  // ── 🖼️ pictures that say what they are ──
  if (!skip.has('images') && !notHere('image-alt', 'images')) {
    const imgs: { src: string; alt: string | null; named: string | null }[] = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLImageElement>('img')]
        // decorative on purpose is fine: alt="", role presentation/none, or hidden from screen readers
        .filter((im) => im.getAttribute('alt') !== '' && !['presentation', 'none'].includes(im.getAttribute('role') ?? '') && !im.closest('[aria-hidden="true"]'))
        .map((im) => {
          const by = im.getAttribute('aria-labelledby')
          return {
            src: im.currentSrc || im.getAttribute('src') || '',
            alt: im.getAttribute('alt'),
            named: im.getAttribute('aria-label') || (by ? (document.getElementById(by)?.textContent ?? '').trim() : '') || null,
          }
        }),
    )
    let ok = true
    for (const im of imgs) {
      // the file name, for the message and for "is the alt text just the file name?"
      const file = im.src.startsWith('data:') ? '' : decodeURIComponent(im.src.split(/[?#]/)[0].split('/').pop() ?? '')
      const stem = file.replace(/\.[a-z0-9]+$/i, '')
      const which = file || 'an inline picture'
      const where = `picture ${file || im.src.slice(0, 40)}`
      const text = (im.alt ?? im.named ?? '').trim()
      const looksLikeFile =
        /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico|tiff?)$/i.test(text) || (stem.length > 0 && text.toLowerCase() === stem.toLowerCase()) || /^(img|dsc|pxl|screenshot)[_\- ]?\d/i.test(text)
      if (im.alt === null && !im.named) {
        ok = false
        add('image-alt', where, 'no alt attribute', `A picture (${which}) has no alt text at all, so a screen reader reads out its file name or just says "image". ${why('image-alt')} If it's decoration, give it alt="".`)
      } else if (!text) {
        ok = false
        add('image-alt', where, 'alt is only spaces', `A picture (${which}) has alt text that's only spaces. If it's decoration, use alt=""; if not, say what it shows.`)
      } else if (looksLikeFile) {
        ok = false
        add('image-alt', where, `alt is the file name: "${text}"`, `A picture's alt text is just its file name ("${text}"), which tells a blind person nothing about what it shows. ${why('image-alt')}`)
      } else if (/^(image|img|picture|photo|graphic|icon|logo|banner)$/i.test(text)) {
        ok = false
        add('image-alt', where, `alt says only "${text}"`, `A picture's alt text is just "${text}", which says THAT it's a picture, not WHAT it shows.`)
      }
    }
    if (ok) report.passed++
  }

  // ── axe, if you have it ──
  if (!skip.has('axe') && opts.axe !== false) {
    if (!Axe) {
      if (opts.axe === true) add('labels', 'axe', '@axe-core/playwright not installed', 'You asked for an axe scan, but @axe-core/playwright is not installed: npm i -D @axe-core/playwright')
      else report.skipped.push({ check: CHECK, reason: 'axe: @axe-core/playwright is not installed (optional; npm i -D @axe-core/playwright to add it)' })
    } else {
      const impacts = opts.axeImpacts ?? ['serious', 'critical']
      // contrast already had its own run above, with the colours and ratios; don't say it twice
      const builder = new Axe({ page })
      const res = await (contrastRan ? builder.disableRules(['color-contrast']) : builder).analyze()
      const bad = res.violations.filter((v) => impacts.includes(v.impact ?? ''))
      for (const v of bad) add('labels', `axe: ${v.id}`, `${v.impact}, ${v.nodes.length} element(s)`, `axe (${v.impact}): ${v.help} — on ${v.nodes.length} element(s).`)
      if (!bad.length) report.passed++
    }
  }

  return finish(report, opts)
}
