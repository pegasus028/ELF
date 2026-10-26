/* Room: Pitch Clock (L13). Session clock HHMM+P, 60 s pitch + 60 s rating per line, rating codes. */
(function () {
  "use strict";
  const E = window.ELF, KEY = "pitchClock", L = 13;
  const { t, esc, $, $$, M } = E;
  const RKEY = "elf.ratings";

  const data = () => E.C.rooms[KEY] || {};
  const criteria = () => (data().criteria || []).slice(0, 3).map((c, i) => (typeof c === "string" ? { id: "c" + (i + 1), label: c, anchors: [] } : Object.assign({ id: c.key || "c" + (i + 1) }, c, { label: c.label || c.text || c.name, anchors: c.anchors || c.levels || [] })));
  const frame = () => (data().frame || []).map((f) => (typeof f === "string" ? { step: "", say: f } : { step: f.step || f.label || "", say: f.say || f.stem || f.text || f.frame || "", sec: f.seconds60 || 0 }));
  const scale = () => (E.C.settings && E.C.settings.ratingScale) || [];
  const scaleLabel = (n) => { const x = scale().find((s) => +s.value === n) || scale()[n - 1]; return x ? (x.label || String(n)) : String(n); };
  function state() { const s = E.roomState(KEY, null) || {}; s.line = s.line || "stay"; s.r = s.r || [0, 0, 0]; return s; }
  const save = (s) => E.setRoomState(KEY, s);
  const received = () => E.store.get(RKEY, []);
  const cfgOf = (s) => (s.code ? M.parseSessionCode(s.code, E.pitchSettings()) : null);
  const PRACTICE = { mode: "P", rotations: 1 };

  function clockNow(s) {
    const ps = E.pitchSettings(), cfg = cfgOf(s);
    if (cfg) return { c: M.sessionAt(cfg, Date.now(), ps), cfg };
    // practice: one turn, pitch then rate
    if (!s.pStart) return { c: { phase: "idle", label: t("pc.ready", "Ready"), remaining: ps.pitch, total: 1, elapsed: 0, rotation: 1 }, cfg: null };
    const el = (Date.now() - s.pStart) / 1000;
    if (el < ps.pitch) return { c: { phase: "pitchA", label: t("pc.practicePitch", "Pitch"), remaining: ps.pitch - el, total: ps.pitch, elapsed: el, rotation: 1 }, cfg: null };
    if (el < ps.pitch + ps.rate) return { c: { phase: "rateA", label: t("pc.practiceRate", "Rating"), remaining: ps.pitch + ps.rate - el, total: ps.rate, elapsed: el - ps.pitch, rotation: 1 }, cfg: null };
    return { c: { phase: "done", label: t("pc.practiceDone", "Practice finished"), remaining: 0, total: 1, elapsed: 1, rotation: 1 }, cfg: null };
  }
  function taskText(s, c, cfg) {
    if (!cfg) {
      if (c.phase === "idle") return t("pc.task.idle", "Practice: press Start, pitch for 60 seconds, then your partner rates you.");
      if (c.phase === "pitchA") return t("pc.task.pitch", "Pitch now: Who · Spark · Proof · Ask.");
      if (c.phase === "rateA") return t("pc.task.practiceRate", "Your partner rates you now and gives you a code.");
      return t("pc.task.practiceDone", "Done. Add your partner's code below.");
    }
    if (c.phase === "before") { return t("pc.task.before", "The session starts at {time}. Stand in your line.", { time: M.pad(cfg.hh) + ":" + M.pad(cfg.mm) }); }
    if (c.phase === "done") return t("pc.task.done", "All rotations finished. Check you have a code for every rotation.");
    const task = M.pitchTask(c.phase, s.line);
    return ({
      pitch: t("pc.task.pitch", "Pitch now: Who · Spark · Proof · Ask."),
      listen: t("pc.task.listen", "Listen to your partner's pitch. Rate her when the clock says so."),
      rate: t("pc.task.rate", "Rate your partner below, then show her the code."),
      wait: t("pc.task.wait", "Your partner is rating you. Type her code below."),
      move: s.line === "move" ? t("pc.task.move", "Move line: step one place to your next partner.") : t("pc.task.stay", "Stay where you are. Your next partner is coming.")
    })[task] || "";
  }

  function importRating(raw) {
    const k = M.decodeRating(raw);
    if (!k) return t("pc.badCode", "That rating code doesn't work. Check each letter and try again.");
    const su = E.setup();
    if (!su) return t("pc.needSetup", "Set up first, then open the link again.");
    if (k.group === su.group && k.seat === su.seat) return t("pc.selfCode", "That's a code you made. Your partner's code goes here.");
    const n = M.normalizeCode(raw), code = n.slice(0, 4) + "-" + n.slice(4);
    let list = received();
    if (list.some((x) => x.code === code)) return t("pc.dupCode", "You already added that code.");
    /* one code per partner per rotation: a newer code from the same rater, rotation and session replaces the old one */
    const same = (x) => x.group === k.group && x.seat === k.seat && x.rotation === k.rotation && x.minute === k.minute && x.day === k.day;
    const replaced = list.some(same);
    list = list.filter((x) => !same(x));
    list.push(Object.assign({ code, date: M.isoDate(), at: Date.now() }, k));
    E.store.set(RKEY, list.slice(-200));
    E.post({ room: KEY, lesson: L, score: k.total, max: 12, code });
    return replaced ? t("pc.replaced", "Rating replaced: {total}/12 from rotation {rot} (one code per partner per rotation).", { total: k.total, rot: k.rotation })
      : t("pc.added", "Rating added: {total}/12 from rotation {rot}.", { total: k.total, rot: k.rotation });
  }

  function render(ctx) {
    const s = state(), cfg = cfgOf(s), C3 = criteria();
    const list = received();
    ctx.el.innerHTML = `${E.roomHead(KEY, L)}
    ${data().intro ? `<section class="panel intro"><p>${esc(data().intro)}</p></section>` : ""}
    <section class="panel">
      ${cfg ? `<div class="row between"><p>${esc(t("pc.joined", "Session {code} · {n} rotations", { code: cfg.code, n: cfg.rotations }))}</p><button class="btn ghost small" id="pc-leave" type="button">${esc(t("pc.leave", "Leave session"))}</button></div>`
        : `<form id="pc-join" class="row" novalidate><label class="field grow"><span>${esc(t("pc.codeLabel", "Session code from the projector"))}</span><input id="pc-code" maxlength="8" placeholder="1015P" autocomplete="off" autocapitalize="characters"></label><button class="btn primary" type="submit">${esc(t("pc.join", "Join"))}</button></form><p class="small err" id="pc-jmsg" aria-live="polite"></p>`}
      <fieldset class="field"><legend>${esc(t("pc.lineLabel", "Your line"))}</legend><div class="chips" role="radiogroup" aria-label="${esc(t("pc.lineLabel", "Your line"))}">
        <label class="chip"><input type="radio" name="line" value="stay" ${s.line === "stay" ? "checked" : ""}><span>${esc(t("pc.stay", "Stay line (pitches first)"))}</span></label>
        <label class="chip"><input type="radio" name="line" value="move" ${s.line === "move" ? "checked" : ""}><span>${esc(t("pc.move", "Move line"))}</span></label></div></fieldset>
    </section>
    <section class="clock" id="pc-clock" aria-live="off"><span class="ph" id="pc-ph">—</span><div class="meta"><span class="small muted" id="pc-rot"></span></div><span class="tm tnum" id="pc-tm">--:--</span><i class="prog" id="pc-bar"></i></section>
    <p class="task" id="pc-task" aria-live="polite"></p>
    ${cfg ? "" : `<div class="row"><button class="btn signal" id="pc-pstart" type="button">${esc(s.pStart ? t("pc.restart", "Restart practice") : t("pc.start", "Start practice"))}</button></div>`}
    <details class="panel frame" ${s.frameClosed ? "" : "open"} id="pc-frame"><summary>${esc(t("pc.frameHead", "Pitch frame"))}</summary>
      <ol class="frame-steps">${frame().map((f) => `<li><b>${esc(f.step)}${f.sec ? ` <small class="muted">${esc(t("pc.secs", "~{n} s", { n: f.sec }))}</small>` : ""}</b><span>${esc(f.say)}</span></li>`).join("")}</ol></details>
    ${(data().models || []).length ? `<details class="panel"><summary>${esc(t("pc.modelsHead", "Model pitches ({n})", { n: data().models.length }))}</summary>${data().models.map((m) => `<div class="pmodel"><p><b>${esc(m.label || "")}</b></p>${(m.parts || []).map((p) => `<p><span class="mv">${esc(p.move)}</span> ${esc(p.text)}</p>`).join("")}${m.text ? `<p>${esc(m.text)}</p>` : ""}</div>`).join("")}</details>` : ""}
    <section class="panel rate" id="pc-rate"><h2>${esc(t("pc.rateHead", "Rate your partner"))}</h2>
      ${C3.map((c, i) => `<div class="crit"><p><b>${esc(c.label)}</b></p>${E.seg("pc-c" + i, [1, 2, 3, 4], s.r[i] || null, (n) => String(n), c.label)}<p class="small muted anch" id="pc-a${i}">${esc(s.r[i] ? (c.anchors[s.r[i] - 1] || scaleLabel(s.r[i])) : t("pc.pick", "Tap 1–4."))}</p></div>`).join("")}
      ${cfg ? "" : `<label class="field"><span>${esc(t("pc.rotation", "Rotation"))}</span><select id="pc-rsel">${[1, 2, 3, 4, 5, 6].map((n) => `<option ${n === (s.rotSel || 1) ? "selected" : ""}>${n}</option>`).join("")}</select></label>`}
      <div class="row"><button class="btn primary" id="pc-make" type="button">${esc(t("pc.make", "Make the rating code"))}</button></div>
      <div id="pc-out" aria-live="polite"></div></section>
    <section class="panel"><h2>${esc(t("pc.recvHead", "Codes you received ({n})", { n: list.length }))}</h2>
      <form id="pc-recv" class="row" novalidate><label class="field grow"><span class="sr">${esc(t("pc.recvLabel", "Partner's rating code"))}</span><input id="pc-rin" maxlength="9" placeholder="ABCD-EFGH" autocomplete="off" autocapitalize="characters"></label><button class="btn" type="submit">${esc(t("pc.add", "Add"))}</button></form>
      <p class="small" id="pc-rmsg" aria-live="polite"></p>
      ${list.length ? `<ul class="plain">${list.slice().reverse().map((k) => `<li><b class="tnum">${k.total}/12</b> <span class="small">${C3.map((c, i) => esc(c.label) + " " + k.ratings[i]).join(" · ")}</span> <span class="small muted">${esc(t("pc.rotShort", "rot. {n}", { n: k.rotation }))} · ${esc(k.date)}</span></li>`).join("")}</ul>` : `<p class="muted small">${esc(t("pc.noneYet", "None yet. After each rotation your partner gives you a code."))}</p>`}
    </section>`;

    ctx.el.onchange = (e) => {
      const el = e.target;
      if (el.name === "line") { s.line = el.value; save(s); tick(true); }
      const m = /^pc-c(\d)$/.exec(el.name || "");
      if (m) { const i = +m[1]; s.r[i] = +el.value; save(s); $("#pc-a" + i).textContent = C3[i].anchors[s.r[i] - 1] || scaleLabel(s.r[i]); }
      if (el.id === "pc-rsel") { s.rotSel = +el.value; save(s); }
    };
    $("#pc-frame").addEventListener("toggle", (e) => { s.frameClosed = !e.target.open; save(s); });
    const jf = $("#pc-join");
    if (jf) jf.onsubmit = (e) => {
      e.preventDefault();
      const c = M.parseSessionCode($("#pc-code").value, E.pitchSettings());
      if (!c || c.mode !== "P") { $("#pc-jmsg").textContent = t("pc.badSession", "That isn't a Pitch Clock code. It looks like 1015P: four digits and P."); return; }
      s.code = c.code; s.pStart = 0; save(s); render(ctx);
    };
    const lv = $("#pc-leave");
    if (lv) lv.onclick = () => { s.code = ""; save(s); render(ctx); };
    const ps = $("#pc-pstart");
    if (ps) ps.onclick = () => { s.pStart = Date.now(); save(s); ps.textContent = t("pc.restart", "Restart practice"); tick(true); };
    $("#pc-make").onclick = () => {
      if (s.r.some((v) => !v)) { $("#pc-out").innerHTML = `<p class="small err">${esc(t("pc.needAll", "Rate all three criteria first."))}</p>`; return; }
      const su = E.setup(), cc = cfgOf(s), now = clockNow(s);
      const rot = cc ? Math.max(1, Math.min(6, now.c.rotation || 1)) : (s.rotSel || 1);
      const code = M.encodeRating({ ratings: s.r, rotation: rot, group: su.group, seat: su.seat, minute: cc ? cc.hh * 60 + cc.mm : 0, day: M.dayOfYear(Date.now()) });
      const url = E.appUrl() + "#k-" + code.replace("-", "");
      $("#pc-out").innerHTML = `<div class="handoff"><div class="qrbox">${E.qrSVG(url, t("pc.qrTitle", "QR code for rating {code}", { code }))}</div>
        <div><p class="small muted">${esc(t("pc.showPartner", "Show your partner. She scans the QR with her camera or types the code."))}</p><div class="codebox big">${esc(code)}</div>
        <p class="small">${esc(t("pc.youGave", "You gave {a} + {b} + {c} = {total}/12 (rotation {rot}).", { a: s.r[0], b: s.r[1], c: s.r[2], total: s.r[0] + s.r[1] + s.r[2], rot }))}</p></div></div>`;
      s.r = [0, 0, 0]; save(s);
      $$('#pc-rate input[type="radio"]', ctx.el).forEach((x) => { x.checked = false; });
      C3.forEach((_, i) => { $("#pc-a" + i).textContent = t("pc.pick", "Tap 1–4."); });
    };
    $("#pc-recv").onsubmit = (e) => {
      e.preventDefault();
      const raw = M.normalizeCode($("#pc-rin").value);
      const msg = importRating($("#pc-rin").value);
      if (received().some((x) => M.normalizeCode(x.code) === raw) && !/already/.test(msg) && msg !== t("pc.selfCode", "That's a code you made. Your partner's code goes here.")) { render(ctx); E.toast(msg); }
      else { const m = $("#pc-rmsg"); m.className = "small err"; m.textContent = msg; }
    };
    let lastTask = "";
    function tick(force) {
      const { c, cfg: cc } = clockNow(s);
      const el = $("#pc-clock"); if (!el) return;
      el.className = "clock ph-" + c.phase;
      $("#pc-ph").textContent = t("phase." + c.phase, c.label);
      $("#pc-tm").textContent = c.phase === "done" ? "00:00" : M.fmt(c.remaining);
      $("#pc-bar").style.width = (c.phase === "before" || c.phase === "idle" ? 0 : Math.min(100, c.elapsed / c.total * 100)) + "%";
      $("#pc-rot").textContent = cc ? (c.phase === "done" ? "" : t("pc.rotOf", "Rotation {r} of {n}", { r: c.rotation, n: cc.rotations })) : t("pc.practice", "Practice (no session)");
      const tx = taskText(s, c, cc);
      if (tx !== lastTask || force) { $("#pc-task").textContent = tx; lastTask = tx; }
      const task = cc ? M.pitchTask(c.phase, s.line) : (c.phase === "rateA" ? "rate" : "");
      $("#pc-rate").classList.toggle("now", task === "rate");
      $("#pc-task").dataset.task = task || c.phase;
    }
    ctx.onTick(tick);
    tick(true);
  }

  E.registerRoom({
    key: KEY, order: 5, colour: "pitch", lessons: [L], title: "Pitch Clock", render, importRating,
    summary() { const n = received().length; return n ? t("pc.summary", "{n} ratings", { n }) : ""; },
    scores() {
      const list = received();
      if (!list.length) return "";
      const C3 = criteria();
      const avg = (i) => (list.reduce((a, k) => a + k.ratings[i], 0) / list.length).toFixed(1);
      const bestK = list.reduce((b, k) => (!b || k.total > b.total ? k : b), null);
      return `<p>${esc(t("pc.scoreLine", "{n} ratings · best {best}/12", { n: list.length, best: bestK.total }))}</p>
        <p class="small">${C3.map((c, i) => `${esc(c.label)}: <b>${avg(i)}</b>`).join(" · ")}</p>
        <ul class="plain codes">${list.map((k) => `<li><span class="code">${esc(k.code)}</span> ${k.total}/12 · ${esc(t("pc.rotShort", "rot. {n}", { n: k.rotation }))}</li>`).join("")}</ul>`;
    },
    scoreLines() { return received().map((k) => `${k.code} · ${k.total}/12 (${k.ratings.join("/")}) · ${t("pc.rotShort", "rot. {n}", { n: k.rotation })} · ${k.date}`); }
  });
})();
