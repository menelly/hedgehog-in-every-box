/**
 * 📱 THE KEYBOARD COVERS THE BOX.
 *
 * "SO MANY APPS HAVE THIS BROKEN RIGHT NOW." — Ren, 2026
 *
 * A browser can't open a real on-screen keyboard in a test, so this SIMULATES
 * one, honestly, in the way the page itself has asked the browser to behave:
 *
 *   - If the viewport meta says interactive-widget=resizes-content, the
 *     keyboard shrinks the whole layout. We shrink the viewport by the
 *     keyboard's height and let the page lay itself out again.
 *   - Otherwise (the default on iOS Safari and on Android Chrome 108+), the
 *     keyboard only shrinks the VISUAL viewport. Fixed footers stay glued to
 *     the bottom of the layout, under the keys. We work out what the browser
 *     would scroll to, and what would still be under the keyboard.
 *
 * For each text box: focus it, bring up the "keyboard" (~40% of the height),
 * and check the box, and its submit button when that sits right beside it or
 * in a fixed footer, are still where a person can see them.
 *
 * Also reports: fixed/sticky footers holding inputs or buttons that would end
 * up under the keyboard, and layouts sized in vh with no dvh/svh anywhere.
 *
 * ⚠️ Real devices differ (iOS Safari vs Android Chrome vs in-app WebViews).
 * This catches the common ways it breaks; it doesn't replace a phone.
 */
import type { Page } from '@playwright/test'
import { CATALOGUE, KIND_PLATFORMS } from './catalogue'
import { finish, firstSentence, newReport, notApplicable, resolvePlatforms, type CommonOptions, type Report } from './report'
import { findTextBoxes, boxLocator } from './walk'

export interface KeyboardOptions extends CommonOptions {
  /** fraction of the screen height the keyboard takes (default 0.4) */
  keyboardFraction?: number
  /** a selector for "the submit button for this box", given the box's name; default: the form's submit button */
  submitFor?: (boxName: string) => string | null
  /** if the page is wider than this it's resized to a phone (412×915) for the check (default 600) */
  phoneIfWiderThan?: number
}

const why = (id: string) => firstSentence(CATALOGUE.find((c) => c.id === id)!.why)
export const KEYBOARD_PLATFORMS = KIND_PLATFORMS['mobile-keyboard']

export async function keyboardCheck(page: Page, opts: KeyboardOptions = {}): Promise<Report> {
  const platforms = resolvePlatforms(opts)
  const report = newReport('keyboardCheck', platforms)
  const skip = notApplicable('mobile keyboard', KEYBOARD_PLATFORMS, platforms)
  if (skip) {
    report.skipped.push({ check: 'keyboardCheck', reason: skip })
    return finish(report, opts)
  }

  const original = page.viewportSize() ?? { width: 412, height: 915 }
  const phone = original.width > (opts.phoneIfWiderThan ?? 600) ? { width: 412, height: 915 } : original
  if (phone !== original) await page.setViewportSize(phone)
  const kb = Math.round(phone.height * (opts.keyboardFraction ?? 0.4))

  // ── what has the page told the browser? ──
  const page_ = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? ''
    const resizesContent = /interactive-widget\s*=\s*resizes-content/i.test(meta)
    let vh = 0
    let dvh = 0
    const vhSamples: string[] = []
    for (const sheet of [...document.styleSheets]) {
      let rules: CSSRuleList
      try {
        rules = sheet.cssRules
      } catch {
        continue // cross-origin sheet; can't read it
      }
      const walk = (list: CSSRuleList) => {
        for (const rule of [...list]) {
          if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules) walk((rule as CSSGroupingRule).cssRules)
          const style = (rule as CSSStyleRule).style
          if (!style) continue
          for (const prop of ['height', 'min-height', 'max-height']) {
            const v = style.getPropertyValue(prop)
            if (/\d(\.\d+)?vh\b/.test(v)) {
              vh++
              if (vhSamples.length < 3) vhSamples.push(`${(rule as CSSStyleRule).selectorText} { ${prop}: ${v} }`)
            }
            if (/\d(\.\d+)?(dvh|svh)\b/.test(v)) dvh++
          }
        }
      }
      walk(rules)
    }
    return { meta, resizesContent, vh, dvh, vhSamples }
  })

  if (page_.vh > 0 && page_.dvh === 0) {
    report.findings.push({
      check: 'keyboardCheck',
      where: page_.vhSamples.join('; '),
      caseId: 'hundred-vh',
      what: `${page_.vh} height rules in vh, none in dvh/svh`,
      human: `This page sizes things in vh (${page_.vhSamples[0]}), which is the LARGEST the screen can be. With a keyboard or browser toolbar showing, those panels run off the bottom. Use dvh or svh, which follow the height a person can actually see.`,
    })
  } else report.passed++

  // ── each box, with the keyboard up ──
  const boxes = await findTextBoxes(page)
  const coveredFooters = new Map<string, string>()
  const H = phone.height
  for (const b of boxes) {
    await page.setViewportSize(phone)
    await page.evaluate(() => window.scrollTo(0, 0))
    const box = boxLocator(page, b)
    await box.focus()
    // the browser brings a focused box into view
    await box.evaluate((el) => el.scrollIntoView({ block: 'nearest' }))
    if (page_.resizesContent) {
      // RESIZES-CONTENT (and React Native adjustResize): the layout itself shrinks
      await page.setViewportSize({ width: phone.width, height: H - kb })
      await box.evaluate((el) => el.scrollIntoView({ block: 'nearest' }))
      await page.waitForTimeout(100)
    }

    const seen = await box.evaluate(
      (el, [H, kb, resizesContent, submitSel]) => {
        const fixedAncestor = (n: Element | null): Element | null => {
          for (let a = n; a; a = a.parentElement) {
            const p = getComputedStyle(a).position
            if (p === 'fixed' || p === 'sticky') return a
          }
          return null
        }
        const r = el.getBoundingClientRect()
        // the visible window, in viewport coordinates
        let top = 0
        let bottom = H - kb
        if (!resizesContent) {
          // RESIZES-VISUAL (iOS Safari, Android Chrome 108+ default): the layout stays full height and
          // the browser PANS the visual viewport down just far enough to show the focused box
          const pan = Math.min(Math.max(r.bottom - (H - kb), 0), kb)
          top = pan
          bottom = pan + (H - kb)
        }
        const inView = (x: DOMRect) => x.top >= top - 1 && x.bottom <= bottom + 1
        const form = (el as HTMLInputElement).form ?? el.closest('form')
        const submit = (submitSel ? document.querySelector(submitSel) : null) ?? form?.querySelector('[type="submit"], button:not([type])') ?? null
        let submitState: 'none' | 'ok' | 'covered' | 'far' | 'in-footer' = 'none'
        if (submit) {
          const s = submit.getBoundingClientRect()
          const bar = fixedAncestor(submit)
          const near = Math.abs(s.top - r.bottom) < 120 || Math.abs(s.top - r.top) < 20
          // a submit in a fixed bar is reported ONCE, as that bar (below), not once per box
          submitState = bar && bar !== fixedAncestor(el) ? 'in-footer' : !near && !bar ? 'far' : inView(s) ? 'ok' : 'covered'
        }
        // fixed/sticky bars holding controls that end up under the keys (not the one we're typing in)
        const mine = fixedAncestor(el)
        const footers: { name: string; text: string }[] = []
        for (const f of document.querySelectorAll('body *')) {
          const p = getComputedStyle(f).position
          if (p !== 'fixed' && p !== 'sticky') continue
          if (f === mine || f.contains(el) || !f.querySelector('input, textarea, button, select, a[href]')) continue
          const fr = f.getBoundingClientRect()
          if (fr.height === 0 || inView(fr)) continue
          if (fr.top >= bottom - 1) footers.push({ name: f.tagName.toLowerCase() + (f.id ? '#' + f.id : '') + (f.classList.length ? '.' + f.classList[0] : ''), text: (f.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 30) })
        }
        return { boxOk: inView(r), inFixed: !!mine, submitState, submitText: (submit?.textContent ?? '').trim().slice(0, 30), footers, bottom }
      },
      [H, kb, page_.resizesContent, opts.submitFor?.(b.key) ?? null] as const,
    )
    for (const f of seen.footers) coveredFooters.set(f.name, f.text)

    if (!seen.boxOk) {
      report.findings.push({
        check: 'keyboardCheck',
        where: `${b.key} box`,
        caseId: seen.inFixed ? 'fixed-footer-under-keyboard' : 'keyboard-covers-box',
        what: `box not inside the visible area once the keyboard (${kb}px) is up${seen.inFixed ? ' (it sits in a fixed/sticky element)' : ''}`,
        human: `With the keyboard up, the "${b.key}" box is hidden under it, so the person types blind. ${why(seen.inFixed ? 'fixed-footer-under-keyboard' : 'keyboard-covers-box')}`,
      })
    } else if (seen.submitState === 'covered') {
      report.findings.push({
        check: 'keyboardCheck',
        where: `${b.key} box`,
        caseId: 'keyboard-covers-box',
        what: `box visible, its "${seen.submitText}" button is not`,
        human: `With the keyboard up, the "${b.key}" box shows but its "${seen.submitText}" button is hidden under the keys. ${why('keyboard-covers-box')}`,
      })
    } else report.passed++
    await box.blur()
  }
  for (const [name, text] of coveredFooters) {
    report.findings.push({
      check: 'keyboardCheck',
      where: name,
      caseId: 'fixed-footer-under-keyboard',
      what: `fixed/sticky bar ("${text}") is under the keyboard while typing elsewhere`,
      human: `The bar at the bottom ("${text}") stays glued to the bottom of the page and disappears under the keyboard while the person is typing. ${why('fixed-footer-under-keyboard')}`,
    })
  }

  if (!page_.resizesContent && report.findings.some((f) => f.caseId !== 'hundred-vh')) {
    report.findings.push({
      check: 'keyboardCheck',
      where: 'viewport meta',
      what: `content="${page_.meta}"`,
      human: 'One fix to try: add interactive-widget=resizes-content to the viewport meta tag, so the keyboard shrinks the layout instead of covering it (Android Chrome honours it), or follow window.visualViewport and move the footer yourself (works on iOS too).',
    })
  }

  await page.setViewportSize(original)
  return finish(report, opts)
}
