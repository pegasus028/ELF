/* Room: Exit checks (one set of auto-marked items per lesson, from rooms.exitChecks). */
(function () {
  "use strict";
  const E = window.ELF, KEY = "exitChecks";
  const { t, esc, $, $$, M } = E;

  const sets = () => (E.C.rooms[KEY] || {});
  const lessonsList = () => Object.keys(sets()).filter((k) => /^L\d+$/.test(k)).sort();
  function items(L) {
    return (sets()[L] || []).map((it, i) => Object.assign({ id: L + "-" + (i + 1) }, it, { stem: it.stem || it.prompt || it.question || it.q || "", options: it.options || it.choices || [], why: it.why || it.explain || "" }));
  }
  function state() { const s = E.roomState(KEY, null) || {}; s.draft = s.draft || {}; s.last = s.last || {}; return s; }
  const save = (s) => E.setRoomState(KEY, s);
  const lessonNo = (L) => +L.slice(1);

  function render(ctx) {
    const list = lessonsList();
    const L = ctx.arg && sets()[ctx.arg] ? ctx.arg : null;
    if (!L) {
      ctx.el.innerHTML = `${E.roomHead(KEY, lessonNo(list[0] || "L9"), t("room.exitChecks.title", "Exit checks"))}
        <section class="panel"><ul class="plain">${list.map((x) => `<li><a href="#/room/${KEY}/${x}">${esc(t("ex.setName", "Exit check {L}", { L: x }))}</a> <span class="small muted">${esc(E.lessonLabel(lessonNo(x)))}</span></li>`).join("")}</ul></section>`;
      return;
    }
    const s = state(), its = items(L), last = s.last[L];
    const draft = s.draft[L] || [];
    if (last && last.show) return renderResult(ctx, L, its, last);
    ctx.el.innerHTML = `${E.roomHead(KEY, lessonNo(L), t("ex.setName", "Exit check {L}", { L }))}
    <section class="panel intro"><p>${esc(typeof E.C.uiText.exitCheckIntro === "string" ? E.C.uiText.exitCheckIntro : t("ex.intro", "{n} questions on today's lesson. Answer all, then check. You'll see why for anything you miss.", { n: its.length }))}</p></section>
    <form id="ex" novalidate><ol class="exq">${its.map((it, i) => `
      <li class="panel"><fieldset><legend><span class="qn">${i + 1}</span>${esc(it.stem)}</legend>
        ${M.isCloze(it) ? `<label class="field"><span class="sr">${esc(t("ex.gap", "Your answer for the gap"))}</span><input name="x${i}" data-cloze="${i}" value="${esc(draft[i] == null ? "" : draft[i])}" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="${esc(t("ex.gapPh", "Type the missing word(s)"))}"></label>`
          : `<div class="opts">${it.options.map((o, j) => `<label class="opt"><input type="radio" name="x${i}" value="${j}" ${draft[i] === j ? "checked" : ""}><span>${esc(o)}</span></label>`).join("")}</div>`}</fieldset></li>`).join("")}</ol>
      <p class="small err" id="ex-msg" role="alert"></p>
      <div class="row"><button class="btn primary" type="submit">${esc(t("ex.submit", "Check my answers"))}</button></div></form>`;
    $("#ex").onchange = $("#ex").oninput = (e) => {
      const m = /^x(\d+)$/.exec(e.target.name || ""); if (!m) return;
      const d = s.draft[L] || []; d[+m[1]] = e.target.dataset.cloze != null ? e.target.value : +e.target.value; s.draft[L] = d; save(s);
    };
    $("#ex").onsubmit = (e) => {
      e.preventDefault();
      const ans = its.map((it, i) => {
        if (M.isCloze(it)) { const el = ctx.el.querySelector(`input[name="x${i}"]`); const v = el ? el.value.trim() : ""; return v ? v : null; }
        const el = ctx.el.querySelector(`input[name="x${i}"]:checked`); return el ? +el.value : null;
      });
      const missing = ans.filter((a) => a === null).length;
      if (missing) {
        $("#ex-msg").textContent = t("ex.missing", "{n} unanswered. Answer every question first.", { n: missing });
        const first = ans.findIndex((a) => a === null); const el = ctx.el.querySelector(`input[name="x${first}"]`); if (el) el.focus();
        return;
      }
      const sc = M.scoreExit(its, ans);
      const attempt = E.results(KEY, lessonNo(L)).length + 1;
      const code = E.saveResult({ room: KEY, lesson: lessonNo(L), score: sc.score, max: sc.max, bonus: Math.min(63, attempt), attempt });
      s.last[L] = { ans, score: sc.score, max: sc.max, code, attempt, show: true };
      s.draft[L] = [];
      save(s);
      renderResult(ctx, L, its, s.last[L]);
      window.scrollTo(0, 0);
    };
  }
  function renderResult(ctx, L, its, last) {
    const sc = M.scoreExit(its, last.ans);
    const all = E.results(KEY, lessonNo(L)), first = all[0], bestR = E.best(all);
    ctx.el.innerHTML = `${E.roomHead(KEY, lessonNo(L), t("ex.setName", "Exit check {L}", { L }))}
    <section class="panel result"><p class="score"><b class="tnum">${sc.score}</b><span>/${sc.max}</span></p>
      <p>${esc(sc.score === sc.max ? t("ex.perfect", "All correct.") : t("ex.someWrong", "{n} to review below.", { n: sc.wrong.length }))}</p>
      <p class="small muted">${esc(t("ex.attemptN", "Attempt {n}", { n: last.attempt || all.length }))}</p>
      ${E.codeBox(last.code)}
      ${first && first.code !== last.code ? `<p class="small"><b>${esc(t("ex.firstTry", "First try"))}: ${first.score}/${first.max}</b> <span class="code">${esc(first.code)}</span> · ${esc(t("ex.best", "Your best: {s}/{m}", { s: bestR.score, m: bestR.max }))}</p>` : ""}</section>
    ${sc.wrong.length ? `<h2 class="sub">${esc(t("ex.reviewHead", "Review"))}</h2><ol class="review">${sc.wrong.map((w) => { const it = its[w.i]; return `<li class="panel">
        <p><span class="qn">${w.i + 1}</span>${esc(it.stem)}</p>
        <p class="small"><span class="no">${esc(t("ex.yours", "Your answer"))}:</span> ${esc(w.cloze ? w.got : it.options[w.got])}</p>
        <p class="small"><span class="yes">${esc(t("ex.correct", "Correct"))}:</span> ${esc(w.cloze ? it.answer : it.options[w.key])}</p>
        ${it.why ? `<p class="small muted">${esc(it.why)}</p>` : ""}</li>`; }).join("")}</ol>` : ""}
    <div class="row"><button class="btn" id="ex-again" type="button">${esc(t("ex.again", "Try again"))}</button><a class="btn ghost" href="#/rooms">${esc(t("backToRooms", "Rooms"))}</a></div>`;
    $("#ex-again").onclick = () => { const s = state(); if (s.last[L]) s.last[L].show = false; save(s); render(ctx); window.scrollTo(0, 0); };
  }

  E.registerRoom({
    key: KEY, order: 9, colour: "exit", lessons: [], title: "Exit checks", render,
    summary(L) { if (!L) return ""; const f = E.results(KEY, lessonNo(L))[0]; return f ? t("ex.summaryFirst", "First try {s}/{m}", { s: f.score, m: f.max }) : ""; },
    scores() {
      const rows = lessonsList().map((L) => { const list = E.results(KEY, lessonNo(L)); const f = list[0], b = E.best(list); return f ? `<li><b>${esc(L)}</b> ${esc(t("ex.firstTry", "First try"))} <b>${f.score}/${f.max}</b> <span class="code">${esc(f.code)}</span> <span class="small muted">${esc(t("ex.bestOf", "best {s}/{m} · {n} attempts", { s: b.score, m: b.max, n: list.length }))}</span></li>` : ""; }).join("");
      return rows ? `<ul class="plain codes">${rows}</ul>` : "";
    },
    scoreLines() { return lessonsList().map((L) => { const list = E.results(KEY, lessonNo(L)), f = list[0], b = E.best(list); return f ? `${L} ${t("ex.firstTry", "First try")} ${f.score}/${f.max} · ${f.code} · ${t("ex.bestOf", "best {s}/{m} · {n} attempts", { s: b.score, m: b.max, n: list.length })}` : ""; }).filter(Boolean); }
  });
})();
