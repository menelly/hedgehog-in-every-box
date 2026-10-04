/**
 * 👂 THE FLINCH WATCHER — listens to one page for the ways an app flinches
 * without necessarily falling over:
 *
 *   - a console.error (React logs render crashes here)
 *   - an uncaught exception
 *   - a native alert()/confirm()/prompt() — some embedded WebViews swallow
 *     these, so a delete behind confirm() silently does nothing (this broke a
 *     real app of ours on Android)
 *   - a response that SAYS it's JSON and doesn't parse — the sneaky one: the
 *     UI catches it and shows "Bad escaped character in JSON" instead of the
 *     real reason (this broke a real app of ours too)
 *
 * `mark()` + `since()` blame a string only for what happened while it was in
 * the box.
 */
import type { Page } from '@playwright/test'

export interface Flinch {
  kind: 'console-error' | 'uncaught' | 'native-dialog' | 'broken-json'
  text: string
}

export interface FlinchOptions {
  /** console messages / errors matching any of these are not blamed */
  ignore?: RegExp[]
  /** flag native dialogs (default true). They are dismissed either way. */
  dialogs?: boolean
  /** check JSON responses from these URLs parse (default: every response) */
  jsonFrom?: (url: string) => boolean
}

export class FlinchWatcher {
  private seen: Flinch[] = []
  private pending = new Set<Promise<void>>()

  constructor(page: Page, private opts: FlinchOptions = {}) {
    page.on('console', (m) => {
      if (m.type() === 'error') this.add({ kind: 'console-error', text: m.text().slice(0, 400) })
    })
    page.on('pageerror', (e) => this.add({ kind: 'uncaught', text: e.message.slice(0, 400) }))
    page.on('dialog', (d) => {
      if (opts.dialogs !== false) this.add({ kind: 'native-dialog', text: `${d.type()}("${d.message().slice(0, 200)}")` })
      d.dismiss().catch(() => {})
    })
    page.on('response', (r) => {
      const type = r.headers()['content-type'] ?? ''
      if (!type.includes('json')) return
      if (opts.jsonFrom && !opts.jsonFrom(r.url())) return
      const p = (async () => {
        try {
          const body = await r.text()
          if (!body.trim()) return
          try {
            JSON.parse(body)
          } catch (e) {
            this.add({ kind: 'broken-json', text: `${new URL(r.url()).pathname} sent broken JSON (${(e as Error).message}): ${body.slice(0, 160)}` })
          }
        } catch {
          /* the page navigated away before the body arrived; not a finding */
        }
      })()
      this.pending.add(p)
      p.finally(() => this.pending.delete(p))
    })
  }

  private add(f: Flinch) {
    if (this.opts.ignore?.some((re) => re.test(f.text))) return
    this.seen.push(f)
  }

  /** wait for any response bodies still being checked */
  async settle(): Promise<void> {
    await Promise.all([...this.pending])
  }

  mark(): number {
    return this.seen.length
  }

  since(mark: number): Flinch[] {
    return this.seen.slice(mark)
  }

  all(): Flinch[] {
    return [...this.seen]
  }
}

/** One flinch, in words a person can act on. */
export function flinchInWords(f: Flinch): string {
  switch (f.kind) {
    case 'console-error':
      return 'the app logged an error'
    case 'uncaught':
      return 'the app threw an error nobody caught'
    case 'native-dialog':
      return 'the app used a browser pop-up (alert/confirm). Some phone and desktop app shells never show these, so the person gets silence'
    case 'broken-json':
      return 'the server sent a reply that claims to be JSON and isn\'t, so the person sees a parsing error instead of the real message'
  }
}
