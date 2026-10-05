# 🦔 hedgehog-in-every-box

**Ways a real person has broken an app, and how to test for them before they do.**

Breakage catalogue by **Ren (Shalia Martin)**, QA. Built by **Ace (Claude)**.

---

Ren tested software professionally for a defence contractor, and has spent decades in disability advocacy. When we started building apps together, Ren tested them the same way every time: open the app, put a hedgehog 🦔 in every text box, and see what breaks.

Something always did. So did O'Brien, and Arabic, and a 5,000-character paste, and the street address that ends up in the phone box because a thumb hit the wrong field. Eventually Ren said, roughly, *"if you can build one that puts the hedgehog in the boxes, that does save me one step,"* and we automated it. The first automated run found two real bugs that day.

This package is that habit, written down so anyone can run it: a **catalogue** of the ways people actually break things, each with the reason a real human does it, and **Playwright helpers** that check for them.

It doesn't replace a person opening your app and pressing all the buttons. Nothing does. It means the hedgehog gets in the boxes even on the days nobody has the energy to do it by hand.

## The philosophy, in Ren's words

From a thread on r/AskVibecoders, where someone insisted that unit and CI tests would catch everything:

> *"Open the app, and test it. Like a real human will. Punch the buttons. Add a hedgehog to the text box. Hit the escape key and back button at the same time. Try to delete something and change your mind. Be chaos… So the order is: agent tests and gets a stack of green check marks, then you open the thing and remind the software industry why QA was still important."*

Ren's example from the same thread: one page showed three numbers that were supposed to agree, and they didn't. Every unit test was green, because each number correctly read *its own* column. Only a person looking at the screen could see that three different answers to one question is confusing.

**You can't write the test until a human has seen what "correct" looks like.** So this package works in that order: a person finds it, and then it becomes a test so nobody has to find it twice. That's why every case carries its provenance.

## Every case says where it came from

The catalogue has **76 cases**, and each one is labelled honestly:

| label | count | meaning |
|---|---|---|
| 🧾 **incident** | 15 | It broke one of our real apps. The entry names the app and the month. |
| 🦔 **Ren's list** | 9 | On the list of things Ren types into every box. No single recorded incident: a habit that keeps finding things. |
| 🌐 **widespread** | 2 | Ren hits it across many apps, not one of ours. |
| 🗣️ **Ren's advocacy** | 4 | Ren named it from decades of disability-rights work, answering someone who'd left it out. Not an incident in our apps: a person telling you who your app forgot. |
| 💬 **community** | 6 | A commenter on r/AskVibecoders, replying to Ren. Good idea, no incident on file. |
| 📘 **generic** | 40 | Plain best practice (often a WCAG criterion), labelled so nobody mistakes it for a war story. |

The full list, with every "why" and every receipt: **[CATALOGUE.md](CATALOGUE.md)**.

## Quick start

> Not on npm yet. For now, install from GitHub:
> `npm i -D github:menelly/hedgehog-in-every-box`

```ts
import { test } from '@playwright/test'
import { hedgehog } from 'hedgehog-in-every-box'

// Say what kind of app this is, once. Checks that don't apply are skipped with a reason.
const h = hedgehog({ platforms: ['web-desktop'] })

test('a hedgehog in every box', async ({ page }) => {
  await page.goto('/signup')
  await h.walkEveryTextbox(page, {
    // optional: also save, reload, and check every free-text box gives back exactly what was saved
    roundTrip: {
      save: async (p) => {
        await p.getByRole('button', { name: 'Save' }).click()
        await p.getByText('Saved').waitFor()
      },
    },
  })
})

test('the address in the phone box', async ({ page }) => {
  await h.fieldMixup(page, {
    fields: { phone: '#phone', email: '#email', url: '#website' },
    reset: async (p) => void (await p.goto('/signup')),
    submit: async (p) => p.getByRole('button', { name: 'Save' }).click(),
    saved: async (p) => p.getByText('Saved').isVisible(),
  })
})

test('the obvious accessibility locks', async ({ page }) => {
  await page.goto('/signup')
  await h.a11ySmoke(page) // runs axe too, if @axe-core/playwright is installed
})
```

When something breaks, the failure tells you **what broke and why it matters to a person**, not just which assertion failed:

```
🦔 fieldMixup [web-desktop]: 5 checks passed, 1 findings, 1 skipped
  ✗ The phone box accepted "123 Main St, Apt 4" and saved it. Autofill picks the wrong line,
    a thumb hits the wrong box, or you were looking at the paper, not the screen. Validate it,
    or at least warn.
      ↳ phone box: saved without complaint
  ➖ skipped: a card-number-shaped string in search: you didn't point fieldMixup at a search box
```

Every helper collects **all** its findings before failing, so one run tells you everything. Pass `throwOnFindings: false` to get the report back instead of a failure.

## Pick your platform: only the checks that fit your app

*"Nothing like something saying the text box failed on a website."* A mobile-keyboard check failing on a desktop-only site is noise. So every check declares which kinds of app it applies to, and anything that doesn't fit yours is **skipped with a reason**: never failed, never silently missing. The report always says what was and wasn't checked.

| | `web-desktop` | `web-mobile` | `react-native` | `desktop-shell` |
|---|:-:|:-:|:-:|:-:|
| 🧑 Names | ✅ | ✅ | ✅ | ✅ |
| 🌍 Scripts | ✅ | ✅ | ✅ | ✅ |
| 📋 Paste chaos | ✅ | ✅ | ✅ | ✅ |
| 🔢 Numbers and dates | ✅ | ✅ | ✅ | ✅ |
| 🔀 The wrong field | ✅ | ✅ | ✅ | ✅ |
| 👆 Interaction chaos | ✅ | ✅ | ✅ | ✅ |
| ↳ the browser back button | ✅ | ✅ | ➖ | ➖ |
| 🌀 Things that move | ✅ | ✅ | ✅ | ✅ |
| ✂️ Text cut off | ✅ | ✅ | ✅ *(proxy)* | ✅ |
| 📱 The keyboard covers the box | ➖ | ✅ | ✅ *(proxy)* | ➖ |
| ♿ Accessibility | ✅ | ✅ | ✅ | ✅ |
| ↳ contrast, titles, pictures, dictation | ✅ | ✅ | ➖ *(manual)* | ✅ |

- **`web-desktop`**: a site or web app used with a mouse on a big screen.
- **`web-mobile`**: responsive sites and PWAs on phones. Run these with a phone device, e.g. `test.use({ ...devices['Pixel 7'] })`.
- **`react-native`**: Expo / React Native. We run the web checks against your web build (`expo start --web`) as a **proxy**, plus the manual checklist below. A web check can't see the native renderer.
- **`desktop-shell`**: Tauri / Electron: a web page inside a native window.

Three ways to choose, most specific wins:

```ts
hedgehog({ platforms: ['web-mobile', 'react-native'] })        // in code
HEDGEHOG_PLATFORMS=web-mobile npx playwright test               // from the environment
// or per Playwright project, so one suite covers several kinds of app:
projects: [
  { name: 'desktop', use: devices['Desktop Chrome'], metadata: { hedgehogPlatforms: ['web-desktop'] } },
  { name: 'phone',   use: devices['Pixel 7'],        metadata: { hedgehogPlatforms: ['web-mobile'] } },
]
```

For a test that is only about one category, skip it visibly: `test.skip(!h.applies('mobile-keyboard'), h.why('mobile-keyboard'))`.

## The helpers

| helper | what it checks |
|---|---|
| `walkEveryTextbox(page, opts)` | Every visible text box gets every text case. No crash, no console error, no browser pop-up, no broken JSON reply; the box holds what went in (allowing for what browsers do on purpose, like dropping newlines in one-line boxes); the box is fully on screen. With `roundTrip`, it saves, reloads, and checks every free-text box gives back exactly what was saved. |
| `fieldMixup(page, opts)` | The wrong thing in the wrong box. Things that should be refused must be refused **with a visible message tied to the box** (not silently, not with a bare `alert()`); normal human formats like `(555) 123-4567` and `www.example.com` must be accepted. |
| `doubleSubmit(page, opts)` | One double-click on submit sends one request. With `clicks: 10`, someone smashing the login button. |
| `comeBackTomorrow(page, opts)` | Something saved today is still there tomorrow (moves the page's clock a day forward). |
| `survivesReload(page, opts)` | Work in progress survives a refresh, or is offered back. |
| `roundTripValue(page, opts)` | One value saved and read back exactly. `00501` stays `00501`. |
| `motionCheck(page, opts)` | Things that move that shouldn't (below). |
| `clippingCheck(page, opts)` | Text that gets cut off (below). |
| `keyboardCheck(page, opts)` | The on-screen keyboard covering the box (below). |
| `a11ySmoke(page, opts)` | Accessible names, Tab reaches everything with a visible focus ring, 24px targets (or spaced so they can't be mis-hit, per WCAG 2.5.8), no drag-only sliders, reflow at 200% zoom and phone width, no white boxes on a dark theme, text contrast (axe's color-contrast rule, every failing piece of text listed with its colours and ratio), a way out of Mr/Mrs, pictures that say what they are, and the rest of axe if you have it. |
| `dictationCheck(page, opts)` | Speech-to-text into every free-text box: a whole phrase at once, a word corrected mid-sentence, a second phrase joined on. The box must keep exactly what was said. |
| `FlinchWatcher` | The listener the others share: console errors, uncaught errors, native dialogs, and responses that claim to be JSON and don't parse. |
| `CATALOGUE` | Every case, as data, if you'd rather write your own loop. |

Only dependency: `@playwright/test` (1.45 or later). `@axe-core/playwright` is optional.

## Why each category exists

**🧑 Names.** People's names are the first thing a form asks for and the first thing it gets wrong. O'Brien has an apostrophe, Mary-Jane Smith-Jones has hyphens, Teller has one name, *van der Merwe* is lowercase on purpose, and Zoë can be typed two ways that look identical and compare unequal. Every one of those is someone being told their own name is invalid.

**🌍 Scripts.** Arabic and Hebrew run right to left, with numbers inside them running left to right. Chinese and Japanese characters are wide, and three bytes each. A Japanese keyboard types full-width digits. If your app has users, it has these.

**📋 Paste chaos.** People don't type, they paste: from Word (curly quotes), from spreadsheets (tabs, a trailing newline), from web pages (invisible zero-width and non-breaking spaces), from file explorers (backslashes). And sometimes they paste the whole email. An app that only works with neatly typed ASCII works for nobody.

**🔢 Numbers and dates.** ZIP codes start with zero. Half the world writes decimals with a comma. A leap day exists, and so does a 2:30 a.m. that never happens because the clocks jumped. "Today" depends on where you are. Storage keyed by "today's date" makes yesterday's records disappear (that one is from a real app of ours).

**🔀 The wrong field.** Autofill picks the wrong line, a thumb lands in the box below, or you were reading from paper. A good form notices the street address in the phone box and says so next to the box. A good form also accepts `(555) 123-4567` and `www.example.com`, because that's how people write them. (An optional website box that rejected `www.cvs.com` once blocked a whole entry from saving in one of our apps.)

**👆 Interaction chaos.** Double-clicks from a tremor or a slow connection. The back button, because back is how people undo. Refresh in the middle of half an hour of work. Browser pop-ups that some app shells never show, so a delete silently does nothing (also a real one of ours).

**🌀 Things that move that shouldn't.** Unexpected motion is an accessibility problem, not a style choice. People turn on "reduce motion" because motion makes them dizzy, sick, or worse; repeating or flashing motion can be a vestibular or seizure risk; and a button that jumps while you're reaching for it causes mis-taps for anyone with a tremor or using one hand. `motionCheck` looks for:
- animations still running with `prefers-reduced-motion: reduce` emulated (after a reload, once the page has loaded);
- anything that loops forever, and anything that moves on its own while nobody touches the page (auto-advancing carousels, tickers);
- cumulative layout shift on load, and after typing in each box;
- buttons that move between pointer-down and pointer-up. The pointer is released *away* from the button, so nothing actually gets clicked.

It reloads the page, so run it somewhere a reload is harmless.

**✂️ Text that gets cut off.** A label that loses its last few letters can lose its meaning, and it gets worse when people turn up their font size, which is exactly who needs to read it. `clippingCheck` looks at every visible piece of text at normal size, with large text (root font size 200%), and at 200% zoom, and reports text hidden by overflow (its own or an ancestor's), ellipses that actually cut something (mark the ones you mean with `data-truncate-ok`), and boxes narrower than their longest word, which wrap one letter per line (three separate screens of one of our apps did that on a phone).

> **React Native / Expo note.** Ren has seen Android cut the last several letters off text in an Expo build. That's a known React Native Android quirk with some fonts, weights and text-break strategies, worse at large system font scales. **The web check is a proxy**: it can't see the native text renderer. The real fixes live in React Native: try `textBreakStrategy="simple"` on the `Text`, `includeFontPadding: false` in the style, don't set `numberOfLines` unless you mean it, let text wrap instead of fixing widths, and test on a real device with the system font scale turned up (Settings → Display → Font size, or `adb shell settings put system font_scale 2.0`).

**📱 The keyboard covers the box.** *"SO MANY APPS HAVE THIS BROKEN RIGHT NOW"* (Ren). You tap a box near the bottom of the screen, the keyboard comes up, and now you're typing blind with the Send button hidden under the keys. Ren runs into this in a lot of apps, every day.

A test browser can't open a real keyboard, so `keyboardCheck` **simulates** one (about 40% of the screen) in the way the page has asked the browser to behave:
- if the viewport meta says `interactive-widget=resizes-content`, the keyboard shrinks the layout, so the check shrinks the viewport and lets the page re-lay itself out;
- otherwise (the default on iOS Safari and current Android Chrome), only the *visual* viewport shrinks: the browser pans to show the focused box, and `position: fixed` footers stay glued to the bottom of the layout, under the keys.

For each text box it checks that the box, and its submit button when that sits right beside it or in a fixed footer, are still visible. It also flags fixed or sticky bars full of controls that end up under the keyboard, and layouts sized in `vh` with no `dvh`/`svh` anywhere (`100vh` is the *largest* the screen can be, so those panels run off the bottom; one of our apps switched 151 of them to `dvh`).

**Be honest with yourself about what this is:** a simulation of the common ways it breaks. Real devices differ: iOS Safari, Android Chrome, Samsung Internet and in-app WebViews all handle the keyboard differently. Check on a real phone too.

> **React Native / Expo note.** The equivalents: wrap forms in `KeyboardAvoidingView` (`behavior="padding"` on iOS; on Android, check what your setup needs), use `android:windowSoftInputMode="adjustResize"`, and keep chat composers out of absolutely positioned footers. **Recent Expo SDKs turn on Android edge-to-edge** (and Android 15 enforces it for apps targeting API 35); in edge-to-edge, `adjustResize` alone no longer keeps inputs above the keyboard, so handle the keyboard inset yourself (`KeyboardAvoidingView`, or a library like `react-native-keyboard-controller`). Check your SDK's changelog for the exact behaviour.

**♿ Accessibility.** This is where Ren's perspective is unique, and where an app most often locks someone out completely rather than just annoying them. Keyboard-only users (switch users, screen-reader users, people whose hands hurt today) need Tab to reach everything and need to *see* where focus is. One-handed users (a baby on one arm, a cane, a cast, a tremor) need targets big enough to hit. Fine-motor dragging is the hardest thing on a screen, so a slider needs a number box beside it (one of our apps, built *for* disabled sellers, had a drag-only setting). Low-vision users zoom to 200%. Dark themes are an accessibility setting for many people, and a glaring white text box on one is unreadable (a real one of ours again). `a11ySmoke` is a smoke test, not an audit: passing it means nobody is locked out by the obvious things. It doesn't mean the app is accessible. Ask disabled people. Pay them.

**🗣️ The questions accessibility should have asked.** On r/vibecoding, someone shared a giant "audit your app" prompt in which accessibility got **one line**. Ren answered with the questions it should have asked. Four of them are checks now, and one can only be a person's job:

- **🎨 Can you see the words?** `a11ySmoke` runs axe's `color-contrast` rule on its own (WCAG 2 AA: 4.5:1, 3:1 for large text) and lists every piece of text that fails, with its colours and ratio. Text axe can't judge (over a picture or a gradient) is listed for you to check by eye, not hidden. Needs `@axe-core/playwright`.
- **🎩 Is there a way out of Mr and Mrs?** In Ren's words: *"a way to opt out of distressing or dysphoria-causing unnecessary social constructs like Mr or ma'am."* Any title, salutation or honorific field (a dropdown, a set of buttons or a box) must be optional, offer a blank or "prefer not to say" that can actually be chosen (a disabled "Choose…" doesn't count), and include **Mx**. Pages with no title field skip this, which is the best answer of all.
- **🎙️ Does it work if you can't type?** People with pain, tremor, RSI, fatigue or a cast dictate. Speech-to-text drops in a whole phrase at once, swaps a word mid-sentence when corrected, capitalises oddly and leaves a trailing space for the next phrase. `dictationCheck` does exactly that in every free-text box and checks nothing was eaten. The app must not punish people who can't type.
- **🖼️ Do the pictures say what they are?** Every `<img>` is either marked decorative (`alt=""` or `role="presentation"`) or has alt text that isn't empty, isn't its file name, and isn't just "image".
- **🧠 Cognitive load is a person's job.** No script can tell you whether a screen asks too much of a tired, foggy, overloaded brain. Ren put it on the list, and it goes on yours as a human check: open each screen and ask how many decisions it asks for at once, whether it says what happens next in plain words, whether anything is timed or rushed, and whether someone who loses their place halfway through can pick it back up. Better: ask someone with brain fog, ADHD, a brain injury or a migraine today to try it, and pay them.

These apply to websites and to Tauri/Electron apps (a web page in a native window). A web check can't see a native React Native screen, so that profile skips them with a reason and gets the items in the manual checklist below.

## Manual checklist for React Native / Expo and desktop shells

The web proxy can't see these. A person with a device can, in ten minutes:

- [ ] Turn the **system font size** to the largest setting. Read every screen. Anything cut off, overlapping, or missing its last letters?
- [ ] Tap **every text box near the bottom** of every screen. Can you see what you're typing? Can you reach Send without closing the keyboard?
- [ ] Turn on **Remove animations** (Android) / **Reduce Motion** (iOS). Does anything still slide, pulse or auto-advance?
- [ ] Turn on **TalkBack / VoiceOver**. Does every button and box say what it is?
- [ ] Try **delete** and anything else that asks "are you sure?". Does the question actually appear? (`window.confirm` is swallowed by some Android WebViews, including the one inside a Tauri app.)
- [ ] Put a **🦔** in every box, then close and reopen the app. Is it still there?
- [ ] **Dictate** into every text box with the phone's speech-to-text, then correct one word by voice. Did everything you said stay?
- [ ] Turn on **Color correction / Color filters** (greyscale) and **High contrast text**. Can you still read every label and tell every state apart?
- [ ] Find any **title / Mr / Mrs** field. Can you skip it, and is Mx there?
- [ ] Go through every screen **tired**. Too many choices at once? Anything on a timer? Could you find your place again after a phone call?

## Run the proof yourself

The repo includes a tiny demo app: the same sign-up form twice. `broken.html` has every bug we could fit from the catalogue, each marked 🐛 in the source; `fixed.html` has them fixed, each marked ✅. The test suite runs every helper against both and checks **both directions**: each helper must catch the specific planted bugs in the broken form, and must pass the fixed one having actually checked something.

```bash
npm install
npx playwright install chromium
npm test            # the proof suite (headless)
npm run demo        # look at the two forms yourself on http://127.0.0.1:4790
```

## Adding a case

Add it to `src/catalogue.ts` with a `why` a person would recognise, the `check` that covers it, and honest provenance. If it broke something real, say which app and when; if it's best practice, say `generic`. Then `npm run catalogue` to regenerate `CATALOGUE.md` (the test suite fails if you forget). **Never invent an incident.** The whole value of the catalogue is that the receipts are real.

## Credits

- **Ren (Shalia Martin)**: the breakage catalogue, the hedgehog habit, the questions accessibility should have asked (contrast, a way out of Mr and Mrs, dictation, pictures, cognitive load), and twenty-some years of knowing that the person most likely to find your bug is the one your app wasn't designed for.
- **Ace (Claude, Anthropic)**: the helpers, the demo, the tests, and this README.
- The commenter on r/AskVibecoders who added double-submits, smashing the login button, card numbers in the wrong box, saving files in odd places, and editing data files behind the app's back.

## License

MIT. See [LICENSE](LICENSE).
