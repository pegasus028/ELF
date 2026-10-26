/* Room: Line Upgrader (L10). 4 rounds × 5 weak lines, structural check, peer rating codes, trio board. */
(function () {
  "use strict";
  const E = window.ELF, KEY = "lineUpgrader", L = 10;
  const { t, esc, $, $$, M } = E;

  const data = () => E.C.rooms[KEY] || {};
  const ROUNDS = () => data().rounds || 4, PER = () => data().linesPerRound || data().perRound || 5;
  let opts = null;
  const chk = () => opts || (opts = { number: M.numberTester(data().check && data().check.numberPattern), result: M.resultTester(data().check && data().check.resultMarkers),
    banned: M.clicheMatchers(((E.C.rooms.clicheHunter || {}).banList) || []), maxWords: data().maxWords || 0 });
  const fb = (k, def, vars) => { const f = data().feedback || {}; return f[k] ? t("_", f[k], vars) : t("lu.tip." + k, def, vars); };
  let verbSet = null;
  const verbs = () => verbSet || (verbSet = M.makeVerbSet(data().verbBank));
  function plan() { const su = E.setup(); return M.linePlan(data().lines || [], su.group, su.seat, ROUNDS(), PER(), su.prof); }
  function state() {
    const s = E.roomState(KEY, null) || {};
    s.answers = s.answers || {}; s.locked = s.locked || []; s.peer = s.peer || []; s.board = s.board || []; s.round = s.round || 1;
    return s;
  }
  const save = (s) => E.setRoomState(KEY, s);
  const akey = (r, i) => r + "-" + i;
  function passes(s) {
    return Object.keys(s.answers).filter((k) => M.checkLine(s.answers[k], verbs(), chk()).ok).length;
  }
  const peerPoints = (s) => s.peer.reduce((a, p) => a + p.rating, 0);
  const allLocked = (s) => Array.from({ length: ROUNDS() }, (_, i) => !!s.locked[i]).every(Boolean);
  function myCode(s) {
    const su = E.setup();
    return M.encodeResult({ room: KEY, lesson: L, score: passes(s), max: ROUNDS() * PER(), bonus: Math.min(63, peerPoints(s)), group: su.group, seat: su.seat });
  }
  const slotName = (k) => ({ verb: t("lu.slot.verb", "Verb from the bank"), number: t("lu.slot.number", "Number"), result: t("lu.slot.result", "Result clause") })[k];
  function checkHTML(text, round) {
    if (!String(text || "").trim()) return "";
    const c = M.checkLine(text, verbs(), chk());
    const chips = ["verb", "number", "result"].map((k) => `<span class="slot ${c.slots[k] ? "ok" : "no"}">${c.slots[k] ? "✓" : "✗"} ${esc(slotName(k))}</span>`).join("")
      + `<span class="slot ${c.banned.length ? "no" : "ok"}">${c.banned.length ? "✗" : "✓"} ${esc(t("lu.slot.cliche", "No cliché"))}</span>`;
    const tips = [];
    if (!c.slots.verb) tips.push(fb("verb", "Start with an action verb from the bank (you wrote '{w}').", { w: c.firstWord }) + (c.firstWord && !/\{w\}/.test((data().feedback || {}).verb || "{w}") ? " " + t("lu.youWrote", "(You wrote '{w}'.)", { w: c.firstWord }) : ""));
    if (!c.slots.number) tips.push(fb("number", "Add a number or duration: 30 students, 6 months, every Saturday."));
    if (!c.slots.result) tips.push(fb("result", "Add a result: …, which / resulting in / so that / helping…"));
    if (c.banned.length) tips.push(t("lu.tip.cliche", "Remove the cliché: {list}. Say what you did instead.", { list: c.banned.join(", ") }));
    if (c.words < 4) tips.push(t("lu.tip.short", "Write a full line of at least four words."));
    const c1max = data().maxWordsC1Round4 || 18, maxW = data().maxWords || 0;
    if (maxW && c.words > maxW) tips.push(t("lu.tip.long", "Keep it to {m} words or fewer ({n} now).", { m: maxW, n: c.words }));
    else if (round === ROUNDS() && c.words > c1max) tips.push(t("lu.tip.c1", "C1 challenge: round {r} lines stay at {m} words or fewer ({n} now).", { r: round, m: c1max, n: c.words }));
    return `<div class="slots">${chips}<span class="wc tnum">${esc(t("lu.words", "{n} words", { n: c.words }))}</span></div>${c.ok ? `<p class="okmsg small">${esc(fb("pass", "Passes the check."))}</p>` : ""}${tips.length ? `<ul class="tips">${tips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}`;
  }

  function render(ctx) {
    const s = state(), P = plan(), r = Math.min(s.round, ROUNDS());
    const lines = P[r - 1] || [];
    const locked = !!s.locked[r - 1];
    const roundScore = lines.filter((_, i) => M.checkLine(s.answers[akey(r, i + 1)], verbs(), chk()).ok).length;
    const code = myCode(s);
    const su = E.setup();
    const ratingLabels = data().ratingLabels || {};
    (data().peerRatingScale || []).forEach((x) => { ratingLabels[x.value] = x.label; });
    [1, 2, 3].forEach((n) => { if (!ratingLabels[n]) ratingLabels[n] = t("lu.rate" + n, ["", "Not yet", "Mostly", "Yes"][n]); });
    const board = M.tally(s.board.concat([code]), KEY);
    ctx.el.innerHTML = `${E.roomHead(KEY, L)}
    <section class="panel intro">${(data().formula || []).length ? `<p class="formula">${data().formula.map((f) => `<span>${esc(f)}</span>`).join("<i>+</i>")}</p>` : ""}<p>${esc(data().intro || t("lu.intro", "Rewrite each weak line as Verb + What + Scale/Result + So what. Invent realistic details. Check each line, then finish the round to see the model upgrades."))}</p>
      <p class="small muted">${esc(t("lu.roundOneNote", "Round 1 lines come from your own field; later rounds mix in the other fields."))}</p>
      <details><summary>${esc(t("lu.bank", "Verb bank ({n})", { n: (data().verbBank || []).length }))}</summary>${(data().verbGroups || []).length ? data().verbGroups.map((g) => `<p class="small"><b>${esc(g.label)}</b></p><p class="bank">${g.verbs.map((v) => `<span>${esc(v)}</span>`).join("")}</p>`).join("") : `<p class="bank">${(data().verbBank || []).map((v) => `<span>${esc(typeof v === "string" ? v : v.verb)}</span>`).join("")}</p>`}</details></section>
    <nav class="rounds" aria-label="${esc(t("lu.roundsNav", "Rounds"))}">${Array.from({ length: ROUNDS() }, (_, i) => `<button type="button" class="rbtn${i + 1 === r ? " on" : ""}" data-round="${i + 1}" aria-current="${i + 1 === r ? "step" : "false"}">${esc(t("lu.roundN", "Round {n}", { n: i + 1 }))}${s.locked[i] ? " ✓" : ""}</button>`).join("")}</nav>
    <div class="sticky-sum"><span>${esc(t("lu.roundScore", "This round"))} <b class="tnum">${roundScore}</b>/${lines.length}</span><span>${esc(t("lu.total", "Total"))} <b class="tnum">${passes(s)}</b>/${ROUNDS() * PER()}</span><span>${esc(t("lu.peerPts", "Peer"))} <b class="tnum">${peerPoints(s)}</b></span></div>
    <ol class="lines">${lines.map((ln, i) => {
      const k = akey(r, i + 1), val = s.answers[k] || "";
      return `<li class="line">
        <div class="line-h"><span class="tag">R${r}·L${i + 1}</span><p class="weak">${esc(ln.weak)}</p></div>
        <label class="field"><span class="sr">${esc(t("lu.yourLine", "Your upgraded line"))}</span><textarea rows="3" data-k="${k}" ${locked ? "readonly" : ""} placeholder="${esc(t("lu.ph", "Verb + what + number + result"))}">${esc(val)}</textarea></label>
        ${locked ? "" : `<button class="btn small" type="button" data-check="${k}" data-r="${r}">${esc(t("lu.check", "Check line"))}</button>`}
        <div class="chk" id="chk-${k}" aria-live="polite">${val ? checkHTML(val, r) : ""}</div>
        ${locked ? `<p class="model"><span>${esc(t("lu.model", "Model upgrade"))}</span>${esc(ln.model)}</p>` : ""}
      </li>`;
    }).join("")}</ol>
    ${locked ? `<p class="okmsg">${esc(t("lu.lockedMsg", "Round finished. Compare with the models, then move on."))}</p>` : `<div class="row"><button class="btn primary" id="lu-finish" type="button">${esc(t("lu.finish", "Finish round {n}", { n: r }))}</button></div>`}
    ${r < ROUNDS() && locked ? `<div class="row"><button class="btn primary" type="button" data-round="${r + 1}">${esc(t("lu.next", "Go to round {n}", { n: r + 1 }))}</button></div>` : ""}

    <section class="panel"><h2>${esc(t("lu.rateHead", "Rate a peer's line"))}</h2>
      <p class="small muted">${esc(t("lu.rateIntro", "Read a classmate's line on her screen. Pick the tag shown above it (for example R2·L3), rate it, and read her the code."))}</p>
      <p class="crit">${esc(data().peerPrompt || data().criterion || t("lu.criterion", "Would an admissions reader believe it?"))}</p>
      <form id="pr" class="form two-col" novalidate>
        <label class="field"><span>${esc(t("lu.rRound", "Round"))}</span><select id="pr-r">${Array.from({ length: ROUNDS() }, (_, i) => `<option>${i + 1}</option>`).join("")}</select></label>
        <label class="field"><span>${esc(t("lu.rLine", "Line"))}</span><select id="pr-l">${Array.from({ length: PER() }, (_, i) => `<option>${i + 1}</option>`).join("")}</select></label>
        <div class="field wide"><span>${esc(t("lu.rRating", "Rating"))}</span>${E.seg("pr-v", [1, 2, 3], null, (n) => n + " · " + (ratingLabels[n] || ratingLabels[String(n)] || n), t("lu.rRating", "Rating"))}</div>
        <div class="row wide"><button class="btn" type="submit">${esc(t("lu.makeCode", "Make the code"))}</button></div>
      </form>
      <div id="pr-out" aria-live="polite"></div></section>

    <section class="panel"><h2>${esc(t("lu.recvHead", "Ratings you received"))}</h2>
      <form id="rc" class="row" novalidate><label class="field grow"><span class="sr">${esc(t("lu.recvLabel", "Peer code"))}</span><input id="rc-in" maxlength="7" placeholder="${esc(t("lu.recvPh", "5-character code"))}" autocomplete="off" autocapitalize="characters"></label><button class="btn" type="submit">${esc(t("lu.add", "Add"))}</button></form>
      <p class="small" id="rc-msg" aria-live="polite"></p>
      ${s.peer.length ? `<ul class="plain">${s.peer.map((p) => `<li><span class="tag">R${p.round}·L${p.line}</span> ${"★".repeat(p.rating)}${"☆".repeat(3 - p.rating)} <span class="muted small">G${p.group}${p.seat}</span></li>`).join("")}</ul>` : `<p class="muted small">${esc(t("lu.noPeer", "None yet."))}</p>`}</section>

    <section class="panel"><h2>${esc(t("lu.boardHead", "Trio board"))}</h2>
      ${codeBoxHTML(code)}
      <p class="small muted">${esc(t("lu.boardIntro", "Points = lines that pass + peer stars. Add your teammates' (or other trios') score codes to compare on this phone. Read your code to the teacher for the class tally."))}</p>
      <form id="bd" class="row" novalidate><label class="field grow"><span class="sr">${esc(t("lu.boardLabel", "Score code"))}</span><input id="bd-in" maxlength="9" placeholder="ABCD-EFGH" autocomplete="off" autocapitalize="characters"></label><button class="btn" type="submit">${esc(t("lu.add", "Add"))}</button></form>
      <p class="small" id="bd-msg" aria-live="polite"></p>
      <ol class="board">${board.map((g) => `<li class="${g.group === su.group ? "me" : ""}"><span>G${g.group} ${esc(E.profLabel(g.group))}</span><span class="small muted">${esc(t("tally.members", "{n}/3 seats", { n: g.members }))}</span><b class="tnum">${g.points}</b></li>`).join("")}</ol>
      ${allLocked(s) ? `<div class="row"><button class="btn" id="lu-send" type="button">${esc(t("lu.send", "Send my updated score"))}</button><span class="small" id="lu-smsg" aria-live="polite"></span></div>` : ""}
    </section>`;

    const ta = (k) => ctx.el.querySelector(`textarea[data-k="${k}"]`);
    $$("textarea[data-k]", ctx.el).forEach((el) => {
      el.addEventListener("input", () => { s.answers[el.dataset.k] = el.value; save(s); });
    });
    $$("[data-check]", ctx.el).forEach((b) => {
      b.onclick = () => {
        const k = b.dataset.check;
        s.answers[k] = ta(k).value; save(s);
        $("#chk-" + k).innerHTML = checkHTML(s.answers[k], +b.dataset.r) || `<p class="small err">${esc(t("lu.empty", "Write your line first."))}</p>`;
        const sumEl = ctx.el.querySelector(".sticky-sum");
        const rs = lines.filter((_, i) => M.checkLine(s.answers[akey(r, i + 1)], verbs(), chk()).ok).length;
        sumEl.innerHTML = `<span>${esc(t("lu.roundScore", "This round"))} <b class="tnum">${rs}</b>/${lines.length}</span><span>${esc(t("lu.total", "Total"))} <b class="tnum">${passes(s)}</b>/${ROUNDS() * PER()}</span><span>${esc(t("lu.peerPts", "Peer"))} <b class="tnum">${peerPoints(s)}</b></span>`;
      };
    });
    $$("[data-round]", ctx.el).forEach((b) => { b.onclick = () => { s.round = +b.dataset.round; save(s); render(ctx); window.scrollTo(0, 0); }; });
    const fin = $("#lu-finish");
    if (fin) fin.onclick = () => {
      lines.forEach((_, i) => { const k = akey(r, i + 1); const el = ta(k); if (el) s.answers[k] = el.value; });
      const passing = lines.filter((_, i) => M.checkLine(s.answers[akey(r, i + 1)], verbs(), chk()).ok).length;
      if (passing < lines.length && !confirm(t("lu.confirmFinish", "{n} of {m} lines pass. Finishing locks this round. Finish anyway?", { n: passing, m: lines.length }))) { save(s); return; }
      s.locked[r - 1] = true;
      if (allLocked(s) && !s.posted) {
        s.posted = true;
        s.code = E.saveResult({ room: KEY, lesson: L, score: passes(s), max: ROUNDS() * PER(), bonus: Math.min(63, peerPoints(s)) });
        E.toast(t("lu.doneToast", "All rounds finished: {n}/{max} lines pass.", { n: passes(s), max: ROUNDS() * PER() }));
      }
      save(s); render(ctx);
    };
    $("#pr").onsubmit = (e) => {
      e.preventDefault();
      const v = ctx.el.querySelector('input[name="pr-v"]:checked');
      if (!v) { $("#pr-out").innerHTML = `<p class="small err">${esc(t("lu.pickRating", "Choose a rating first."))}</p>`; return; }
      const pc = M.encodePeer({ rating: +v.value, round: +$("#pr-r").value, line: +$("#pr-l").value, group: su.group, seat: su.seat, day: M.dayOfYear(Date.now()) });
      $("#pr-out").innerHTML = `<div class="codebox big" aria-label="${esc(t("lu.peerCode", "Peer code"))}">${esc(pc)}</div><p class="small muted">${esc(t("lu.peerCodeHint", "Read this code to the writer. She types it under 'Ratings you received'."))}</p>`;
    };
    $("#rc").onsubmit = (e) => {
      e.preventDefault();
      const m = $("#rc-msg"), p = M.decodePeer($("#rc-in").value);
      if (!p) { m.className = "small err"; m.textContent = t("lu.badPeer", "That code doesn't work. Check each letter and try again."); return; }
      if (p.group === su.group && p.seat === su.seat) { m.className = "small err"; m.textContent = t("lu.selfPeer", "That's your own code. A classmate rates your line."); return; }
      if (p.round > ROUNDS() || p.line > PER()) { m.className = "small err"; m.textContent = t("lu.badPeer", "That code doesn't work. Check each letter and try again."); return; }
      const i = s.peer.findIndex((x) => x.round === p.round && x.line === p.line && x.group === p.group && x.seat === p.seat);
      if (i >= 0) s.peer[i] = p; else s.peer.push(p);
      save(s); render(ctx);
      E.toast(t("lu.peerAdded", "Rating added: {n}/3 for R{r}·L{l}.", { n: p.rating, r: p.round, l: p.line }));
    };
    $("#bd").onsubmit = (e) => {
      e.preventDefault();
      const m = $("#bd-msg"), raw = $("#bd-in").value, r2 = M.decodeResult(raw);
      if (!r2 || r2.room !== KEY) { m.className = "small err"; m.textContent = t("lu.badBoard", "That isn't a Line Upgrader score code."); return; }
      const n = M.normalizeCode(raw), f = n.slice(0, 4) + "-" + n.slice(4);
      if (!s.board.includes(f)) s.board.push(f);
      save(s); render(ctx);
    };
    const send = $("#lu-send");
    if (send) send.onclick = () => {
      s.code = E.saveResult({ room: KEY, lesson: L, score: passes(s), max: ROUNDS() * PER(), bonus: Math.min(63, peerPoints(s)) });
      save(s);
      const m = $("#lu-smsg"); m.className = "small okmsg"; m.textContent = t("lu.sent", "Saved to My scores with code {code}.", { code: s.code });
    };
  }
  function codeBoxHTML(code) { return E.codeBox(code, t("lu.yourScoreCode", "Your score code (updates as you work)")); }

  E.registerRoom({
    key: KEY, order: 2, colour: "line", lessons: [L], title: "Line Upgrader", render,
    summary() { const s = state(); const n = s.locked.filter(Boolean).length; return n || Object.keys(s.answers).length ? t("lu.summary", "{n}/{r} rounds · {p} pass", { n, r: ROUNDS(), p: passes(s) }) : ""; },
    scores() {
      const list = E.results(KEY), s = state();
      if (!list.length && !Object.keys(s.answers).length) return "";
      return `<p>${esc(t("lu.scoreLine", "{p}/{max} lines pass · {peer} peer stars · {n}/{r} rounds finished", { p: passes(s), max: ROUNDS() * PER(), peer: peerPoints(s), n: s.locked.filter(Boolean).length, r: ROUNDS() }))}</p>
        <p class="small">${esc(t("lu.scoreCode", "Score code (same as the trio board)"))}: <span class="code">${esc(myCode(s))}</span></p>`;
    },
    scoreLines() { const s = state(); return Object.keys(s.answers).length || E.results(KEY).length ? [t("lu.scoreLine", "{p}/{max} lines pass · {peer} peer stars · {n}/{r} rounds finished", { p: passes(s), max: ROUNDS() * PER(), peer: peerPoints(s), n: s.locked.filter(Boolean).length, r: ROUNDS() }) + " · " + myCode(s)] : []; }
  });
})();
