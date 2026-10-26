#!/usr/bin/env node
/* ELF Studio — Node checks: line checker, ban list, codes, session clock, exit-check scoring, tally, content.
 * Usage: node tests/run-tests.js
 */
"use strict";
const fs = require("fs");
const path = require("path");
const M = require("../js/core.js");
const QR = require("../js/qr.js");
const ROOT = path.join(__dirname, "..");
const C = JSON.parse(fs.readFileSync(path.join(ROOT, "elf-content.json"), "utf8"));
const UI = require("../tools/uitext.js");

let pass = 0, fail = 0;
function eq(name, got, want) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) pass++;
  else { fail++; console.log("FAIL " + name + "\n  got:  " + g + "\n  want: " + w); }
}
const ok = (name, cond) => eq(name, !!cond, true);

/* ---------- 1. line checker (built-in rule) ---------- */
const V = M.makeVerbSet(["Led", "organised", "Raised", "Tutored", "Designed", "Volunteered"]);
const L1 = [
  ["Raised 18,000 baht in a 3-week bake sale, which paid for 40 books.", true, []],
  ["Organized 3 stalls, resulting in 120 new visitors.", true, []],                        // US spelling accepted
  ["I was in the charity club.", false, ["verb", "number", "result"]],
  ["Tutored classmates in maths, so all of them passed.", false, ["number"]],
  ["Tutored 5 classmates in maths for a term.", false, ["result"]],
  ["Helped 30 patients find the clinic, which cut queues by half.", false, ["verb"]],
  ["Volunteered every Saturday for a year, helping 15 dogs find homes.", true, []],                 // duration words
  ["Led two teams, which won the regional cup.", true, []],                                                // number word
  ["", false, ["verb", "number", "result"]]
];
L1.forEach(([s, want, missing], i) => { const c = M.checkLine(s, V); eq("line " + i + " ok", c.ok, want); eq("line " + i + " missing", c.missing, missing); });
/* content-driven rule (digits only + marker list) */
const strict = { number: M.numberTester("\\d"), result: M.resultTester(["which", "resulting in", "so that"]) };
eq("strict: duration words not a number", M.checkLine("Volunteered every Saturday, which helped.", V, strict).slots.number, false);
eq("strict: marker list", M.checkLine("Led 3 teams, helping 9 people.", V, strict).slots.result, false);
eq("strict: pass", M.checkLine("Led 3 teams, resulting in 9 cup wins.", V, strict).ok, true);
/* review fixes: result clause must say what changed; ban list; word limit */
const LUc = C.rooms.lineUpgrader, LVc = M.makeVerbSet(LUc.verbBank);
const LOc = { number: M.numberTester(LUc.check && LUc.check.numberPattern), result: M.resultTester(LUc.check && LUc.check.resultMarkers),
  banned: M.clicheMatchers(C.rooms.clicheHunter.banList), maxWords: LUc.maxWords };
["Led 5 things which was good", "Organised 1 thing which", "led 4 people helping", "Led the club which has 30 members",
 "Organised a passion project for 3 months, which was a life-changing experience.", "Led 3 events, which was really fun for everyone"]
  .forEach((x) => eq("must fail: " + x, M.checkLine(x, LVc, LOc).ok, false));
eq("ban list reported", M.checkLine("Organised a passion project for 3 months, resulting in 40 new club members.", LVc, LOc).banned.length > 0, true);
eq("has + participle is a result", M.checkLine("Raised 5,000 baht, which has raised hopes for 3 schools.", LVc, LOc).ok, true);
eq("word limit", M.checkLine("Led " + "3 ".repeat(30) + "people, which raised 40 new books for the library", LVc, LOc).tooLong, !!LUc.maxWords);
eq("result must follow the verb", M.checkLine("Which 3 led", M.makeVerbSet(["Which"]), strict).slots.result, false);

/* ---------- 2. ban list ---------- */
const BAN = [{ id: "c01", cliche: "passion / passionate", replacement: "x" }, { id: "c02", cliche: "ever since I was a child", replacement: "x" },
  { id: "c03", cliche: "hard-working", replacement: "x", patterns: ["\\bhard[- ]?working\\b"] }];
const MS = M.clicheMatchers(BAN);
eq("ban: passionate", M.findBanned("I am passionate about it", MS).map((m) => m.id), ["c01"]);
eq("ban: curly quotes + case", M.findBanned("Ever since I was a child, I…", MS).map((m) => m.id), ["c02"]);
eq("ban: pattern variant", M.findBanned("a hardworking student", MS).map((m) => m.id), ["c03"]);
eq("ban: clean", M.findBanned("In Grade 9 I rebuilt a fan 14 times.", MS).length, 0);
eq("rewrite ok", M.checkRewrite("In Grade 9 I rebuilt our fan 14 times.", "passion", MS, 6, true).ok, true);
eq("rewrite banned", M.checkRewrite("I have a real passion for fixing 14 fans.", "passion", MS, 6, true).banned, ["passion / passionate"]);
eq("rewrite short", M.checkRewrite("Fixed fans.", "passion", MS, 6).short, true);
eq("rewrite needs detail", M.checkRewrite("I spent many weekends fixing old fans at home.", "passion", MS, 6, true).noDetail, true);
eq("detail: place name", M.hasDetail("I spent weekends at Siriraj fixing chairs."), true);
eq("detail: sentence start is not a name", M.hasDetail("It was fun. Then it ended."), false);
eq("spanIndex by id", M.spanIndex("c02", BAN), 1);
eq("spanIndex by text", M.spanIndex("hard-working", BAN), 2);
eq("spanIndex by number", M.spanIndex(0, BAN), 0);

/* ---------- 3. evidence audit flags ---------- */
const TY = [{ id: "certificate", verifiable: true }, { id: "link", verifiable: true, needsLink: true }, { id: "none", verifiable: false }];
eq("audit empty", M.auditFlags({}, TY).empty, true);
eq("audit ready", M.auditFlags({ experience: "x", scale: "35 dogs", type: "certificate" }, TY), { empty: false, unverifiable: false, noScale: false });
eq("audit none + no scale", M.auditFlags({ experience: "x", scale: "lots", type: "none" }, TY), { empty: false, unverifiable: true, noScale: true });
eq("audit link w/o url", M.auditFlags({ experience: "x", scale: "3", type: "link" }, TY).unverifiable, true);
eq("audit digits-only rule", M.auditFlags({ experience: "x", scale: "two years", type: "certificate" }, TY, M.numberTester("\\d")).noScale, true);

/* ---------- 4. codes ---------- */
const R1 = { room: "exitChecks", lesson: 9, score: 5, max: 6, bonus: 0, group: 3, seat: "B" };
const c1 = M.encodeResult(R1);
eq("result code shape", /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/.test(c1), true);
eq("result round trip", M.decodeResult(c1), Object.assign({ kind: "result" }, R1));
eq("result normalise (lower, O→0, no dash)", M.decodeResult(c1.toLowerCase().replace("-", "").replace(/0/g, "o")), Object.assign({ kind: "result" }, R1));
const R2 = { room: "lineUpgrader", lesson: 10, score: 17, max: 20, bonus: 11, group: 10, seat: "C" };
eq("result round trip 2", M.decodeResult(M.encodeResult(R2)), Object.assign({ kind: "result" }, R2));
let flips = 0;
for (let i = 0; i < 8; i++) {
  const s = c1.replace("-", "").split("");
  s[i] = M.B32[(M.B32.indexOf(s[i]) + 7) % 32];
  if (M.decodeResult(s.join("")) === null) flips++;
}
eq("single-character errors rejected (8/8)", flips, 8);
const K = { ratings: [3, 4, 2], rotation: 2, group: 7, seat: "A", minute: 615, day: M.dayOfYear(new Date(2026, 11, 15)) };
const kc = M.encodeRating(K);
eq("rating round trip", M.decodeRating(kc), { kind: "rating", ratings: [3, 4, 2], total: 9, rotation: 2, group: 7, seat: "A", minute: 615, day: K.day % 128 });
eq("rating is not a result", M.decodeResult(kc), null);
eq("result is not a rating", M.decodeRating(c1), null);
eq("decodeAny rating", M.decodeAny(kc).kind, "rating");
eq("day of year 15 Dec 2026", M.dayOfYear(new Date(2026, 11, 15)), 349);
const P = { rating: 3, round: 2, line: 4, group: 5, seat: "C", day: 336 };
const pc = M.encodePeer(P);
eq("peer code length", pc.length, 5);
eq("peer round trip", M.decodePeer(pc), { rating: 3, round: 2, line: 4, group: 5, seat: "C", day: 336 % 128 });
eq("peer rejects garbage", M.decodePeer("ZZZZZ"), null);
eq("result rejects wrong length", M.decodeResult("ABCDEFG"), null);
// exhaustive-ish: every rating combination survives
let rt = 0;
for (let a = 1; a <= 4; a++) for (let b = 1; b <= 4; b++) for (let c = 1; c <= 4; c++) for (let r = 1; r <= 6; r++) {
  const d = M.decodeRating(M.encodeRating({ ratings: [a, b, c], rotation: r, group: 1 + ((a + b + c + r) % 10), seat: "B", minute: 1439, day: 127 }));
  if (d && d.total === a + b + c && d.rotation === r) rt++;
}
eq("all 384 rating combinations round-trip", rt, 384);

/* ---------- 5. session code + clock ---------- */
const S = { pitch: 60, rate: 60, rotations: 4 };
eq("parse 1015P", M.parseSessionCode("1015P", S), { hh: 10, mm: 15, mode: "P", rotations: 4, code: "1015P", room: "pitchClock" });
eq("parse 1015p3 with spaces", M.parseSessionCode(" 10 15 p3", S).rotations, 3);
eq("parse rejects 7 rotations", M.parseSessionCode("1015P7", S), null);
eq("parse rejects 1 rotation", M.parseSessionCode("1015P1", S), null);
eq("parse rejects 2460P", M.parseSessionCode("2460P", S), null);
eq("parse rejects unknown mode", M.parseSessionCode("1015X", S), null);
eq("parse rejects MMI code", M.parseSessionCode("1000F2", S), null);
eq("make default", M.makeSessionCode({ hh: 9, mm: 5, mode: "P", rotations: 4 }, S), "0905P");
eq("make 6 rotations", M.makeSessionCode({ hh: 9, mm: 5, mode: "P", rotations: 6 }, S), "0905P6");
const cfg = M.parseSessionCode("1000P", S);
eq("rotation length = 4×60 + 15", M.rotationLength(cfg, S), 255);
eq("session length (no final move)", M.sessionLength(cfg, S), 255 * 4 - 15);
const at = (t) => { const c = M.sessionAtSeconds(cfg, t, S); return [c.phase, c.rotation, Math.round(c.remaining)]; };
eq("t=-30 before", at(-30), ["before", 1, 30]);
eq("t=0 pitchA", at(0), ["pitchA", 1, 60]);
eq("t=59 pitchA", at(59), ["pitchA", 1, 1]);
eq("t=60 rateA", at(60), ["rateA", 1, 60]);
eq("t=120 pitchB", at(120), ["pitchB", 1, 60]);
eq("t=180 rateB", at(180), ["rateB", 1, 60]);
eq("t=240 move", at(240), ["move", 1, 15]);
eq("t=255 rotation 2", at(255), ["pitchA", 2, 60]);
eq("t=1004 last second", at(1004), ["rateB", 4, 1]);
eq("t=1005 done", at(1005), ["done", 4, 0]);
const day = new Date(2026, 11, 15, 10, 1, 30).getTime();
eq("sessionAt wall clock", M.sessionAt(cfg, day, S).phase, "rateA");
eq("tasks stay line", ["pitchA", "rateA", "pitchB", "rateB", "move"].map((p) => M.pitchTask(p, "stay")), ["pitch", "wait", "listen", "rate", "move"]);
eq("tasks move line", ["pitchA", "rateA", "pitchB", "rateB", "move"].map((p) => M.pitchTask(p, "move")), ["listen", "rate", "pitch", "wait", "move"]);
const S2 = { pitch: 30, rate: 45, rotations: 4 };
eq("clock uses settings", M.sessionAtSeconds(cfg, 31, S2).phase, "rateA");
M.registerClock("T", { room: "teachBack", phases: () => [["talk", "Talk", 120], ["check", "Check", 60]], min: 2, max: 6 });
eq("registered clock parses", M.parseSessionCode("1100T", S).room, "teachBack");
eq("registered clock phases", M.sessionAtSeconds(M.parseSessionCode("1100T3", S), 130, S).phase, "check");

/* ---------- 6. exit-check scoring ---------- */
const ITEMS = [
  { id: "a", options: ["x", "y", "z", "w"], answer: 2 },
  { id: "b", options: ["Claim", "Evidence"], answer: "Evidence" },
  { id: "c", type: "cloze", prompt: "I ___ there.", answer: "have volunteered" },
  { id: "d", type: "cloze", prompt: "___ words", answer: "500", accept: ["five hundred"] }
];
eq("score all right", M.scoreExit(ITEMS, [2, 1, "Have volunteered.", "five hundred"]).score, 4);
const sc = M.scoreExit(ITEMS, [1, 1, "volunteered", null]);
eq("score partial", [sc.score, sc.max], [1, 4]);
eq("wrong review ids", sc.wrong.map((w) => w.id), ["a", "c", "d"]);
eq("wrong review key", sc.wrong[0].key, 2);
eq("cloze contraction", M.itemCorrect(ITEMS[2], "’ve volunteered"), true);
eq("cloze case + spaces", M.itemCorrect(ITEMS[2], "  HAVE   Volunteered "), true);
eq("cloze 've (straight quote)", M.itemCorrect(ITEMS[2], "'ve volunteered"), true);
eq("cloze wrong form", M.itemCorrect(ITEMS[2], "volunteered"), false);
const L094 = (C.rooms.exitChecks.L09 || []).find((x) => x.id === "L09-4");
if (L094) { eq("L09-4 accepts 've volunteered", M.itemCorrect(L094, "\u2019ve volunteered"), true); eq("L09-4 accepts Have volunteered", M.itemCorrect(L094, "Have volunteered"), true); }
eq("cloze 'I have volunteered'", M.itemCorrect({ type: "cloze", prompt: "I ___ at the clinic.", answer: "have volunteered" }, "I have volunteered"), true);
eq("cloze 'I've volunteered'", M.itemCorrect({ type: "cloze", prompt: "I ___ at the clinic.", answer: "have volunteered" }, "I've volunteered"), true);
eq("cloze number words", M.itemCorrect({ type: "cloze", prompt: "The limit is ___ words.", answer: "500" }, "five hundred"), true);
eq("cloze '500 words'", M.itemCorrect({ type: "cloze", prompt: "The limit is ___ words.", answer: "500" }, "500 words"), true);
eq("cloze wrong number", M.itemCorrect({ type: "cloze", prompt: "The limit is ___ words.", answer: "500" }, "four hundred and fifty"), false);
eq("wordsToNumber", [M.wordsToNumber("one thousand two hundred"), M.wordsToNumber("twenty-five"), M.wordsToNumber("dogs")], ["1200", "25", null]);
const L114 = (C.rooms.exitChecks.L11 || []).find((x) => x.id === "L11-4");
if (L114) { eq("L11-4 five hundred", M.itemCorrect(L114, "five hundred"), true); eq("L11-4 500 words", M.itemCorrect(L114, "500 words"), true); }
if (L094) eq("L09-4 I have volunteered", M.itemCorrect(L094, "I have volunteered"), true);
eq("cloze alternatives", M.clozeAnswers({ answer: "chance / opportunity" }), ["chance", "opportunity"]);

/* ---------- 7. line plan + tally ---------- */
const lines40 = Array.from({ length: 40 }, (_, i) => ({ id: "wl-" + String(i + 1).padStart(2, "0"), profession: ["business", "medicine", "dentistry", "veterinary", "engineering", "accounting", "design", "humanities"][Math.floor(i / 5)] }));
const plan = M.linePlan(lines40, 3, "B", 4, 5, "medicine");
eq("plan 4×5", plan.map((r) => r.length), [5, 5, 5, 5]);
eq("plan round 1 own field", plan[0].every((l) => l.profession === "medicine"), true);
eq("plan no repeats", new Set(plan.flat().map((l) => l.id)).size, 20);
const planC = M.linePlan(lines40, 3, "C", 4, 5, "medicine");
ok("neighbours differ after round 1", planC[1][0].id !== plan[1][0].id);
const plainPlan = M.linePlan(lines40.map((l) => ({ id: l.id })), 1, "A", 4, 5);
eq("plan halves without professions", [plainPlan[0][0].id, plainPlan[3][4].id], ["wl-21", "wl-40"]);
const codes = [
  M.encodeResult({ room: "lineUpgrader", lesson: 10, score: 12, max: 20, bonus: 6, group: 2, seat: "A" }),
  M.encodeResult({ room: "lineUpgrader", lesson: 10, score: 15, max: 20, bonus: 3, group: 2, seat: "A" }),
  M.encodeResult({ room: "lineUpgrader", lesson: 10, score: 10, max: 20, bonus: 2, group: 2, seat: "B" }),
  M.encodeResult({ room: "lineUpgrader", lesson: 10, score: 20, max: 20, bonus: 9, group: 7, seat: "C" }),
  M.encodeResult({ room: "exitChecks", lesson: 10, score: 6, max: 6, bonus: 0, group: 7, seat: "A" }),
  "NOT-A-CODE"
];
eq("tally", M.tally(codes, "lineUpgrader"), [{ group: 2, points: 30, members: 2, seats: ["A", "B"] }, { group: 7, points: 29, members: 1, seats: ["C"] }]);

/* ---------- 7b. attempt / wrong-tap carried in result codes ---------- */
eq("exit attempt in code", M.decodeResult(M.encodeResult({ room: "exitChecks", lesson: 11, score: 4, max: 6, bonus: 2, group: 1, seat: "A" })).bonus, 2);
eq("hunter misses in code", M.decodeResult(M.encodeResult({ room: "clicheHunter", lesson: 11, score: 9, max: 13, bonus: 7, group: 1, seat: "A" })).bonus, 7);
eq("witness example is female", JSON.stringify(C.rooms.evidenceAudit).includes("Somchai"), false);
eq("result feedback lists all markers", (LUc.check.resultMarkers || []).every((m) => ((LUc.feedback || {}).result || "").includes(m)), true);

/* ---------- 8. QR (copied encoder still works) ---------- */
const q = QR.encode("https://pegasus028.github.io/ELF/#k-ABCDEFGH");
ok("QR encodes app link", q && q.size >= 21);

/* ---------- 9. content: contract and room data ---------- */
const R = C.rooms;
eq("meta course", C.meta.course, "EN33207");
eq("pitch defaults", [C.settings.pitchClock.pitch, C.settings.pitchClock.rate, C.settings.pitchClock.rotations], [60, 60, 4]);
eq("10 groups", C.groups.map((g) => g.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
eq("group professions", C.groups.map((g) => g.profession), ["business", "business", "medicine", "medicine", "dentistry", "veterinary", "engineering", "accounting", "design", "humanities"]);
C.groups.forEach((g) => ok("profession exists " + g.profession, C.professions[g.profession] && C.professions[g.profession].words.length === 15));
eq("room keys", ["evidenceAudit", "lineUpgrader", "clicheHunter", "peerReview", "pitchClock", "questionCards", "exitChecks"].filter((k) => k in R).length, 7);
eq("rooms registered in codes", M.ROOM_IDS.slice(0, 7), ["evidenceAudit", "lineUpgrader", "clicheHunter", "peerReview", "pitchClock", "questionCards", "exitChecks"]);
const lu = R.lineUpgrader;
eq("verb bank 60", lu.verbBank.length, 60);
eq("40 lines", lu.lines.length, 40);
eq("line ids unique", new Set(lu.lines.map((l) => l.id)).size, 40);
const LV = M.makeVerbSet(lu.verbBank);
const LO = { number: M.numberTester(lu.check && lu.check.numberPattern), result: M.resultTester(lu.check && lu.check.resultMarkers) };
const badModels = lu.lines.filter((l) => !M.checkLine(l.model, LV, LO).ok).map((l) => l.id);
eq("every model upgrade passes the structural check", badModels, []);
const passingWeak = lu.lines.filter((l) => M.checkLine(l.weak, LV, LO).ok).map((l) => l.id);
eq("no weak line passes", passingWeak, []);
const ch = R.clicheHunter, CM = M.clicheMatchers(ch.banList);
eq("ban list 30", ch.banList.length, 30);
eq("10 spans", ch.text.spans.length, 10);
const spanProblems = ch.text.spans.filter(([s, e, id]) => {
  const bi = M.spanIndex(id, ch.banList);
  return !(s >= 0 && e <= ch.text.body.length && s < e && bi >= 0 && CM[bi].res.some((re) => re.test(M.norm(ch.text.body.slice(s, e)))));
});
eq("every span is its ban-list cliché", spanProblems, []);
const sorted = ch.text.spans.slice().sort((a, b) => a[0] - b[0]);
ok("spans do not overlap", sorted.every((sp, i) => i === 0 || sp[0] >= sorted[i - 1][1]));
eq("ban list finds exactly the spanned clichés in the text", M.findBanned(ch.text.body, CM).map((m) => m.id).sort(), ch.text.spans.map((s) => String(s[2])).sort());
const modelClichés = lu.lines.filter((l) => M.findBanned(l.model, CM).length).map((l) => l.id);
eq("no model line uses a banned cliché", modelClichés, []);
const banReplacementsClean = ch.banList.filter((b) => !b.replacement || !b.replacement.trim()).length;
eq("every cliché has a replacement", banReplacementsClean, 0);
eq("peer-review questions", R.peerReview.questions.length, 5);
eq("pitch criteria", R.pitchClock.criteria.length, 3);
ok("pitch criteria have 4 levels", R.pitchClock.criteria.every((c) => typeof c === "string" || (c.levels || c.anchors || []).length === 4));
eq("question cards", R.questionCards.length, 12);
eq("exit-check lessons", Object.keys(R.exitChecks).sort(), ["L09", "L10", "L11", "L12", "L13"]);
Object.entries(R.exitChecks).forEach(([L, items]) => {
  eq(L + " has 6 items", items.length, 6);
  items.forEach((it) => {
    if (M.isCloze(it)) ok(L + " " + it.id + " cloze has gap + answer", /___/.test(it.prompt || it.stem) && M.clozeAnswers(it).length);
    else { const k = M.answerIndex(it); ok(L + " " + it.id + " key in range", k >= 0 && k < it.options.length); ok(L + " " + it.id + " options unique", new Set(it.options).size === it.options.length); }
  });
});
const ea = R.evidenceAudit;
ok("evidence types include a 'none' type", ea.evidenceTypes.some((x) => (x.id || x.key) === "none" || x.verifiable === false || /^none/i.test(x)));
ok("flags present", ea.flags.unverifiable && ea.flags.noScale);

/* ---------- 10. every on-screen string key is in uiText ---------- */
const all = UI.collect();
const missingUi = Object.keys(all).filter((k) => !(k in C.uiText));
eq("uiText has every key used by the code", missingUi, []);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
