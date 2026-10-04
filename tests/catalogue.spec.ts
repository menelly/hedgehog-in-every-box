/**
 * 📚 The catalogue keeps its promises:
 *   - every case says why a human does it, how we check it, and where we learned it
 *   - every 'incident' names the app, the month, what broke, and who found it
 *   - CATALOGUE.md is generated from the source, and this test FAILS if it's stale
 *     (regenerate with: npm run catalogue)
 */
import { expect, test } from '@playwright/test'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { ALL_PLATFORMS, CATALOGUE, INCIDENTS, KIND_PLATFORMS, platformsOf, type Case, type Kind } from '../src'

const KIND_TITLES: Record<Kind, string> = {
  name: '🧑 Names',
  script: '🌍 Scripts and writing systems',
  paste: '📋 Paste chaos',
  'number-date': '🔢 Numbers and dates',
  'wrong-field': '🔀 The wrong field',
  interaction: '👆 Interaction chaos',
  motion: "🌀 Things that move that shouldn't",
  clipping: '✂️ Text that gets cut off',
  'mobile-keyboard': '📱 The keyboard covers the box',
  accessibility: '♿ Accessibility',
}

const SOURCE_WORDS = {
  incident: '🧾 incident',
  'rens-list': "🦔 Ren's list",
  widespread: '🌐 widespread',
  community: '💬 community',
  generic: '📘 generic',
} as const

function provenanceText(c: Case): string {
  const p = c.provenance
  switch (p.source) {
    case 'incident':
      return `**${p.app}, ${p.when}.** ${p.what} *Found by: ${p.foundBy}.*`
    case 'rens-list':
    case 'generic':
      return p.note ?? ''
    default:
      return p.note
  }
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
function shown(c: Case): string {
  if (c.how === 'type-then-delete') return '*(typed, then deleted)*'
  if (c.text === undefined) return '*(an action)*'
  if (c.text.length > 60) return `*(${c.text.length} characters)*`
  return '`' + JSON.stringify(c.text).slice(1, -1).replace(/`/g, 'ˋ') + '`'
}

export function renderCatalogue(): string {
  const count = (s: string) => CATALOGUE.filter((c) => c.provenance.source === s).length
  const out: string[] = [
    '# 🦔 The catalogue',
    '',
    '*Generated from `src/catalogue.ts` by `npm run catalogue`. Edit the source, not this file.*',
    '',
    `**${CATALOGUE.length} cases.** Where each one came from:`,
    '',
    `- ${SOURCE_WORDS.incident}: **${count('incident')}**. It broke one of our real apps; the entry names the app and the month.`,
    `- ${SOURCE_WORDS['rens-list']}: **${count('rens-list')}**. On the list of things Ren types into every box by hand. No single recorded incident.`,
    `- ${SOURCE_WORDS.widespread}: **${count('widespread')}**. Ren hits it across many apps, not one of ours.`,
    `- ${SOURCE_WORDS.community}: **${count('community')}**. A commenter on r/AskVibecoders, replying to Ren. Good idea, no incident on file.`,
    `- ${SOURCE_WORDS.generic}: **${count('generic')}**. Plain best practice, labelled so nobody mistakes it for a war story.`,
    '',
  ]
  for (const kind of Object.keys(KIND_TITLES) as Kind[]) {
    const cases = CATALOGUE.filter((c) => c.kind === kind)
    out.push(`## ${KIND_TITLES[kind]}`, '')
    const plats = KIND_PLATFORMS[kind]
    out.push(`*Applies to: ${plats.length === ALL_PLATFORMS.length ? 'every platform' : plats.join(', ')}.*`, '')
    for (const c of cases) {
      out.push(`### ${c.title} \`${c.id}\``, '')
      out.push(`- **Input:** ${shown(c)}${c.field ? ` into the **${c.field}** box, and a good app should **${c.expect}** it` : ''}`)
      out.push(`- **Why a real person does this:** ${c.why}`)
      out.push(`- **How it's checked:** ${c.check}`)
      if (c.platforms) out.push(`- **Applies to:** ${platformsOf(c).join(', ')}`)
      const p = provenanceText(c)
      out.push(`- **Where we learned it:** ${SOURCE_WORDS[c.provenance.source]}${p ? `. ${p}` : ''}`)
      out.push('')
    }
  }
  return out.join('\n')
}

test('every case is complete and honest about where it came from', () => {
  const seen = new Set<string>()
  for (const c of CATALOGUE) {
    expect(seen.has(c.id), `duplicate id ${c.id}`).toBe(false)
    seen.add(c.id)
    expect(c.why.length, `${c.id} needs a why`).toBeGreaterThan(20)
    expect(c.check.length, `${c.id} needs a check`).toBeGreaterThan(5)
    if (c.kind === 'wrong-field') expect(c.field && c.expect && c.text !== undefined, `${c.id} needs field/expect/text`).toBeTruthy()
    if (c.provenance.source === 'incident') {
      for (const k of ['app', 'when', 'what', 'foundBy'] as const) expect(c.provenance[k].length, `${c.id} incident needs ${k}`).toBeGreaterThan(3)
    }
  }
  expect(INCIDENTS.length).toBeGreaterThanOrEqual(15)
})

test('CATALOGUE.md is up to date (npm run catalogue regenerates it)', () => {
  const file = path.join(__dirname, '..', 'CATALOGUE.md')
  const want = renderCatalogue()
  if (process.env.UPDATE_CATALOGUE) fs.writeFileSync(file, want, 'utf8')
  const have = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') : ''
  expect(have, 'CATALOGUE.md is stale: run `npm run catalogue`').toBe(want)
})
