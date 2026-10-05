/**
 * 🦔 hedgehog-in-every-box
 *
 * Ways a real person has broken an app, and how to test for them ahead of
 * time. Breakage catalogue by Ren (Shalia Martin), QA; built by Ace (Claude).
 *
 *   import { hedgehog } from 'hedgehog-in-every-box'
 *   const h = hedgehog({ platforms: ['web-mobile'] })
 *   test('every box', async ({ page }) => { await page.goto('/'); await h.walkEveryTextbox(page) })
 */
import type { Page } from '@playwright/test'
import { CATALOGUE, KIND_PLATFORMS, type Kind } from './catalogue'
import { a11ySmoke, type A11yOptions } from './a11y'
import { clippingCheck, type ClippingOptions } from './clipping'
import { dictationCheck, type DictationOptions } from './dictation'
import { comeBackTomorrow, doubleSubmit, roundTripValue, survivesReload, type ComeBackTomorrowOptions, type DoubleSubmitOptions, type RoundTripValueOptions, type SurvivesReloadOptions } from './interaction'
import { keyboardCheck, type KeyboardOptions } from './keyboard'
import { fieldMixup, type FieldMixupOptions } from './mixup'
import { motionCheck, type MotionOptions } from './motion'
import { notApplicable, resolvePlatforms, type CommonOptions } from './report'
import { walkEveryTextbox, type WalkOptions } from './walk'

export * from './catalogue'
export * from './report'
export * from './flinch'
export * from './walk'
export * from './mixup'
export * from './interaction'
export * from './motion'
export * from './clipping'
export * from './keyboard'
export * from './a11y'
export * from './dictation'

const KIND_WORDS: Record<Kind, string> = {
  name: 'names',
  script: 'scripts',
  paste: 'paste chaos',
  'number-date': 'numbers and dates',
  'wrong-field': 'wrong field',
  interaction: 'interaction chaos',
  motion: 'things that move',
  clipping: 'text cut off',
  'mobile-keyboard': 'mobile keyboard',
  accessibility: 'accessibility',
}

/**
 * Bind your defaults (above all, which kind of app this is) once, and every
 * helper uses them. A check that doesn't fit your platforms is skipped with
 * a reason in the report, never failed and never silently missing.
 *
 * In a test that is ONLY about one category, skip it visibly:
 *   test('keyboard', async ({ page }) => {
 *     test.skip(!h.applies('mobile-keyboard'), h.why('mobile-keyboard'))
 *     …
 *   })
 */
export function hedgehog(defaults: CommonOptions = {}) {
  const platforms = resolvePlatforms(defaults)
  const d = { ...defaults, platforms }
  return {
    platforms,
    /** does this category apply to the chosen platforms? */
    applies: (kind: Kind) => notApplicable(KIND_WORDS[kind], KIND_PLATFORMS[kind], platforms) === null,
    /** the reason a category is skipped (empty string if it applies) */
    why: (kind: Kind) => notApplicable(KIND_WORDS[kind], KIND_PLATFORMS[kind], platforms) ?? '',
    /** the catalogue cases that apply to these platforms */
    cases: () => CATALOGUE.filter((c) => (c.platforms ?? KIND_PLATFORMS[c.kind]).some((p) => platforms.includes(p))),
    walkEveryTextbox: (page: Page, o: WalkOptions = {}) => walkEveryTextbox(page, { ...d, ...o }),
    fieldMixup: (page: Page, o: FieldMixupOptions) => fieldMixup(page, { ...d, ...o }),
    doubleSubmit: (page: Page, o: DoubleSubmitOptions) => doubleSubmit(page, { ...d, ...o }),
    comeBackTomorrow: (page: Page, o: ComeBackTomorrowOptions) => comeBackTomorrow(page, { ...d, ...o }),
    survivesReload: (page: Page, o: SurvivesReloadOptions) => survivesReload(page, { ...d, ...o }),
    roundTripValue: (page: Page, o: RoundTripValueOptions) => roundTripValue(page, { ...d, ...o }),
    motionCheck: (page: Page, o: MotionOptions = {}) => motionCheck(page, { ...d, ...o }),
    clippingCheck: (page: Page, o: ClippingOptions = {}) => clippingCheck(page, { ...d, ...o }),
    keyboardCheck: (page: Page, o: KeyboardOptions = {}) => keyboardCheck(page, { ...d, ...o }),
    a11ySmoke: (page: Page, o: A11yOptions = {}) => a11ySmoke(page, { ...d, ...o }),
    dictationCheck: (page: Page, o: DictationOptions = {}) => dictationCheck(page, { ...d, ...o }),
  }
}
