/**
 * 📓 THE NOTEBOOK — every check writes here instead of throwing at the first
 * problem, so one run tells you EVERYTHING that flinched, in words a person
 * can act on. Then it fails the test (unless you asked it not to).
 *
 * Also the profile logic: a check that doesn't apply to your kind of app is
 * SKIPPED WITH A REASON. Never failed, never silently missing — the report
 * says what was checked and what wasn't, and why.
 */
import { test, type Page } from '@playwright/test'
import { ALL_PLATFORMS, type Case, type Platform } from './catalogue'

export interface Finding {
  /** which helper found it, e.g. "walkEveryTextbox" */
  check: string
  /** where in the app, e.g. "Name box" */
  where: string
  /** which catalogue case, if any */
  caseId?: string
  /** the technical detail */
  what: string
  /** what broke and why it matters to a person, in plain words */
  human: string
}

export interface Skipped {
  check: string
  reason: string
}

export interface Report {
  check: string
  /** how many individual checks passed */
  passed: number
  findings: Finding[]
  skipped: Skipped[]
  /** the platforms this run was for */
  platforms: Platform[]
}

export interface CommonOptions {
  /**
   * Which kind(s) of app this is. Checks that don't apply are skipped with a
   * reason. Default: HEDGEHOG_PLATFORMS env (comma-separated), else the
   * Playwright project's `metadata.hedgehogPlatforms`, else all platforms.
   */
  platforms?: Platform[]
  /** default true: fail the test if anything was found. false: just return the report. */
  throwOnFindings?: boolean
}

/** Work out which platforms we're checking for. */
export function resolvePlatforms(opts: CommonOptions = {}): Platform[] {
  if (opts.platforms?.length) return opts.platforms
  const env = process.env.HEDGEHOG_PLATFORMS
  if (env) return env.split(',').map((s) => s.trim()).filter(Boolean) as Platform[]
  try {
    const meta = test.info().project.metadata as { hedgehogPlatforms?: Platform[] } | undefined
    if (meta?.hedgehogPlatforms?.length) return meta.hedgehogPlatforms
  } catch {
    /* not inside a test; fine */
  }
  return ALL_PLATFORMS
}

/** null if the check applies; otherwise the reason it doesn't. */
export function notApplicable(checkTitle: string, checkPlatforms: Platform[], profile: Platform[]): string | null {
  if (checkPlatforms.some((p) => profile.includes(p))) return null
  return `${checkTitle}: not in profile ${profile.join(' + ')} (applies to ${checkPlatforms.join(', ')})`
}

export function newReport(check: string, platforms: Platform[]): Report {
  return { check, passed: 0, findings: [], skipped: [], platforms }
}

/** First sentence of a catalogue "why", for a human failure message. */
export function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?](\s|$)/)
  return (m ? m[0] : s).trim()
}

/** Show a string without printing 5,000 characters of it. */
export function show(s: string): string {
  const j = JSON.stringify(s)
  return j.length > 50 ? `${j.slice(0, 34)}…" (${s.length} chars)` : j
}

/** How to name a case in a sentence: its text, or its title. */
export function caseLabel(c: Case): string {
  if (c.how === 'type-then-delete') return 'something typed and then deleted'
  if (c.text === undefined) return c.title
  if (c.text.length > 50) return `${c.title} (${c.text.length} characters)`
  return `${show(c.text)} (${c.title})`
}

/**
 * Print the report, record skips as test annotations, attach the findings,
 * and throw if anything was found (unless throwOnFindings is false).
 */
export async function finish(report: Report, opts: CommonOptions = {}): Promise<Report> {
  const lines: string[] = []
  lines.push(`🦔 ${report.check} [${report.platforms.join(' + ')}]: ${report.passed} checks passed, ${report.findings.length} findings, ${report.skipped.length} skipped`)
  for (const f of report.findings) lines.push(`  ✗ ${f.human}\n      ↳ ${f.where}: ${f.what}`)
  for (const s of report.skipped) lines.push(`  ➖ skipped: ${s.reason}`)
  console.log(lines.join('\n'))

  try {
    const info = test.info()
    for (const s of report.skipped) info.annotations.push({ type: 'hedgehog skipped', description: s.reason })
    if (report.findings.length) {
      await info.attach(`${report.check}-findings.json`, { body: JSON.stringify(report.findings, null, 2), contentType: 'application/json' })
    }
  } catch {
    /* not inside a test; printing is enough */
  }

  if (report.findings.length && opts.throwOnFindings !== false) {
    const err = new Error(lines.join('\n')) as Error & { report?: Report }
    err.report = report
    throw err
  }
  return report
}

/** Is the page still alive and answering? */
export async function stillAlive(page: Page): Promise<string | null> {
  try {
    const two = await Promise.race([
      page.evaluate(() => 1 + 1),
      new Promise<number>((_, no) => setTimeout(() => no(new Error('no answer within 5s')), 5000)),
    ])
    return two === 2 ? null : 'the page answered JavaScript wrongly'
  } catch (e) {
    return `the page stopped answering: ${(e as Error).message.split('\n')[0]}`
  }
}
