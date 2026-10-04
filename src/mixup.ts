/**
 * 🔀 FIELD MIXUP — the street address in the phone box.
 *
 * For each wrong-field case aimed at a box you've told us about:
 *   expect 'reject' → the app must refuse AND say so where the person is
 *                     looking: the box marked aria-invalid, a visible message
 *                     tied to it, or a role="alert". Saving it silently is a
 *                     finding. Refusing silently is a finding. A bare alert()
 *                     is a finding (some app shells never show it).
 *   expect 'accept' → the app must take it: (555) 123-4567 is a phone number,
 *                     www.example.com is a website. Refusing a normal human
 *                     way of writing something is a finding.
 */
import type { Locator, Page } from '@playwright/test'
import { CATALOGUE, appliesTo, type Case, type FieldKind } from './catalogue'
import { FlinchWatcher, flinchInWords, type FlinchOptions } from './flinch'
import { finish, firstSentence, newReport, resolvePlatforms, show, type CommonOptions, type Report } from './report'

export interface FieldMixupOptions extends CommonOptions, FlinchOptions {
  /** the boxes on your form, by what they are for (CSS selector or a function returning a Locator) */
  fields: Partial<Record<FieldKind, string | ((page: Page) => Locator)>>
  /** fill the rest of the form with good values, so the box under test is the only thing wrong */
  fillValid?: (page: Page) => Promise<void>
  /** press submit (or Enter) */
  submit: (page: Page) => Promise<void>
  /** after submitting: did it save? */
  saved: (page: Page) => Promise<boolean>
  /** get back to a fresh form (default: page.reload()) */
  reset?: (page: Page) => Promise<void>
  /** which cases (default: every wrong-field case in the catalogue) */
  cases?: Case[]
  /** wait after submit before looking (default 400ms) */
  settleMs?: number
  watcher?: FlinchWatcher
}

const CHECK = 'fieldMixup'

const FIELD_WORDS: Record<FieldKind, string> = {
  phone: 'phone',
  email: 'email',
  name: 'name',
  address: 'address',
  url: 'website',
  search: 'search',
  date: 'date',
  zip: 'ZIP / postcode',
}

export async function fieldMixup(page: Page, opts: FieldMixupOptions): Promise<Report> {
  const platforms = resolvePlatforms(opts)
  const report = newReport(CHECK, platforms)
  const watch = opts.watcher ?? new FlinchWatcher(page, opts)
  const reset = opts.reset ?? (async (p: Page) => void (await p.reload()))
  const all = (opts.cases ?? CATALOGUE).filter((c) => c.kind === 'wrong-field' && c.field && c.text !== undefined)

  for (const c of all) {
    const target = opts.fields[c.field!]
    if (!target) {
      report.skipped.push({ check: CHECK, reason: `${c.title}: you didn't point fieldMixup at a ${FIELD_WORDS[c.field!]} box` })
      continue
    }
    if (!appliesTo(c, platforms)) {
      report.skipped.push({ check: CHECK, reason: `${c.title}: not in profile ${platforms.join(' + ')}` })
      continue
    }
    const word = FIELD_WORDS[c.field!]
    await reset(page)
    await opts.fillValid?.(page)
    const box = typeof target === 'string' ? page.locator(target) : target(page)
    await box.fill(c.text!)
    const mark = watch.mark()
    await opts.submit(page)
    await page.waitForTimeout(opts.settleMs ?? 400)
    await watch.settle()
    const flinches = watch.since(mark)
    const saved = await opts.saved(page)
    const said = await box.evaluate((el) => {
      const visible = (n: Element | null) => {
        if (!n) return false
        const r = n.getBoundingClientRect()
        return r.width > 0 && r.height > 0 && getComputedStyle(n).visibility !== 'hidden' && (n.textContent ?? '').trim().length > 0
      }
      if (el.getAttribute('aria-invalid') === 'true') return 'aria-invalid'
      const described = (el.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
      if (described.some((id) => visible(document.getElementById(id)) && /invalid|error|must|should|doesn|isn|not|please|check/i.test(document.getElementById(id)!.textContent ?? ''))) return 'aria-describedby message'
      if ([...document.querySelectorAll('[role="alert"]')].some(visible)) return 'role=alert'
      const v = (el as HTMLInputElement).validity
      if (v && !v.valid) return `browser validation ("${(el as HTMLInputElement).validationMessage}")`
      return null
    })

    let clean = true
    for (const f of flinches) {
      clean = false
      report.findings.push({
        check: CHECK,
        where: `${word} box`,
        caseId: c.id,
        what: `${f.kind}: ${f.text}`,
        human: `Submitting ${show(c.text!)} in the ${word} box: ${flinchInWords(f)}.`,
      })
    }

    if (c.expect === 'reject') {
      if (saved) {
        clean = false
        report.findings.push({
          check: CHECK,
          where: `${word} box`,
          caseId: c.id,
          what: 'saved without complaint',
          human: `The ${word} box accepted ${show(c.text!)} and saved it. ${firstSentence(c.why)} Validate it, or at least warn.`,
        })
      } else if (!said && !flinches.some((f) => f.kind === 'native-dialog')) {
        clean = false
        report.findings.push({
          check: CHECK,
          where: `${word} box`,
          caseId: c.id,
          what: 'not saved, and nothing on screen says why',
          human: `The ${word} box refused ${show(c.text!)} without saying why. The person is left pressing Save again and again; put the reason next to the box.`,
        })
      }
    } else {
      if (!saved) {
        clean = false
        report.findings.push({
          check: CHECK,
          where: `${word} box`,
          caseId: c.id,
          what: `refused${said ? ` (${said})` : ''}`,
          human: `The ${word} box refused ${show(c.text!)}, which is a normal way to write a ${word}. ${firstSentence(c.why)}`,
        })
      }
    }
    if (clean) report.passed++
  }
  return finish(report, opts)
}
