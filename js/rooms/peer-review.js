/* Room: Peer-review form (L12). Five questions about a classmate's draft, exported as text. */
(function () {
  "use strict";
  const E = window.ELF, KEY = "peerReview", L = 12;
  const { t, esc, $, M } = E;

  const qs = () => ((E.C.rooms[KEY] || {}).questions || []).map((q, i) => (typeof q === "string" ? { id: "q" + (i + 1), text: q } : Object.assign({ id: "q" + (i + 1) }, q, { text: q.question || q.text || q.q || q.label || "", label: q.question || q.text ? q.label || "" : "" })));
  function state() { const s = E.roomState(KEY, null) || {}; s.a = s.a || {}; s.o = s.o || {}; return s; }
  const save = (s) => E.setRoomState(KEY, s);
  const answered = (s) => qs().filter((q) => String(s.a[q.id] || "").trim() || s.o[q.id]).length;
  function asText(s) {
    const su = E.setup();
    const out = [(E.C.rooms[KEY] || {}).exportHeading || t("pr.textHead", "Peer-review sheet"), `${t("pr.writer", "Writer")}: ${s.writer || "—"}${s.writerField ? " (" + s.writerField + ")" : ""}`,
      `${t("pr.reviewer", "Reviewer")}: ${su.name} · G${su.group} ${E.profLabel(su.group)} · ${M.isoDate()}`, ""];
    qs().forEach((q, i) => {
      out.push(`${i + 1}. ${q.label ? q.label + ": " : ""}${q.text}`);
      if (s.o[q.id]) out.push("   [" + s.o[q.id] + "]");
      out.push("   " + (String(s.a[q.id] || "").trim() || "—"));
    });
    return out.join("\n");
  }
  function render(ctx) {
    const s = state(), Q = qs();
    ctx.el.innerHTML = `${E.roomHead(KEY, L)}
    <section class="panel intro"><p>${esc((E.C.rooms[KEY] || {}).intro || t("pr.intro", "You are the reader from another field. Describe what you understood; don't fix the writing. The writer listens and submits this sheet with her assignment."))}</p></section>
    <section class="panel">
      <div class="form two-col">
        <label class="field"><span>${esc(t("pr.writerName", "Writer's name"))}</span><input id="pr-w" value="${esc(s.writer || "")}" maxlength="40"></label>
        <label class="field"><span>${esc(t("pr.writerField", "Writer's field"))}</span><input id="pr-wf" value="${esc(s.writerField || "")}" maxlength="40"></label>
      </div>
    </section>
    <ol class="qlist">${Q.map((q, i) => `
      <li class="panel q"><h2><span class="qn">${i + 1}</span><span>${q.label ? `<span class="qlabel">${esc(q.label)}</span>` : ""}${esc(q.text)}</span></h2>
        ${q.options && q.options.length ? `<div class="chips" role="radiogroup" aria-label="${esc(q.text)}">${q.options.map((o, j) => `<label class="chip"><input type="radio" name="o-${esc(q.id)}" value="${esc(o)}" data-o="${esc(q.id)}" ${s.o[q.id] === o ? "checked" : ""}><span>${esc(o)}</span></label>`).join("")}</div>` : ""}
        <label class="field"><span class="sr">${esc(t("pr.answer", "Your answer"))}</span><textarea rows="3" data-q="${esc(q.id)}" placeholder="${esc(q.frame || "")}">${esc(s.a[q.id] || "")}</textarea></label>
      </li>`).join("")}</ol>
    <section class="panel"><p class="small muted" id="pr-prog"></p>
      <div class="row"><button class="btn primary" id="pr-copy" type="button">${esc(t("pr.copy", "Copy the sheet as text"))}</button><span id="pr-msg" class="small" aria-live="polite"></span></div>
      <pre class="export" id="pr-pre"></pre>
      <div class="row"><button class="btn ghost small" id="pr-new" type="button">${esc(t("pr.new", "Start a new sheet"))}</button></div></section>`;
    const upd = () => { $("#pr-pre").textContent = asText(s); $("#pr-prog").textContent = t("pr.progress", "{n} of {m} answered", { n: answered(s), m: Q.length }); };
    ctx.el.oninput = (e) => {
      const el = e.target;
      if (el.id === "pr-w") s.writer = el.value; else if (el.id === "pr-wf") s.writerField = el.value;
      else if (el.dataset.q) s.a[el.dataset.q] = el.value;
      else return;
      save(s); upd();
    };
    ctx.el.onchange = (e) => { const el = e.target; if (el.dataset.o) { s.o[el.dataset.o] = el.value; save(s); upd(); } };
    $("#pr-copy").onclick = () => E.copy(asText(s), $("#pr-msg"), $("#pr-pre"));
    $("#pr-new").onclick = () => { if (confirm(t("pr.confirmNew", "Clear this sheet and start again?"))) { E.setRoomState(KEY, {}); render(ctx); } };
    upd();
  }
  E.registerRoom({
    key: KEY, order: 4, colour: "peer", lessons: [L], title: "Peer-review form", render,
    summary() { const s = state(); const n = answered(s); return n ? t("pr.summary", "{n}/{m} answered", { n, m: qs().length }) : ""; },
    scores() { const s = state(); const n = answered(s); return n ? `<p>${esc(t("pr.scoreLine", "Sheet for {w}: {n} of {m} questions answered", { w: s.writer || "—", n, m: qs().length }))}</p>` : ""; },
    scoreLines() { const s = state(); const n = answered(s); return n ? [t("pr.scoreLine", "Sheet for {w}: {n} of {m} questions answered", { w: s.writer || "—", n, m: qs().length })] : []; }
  });
})();
