/**
 * 🚶 THE WALK — put a hedgehog (and everything else in the catalogue) in
 * every text box on the page.
 *
 * For every visible box a person can type in, for every text case:
 *   - no crash, no console error, no browser pop-up, no broken JSON reply
 *   - the box holds what went in (allowing for what browsers legitimately do:
 *     one-line boxes drop newlines, email boxes trim, maxlength cuts)
 *   - the box is fully on screen (a box hanging off the edge can't be clicked)
 *   - the page still answers afterwards
 *
 * With `roundTrip`, it also fills the free-text boxes, saves, reloads, and
 * checks every box gives back exactly what was saved.
 *
 * It does not replace a human opening the app. It means the hedgehog gets in
 * the boxes even on days nobody has the spoons to do it by hand.
 */
import type { Locator, Page } from '@playwright/test'
import { ROUND_TRIP_CASES, TEXT_CASES, appliesTo, platformsOf, type Case } from './catalogue'
import { FlinchWatcher, flinchInWords, type FlinchOptions } from './flinch'
import {
  caseLabel,
  finish,
  firstSentence,
  newReport,
  resolvePlatforms,
  show,
  stillAlive,
  type CommonOptions,
  type Report,
} from './report'

export interface BoxInfo {
  /** the data-hedgehog-box attribute we tagged it with */
  tag: string
  /** a human name for the box: its label, aria-label, placeholder, name or id */
  key: string
  /** input type ('text', 'email', …) or 'textarea' */
  type: string
  maxLength: number | null
  /** true for boxes meant for arbitrary text (not email/tel/url/number-ish) */
  freeText: boolean
}

export interface RoundTripOptions {
  /** do whatever "save" means in your app, and wait until it has finished */
  save: (page: Page) => Promise<void>
  /** come back to the form fresh (default: page.reload()) */
  reopen?: (page: Page) => Promise<void>
  /** which cases to round-trip (default: every non-blank text case) */
  cases?: Case[]
  /** which boxes to fill (default: free-text boxes only, so email/phone validation doesn't block the save) */
  boxes?: (b: BoxInfo) => boolean
  /** if your app deliberately tidies values (say, trims names), describe it here */
  normalize?: (saved: string, b: BoxInfo) => string
}

export interface WalkOptions extends CommonOptions, FlinchOptions {
  /** text cases to type (default: every text case in the catalogue) */
  cases?: Case[]
  /** only walk boxes inside this CSS selector */
  within?: string
  /** pause after each string for debounced handlers to fire (default 300ms) */
  settleMs?: number
  /** leave some boxes alone */
  skipBox?: (b: BoxInfo) => boolean
  /** share a watcher across helpers (default: a fresh one) */
  watcher?: FlinchWatcher
  roundTrip?: RoundTripOptions
}

/** Tag every visible, editable text box and describe it. */
export async function findTextBoxes(page: Page, within?: string): Promise<BoxInfo[]> {
  return page.evaluate((scope) => {
    const root: ParentNode = scope ? document.querySelector(scope) ?? document : document
    const sel = 'input:not([type]), input[type="text"], input[type="search"], input[type="email"], input[type="tel"], input[type="url"], input[type="password"], textarea'
    const out: { tag: string; key: string; type: string; maxLength: number | null; freeText: boolean }[] = []
    const used = new Map<string, number>()
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim()
    root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(sel).forEach((el, i) => {
      if (el.readOnly || el.disabled) return
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden') return
      const labelled = el.getAttribute('aria-labelledby')
      const name =
        el.getAttribute('aria-label') ||
        (labelled ? labelled.split(/\s+/).map((id) => text(document.getElementById(id))).join(' ') : '') ||
        (el.id ? text(document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) : '') ||
        text(el.closest('label')) ||
        el.getAttribute('placeholder') ||
        el.getAttribute('name') ||
        el.id ||
        `${el.tagName.toLowerCase()} #${i + 1}`
      let key = name.slice(0, 60)
      const n = (used.get(key) ?? 0) + 1
      used.set(key, n)
      if (n > 1) key = `${key} (${n})`
      const type = el instanceof HTMLTextAreaElement ? 'textarea' : (el.getAttribute('type') || 'text').toLowerCase()
      const mode = (el.getAttribute('inputmode') || '').toLowerCase()
      const freeText = ['text', 'search', 'textarea'].includes(type) && !['numeric', 'decimal', 'tel', 'email', 'url'].includes(mode)
      el.setAttribute('data-hedgehog-box', key)
      out.push({ tag: key, key, type, maxLength: el.maxLength > 0 ? el.maxLength : null, freeText })
    })
    return out
  }, within ?? null)
}

export function boxLocator(page: Page, b: BoxInfo): Locator {
  return page.locator(`[data-hedgehog-box="${b.tag.replace(/"/g, '\\"')}"]`)
}

/** Put a case into a box the way a person would. */
export async function enter(page: Page, box: Locator, c: Case): Promise<void> {
  await box.click()
  if (c.how === 'type-then-delete') {
    await box.fill('')
    await box.pressSequentially('hedgehog 🦔')
    // Backspace removes a whole grapheme, so press until empty (with a ceiling)
    for (let i = 0; i < 40 && (await box.inputValue()) !== ''; i++) await page.keyboard.press('Backspace')
  } else {
    await box.fill(c.text ?? '')
  }
}

/**
 * What a box SHOULD hold after `c` goes in, allowing for what browsers do on
 * purpose (HTML "value sanitization"): one-line boxes drop line breaks,
 * email boxes also trim the ends, and maxlength cuts.
 */
export function expectedIn(b: BoxInfo, c: Case): string {
  let t = c.how === 'type-then-delete' ? '' : c.text ?? ''
  if (b.type !== 'textarea') t = t.replace(/[\r\n]/g, '')
  // (Chromium trims email boxes but NOT url boxes, whatever the spec suggests: measured, not assumed)
  if (b.type === 'email') t =t.replace(/^[\t\n\f\r ]+|[\t\n\f\r ]+$/g, '')
  if (b.maxLength) t = t.slice(0, b.maxLength)
  return t
}

const CHECK = 'walkEveryTextbox'

export async function walkEveryTextbox(page: Page, opts: WalkOptions = {}): Promise<Report> {
  const platforms = resolvePlatforms(opts)
  const report = newReport(CHECK, platforms)
  const watch = opts.watcher ?? new FlinchWatcher(page, opts)
  const settle = opts.settleMs ?? 300

  const all = opts.cases ?? TEXT_CASES
  const cases = all.filter((c) => appliesTo(c, platforms))
  for (const c of all) {
    if (!cases.includes(c)) report.skipped.push({ check: CHECK, reason: `${c.title}: not in profile ${platforms.join(' + ')} (applies to ${platformsOf(c).join(', ')})` })
  }

  const boxes = (await findTextBoxes(page, opts.within)).filter((b) => !opts.skipBox?.(b))
  if (!boxes.length) {
    report.findings.push({
      check: CHECK,
      where: opts.within ?? 'the page',
      what: 'no text boxes found',
      human: 'The walk found no text boxes to type into. Either the page has none, or they were not visible yet; a walk that checks nothing must not pass quietly.',
    })
  }

  for (const b of boxes) {
    const box = boxLocator(page, b)
    // 📐 can a person even reach it?
    const bb = await box.boundingBox()
    const vp = page.viewportSize()
    if (bb && vp && (bb.x < 0 || bb.y < 0 || bb.x + bb.width > vp.width + 1)) {
      report.findings.push({
        check: CHECK,
        where: `${b.key} box`,
        caseId: 'off-screen-box',
        what: `box at x=${Math.round(bb.x)}, width=${Math.round(bb.width)} in a ${vp.width}px window`,
        human: `The "${b.key}" box hangs off the edge of the window, so nobody can click all of it.`,
      })
    }

    for (const c of cases) {
      if (!(await box.isVisible())) {
        report.findings.push({
          check: CHECK,
          where: `${b.key} box`,
          caseId: c.id,
          what: 'box vanished before this case could go in',
          human: `The "${b.key}" box disappeared after an earlier string went in, so a person typing ${caseLabel(c)} has nowhere to type it.`,
        })
        break
      }
      const mark = watch.mark()
      try {
        await enter(page, box, c)
      } catch (e) {
        report.findings.push({
          check: CHECK,
          where: `${b.key} box`,
          caseId: c.id,
          what: `could not type into it: ${(e as Error).message.split('\n')[0]}`,
          human: `Nobody can type into the "${b.key}" box: it wouldn't take input at all.`,
        })
        break
      }
      await page.waitForTimeout(settle)
      await watch.settle()

      const want = expectedIn(b, c)
      const got = (await box.isVisible()) ? await box.inputValue() : null
      let clean = true
      if (got !== want) {
        clean = false
        report.findings.push({
          check: CHECK,
          where: `${b.key} box`,
          caseId: c.id,
          what: `holds ${got === null ? '(box gone)' : show(got)}, expected ${show(want)}`,
          human: `The "${b.key}" box changed ${caseLabel(c)} as it was typed, into ${got === null ? 'nothing (the box vanished)' : show(got)}. ${firstSentence(c.why)}`,
        })
      }
      for (const f of watch.since(mark)) {
        clean = false
        report.findings.push({
          check: CHECK,
          where: `${b.key} box`,
          caseId: c.id,
          what: `${f.kind}: ${f.text}`,
          human: `After ${caseLabel(c)} went into the "${b.key}" box, ${flinchInWords(f)}. ${firstSentence(c.why)}`,
        })
      }
      const dead = await stillAlive(page)
      if (dead) {
        report.findings.push({ check: CHECK, where: `${b.key} box`, caseId: c.id, what: dead, human: `After ${caseLabel(c)} went into the "${b.key}" box, ${dead}.` })
        return finish(report, opts)
      }
      if (clean) report.passed++
    }
    // leave it empty so a box full of hedgehogs doesn't hide the next one
    if (await box.isVisible()) await box.fill('').catch(() => {})
  }

  if (opts.roundTrip) await roundTrips(page, watch, report, opts.roundTrip, platforms, opts.within)
  return finish(report, opts)
}

async function roundTrips(page: Page, watch: FlinchWatcher, report: Report, rt: RoundTripOptions, platforms: Report['platforms'], within?: string) {
  const cases = (rt.cases ?? ROUND_TRIP_CASES).filter((c) => appliesTo(c, platforms))
  const pick = rt.boxes ?? ((b: BoxInfo) => b.freeText)
  const reopen = rt.reopen ?? (async (p: Page) => void (await p.reload()))
  const normalize = rt.normalize ?? ((s: string) => s)

  for (const c of cases) {
    const boxes = (await findTextBoxes(page, within)).filter(pick)
    for (const b of boxes) await enter(page, boxLocator(page, b), c)
    const mark = watch.mark()
    try {
      await rt.save(page)
    } catch (e) {
      report.findings.push({
        check: CHECK,
        where: 'saving',
        caseId: c.id,
        what: `save did not complete: ${(e as Error).message.split('\n')[0]}`,
        human: `With ${caseLabel(c)} in the boxes, saving never finished. ${firstSentence(c.why)}`,
      })
      await reopen(page)
      continue
    }
    await watch.settle()
    for (const f of watch.since(mark)) {
      report.findings.push({ check: CHECK, where: 'saving', caseId: c.id, what: `${f.kind}: ${f.text}`, human: `Saving ${caseLabel(c)}: ${flinchInWords(f)}. ${firstSentence(c.why)}` })
    }
    await reopen(page)
    const after = await findTextBoxes(page, within)
    for (const b of boxes) {
      const back = after.find((a) => a.key === b.key)
      if (!back) {
        report.findings.push({ check: CHECK, where: `${b.key} box`, caseId: c.id, what: 'box missing after reopening', human: `After saving and reopening, the "${b.key}" box wasn't there any more.` })
        continue
      }
      const want = normalize(expectedIn(b, c), b)
      const got = await boxLocator(page, back).inputValue()
      if (got !== want) {
        report.findings.push({
          check: CHECK,
          where: `${b.key} box (round trip)`,
          caseId: c.id,
          what: `came back as ${show(got)}, saved ${show(want)}`,
          human: `The "${b.key}" box saved ${caseLabel(c)} but gave back ${show(got)} after reloading. ${firstSentence(c.why)}`,
        })
      } else report.passed++
    }
  }
}
