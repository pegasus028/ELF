/* Room: Evidence Audit (L9). Eight experiences, evidence types, flags, copy as text. */
(function () {
  "use strict";
  const E = window.ELF, KEY = "evidenceAudit";
  const { t, esc, $, $$, M } = E;
  const FIELDS = ["experience", "role", "when", "scale", "type", "link", "sowhat"];

  function data() { return E.C.rooms[KEY] || {}; }
  function types() {
    return (data().evidenceTypes || []).map((x) => {
      if (typeof x === "string") {
        const id = x.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
        return { id, label: x, verifiable: !/^(none|no evidence|nothing)/i.test(x), needsLink: /link|url|online/i.test(x) };
      }
      const id = x.id || x.key;
      return { id, label: x.label || id, example: x.description || x.example || x.hint || "",
        verifiable: x.verifiable !== undefined ? x.verifiable !== false : id !== "none",
        needsLink: x.needsLink !== undefined ? !!x.needsLink : id === "link" };
    });
  }
  const rowsN = () => data().rows || 8;
  /* Field labels, hints and examples from rooms.evidenceAudit.fields (key 'evidenceType' = the type picker). */
  function fieldInfo(k) {
    const key = k === "type" ? "evidenceType" : k;
    const f = (data().fields || []).find((x) => x.key === key || x.key === k) || {};
    return f;
  }
  const numberOk = () => { const lu = E.C.rooms.lineUpgrader || {}; return M.numberTester(lu.check && lu.check.numberPattern); };
  function flagText(k, def) {
    const f = (data().flags || {})[k];
    if (!f) return { label: def.label, message: def.message };
    if (typeof f === "string") return { label: def.label, message: f };
    return { label: f.label || def.label, message: f.message || f.text || def.message };
  }
  const FLAG_DEF = {
    unverifiable: { label: t("ea.flag.unverifiable", "Unverifiable"), message: t("ea.flag.unverifiableMsg", "Nobody could check this yet. Add evidence, or a link for this type.") },
    noScale: { label: t("ea.flag.noScale", "No scale"), message: t("ea.flag.noScaleMsg", "Add a number, duration or size.") }
  };
  function state() {
    const s = E.roomState(KEY, null) || { rows: [] };
    while (s.rows.length < rowsN()) s.rows.push({});
    return s;
  }
  const save = (s) => E.setRoomState(KEY, s);
  function stats(s) {
    const ty = types();
    let ready = 0, flags = 0, filled = 0;
    s.rows.forEach((r) => {
      const f = M.auditFlags(r, ty, numberOk());
      if (f.empty) return;
      filled++;
      const n = (f.unverifiable ? 1 : 0) + (f.noScale ? 1 : 0);
      flags += n;
      if (!n && String(r.experience || "").trim()) ready++;
    });
    return { ready, flags, filled };
  }
  function flagsHTML(r) {
    const f = M.auditFlags(r, types(), numberOk());
    if (f.empty) return `<span class="flag none">${esc(t("ea.empty", "Empty"))}</span>`;
    const out = [];
    if (f.unverifiable) { const x = flagText("unverifiable", FLAG_DEF.unverifiable); out.push(`<span class="flag bad" title="${esc(x.message)}">${esc(x.label)}</span>`); }
    if (f.noScale) { const x = flagText("noScale", FLAG_DEF.noScale); out.push(`<span class="flag bad" title="${esc(x.message)}">${esc(x.label)}</span>`); }
    if (!out.length) out.push(`<span class="flag ok">${esc(t("ea.ready", "Ready"))}</span>`);
    return out.join("");
  }
  function msgsHTML(r) {
    const f = M.auditFlags(r, types(), numberOk());
    if (f.empty) return "";
    const out = [];
    if (f.unverifiable) out.push(flagText("unverifiable", FLAG_DEF.unverifiable).message);
    if (f.noScale) out.push(flagText("noScale", FLAG_DEF.noScale).message);
    return out.map((m) => `<li>${esc(m)}</li>`).join("");
  }
  function asText(s) {
    const su = E.setup(), ty = types();
    const out = [data().exportHeading || t("ea.textHead", "Evidence Audit"), `${su.name} · G${su.group} ${E.profLabel(su.group)} · ${M.isoDate()}`, ""];
    s.rows.forEach((r, i) => {
      const f = M.auditFlags(r, ty, numberOk());
      if (f.empty) return;
      const typ = (ty.find((x) => x.id === r.type) || {}).label || "—";
      const fl = [f.unverifiable ? flagText("unverifiable", FLAG_DEF.unverifiable).label : "", f.noScale ? flagText("noScale", FLAG_DEF.noScale).label : ""].filter(Boolean);
      out.push(`${i + 1}. ${r.experience || "—"}`);
      out.push(`   ${t("ea.f.role", "Role")}: ${r.role || "—"} | ${t("ea.f.when", "When")}: ${r.when || "—"} | ${t("ea.f.scale", "Scale")}: ${r.scale || "—"}`);
      out.push(`   ${t("ea.f.type", "Evidence")}: ${typ}${r.link ? " | " + r.link : ""}`);
      if (r.sowhat) out.push(`   ${t("ea.f.sowhat", "So what")}: ${r.sowhat}`);
      if (fl.length) out.push(`   ${t("ea.flagsLabel", "Flags")}: ${fl.join(", ")}`);
    });
    const st = stats(s);
    out.push("", t("ea.textSummary", "{ready} of {n} rows ready · {flags} flags left", { ready: st.ready, n: rowsN(), flags: st.flags }));
    return out.join("\n");
  }

  function render(ctx) {
    const s = state(), ty = types(), ex = data().examples || {};
    const L = 9;
    const field = (i, k, label, val, ph, wide) => {
      const f = fieldInfo(k);
      const p = i === 0 ? (f.example || ph) : (f.hint || ph);
      return `<label class="field${wide ? " wide" : ""}"><span>${esc(f.label || label)}</span><input data-row="${i}" data-k="${k}" value="${esc(val || "")}" placeholder="${esc(p || "")}" maxlength="160"></label>`;
    };
    ctx.el.innerHTML = `${E.roomHead(KEY, L)}
    <section class="panel intro"><p>${esc(data().intro || t("ea.intro", "List eight experiences you could use in a portfolio. For each one say how a reader could check it. The flags tell you what an admissions reader would question."))}</p>
      ${(data().frames || []).length ? `<details><summary>${esc(t("ea.framesHead", "Sentence frames"))}</summary><ul class="list">${data().frames.map((f) => `<li>${esc(f)}</li>`).join("")}</ul></details>` : ""}
      <details><summary>${esc(t("ea.typesHead", "Evidence types"))}</summary><ul class="list">${ty.map((x) => `<li><b>${esc(x.label)}</b>${x.example ? " · " + esc(x.example) : ""}${x.needsLink ? " · " + esc(t("ea.needsLink", "needs a link")) : ""}</li>`).join("")}</ul></details></section>
    <div class="sticky-sum" id="ea-sum"></div>
    <ol class="audit" id="ea-rows">${s.rows.map((r, i) => `
      <li class="arow" data-i="${i}">
        <div class="arow-h"><b class="num">${i + 1}</b><span class="flags" id="ea-fl-${i}">${flagsHTML(r)}</span>
          <span class="mv"><button class="btn tiny ghost" type="button" data-up="${i}" aria-label="${esc(t("ea.up", "Move row {n} up", { n: i + 1 }))}" ${i === 0 ? "disabled" : ""}>↑</button><button class="btn tiny ghost" type="button" data-down="${i}" aria-label="${esc(t("ea.down", "Move row {n} down", { n: i + 1 }))}" ${i === s.rows.length - 1 ? "disabled" : ""}>↓</button></span></div>
        <div class="agrid">
          ${field(i, "experience", t("ea.f.experience", "Experience"), r.experience, i === 0 ? ex.experience : "", true)}
          ${field(i, "role", t("ea.f.role", "Role"), r.role, i === 0 ? ex.role : "")}
          ${field(i, "when", t("ea.f.when", "When"), r.when, i === 0 ? ex.when : "")}
          ${field(i, "scale", t("ea.f.scale", "Scale"), r.scale, i === 0 ? ex.scale : t("ea.scalePh", "number, duration or size"))}
          <label class="field"><span>${esc(fieldInfo("type").label || t("ea.f.type", "Evidence"))}</span><select data-row="${i}" data-k="type"><option value="">${esc(t("ea.pickType", "Choose a type"))}</option>${ty.map((x) => `<option value="${esc(x.id)}" ${r.type === x.id ? "selected" : ""}>${esc(x.label)}</option>`).join("")}</select></label>
          ${field(i, "link", t("ea.f.link", "Link"), r.link, "https://…", true)}
          ${field(i, "sowhat", data().c1Extension ? t("ea.f.sowhatC1", "So what? (C1)") : t("ea.f.sowhatLong", "So what? (C1: the outcome that matters to your programme)"), r.sowhat, data().c1Extension || "", true)}
        </div>
        <ul class="amsg" id="ea-msg-${i}">${msgsHTML(r)}</ul>
      </li>`).join("")}</ol>
    <section class="panel"><h2>${esc(t("ea.exportHead", "Send it to Classroom"))}</h2>
      <div class="row"><button class="btn primary" id="ea-copy" type="button">${esc(t("ea.copy", "Copy as text"))}</button><span id="ea-cmsg" class="small" aria-live="polite"></span></div>
      <pre class="export" id="ea-pre"></pre></section>`;
    const sum = () => {
      const st = stats(s);
      $("#ea-sum").innerHTML = `<span><b class="tnum">${st.ready}</b>/${rowsN()} ${esc(t("ea.sumReady", "ready"))}</span><span class="${st.flags ? "err" : "okmsg"}"><b class="tnum">${st.flags}</b> ${esc(t("ea.sumFlags", "flags"))}</span>`;
      $("#ea-pre").textContent = asText(s);
    };
    const onEdit = (e) => {
      const el = e.target; if (!el.dataset || el.dataset.row == null) return;
      const i = +el.dataset.row;
      s.rows[i][el.dataset.k] = el.value;
      save(s);
      $("#ea-fl-" + i).innerHTML = flagsHTML(s.rows[i]);
      $("#ea-msg-" + i).innerHTML = msgsHTML(s.rows[i]);
      sum();
    };
    $("#ea-rows").addEventListener("input", onEdit);
    $("#ea-rows").addEventListener("change", onEdit);
    $$("[data-up],[data-down]", ctx.el).forEach((b) => {
      b.onclick = () => {
        const i = +(b.dataset.up != null ? b.dataset.up : b.dataset.down), j = b.dataset.up != null ? i - 1 : i + 1;
        if (j < 0 || j >= s.rows.length) return;
        [s.rows[i], s.rows[j]] = [s.rows[j], s.rows[i]];
        save(s); render(ctx);
        const nb = ctx.el.querySelector(`[data-${b.dataset.up != null ? "up" : "down"}="${j}"]`); if (nb && !nb.disabled) nb.focus();
      };
    });
    $("#ea-copy").onclick = () => copyIt();
    const copyIt = () => E.copy(asText(s), $("#ea-cmsg"), $("#ea-pre"));
    void FIELDS;
    sum();
  }

  E.registerRoom({
    key: KEY, order: 1, colour: "audit", lessons: [9], title: "Evidence Audit", render,
    summary() { const st = stats(state()); return st.filled ? t("ea.summary", "{ready}/{n} ready", { ready: st.ready, n: rowsN() }) : ""; },
    scores() { const st = stats(state()); return st.filled ? `<p>${esc(t("ea.summaryLong", "{ready} of {n} rows ready · {flags} flags left", { ready: st.ready, n: rowsN(), flags: st.flags }))}</p>` : ""; },
    scoreLines() { const st = stats(state()); return st.filled ? [t("ea.summaryLong", "{ready} of {n} rows ready · {flags} flags left", { ready: st.ready, n: rowsN(), flags: st.flags })] : []; }
  });
})();
