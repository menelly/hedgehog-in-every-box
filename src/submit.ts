/**
 * 🧾 AFTER YOU PRESS SUBMIT — what the app does when something goes wrong.
 *
 *   keepsWhatWasTyped  one wrong box must not wipe the whole form
 *   actionableErrors   when a save fails, the screen says what happened and
 *                      what to do, not "something went wrong"
 *   slowNetwork        hotel wifi: requests take seconds, and the app still
 *                      says it's working, doesn't throw, and finishes
 *
 * All three read "what appeared on screen" the same way: every visible piece
 * of text after the press, minus every visible piece of text before it. If
 * your app shows its messages somewhere unusual (a toast in a shadow root, a
 * canvas), or has text that changes on its own (a clock, a ticker), pass
 * `message` and tell us where to look. Before the press, we wait for the
 * page's text to stop changing (a banner that drops in 300ms after load is
 * not the app's answer to anything).
 */
import type { Locator, Page, Request, Route } from '@playwright/test'
import { CATALOGUE } from './catalogue'
import { FlinchWatcher, flinchInWords, type FlinchOptions } from './flinch'
import { finish, firstSentence, newReport, resolvePlatforms, show, type CommonOptions, type Report } from './report'

const why = (id: string) => firstSentence(CATALOGUE.find((c) => c.id === id)?.why ?? '')
const loc = (page: Page, t: string | ((p: Page) => Locator)) => (typeof t === 'string' ? page.locator(t) : t(page))
type RequestMatcher = string | RegExp | ((r: Request) => boolean)
const matcher = (m: RequestMatcher) => (r: Request) => (typeof m === 'function' ? m(r) : typeof m === 'string' ? r.url().includes(m) : m.test(r.url()))

/** 👀 every visible piece of text on the page right now, one entry per text node */
export async function visibleTexts(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = []
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.textContent ?? '').replace(/\s+/g, ' ').trim()
      const el = n.parentElement
      if (!t || !el || el.closest('script, style, noscript, template')) continue
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue
      out.push(t)
    }
    return out
  })
}

/** the visible text once it has stopped changing (two identical looks 300ms apart, at most ~3s) */
export async function settledTexts(page: Page): Promise<string[]> {
  let last = await visibleTexts(page)
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(300)
    const now = await visibleTexts(page)
    if (now.length === last.length && now.every((t, j) => t === last[j])) return now
    last = now
  }
  return last
}

/** what's on screen now that wasn't before */
async function whatAppeared(page: Page, before: string[], message?: (page: Page) => Promise<string>): Promise<string[]> {
  if (message) {
    const m = (await message(page)).replace(/\s+/g, ' ').trim()
    return m ? [m] : []
  }
  const had = new Set(before)
  return (await visibleTexts(page)).filter((t) => !had.has(t))
}

/** words that mean "still going", not "here's what happened" */
const IN_PROGRESS = /^(?!.*\b(?:fail\w*|error|couldn't|can't|cannot|not)\b)[\p{P}\p{S}\s]*(?:saving|loading|sending|submitting|uploading|processing|working|please wait|one moment|just a moment)\b.*$|^[.…\s]+$/iu

/**
 * Stock phrases that tell a person nothing. Stripped out of a message; if
 * almost nothing is left, the message was generic.
 */
const GENERIC = [
  /something went wrong/gi,
  /an (?:unknown |unexpected )?error (?:has )?occurred/gi,
  /(?:unknown|unexpected|internal server|server|network|request|fetch) error/gi,
  /failed to fetch/gi,
  /(?:save|saving|request|submit|submission|upload) failed/gi,
  /please try again(?: later)?/gi,
  /try again later/gi,
  /\b(?:error|failed|failure|oops|uh oh|whoops|sorry)\b/gi,
  /\b(?:undefined|null|NaN)\b/g,
  /\[object Object\]/g,
  /\b[45]\d\d\b/g, // a bare status code
]

function leftAfterStockPhrases(s: string): string {
  let t = s
  for (const re of GENERIC) t = t.replace(re, ' ')
  return t.replace(/[\p{P}\p{S}]/gu, ' ').replace(/\s+/g, ' ').trim()
}
const wordCount = (s: string) => s.split(' ').filter((w) => /\p{L}{2,}/u.test(w)).length

// ─────────────────────────────── ✍️ keepsWhatWasTyped ───────────────────────────────

export interface KeepsWhatWasTypedOptions extends CommonOptions {
  /** the boxes to fill with GOOD values: { selector: value } */
  typed: Record<string, string>
  /** the one box that gets a wrong value, so the app refuses */
  wrong: { box: string; value: string }
  /** press submit (or Enter) */
  submit: (page: Page) => Promise<void>
  /** after submitting: did it save anyway? If it did, this check can't see a refusal, and says so. */
  saved?: (page: Page) => Promise<boolean>
  /** get back to a fresh form first (default: nothing, use the page as it is) */
  reset?: (page: Page) => Promise<void>
  /** check the wrong box kept its value too (default true: fixing one character beats retyping it) */
  checkWrongBox?: boolean
  /** wait after submit before looking (default 600ms) */
  settleMs?: number
}

export async function keepsWhatWasTyped(page: Page, opts: KeepsWhatWasTypedOptions): Promise<Report> {
  const CHECK = 'keepsWhatWasTyped'
  const report = newReport(CHECK, resolvePlatforms(opts))
  await opts.reset?.(page)
  for (const [sel, v] of Object.entries(opts.typed)) await page.locator(sel).fill(v)
  await page.locator(opts.wrong.box).fill(opts.wrong.value)
  await opts.submit(page)
  await page.waitForTimeout(opts.settleMs ?? 600)

  if (opts.saved && (await opts.saved(page))) {
    report.skipped.push({ check: CHECK, reason: `the app saved ${show(opts.wrong.value)} in ${opts.wrong.box}, so there was no refusal to watch. Pick a value it refuses.` })
    return finish(report, opts)
  }

  const boxes: [string, string, boolean][] = Object.entries(opts.typed).map(([s, v]) => [s, v, false])
  if (opts.checkWrongBox !== false) boxes.push([opts.wrong.box, opts.wrong.value, true])
  for (const [sel, want, isWrong] of boxes) {
    const got = await page.locator(sel).inputValue().catch(() => null)
    if (got === want) {
      report.passed++
      continue
    }
    report.findings.push({
      check: CHECK,
      where: sel,
      caseId: 'form-keeps-input',
      what: got === null ? `box gone after the refusal (wanted ${show(want)})` : `holds ${show(got)}, typed ${show(want)}`,
      human: isWrong
        ? `After the app refused ${show(opts.wrong.value)} in ${sel}, that box no longer held it (${got === null ? 'the box was gone' : `it holds ${show(got)}`}). Leave the mistake there, so the person can fix one character instead of starting again.`
        : `One wrong box (${opts.wrong.box}) and ${sel} lost what was typed in it: ${show(want)} became ${got === null ? 'nothing (the box was gone)' : show(got)}. ${why('form-keeps-input')}`,
    })
  }
  return finish(report, opts)
}

// ─────────────────────────────── 💬 actionableErrors ───────────────────────────────

export type FailureMode = 'offline' | 'server-error'

export interface ActionableErrorsOptions extends CommonOptions, FlinchOptions {
  /** press submit (or Enter) */
  submit: (page: Page) => Promise<void>
  /** which request is "the save": this is the one we make fail */
  request: RequestMatcher
  /** fill the form with good values first */
  fillValid?: (page: Page) => Promise<void>
  /** get back to a fresh form before each failure (default: page.reload()) */
  reset?: (page: Page) => Promise<void>
  /** how to fail it (default both): the connection drops, or the server answers 500 with an empty body */
  failures?: FailureMode[]
  /** where your app shows its messages, if it isn't ordinary visible text */
  message?: (page: Page) => Promise<string>
  /** wait after submit before reading the screen (default 1500ms) */
  settleMs?: number
}

const FAILURE_WORDS: Record<FailureMode, string> = {
  offline: 'the connection dropped mid-save',
  'server-error': 'the server answered 500 with nothing in the body',
}

export async function actionableErrors(page: Page, opts: ActionableErrorsOptions): Promise<Report> {
  const CHECK = 'actionableErrors'
  const report = newReport(CHECK, resolvePlatforms(opts))
  // the browser logs every failed request as a console error by itself; that's not the app's fault, so only
  // uncaught errors count here
  const watch = new FlinchWatcher(page, opts)
  const reset = opts.reset ?? (async (p: Page) => void (await p.reload()))
  const isSave = matcher(opts.request)

  for (const mode of opts.failures ?? (['offline', 'server-error'] as FailureMode[])) {
    await reset(page)
    await opts.fillValid?.(page)
    let hit = 0
    const fail = async (route: Route) => {
      if (!isSave(route.request())) return route.fallback()
      hit++
      if (mode === 'offline') return route.abort('internetdisconnected')
      return route.fulfill({ status: 500, contentType: 'text/plain', body: '' })
    }
    await page.route('**/*', fail)
    const before = await settledTexts(page)
    const mark = watch.mark()
    await opts.submit(page)
    await page.waitForTimeout(opts.settleMs ?? 1500)
    await watch.settle()
    const appeared = await whatAppeared(page, before, opts.message)
    await page.unroute('**/*', fail)
    const where = FAILURE_WORDS[mode]

    if (!hit) {
      report.skipped.push({ check: CHECK, reason: `${where}: no request matched \`request\`, so nothing failed. Check the matcher, or the form refused to submit.` })
      continue
    }
    let clean = true
    for (const f of watch.since(mark).filter((f) => f.kind !== 'console-error')) {
      clean = false
      report.findings.push({ check: CHECK, where, caseId: 'actionable-errors', what: `${f.kind}: ${f.text}`, human: `When ${where}, ${flinchInWords(f)}.` })
    }
    const said = appeared.join(' ')
    if (!appeared.length) {
      clean = false
      report.findings.push({
        check: CHECK,
        where,
        caseId: 'actionable-errors',
        what: 'nothing new on screen',
        human: `When ${where}, nothing on screen changed. The person can't tell whether it saved. Say that it didn't, and what to do.`,
      })
    } else if (appeared.every((t) => IN_PROGRESS.test(t))) {
      clean = false
      report.findings.push({
        check: CHECK,
        where,
        caseId: 'actionable-errors',
        what: `still says ${show(said)}`,
        human: `When ${where}, the screen still said ${show(said)} ${((opts.settleMs ?? 1500) / 1000).toFixed(1)}s later, as if it were still working. It had already failed. Say so, and say what to do.`,
      })
    } else {
      const rest = leftAfterStockPhrases(appeared.filter((t) => !IN_PROGRESS.test(t)).join(' '))
      if (wordCount(rest) < 3) {
        clean = false
        report.findings.push({
          check: CHECK,
          where,
          caseId: 'actionable-errors',
          what: `only stock phrases: ${show(said)}`,
          human: `When ${where}, all the screen said was ${show(said)}. ${why('actionable-errors')} Say what happened, whether their work is safe, and what to do next.`,
        })
      }
    }
    if (clean) report.passed++
  }
  return finish(report, opts)
}

// ─────────────────────────────── 🏨 slowNetwork ───────────────────────────────

export interface SlowNetworkOptions extends CommonOptions, FlinchOptions {
  /** press submit (or Enter) */
  submit: (page: Page) => Promise<void>
  /** which request is "the save" (it, and everything else, is held back) */
  request: RequestMatcher
  /** open the page under the slow network too (it must load without throwing) */
  url?: string
  /** fill the form with good values first */
  fillValid?: (page: Page) => Promise<void>
  /** how long every request is held back (default 4000ms) */
  delayMs?: number
  /** how soon after the press something must say it's working (default 500ms) */
  busyWithinMs?: number
  /** where your app shows its messages, if it isn't ordinary visible text */
  message?: (page: Page) => Promise<string>
}

export async function slowNetwork(page: Page, opts: SlowNetworkOptions): Promise<Report> {
  const CHECK = 'slowNetwork'
  const report = newReport(CHECK, resolvePlatforms(opts))
  const watch = new FlinchWatcher(page, opts)
  const delay = opts.delayMs ?? 4000
  const isSave = matcher(opts.request)
  let saves = 0
  let finished = 0
  const slow = async (route: Route) => {
    const save = isSave(route.request())
    if (save) saves++
    await new Promise((r) => setTimeout(r, delay))
    try {
      await route.fallback() // fallback, not continue: any routes the page or the test set up still apply
    } catch {
      /* the page gave up on it (or navigated); that's what we're here to see */
    }
    if (save) finished++
  }
  await page.route('**/*', slow)
  const secs = `${(delay / 1000).toFixed(1)}s`

  try {
    // 1. the page loads at all
    if (opts.url) {
      const mark = watch.mark()
      await page.goto(opts.url, { timeout: delay * 10 + 30_000 })
      await page.waitForTimeout(delay + 500) // let the page's own first requests land
      await watch.settle()
      const flinches = watch.since(mark)
      for (const f of flinches)
        report.findings.push({ check: CHECK, where: 'loading the page', caseId: 'hotel-wifi', what: `${f.kind}: ${f.text}`, human: `Opening the page with every request taking ${secs}, ${flinchInWords(f)}.` })
      if (!flinches.length) report.passed++
    }

    // 2. the press is acknowledged
    await opts.fillValid?.(page)
    const before = await settledTexts(page)
    const mark = watch.mark()
    await opts.submit(page)
    await page.waitForTimeout(opts.busyWithinMs ?? 500)
    const busy = await page.evaluate(() => {
      const shown = (el: Element) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      }
      if ([...document.querySelectorAll('[aria-busy="true"], [role="progressbar"], progress')].some(shown)) return 'a busy indicator'
      const pressed = document.activeElement
      if (pressed instanceof HTMLButtonElement && (pressed.disabled || pressed.getAttribute('aria-disabled') === 'true')) return 'the button was disabled'
      return null
    })
    const early = await whatAppeared(page, before, opts.message)
    if (busy || early.length) report.passed++
    else
      report.findings.push({
        check: CHECK,
        where: 'right after pressing submit',
        caseId: 'hotel-wifi',
        what: `nothing changed within ${opts.busyWithinMs ?? 500}ms`,
        human: `With every request taking ${secs}, pressing submit changed nothing on screen. The person can't tell it's working, so they press it again or give up. Show that it's saving.`,
      })

    // 3. it finishes, without throwing, and says how it went
    const deadline = Date.now() + delay * 3 + 5000
    while (Date.now() < deadline && (saves === 0 || finished < saves)) await page.waitForTimeout(200)
    await page.waitForTimeout(800)
    await watch.settle()
    const flinches = watch.since(mark)
    for (const f of flinches)
      report.findings.push({ check: CHECK, where: 'saving', caseId: 'hotel-wifi', what: `${f.kind}: ${f.text}`, human: `Saving with every request taking ${secs}: ${flinchInWords(f)}. Fast office internet hides this; hotel wifi doesn't.` })
    const after = await whatAppeared(page, before, opts.message)
    if (!saves) report.skipped.push({ check: CHECK, reason: 'no request matched `request`, so there was no slow save to watch. Check the matcher.' })
    else if (after.length && after.every((t) => IN_PROGRESS.test(t)))
      report.findings.push({
        check: CHECK,
        where: 'after the save request finished',
        caseId: 'hotel-wifi',
        what: `still says ${show(after.join(' '))}`,
        human: `With every request taking ${secs}, the screen still said ${show(after.join(' '))} after the request had come and gone. Did it save? The person will never know. ${why('hotel-wifi')}`,
      })
    else if (!after.length)
      report.findings.push({
        check: CHECK,
        where: 'after the save request finished',
        caseId: 'hotel-wifi',
        what: 'nothing new on screen',
        human: `With every request taking ${secs}, the save came and went and nothing on screen said whether it worked.`,
      })
    else if (!flinches.length) report.passed++
  } finally {
    await page.unroute('**/*', slow)
  }
  return finish(report, opts)
}
