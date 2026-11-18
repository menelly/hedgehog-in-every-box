/**
 * 🎯 CONTROLS ON TOP OF EACH OTHER.
 *
 * 🔭 Lumen, from a live test-drive of a desktop app (November 2026): a corner
 * Home button sat on top of a tab on the side rail. Each one passed the 24px
 * target-size check on its own; together, part of the tab couldn't be clicked,
 * and a tap meant for one landed on the other.
 *
 * So: every visible button, link, tab and form control, measured by the part of
 * it a person can actually see (inside the window and inside its scroll areas),
 * compared with every other one. Any two that overlap are a finding, and the
 * finding says which one a click in the overlap actually reaches.
 *
 * Not findings, on purpose:
 *   - one control INSIDE another in the page (a link inside a button: that's
 *     its own bug, and axe has a rule for it),
 *   - a small control drawn inside a text box (the clear ×, the search icon):
 *     a pattern, not a collision,
 *   - page content scrolling under a fixed or sticky header or footer: that overlap moves
 *     when you scroll, so it isn't a fixed collision,
 *   - anything marked data-overlap-ok (on it or an ancestor).
 *
 * It checks the page as it is right now: open the menu or drawer first if you
 * want those checked too.
 */
import type { Page } from '@playwright/test'
import { CATALOGUE } from './catalogue'
import { finish, firstSentence, newReport, resolvePlatforms, type CommonOptions, type Report } from './report'

export interface OverlapOptions extends CommonOptions {
  /** only look inside this selector */
  within?: string
  /** smallest overlap that counts, in CSS px, in BOTH directions (default 3: button groups often overlap 1px to share a border) */
  minOverlap?: number
}

const CHECK = 'overlapCheck'
const why = () => firstSentence(CATALOGUE.find((c) => c.id === 'controls-overlap')!.why)

interface Collision {
  a: string
  b: string
  w: number
  h: number
  /** which one a click in the middle of the overlap reaches (a, b, or neither) */
  wins: 'a' | 'b' | null
}

export async function overlapCheck(page: Page, opts: OverlapOptions = {}): Promise<Report> {
  const report = newReport(CHECK, resolvePlatforms(opts))
  const r: { count: number; hits: Collision[] } = await page.evaluate(
    ([within, minOverlap]) => {
      const root = (within && document.querySelector(within)) || document.body
      const sel =
        'button, a[href], input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"], [role="option"], [role="slider"], [tabindex]:not([tabindex="-1"])'
      const vw = document.documentElement.clientWidth
      const vh = document.documentElement.clientHeight
      const pageScrolls = document.documentElement.scrollHeight > vh + 1 || document.documentElement.scrollWidth > vw + 1
      const text = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim()
      const nameOf = (el: HTMLElement) => {
        const by = el.getAttribute('aria-labelledby')
        const n =
          el.getAttribute('aria-label') ||
          (by ? by.split(/\s+/).map((id) => text(document.getElementById(id)?.textContent)).join(' ') : '') ||
          (el.id ? text(document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent) : '') ||
          text(el.textContent) ||
          (el as HTMLInputElement).value ||
          el.getAttribute('title') ||
          el.getAttribute('name') ||
          ''
        const role = el.getAttribute('role') || el.tagName.toLowerCase()
        return n ? `"${n.slice(0, 40)}" ${role === 'a' ? 'link' : role}` : `an unnamed ${role}${el.id ? ' #' + el.id : ''}`
      }
      const inFixedLayer = (el: Element) => {
        for (let a: Element | null = el; a; a = a.parentElement) if (/^(fixed|sticky)$/.test(getComputedStyle(a).position)) return true
        return false
      }
      // what a person can see of it: inside the window and inside every ancestor that clips
      const seen = (el: Element) => {
        const r = el.getBoundingClientRect()
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
        return R - L > 0 && B - T > 0 ? { L, T, R, B } : null
      }
      type Box = { el: HTMLElement; name: string; box: { L: number; T: number; R: number; B: number }; fixed: boolean; field: boolean }
      const boxes: Box[] = []
      for (const el of root.querySelectorAll<HTMLElement>(sel)) {
        if ((el as HTMLInputElement).disabled) continue
        // opacity 0 is invisible (a file input stretched over a nice button is a pattern, not a collision)
        if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true } as CheckVisibilityOptions)) continue
        if (el.closest('[data-overlap-ok]')) continue
        const box = seen(el)
        if (!box) continue
        const field = el.matches('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="image"]):not([type="range"]), textarea, select')
        boxes.push({ el, name: nameOf(el), box, fixed: inFixedLayer(el), field })
      }

      const hits: Collision[] = []
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i]
          const b = boxes[j]
          if (a.el.contains(b.el) || b.el.contains(a.el)) continue
          const L = Math.max(a.box.L, b.box.L)
          const R = Math.min(a.box.R, b.box.R)
          const T = Math.max(a.box.T, b.box.T)
          const B = Math.min(a.box.B, b.box.B)
          if (R - L < minOverlap || B - T < minOverlap) continue
          // a little button drawn inside a text box: the clear ×, the search icon
          const inside = (outer: Box, inner: Box) => inner.box.L >= outer.box.L - 1 && inner.box.R <= outer.box.R + 1 && inner.box.T >= outer.box.T - 1 && inner.box.B <= outer.box.B + 1
          if ((a.field && inside(a, b)) || (b.field && inside(b, a))) continue
          // page content scrolling under a fixed or sticky bar: the overlap moves when you scroll
          if (pageScrolls && a.fixed !== b.fixed) continue
          const top = document.elementFromPoint((L + R) / 2, (T + B) / 2)
          const wins = top && a.el.contains(top) ? 'a' : top && b.el.contains(top) ? 'b' : null
          hits.push({ a: a.name, b: b.name, w: Math.round(R - L), h: Math.round(B - T), wins })
        }
      }
      return { count: boxes.length, hits }
    },
    [opts.within ?? null, opts.minOverlap ?? 3] as const,
  )

  if (r.count < 2) {
    report.skipped.push({ check: CHECK, reason: `fewer than two visible controls on this page (${r.count}), so nothing could overlap` })
    return finish(report, opts)
  }
  for (const c of r.hits) {
    const [top, under] = c.wins === 'b' ? [c.b, c.a] : [c.a, c.b]
    const human =
      c.wins === null
        ? `${c.a} and ${c.b} overlap by ${c.w}×${c.h}px, and a click in the overlap reaches neither of them. ${why()}`
        : `${top} sits on top of ${under} (${c.w}×${c.h}px of overlap), so a click there reaches ${top}, and that part of ${under} can't be pressed. ${why()}`
    report.findings.push({ check: CHECK, caseId: 'controls-overlap', where: `${c.a} × ${c.b}`, what: `overlap ${c.w}×${c.h}px, ${c.wins === null ? 'neither wins' : `${top} wins`}`, human })
  }
  if (!r.hits.length) report.passed++
  return finish(report, opts)
}
