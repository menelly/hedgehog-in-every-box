/**
 * 👆 INTERACTION CHAOS — the things people do with their hands, and with time.
 *
 *   doubleSubmit      one double-click must send one request
 *   comeBackTomorrow  something saved today is still there tomorrow
 *   survivesReload    half an hour of work survives a refresh
 *   roundTripValue    one value, saved and read back exactly (00501 stays 00501)
 */
import type { Locator, Page, Request } from '@playwright/test'
import { CATALOGUE } from './catalogue'
import { finish, firstSentence, newReport, resolvePlatforms, show, type CommonOptions, type Report } from './report'

const why = (id: string) => firstSentence(CATALOGUE.find((c) => c.id === id)?.why ?? '')

export interface DoubleSubmitOptions extends CommonOptions {
  /** the submit button */
  submit: string | Locator
  /** which requests count as "a submission" */
  request: string | RegExp | ((r: Request) => boolean)
  /** fill the form first */
  fillValid?: (page: Page) => Promise<void>
  /** how long to keep counting after the clicks (default 1500ms) */
  settleMs?: number
  /** how many clicks: 2 (default) is a double-click; more is someone smashing the button */
  clicks?: number
}

export async function doubleSubmit(page: Page, opts: DoubleSubmitOptions): Promise<Report> {
  const report = newReport('doubleSubmit', resolvePlatforms(opts))
  const matches = (r: Request) =>
    typeof opts.request === 'function' ? opts.request(r) : typeof opts.request === 'string' ? r.url().includes(opts.request) : opts.request.test(r.url())
  let n = 0
  const count = (r: Request) => {
    if (matches(r)) n++
  }
  await opts.fillValid?.(page)
  page.on('request', count)
  const button = typeof opts.submit === 'string' ? page.locator(opts.submit) : opts.submit
  const clicks = opts.clicks ?? 2
  const caseId = clicks > 2 ? 'button-mash' : 'double-submit'
  const what = clicks > 2 ? `${clicks} fast clicks` : 'one double-click'
  if (clicks === 2) await button.dblclick()
  else {
    // as fast as a frustrated hand: no waiting between presses, and keep pressing even once it's disabled
    const box = await button.boundingBox()
    if (box) for (let i = 0; i < clicks; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  }
  await page.waitForTimeout(opts.settleMs ?? 1500)
  page.off('request', count)
  if (n === 1) report.passed++
  else if (n === 0)
    report.findings.push({
      check: 'doubleSubmit',
      where: 'submit',
      caseId,
      what: 'no matching request seen',
      human: `${what[0].toUpperCase() + what.slice(1)} on submit sent nothing at all, so this check could not tell whether repeated clicks make repeated records. Check the \`request\` matcher, or the form refused to submit.`,
    })
  else
    report.findings.push({
      check: 'doubleSubmit',
      where: 'submit',
      caseId,
      what: `${n} requests from ${what}`,
      human: `${what[0].toUpperCase() + what.slice(1)} on submit sent ${n} requests. ${why(caseId)} Disable the button while saving, or ignore repeats.`,
    })
  return finish(report, opts)
}

export interface ComeBackTomorrowOptions extends CommonOptions {
  /** where the app lives */
  url: string
  /** make the thing that should persist */
  create: (page: Page) => Promise<void>
  /** after the clock moves on: is it still there? */
  stillThere: (page: Page) => Promise<boolean>
  /** how many days to jump (default 1) */
  days?: number
}

/**
 * Uses Playwright's clock: the page believes it's today, you save something,
 * the page then believes it's tomorrow, reloads, and it must still be there.
 * Call this BEFORE navigating (it installs the clock and opens `url`).
 */
export async function comeBackTomorrow(page: Page, opts: ComeBackTomorrowOptions): Promise<Report> {
  const report = newReport('comeBackTomorrow', resolvePlatforms(opts))
  const days = opts.days ?? 1
  const now = new Date()
  await page.clock.install({ time: now })
  await page.goto(opts.url)
  await opts.create(page)
  await page.clock.setSystemTime(new Date(now.getTime() + days * 86_400_000))
  await page.reload()
  if (await opts.stillThere(page)) report.passed++
  else
    report.findings.push({
      check: 'comeBackTomorrow',
      where: opts.url,
      caseId: 'come-back-tomorrow',
      what: `gone after the clock moved ${days} day(s)`,
      human: `Something saved today was gone when the app was opened ${days === 1 ? 'tomorrow' : `${days} days later`}. ${why('come-back-tomorrow')}`,
    })
  return finish(report, opts)
}

export interface SurvivesReloadOptions extends CommonOptions {
  /** do some work (do NOT press save: that's the point) */
  fill: (page: Page) => Promise<void>
  /** after a reload: is the work still there, or offered back? */
  check: (page: Page) => Promise<boolean>
  /** wait before reloading, for debounced autosave (default 1000ms) */
  waitMs?: number
}

export async function survivesReload(page: Page, opts: SurvivesReloadOptions): Promise<Report> {
  const report = newReport('survivesReload', resolvePlatforms(opts))
  await opts.fill(page)
  await page.waitForTimeout(opts.waitMs ?? 1000)
  await page.reload()
  if (await opts.check(page)) report.passed++
  else
    report.findings.push({
      check: 'survivesReload',
      where: page.url(),
      caseId: 'refresh-mid-work',
      what: 'work gone after reload',
      human: `The work typed in was gone after a refresh. ${why('refresh-mid-work')}`,
    })
  return finish(report, opts)
}

export interface RoundTripValueOptions extends CommonOptions {
  box: string | Locator
  value: string
  save: (page: Page) => Promise<void>
  reopen?: (page: Page) => Promise<void>
  /** catalogue case this is about (for the message), e.g. 'leading-zeros' */
  caseId?: string
}

export async function roundTripValue(page: Page, opts: RoundTripValueOptions): Promise<Report> {
  const report = newReport('roundTripValue', resolvePlatforms(opts))
  const box = () => (typeof opts.box === 'string' ? page.locator(opts.box) : opts.box)
  await box().fill(opts.value)
  await opts.save(page)
  await (opts.reopen ?? (async (p: Page) => void (await p.reload())))(page)
  const back = await box().inputValue()
  if (back === opts.value) report.passed++
  else
    report.findings.push({
      check: 'roundTripValue',
      where: typeof opts.box === 'string' ? opts.box : 'the box',
      caseId: opts.caseId,
      what: `saved ${show(opts.value)}, got back ${show(back)}`,
      human: `Saved ${show(opts.value)} and got back ${show(back)}. ${opts.caseId ? why(opts.caseId) : 'What a person saves is what they should get back.'}`,
    })
  return finish(report, opts)
}
