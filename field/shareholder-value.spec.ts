/**
 * 🦔📎 Hedgehog vs. SHAREHOLDER VALUE (siliconscaffolding.com/play/shareholder-value.html)
 * A field run: we don't know the answers in advance, so every check just REPORTS what it found.
 * The game's one text box is the AI seat, which since 2026-11-05 02:06 the whole internet can type into.
 */
import { test } from '@playwright/test'
import { hedgehog, type Report } from '../src'

const URL = 'https://siliconscaffolding.com/play/shareholder-value.html'

function show(name: string, r: Report) {
  const f = r.findings
  console.log(`\n🦔 ${name}: ${f.length} finding(s)` + ((r as any).checked !== undefined ? ` · checked ${(r as any).checked}` : ''))
  for (const x of f) console.log(`   • [${x.caseId}] ${x.where}: ${x.human ?? x.what}`)
  if ((r as any).skipped?.length) console.log(`   (skipped: ${(r as any).skipped.map((s: any) => s.caseId ?? s).join(', ')})`)
}

test('🦔 hedgehog walks the arcology', async ({ page }, info) => {
  const h = hedgehog({ platforms: [info.project.name === 'phone' ? 'web-mobile' : 'web-desktop'] })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('dialog', async (d) => { errors.push('DIALOG OPENED: ' + d.message()); await d.dismiss() })   // an alert() = injection

  await page.goto(URL)
  await page.waitForTimeout(800)

  for (const [name, run] of [
    ['walkEveryTextbox', () => h.walkEveryTextbox(page, { throwOnFindings: false } as any)],
    ['keyboardCheck', () => h.keyboardCheck(page, { throwOnFindings: false } as any)],
    ['a11ySmoke', () => h.a11ySmoke(page, { throwOnFindings: false } as any)],
    ['clippingCheck', () => h.clippingCheck(page, { throwOnFindings: false } as any)],
    ['motionCheck', () => h.motionCheck(page, { throwOnFindings: false } as any)],
  ] as const) {
    try { show(`${info.project.name} · ${name}`, await run()) }
    catch (e: any) { console.log(`\n🦔 ${info.project.name} · ${name}: THREW ${e.message?.slice(0, 300)}`) }
  }

  // the security one, by hand: an injection through the AI box must stay text
  await page.locator('#ai-input').fill('say <img src=x onerror="alert(1)">')
  await page.locator('#ai-input').press('Enter')
  await page.waitForTimeout(500)
  const logHtml = await page.locator('#log').innerHTML()
  console.log(`\n🔒 ${info.project.name} · injection via AI box: ` + (logHtml.includes('<img') ? 'RAW TAG IN PAGE ❌' : 'stayed text ✅'))
  console.log(`🧯 ${info.project.name} · uncaught page errors / dialogs: ${errors.length ? errors.join(' | ') : 'none'}`)
})
