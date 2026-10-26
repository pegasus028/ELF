#!/usr/bin/env node
/* Collects every on-screen string from the code (t("key", "default")) plus the dynamic keys below.
 *   node tools/uitext.js --check   list keys missing from elf-content.json uiText (exit 1 if any)
 *   node tools/uitext.js --write   add missing keys to uiText with their default text (existing text is kept)
 */
"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const files = ["js/app.js"].concat(fs.readdirSync(path.join(ROOT, "js/rooms")).map((f) => "js/rooms/" + f));

const DYNAMIC = {
  "app.title": "ELF Studio",
  "nav.rooms": "Rooms", "nav.scores": "My scores", "nav.teacher": "Teacher",
  "theme.auto": "follows your device", "theme.light": "light", "theme.dark": "dark",
  "module.1": "Module 1 · MMI", "module.2": "Module 2 · Personal brand", "module.3": "Module 3 · Speaking the profession", "module.4": "Module 4 · Media, data and AI",
  "lesson.9": "Tue 1 Dec · Brand audit and the honest claim",
  "lesson.10": "Wed 2 Dec · Activity lines and the one-page CV",
  "lesson.11": "Tue 8 Dec · The personal statement and the cliché ban",
  "lesson.12": "Wed 9 Dec · Peer review and AI as editor",
  "lesson.13": "Tue 15 Dec · Elevator pitch and the 60-second video",
  "lesson.14": "Wed 16 Dec · Portfolio interview and midterm review",
  "room.evidenceAudit.title": "Evidence Audit", "room.evidenceAudit.blurb": "Eight experiences, the proof for each, and the flags a reader would raise.",
  "room.lineUpgrader.title": "Line Upgrader", "room.lineUpgrader.blurb": "Four rounds of weak lines to rewrite. Verb, number, result.",
  "room.clicheHunter.title": "Cliché Hunter", "room.clicheHunter.blurb": "Find the ten clichés in a model statement, then rewrite three.",
  "room.peerReview.title": "Peer-review form", "room.peerReview.blurb": "Five questions about a classmate's draft, sent as text.",
  "room.pitchClock.title": "Pitch Clock", "room.pitchClock.blurb": "Speed-networking: 60-second pitches, partner ratings by code.",
  "room.questionCards.title": "Portfolio question cards", "room.questionCards.blurb": "Twelve interviewer questions to point at a statement.",
  "room.exitChecks.title": "Exit checks",
  "phase.before": "Starts in", "phase.done": "Session complete", "phase.idle": "Ready",
  "phase.pitchA": "Stay line pitches", "phase.rateA": "Move line rates", "phase.pitchB": "Move line pitches", "phase.rateB": "Stay line rates", "phase.move": "Move one place",
  "hint.before": "Two lines, facing each other. Stay line pitches first.",
  "hint.pitchA": "Stay line: pitch for 60 seconds. Move line: listen.",
  "hint.rateA": "Move line: rate on three criteria and show your code.",
  "hint.pitchB": "Move line: pitch for 60 seconds. Stay line: listen.",
  "hint.rateB": "Stay line: rate on three criteria and show your code.",
  "hint.move": "Move line: one place along. Say hello to your new partner.",
  "hint.done": "Check you have a rating code from every partner."
};

function collect() {
  const out = {};
  const re = /\bt\(\s*"([A-Za-z0-9_.]+)"\s*,\s*"((?:[^"\\]|\\.)*)"/g;
  files.forEach((f) => {
    const src = fs.readFileSync(path.join(ROOT, f), "utf8");
    let m;
    while ((m = re.exec(src))) {
      const v = JSON.parse('"' + m[2] + '"');
      if (out[m[1]] !== undefined && out[m[1]] !== v) console.warn(`warning: ${m[1]} has two defaults (${f})`);
      if (out[m[1]] === undefined) out[m[1]] = v;
    }
  });
  Object.assign(out, DYNAMIC);
  return out;
}
module.exports = { collect, DYNAMIC };

if (require.main === module) {
  const file = path.join(ROOT, "elf-content.json");
  const C = JSON.parse(fs.readFileSync(file, "utf8"));
  const all = collect();
  const ui = C.uiText || {};
  const missing = Object.keys(all).filter((k) => !(k in ui));
  if (process.argv.includes("--write")) {
    const merged = {};
    Object.keys(all).sort().forEach((k) => { merged[k] = k in ui ? ui[k] : all[k]; });
    Object.keys(ui).forEach((k) => { if (!(k in merged)) merged[k] = ui[k]; });
    C.uiText = merged;
    fs.writeFileSync(file, JSON.stringify(C, null, 1) + "\n");
    console.log(`uiText: ${Object.keys(merged).length} keys (${missing.length} added)`);
  } else {
    if (missing.length) { console.log("missing uiText keys:\n  " + missing.join("\n  ")); process.exit(1); }
    console.log(`uiText complete: ${Object.keys(all).length} keys`);
  }
}
