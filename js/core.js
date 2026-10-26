/* ELF Studio — core logic (no DOM).
 * Line checker, ban-list matcher, codes, session clock, exit-check scoring, tallies.
 * Works in the browser (window.ELFCore) and in Node (require('./core.js')).
 * Tests: tests/run-tests.js. Decisions: DECISIONS.md.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ELFCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SEATS = ["A", "B", "C"];
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (s) => {
    s = Math.max(0, Math.ceil(s));
    return pad(Math.floor(s / 60)) + ":" + pad(s % 60);
  };
  const norm = (s) => String(s == null ? "" : s)
    .replace(/[‘’ʼ]/g, "'").replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-").replace(/\s+/g, " ").trim().toLowerCase();
  const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  /* ---------- Line Upgrader: structural check ---------- */
  const NUMBER_WORDS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve",
    "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen", "twenty", "thirty", "forty", "fifty",
    "sixty", "seventy", "eighty", "ninety", "hundred", "hundreds", "thousand", "thousands", "million", "dozen", "dozens",
    "half", "once", "twice", "double", "doubled", "tripled"];
  const DURATION = /\b(weekly|monthly|daily|yearly|annually|fortnightly|every\s+(day|week|weekend|month|term|semester|year|morning|evening|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i;
  const RESULT = /\b(resulting in|result(ed)? in|which|that (led|helped|raised|cut|reduced|increased|saved|showed|meant|gave|earned|won|doubled|halved|improved|brought)|leading to|led to|so that|so|helping|enabling|allowing|raising|cutting|reducing|increasing|saving|earning|winning|giving|improving|boosting|attracting|bringing|growing|expanding|doubling|halving|lifting|lowering|getting|thereby|and (raised|cut|reduced|increased|saved|won|earned|doubled|halved|improved|reached|attracted))\b/i;
  const SLOT_IDS = ["verb", "number", "result"];

  /** Normalise a verb for bank comparison: lower case, US -ize/-yze → -ise/-yse. */
  function verbKey(w) {
    return norm(w).replace(/[^a-z'-]/g, "").replace(/iz(e|ed|es|ing)$/, "is$1").replace(/yz(e|ed|es|ing)$/, "ys$1");
  }
  function makeVerbSet(bank) {
    const set = new Set();
    (bank || []).forEach((v) => {
      const s = typeof v === "string" ? v : (v && (v.verb || v.word)) || "";
      s.split(/[\/,]/).forEach((x) => { const k = verbKey(x.trim().split(" ")[0]); if (k) set.add(k); });
    });
    return set;
  }
  function hasNumber(text) {
    const t = norm(text);
    if (/\d/.test(t)) return true;
    const words = t.split(/[^a-z-]+/);
    if (words.some((w) => NUMBER_WORDS.includes(w) || w.split("-").some((p) => NUMBER_WORDS.includes(p)))) return true;
    return DURATION.test(t);
  }
  /** Number test: a RegExp from the content (rooms.lineUpgrader.check.numberPattern) or the built-in rule. */
  function numberTester(pattern) {
    if (!pattern) return hasNumber;
    const re = new RegExp(pattern, "i");
    return (text) => re.test(String(text == null ? "" : text));
  }
  /** Result-clause test: whole-phrase markers from the content (check.resultMarkers) or the built-in list. */
  const EVALUATIVE = /^(was|is|were|are|be|been)\b|^(very|really|so)\s+(good|great|fun|nice)\b|^(good|great|fun|nice|amazing|interesting|helpful|useful)\b/;
  const PERFECT_OK = /(ed|en)$|^(won|grown|cut|brought|taught|built|made|given|become|run|led|met|sold|raised|spent|kept)$/;
  /** What follows a result marker must say what changed: at least 3 words, not an evaluation
   *  ("was good", "is fun") and not a description ("has 30 members"); "has raised 5,000 baht" is fine. */
  function resultClauseOk(after) {
    const w = norm(after).replace(/[^a-z0-9%,.'\s-]/g, " ").replace(/[,.]+(\s|$)/g, " ").trim().split(/\s+/).filter(Boolean);
    if (w.length < 3) return false;
    const head = w.join(" ");
    if (EVALUATIVE.test(head)) return false;
    if (/^(has|had|have)$/.test(w[0]) && !PERFECT_OK.test(w[1] || "")) return false;
    return true;
  }
  function resultTester(markers) {
    const src = markers && markers.length ? "\\b(" + markers.map((m) => reEsc(norm(m))).join("|") + ")\\b" : RESULT.source;
    return (rest) => {
      const t = norm(rest), re = new RegExp(src, "gi");
      let m;
      while ((m = re.exec(t))) { if (resultClauseOk(t.slice(m.index + m[0].length))) return true; if (m[0].length === 0) re.lastIndex++; }
      return false;
    };
  }
  /**
   * Checks a CV activity line: starts with a verb from the bank, contains a number or duration,
   * contains a result clause (after the first word) that says what changed, uses no banned cliché and
   * (when maxWords is set) stays within the word limit. opts: {number: fn, result: fn, banned: matchers, maxWords}.
   * Returns {ok, slots:{verb,number,result}, missing:[...], firstWord, words}.
   */
  function checkLine(text, verbSet, opts) {
    const o = opts || {};
    const numberOk = o.number || hasNumber, resultOk = o.result || resultTester(null);
    const t = String(text == null ? "" : text).trim();
    const words = t ? t.split(/\s+/) : [];
    const first = words.length ? verbKey(words[0]) : "";
    const rest = words.slice(1).join(" ");
    const slots = {
      verb: !!first && verbSet.has(first),
      number: numberOk(t),
      result: resultOk(rest)
    };
    const missing = SLOT_IDS.filter((k) => !slots[k]);
    const banned = o.banned ? findBanned(t, o.banned).map((b) => b.cliche) : [];
    const tooLong = !!o.maxWords && words.length > o.maxWords;
    return { ok: missing.length === 0 && words.length >= 4 && !banned.length && !tooLong, slots, missing, banned, tooLong, firstWord: words[0] || "", words: words.length };
  }

  /* ---------- Cliché Hunter: ban-list matcher ---------- */
  /** Ban-list matchers. An item's `patterns` (regex strings) are used when present; otherwise its
   *  cliché text: "a / b" = alternatives, "a … b" = both in order, a single word also matches its longer forms. */
  function clicheMatchers(banList) {
    return (banList || []).map((b, i) => {
      const raw = typeof b === "string" ? b : b.cliche;
      let res;
      if (b && Array.isArray(b.patterns) && b.patterns.length) res = b.patterns.map((p) => new RegExp(p, "i"));
      else {
        const alts = String(raw).split(/\s*\/\s*/).filter(Boolean);
        res = alts.map((a) => {
          const parts = norm(a).replace(/[()"]/g, "").split(/\s*(?:\u2026|\.\.\.)\s*/).filter(Boolean);
          const src = parts.map((p) => {
            const single = !/\s/.test(p);
            return "\\b" + reEsc(p) + (single ? "" : "\\b");
          }).join(".*?");
          return new RegExp(src, "i");
        });
      }
      return { i, id: (b && b.id) || String(i), cliche: raw, res };
    });
  }
  /** Returns the ban-list entries found in the text. */
  function findBanned(text, matchers) {
    const t = norm(text);
    return matchers.filter((m) => m.res.some((r) => r.test(t)));
  }
  /** A concrete detail: a digit, or a capitalised word that does not start a sentence and is not "I". */
  function hasDetail(text) {
    const t = String(text || "");
    if (/\d/.test(t)) return true;
    const words = t.split(/\s+/);
    return words.some((w, i) => i > 0 && /^[A-Z][a-z]/.test(w.replace(/^["'(‘“]/, "")) && !/[.!?]["')’”]?$/.test(words[i - 1]) && !/^I('|’|$)/.test(w));
  }
  /** A rewrite is accepted when it has ≥ minWords words, contains no banned item, is not the original,
   *  and (when requireDetail) contains a concrete detail. */
  function checkRewrite(text, original, matchers, minWords, requireDetail) {
    const t = String(text || "").trim();
    const words = t ? t.split(/\s+/).length : 0;
    const banned = findBanned(t, matchers);
    const same = norm(t) === norm(original);
    const short = words < (minWords || 6);
    const noDetail = !!requireDetail && !hasDetail(t);
    return { ok: !banned.length && !same && !short && !noDetail, banned: banned.map((b) => b.cliche), same, short, noDetail, words };
  }
  /** Resolve a span's cliché reference (id, index or the cliché text) to a ban-list index. */
  function spanIndex(ref, banList) {
    if (typeof ref === "number") return ref >= 0 && ref < banList.length ? ref : -1;
    const r = String(ref);
    let i = banList.findIndex((b) => b && b.id === r);
    if (i < 0) i = banList.findIndex((b) => norm(typeof b === "string" ? b : b.cliche) === norm(r));
    if (i < 0 && /^\d+$/.test(r) && +r < banList.length) i = +r;
    return i;
  }

  /* ---------- Evidence Audit flags ---------- */
  /** row: {experience, role, when, scale, type, link}; types: normalised evidence types [{id, verifiable, needsLink}] */
  function auditFlags(row, types, numberOk) {
    const filled = ["experience", "role", "when", "scale", "type", "link"].some((k) => String(row[k] || "").trim());
    if (!filled) return { empty: true, unverifiable: false, noScale: false };
    const ty = (types || []).find((x) => x.id === row.type);
    const unverifiable = !ty || ty.verifiable === false || (!!ty.needsLink && !String(row.link || "").trim());
    const noScale = !(numberOk || hasNumber)(row.scale || "");
    return { empty: false, unverifiable, noScale };
  }

  /* ---------- codes (Crockford base32, mod-31 check) ---------- */
  const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  function packBits(fields) {
    let n = 0n;
    for (const [v, b] of fields) {
      if (v < 0 || v >= 2 ** b || !Number.isInteger(v)) throw new RangeError("field out of range");
      n = (n << BigInt(b)) | BigInt(v);
    }
    return n;
  }
  function toB32(n, chars) {
    let s = "";
    for (let i = 0; i < chars; i++) { s = B32[Number(n & 31n)] + s; n >>= 5n; }
    return s;
  }
  function normalizeCode(code) {
    return String(code == null ? "" : code).toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1").replace(/U/g, "V");
  }
  function fromB32(s) {
    let n = 0n;
    for (const ch of s) {
      const i = B32.indexOf(ch);
      if (i < 0) return null;
      n = (n << 5n) | BigInt(i);
    }
    return n;
  }
  function withCheck(payload, payloadBits, chars) {
    const n = (payload << 5n) | (payload % 31n);
    return toB32(n << BigInt(chars * 5 - payloadBits - 5), chars);
  }
  function stripCheck(code, payloadBits, chars) {
    const s = normalizeCode(code);
    if (s.length !== chars) return null;
    let n = fromB32(s);
    if (n === null) return null;
    const padBits = chars * 5 - payloadBits - 5;
    if (padBits && (n & ((1n << BigInt(padBits)) - 1n)) !== 0n) return null;
    n >>= BigInt(padBits);
    const ck = n & 31n;
    n >>= 5n;
    if (n % 31n !== ck) return null;
    return n;
  }
  function taker(n) {
    return (b) => { const v = Number(n.v & ((1n << BigInt(b)) - 1n)); n.v >>= BigInt(b); return v; };
  }
  const group8 = (s) => s.slice(0, 4) + "-" + s.slice(4);
  const dayOfYear = (d) => {
    const x = new Date(d);
    const start = new Date(x.getFullYear(), 0, 1);
    return Math.floor((new Date(x.getFullYear(), x.getMonth(), x.getDate()) - start) / 86400000) + 1;
  };

  /* Room numbers used inside result codes. Later phases append; never renumber. */
  const ROOM_IDS = ["evidenceAudit", "lineUpgrader", "clicheHunter", "peerReview", "pitchClock", "questionCards", "exitChecks"];
  const roomNo = (key) => ROOM_IDS.indexOf(key);

  /**
   * Result code (8 chars, 40 bits): kind 1 (=0) · room 5 · lesson 5 · score 6 · max 6 · bonus 6 · group 4 · seat 2 · check 5.
   * r: {room, lesson, score, max, bonus, group (1–10), seat ('A'–'C')}
   */
  function encodeResult(r) {
    const room = typeof r.room === "number" ? r.room : roomNo(r.room);
    const p = packBits([[0, 1], [room, 5], [r.lesson, 5], [Math.min(63, r.score), 6], [Math.min(63, r.max), 6], [Math.min(63, r.bonus || 0), 6], [r.group, 4], [SEATS.indexOf(r.seat), 2]]);
    return group8(withCheck(p, 35, 8));
  }
  function decodeResult(code) {
    const n = stripCheck(code, 35, 8);
    if (n === null) return null;
    const t = taker({ v: n });
    const seat = t(2), group = t(4), bonus = t(6), max = t(6), score = t(6), lesson = t(5), room = t(5), kind = t(1);
    if (kind !== 0 || group < 1 || group > 10 || seat > 2 || score > max || room >= 32) return null;
    return { kind: "result", room: ROOM_IDS[room] || room, lesson, score, max, bonus, group, seat: SEATS[seat] };
  }

  /**
   * Pitch rating code (8 chars, 40 bits): kind 1 (=1) · three criteria 2 bits each (rating − 1) · rotation 3 ·
   * rater group 4 · rater seat 2 · session minute 11 (hh*60+mm, 0 = practice) · day tag 7 (day of year mod 128) · check 5.
   */
  function encodeRating(r) {
    const p = packBits([[1, 1], [r.ratings[0] - 1, 2], [r.ratings[1] - 1, 2], [r.ratings[2] - 1, 2], [r.rotation, 3],
      [r.group, 4], [SEATS.indexOf(r.seat), 2], [r.minute, 11], [r.day % 128, 7]]);
    return group8(withCheck(p, 35, 8));
  }
  function decodeRating(code) {
    const n = stripCheck(code, 35, 8);
    if (n === null) return null;
    const t = taker({ v: n });
    const day = t(7), minute = t(11), seat = t(2), group = t(4), rotation = t(3), c3 = t(2), c2 = t(2), c1 = t(2), kind = t(1);
    if (kind !== 1 || group < 1 || group > 10 || seat > 2 || rotation < 1 || rotation > 6 || minute > 1439) return null;
    const ratings = [c1 + 1, c2 + 1, c3 + 1];
    return { kind: "rating", ratings, total: ratings[0] + ratings[1] + ratings[2], rotation, group, seat: SEATS[seat], minute, day };
  }
  /** Either kind of 8-character code. */
  function decodeAny(code) {
    return decodeResult(code) || decodeRating(code);
  }

  /**
   * Peer line code (5 chars, 25 bits): rating 2 (1–3) · round 2 (0–3) · line 3 (0–4) · rater group 4 · rater seat 2 · day tag 7 · check 5.
   */
  function encodePeer(r) {
    const p = packBits([[r.rating, 2], [r.round - 1, 2], [r.line - 1, 3], [r.group, 4], [SEATS.indexOf(r.seat), 2], [r.day % 128, 7]]);
    return withCheck(p, 20, 5);
  }
  function decodePeer(code) {
    const n = stripCheck(code, 20, 5);
    if (n === null) return null;
    const t = taker({ v: n });
    const day = t(7), seat = t(2), group = t(4), line = t(3), round = t(2), rating = t(2);
    if (rating < 1 || line > 4 || group < 1 || group > 10 || seat > 2) return null;
    return { rating, round: round + 1, line: line + 1, group, seat: SEATS[seat], day };
  }

  /* ---------- session clock: HHMM + mode letter [+ rotations] ---------- */
  const MOVE_SEC = 15;
  const CLOCKS = {
    /* Pitch Clock. Each rotation: stay line pitches, move line rates, move line pitches, stay line rates, move. */
    P: {
      room: "pitchClock",
      phases: (s) => [
        ["pitchA", "Stay line pitches", s.pitch],
        ["rateA", "Move line rates", s.rate],
        ["pitchB", "Move line pitches", s.pitch],
        ["rateB", "Stay line rates", s.rate],
        ["move", "Move one place", MOVE_SEC]
      ],
      min: 2, max: 6
    }
  };
  /** Later phases add a clock: registerClock('T', {room, phases(settings), min, max}). */
  function registerClock(letter, def) { CLOCKS[letter] = def; }

  function parseSessionCode(raw, defaults) {
    const s = String(raw == null ? "" : raw).toUpperCase().replace(/[^0-9A-Z]/g, "");
    const m = s.match(/^(\d{2})(\d{2})([A-Z])(\d?)$/);
    if (!m) return null;
    const hh = +m[1], mm = +m[2], mode = m[3];
    const def = CLOCKS[mode];
    if (!def || hh > 23 || mm > 59) return null;
    const d = defaults || {};
    const rotations = m[4] ? +m[4] : (d.rotations || 4);
    if (rotations < def.min || rotations > def.max) return null;
    return { hh, mm, mode, rotations, code: s, room: def.room };
  }
  function makeSessionCode(c, defaults) {
    const d = defaults || {};
    return pad(c.hh) + pad(c.mm) + c.mode + (c.rotations && c.rotations !== (d.rotations || 4) ? c.rotations : "");
  }
  function clockPhases(cfg, settings) {
    return CLOCKS[cfg.mode].phases(settings || { pitch: 60, rate: 60 });
  }
  function rotationLength(cfg, settings) {
    return clockPhases(cfg, settings).reduce((a, p) => a + p[2], 0);
  }
  /** Total session length: the final move phase is not counted. */
  function sessionLength(cfg, settings) {
    const ph = clockPhases(cfg, settings);
    const last = ph[ph.length - 1];
    return rotationLength(cfg, settings) * cfg.rotations - (last[0] === "move" ? last[2] : 0);
  }
  function sessionAtSeconds(cfg, t, settings) {
    if (t < 0) return { phase: "before", label: "Starts in", remaining: -t, total: -t, elapsed: 0, rotation: 1 };
    const ph = clockPhases(cfg, settings);
    const len = rotationLength(cfg, settings);
    const k = Math.floor(t / len);
    if (t >= sessionLength(cfg, settings) || k >= cfg.rotations) return { phase: "done", label: "Session complete", remaining: 0, total: 1, elapsed: 1, rotation: cfg.rotations };
    let w = t - k * len;
    for (const [key, label, dur] of ph) {
      if (w < dur) return { phase: key, label, remaining: dur - w, total: dur, elapsed: w, rotation: k + 1 };
      w -= dur;
    }
    return { phase: "move", label: "Move one place", remaining: 0, total: 1, elapsed: 1, rotation: k + 1 };
  }
  function sessionStart(cfg, now) {
    const d = new Date(now);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), cfg.hh, cfg.mm, 0, 0).getTime();
  }
  function sessionAt(cfg, now, settings) {
    if (now == null) now = Date.now();
    return sessionAtSeconds(cfg, (now - sessionStart(cfg, now)) / 1000, settings);
  }
  /** What a student on a given line does in a phase: 'pitch' | 'listen' | 'rate' | 'wait' | 'move' | phase. */
  function pitchTask(phase, line) {
    const stay = line !== "move";
    switch (phase) {
      case "pitchA": return stay ? "pitch" : "listen";
      case "rateA": return stay ? "wait" : "rate";
      case "pitchB": return stay ? "listen" : "pitch";
      case "rateB": return stay ? "rate" : "wait";
      default: return phase;
    }
  }

  /* ---------- exit checks ---------- */
  /** Index of the correct option: answer may be an index or the option text. */
  function answerIndex(item) {
    if (typeof item.answer === "number") return item.answer;
    return (item.options || []).findIndex((o) => norm(o) === norm(item.answer));
  }
  const isCloze = (item) => item.type === "cloze" || !(item.options && item.options.length);
  const clozeNorm = (s) => norm(s).replace(/[.!?,;:"]+$/g, "").replace(/^[\s"]+|[\s"]+$/g, "")
    .replace(/\b(i|you|we|they)'ve\b/g, "$1 have").replace(/(^|\s)'ve\b/g, "$1have").replace(/\b(\w+)n't\b/g, "$1 not");
  /** Accepted answers for a gap: `answer` (alternatives split on " / " or "|") plus any `accept` list. */
  function clozeAnswers(item) {
    const list = String(item.answer == null ? "" : item.answer).split(/\s+\/\s+|\|/).concat(item.accept || []);
    return list.map(clozeNorm).filter(Boolean);
  }
  const NUMS = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
    thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40,
    fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
  /** "five hundred" → "500", "one thousand two hundred" → "1200"; returns null if it isn't a number phrase. */
  function wordsToNumber(s) {
    const w = s.replace(/-/g, " ").replace(/\band\b/g, " ").trim().split(/\s+/);
    if (!w[0]) return null;
    let total = 0, cur = 0;
    for (const x of w) {
      if (x in NUMS) cur += NUMS[x];
      else if (x === "hundred") cur = (cur || 1) * 100;
      else if (x === "thousand") { total += (cur || 1) * 1000; cur = 0; }
      else return null;
    }
    return String(total + cur);
  }
  /** Forms of a typed gap answer to try: as typed; without a leading subject the stem already has
   *  ("I have volunteered" for "I ___"); without the word that follows the gap ("500 words" for "___ words");
   *  number words as digits. */
  function clozeVariants(item, given) {
    const g = clozeNorm(given), out = new Set([g]);
    const stem = norm(item.prompt || item.stem || "");
    const before = (stem.split("___")[0] || "").trim().split(/\s+/).pop() || "";
    const after = ((stem.split("___")[1] || "").trim().split(/\s+/)[0] || "").replace(/[^a-z']/g, "");
    out.forEach((v) => { if (before && v.startsWith(before.replace(/[^a-z']/g, "") + " ")) out.add(v.slice(before.replace(/[^a-z']/g, "").length + 1)); });
    Array.from(out).forEach((v) => { if (/^i have /.test(v)) out.add(v.slice(2)); });
    Array.from(out).forEach((v) => { if (after && v.endsWith(" " + after)) out.add(v.slice(0, -after.length - 1)); });
    Array.from(out).forEach((v) => { const n = wordsToNumber(v); if (n) out.add(n); });
    return Array.from(out).map((v) => v.trim()).filter(Boolean);
  }
  function itemCorrect(item, given) {
    if (given == null || given === "") return false;
    if (isCloze(item)) { const ok = clozeAnswers(item); return clozeVariants(item, given).some((v) => ok.includes(v)); }
    return +given === answerIndex(item);
  }
  /** answers: chosen option indices or typed gap answers (null = unanswered). */
  function scoreExit(items, answers) {
    const review = items.map((it, i) => {
      const got = answers[i] == null ? null : answers[i];
      return { i, id: it.id, key: isCloze(it) ? it.answer : answerIndex(it), got, ok: itemCorrect(it, got), cloze: isCloze(it) };
    });
    return { score: review.filter((r) => r.ok).length, max: items.length, wrong: review.filter((r) => !r.ok), review };
  }

  /* ---------- Line Upgrader rounds and trio tally ---------- */
  /** Picks rounds × perRound lines. Lines with a `round` field are used as given. Lines tagged with a
   *  `profession`: round 1 is the student's own field, later rounds take other fields, rotated by group and
   *  seat so neighbours get different lines. Otherwise, with ≥ 2 × the lines needed, alternate halves. */
  function linePlan(lines, group, seat, rounds, perRound, prof) {
    rounds = rounds || 4; perRound = perRound || 5;
    const need = rounds * perRound;
    let pool = lines.slice();
    if (lines.some((l) => l.round)) {
      const out = [];
      for (let r = 1; r <= rounds; r++) out.push(lines.filter((l) => +l.round === r).slice(0, perRound));
      if (out.every((x) => x.length === perRound)) return out;
    }
    if (prof && lines.some((l) => l.profession)) {
      const own = lines.filter((l) => l.profession === prof);
      const other = lines.filter((l) => l.profession !== prof);
      const k = other.length ? ((group - 1) * 3 + SEATS.indexOf(seat)) * perRound % other.length : 0;
      pool = own.concat(other.slice(k), other.slice(0, k)).slice(0, need);
    } else if (lines.length >= need * 2) {
      const half = (group + SEATS.indexOf(seat)) % 2;
      pool = lines.slice(half * need, half * need + need);
    }
    const out = [];
    for (let r = 0; r < rounds; r++) out.push(pool.slice(r * perRound, r * perRound + perRound));
    return out;
  }
  /** codes → per-group totals. Keeps the best code per group+seat. Returns sorted [{group, points, members, seats}]. */
  function tally(codes, room) {
    const best = {};
    (codes || []).forEach((c) => {
      const r = typeof c === "string" ? decodeResult(c) : c;
      if (!r || (room && r.room !== room)) return;
      const k = r.group + r.seat;
      const pts = r.score + (r.bonus || 0);
      if (!best[k] || pts > best[k].pts) best[k] = { group: r.group, seat: r.seat, pts };
    });
    const groups = {};
    Object.values(best).forEach((b) => {
      const g = groups[b.group] || (groups[b.group] = { group: b.group, points: 0, members: 0, seats: [] });
      g.points += b.pts; g.members += 1; g.seats.push(b.seat);
    });
    return Object.values(groups).map((g) => Object.assign(g, { seats: g.seats.sort() })).sort((a, b) => b.points - a.points || a.group - b.group);
  }

  function shuffle(arr, rnd) {
    const a = arr.slice();
    const r = rnd || Math.random;
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const isoDate = (d) => { const x = new Date(d == null ? Date.now() : d); return x.getFullYear() + "-" + pad(x.getMonth() + 1) + "-" + pad(x.getDate()); };

  return {
    SEATS, B32, MOVE_SEC, ROOM_IDS, CLOCKS, pad, fmt, norm, isoDate, dayOfYear, shuffle,
    makeVerbSet, verbKey, hasNumber, numberTester, resultTester, checkLine, hasDetail,
    clicheMatchers, findBanned, checkRewrite, spanIndex, auditFlags,
    normalizeCode, encodeResult, decodeResult, encodeRating, decodeRating, decodeAny, encodePeer, decodePeer, roomNo,
    registerClock, parseSessionCode, makeSessionCode, clockPhases, rotationLength, sessionLength, sessionAtSeconds, sessionStart, sessionAt, pitchTask,
    answerIndex, isCloze, clozeAnswers, clozeVariants, wordsToNumber, itemCorrect, resultClauseOk, scoreExit, linePlan, tally
  };
});
