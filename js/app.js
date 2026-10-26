/* ELF Studio — shell: setup, router, Rooms home, My scores, Teacher, storage, gradebook.
 * Rooms live in js/rooms/*.js and register themselves with ELF.registerRoom().
 * Every on-screen string goes through t(key, default); the JSON's uiText overrides the default.
 */
(function () {
  "use strict";
  const M = window.ELFCore, QR = window.MMIQR, CONFIG = window.ELF_CONFIG || {};
  const app = document.getElementById("app");
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => Array.from((el || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- storage: localStorage with an in-memory fallback ---------- */
  const MEM = {};
  const store = {
    get(k, d) {
      try { const v = localStorage.getItem(k); if (v !== null) return JSON.parse(v); } catch (e) { /* storage blocked */ }
      return Object.prototype.hasOwnProperty.call(MEM, k) ? MEM[k] : d;
    },
    set(k, v) {
      MEM[k] = v;
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* kept in memory */ }
    }
  };

  /* ---------- text ---------- */
  let C = null, U = {};
  function t(key, def, vars) {
    let s = Object.prototype.hasOwnProperty.call(U, key) ? U[key] : def;
    if (s == null) s = key;
    if (vars) Object.keys(vars).forEach((k) => { s = s.split("{" + k + "}").join(vars[k]); });
    return s;
  }

  /* ---------- setup ---------- */
  const SETUP_KEY = "elf.setup";
  const groupInfo = (g) => (C.groups || []).find((x) => +x.id === +g);
  const profLabel = (g) => { const gi = groupInfo(g); if (!gi) return ""; return gi.label || (C.professions[gi.profession] || {}).label || gi.profession; };
  function getSetup() { const s = store.get(SETUP_KEY, null); return s && s.name && groupInfo(s.group) && M.SEATS.includes(s.seat) ? s : null; }

  /* ---------- rooms registry ---------- */
  const ROOMS = [];
  function registerRoom(def) { ROOMS.push(def); ROOMS.sort((a, b) => a.order - b.order); }
  const roomDef = (key) => ROOMS.find((r) => r.key === key);
  const roomTitle = (key) => { const d = C && C.rooms && C.rooms[key]; return d && typeof d.title === "string" ? d.title : t("room." + key + ".title", (roomDef(key) || {}).title || key); };
  const roomState = (key, d) => store.get("elf.room." + key, d);
  const setRoomState = (key, v) => store.set("elf.room." + key, v);

  /* ---------- results + gradebook ---------- */
  const RESULTS = "elf.results";
  function results(room, lesson) {
    return store.get(RESULTS, []).filter((r) => (!room || r.room === room) && (lesson == null || r.lesson === lesson));
  }
  function best(list) { return list.reduce((b, r) => (!b || r.score / r.max > b.score / b.max || (r.score / r.max === b.score / b.max && (r.bonus || 0) > (b.bonus || 0)) ? r : b), null); }
  /** Saves an auto-marked result, returns its code, and posts it if a gradebook is set. */
  function saveResult(r, opts) {
    const su = getSetup();
    const code = M.encodeResult({ room: r.room, lesson: r.lesson, score: r.score, max: r.max, bonus: r.bonus || 0, group: su.group, seat: su.seat });
    const row = { room: r.room, lesson: r.lesson, score: r.score, max: r.max, bonus: r.bonus || 0, code, date: M.isoDate(), at: Date.now() };
    const all = store.get(RESULTS, []);
    all.push(row);
    store.set(RESULTS, all.slice(-300));
    if (r.attempt) row.attempt = r.attempt;
    if (!opts || opts.post !== false) post({ room: r.room, lesson: r.lesson, score: r.score, max: r.max, code, attempt: r.attempt });
    return code;
  }
  function post(r) {
    if (!CONFIG.GRADEBOOK_URL) return false;
    const su = getSetup() || {};
    const body = { date: M.isoDate(), nickname: su.name || "", group: su.group || "", seat: su.seat || "", room: r.room, lesson: r.lesson, score: r.score, max: r.max, code: r.code };
    if (r.attempt) body.attempt = r.attempt;
    try { fetch(CONFIG.GRADEBOOK_URL, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(body) }).catch(() => {}); } catch (e) { /* offline */ }
    return true;
  }

  /* ---------- small helpers ---------- */
  const appUrl = () => CONFIG.APP_URL || (location.origin + location.pathname);
  const qrSVG = (text, title) => { try { return QR.toSVG(text, { title }); } catch (e) { return ""; } };
  async function copy(text, msgEl, selectEl) {
    try {
      await navigator.clipboard.writeText(text);
      if (msgEl) { msgEl.className = "small okmsg"; msgEl.textContent = t("copied", "Copied. Paste it into Google Classroom."); }
    } catch (e) {
      if (msgEl) { msgEl.className = "small err"; msgEl.textContent = t("copyFailed", "Copy is blocked here. The text is selected: copy it with your device's menu."); }
      if (selectEl) { try { const r = document.createRange(); r.selectNodeContents(selectEl); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } catch (e2) { /* ignore */ } }
    }
  }
  function toast(msg) {
    let el = $("#toast");
    if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add("on");
    clearTimeout(toast.h); toast.h = setTimeout(() => el.classList.remove("on"), 2600);
  }
  /** Segmented 1–n radio control. */
  function seg(name, values, checked, labelFn, aria) {
    return `<div class="seg" role="radiogroup" aria-label="${esc(aria)}" style="--n:${values.length}">${values.map((n) => {
      const id = name + "-" + n;
      return `<input type="radio" name="${esc(name)}" id="${esc(id)}" value="${n}" ${checked === n ? "checked" : ""}><label for="${esc(id)}">${esc(labelFn(n))}</label>`;
    }).join("")}</div>`;
  }
  const lessonLabel = (n) => t("lesson." + n, "Lesson " + n);
  function roomHead(key, lesson, extra) {
    const d = roomDef(key);
    return `<header class="roomhead rc-${d.colour}"><span class="ftab">L${M.pad(lesson)}</span>
      <div class="rh-in"><a class="back" href="#/rooms">${esc(t("backToRooms", "Rooms"))}</a>
      <h1>${esc(extra || roomTitle(key))}</h1><p>${esc(lessonLabel(lesson))}</p></div></header>`;
  }
  function codeBox(code, label) {
    return `<div class="codewrap"><p class="small muted">${esc(label || t("yourCode", "Your result code"))}</p><div class="codebox" aria-live="polite">${esc(code)}</div></div>`;
  }

  /* ---------- module map ---------- */
  const MODULES = [
    { n: 1, from: 1, to: 8 }, { n: 2, from: 9, to: 14 }, { n: 3, from: 15, to: 20 }, { n: 4, from: 21, to: 28 }
  ];
  const moduleOf = (lesson) => (MODULES.find((m) => lesson >= m.from && lesson <= m.to) || { n: 0 }).n;
  const exitLessons = () => Object.keys((C.rooms && C.rooms.exitChecks) || {}).filter((k) => /^L\d+$/.test(k)).sort();

  /* ---------- views ---------- */
  let current = { view: "", room: null, arg: null, tick: null };

  function setTab(name) {
    $$(".tab").forEach((b) => { if (b.dataset.tab === name) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
  }

  function renderSetup(reason) {
    setTab("");
    const prev = store.get(SETUP_KEY, null) || {};
    const mmi = store.get("mmi.setup", null) || {};
    const s = { name: prev.name || mmi.name || "", group: +(prev.group || mmi.group || 0), seat: prev.seat || (M.SEATS.includes(mmi.seat) ? mmi.seat : "") };
    app.innerHTML = `
    <section class="panel setup" id="setup">
      <h1 class="display">${esc(t("setup.title", "Who's in the studio?"))}</h1>
      <p class="muted">${esc(t("setup.intro", "Enter the same nickname, group and seat as in the MMI app. Your work stays on this device."))}</p>
      ${reason ? `<p class="hint">${esc(reason)}</p>` : ""}
      <form id="su" class="form" novalidate>
        <label class="field"><span>${esc(t("setup.name", "Nickname"))}</span><input id="su-name" maxlength="24" autocomplete="nickname" value="${esc(s.name)}" required></label>
        <label class="field"><span>${esc(t("setup.group", "Group"))}</span><select id="su-group" required>
          <option value="">${esc(t("setup.pickGroup", "Choose your group"))}</option>
          ${C.groups.map((g) => `<option value="${g.id}" ${+g.id === s.group ? "selected" : ""}>G${g.id} · ${esc(profLabel(g.id))}</option>`).join("")}
        </select></label>
        <fieldset class="field"><legend>${esc(t("setup.seat", "Seat"))}</legend>
          <div class="chips" role="radiogroup" aria-label="${esc(t("setup.seat", "Seat"))}">${M.SEATS.map((x) => `<label class="chip"><input type="radio" name="seat" value="${x}" ${s.seat === x ? "checked" : ""}><span>${x}</span></label>`).join("")}</div>
          <span class="small muted">${esc(t("setup.seatHint", "Your seat letter today. It moves one letter each lesson."))}</span></fieldset>
        <p class="small err" id="su-msg" role="alert"></p>
        <div class="row"><button class="btn primary" type="submit">${esc(t("setup.save", "Save and open the rooms"))}</button></div>
      </form>
    </section>`;
    $("#su").onsubmit = (e) => {
      e.preventDefault();
      const name = $("#su-name").value.trim(), group = +$("#su-group").value, seatEl = $('input[name="seat"]:checked');
      const msg = $("#su-msg");
      if (!name) { msg.textContent = t("setup.needName", "Type a nickname."); $("#su-name").focus(); return; }
      if (!group) { msg.textContent = t("setup.needGroup", "Choose your group."); $("#su-group").focus(); return; }
      if (!seatEl) { msg.textContent = t("setup.needSeat", "Choose your seat letter."); return; }
      const gi = groupInfo(group);
      store.set(SETUP_KEY, { name, group, seat: seatEl.value, prof: gi.profession });
      updateWho();
      const back = renderSetup.after || "#/rooms"; renderSetup.after = null;
      if (location.hash === back) route(); else location.hash = back;
    };
  }

  function renderHome() {
    setTab("rooms");
    const su = getSetup();
    const cards = [];
    ROOMS.forEach((r) => {
      if (r.key === "exitChecks") exitLessons().forEach((L) => cards.push({ key: r.key, arg: L, lesson: +L.slice(1), order: 99, colour: r.colour }));
      else (r.lessons || []).forEach((n) => cards.push({ key: r.key, arg: null, lesson: n, order: r.order, colour: r.colour }));
    });
    cards.sort((a, b) => a.lesson - b.lesson || a.order - b.order);
    const byMod = {};
    cards.forEach((c) => { const m = moduleOf(c.lesson); (byMod[m] = byMod[m] || []).push(c); });
    const status = (c) => {
      const d = roomDef(c.key);
      const s = d.summary ? d.summary(c.arg) : null;
      return s ? `<span class="rstat">${esc(s)}</span>` : "";
    };
    app.innerHTML = `
    <section class="hello">
      <h1 class="display">${esc(t("home.title", "ELF Studio"))}</h1>
      <div class="row between"><p>${esc(t("home.hello", "{name} · G{group} {prof} · seat {seat}", { name: su.name, group: su.group, prof: profLabel(su.group), seat: su.seat }))}</p><a href="#/setup" class="btn small ghost">${esc(t("home.changeSeat", "Change seat"))}</a></div>
    </section>
    ${Object.keys(byMod).sort().map((m) => `
      <section class="module">
        <h2>${esc(t("module." + m, "Module " + m))}</h2>
        ${groupByLesson(byMod[m]).map(([lesson, list]) => `
          <div class="lesson"><h3>${esc(lessonLabel(lesson))}</h3>
            <div class="rooms">${list.map((c) => `
              <a class="room rc-${c.colour}" href="#/room/${c.key}${c.arg ? "/" + c.arg : ""}">
                <span class="ftab">L${M.pad(c.lesson)}</span>
                <b>${esc(c.key === "exitChecks" ? t("room.exitChecks.cardTitle", "Exit check") : roomTitle(c.key))}</b>
                <span class="rblurb">${esc(c.key === "exitChecks" ? t("room.exitChecks.blurb", "Six quick questions. Score and review.") : t("room." + c.key + ".blurb", ""))}</span>
                ${status(c)}
              </a>`).join("")}</div></div>`).join("")}
      </section>`).join("")}
    ${dataNote()}`;
  }
  function groupByLesson(list) {
    const m = new Map();
    list.forEach((c) => { if (!m.has(c.lesson)) m.set(c.lesson, []); m.get(c.lesson).push(c); });
    return Array.from(m.entries());
  }
  function dataNote() {
    const st = C.meta && C.meta.dataStatus;
    const ill = typeof U.illustrative === "string" ? `<p class="small muted datanote">${esc(U.illustrative)}</p>` : "";
    const ai = typeof U.aiRule === "string" ? `<p class="small datanote"><b>${esc(U.aiRule)}</b></p>` : "";
    return ai + ill + (st && /placeholder/i.test(st) ? `<p class="small muted datanote">${esc(t("home.placeholder", "Practice content: the final Module 2 materials will replace it."))}</p>` : "");
  }

  function renderRoom(key, arg) {
    const d = roomDef(key);
    if (!d) { location.hash = "#/rooms"; return; }
    setTab("rooms");
    const wrap = document.createElement("div");
    wrap.className = "roomview";
    app.innerHTML = "";
    app.appendChild(wrap);
    current.tick = null;
    const ctx = { el: wrap, arg, onTick(fn) { current.tick = fn; } };
    d.render(ctx);
    window.scrollTo(0, 0);
  }

  /* ---------- My scores ---------- */
  function scoresText() {
    const su = getSetup();
    const lines = [t("scores.textHead", "ELF Studio · My scores"), t("home.hello", "{name} · G{group} {prof} · seat {seat}", { name: su.name, group: su.group, prof: profLabel(su.group), seat: su.seat }) + ` · ${M.isoDate()}`, ""];
    ROOMS.forEach((r) => { const rows = r.scoreLines ? r.scoreLines() : []; if (rows.length) { lines.push(roomTitle(r.key)); rows.forEach((x) => lines.push("  " + x)); } });
    return lines.join("\n");
  }
  function renderScores() {
    setTab("scores");
    const blocks = ROOMS.map((r) => {
      const html = r.scores ? r.scores() : "";
      return html ? `<section class="panel sc rc-${r.colour}"><h2><span class="dot"></span>${esc(roomTitle(r.key))}</h2>${html}</section>` : "";
    }).join("");
    app.innerHTML = `
    <section class="hello"><h1 class="display">${esc(t("scores.title", "My scores"))}</h1>
      <p class="muted">${esc(t("scores.intro", "Best score in each room and the codes to show your teacher. Codes prove a result without an account."))}</p></section>
    ${blocks || `<section class="panel"><p>${esc(t("scores.empty", "Nothing yet. Open a room from the Rooms tab and your scores will appear here."))}</p><a class="btn primary" href="#/rooms">${esc(t("scores.goRooms", "Open the rooms"))}</a></section>`}
    <section class="panel"><div class="row"><button class="btn" id="sc-copy" type="button">${esc(t("scores.copy", "Copy my scores as text"))}</button><span id="sc-msg" class="small" aria-live="polite"></span></div>
      <pre class="export" id="sc-pre">${esc(scoresText())}</pre></section>`;
    $("#sc-copy").onclick = () => copy(scoresText(), $("#sc-msg"), $("#sc-pre"));
    ROOMS.forEach((r) => { if (r.bindScores) r.bindScores(app); });
  }

  /* ---------- Teacher ---------- */
  const pitchSettings = () => (C.settings && C.settings.pitchClock) || { pitch: 60, rate: 60, rotations: 4 };
  function teacherDefaults() {
    const d = new Date(Date.now() + 120000);
    return { hh: d.getHours(), mm: d.getMinutes(), mode: "P", rotations: pitchSettings().rotations || 4 };
  }
  let sound = false, AC = null;
  function beep(times, freq) {
    if (!sound) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      for (let i = 0; i < times; i++) {
        const o = AC.createOscillator(), g = AC.createGain();
        o.frequency.value = freq; o.connect(g); g.connect(AC.destination);
        const t0 = AC.currentTime + i * 0.32;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.25);
        o.start(t0); o.stop(t0 + 0.27);
      }
    } catch (e) { /* no audio */ }
  }
  let wakeLock = null;
  async function keepAwake() { try { if (navigator.wakeLock && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); } } catch (e) { /* ignored */ } }

  function renderTeacher() {
    setTab("teacher");
    const saved = M.parseSessionCode(store.get("elf.teacher", ""), pitchSettings());
    const tf = saved || teacherDefaults();
    const code = M.makeSessionCode(tf, pitchSettings());
    const cfg = M.parseSessionCode(code, pitchSettings());
    const len = M.sessionLength(cfg, pitchSettings());
    const start = new Date(); start.setHours(tf.hh, tf.mm, 0, 0);
    const end = new Date(start.getTime() + len * 1000);
    const joinUrl = appUrl() + "#p-" + code;
    const ps = pitchSettings();
    const tallyCodes = store.get("elf.tally", []);
    app.innerHTML = `
    <section class="hello"><h1 class="display">${esc(t("teacher.title", "Teacher"))}</h1>
      <p class="muted">${esc(t("teacher.intro", "Run the Pitch Clock from the projector and collect Line Upgrader scores. Later rooms' clocks use the same session code."))}</p></section>
    <section class="panel">
      <h2>${esc(t("teacher.pitchHead", "Pitch Clock session"))}</h2>
      <form id="tf" class="form two-col" novalidate>
        <label class="field"><span>${esc(t("teacher.start", "Start time"))}</span><input type="time" id="t-start" value="${M.pad(tf.hh)}:${M.pad(tf.mm)}"></label>
        <label class="field"><span>${esc(t("teacher.rotations", "Rotations"))}</span><select id="t-rot">${[2, 3, 4, 5, 6].map((n) => `<option value="${n}" ${n === cfg.rotations ? "selected" : ""}>${n}</option>`).join("")}</select></label>
      </form>
      <div class="row"><button class="btn signal" type="button" id="t-soon">${esc(t("teacher.soon", "Start in 1 minute"))}</button></div>
      <p class="small muted">${esc(t("teacher.timing", "Each rotation: {p} s pitch + {r} s rating for each line, then {m} s to move = {len}. {n} rotations end at {end}.", { p: ps.pitch, r: ps.rate, m: M.MOVE_SEC, len: M.fmt(M.rotationLength(cfg, ps)), n: cfg.rotations, end: M.pad(end.getHours()) + ":" + M.pad(end.getMinutes()) }))}</p>
    </section>
    <section class="proj" id="proj" aria-label="${esc(t("teacher.projector", "Projector view"))}">
      <div class="join"><div><span class="small" style="opacity:.75">${esc(t("teacher.code", "Session code"))}</span><span class="pcode">${esc(code)}</span></div>
        <div class="qr" title="${esc(t("teacher.scan", "Scan to join"))}">${qrSVG(joinUrl, t("teacher.qrTitle", "QR code to join session {code}", { code }))}</div></div>
      <div class="phase" id="pj-ph">—</div>
      <div class="big" id="pj-tm">--:--</div>
      <div class="bar2"><i id="pj-bar"></i></div>
      <div class="pj-rot" id="pj-rot"></div>
      <div class="pj-now" id="pj-now"></div>
      <div class="row center"><button class="btn signal" id="pj-full" type="button">${esc(t("teacher.full", "Full screen"))}</button><button class="btn" id="pj-snd" type="button" aria-pressed="${sound}">${esc(sound ? t("teacher.soundOn", "Sound on") : t("teacher.soundOff", "Sound off"))}</button></div>
    </section>
    <section class="panel">
      <h2>${esc(t("teacher.tallyHead", "Line Upgrader tally"))}</h2>
      <p class="small muted">${esc(t("teacher.tallyIntro", "Type or paste students' Line Upgrader score codes. The best code per seat counts; trios rank by points."))}</p>
      <form id="tl" class="row" novalidate><label class="field grow"><span class="sr">${esc(t("teacher.tallyCodes", "Score codes"))}</span><textarea id="tl-in" rows="2" placeholder="ABCD-EFGH"></textarea></label>
        <button class="btn primary" type="submit">${esc(t("teacher.tallyAdd", "Add codes"))}</button></form>
      <p class="small" id="tl-msg" aria-live="polite"></p>
      <div class="tally" id="tally">${tallyHTML(tallyCodes)}</div>
      <div class="row"><button class="btn ghost" id="tl-clear" type="button">${esc(t("teacher.tallyClear", "Clear the tally"))}</button></div>
    </section>
    <section class="panel">
      <h2>${esc(t("teacher.checkHead", "Check a code"))}</h2>
      <form id="ck" class="row" novalidate><label class="field grow"><span class="sr">${esc(t("teacher.checkLabel", "Code"))}</span><input id="ck-in" placeholder="ABCD-EFGH" autocomplete="off"></label><button class="btn" type="submit">${esc(t("teacher.checkBtn", "Check"))}</button></form>
      <p id="ck-out" aria-live="polite"></p>
      <p class="small muted">${esc(CONFIG.GRADEBOOK_URL ? t("teacher.gbOn", "Gradebook is on: auto-marked rooms send each result to your sheet.") : t("teacher.gbOff", "Gradebook is off. Set GRADEBOOK_URL in index.html to collect results in a Google Sheet (README)."))}</p>
    </section>`;
    const save = (f) => { store.set("elf.teacher", M.makeSessionCode(f, pitchSettings())); renderTeacher(); };
    $("#tf").addEventListener("change", () => {
      const [h, m] = ($("#t-start").value || "00:00").split(":").map(Number);
      save({ hh: h || 0, mm: m || 0, mode: "P", rotations: +$("#t-rot").value });
    });
    $("#t-soon").onclick = () => {
      const d = new Date(Date.now() + 60000);
      if (d.getSeconds() > 0 || d.getMilliseconds() > 0) d.setMinutes(d.getMinutes() + 1);
      save({ hh: d.getHours(), mm: d.getMinutes(), mode: "P", rotations: +$("#t-rot").value });
    };
    $("#pj-full").onclick = () => { const p = $("#proj"); try { if (document.fullscreenElement) document.exitFullscreen(); else if (p.requestFullscreen) p.requestFullscreen().catch(() => {}); } catch (e) { /* ignored */ } keepAwake(); };
    $("#pj-snd").onclick = () => { sound = !sound; if (sound) beep(1, 660); const b = $("#pj-snd"); b.textContent = sound ? t("teacher.soundOn", "Sound on") : t("teacher.soundOff", "Sound off"); b.setAttribute("aria-pressed", String(sound)); };
    $("#tl").onsubmit = (e) => {
      e.preventDefault();
      const raw = $("#tl-in").value.split(/[\s,;]+/).filter(Boolean);
      const list = store.get("elf.tally", []);
      let ok = 0, bad = 0;
      raw.forEach((c) => { const r = M.decodeResult(c); if (r && r.room === "lineUpgrader") { const n = M.normalizeCode(c); const f = n.slice(0, 4) + "-" + n.slice(4); if (!list.includes(f)) list.push(f); ok++; } else bad++; });
      store.set("elf.tally", list);
      $("#tally").innerHTML = tallyHTML(list);
      $("#tl-in").value = "";
      const m = $("#tl-msg"); m.className = bad ? "small err" : "small okmsg";
      m.textContent = t("teacher.tallyResult", "{ok} added, {bad} not recognised.", { ok, bad });
    };
    $("#tl-clear").onclick = () => { store.set("elf.tally", []); $("#tally").innerHTML = tallyHTML([]); };
    $("#ck").onsubmit = (e) => { e.preventDefault(); $("#ck-out").innerHTML = describeCode($("#ck-in").value); };
    current.tick = teacherTick;
    teacherTick(true);
  }
  function tallyHTML(codes) {
    const rows = M.tally(codes, "lineUpgrader");
    if (!rows.length) return `<p class="muted small">${esc(t("teacher.tallyEmpty", "No codes yet."))}</p>`;
    const top = Math.max(1, rows[0].points);
    return `<ol class="bars">${rows.map((g) => `<li><span class="bl">G${g.group} <small>${esc(profLabel(g.group))}</small></span><span class="bt"><i style="width:${Math.round(g.points / top * 100)}%"></i></span><b class="tnum">${g.points}</b><small class="bm">${esc(t("tally.members", "{n}/3 seats", { n: g.members }))}</small></li>`).join("")}</ol>`;
  }
  function describeCode(raw) {
    const r = M.decodeResult(raw), k = r ? null : M.decodeRating(raw), p = r || k ? null : M.decodePeer(raw);
    if (r) {
      const extra = r.room === "exitChecks" ? t("teacher.extraAttempt", "attempt {n}", { n: r.bonus })
        : r.room === "clicheHunter" ? t("teacher.extraMisses", "{n} wrong taps", { n: r.bonus })
        : r.room === "lineUpgrader" ? t("teacher.extraPeer", "+{n} peer stars", { n: r.bonus }) : "";
      return esc(t("teacher.checkResult2", "Result · {room} · L{lesson} · {score}/{max} · {extra} · G{group} seat {seat}", { room: roomTitle(r.room), lesson: r.lesson, score: r.score, max: r.max, extra, group: r.group, seat: r.seat }));
    }
    if (k) return esc(t("teacher.checkRating", "Pitch rating · {a}/{b}/{c} = {total}/12 · rotation {rot} · from G{group} seat {seat}", { a: k.ratings[0], b: k.ratings[1], c: k.ratings[2], total: k.total, rot: k.rotation, group: k.group, seat: k.seat }));
    if (p) return esc(t("teacher.checkPeer", "Peer line rating · {rating}/3 for R{round}·L{line} · from G{group} seat {seat}", p));
    return `<span class="err">${esc(t("teacher.checkBad", "Not a valid ELF Studio code. Check for a typo."))}</span>`;
  }
  let lastPhase = "";
  function teacherTick(force) {
    const raw = store.get("elf.teacher", "");
    const cfg = M.parseSessionCode(raw, pitchSettings()) || M.parseSessionCode(M.makeSessionCode(teacherDefaults(), pitchSettings()), pitchSettings());
    if (!$("#pj-tm")) return;
    const c = M.sessionAt(cfg, Date.now(), pitchSettings());
    const ph = $("#pj-ph");
    ph.textContent = t("phase." + c.phase, c.label);
    ph.className = "phase ph-" + c.phase;
    $("#pj-tm").textContent = c.phase === "done" ? "00:00" : M.fmt(c.remaining);
    $("#pj-bar").style.width = (c.phase === "before" ? 0 : Math.min(100, (c.elapsed / c.total) * 100)) + "%";
    $("#pj-rot").textContent = c.phase === "done" ? t("teacher.allDone", "All rotations finished") : t("teacher.rotOf", "Rotation {r} of {n}", { r: c.rotation, n: cfg.rotations });
    $("#pj-now").textContent = t("hint." + c.phase, "");
    const key = c.phase + "|" + c.rotation;
    if (lastPhase && key !== lastPhase && !force && c.phase !== "before") beep(c.phase === "move" ? 3 : c.phase.startsWith("pitch") ? 1 : 2, c.phase === "move" ? 520 : 880);
    lastPhase = key;
  }

  /* ---------- router ---------- */
  function updateWho() {
    const su = getSetup(), w = $("#who");
    if (w) { w.textContent = su ? su.name + " · G" + su.group + su.seat : t("nav.setup", "Set up"); }
  }
  function route() {
    current.tick = null;
    const h = location.hash || "#/rooms";
    let m = h.match(/^#p-([0-9A-Za-z]{5,6})$/);
    if (m) {
      const cfg = M.parseSessionCode(m[1], pitchSettings());
      if (cfg) { const st = roomState("pitchClock", {}); st.code = cfg.code; setRoomState("pitchClock", st); }
      location.replace("#/room/pitchClock"); return;
    }
    m = h.match(/^#k-([0-9A-Za-z-]{8,9})$/);
    if (m) {
      const d = roomDef("pitchClock");
      const msg = d && d.importRating ? d.importRating(m[1]) : "";
      if (msg) setTimeout(() => toast(msg), 50);
      location.replace(getSetup() ? "#/scores" : "#/setup"); return;
    }
    if (h === "#/setup") { renderSetup(); return; }
    if (h === "#/teacher") { renderTeacher(); updateWho(); return; }
    if (!getSetup()) { renderSetup.after = h; renderSetup(t("setup.first", "Set up once, then the rooms open.")); return; }
    if (h === "#/scores") renderScores();
    else if (h === "#/teacher") renderTeacher();
    else if ((m = h.match(/^#\/room\/([A-Za-z0-9]+)(?:\/([A-Za-z0-9-]+))?$/))) renderRoom(m[1], m[2] || null);
    else renderHome();
    updateWho();
  }
  window.addEventListener("hashchange", route);

  /* ---------- theme ---------- */
  function applyTheme() {
    const th = store.get("elf.theme", "auto");
    if (th === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", th);
    const b = $("#theme");
    if (b) { b.dataset.mode = th; b.setAttribute("aria-label", t("nav.theme", "Theme: {mode}", { mode: t("theme." + th, th) })); b.title = b.getAttribute("aria-label"); }
  }

  /* ---------- public API for rooms ---------- */
  window.ELF = {
    M, t, esc, $, $$, store, seg, copy, toast, qrSVG, appUrl, codeBox, roomHead, lessonLabel, profLabel,
    registerRoom, roomState, setRoomState, results, best, saveResult, post, pitchSettings,
    get C() { return C; }, setup: getSetup, rerender: () => route()
  };

  /* ---------- boot ---------- */
  async function boot() {
    try {
      const res = await fetch("elf-content.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      C = await res.json(); U = C.uiText || {};
    } catch (e) {
      app.innerHTML = `<section class="panel"><h1 class="display">${esc(t("boot.fail", "The studio content didn't load."))}</h1><p class="muted">${esc(t("boot.failHint", "Check the Wi-Fi, then try again."))}</p><button class="btn primary" type="button" id="retry">${esc(t("boot.retry", "Try again"))}</button></section>`;
      $("#retry").onclick = boot;
      return;
    }
    document.title = t("app.title", "ELF Studio");
    const sk = $(".skip"); if (sk) sk.textContent = t("skip", "Skip to content");
    $$(".tab").forEach((b) => { b.textContent = t("nav." + b.dataset.tab, b.textContent); b.onclick = () => { location.hash = "#/" + b.dataset.tab; }; });
    const th = $("#theme");
    th.onclick = () => { const order = ["auto", "light", "dark"]; const cur = store.get("elf.theme", "auto"); store.set("elf.theme", order[(order.indexOf(cur) + 1) % 3]); applyTheme(); };
    $("#who").onclick = () => { location.hash = "#/setup"; };
    applyTheme();
    route();
    if (!window.__elfTimer) window.__elfTimer = setInterval(() => { if (current.tick) current.tick(false); }, 250);
  }
  applyTheme();
  try {
    if ("serviceWorker" in navigator && location.protocol === "https:" && window.top === window.self) navigator.serviceWorker.register("sw.js").catch(() => {});
  } catch (e) { /* no service worker here */ }
  window.addEventListener("DOMContentLoaded", boot);
})();
