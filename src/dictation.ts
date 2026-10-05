/**
 * 🎙️ DICTATION — the app must not punish people who can't type.
 *
 * Speech-to-text (Windows Voice Typing, Dragon, iOS/Android dictation, Voice
 * Access) doesn't type key by key the way a keyboard does. It:
 *   - drops a WHOLE PHRASE into the box in one go,
 *   - goes back and REPLACES a word in the middle when you correct it
 *     ("correct prescription to refill"),
 *   - capitalises oddly, and
 *   - leaves a TRAILING SPACE (and sometimes punctuation) so the next phrase
 *     can be joined on.
 *
 * Input handlers written by someone who only ever tested with a keyboard eat
 * these: a "tidy" that trims on every keystroke glues the next phrase onto
 * the last word, a "max N characters per event" guard drops half a sentence,
 * a mask rewrites the value and puts the caret somewhere else.
 *
 * For every free-text box, this does what a dictation engine does:
 *   1. drop in a whole phrase at once (odd caps, trailing space)
 *   2. select the MIDDLE word and replace it, the way a correction does
 *   3. put the caret at the end and add a second phrase
 *   4. leave the box
 * and after each step checks the box still holds exactly what was said.
 * (On leaving the box, trimming the outer spaces is fine: that's tidying, not
 * eating. Anything else is a finding.)
 *
 * Steps 2 and 3 go in with keyboard.insertText(), which commits text the way
 * an IME or a dictation engine does: one input event, a whole chunk, no keys.
 */
import type { Page } from '@playwright/test'
import { CATALOGUE, appliesTo } from './catalogue'
import { FlinchWatcher, flinchInWords, type FlinchOptions } from './flinch'
import { finish, firstSentence, newReport, resolvePlatforms, type CommonOptions, type Report } from './report'
import { boxLocator, findTextBoxes, type BoxInfo } from './walk'

export interface DictationOptions extends CommonOptions, FlinchOptions {
  /** the phrase "said" first. Keep a trailing space: dictation leaves one. */
  phrase?: string
  /** which word of the phrase gets "corrected" (default: the middle one) */
  replaceWord?: string
  /** what it gets corrected to */
  replacement?: string
  /** the second phrase, added at the end */
  then?: string
  /** only check boxes inside this CSS selector */
  within?: string
  /** leave some boxes alone */
  skipBox?: (b: BoxInfo) => boolean
  /** pause after each step for debounced handlers to fire (default 300ms) */
  settleMs?: number
}

const CHECK = 'dictationCheck'
const DICTATION = CATALOGUE.find((c) => c.id === 'dictation')!
const why = firstSentence(DICTATION.why)

// 🗣️ what a dictation engine actually produces: lowercase start, a capital in
// the middle for no reason, a full stop, and the trailing space it leaves so
// the next phrase can join on
const PHRASE = 'pick up the Prescription at the pharmacy tomorrow morning. '
const THEN = 'And bring the Card'

/**
 * 🔍 where two strings part ways, shown from just before the split. The thing
 * dictation loses is usually at the END (a trailing space), which is exactly
 * what a "first 34 characters…" preview would hide.
 */
function whereItDiffers(have: string, want: string): string {
  let i = 0
  while (i < have.length && i < want.length && have[i] === want[i]) i++
  const from = Math.max(0, i - 16)
  const tail = (s: string) => JSON.stringify((from > 0 ? '…' : '') + s.slice(from, i + 24))
  return `holds ${tail(have)}, wanted ${tail(want)} (first difference at character ${i + 1})`
}

/** the middle word of a phrase (by words, not characters) */
function middleWord(phrase: string): string {
  const words = phrase.trim().split(/\s+/)
  return words[Math.floor(words.length / 2)].replace(/[.,!?]$/, '')
}

export async function dictationCheck(page: Page, opts: DictationOptions = {}): Promise<Report> {
  const platforms = resolvePlatforms(opts)
  const report = newReport(CHECK, platforms)

  // 🧭 profile: a web check can't see a native text input, so React Native gets the manual checklist instead
  if (!appliesTo(DICTATION, platforms)) {
    report.skipped.push({ check: CHECK, reason: `dictation: not in profile ${platforms.join(' + ')} (applies to ${(DICTATION.platforms ?? []).join(', ')})` })
    return finish(report, opts)
  }

  const phrase = opts.phrase ?? PHRASE
  const target = opts.replaceWord ?? middleWord(phrase)
  const replacement = opts.replacement ?? 'Refill'
  const then = opts.then ?? THEN
  const at = phrase.indexOf(target)
  if (at < 0) throw new Error(`dictationCheck: "${target}" isn't in the phrase "${phrase}"`)
  const corrected = phrase.slice(0, at) + replacement + phrase.slice(at + target.length)
  const whole = corrected + then
  const settle = () => page.waitForTimeout(opts.settleMs ?? 300)

  const watch = new FlinchWatcher(page, opts)
  const boxes = (await findTextBoxes(page, opts.within)).filter((b) => !opts.skipBox?.(b))

  for (const b of boxes) {
    // only boxes meant for words: dictating a sentence into a phone or email box isn't the point
    if (!b.freeText) {
      report.skipped.push({ check: CHECK, reason: `${b.key} box: a ${b.type}${b.type === 'text' ? ' (numeric/tel/email/url keyboard)' : ''} box, not free text` })
      continue
    }
    if (b.maxLength && b.maxLength < whole.length) {
      report.skipped.push({ check: CHECK, reason: `${b.key} box: maxlength ${b.maxLength} is shorter than one spoken sentence (${whole.length} characters)` })
      continue
    }

    const box = boxLocator(page, b)
    const add = (what: string, human: string) => report.findings.push({ check: CHECK, caseId: 'dictation', where: `${b.key} box`, what, human })
    const mark = watch.mark()
    const holds = async (want: string, step: string, allowTrim = false): Promise<boolean> => {
      await settle()
      await watch.settle()
      const flinches = watch.since(mark)
      if (flinches.length) {
        add(`${step}: ${flinches.map((f) => f.kind).join(', ')}`, `While dictating into the "${b.key}" box (${step}), ${flinchInWords(flinches[0])} ${why}`)
        return false
      }
      const have = await box.inputValue()
      if (have === want || (allowTrim && have === want.trim())) return true
      add(
        `${step}: ${whereItDiffers(have, want)}`,
        `The "${b.key}" box didn't keep what was dictated (${step}): it ${whereItDiffers(have, want)}. ${why}`,
      )
      return false
    }

    // 1️⃣ a whole phrase at once
    await box.fill(phrase)
    if (!(await holds(phrase, 'a whole phrase pasted in at once'))) continue

    // 2️⃣ the correction: select the middle word, say the new one
    await box.focus()
    await box.evaluate((el: HTMLInputElement | HTMLTextAreaElement, [s, e]) => el.setSelectionRange(s, e), [at, at + target.length] as [number, number])
    await page.keyboard.insertText(replacement)
    if (!(await holds(corrected, `"${target}" corrected to "${replacement}" mid-sentence`))) continue

    // 3️⃣ the next phrase, joined on after the trailing space dictation left
    await box.evaluate((el: HTMLInputElement | HTMLTextAreaElement) => el.setSelectionRange(el.value.length, el.value.length))
    await page.keyboard.insertText(then)
    if (!(await holds(whole, 'a second phrase added at the end'))) continue

    // 4️⃣ leave the box (trimming the outer spaces here is tidying, and fine)
    await box.evaluate((el: HTMLElement) => el.blur())
    if (!(await holds(whole, 'after leaving the box', true))) continue

    report.passed++
    await box.fill('') // leave the form as we found it
  }

  if (!boxes.some((b) => b.freeText)) report.skipped.push({ check: CHECK, reason: 'dictation: no free-text boxes on this page' })
  return finish(report, opts)
}
