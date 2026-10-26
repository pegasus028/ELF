# ELF Studio

Companion app for EN33207 English as a Lingua Franca (M6, Satriwithaya EP · T.Chris). Phase 1 covers Module 2 (personal brand, L9–L14). Each activity is a room. Phases 2 and 3 add rooms for Modules 3 and 4 without changing the shell. Version 1.0.0.

Students set up once with a nickname, group (G1–G10 → profession) and seat (A–C), the same choices as in the MMI Practice Circuit. Everything is saved on their own device. Auto-marked rooms give a result code, and the teacher can check any code on the Teacher tab.

## Rooms (phase 1)

| Lesson | Room | What students do | Auto-marked |
| --- | --- | --- | --- |
| L9 | Evidence Audit | Enter 8 experiences (role, when, scale, evidence type, link). The room flags *Unverifiable* and *No scale*, and the audit can be copied as text for Classroom | – |
| L10 | Line Upgrader | 4 rounds × 5 weak lines (round 1 from their own field). The check looks for a verb from the bank, a number, and a result clause that says what changed (at least 3 words after the marker, not "was good"). It also rejects ban-list clichés and lines over the word limit. Model upgrades appear when a round is finished. Peers rate lines 1–3 with 5-character codes, and a trio board compares score codes | ✓ lines passing /20 (+ peer stars) |
| L11 | Cliché Hunter | Tap the 10 clichés in the model statement, then write 3 rewrites that are checked against the ban list and must include a concrete detail. Every 3 wrong taps cost 1 point, and the code carries the number of wrong taps. The app cannot check that a rewrite is relevant, so spot-check the 3 rewrites | ✓ found − wrong-tap penalty + rewrites /13 |
| L12 | Peer-review form | 5 questions with tick options and a frame, copied as text | – |
| L13 | Pitch Clock | Session clock `HHMM` + `P` [+ rotations 2–6]. Each partner gets 60 s to pitch and 60 s to rate, then everyone moves (15 s). Partners rate 3 criteria 1–4 and get an 8-character code (with a QR) to pass to the speaker. Only one code per partner per rotation counts: a newer code replaces the older one | ✓ each rating /12 |
| L14 | Portfolio question cards | 12 cards: next/previous, shuffle (used cards go last), mark used | – |
| L9–L13 | Exit checks | 6 items per lesson (multiple choice or gap fill), score, review of wrong answers, retry. The code carries the attempt number, and My scores shows the **first try** with the best score beside it | ✓ /6 |

My scores lists the best score and the codes from each room, and can be copied as text. The Teacher tab has the Pitch Clock session and projector countdown, the Line Upgrader trio tally (fed by score codes), a code checker and the gradebook status.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The page. `ELF_CONFIG` (below) lives here. |
| `app.css` | Styles, light and dark. |
| `js/core.js` | Checkers, codes, session clock, scoring, tally. No DOM; also runs in Node. |
| `js/qr.js` | QR encoder (copied unchanged from the MMI app). |
| `js/app.js` | Shell: setup, Rooms home, My scores, Teacher, storage, gradebook, router. |
| `js/rooms/*.js` | One file per room; each registers itself with `ELF.registerRoom()`. |
| `elf-content.json` | All content and on-screen text (`uiText`). Module 2 data from WS-D. |
| `elf-content.schema.json` | JSON Schema for the content (HANDOVER §4 contract). |
| `sw.js` | Offline cache. |
| `tools/uitext.js` | `--check` / `--write`: makes sure every on-screen string is in `uiText`. |
| `tools/merge_content.py` | Merges a new WS content file, keeps `uiText`, validates against the schema. |
| `tests/run-tests.js`, `tests/browser_test.py` | Node and browser tests (below). |
| `DECISIONS.md` | Build decisions. |

## Deploy to GitHub Pages (repo `pegasus028/ELF`, once Chris confirms the name)

1. Create the repository `ELF` under `pegasus028` and upload everything in this folder to the root (keep `js/`, `js/rooms/`, `tests/`, `tools/`). `.nojekyll` is included.
2. Settings → Pages → Source: *Deploy from a branch* → `main` / root → Save.
3. After a minute, open `https://pegasus028.github.io/ELF/`.
4. In `index.html`, set `APP_URL` so the QR codes always point to the live site:

```html
window.ELF_CONFIG = { APP_URL: "https://pegasus028.github.io/ELF/", GRADEBOOK_URL: "" };
```

5. **On every release**, change `CACHE` in `sw.js` (for example `elf-studio-v1.0.1`), otherwise phones keep serving the old copy.

The app lives on the same origin as the MMI app (`pegasus028.github.io`). The first time a student sets up, it fills in her nickname, group and seat from the MMI app. Storage keys start with `elf.` and never touch the MMI app's `mmi.*` keys.

## Optional gradebook (Google Sheet)

If `GRADEBOOK_URL` is set, auto-marked rooms (Line Upgrader at the end of round 4 and on "Send my updated score", Cliché Hunter on save, each Pitch Clock rating received, each exit-check attempt) send one row: `{date, nickname, group, seat, room, lesson, score, max, code}`, plus `attempt` for exit checks. It is sent as `text/plain` with `no-cors` and nobody waits for a reply, so a slow sheet never blocks the class.

1. Create a Google Sheet with a tab named `ELF`. Put this header in row 1: `received · date · nickname · group · seat · room · lesson · score · max · code · attempt`.
2. Extensions → Apps Script, then paste:

```javascript
function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  SpreadsheetApp.getActive().getSheetByName("ELF").appendRow([
    new Date(), d.date, d.nickname, d.group, d.seat, d.room, d.lesson, d.score, d.max, d.code, d.attempt || ""
  ]);
  return ContentService.createTextOutput("ok");
}
```

3. Deploy → New deployment → Web app → Execute as: *Me* · Who has access: *Anyone* → Deploy. Copy the `/exec` URL into `GRADEBOOK_URL`.
4. After **any** script change: Deploy → Manage deployments → pencil → *New version* → Deploy. Saving alone does not update the `/exec` URL.

Exit checks post every attempt with its number. Use `attempt = 1` for marks, because the review shows the answers. Each code can be decoded on the Teacher tab, so a pasted row can be checked against the student's code.

## Running the lessons

- **L9–L12 rooms:** students open the room from Rooms. Exit checks sit under each lesson.
- **L10 tally:** students read their score code (Trio board) and you type them into Teacher → Line Upgrader tally. The best code per seat counts.
- **L13 Pitch Clock:** Teacher → Start in 1 minute → Full screen. Students scan the QR or type the code (for example `1015P`), then choose *Stay line* (pitches first) or *Move line*. Each rotation is: stay line pitches 60 s → move line rates 60 s → move line pitches 60 s → stay line rates 60 s → move 15 s. 4 rotations take 16:45. The rater makes a code and the speaker types it or scans it.
- Later rooms that need a clock add a mode letter (`registerClock` in `core.js`) and use the same `HHMM` + letter code.

## Editing content

All content and every on-screen string are in `elf-content.json`. Room text that WS-D wrote (titles, intros, feedback, frames) is in `rooms.<room>`, and the app's own interface text is in `uiText`. After changing code that adds strings, run `node tools/uitext.js --write`. To bring in a new data file from a content workstream:

```bash
python3 tools/merge_content.py path/to/elf-content.m2.json --heldout path/to/Midterm-heldout-lines.md
node tools/uitext.js --write
```

Midterm items stay out of this file and out of the repo. The `--heldout` option refuses the merge if any held-out line appears in the data.

## Tests

```bash
node tests/run-tests.js            # 218 checks: checkers, codes, clock, scoring, tally, content, uiText
python3 -m http.server 8765 &      # from this folder
python3 tests/browser_test.py      # 81 checks at 360 px (incl. 44-px tap targets), light/dark, no-storage, every room flow
```
