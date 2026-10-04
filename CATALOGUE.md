# 🦔 The catalogue

*Generated from `src/catalogue.ts` by `npm run catalogue`. Edit the source, not this file.*

**69 cases.** Where each one came from:

- 🧾 incident: **15**. It broke one of our real apps; the entry names the app and the month.
- 🦔 Ren's list: **9**. On the list of things Ren types into every box by hand. No single recorded incident.
- 🌐 widespread: **2**. Ren hits it across many apps, not one of ours.
- 💬 community: **3**. Suggested by someone replying to Ren's post. Good idea, no incident on file.
- 📘 generic: **40**. Plain best practice, labelled so nobody mistakes it for a war story.

## 🧑 Names

*Applies to: every platform.*

### a hedgehog 🦔 `hedgehog`

- **Input:** `🦔`
- **Why a real person does this:** Emoji live outside the basic plane: one 🦔 is TWO JavaScript characters. Code that slices, counts or base64s strings splits it into garbage. People put emoji in names, notes and box labels all the time.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 🦔 Ren's list. The original. Ren put a hedgehog in every box of every app by hand until we automated it.

### O'Brien `obrien`

- **Input:** `Siobhán O'Brien`
- **Why a real person does this:** Apostrophes are in a lot of surnames (O'Brien, D'Angelo, N'Dour). Code that glues strings into SQL, HTML attributes or hand-built JSON breaks on them, and the person gets told their own name is invalid.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 🦔 Ren's list

### quotes plus a literal backslash-n `quotes-and-backslash-n`

- **Input:** `O'Brien \"x\" \\n`
- **Why a real person does this:** Both kinds of quote and a literal backslash in one string: the shortest way to find code that builds JSON or HTML by hand.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 🦔 Ren's list. From the original hedgehog-test list (Chaos Cache, Sept 2026).

### hyphens and spaces in surnames `hyphenated`

- **Input:** `Mary-Jane Smith-Jones`
- **Why a real person does this:** Double-barrelled and hyphenated names are ordinary. "Letters only" validation rejects them.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 📘 generic

### a single name `single-name`

- **Input:** `Teller`
- **Why a real person does this:** Plenty of people legally have one name. A required "last name" box makes them invent one.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string (and: does your form let them save without a surname?)
- **Where we learned it:** 📘 generic

### a very long name `long-name`

- **Input:** *(73 characters)*
- **Why a real person does this:** Long names are real. A 30-character limit truncates them, and a fixed-width layout clips them.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 📘 generic

### lowercase particles `lowercase-particle`

- **Input:** `van der Merwe`
- **Why a real person does this:** Lowercase is correct here. Any "helpful" auto-capitalising or "fixing" of a name corrupts it, and the person has to fight the form to spell their own name.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string (the box must hold exactly what was typed)
- **Where we learned it:** 📘 generic

### a ZWJ emoji with a skin tone 👩🏽‍💻 `zwj-emoji`

- **Input:** `👩🏽‍💻`
- **Why a real person does this:** One picture, four code points: woman + skin tone + zero-width joiner + laptop. Anything that counts or cuts by code point leaves half a person behind.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 🦔 Ren's list. On the original hedgehog-test list (Sept 2026).

### combining marks (Zoë spelled two ways) `combining-marks`

- **Input:** `Zoë and Zoë`
- **Why a real person does this:** Copy-paste and some keyboards produce "e + combining diaeresis" instead of the single "ë". They look identical and compare unequal, so search and login say "not found" to a person who typed their name correctly.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string (the box must keep both forms exactly; normalise on the server if you compare)
- **Where we learned it:** 📘 generic

## 🌍 Scripts and writing systems

*Applies to: every platform.*

### Arabic (right-to-left) `arabic-rtl`

- **Input:** `مرحبا بالعالم`
- **Why a real person does this:** Hundreds of millions of people write right to left. Layouts that assume left-to-right put the cursor, punctuation and icons in the wrong place.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 🦔 Ren's list

### Hebrew with numbers `hebrew-with-numbers`

- **Input:** `שלום 123 עולם`
- **Why a real person does this:** Numbers inside right-to-left text run left to right. Code that reverses strings to "fix" direction scrambles them.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 📘 generic

### mixed directions in one line `mixed-bidi`

- **Input:** `Order #123 لـ O'Brien`
- **Why a real person does this:** Real data mixes scripts: an English order number for an Arabic-speaking customer. Bidi mixing is where truncation and ellipsis code goes wrong.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 📘 generic

### Chinese / Japanese characters `cjk`

- **Input:** `山田太郎 さん`
- **Why a real person does this:** Wide characters break width math and byte-length limits (one character, three bytes in UTF-8).
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 📘 generic

### full-width digits from a Japanese keyboard `fullwidth-digits`

- **Input:** `０９０−１２３４−５６７８`
- **Why a real person does this:** Japanese input methods type full-width numbers by default. A phone number that "has no digits in it" according to /[0-9]/ is still a phone number.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 📘 generic

### Devanagari conjuncts `devanagari`

- **Input:** `क्षत्रिय नमस्ते`
- **Why a real person does this:** Several code points render as one glyph. Cutting at a character count can leave a broken letter.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 📘 generic

### an invisible right-to-left override `bidi-override`

- **Input:** `report‮fdp.exe`
- **Why a real person does this:** An invisible control character that flips everything after it. It arrives in pasted filenames and chat messages, and makes displayed text lie about what it is.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 📘 generic

## 📋 Paste chaos

*Applies to: every platform.*

### a 5,000-character paste `long-paste`

- **Input:** *(5000 characters)*
- **Why a real person does this:** People paste whole emails, decklists and doctor's notes into one box. Silent truncation loses their words without telling them.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string (if the box has maxlength, it should hold exactly that many, and say so)
- **Where we learned it:** 🦔 Ren's list

### a Windows path ending in a backslash `windows-path`

- **Input:** `C:\\Users\\🦔\\box 2\\`
- **Why a real person does this:** People paste file paths. A backslash followed by a quote is not valid inside a hand-built JSON string.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string; the flinch watcher also flags any response that says it is JSON and does not parse
- **Where we learned it:** 🧾 incident. **Chaos Cache (desktop card-collection app), September 2026.** The automated hedgehog test found 26 error replies built by gluing strings into JSON. A path with a backslash broke them, so the user read "Bad escaped character in JSON" instead of the real reason. All 26 now go through a real JSON encoder. *Found by: the hedgehog test (Ren's habit, automated).*

### leading and trailing spaces `padded-spaces`

- **Input:** `   🦔 padded   `
- **Why a real person does this:** Copying from a table or a PDF drags spaces along. If you trim, trim on purpose and everywhere, or "Box 1" and "Box 1 " become two boxes.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 🦔 Ren's list

### typed, then deleted again `typed-then-deleted`

- **Input:** *(typed, then deleted)*
- **Why a real person does this:** A box that was touched and emptied is not the same as one never touched: "dirty but empty" states crash validation that only expected one or the other.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 🦔 Ren's list

### a trailing newline `trailing-newline`

- **Input:** `Sol Ring\n`
- **Why a real person does this:** Copying one cell from a spreadsheet brings a newline with it. A one-line box drops it (browsers do that); a textarea keeps it, and an exact-match lookup then fails.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 📘 generic

### smart quotes and an em dash from Word `smart-quotes`

- **Input:** `“Don’t” — it’s fine…`
- **Why a real person does this:** Word, Docs and phones turn straight quotes curly. Code that only expects ASCII mangles them into Ã¢â‚¬â„¢.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 📘 generic

### tabs `tabs`

- **Input:** `qty\tname\t🦔`
- **Why a real person does this:** Pasting from a spreadsheet brings tabs. A tab is invisible in most boxes and still breaks exact matches and CSV exports.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 📘 generic

### a zero-width space and a non-breaking space `invisible-spaces`

- **Input:** `Sol​Ring and Sol Ring`
- **Why a real person does this:** Copied from a web page or a Word doc. It looks exactly like "Sol Ring" and matches nothing.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 📘 generic

### something that looks like HTML `html-looking`

- **Input:** `<b>hedgehog</b> & co <3`
- **Why a real person does this:** People write "<3" and "a < b" and "R&D". If it renders bold anywhere later, your output isn't escaped.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string (and look at wherever this text is displayed later)
- **Where we learned it:** 📘 generic

### only spaces `only-spaces`

- **Input:** `     `
- **Why a real person does this:** A "required" check that tests length > 0 lets this through, and you get a record with no name that nobody can click.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 📘 generic

### empty `empty`

- **Input:** ``
- **Why a real person does this:** The most common input of all.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 📘 generic

## 🔢 Numbers and dates

*Applies to: every platform.*

### leading zeros `leading-zeros`

- **Input:** `00501`
- **Why a real person does this:** ZIP codes, phone extensions and ID numbers start with 0. Store them as numbers and 00501 comes back as 501.
- **How it's checked:** roundTripValue on the box: save → reload → still "00501"
- **Where we learned it:** 📘 generic

### commas: thousands here, decimals there `decimal-comma`

- **Input:** `1.234,56`
- **Why a real person does this:** Half the world writes decimals with a comma. parseFloat("1.234,56") is 1.234, a silent thousand-fold error.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string (and check what your parser makes of it)
- **Where we learned it:** 📘 generic

### a real minus sign `unicode-minus`

- **Input:** `−5`
- **Why a real person does this:** Copied from a document, "−" (U+2212) is not "-", and Number("−5") is NaN.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 📘 generic

### a leap day `leap-day`

- **Input:** `2028-02-29`
- **Why a real person does this:** People are born on it and appointments land on it. "Add one year" code turns it into March 1 or crashes.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string; for date pickers, set the clock to Feb 29 with page.clock
- **Where we learned it:** 📘 generic

### a leap day that doesn't exist `not-a-leap-day`

- **Input:** `2027-02-29`
- **Why a real person does this:** new Date("2027-02-29") quietly becomes March 1 in some engines. The app should say no, not move the date.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string
- **Where we learned it:** 📘 generic

### a time that doesn't exist (daylight saving) `dst-gap`

- **Input:** `2026-03-08T02:30`
- **Why a real person does this:** In New York, half past two in the morning on 8 March 2026 never happens: clocks jump from 2:00 to 3:00. Reminders at 2:30 vanish or fire twice.
- **How it's checked:** run the suite with timezoneId: "America/New_York" and enter it
- **Where we learned it:** 📘 generic

### a date that means two things `day-slashes`

- **Input:** `04/10/2026`
- **Why a real person does this:** April 10 in the US, 4 October nearly everywhere else. Guessing silently files things on the wrong day.
- **How it's checked:** walkEveryTextbox: no crash, no console error, the box holds it, and (with roundTrip) save → reload → same string (and show the parsed date back to the person in words)
- **Where we learned it:** 📘 generic

### come back tomorrow `come-back-tomorrow`

- **Input:** *(an action)*
- **Why a real person does this:** Something saved yesterday must still be there today. Storage keyed by "today's date" makes records quietly disappear at midnight.
- **How it's checked:** comeBackTomorrow(page, { create, stillThere }) moves the clock a day forward with page.clock
- **Where we learned it:** 🧾 incident. **Chaos Command (health-tracking app), May 2026.** Saved providers and appointments vanished the next day. They were stored under the day they were created and loaded only for "today". *Found by: Ren, using it.*

### edit it on a different day than you made it `edit-another-day`

- **Input:** *(an action)*
- **Why a real person does this:** Same root as above, in the other direction: an edit saved under today's key creates a second copy instead of updating the first.
- **How it's checked:** comeBackTomorrow, then edit and count the records
- **Where we learned it:** 🧾 incident. **Chaos Command, June 2026.** Editing an entry on a later day duplicated it, and the timeline showed the same item several times. *Found by: Ace while building, then Ren on the timeline.*

### the far ends of the world's clocks `far-timezones`

- **Input:** *(an action)*
- **Why a real person does this:** At UTC+14 it is already tomorrow; at UTC−11 it is still yesterday. "Today" computed in UTC is the wrong day for a lot of people.
- **How it's checked:** run the suite twice with timezoneId: "Pacific/Kiritimati" and "Pacific/Pago_Pago"
- **Where we learned it:** 📘 generic

## 🔀 The wrong field

*Applies to: every platform.*

### the street address typed into the phone box `address-in-phone`

- **Input:** `123 Main St, Apt 4` into the **phone** box, and a good app should **reject** it
- **Why a real person does this:** Autofill picks the wrong line, a thumb hits the wrong box, or you were looking at the paper, not the screen. The app should notice and say so out loud, next to the box.
- **How it's checked:** fieldMixup: refused WITH a visible message tied to the box, never silently accepted, never a bare alert()
- **Where we learned it:** 🦔 Ren's list. One of Ren's examples, word for word: "accidentally typing the address in the phone number spot."

### a phone number in the email box `phone-in-email`

- **Input:** `555-123-4567` into the **email** box, and a good app should **reject** it
- **Why a real person does this:** Same slip, other box. If it saves, you have a contact you can never email.
- **How it's checked:** fieldMixup
- **Where we learned it:** 📘 generic

### an email address in the name box `email-in-name`

- **Input:** `someone@example.com` into the **name** box, and a good app should **accept** it
- **Why a real person does this:** Names are free text, so this one should SAVE: you cannot know it isn't someone's name. The test is that the form doesn't crash or "fix" it.
- **How it's checked:** fieldMixup (expect accept)
- **Where we learned it:** 📘 generic

### a card-number-shaped string in search `card-number-in-search`

- **Input:** `4111 1111 1111 1111` into the **search** box, and a good app should **accept** it
- **Why a real person does this:** People paste the wrong thing from the clipboard. Search must cope, and must not log or echo it anywhere it shouldn't.
- **How it's checked:** fieldMixup (expect accept), then check your logs and analytics for the string
- **Where we learned it:** 💬 community. Suggested by a commenter on Ren's post about this habit (Sept 2026): sensitive-shaped junk in the wrong field.

### a website typed the way people type websites `url-without-scheme`

- **Input:** `www.example.com` into the **url** box, and a good app should **accept** it
- **Why a real person does this:** Nobody types https://. An <input type="url"> rejects www.example.com, and because browser validation blocks the whole form, one optional box can stop everything from saving.
- **How it's checked:** fieldMixup (expect accept); fix: type="text" inputmode="url", add https:// on save
- **Where we learned it:** 🧾 incident. **Chaos Command, June 2026.** An optional "pharmacy website" box was type="url". Typing www.cvs.com popped "Please enter a URL" and the whole entry would not save. *Found by: Ren, using it.*

### a phone number written the way people write them `phone-human-formats`

- **Input:** `(555) 123-4567` into the **phone** box, and a good app should **accept** it
- **Why a real person does this:** Brackets, dashes, dots, spaces, a +44 or an extension: a form that demands ten bare digits rejects nearly every real phone number.
- **How it's checked:** fieldMixup (expect accept)
- **Where we learned it:** 📘 generic

### an international phone number `phone-international`

- **Input:** `+44 20 7946 0958` into the **phone** box, and a good app should **accept** it
- **Why a real person does this:** Not everyone has a ten-digit North American number.
- **How it's checked:** fieldMixup (expect accept)
- **Where we learned it:** 📘 generic

## 👆 Interaction chaos

*Applies to: every platform.*

### double-clicking submit `double-submit`

- **Input:** *(an action)*
- **Why a real person does this:** Tremor, a sticky mouse, a slow network and a person who thinks the first click didn't take. Two clicks must not make two records or two charges.
- **How it's checked:** doubleSubmit(page, { submit, request }): counts the requests one double-click sends
- **Where we learned it:** 💬 community. Suggested by a commenter on Ren's post (Sept 2026): rapid-fire the same button.

### refresh (or crash) in the middle of the work `refresh-mid-work`

- **Input:** *(an action)*
- **Why a real person does this:** Tabs get closed, laptops sleep, phones kill background apps. Half an hour of careful input should not live only in memory.
- **How it's checked:** survivesReload(page, { fill, check }): fill, reload, the work is still there (or the app offers it back)
- **Where we learned it:** 🧾 incident. **Chaos Compass (planner-hyperlinking desktop app), July 2026.** There was no save path until export. The screen where you could spend thirty minutes correcting page types had no save at all. Autosave with a named restore prompt was added. *Found by: Ren's hostile QA pass.*

### the back button mid-form `back-button`

- **Input:** *(an action)*
- **Why a real person does this:** Back is how people undo. It should not lose a half-filled form or re-submit a finished one.
- **How it's checked:** fill, page.goBack(), page.goForward(), check the values and the request count
- **Applies to:** web-desktop, web-mobile
- **Where we learned it:** 📘 generic

### alert() and confirm() that never appear `native-dialogs`

- **Input:** *(an action)*
- **Why a real person does this:** Some embedded WebViews swallow native dialogs. A delete behind confirm() then silently does nothing, and validation behind alert() refuses without a word.
- **How it's checked:** the flinch watcher flags every native dialog the page opens
- **Where we learned it:** 🧾 incident. **Chaos Command (Android build), June 2026.** Delete did nothing anywhere in the app. window.confirm() is swallowed by the Android WebView, so the confirm gate never passed. Replaced with an in-page dialog. *Found by: on-device testing of the Android build.*

### a box hanging off the edge of the window `off-screen-box`

- **Input:** *(an action)*
- **Why a real person does this:** If part of a box is off-screen, a hand can't reach it and neither can a test robot.
- **How it's checked:** walkEveryTextbox reports any box that sits partly off the left, top or right edge
- **Where we learned it:** 🧾 incident. **Chaos Cache, September 2026.** The "add a card" popover hung about 192px off the left edge, so two of its boxes could not be clicked. Caught by the first hedgehog run. *Found by: the hedgehog test (Ren's habit, automated).*

### saved data changed outside the app `corrupt-storage`

- **Input:** *(an action)*
- **Why a real person does this:** Sync tools, disk errors, a person hand-editing a file. The app should refuse loudly and point at a backup, not load garbage or a blank screen.
- **How it's checked:** write junk into localStorage/IndexedDB (or a copy of the data file), reload, expect a readable error
- **Where we learned it:** 💬 community. Suggested by a commenter on Ren's post (Sept 2026): modify the data files outside the app.

## 🌀 Things that move that shouldn't

*Applies to: every platform.*

### animation that ignores "reduce motion" `reduced-motion-ignored`

- **Input:** *(an action)*
- **Why a real person does this:** People turn on "reduce motion" because motion makes them sick, dizzy or worse. An app that keeps animating anyway is overriding a setting the person chose.
- **How it's checked:** motionCheck: with reducedMotion "reduce" emulated, document.getAnimations() must be empty after load
- **Where we learned it:** 📘 generic. WCAG 2.3.3 Animation from Interactions; prefers-reduced-motion.

### things that loop forever `endless-cycling`

- **Input:** *(an action)*
- **Why a real person does this:** Auto-advancing carousels, pulsing badges and spinning loaders that never stop. Repeating motion is its own hazard (vestibular, and flashing content can trigger seizures), and nobody can read a carousel that leaves before they finish.
- **How it's checked:** motionCheck flags any infinitely repeating animation, with or without reduce-motion
- **Where we learned it:** 📘 generic. WCAG 2.2.2 Pause, Stop, Hide; 2.3.1 Three Flashes.

### the page jumps while you read it `layout-shift`

- **Input:** *(an action)*
- **Why a real person does this:** An image loads, a banner slides in, and the button you were aiming at is now somewhere else. For anyone with a tremor, or using one hand, that is a mis-tap.
- **How it's checked:** motionCheck measures cumulative layout shift on load and after typing in each box
- **Where we learned it:** 📘 generic. Cumulative Layout Shift (Core Web Vitals).

### the button moves between press and release `moves-under-the-pointer`

- **Input:** *(an action)*
- **Why a real person does this:** If a button shifts between pointer-down and pointer-up, the click lands on whatever slid underneath. Slower hands are the ones it catches.
- **How it's checked:** motionCheck presses each button, measures, releases off the element, and compares positions
- **Where we learned it:** 📘 generic

### the list jumps after an edit `edit-jump`

- **Input:** *(an action)*
- **Why a real person does this:** Saving one row re-renders the list and throws the person back to the top (or a flash of the wrong content), so they lose their place every time.
- **How it's checked:** record window.scrollY and the row's position before and after the save; the motionCheck CLS check also sees it
- **Where we learned it:** 🧾 incident. **Chaos Cache, August 2026.** An edit made the view flicker and jump. Our own measurement said it was fine, because the tab we measured in was in the background. Ren saw it in real use. *Found by: Ren, using it.*

## ✂️ Text that gets cut off

*Applies to: every platform.*

### the last few letters cut off `clipped-text`

- **Input:** *(an action)*
- **Why a real person does this:** A label that loses its end can lose its meaning ("Do not ta" / "Delete al"). It gets worse when people turn up their font size, which is exactly the people who need to read it.
- **How it's checked:** clippingCheck: every visible text element at normal size and at large text, scrollWidth must not exceed clientWidth unless an ellipsis was intended
- **Where we learned it:** 🧾 incident. **one of our apps, on an Expo / React Native Android build, observed by Ren (exact build not confirmed in our records).** Text ended several letters early on Android. A known React Native Android quirk with some fonts, weights and text-break strategies, worse at large system font scales. *Found by: Ren observed.*

### one letter per line on a phone `one-letter-per-line`

- **Input:** *(an action)*
- **Why a real person does this:** A table or card squeezed below the width of a word wraps every letter onto its own line. It is technically all there and completely unreadable.
- **How it's checked:** clippingCheck at phone width flags elements narrower than their longest word
- **Where we learned it:** 🧾 incident. **Chaos Command, June 2026 (three separate screens).** A lab-results table, the weather date navigation and the energy activity cards each wrapped one letter per line at phone width. The table now scrolls sideways; the cards wrap words, not letters. *Found by: testing on a real Android phone.*

### a description forced onto one line `truncate-on-narrow`

- **Input:** *(an action)*
- **Why a real person does this:** A one-line truncate class looks tidy on a laptop and leaves phone users with half a sentence and no way to read the rest.
- **How it's checked:** clippingCheck flags text-overflow: ellipsis that actually cut something; mark the ones you mean with data-truncate-ok
- **Where we learned it:** 🧾 incident. **Chaos Command, April 2026.** Tracker descriptions in the Customize dialogs were cut to one line on mobile. The truncate class was removed so they wrap. *Found by: mobile use.*

### a long label pushes its field out of the card `label-pushes-field`

- **Input:** *(an action)*
- **Why a real person does this:** Translations and real data are longer than the placeholder text the layout was designed with.
- **How it's checked:** clippingCheck (overflow) plus the long-name and long-paste strings in walkEveryTextbox
- **Where we learned it:** 🧾 incident. **Chaos Compass, July 2026.** A long font name pushed the Size field outside its card (a grid item with min-width: auto). *Found by: Ren's hostile QA pass.*

## 📱 The keyboard covers the box

*Applies to: web-mobile, react-native.*

### the on-screen keyboard covers the box you are typing in `keyboard-covers-box`

- **Input:** *(an action)*
- **Why a real person does this:** You tap a box near the bottom of the screen, the keyboard comes up, and now you are typing blind into a box you can't see, with a Send button hidden under the keys.
- **How it's checked:** keyboardCheck: phone viewport, focus each box, shrink the visible height by ~40% like a keyboard does, assert the box and its submit button are still in view
- **Where we learned it:** 🌐 widespread. Ren hits this across many apps, every day, in 2026. Not one app: a lot of them, right now.

### a fixed footer or chat composer hidden under the keyboard `fixed-footer-under-keyboard`

- **Input:** *(an action)*
- **Why a real person does this:** position: fixed; bottom: 0 sits on the layout viewport, which the keyboard does not shrink on every browser. Chat apps are the classic victim.
- **How it's checked:** keyboardCheck flags fixed/sticky elements that end up below the visible area
- **Where we learned it:** 🌐 widespread. Ren, many apps, 2026.

### 100vh layouts that never shrink `hundred-vh`

- **Input:** *(an action)*
- **Why a real person does this:** 100vh is the LARGEST the viewport can be. With browser toolbars or a keyboard up, a 100vh panel runs off the bottom. dvh/svh follow the real visible height.
- **How it's checked:** keyboardCheck flags stylesheets that size things with vh and have no dvh/svh/visualViewport handling, and reads the viewport meta for interactive-widget
- **Where we learned it:** 🧾 incident. **Chaos Command, July 2026.** 151 uses of vh were switched to dvh across the modals, so a form isn't clipped by mobile browser chrome. *Found by: mobile use.*

## ♿ Accessibility

*Applies to: every platform.*

### keyboard only, no mouse `keyboard-only`

- **Input:** *(an action)*
- **Why a real person does this:** Switch users, screen-reader users, people whose hands hurt today, and everyone who just prefers the keyboard. If Tab can't reach it, it doesn't exist for them.
- **How it's checked:** a11ySmoke: every interactive element is reached by Tab, and focus is visible on each
- **Where we learned it:** 📘 generic. WCAG 2.1.1 Keyboard, 2.4.7 Focus Visible.

### one hand, one thumb `one-handed`

- **Input:** *(an action)*
- **Why a real person does this:** A baby on one arm, a cane in one hand, a cast, a tremor. Small targets placed close together are a mis-tap waiting to happen.
- **How it's checked:** a11ySmoke: targets at least 24×24 CSS px, or spaced so a 24px circle around each touches nothing else (the WCAG 2.5.8 spacing exception)
- **Where we learned it:** 📘 generic. WCAG 2.5.8 Target Size (Minimum).

### a value you can only set by dragging `slider-only`

- **Input:** *(an action)*
- **Why a real person does this:** Dragging a slider precisely is the hardest fine-motor task on a screen. A number box next to it costs nothing.
- **How it's checked:** a11ySmoke flags input[type=range] with no typeable number box beside it
- **Where we learned it:** 🧾 incident. **Chaos Compass, July 2026.** The tap-target-size setting was a slider with no number box, in an app whose audience is disabled sellers. A numeric input was added next to it. *Found by: Ren's hostile QA pass.*

### 200% zoom (and a phone) `zoom-200`

- **Input:** *(an action)*
- **Why a real person does this:** Low vision, tired eyes, a small laptop. At 200% the layout must reflow instead of scrolling sideways or hiding the Save button.
- **How it's checked:** a11ySmoke: at 640px (a 1280px window at 200%) and 375px (a phone), no sideways scrolling and every box on screen
- **Where we learned it:** 📘 generic. WCAG 1.4.4 Resize Text, 1.4.10 Reflow.

### every box has a name a screen reader can say `labels`

- **Input:** *(an action)*
- **Why a real person does this:** Placeholder text disappears when you start typing and is often not read out. A real label stays.
- **How it's checked:** a11ySmoke computes each control's accessible name; axe (optional) checks the rest
- **Where we learned it:** 📘 generic. WCAG 1.3.1, 3.3.2, 4.1.2.

### white boxes on a dark theme `dark-theme-boxes`

- **Input:** *(an action)*
- **Why a real person does this:** Dark themes are an accessibility setting for many people (light sensitivity, migraine, low vision). A glaring white box with pale text in it is unreadable.
- **How it's checked:** a11ySmoke emulates colorScheme "dark" and flags light text boxes on a dark page; fix with color-scheme: light dark
- **Where we learned it:** 🧾 incident. **Chaos Command, June 2026.** On dark themes, the browser's own autofill painted a text box pale white. Fixed by switching off redundant autofill on that box (the app has its own picker) and setting the colour scheme. *Found by: Ren, using it.*

### errors that say which box and why `errors-announced`

- **Input:** *(an action)*
- **Why a real person does this:** "Something went wrong" and a red border tell a screen-reader user nothing. The message belongs next to the box, tied to it, and announced.
- **How it's checked:** fieldMixup accepts a rejection only if the box is aria-invalid, described by a visible message, or a role="alert" appears
- **Where we learned it:** 📘 generic. WCAG 3.3.1 Error Identification, 4.1.3 Status Messages.
