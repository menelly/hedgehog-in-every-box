/**
 * ✂️ TEXT THAT GETS CUT OFF.
 *
 * For every visible element that holds text directly, at normal size, with
 * large text (root font size 200%, roughly what a big system font scale does)
 * and at 200% zoom:
 *
 *   - CLIPPED: the text is wider/taller than its box and the box hides the
 *     rest (overflow hidden/clip), or an ancestor that hides overflow cuts it.
 *   - ELLIPSIS: text-overflow: ellipsis actually cut something. Mark the ones
 *     you mean with data-truncate-ok (on the element or an ancestor).
 *   - ONE LETTER PER LINE: the box is narrower than its longest word, so the
 *     word breaks letter by letter.
 *
 * ⚠️ For React Native / Expo this is a PROXY. It checks the web build; the
 * Android "last few letters missing" bug lives in the native text renderer.
 * See the README's React Native notes for the real fixes.
 */
import type { Page } from '@playwright/test'
import { CATALOGUE } from './catalogue'
import { finish, firstSentence, newReport, resolvePlatforms, type CommonOptions, type Report } from './report'

export type ClipMode = 'normal' | 'large-text' | 'zoom-200'

export interface ClippingOptions extends CommonOptions {
  /** which sizes to check (default all three) */
  modes?: ClipMode[]
  /** only look inside this selector */
  within?: string
  /** stop after this many findings per mode, so one broken list doesn't print 500 lines (default 25) */
  maxPerMode?: number
}

const why = (id: string) => firstSentence(CATALOGUE.find((c) => c.id === id)!.why)

interface Clip {
  kind: 'clipped' | 'ellipsis' | 'letter-per-line'
  text: string
  where: string
}

const MODE_WORDS: Record<ClipMode, string> = {
  normal: 'at normal size',
  'large-text': 'with large text',
  'zoom-200': 'at 200% zoom',
}

export async function clippingCheck(page: Page, opts: ClippingOptions = {}): Promise<Report> {
  const report = newReport('clippingCheck', resolvePlatforms(opts))
  const max = opts.maxPerMode ?? 25

  for (const mode of opts.modes ?? (['normal', 'large-text', 'zoom-200'] as ClipMode[])) {
    const clips: Clip[] = await page.evaluate(
      ([mode, within]) => {
        const html = document.documentElement
        const saved = { fontSize: html.style.fontSize, zoom: (html.style as CSSStyleDeclaration & { zoom: string }).zoom }
        if (mode === 'large-text') html.style.fontSize = '200%'
        if (mode === 'zoom-200') (html.style as CSSStyleDeclaration & { zoom: string }).zoom = '2'
        void html.offsetHeight // force layout

        const out: { kind: 'clipped' | 'ellipsis' | 'letter-per-line'; text: string; where: string }[] = []
        const root = (within && document.querySelector(within)) || document.body
        const canvas = document.createElement('canvas').getContext('2d')!
        const hides = (v: string) => v === 'hidden' || v === 'clip'
        const describe = (el: Element) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '')

        for (const el of root.querySelectorAll<HTMLElement>('*')) {
          if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'INPUT', 'TEXTAREA', 'SELECT', 'OPTION'].includes(el.tagName)) continue
          const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join('').replace(/\s+/g, ' ').trim()
          if (!own) continue
          const r = el.getBoundingClientRect()
          const cs = getComputedStyle(el)
          if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden' || cs.display === 'none') continue
          const text = own.slice(0, 60)
          const okToTruncate = !!el.closest('[data-truncate-ok]')

          // the element hides its own overflow
          const overX = el.scrollWidth > el.clientWidth + 1
          const overY = el.scrollHeight > el.clientHeight + 1
          if ((overX && hides(cs.overflowX)) || (overY && hides(cs.overflowY))) {
            if (cs.textOverflow === 'ellipsis') {
              if (!okToTruncate) out.push({ kind: 'ellipsis', text, where: describe(el) })
            } else if (!okToTruncate) out.push({ kind: 'clipped', text, where: describe(el) })
            continue
          }
          // an ancestor hides overflow and the text runs past it
          let cut = false
          for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
            const acs = getComputedStyle(a)
            if (!hides(acs.overflowX) && !hides(acs.overflowY)) continue
            const ar = a.getBoundingClientRect()
            // entirely outside = hidden on purpose (an off-screen carousel slide), not cut off
            const overlaps = r.right > ar.left && r.left < ar.right && r.bottom > ar.top && r.top < ar.bottom
            if (!overlaps) {
              cut = false
              break
            }
            if ((hides(acs.overflowX) && (r.right > ar.right + 1 || r.left < ar.left - 1)) || (hides(acs.overflowY) && (r.bottom > ar.bottom + 1 || r.top < ar.top - 1))) {
              cut = true
              break
            }
          }
          if (cut && !okToTruncate) {
            out.push({ kind: 'clipped', text, where: describe(el) })
            continue
          }
          // one letter per line: the content box is narrower than the longest word
          const longest = own.split(' ').sort((x, y) => y.length - x.length)[0] ?? ''
          if (longest.length >= 4) {
            canvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
            const need = canvas.measureText(longest).width
            const have = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
            if (have > 0 && have + 1 < need && cs.display !== 'inline') out.push({ kind: 'letter-per-line', text, where: describe(el) })
          }
        }
        html.style.fontSize = saved.fontSize
        ;(html.style as CSSStyleDeclaration & { zoom: string }).zoom = saved.zoom
        return out
      },
      [mode, opts.within ?? null] as const,
    )

    for (const c of clips.slice(0, max)) {
      const human =
        c.kind === 'letter-per-line'
          ? `"${c.text}" is squeezed narrower than its longest word ${MODE_WORDS[mode]}, so it breaks one letter per line. ${why('one-letter-per-line')}`
          : c.kind === 'ellipsis'
            ? `"${c.text}" is cut short with "…" ${MODE_WORDS[mode]}. If that's on purpose, mark it data-truncate-ok; if not, let it wrap. ${why('truncate-on-narrow')}`
            : `The end of "${c.text}" is cut off ${MODE_WORDS[mode]}. ${why('clipped-text')}`
      report.findings.push({
        check: 'clippingCheck',
        where: c.where,
        caseId: c.kind === 'letter-per-line' ? 'one-letter-per-line' : c.kind === 'ellipsis' ? 'truncate-on-narrow' : 'clipped-text',
        what: `${c.kind} (${mode})`,
        human,
      })
    }
    if (clips.length > max) {
      report.findings.push({ check: 'clippingCheck', where: '(more)', what: `${clips.length - max} more ${mode} findings not listed`, human: `…and ${clips.length - max} more pieces of text cut off ${MODE_WORDS[mode]}.` })
    }
    if (!clips.length) report.passed++
  }
  return finish(report, opts)
}
