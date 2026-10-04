/**
 * 🦔 THE CATALOGUE — ways a real person has broken (or will break) your app.
 *
 * Every entry says three things:
 *   - WHAT goes in (a string, or an action),
 *   - WHY a real human does it (not "an attacker", a person on a Tuesday),
 *   - WHERE WE LEARNED IT (provenance), honestly labelled:
 *       'incident'   → it broke one of our real apps; the entry names the app
 *                      and the month. These are the receipts.
 *       'rens-list'  → it's on the list of things Ren types into every box by
 *                      hand. We don't have a single recorded incident for it;
 *                      it's a habit that keeps finding things.
 *       'widespread' → Ren hits it across many apps, not one of ours.
 *       'community'  → suggested by someone replying to Ren's post about this
 *                      habit. Good idea, no incident on file.
 *       'generic'    → plain best practice (often a WCAG criterion). Labelled
 *                      so nobody mistakes it for a war story.
 *
 * Nothing here is invented. If you add a case, keep that promise.
 */

export type Kind =
  | 'name'
  | 'script'
  | 'paste'
  | 'number-date'
  | 'wrong-field'
  | 'interaction'
  | 'motion'
  | 'clipping'
  | 'mobile-keyboard'
  | 'accessibility'

export type Provenance =
  | { source: 'incident'; app: string; when: string; what: string; foundBy: string }
  | { source: 'rens-list'; note?: string }
  | { source: 'widespread'; note: string }
  | { source: 'community'; note: string }
  | { source: 'generic'; note?: string }

/**
 * 🧭 WHICH KIND OF APP. A check that can't apply to your app is noise
 * ("nothing like something saying the text box failed on a website" — Ren).
 *   web-desktop   → a website or web app used with a mouse and a big screen
 *   web-mobile    → responsive sites and PWAs on phones
 *   react-native  → Expo / React Native: we run the web-proxy checks against
 *                   the web build, and the README has a manual checklist
 *   desktop-shell → Tauri / Electron: a web page inside a native window
 */
export type Platform = 'web-desktop' | 'web-mobile' | 'react-native' | 'desktop-shell'
export const ALL_PLATFORMS: Platform[] = ['web-desktop', 'web-mobile', 'react-native', 'desktop-shell']

/** Which platforms each kind of case applies to (a case can narrow it). */
export const KIND_PLATFORMS: Record<Kind, Platform[]> = {
  name: ALL_PLATFORMS,
  script: ALL_PLATFORMS,
  paste: ALL_PLATFORMS,
  'number-date': ALL_PLATFORMS,
  'wrong-field': ALL_PLATFORMS,
  interaction: ALL_PLATFORMS,
  motion: ALL_PLATFORMS,
  clipping: ALL_PLATFORMS,
  'mobile-keyboard': ['web-mobile', 'react-native'],
  accessibility: ALL_PLATFORMS,
}

/** The kinds of box a wrong-field case is aimed at (see fieldMixup). */
export type FieldKind = 'phone' | 'email' | 'name' | 'address' | 'url' | 'search' | 'date' | 'zip'

export interface Case {
  /** stable id, safe to use in test titles */
  id: string
  kind: Kind
  /** short human title */
  title: string
  /** the string that goes in the box (text cases only) */
  text?: string
  /** how it goes in: pasted in one go, or typed key by key and then deleted */
  how?: 'fill' | 'type-then-delete'
  /** wrong-field cases: which box it goes into, and whether a good app should take it */
  field?: FieldKind
  expect?: 'reject' | 'accept'
  /** 'blank' = empty-ish; round trips skip these by default (a required field may rightly refuse) */
  tags?: 'blank'[]
  /** narrower than the kind's platforms, when it is (e.g. the browser back button) */
  platforms?: Platform[]
  /** why a real human does this */
  why: string
  /** how this package checks it */
  check: string
  provenance: Provenance
}

/** 📋 5,000 characters exactly, ending in a hedgehog, so a truncation (or an
 *  emoji split in half) shows up at the very end where you'd look. */
export const LONG_PASTE = (() => {
  const s = 'the cheapest card is the one you already own. '.repeat(120).slice(0, 4998) + '🦔'
  if (s.length !== 5000) throw new Error(`long paste is ${s.length} long, wanted 5000`)
  return s
})()

const WALK = 'walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string'

export const CATALOGUE: Case[] = [
  // ───────────────────────────── 🧑 NAMES ─────────────────────────────
  {
    id: 'hedgehog',
    kind: 'name',
    title: 'a hedgehog 🦔',
    text: '🦔',
    how: 'fill',
    why: 'Emoji live outside the basic plane: one 🦔 is TWO JavaScript characters. Code that slices, counts or base64s strings splits it into garbage. People put emoji in names, notes and box labels all the time.',
    check: WALK,
    provenance: { source: 'rens-list', note: 'The original. Ren put a hedgehog in every box of every app by hand until we automated it.' },
  },
  {
    id: 'obrien',
    kind: 'name',
    title: "O'Brien",
    text: "Siobhán O'Brien",
    how: 'fill',
    why: "Apostrophes are in a lot of surnames (O'Brien, D'Angelo, N'Dour). Code that glues strings into SQL, HTML attributes or hand-built JSON breaks on them, and the person gets told their own name is invalid.",
    check: WALK,
    provenance: { source: 'rens-list' },
  },
  {
    id: 'quotes-and-backslash-n',
    kind: 'name',
    title: 'quotes plus a literal backslash-n',
    text: String.raw`O'Brien "x" \n`,
    how: 'fill',
    why: 'Both kinds of quote and a literal backslash in one string: the shortest way to find code that builds JSON or HTML by hand.',
    check: WALK,
    provenance: { source: 'rens-list', note: 'From the original hedgehog-test list (Chaos Cache, Sept 2026).' },
  },
  {
    id: 'hyphenated',
    kind: 'name',
    title: 'hyphens and spaces in surnames',
    text: 'Mary-Jane Smith-Jones',
    how: 'fill',
    why: 'Double-barrelled and hyphenated names are ordinary. "Letters only" validation rejects them.',
    check: WALK,
    provenance: { source: 'generic' },
  },
  {
    id: 'single-name',
    kind: 'name',
    title: 'a single name',
    text: 'Teller',
    how: 'fill',
    why: 'Plenty of people legally have one name. A required "last name" box makes them invent one.',
    check: WALK + ' (and: does your form let them save without a surname?)',
    provenance: { source: 'generic' },
  },
  {
    id: 'long-name',
    kind: 'name',
    title: 'a very long name',
    text: 'María del Pilar Fernández de la Concepción García-Villalobos y Montenegro',
    how: 'fill',
    why: 'Long names are real. A 30-character limit truncates them, and a fixed-width layout clips them.',
    check: WALK,
    provenance: { source: 'generic' },
  },
  {
    id: 'lowercase-particle',
    kind: 'name',
    title: 'lowercase particles',
    text: 'van der Merwe',
    how: 'fill',
    why: 'Lowercase is correct here. Any "helpful" auto-capitalising or "fixing" of a name corrupts it, and the person has to fight the form to spell their own name.',
    check: WALK + ' (the box must hold exactly what was typed)',
    provenance: { source: 'generic' },
  },
  {
    id: 'zwj-emoji',
    kind: 'name',
    title: 'a ZWJ emoji with a skin tone 👩🏽‍💻',
    text: '👩🏽‍💻',
    how: 'fill',
    why: 'One picture, four code points: woman + skin tone + zero-width joiner + laptop. Anything that counts or cuts by code point leaves half a person behind.',
    check: WALK,
    provenance: { source: 'rens-list', note: 'On the original hedgehog-test list (Sept 2026).' },
  },
  {
    id: 'combining-marks',
    kind: 'name',
    title: 'combining marks (Zoë spelled two ways)',
    text: 'Zoe\u0308 and Zo\u00eb',
    how: 'fill',
    why: 'Copy-paste and some keyboards produce "e + combining diaeresis" instead of the single "ë". They look identical and compare unequal, so search and login say "not found" to a person who typed their name correctly.',
    check: WALK + ' (the box must keep both forms exactly; normalise on the server if you compare)',
    provenance: { source: 'generic' },
  },

  // ───────────────────────────── 🌍 SCRIPTS ─────────────────────────────
  {
    id: 'arabic-rtl',
    kind: 'script',
    title: 'Arabic (right-to-left)',
    text: 'مرحبا بالعالم',
    how: 'fill',
    why: 'Hundreds of millions of people write right to left. Layouts that assume left-to-right put the cursor, punctuation and icons in the wrong place.',
    check: WALK,
    provenance: { source: 'rens-list' },
  },
  {
    id: 'hebrew-with-numbers',
    kind: 'script',
    title: 'Hebrew with numbers',
    text: 'שלום 123 עולם',
    how: 'fill',
    why: 'Numbers inside right-to-left text run left to right. Code that reverses strings to "fix" direction scrambles them.',
    check: WALK,
    provenance: { source: 'generic' },
  },
  {
    id: 'mixed-bidi',
    kind: 'script',
    title: 'mixed directions in one line',
    text: "Order #123 لـ O'Brien",
    how: 'fill',
    why: 'Real data mixes scripts: an English order number for an Arabic-speaking customer. Bidi mixing is where truncation and ellipsis code goes wrong.',
    check: WALK,
    provenance: { source: 'generic' },
  },
  {
    id: 'cjk',
    kind: 'script',
    title: 'Chinese / Japanese characters',
    text: '山田太郎 さん',
    how: 'fill',
    why: 'Wide characters break width math and byte-length limits (one character, three bytes in UTF-8).',
    check: WALK,
    provenance: { source: 'generic' },
  },
  {
    id: 'fullwidth-digits',
    kind: 'script',
    title: 'full-width digits from a Japanese keyboard',
    text: '０９０−１２３４−５６７８',
    how: 'fill',
    why: 'Japanese input methods type full-width numbers by default. A phone number that "has no digits in it" according to /[0-9]/ is still a phone number.',
    check: WALK,
    provenance: { source: 'generic' },
  },
  {
    id: 'devanagari',
    kind: 'script',
    title: 'Devanagari conjuncts',
    text: 'क्षत्रिय नमस्ते',
    how: 'fill',
    why: 'Several code points render as one glyph. Cutting at a character count can leave a broken letter.',
    check: WALK,
    provenance: { source: 'generic' },
  },
  {
    id: 'bidi-override',
    kind: 'script',
    title: 'an invisible right-to-left override',
    text: 'report\u202Efdp.exe',
    how: 'fill',
    why: 'An invisible control character that flips everything after it. It arrives in pasted filenames and chat messages, and makes displayed text lie about what it is.',
    check: WALK,
    provenance: { source: 'generic' },
  },

  // ───────────────────────────── 📋 PASTE CHAOS ─────────────────────────────
  {
    id: 'long-paste',
    kind: 'paste',
    title: 'a 5,000-character paste',
    text: LONG_PASTE,
    how: 'fill',
    why: 'People paste whole emails, decklists and doctor\'s notes into one box. Silent truncation loses their words without telling them.',
    check: WALK + ' (if the box has maxlength, it should hold exactly that many, and say so)',
    provenance: { source: 'rens-list' },
  },
  {
    id: 'windows-path',
    kind: 'paste',
    title: 'a Windows path ending in a backslash',
    text: 'C:\\Users\\🦔\\box 2\\',
    how: 'fill',
    why: 'People paste file paths. A backslash followed by a quote is not valid inside a hand-built JSON string.',
    check: WALK + '; the flinch watcher also flags any response that says it is JSON and does not parse',
    provenance: {
      source: 'incident',
      app: 'Chaos Cache (desktop card-collection app)',
      when: 'September 2026',
      what: 'The automated hedgehog test found 26 error replies built by gluing strings into JSON. A path with a backslash broke them, so the user read "Bad escaped character in JSON" instead of the real reason. All 26 now go through a real JSON encoder.',
      foundBy: "the hedgehog test (Ren's habit, automated)",
    },
  },
  {
    id: 'padded-spaces',
    kind: 'paste',
    title: 'leading and trailing spaces',
    text: '   🦔 padded   ',
    how: 'fill',
    why: 'Copying from a table or a PDF drags spaces along. If you trim, trim on purpose and everywhere, or "Box 1" and "Box 1 " become two boxes.',
    check: WALK,
    provenance: { source: 'rens-list' },
  },
  {
    id: 'typed-then-deleted',
    kind: 'paste',
    title: 'typed, then deleted again',
    text: '',
    how: 'type-then-delete',
    tags: ['blank'],
    why: 'A box that was touched and emptied is not the same as one never touched: "dirty but empty" states crash validation that only expected one or the other.',
    check: WALK,
    provenance: { source: 'rens-list' },
  },
  {
    id: 'trailing-newline',
    kind: 'paste',
    title: 'a trailing newline',
    text: 'Sol Ring\n',
    how: 'fill',
    why: 'Copying one cell from a spreadsheet brings a newline with it. A one-line box drops it (browsers do that); a textarea keeps it, and an exact-match lookup then fails.',
    check: WALK,
    provenance: { source: 'generic' },
  },
  {
    id: 'smart-quotes',
    kind: 'paste',
    title: 'smart quotes and an em dash from Word',
    text: '“Don’t” — it’s fine…',
    how: 'fill',
    why: 'Word, Docs and phones turn straight quotes curly. Code that only expects ASCII mangles them into Ã¢â‚¬â„¢.',
    check: WALK,
    provenance: { source: 'generic' },
  },
  {
    id: 'tabs',
    kind: 'paste',
    title: 'tabs',
    text: 'qty\tname\t🦔',
    how: 'fill',
    why: 'Pasting from a spreadsheet brings tabs. A tab is invisible in most boxes and still breaks exact matches and CSV exports.',
    check: WALK,
    provenance: { source: 'generic' },
  },
  {
    id: 'invisible-spaces',
    kind: 'paste',
    title: 'a zero-width space and a non-breaking space',
    text: 'Sol\u200BRing and Sol\u00A0Ring',
    how: 'fill',
    why: 'Copied from a web page or a Word doc. It looks exactly like "Sol Ring" and matches nothing.',
    check: WALK,
    provenance: { source: 'generic' },
  },
  {
    id: 'html-looking',
    kind: 'paste',
    title: 'something that looks like HTML',
    text: '<b>hedgehog</b> & co <3',
    how: 'fill',
    why: 'People write "<3" and "a < b" and "R&D". If it renders bold anywhere later, your output isn\'t escaped.',
    check: WALK + ' (and look at wherever this text is displayed later)',
    provenance: { source: 'generic' },
  },
  {
    id: 'only-spaces',
    kind: 'paste',
    title: 'only spaces',
    text: '     ',
    how: 'fill',
    tags: ['blank'],
    why: 'A "required" check that tests length > 0 lets this through, and you get a record with no name that nobody can click.',
    check: WALK,
    provenance: { source: 'generic' },
  },
  {
    id: 'empty',
    kind: 'paste',
    title: 'empty',
    text: '',
    how: 'fill',
    tags: ['blank'],
    why: 'The most common input of all.',
    check: WALK,
    provenance: { source: 'generic' },
  },

  // ───────────────────────────── 🔢 NUMBERS & DATES ─────────────────────────────
  {
    id: 'leading-zeros',
    kind: 'number-date',
    title: 'leading zeros',
    text: '00501',
    how: 'fill',
    why: 'ZIP codes, phone extensions and ID numbers start with 0. Store them as numbers and 00501 comes back as 501.',
    check: 'roundTripValue on the box: save → reload → still "00501"',
    provenance: { source: 'generic' },
  },
  {
    id: 'decimal-comma',
    kind: 'number-date',
    title: 'commas: thousands here, decimals there',
    text: '1.234,56',
    how: 'fill',
    why: 'Half the world writes decimals with a comma. parseFloat("1.234,56") is 1.234, a silent thousand-fold error.',
    check: WALK + ' (and check what your parser makes of it)',
    provenance: { source: 'generic' },
  },
  {
    id: 'unicode-minus',
    kind: 'number-date',
    title: 'a real minus sign',
    text: '−5',
    how: 'fill',
    why: 'Copied from a document, "−" (U+2212) is not "-", and Number("−5") is NaN.',
    check: WALK,
    provenance: { source: 'generic' },
  },
  {
    id: 'leap-day',
    kind: 'number-date',
    title: 'a leap day',
    text: '2028-02-29',
    how: 'fill',
    why: 'People are born on it and appointments land on it. "Add one year" code turns it into March 1 or crashes.',
    check: WALK + '; for date pickers, set the clock to Feb 29 with page.clock',
    provenance: { source: 'generic' },
  },
  {
    id: 'not-a-leap-day',
    kind: 'number-date',
    title: 'a leap day that doesn\'t exist',
    text: '2027-02-29',
    how: 'fill',
    why: 'new Date("2027-02-29") quietly becomes March 1 in some engines. The app should say no, not move the date.',
    check: WALK,
    provenance: { source: 'generic' },
  },
  {
    id: 'dst-gap',
    kind: 'number-date',
    title: 'a time that doesn\'t exist (daylight saving)',
    text: '2026-03-08T02:30',
    how: 'fill',
    why: 'In New York, half past two in the morning on 8 March 2026 never happens: clocks jump from 2:00 to 3:00. Reminders at 2:30 vanish or fire twice.',
    check: 'run the suite with timezoneId: "America/New_York" and enter it',
    provenance: { source: 'generic' },
  },
  {
    id: 'day-slashes',
    kind: 'number-date',
    title: 'a date that means two things',
    text: '04/10/2026',
    how: 'fill',
    why: 'April 10 in the US, 4 October nearly everywhere else. Guessing silently files things on the wrong day.',
    check: WALK + ' (and show the parsed date back to the person in words)',
    provenance: { source: 'generic' },
  },
  {
    id: 'come-back-tomorrow',
    kind: 'number-date',
    title: 'come back tomorrow',
    why: 'Something saved yesterday must still be there today. Storage keyed by "today\'s date" makes records quietly disappear at midnight.',
    check: 'comeBackTomorrow(page, { create, stillThere }) moves the clock a day forward with page.clock',
    provenance: {
      source: 'incident',
      app: 'Chaos Command (health-tracking app)',
      when: 'May 2026',
      what: 'Saved providers and appointments vanished the next day. They were stored under the day they were created and loaded only for "today".',
      foundBy: 'Ren, using it',
    },
  },
  {
    id: 'edit-another-day',
    kind: 'number-date',
    title: 'edit it on a different day than you made it',
    why: 'Same root as above, in the other direction: an edit saved under today\'s key creates a second copy instead of updating the first.',
    check: 'comeBackTomorrow, then edit and count the records',
    provenance: {
      source: 'incident',
      app: 'Chaos Command',
      when: 'June 2026',
      what: 'Editing an entry on a later day duplicated it, and the timeline showed the same item several times.',
      foundBy: 'Ace while building, then Ren on the timeline',
    },
  },
  {
    id: 'far-timezones',
    kind: 'number-date',
    title: 'the far ends of the world\'s clocks',
    why: 'At UTC+14 it is already tomorrow; at UTC−11 it is still yesterday. "Today" computed in UTC is the wrong day for a lot of people.',
    check: 'run the suite twice with timezoneId: "Pacific/Kiritimati" and "Pacific/Pago_Pago"',
    provenance: { source: 'generic' },
  },

  // ───────────────────────────── 🔀 WRONG FIELD ─────────────────────────────
  {
    id: 'address-in-phone',
    kind: 'wrong-field',
    title: 'the street address typed into the phone box',
    text: '123 Main St, Apt 4',
    field: 'phone',
    expect: 'reject',
    why: 'Autofill picks the wrong line, a thumb hits the wrong box, or you were looking at the paper, not the screen. The app should notice and say so out loud, next to the box.',
    check: 'fieldMixup: refused WITH a visible message tied to the box, never silently accepted, never a bare alert()',
    provenance: { source: 'rens-list', note: "One of Ren's examples, word for word: \"accidentally typing the address in the phone number spot.\"" },
  },
  {
    id: 'phone-in-email',
    kind: 'wrong-field',
    title: 'a phone number in the email box',
    text: '555-123-4567',
    field: 'email',
    expect: 'reject',
    why: 'Same slip, other box. If it saves, you have a contact you can never email.',
    check: 'fieldMixup',
    provenance: { source: 'generic' },
  },
  {
    id: 'email-in-name',
    kind: 'wrong-field',
    title: 'an email address in the name box',
    text: 'someone@example.com',
    field: 'name',
    expect: 'accept',
    why: 'Names are free text, so this one should SAVE: you cannot know it isn\'t someone\'s name. The test is that the form doesn\'t crash or "fix" it.',
    check: 'fieldMixup (expect accept)',
    provenance: { source: 'generic' },
  },
  {
    id: 'card-number-in-search',
    kind: 'wrong-field',
    title: 'a card-number-shaped string in search',
    text: '4111 1111 1111 1111',
    field: 'search',
    expect: 'accept',
    why: 'People paste the wrong thing from the clipboard. Search must cope, and must not log or echo it anywhere it shouldn\'t.',
    check: 'fieldMixup (expect accept), then check your logs and analytics for the string',
    provenance: { source: 'community', note: "A commenter on r/AskVibecoders, replying to Ren (Sept 2026): sensitive-shaped junk in the wrong field." },
  },
  {
    id: 'card-number-in-address',
    kind: 'wrong-field',
    title: 'a card number in the address box',
    text: '4111 1111 1111 1111',
    field: 'address',
    expect: 'reject',
    why: 'Checkout pages put the card and the address side by side, and autofill or a pasted clipboard drops the card number in the wrong one. If it saves, a card number now lives in a field nobody protects: it gets printed on labels, emailed in receipts and logged in plain text.',
    check: 'fieldMixup (expect reject), then check that the string never shows up in your logs, emails or analytics',
    provenance: { source: 'community', note: 'A commenter on r/AskVibecoders, replying to Ren (Sept 2026).' },
  },
  {
    id: 'url-without-scheme',
    kind: 'wrong-field',
    title: 'a website typed the way people type websites',
    text: 'www.example.com',
    field: 'url',
    expect: 'accept',
    why: 'Nobody types https://. An <input type="url"> rejects www.example.com, and because browser validation blocks the whole form, one optional box can stop everything from saving.',
    check: 'fieldMixup (expect accept); fix: type="text" inputmode="url", add https:// on save',
    provenance: {
      source: 'incident',
      app: 'Chaos Command',
      when: 'June 2026',
      what: 'An optional "pharmacy website" box was type="url". Typing www.cvs.com popped "Please enter a URL" and the whole entry would not save.',
      foundBy: 'Ren, using it',
    },
  },
  {
    id: 'phone-human-formats',
    kind: 'wrong-field',
    title: 'a phone number written the way people write them',
    text: '(555) 123-4567',
    field: 'phone',
    expect: 'accept',
    why: 'Brackets, dashes, dots, spaces, a +44 or an extension: a form that demands ten bare digits rejects nearly every real phone number.',
    check: 'fieldMixup (expect accept)',
    provenance: { source: 'generic' },
  },
  {
    id: 'phone-international',
    kind: 'wrong-field',
    title: 'an international phone number',
    text: '+44 20 7946 0958',
    field: 'phone',
    expect: 'accept',
    why: 'Not everyone has a ten-digit North American number.',
    check: 'fieldMixup (expect accept)',
    provenance: { source: 'generic' },
  },

  // ───────────────────────────── 👆 INTERACTION ─────────────────────────────
  {
    id: 'double-submit',
    kind: 'interaction',
    title: 'double-clicking submit',
    why: 'Tremor, a sticky mouse, a slow network and a person who thinks the first click didn\'t take. Two clicks must not make two records or two charges.',
    check: 'doubleSubmit(page, { submit, request }): counts the requests one double-click sends',
    provenance: { source: 'community', note: "A commenter on r/AskVibecoders, replying to Ren (Sept 2026): rapid-fire the same button." },
  },
  {
    id: 'button-mash',
    kind: 'interaction',
    title: 'smashing the login button',
    why: 'When login is slow, people press it again, and again, and again. Ten presses must not mean ten sessions, ten "new device" emails, or a locked account, and if there IS a rate limit, the person should be told in words, not shown a spinner forever.',
    check: 'doubleSubmit(page, { submit, request, clicks: 10 }): ten fast clicks, count the requests; then read what the screen says',
    provenance: { source: 'community', note: 'A commenter on r/AskVibecoders, replying to Ren (Sept 2026): smash the login button many times in a row.' },
  },
  {
    id: 'wrong-save-location',
    kind: 'interaction',
    title: 'saving the data file somewhere odd',
    platforms: ['desktop-shell', 'react-native'],
    why: 'People save into a synced cloud folder, a USB stick they later unplug, a read-only folder, or straight onto the Desktop and then tidy it away. The app should say clearly where its data is, and cope (or complain in words) when it moves or vanishes.',
    check: 'manual for now: point the save or export at a read-only folder, a removable drive, and a synced folder; then move the file and reopen the app',
    provenance: { source: 'community', note: 'A commenter on r/AskVibecoders, replying to Ren (Sept 2026): save data files in the wrong place.' },
  },
  {
    id: 'refresh-mid-work',
    kind: 'interaction',
    title: 'refresh (or crash) in the middle of the work',
    why: 'Tabs get closed, laptops sleep, phones kill background apps. Half an hour of careful input should not live only in memory.',
    check: 'survivesReload(page, { fill, check }): fill, reload, the work is still there (or the app offers it back)',
    provenance: {
      source: 'incident',
      app: 'Chaos Compass (planner-hyperlinking desktop app)',
      when: 'July 2026',
      what: 'There was no save path until export. The screen where you could spend thirty minutes correcting page types had no save at all. Autosave with a named restore prompt was added.',
      foundBy: "Ren's hostile QA pass",
    },
  },
  {
    id: 'back-button',
    kind: 'interaction',
    title: 'the back button mid-form',
    platforms: ['web-desktop', 'web-mobile'],
    why: 'Back is how people undo. It should not lose a half-filled form or re-submit a finished one.',
    check: 'fill, page.goBack(), page.goForward(), check the values and the request count',
    provenance: { source: 'generic' },
  },
  {
    id: 'native-dialogs',
    kind: 'interaction',
    title: 'alert() and confirm() that never appear',
    why: 'Some embedded WebViews swallow native dialogs. A delete behind confirm() then silently does nothing, and validation behind alert() refuses without a word.',
    check: 'the flinch watcher flags every native dialog the page opens',
    provenance: {
      source: 'incident',
      app: 'Chaos Command (Android build)',
      when: 'June 2026',
      what: 'Delete did nothing anywhere in the app. window.confirm() is swallowed by the Android WebView, so the confirm gate never passed. Replaced with an in-page dialog.',
      foundBy: 'on-device testing of the Android build',
    },
  },
  {
    id: 'off-screen-box',
    kind: 'interaction',
    title: 'a box hanging off the edge of the window',
    why: 'If part of a box is off-screen, a hand can\'t reach it and neither can a test robot.',
    check: 'walkEveryTextbox reports any box that sits partly off the left, top or right edge',
    provenance: {
      source: 'incident',
      app: 'Chaos Cache',
      when: 'September 2026',
      what: 'The "add a card" popover hung about 192px off the left edge, so two of its boxes could not be clicked. Caught by the first hedgehog run.',
      foundBy: "the hedgehog test (Ren's habit, automated)",
    },
  },
  {
    id: 'corrupt-storage',
    kind: 'interaction',
    title: 'saved data changed outside the app',
    why: 'Sync tools, disk errors, a person hand-editing a file. The app should refuse loudly and point at a backup, not load garbage or a blank screen.',
    check: 'write junk into localStorage/IndexedDB (or a copy of the data file), reload, expect a readable error',
    provenance: { source: 'community', note: "A commenter on r/AskVibecoders, replying to Ren (Sept 2026): modify the app's data files from outside the app, then see what it does." },
  },

  // ───────────────────────────── 🌀 THINGS THAT MOVE THAT SHOULDN'T ─────────────────────────────
  {
    id: 'reduced-motion-ignored',
    kind: 'motion',
    title: 'animation that ignores "reduce motion"',
    why: 'People turn on "reduce motion" because motion makes them sick, dizzy or worse. An app that keeps animating anyway is overriding a setting the person chose.',
    check: 'motionCheck: with reducedMotion "reduce" emulated, document.getAnimations() must be empty after load',
    provenance: { source: 'generic', note: 'WCAG 2.3.3 Animation from Interactions; prefers-reduced-motion.' },
  },
  {
    id: 'endless-cycling',
    kind: 'motion',
    title: 'things that loop forever',
    why: 'Auto-advancing carousels, pulsing badges and spinning loaders that never stop. Repeating motion is its own hazard (vestibular, and flashing content can trigger seizures), and nobody can read a carousel that leaves before they finish.',
    check: 'motionCheck flags any infinitely repeating animation, with or without reduce-motion',
    provenance: { source: 'generic', note: 'WCAG 2.2.2 Pause, Stop, Hide; 2.3.1 Three Flashes.' },
  },
  {
    id: 'layout-shift',
    kind: 'motion',
    title: 'the page jumps while you read it',
    why: 'An image loads, a banner slides in, and the button you were aiming at is now somewhere else. For anyone with a tremor, or using one hand, that is a mis-tap.',
    check: 'motionCheck measures cumulative layout shift on load and after typing in each box',
    provenance: { source: 'generic', note: 'Cumulative Layout Shift (Core Web Vitals).' },
  },
  {
    id: 'moves-under-the-pointer',
    kind: 'motion',
    title: 'the button moves between press and release',
    why: 'If a button shifts between pointer-down and pointer-up, the click lands on whatever slid underneath. Slower hands are the ones it catches.',
    check: 'motionCheck presses each button, measures, releases off the element, and compares positions',
    provenance: { source: 'generic' },
  },
  {
    id: 'edit-jump',
    kind: 'motion',
    title: 'the list jumps after an edit',
    why: 'Saving one row re-renders the list and throws the person back to the top (or a flash of the wrong content), so they lose their place every time.',
    check: 'record window.scrollY and the row\'s position before and after the save; the motionCheck CLS check also sees it',
    provenance: {
      source: 'incident',
      app: 'Chaos Cache',
      when: 'August 2026',
      what: 'An edit made the view flicker and jump. Our own measurement said it was fine, because the tab we measured in was in the background. Ren saw it in real use.',
      foundBy: 'Ren, using it',
    },
  },

  // ───────────────────────────── ✂️ TEXT THAT GETS CUT OFF ─────────────────────────────
  {
    id: 'clipped-text',
    kind: 'clipping',
    title: 'the last few letters cut off',
    why: 'A label that loses its end can lose its meaning ("Do not ta" / "Delete al"). It gets worse when people turn up their font size, which is exactly the people who need to read it.',
    check: 'clippingCheck: every visible text element at normal size and at large text, scrollWidth must not exceed clientWidth unless an ellipsis was intended',
    provenance: {
      source: 'incident',
      app: 'one of our apps, on an Expo / React Native Android build',
      when: 'observed by Ren (exact build not confirmed in our records)',
      what: 'Text ended several letters early on Android. A known React Native Android quirk with some fonts, weights and text-break strategies, worse at large system font scales.',
      foundBy: 'Ren observed',
    },
  },
  {
    id: 'one-letter-per-line',
    kind: 'clipping',
    title: 'one letter per line on a phone',
    why: 'A table or card squeezed below the width of a word wraps every letter onto its own line. It is technically all there and completely unreadable.',
    check: 'clippingCheck at phone width flags elements narrower than their longest word',
    provenance: {
      source: 'incident',
      app: 'Chaos Command',
      when: 'June 2026 (three separate screens)',
      what: 'A lab-results table, the weather date navigation and the energy activity cards each wrapped one letter per line at phone width. The table now scrolls sideways; the cards wrap words, not letters.',
      foundBy: 'testing on a real Android phone',
    },
  },
  {
    id: 'truncate-on-narrow',
    kind: 'clipping',
    title: 'a description forced onto one line',
    why: 'A one-line truncate class looks tidy on a laptop and leaves phone users with half a sentence and no way to read the rest.',
    check: 'clippingCheck flags text-overflow: ellipsis that actually cut something; mark the ones you mean with data-truncate-ok',
    provenance: {
      source: 'incident',
      app: 'Chaos Command',
      when: 'April 2026',
      what: 'Tracker descriptions in the Customize dialogs were cut to one line on mobile. The truncate class was removed so they wrap.',
      foundBy: 'mobile use',
    },
  },
  {
    id: 'label-pushes-field',
    kind: 'clipping',
    title: 'a long label pushes its field out of the card',
    why: 'Translations and real data are longer than the placeholder text the layout was designed with.',
    check: 'clippingCheck (overflow) plus the long-name and long-paste strings in walkEveryTextbox',
    provenance: {
      source: 'incident',
      app: 'Chaos Compass',
      when: 'July 2026',
      what: 'A long font name pushed the Size field outside its card (a grid item with min-width: auto).',
      foundBy: "Ren's hostile QA pass",
    },
  },

  // ───────────────────────────── 📱 THE KEYBOARD COVERS THE BOX ─────────────────────────────
  {
    id: 'keyboard-covers-box',
    kind: 'mobile-keyboard',
    title: 'the on-screen keyboard covers the box you are typing in',
    why: 'You tap a box near the bottom of the screen, the keyboard comes up, and now you are typing blind into a box you can\'t see, with a Send button hidden under the keys.',
    check: 'keyboardCheck: phone viewport, focus each box, shrink the visible height by ~40% like a keyboard does, assert the box and its submit button are still in view',
    provenance: { source: 'widespread', note: 'Ren hits this across many apps, every day, in 2026. Not one app: a lot of them, right now.' },
  },
  {
    id: 'fixed-footer-under-keyboard',
    kind: 'mobile-keyboard',
    title: 'a fixed footer or chat composer hidden under the keyboard',
    why: 'position: fixed; bottom: 0 sits on the layout viewport, which the keyboard does not shrink on every browser. Chat apps are the classic victim.',
    check: 'keyboardCheck flags fixed/sticky elements that end up below the visible area',
    provenance: { source: 'widespread', note: 'Ren, many apps, 2026.' },
  },
  {
    id: 'hundred-vh',
    kind: 'mobile-keyboard',
    title: '100vh layouts that never shrink',
    why: '100vh is the LARGEST the viewport can be. With browser toolbars or a keyboard up, a 100vh panel runs off the bottom. dvh/svh follow the real visible height.',
    check: 'keyboardCheck flags stylesheets that size things with vh and have no dvh/svh/visualViewport handling, and reads the viewport meta for interactive-widget',
    provenance: {
      source: 'incident',
      app: 'Chaos Command',
      when: 'July 2026',
      what: '151 uses of vh were switched to dvh across the modals, so a form isn\'t clipped by mobile browser chrome.',
      foundBy: 'mobile use',
    },
  },

  // ───────────────────────────── ♿ ACCESSIBILITY ─────────────────────────────
  {
    id: 'keyboard-only',
    kind: 'accessibility',
    title: 'keyboard only, no mouse',
    why: 'Switch users, screen-reader users, people whose hands hurt today, and everyone who just prefers the keyboard. If Tab can\'t reach it, it doesn\'t exist for them.',
    check: 'a11ySmoke: every interactive element is reached by Tab, and focus is visible on each',
    provenance: { source: 'generic', note: 'WCAG 2.1.1 Keyboard, 2.4.7 Focus Visible.' },
  },
  {
    id: 'one-handed',
    kind: 'accessibility',
    title: 'one hand, one thumb',
    why: 'A baby on one arm, a cane in one hand, a cast, a tremor. Small targets placed close together are a mis-tap waiting to happen.',
    check: 'a11ySmoke: targets at least 24×24 CSS px, or spaced so a 24px circle around each touches nothing else (the WCAG 2.5.8 spacing exception)',
    provenance: { source: 'generic', note: 'WCAG 2.5.8 Target Size (Minimum).' },
  },
  {
    id: 'slider-only',
    kind: 'accessibility',
    title: 'a value you can only set by dragging',
    why: 'Dragging a slider precisely is the hardest fine-motor task on a screen. A number box next to it costs nothing.',
    check: 'a11ySmoke flags input[type=range] with no typeable number box beside it',
    provenance: {
      source: 'incident',
      app: 'Chaos Compass',
      when: 'July 2026',
      what: 'The tap-target-size setting was a slider with no number box, in an app whose audience is disabled sellers. A numeric input was added next to it.',
      foundBy: "Ren's hostile QA pass",
    },
  },
  {
    id: 'zoom-200',
    kind: 'accessibility',
    title: '200% zoom (and a phone)',
    why: 'Low vision, tired eyes, a small laptop. At 200% the layout must reflow instead of scrolling sideways or hiding the Save button.',
    check: 'a11ySmoke: at 640px (a 1280px window at 200%) and 375px (a phone), no sideways scrolling and every box on screen',
    provenance: { source: 'generic', note: 'WCAG 1.4.4 Resize Text, 1.4.10 Reflow.' },
  },
  {
    id: 'labels',
    kind: 'accessibility',
    title: 'every box has a name a screen reader can say',
    why: 'Placeholder text disappears when you start typing and is often not read out. A real label stays.',
    check: 'a11ySmoke computes each control\'s accessible name; axe (optional) checks the rest',
    provenance: { source: 'generic', note: 'WCAG 1.3.1, 3.3.2, 4.1.2.' },
  },
  {
    id: 'dark-theme-boxes',
    kind: 'accessibility',
    title: 'white boxes on a dark theme',
    why: 'Dark themes are an accessibility setting for many people (light sensitivity, migraine, low vision). A glaring white box with pale text in it is unreadable.',
    check: 'a11ySmoke emulates colorScheme "dark" and flags light text boxes on a dark page; fix with color-scheme: light dark',
    provenance: {
      source: 'incident',
      app: 'Chaos Command',
      when: 'June 2026',
      what: 'On dark themes, the browser\'s own autofill painted a text box pale white. Fixed by switching off redundant autofill on that box (the app has its own picker) and setting the colour scheme.',
      foundBy: 'Ren, using it',
    },
  },
  {
    id: 'errors-announced',
    kind: 'accessibility',
    title: 'errors that say which box and why',
    why: '"Something went wrong" and a red border tell a screen-reader user nothing. The message belongs next to the box, tied to it, and announced.',
    check: 'fieldMixup accepts a rejection only if the box is aria-invalid, described by a visible message, or a role="alert" appears',
    provenance: { source: 'generic', note: 'WCAG 3.3.1 Error Identification, 4.1.3 Status Messages.' },
  },
]

/** Cases with a string to type, in catalogue order. These feed walkEveryTextbox. */
export const TEXT_CASES: Case[] = CATALOGUE.filter((c) => c.how !== undefined && c.kind !== 'wrong-field')

/** Text cases sensible to save and read back (no blanks). */
export const ROUND_TRIP_CASES: Case[] = TEXT_CASES.filter((c) => !c.tags?.includes('blank'))

/** Cases with real provenance: it actually broke one of our apps. */
export const INCIDENTS: Case[] = CATALOGUE.filter((c) => c.provenance.source === 'incident')

/** The platforms a case applies to. */
export function platformsOf(c: Case): Platform[] {
  return c.platforms ?? KIND_PLATFORMS[c.kind]
}

/** Does this case apply to any of these platforms? */
export function appliesTo(c: Case, platforms: Platform[]): boolean {
  return platformsOf(c).some((p) => platforms.includes(p))
}

export function byKind(kind: Kind): Case[] {
  return CATALOGUE.filter((c) => c.kind === kind)
}
