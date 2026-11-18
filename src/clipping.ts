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
 *   - CUT BY A SHAPE (🔭 Lumen, from a desktop-app test-drive, Nov 2026): a
 *     ribbon's V-notch printed "Home" as "Homc", and nothing overflowed, so
 *     none of the above fired. So we hit-test points across every line of
 *     text: where the text can't be found because a clip-path / mask cut it
 *     away, or a painted sibling (an SVG shape, a picture, a box with a
 *     background) sits on top of it, while the rest of the same text is
 *     fine, that's a cut. Text that is covered COMPLETELY is left alone (a
 *     dialog over the page, a closed drawer): this is about the half-letter.
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
  kind: 'clipped' | 'ellipsis' | 'letter-per-line' | 'shape'
  text: string
  where: string
  /** for 'shape': what did the cutting, in words */
  by?: string
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

        const out: { kind: 'clipped' | 'ellipsis' | 'letter-per-line' | 'shape'; text: string; where: string; by?: string }[] = []
        const root = (within && document.querySelector(within)) || document.body
        const canvas = document.createElement('canvas').getContext('2d')!
        const hides = (v: string) => v === 'hidden' || v === 'clip'
        const describe = (el: Element) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.classList.length ? '.' + [...el.classList].slice(0, 2).join('.') : '')

        // ── ✂️🎀 cut by a shape: the hit-testing kit ──
        // Hit-testing follows what is PAINTED: clip-path and masks cut the hit area exactly like they cut
        // the pixels, and SVG shapes are only hit where they're filled or stroked. So "can I find this text
        // at this point?" answers "can a person see this text at this point?".
        // Decorations are usually pointer-events: none, which hides them from hit-testing, so for the
        // length of this check EVERYTHING answers (the style is removed again below).
        const hitAll = document.createElement('style')
        hitAll.textContent = '*, *::before, *::after { pointer-events: auto !important; }'
        document.head.appendChild(hitAll)
        const vw = document.documentElement.clientWidth
        const vh = document.documentElement.clientHeight
        // content scrolling under a fixed or sticky header or footer is normal: that overlap moves when you scroll
        const pageScrolls = document.documentElement.scrollHeight > vh + 1 || document.documentElement.scrollWidth > vw + 1
        const inFixedLayer = (el: Element) => {
          for (let a: Element | null = el; a; a = a.parentElement) if (/^(fixed|sticky)$/.test(getComputedStyle(a).position)) return true
          return false
        }
        // the part of a rectangle a person could see: inside the window and every ancestor that clips
        const seenPart = (el: Element, r: DOMRect) => {
          let L = Math.max(r.left, 0)
          let T = Math.max(r.top, 0)
          let R = Math.min(r.right, vw)
          let B = Math.min(r.bottom, vh)
          for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
            const acs = getComputedStyle(a)
            if (acs.overflowX === 'visible' && acs.overflowY === 'visible') continue
            const ar = a.getBoundingClientRect()
            if (acs.overflowX !== 'visible') { L = Math.max(L, ar.left); R = Math.min(R, ar.right) }
            if (acs.overflowY !== 'visible') { T = Math.max(T, ar.top); B = Math.min(B, ar.bottom) }
          }
          return R - L > 3 && B - T > 1 ? { L, T, R, B } : null
        }
        const clipperOf = (el: Element) => {
          for (let a: Element | null = el; a && a !== document.documentElement; a = a.parentElement) {
            const acs = getComputedStyle(a) as CSSStyleDeclaration & { webkitMaskImage?: string }
            if ((acs.clipPath && acs.clipPath !== 'none') || (acs.maskImage && acs.maskImage !== 'none') || (acs.webkitMaskImage && acs.webkitMaskImage !== 'none')) return a
          }
          return null
        }
        // does this element actually PAINT something at (x, y)? An invisible overlay cuts nothing.
        const paints = (c: Element, x: number, y: number) => {
          const ccs = getComputedStyle(c)
          if (Number(ccs.opacity) < 0.1) return false
          if (c instanceof SVGGeometryElement || c instanceof SVGTextContentElement) return ccs.fill !== 'none' || ccs.stroke !== 'none'
          if (c instanceof SVGElement) return false // an <svg> or <g>: its painted children answer for themselves
          if (/^(IMG|VIDEO|IFRAME|EMBED|OBJECT)$/.test(c.tagName)) return true
          if (c instanceof HTMLCanvasElement) {
            try {
              const ctx = c.getContext('2d')
              if (!ctx) return true // WebGL: can't read it this way, so assume it paints
              const b = c.getBoundingClientRect()
              const px = Math.floor(((x - b.left) / b.width) * c.width)
              const py = Math.floor(((y - b.top) / b.height) * c.height)
              return ctx.getImageData(px, py, 1, 1).data[3] > 64
            } catch {
              return true // tainted by a cross-origin picture: assume it paints
            }
          }
          const bg = ccs.backgroundColor.match(/[\d.]+/g)
          const alpha = bg ? (bg.length > 3 ? Number(bg[3]) : 1) : 0
          return alpha > 0.1 || ccs.backgroundImage !== 'none'
        }
        /** null if the text is whole (or wholly hidden, which is someone else's business); else what cut it */
        const shapeCut = (el: HTMLElement): string | null => {
          if (el.closest('[data-truncate-ok]')) return null
          let whole = 0
          let cutBy: string | null = null
          const elFixed = inFixedLayer(el)
          for (const node of el.childNodes) {
            if (node.nodeType !== 3 || !(node.textContent ?? '').trim()) continue
            const range = document.createRange()
            range.selectNodeContents(node)
            for (const line of [...range.getClientRects()].slice(0, 50)) {
              const part = seenPart(el, line)
              if (!part) continue
              const cols = Math.min(60, Math.max(3, Math.ceil((part.R - part.L) / 3)))
              for (let i = 0; i <= cols; i++) {
                const x = part.L + 1.5 + ((part.R - part.L - 3) * i) / cols
                for (const f of [0.15, 0.35, 0.5, 0.65, 0.85]) {
                  const y = line.top + line.height * f
                  if (y < part.T || y > part.B) continue
                  const stack = document.elementsFromPoint(x, y)
                  // el itself, not a child: a positioned child (an icon, an SVG) painted over the text is a cover too
                  const at = stack.indexOf(el)
                  if (at === -1) {
                    // the text isn't there. A clip-path or mask on it (or an ancestor) cut it away. A rounded
                    // corner also trims hit-testing without hiding any text, so with no clipper we say nothing.
                    const clipper = clipperOf(el)
                    if (clipper) cutBy ??= `the clip-path / mask on ${describe(clipper)}`
                    continue
                  }
                  const over = stack
                    .slice(0, at)
                    .find((s) => !s.contains(el) && paints(s, x, y) && !(pageScrolls && inFixedLayer(s) !== elFixed))
                  if (over) cutBy ??= `${describe(over)}, painted on top of it`
                  else whole++
                }
              }
            }
          }
          return whole > 0 && cutBy ? cutBy : null
        }

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
          // 🦔 field run 2026-11-05 (Shareholder Value's <pre> board): two false-positive fixes.
          //   (1) split on ANY whitespace: splitting on ' ' alone glued a <pre>'s lines into one giant "word".
          //   (2) white-space pre / nowrap CAN'T wrap a word at all; it overflows or scrolls, and the
          //       overflow checks above already own that. So letter-per-line doesn't apply to them.
          const cannotWrap = /^(pre|nowrap)$/.test(cs.whiteSpace)
          const longest = own.split(/\s+/).sort((x, y) => y.length - x.length)[0] ?? ''
          if (!cannotWrap && longest.length >= 4) {
            canvas.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
            const need = canvas.measureText(longest).width
            const have = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
            if (have > 0 && have + 1 < need && cs.display !== 'inline') out.push({ kind: 'letter-per-line', text, where: describe(el) })
          }
          // cut by a shape: a notch, a mask, a decoration on top
          const by = shapeCut(el)
          if (by) out.push({ kind: 'shape', text, where: describe(el), by })
        }
        hitAll.remove()
        html.style.fontSize = saved.fontSize
        ;(html.style as CSSStyleDeclaration & { zoom: string }).zoom = saved.zoom
        return out
      },
      [mode, opts.within ?? null] as const,
    )

    for (const c of clips.slice(0, max)) {
      const human =
        c.kind === 'shape'
          ? `Part of "${c.text}" is cut away ${MODE_WORDS[mode]}, by ${c.by}, so a letter can read as a different one. ${why('shape-clipped-text')}`
          : c.kind === 'letter-per-line'
          ? `"${c.text}" is squeezed narrower than its longest word ${MODE_WORDS[mode]}, so it breaks one letter per line. ${why('one-letter-per-line')}`
          : c.kind === 'ellipsis'
            ? `"${c.text}" is cut short with "…" ${MODE_WORDS[mode]}. If that's on purpose, mark it data-truncate-ok; if not, let it wrap. ${why('truncate-on-narrow')}`
            : `The end of "${c.text}" is cut off ${MODE_WORDS[mode]}. ${why('clipped-text')}`
      report.findings.push({
        check: 'clippingCheck',
        where: c.where,
        caseId: c.kind === 'shape' ? 'shape-clipped-text' : c.kind === 'letter-per-line' ? 'one-letter-per-line' : c.kind === 'ellipsis' ? 'truncate-on-narrow' : 'clipped-text',
        what: c.kind === 'shape' ? `cut by ${c.by} (${mode})` : `${c.kind} (${mode})`,
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
