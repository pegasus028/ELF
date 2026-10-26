/* Room: Cliché Hunter (L11). Tap the ten clichés in a model statement, then rewrite three. */
(function () {
  "use strict";
  const E = window.ELF, KEY = "clicheHunter", L = 11;
  const { t, esc, $, $$, M } = E;

  const data = () => E.C.rooms[KEY] || {};
  const ban = () => (data().banList || []).map((b) => (typeof b === "string" ? { cliche: b, replacement: "" } : b));
  let matchers = null;
  const match = () => matchers || (matchers = M.clicheMatchers(ban()));
  const NREW = () => data().rewritesRequired || data().rewrites || 3;
  const needDetail = () => (data().requireDetail !== undefined ? !!data().requireDetail : /digit|capital/i.test(data().rewriteRule || ""));
  const fb = (k, def, vars) => { const f = data().feedback || {}; return f[k] ? t("_", f[k], vars) : t("ch." + k, def, vars); };
  function spans() {
    const tx = data().text || {}, body = tx.body || "";
    return (tx.spans || []).map((sp, i) => ({ i, start: sp[0], end: sp[1], ref: sp[2], text: body.slice(sp[0], sp[1]), b: M.spanIndex(sp[2], ban()) }))
      .sort((a, b) => a.start - b.start);
  }
  function state() {
    const s = E.roomState(KEY, null) || {};
    s.found = s.found || []; s.misses = s.misses || 0; s.revealed = !!s.revealed;
    s.rewrites = s.rewrites || []; while (s.rewrites.length < NREW()) s.rewrites.push({ span: "", text: "", ok: false });
    return s;
  }
  const save = (s) => E.setRoomState(KEY, s);
  const accepted = (s) => s.rewrites.filter((r) => r.ok).length;
  const penalty = (s) => Math.floor(s.misses / 3);
  const total = (s) => Math.max(0, s.found.length - penalty(s)) + accepted(s);
  const maxScore = () => spans().length + NREW();

  /** Text as tappable words; words inside a span carry its index. */
  function tokens(body, sp) {
    const out = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(body))) {
      const a = m.index, b = a + m[0].length;
      const hit = sp.find((x) => a < x.end && b > x.start);
      out.push({ text: m[0], span: hit ? hit.i : -1, pre: body.slice(out.length ? out[out.length - 1].endAt : 0, a), endAt: b });
    }
    return out;
  }

  function render(ctx) {
    const s = state(), sp = spans(), tx = data().text || {};
    const toks = tokens(tx.body || "", sp);
    const foundSet = new Set(s.found);
    const doneHunt = s.found.length === sp.length || s.revealed;
    const foundSpans = sp.filter((x) => foundSet.has(x.i) || s.revealed);
    ctx.el.innerHTML = `${E.roomHead(KEY, L)}
    <section class="panel intro"><p>${esc(data().intro || t("ch.intro", "This model statement hides {n} clichés from the ban list. Tap any word of a cliché to mark it. Wrong taps are counted, so read first.", { n: sp.length }))}</p><p class="small muted">${esc(t("ch.tapNote2", "Tap any word of a cliché. Every 3 wrong taps cost 1 point, so read before you tap."))}</p></section>
    <div class="sticky-sum static" id="ch-sum"></div>
    <section class="panel hunt">
      ${tx.title ? `<h2>${esc(tx.title)}</h2>` : ""}
      <p class="huntext" id="ch-text">${toks.map((k, n) => `${/\n\s*\n/.test(k.pre) ? '<span class="pbreak"></span>' : esc(k.pre)}<button type="button" class="w${k.span >= 0 && (foundSet.has(k.span)) ? " hit" : ""}${k.span >= 0 && s.revealed && !foundSet.has(k.span) ? " shown" : ""}" data-n="${n}" data-span="${k.span}">${esc(k.text)}</button>`).join("")}</p>
      <div class="row">${doneHunt ? "" : `<button class="btn ghost small" id="ch-reveal" type="button">${esc(t("ch.reveal", "Show the ones I missed"))}</button>`}</div>
    </section>
    <section class="panel"><h2>${esc(t("ch.foundHead", "Found so far"))}</h2>
      ${foundSpans.length ? `<ul class="found">${foundSpans.map((x) => { const b = ban()[x.b] || {}; return `<li class="${foundSet.has(x.i) ? "" : "missed"}"><mark>${esc(x.text)}</mark>${b.replacement ? `<span class="small muted">${esc(t("ch.instead", "Instead:"))} ${esc(b.replacement)}</span>` : ""}</li>`; }).join("")}</ul>` : `<p class="muted small">${esc(t("ch.noneYet", "Nothing yet. Tap a word in the statement."))}</p>`}
    </section>
    <section class="panel"><h2>${esc(t("ch.rewriteHead", "Rewrite {n}", { n: NREW() }))}</h2>
      <p class="small muted">${esc(t("ch.rewriteIntro", "Pick a cliché you found and rewrite its sentence with concrete evidence: what you did, when, how many. The checker rejects anything on the ban list."))}</p>
      ${s.rewrites.map((rw, i) => `
        <div class="rw" data-i="${i}">
          <label class="field"><span>${esc(t("ch.which", "Cliché {n}", { n: i + 1 }))}</span><select data-rs="${i}"><option value="">${esc(t("ch.pick", "Choose one you found"))}</option>${foundSpans.map((x) => `<option value="${x.i}" ${String(rw.span) === String(x.i) ? "selected" : ""}>${esc(x.text)}</option>`).join("")}</select></label>
          <label class="field"><span>${esc(t("ch.yourRewrite", "Your rewrite"))}</span><textarea rows="3" data-rt="${i}">${esc(rw.text)}</textarea></label>
          <div class="row"><button class="btn small" type="button" data-rc="${i}">${esc(t("ch.check", "Check rewrite"))}</button></div>
          <div id="rw-msg-${i}" aria-live="polite">${rw.checked ? rwMsg(rw) : ""}</div>
        </div>`).join("")}
    </section>
    <section class="panel"><div class="row"><button class="btn primary" id="ch-finish" type="button">${esc(t("ch.finish", "Save my score"))}</button></div><div id="ch-out" aria-live="polite">${s.code ? E.codeBox(s.code) : ""}</div></section>
    <details class="panel"><summary>${esc(t("ch.banHead", "The ban list ({n})", { n: ban().length }))}</summary><ul class="list">${ban().map((b) => `<li><b>${esc(b.cliche)}</b>${b.replacement ? " → " + esc(b.replacement) : ""}</li>`).join("")}</ul></details>`;
    const sum = () => { $("#ch-sum").innerHTML = `<span>${esc(t("ch.found", "Found"))} <b class="tnum">${s.found.length}</b>/${sp.length}</span><span>${esc(t("ch.misses", "Wrong taps"))} <b class="tnum">${s.misses}</b>${penalty(s) ? ` <span class="err small">(−${penalty(s)})</span>` : ""}</span><span>${esc(t("ch.rewrites", "Rewrites"))} <b class="tnum">${accepted(s)}</b>/${NREW()}</span>`; };
    sum();
    $("#ch-text").addEventListener("click", (e) => {
      const b = e.target.closest("button.w"); if (!b) return;
      const i = +b.dataset.span;
      if (i < 0) {
        if (s.revealed) return;
        s.misses++; save(s); sum();
        b.classList.remove("miss"); void b.offsetWidth; b.classList.add("miss");
        return;
      }
      if (s.found.includes(i) || s.revealed) return;
      s.found.push(i); save(s);
      const n = +b.dataset.n;
      render(ctx);
      const nb = ctx.el.querySelector(`button.w[data-n="${n}"]`); if (nb) nb.focus();
      if (s.found.length === sp.length) E.toast(t("ch.allFound", "All {n} found. Now rewrite three.", { n: sp.length }));
    });
    const rv = $("#ch-reveal");
    if (rv) rv.onclick = () => { if (!confirm(t("ch.confirmReveal", "Show the rest? You can't score the ones you haven't found."))) return; s.revealed = true; save(s); render(ctx); };
    $$("[data-rs]", ctx.el).forEach((el) => { el.onchange = () => { const r = s.rewrites[+el.dataset.rs]; r.span = el.value; r.ok = false; r.checked = false; save(s); }; });
    $$("[data-rt]", ctx.el).forEach((el) => { el.oninput = () => { const r = s.rewrites[+el.dataset.rt]; r.text = el.value; r.ok = false; r.checked = false; save(s); }; });
    $$("[data-rc]", ctx.el).forEach((b) => {
      b.onclick = () => {
        const i = +b.dataset.rc, r = s.rewrites[i];
        r.span = ctx.el.querySelector(`[data-rs="${i}"]`).value;
        r.text = ctx.el.querySelector(`[data-rt="${i}"]`).value;
        const used = s.rewrites.some((o, j) => j !== i && o.ok && String(o.span) === String(r.span));
        const orig = (sp.find((x) => String(x.i) === String(r.span)) || {}).text || "";
        const c = M.checkRewrite(r.text, orig, match(), data().minWords || 6, needDetail());
        r.checked = true;
        r.res = { banned: c.banned, short: c.short, same: c.same, noDetail: c.noDetail, nospan: r.span === "", dup: used };
        r.ok = c.ok && r.span !== "" && !used;
        save(s);
        $("#rw-msg-" + i).innerHTML = rwMsg(r);
        sum();
      };
    });
    $("#ch-finish").onclick = () => {
      s.code = E.saveResult({ room: KEY, lesson: L, score: total(s), max: maxScore(), bonus: Math.min(63, s.misses) });
      save(s);
      $("#ch-out").innerHTML = E.codeBox(s.code) + `<p class="small okmsg">${esc(t("ch.saved", "Saved: {score}/{max}. See My scores.", { score: total(s), max: maxScore() }))}</p>`;
    };
  }
  function rwMsg(r) {
    if (r.ok) return `<p class="small okmsg">${esc(fb("accepted", "Accepted: no banned phrase."))}</p>`;
    const x = r.res || {}, out = [];
    if (x.nospan) out.push(t("ch.needSpan", "Choose which cliché you are replacing."));
    if (x.dup) out.push(t("ch.dup", "You already rewrote that one. Choose a different cliché."));
    if (x.banned && x.banned.length) out.push(fb("banned", "Still on the ban list: {cliche}.", { cliche: x.banned.join(", ") }));
    if (x.noDetail) out.push(fb("needsDetail", "Add a concrete detail: a number, a date, a place or a name."));
    if (x.short) out.push(t("ch.short", "Write a full sentence with evidence (at least {n} words).", { n: (E.C.rooms[KEY] || {}).minWords || 6 }));
    if (x.same) out.push(t("ch.same", "That is the original wording."));
    return `<ul class="tips err">${out.map((m) => `<li>${esc(m)}</li>`).join("")}</ul>`;
  }

  E.registerRoom({
    key: KEY, order: 3, colour: "cliche", lessons: [L], title: "Cliché Hunter", render,
    summary() { const s = state(); return s.found.length ? t("ch.summary", "{f}/{n} found", { f: s.found.length, n: spans().length }) : ""; },
    scores() {
      const list = E.results(KEY), b = E.best(list);
      if (!b) return "";
      return `<p>${esc(t("scores.best", "Best"))}: <b>${b.score}/${b.max}</b> · <span class="code">${esc(b.code)}</span> <span class="small muted">${esc(t("scores.attempts", "{n} saved", { n: list.length }))}</span></p>`;
    },
    scoreLines() { const b = E.best(E.results(KEY)); return b ? [`${b.score}/${b.max} · ${b.code}`] : []; }
  });
})();
