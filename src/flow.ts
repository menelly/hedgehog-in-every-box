/**
 * 📤 THE BIG BUTTON ABOVE THE CHOICES IT DEPENDS ON.
 *
 * 🔭 Lumen, from a live test-drive of a desktop app (November 2026): the Export
 * button sat above the fold, while options that change the exported file lived
 * two scrolls below it. People press the big button they can see. Plenty of
 * them never meet the options, export with the defaults, and get the wrong
 * thing without knowing why.
 *
 * For each primary action (a submit button, or a button called Export, Save,
 * Send, Generate, Download, Print, Publish…), scrolled into view the way a
 * person would first meet it: are there settings in the same flow BELOW it that
 * can't be seen from there? Those are the options nobody has visited yet at
 * the moment the button invites a press.
 *
 * "The same flow" is the button's <form> or dialog (or anything you mark
 * data-hedgehog-flow); failing that, its section, main or article; failing
 * that, the page. Point it at your own with `primary` and `flow` when the
 * guesses are wrong.
 *
 * What it can't know: whether a setting MATTERS to the button. A theme picker
 * two screens down from a Save button is probably fine; that's a person's
 * call, so mark it data-hedgehog-unrelated (or keep it outside the flow).
 */
import type { Page } from '@playwright/test'
import { CATALOGUE } from './catalogue'
import { finish, firstSentence, newReport, resolvePlatforms, type CommonOptions, type Report } from './report'

export interface PrematureSubmitOptions extends CommonOptions {
  /** the primary action(s), if the guess is wrong: a CSS selector */
  primary?: string
  /** the container that holds one workflow, if the guess is wrong: a CSS selector (closest ancestor of the button) */
  flow?: string
}

const CHECK = 'prematureSubmitCheck'
const why = () => firstSentence(CATALOGUE.find((c) => c.id === 'submit-above-options')!.why)

/** words that make a button the one that finishes the job */
export const PRIMARY_WORDS = /^\s*(submit|save|export|send|generate|download|print|publish|create|finish|done|place order|pay|checkout|check out|book|confirm|build|make)\b/i

export async function prematureSubmitCheck(page: Page, opts: PrematureSubmitOptions = {}): Promise<Report> {
  const report = newReport(CHECK, resolvePlatforms(opts))

  const found: { button: string; unseen: string[] }[] = await page.evaluate(
    ([primarySel, flowSel, words]) => {
      const PRIMARY = new RegExp(words, 'i')
      const text = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
      const vw = () => document.documentElement.clientWidth
      const vh = () => document.documentElement.clientHeight
      const shown = (el: Element) => {
        const r = el.getBoundingClientRect()
        const cs = getComputedStyle(el)
        return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden'
      }
      // can a person see any of it, from where the page is scrolled right now?
      const inSight = (el: Element) => {
        const r = el.getBoundingClientRect()
        let L = Math.max(r.left, 0)
        let T = Math.max(r.top, 0)
        let R = Math.min(r.right, vw())
        let B = Math.min(r.bottom, vh())
        for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
          const acs = getComputedStyle(a)
          if (acs.overflowX === 'visible' && acs.overflowY === 'visible') continue
          const ar = a.getBoundingClientRect()
          if (acs.overflowX !== 'visible') { L = Math.max(L, ar.left); R = Math.min(R, ar.right) }
          if (acs.overflowY !== 'visible') { T = Math.max(T, ar.top); B = Math.min(B, ar.bottom) }
        }
        return R - L > 0 && B - T > 0
      }
      const nameOf = (el: Element) => {
        const by = el.getAttribute('aria-labelledby')
        return (
          text(el.getAttribute('aria-label')) ||
          (by ? by.split(/\s+/).map((id) => text(document.getElementById(id)?.textContent)).join(' ') : '') ||
          (el.id ? text(document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent) : '') ||
          text(el.closest('label')?.textContent) ||
          text(el.closest('fieldset')?.querySelector('legend')?.textContent) ||
          (el instanceof HTMLInputElement && ['submit', 'button'].includes(el.type) ? el.value : '') ||
          text(el.textContent) ||
          el.getAttribute('name') ||
          el.id ||
          el.tagName.toLowerCase()
        ).slice(0, 40)
      }

      const candidates = primarySel
        ? [...document.querySelectorAll(primarySel)]
        : [...document.querySelectorAll('button, input[type="submit"], [role="button"]')].filter(
            (b) => (b instanceof HTMLButtonElement && b.type === 'submit' && !!b.form) || (b instanceof HTMLInputElement && b.type === 'submit') || PRIMARY.test(nameOf(b)),
          )
      const settings =
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea, [role="checkbox"], [role="switch"], [role="radio"], [role="slider"], [role="combobox"], [role="spinbutton"], [role="listbox"]'

      const out: { button: string; unseen: string[] }[] = []
      for (const button of candidates) {
        if (!shown(button) || (button as HTMLButtonElement).disabled) continue
        const flow =
          (flowSel && button.closest(flowSel)) ||
          button.closest('form, dialog, [role="dialog"], [role="form"], [data-hedgehog-flow]') ||
          button.closest('section, main, article, aside') ||
          document.body

        // meet the button the way a person would: scroll the least it takes to see it, then put things back
        const scrolled: [Element | Window, number, number][] = [[window, window.scrollX, window.scrollY]]
        for (let a = button.parentElement; a; a = a.parentElement) if (a.scrollTop || a.scrollLeft || a.scrollHeight > a.clientHeight) scrolled.push([a, a.scrollLeft, a.scrollTop])
        if (!inSight(button)) button.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        const b = button.getBoundingClientRect()
        const unseen: string[] = []
        if (inSight(button)) {
          for (const s of flow.querySelectorAll(settings)) {
            if (!shown(s) || s.closest('[data-hedgehog-unrelated]')) continue
            if (!(button.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING)) continue
            if (s.getBoundingClientRect().top < b.bottom - 1) continue // beside it or above it: they meet it first
            if (!inSight(s)) unseen.push(nameOf(s))
          }
        }
        for (const [el, x, y] of scrolled) {
          if (el === window) window.scrollTo(x, y)
          else {
            ;(el as Element).scrollLeft = x
            ;(el as Element).scrollTop = y
          }
        }
        out.push({ button: nameOf(button), unseen: [...new Set(unseen)] })
      }
      return out
    },
    [opts.primary ?? null, opts.flow ?? null, PRIMARY_WORDS.source] as const,
  )

  if (!found.length) {
    report.skipped.push({ check: CHECK, reason: 'no primary action found (no submit button, and nothing called Export, Save, Send…): point it at yours with `primary`' })
    return finish(report, opts)
  }
  for (const f of found) {
    if (!f.unseen.length) {
      report.passed++
      continue
    }
    const list = f.unseen.slice(0, 6).map((n) => `"${n}"`).join(', ') + (f.unseen.length > 6 ? ` and ${f.unseen.length - 6} more` : '')
    report.findings.push({
      check: CHECK,
      caseId: 'submit-above-options',
      where: `"${f.button}"`,
      what: `${f.unseen.length} setting(s) below it, out of sight: ${list}`,
      human: `"${f.button}" sits above ${f.unseen.length === 1 ? 'a setting' : `${f.unseen.length} settings`} in the same flow (${list}) that can't be seen when the button can, so it can be pressed before anyone has met them. ${why()}`,
    })
  }
  return finish(report, opts)
}
