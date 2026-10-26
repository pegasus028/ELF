/* Room: Portfolio question cards (L14). Twelve interviewer probes; shuffle, mark used. */
(function () {
  "use strict";
  const E = window.ELF, KEY = "questionCards", L = 14;
  const { t, esc, $, M } = E;

  const cards = () => (E.C.rooms[KEY] || []).map((c, i) => (typeof c === "string" ? { id: "q" + (i + 1), text: c } : Object.assign({ id: c.id || "q" + (i + 1) }, c, { text: c.text || c.question || c.q || "" })));
  function state() {
    const n = cards().length;
    let s = E.roomState(KEY, null);
    if (!s || !Array.isArray(s.order) || s.order.length !== n) s = { order: Array.from({ length: n }, (_, i) => i), pos: 0, used: [] };
    return s;
  }
  const save = (s) => E.setRoomState(KEY, s);
  function render(ctx) {
    const s = state(), all = cards(), n = all.length;
    const idx = s.order[s.pos] || 0, card = all[idx] || { text: "" };
    const used = s.used.includes(idx);
    ctx.el.innerHTML = `${E.roomHead(KEY, L)}
    <section class="panel intro"><p>${esc(t("qc.intro", "Interviewer: pick a card, then point it at one claim in your partner's statement: 'You wrote that…'. Mark it used so you don't ask it twice."))}</p></section>
    <section class="deck">
      <div class="qcard${used ? " used" : ""}" id="qc-card" aria-live="polite">
        <span class="qc-n tnum">${esc(t("qc.count", "Card {i} of {n}", { i: s.pos + 1, n }))}</span>
        ${card.type ? `<span class="qc-type">${esc(card.type)}</span>` : ""}<p class="qc-text">${esc(card.text)}</p>
        ${card.listenFor ? `<p class="small qc-fu"><b>${esc(t("qc.listenFor", "Listen for:"))}</b> ${esc(card.listenFor)}</p>` : ""}
        ${card.followUp ? `<p class="small qc-fu">${esc(t("qc.followUp", "Follow-up:"))} ${esc(card.followUp)}</p>` : ""}
        ${used ? `<span class="qc-used">${esc(t("qc.usedTag", "Used"))}</span>` : ""}
      </div>
      <div class="row center">
        <button class="btn" id="qc-prev" type="button" ${s.pos === 0 ? "disabled" : ""}>${esc(t("qc.prev", "Previous"))}</button>
        <button class="btn primary" id="qc-next" type="button" ${s.pos >= n - 1 ? "disabled" : ""}>${esc(t("qc.next", "Next card"))}</button>
      </div>
      <div class="row center">
        <button class="btn ghost" id="qc-use" type="button" aria-pressed="${used}">${esc(used ? t("qc.unuse", "Mark not used") : t("qc.use", "Mark used"))}</button>
        <button class="btn ghost" id="qc-shuf" type="button">${esc(t("qc.shuffle", "Shuffle"))}</button>
        <button class="btn ghost" id="qc-reset" type="button" ${s.used.length ? "" : "disabled"}>${esc(t("qc.reset", "Clear used marks"))}</button>
      </div>
      <p class="small muted center">${esc(t("qc.usedCount", "{u} of {n} used", { u: s.used.length, n }))}</p>
    </section>
    <details class="panel"><summary>${esc(t("qc.all", "All {n} cards", { n }))}</summary><ol class="list">${all.map((c, i) => `<li class="${s.used.includes(i) ? "muted strike" : ""}">${esc(c.text)}</li>`).join("")}</ol></details>`;
    const go = (fn) => { fn(); save(s); render(ctx); };
    $("#qc-prev").onclick = () => go(() => { s.pos = Math.max(0, s.pos - 1); });
    $("#qc-next").onclick = () => go(() => { s.pos = Math.min(n - 1, s.pos + 1); });
    $("#qc-use").onclick = () => go(() => { if (used) s.used = s.used.filter((x) => x !== idx); else s.used.push(idx); });
    $("#qc-shuf").onclick = () => go(() => {
      const unused = M.shuffle(s.order.filter((i) => !s.used.includes(i))), usedL = s.order.filter((i) => s.used.includes(i));
      s.order = unused.concat(usedL); s.pos = 0;
    });
    $("#qc-reset").onclick = () => go(() => { s.used = []; });
  }
  E.registerRoom({
    key: KEY, order: 6, colour: "cards", lessons: [L], title: "Portfolio question cards", render,
    summary() { const s = state(); return s.used.length ? t("qc.summary", "{u}/{n} used", { u: s.used.length, n: cards().length }) : ""; }
  });
})();
