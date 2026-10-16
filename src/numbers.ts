/**
 * 🪙 FLOATING-POINT CRUMBS — 0.1 + 0.2 = 0.30000000000000004.
 *
 * Reads every number on screen and in every box, and flags the ones whose
 * decimals carry the tell-tale run of zeros or nines that binary floating
 * point leaves behind (0.30000000000000004, 0.7999999999999999).
 *
 * Honest about its edges: it finds the CRUMBS, not wrong sums. A total that
 * is off by a whole cent, or rounded the wrong way, looks perfectly fine to
 * it. Keep money in whole cents (or a decimal library), and format it for
 * display with toFixed / Intl.NumberFormat.
 */
import type { Page } from '@playwright/test'
import { CATALOGUE } from './catalogue'
import { finish, firstSentence, newReport, resolvePlatforms, show, type CommonOptions, type Report } from './report'

export interface FloatingPointOptions extends CommonOptions {
  /** do something first, so the numbers you care about are on screen (fill a cart, type a price) */
  run?: (page: Page) => Promise<void>
  /** only look inside this part of the page (CSS selector) */
  within?: string
}

/** 8+ zeros then a stray digit, or 8+ nines, in the decimals */
export const FLOAT_CRUMBS = /\d*\.\d*?(?:0{8,}[1-9]\d*|9{8,}\d*)/g

export async function floatingPointCheck(page: Page, opts: FloatingPointOptions = {}): Promise<Report> {
  const CHECK = 'floatingPointCheck'
  const report = newReport(CHECK, resolvePlatforms(opts))
  await opts.run?.(page)
  const seen = await page.evaluate((within) => {
    const root = (within ? document.querySelector(within) : document.body) ?? document.body
    const out: { where: string; text: string }[] = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement
      const t = (n.textContent ?? '').trim()
      if (!t || !el || el.closest('script, style, noscript, template')) continue
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0 || getComputedStyle(el).visibility === 'hidden') continue
      out.push({ where: `<${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}>`, text: t })
    }
    for (const el of root.querySelectorAll('input, textarea, output')) {
      const v = (el as HTMLInputElement).value
      if (v) out.push({ where: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} (its value)`, text: v })
    }
    return out
  }, opts.within ?? null)

  const decimals = seen.filter((s) => /\d\.\d/.test(s.text))
  if (!decimals.length) {
    report.skipped.push({ check: CHECK, reason: 'no decimal numbers on screen to check. Use `run` to put a price or a total on screen first.' })
    return finish(report, opts)
  }
  const why = firstSentence(CATALOGUE.find((c) => c.id === 'float-money')?.why ?? '')
  for (const s of decimals) {
    const crumbs = s.text.match(FLOAT_CRUMBS)
    if (!crumbs) {
      report.passed++
      continue
    }
    for (const n of crumbs)
      report.findings.push({
        check: CHECK,
        where: s.where,
        caseId: 'float-money',
        what: `${n} in ${show(s.text)}`,
        human: `The screen shows ${n} (in ${show(s.text)}). ${why} Keep money in whole cents and format it for display.`,
      })
  }
  return finish(report, opts)
}
