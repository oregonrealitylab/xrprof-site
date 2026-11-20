/* XR for Learning Decision Tree: the engine. All wording lives in tree-data.js.
   The visitor's answers are a list of steps; everything on screen is rebuilt from that list,
   which is what makes Back, Start over and resuming after a reload simple. */
(function () {
  var X = window.XRTREE, T = X.T, R = X.R;
  var KEY = "xrtree:v1";
  var app = document.getElementById("app");
  var steps = [];                               /* [{ id, oi, seen }]  seen = the advice after this answer was read */
  try { var s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s && Array.isArray(s.steps)) steps = s.steps; } catch (_) {}
  var project = "", light = false;

  var SHORT = ["", "Should I?", "Platform", "Content", "Create"];
  /* Answers left off the one-pager's "Your situation" list to keep it short. */
  var SKIP_FACT = { p1_decider: 1, p1_outdoor: 1, p2_dis: 1, p2_breaks: 1, p2_transport: 1, p3_ar_scan: 1, p3_ar_what: 1, p3_meet: 1, p4_social: 1 };

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function nextOf(o, c) { return typeof o.go === "function" ? o.go(c) : o.go; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ steps: steps })); } catch (_) {} }

  /* Walk the answers from the start and work out where the visitor is now. */
  function replay() {
    var c = {}, log = [], notes = [], id = X.START, i = 0, pending = null, guard = 0;
    while (guard++ < 200) {
      var n = T[id];
      if (!n || n.end) break;
      if (n.auto && n.auto(c) != null) {                       /* already answered in an earlier phase */
        var ao = n.opts[n.auto(c)];
        for (var k in (ao.set || {})) c[k] = ao.set[k];
        log.push({ id: id, node: n, opt: ao, carried: true });
        id = nextOf(ao, c); continue;
      }
      var st = steps[i];
      if (!st || st.id !== id) { steps.length = i; break; }     /* drop anything stale after an edit */
      i++;
      if (n.info) { id = nextOf(n, c); continue; }
      var o = n.opts[st.oi];
      if (!o || (o.hide && o.hide(c))) { steps.length = i - 1; break; }
      for (var k2 in (o.set || {})) c[k2] = o.set[k2];
      log.push({ id: id, node: n, opt: o });
      if (o.say) { notes.push(o.say); if (!st.seen) { pending = { say: o.say, node: n, opt: o }; break; } }
      id = nextOf(o, c);
    }
    return { c: c, log: log, notes: notes, id: id, node: T[id], pending: pending };
  }

  function choose(id, oi) { var o = T[id].opts ? T[id].opts[oi] : null; steps.push({ id: id, oi: oi, seen: !(o && o.say) }); save(); render(true); }
  function back() { if (steps.length) { steps.pop(); save(); render(true); } }
  function restart() { steps = []; save(); render(true); }

  /* ------------------------------------------------------------ pieces */
  function phaseBar(cur, done) {
    var ol = el("ol", "phases");
    for (var p = 1; p <= 4; p++) {
      var li = el("li", p === cur ? "on" : p < cur || done ? "done" : "");
      li.append(el("span", "num", "0" + p), el("span", "nm", SHORT[p]));
      if (p === cur) li.setAttribute("aria-current", "step");
      ol.append(li);
    }
    return ol;
  }
  function controls(st) {
    var row = el("div", "row ctl");
    var b = el("button", "btn ghost sm", "← Back"); b.type = "button"; b.disabled = !steps.length; b.addEventListener("click", back);
    var r = el("button", "btn ghost sm", "Start over"); r.type = "button"; r.disabled = !steps.length; r.addEventListener("click", restart);
    row.append(b, r);
    return row;
  }
  function pathLog(st) {
    var d = el("details", "path"), sum = el("summary", null, "Your answers so far (" + st.log.length + ")");
    var dl = el("dl", "kv");
    st.log.forEach(function (e) {
      var div = el("div"), dt = el("dt", null, e.node.label || e.node.q), dd = el("dd", null, e.opt.t + (e.carried ? " (from Phase 1)" : ""));
      div.append(dt, dd); dl.append(div);
    });
    d.append(sum, dl);
    return st.log.length ? d : document.createTextNode("");
  }
  var TONE = { ok: "Good to know", warn: "Caution", stop: "Stop" };
  function badge(tone) { return el("span", "tone " + tone, TONE[tone]); }
  function resList(keys, cls) {
    var ul = el("ul", cls || "res");
    keys.forEach(function (k) {
      var r = R[k], li = el("li"), a = el("a", null, r.n); a.href = r.u; a.target = "_blank"; a.rel = "noopener";
      var h = el("h3"); h.append(a); li.append(h, el("p", null, r.d)); ul.append(li);
    });
    return ul;
  }
  function optionButtons(st) {
    var n = st.node, wrap = el("div", "opts"); wrap.setAttribute("role", "group"); wrap.setAttribute("aria-label", "Answers");
    n.opts.forEach(function (o, oi) {
      if (o.hide && o.hide(st.c)) return;
      var b = el("button", "opt"); b.type = "button";
      b.append(el("span", "ot", o.t)); if (o.sub) b.append(el("span", "os", o.sub));
      b.addEventListener("click", function () { choose(st.id, oi); });
      wrap.append(b);
    });
    return wrap;
  }

  /* ------------------------------------------------------------ screens */
  function render(focus) {
    var st = replay();
    app.textContent = "";
    var n = st.node, phase = st.pending ? st.pending.node.phase : n && n.phase ? n.phase : null;
    if (n && n.end && !st.pending) { renderEnd(st); if (focus) app.querySelector("h2").focus(); return; }

    app.append(phaseBar(phase, false));
    var card = el("section", "qcard");
    card.append(el("p", "chan", "Phase " + phase + ": " + X.PHASES[phase]));

    if (st.pending) {                                           /* advice after an answer */
      var say = st.pending.say;
      card.classList.add(say.tone);
      card.append(el("p", "picked", "You chose: " + st.pending.opt.t));
      var h = el("h2", null, ""); h.tabIndex = -1; h.append(badge(say.tone)); card.append(h);
      card.append(el("p", "say", say.text));
      var go = el("button", "btn", say.tone === "stop" ? "See what to do instead" : "Continue"); go.type = "button";
      go.addEventListener("click", function () { steps[steps.length - 1].seen = true; save(); render(true); });
      card.append(go);
    } else if (n.info) {                                        /* end of a phase */
      var h2 = el("h2", null, n.platformCard ? "Your platform: " + X.PLATFORMS[st.c.platform].name : n.title); h2.tabIndex = -1; card.append(h2);
      if (n.platformCard) {
        var big = el("div", "plat"); big.append(el("span", "pbig", st.c.platform), el("p", null, X.PLATFORMS[st.c.platform].line)); card.append(big);
        card.append(el("p", "say", "Now you know which XR platform will best suit your needs. To wrap up, let's think about what " + st.c.platform + " content can meet the needs of your learners. If nothing exists, we can also point you towards resources for creating your own."));
      } else card.append(el("p", "say", n.text));
      var c2 = el("button", "btn", n.cta || "Continue"); c2.type = "button"; c2.addEventListener("click", function () { choose(st.id, 0); }); card.append(c2);
    } else {                                                    /* a question */
      if (n.suggest) {
        card.append(el("p", "picked", "Suggestions for: " + st.c.need));
        card.append(resList(st.c.res));
      }
      var q = el("h2", null, n.q); q.tabIndex = -1; card.append(q);
      if (n.help) card.append(el("p", "hint", n.help));
      card.append(optionButtons(st));
    }
    app.append(card, controls(st), pathLog(st));
    if (focus) { var f = card.querySelector("h2"); if (f) f.focus({ preventScroll: false }); }
  }

  /* Turn the answers into the content of the one-page brief. */
  function model(st) {
    var c = st.c, kind = st.node.end, m = { kind: kind, platform: c.platform || null };
    m.facts = st.log.filter(function (e) { return e.node.label && !SKIP_FACT[e.id] && e.node.phase < 3; }).map(function (e) { return [e.node.label, e.opt.t]; });
    var seen = {}; m.facts = m.facts.filter(function (f) { if (seen[f[0]]) return false; seen[f[0]] = 1; return true; }).slice(0, 10);
    if (c.need) m.facts.push(["Looking for", c.need]);
    m.watch = st.notes.filter(function (s) { return s.tone === "warn" && s.brief; }).map(function (s) { return s.brief; });
    if (kind === "no") {
      var stop = st.notes.filter(function (s) { return s.tone === "stop"; }).pop() || {};
      m.big = "NOT YET"; m.title = "XR may not be the best option for this situation";
      m.lead = stop.brief || ""; m.startTitle = "Try instead"; m.alts = X.ALTERNATIVES; m.change = stop.change;
      m.next = ["Choose one of the alternatives above and run the activity with it.", "Note what learners could not see or do without XR. That gap is your case for XR later.", stop.change ? "Come back to this tree once you have made the change described above." : "Come back to this tree when your situation changes."];
      return m;
    }
    var P = X.PLATFORMS[c.platform];
    m.big = c.platform; m.title = P.name + " is your best bet"; m.lead = P.line;
    if (c.platform !== "AR") m.watch.push("Clean headsets between users and offer a seated option.");
    if (kind === "content") {
      m.startTitle = "Start with existing content"; m.startText = c.need + ". Try these yourself before choosing one."; m.res = c.res;
      m.next = ["Run the whole experience yourself, start to finish, on the same devices your learners will use.", "Plan three parts: onboarding, the " + c.platform + " experience, then time to reflect together.", "Pilot with two or three learners before the full group, then adjust timing and group size."];
    } else {
      var B = X.BUILD[c.build];
      m.startTitle = "Create your own: " + B.title.charAt(0).toLowerCase() + B.title.slice(1); m.startText = B.text; m.res = B[c.platform] || [];
      m.next = ["Describe the experience on one page: who it is for, what learners do, on which device and for how long.", c.build === "none" ? "Share that page with a possible funder or partner, and prototype the idea with a no-code tool meanwhile." : "Build the smallest version that shows the core idea, and try it on the devices learners will use.", "Pilot with two or three learners, then plan onboarding before and reflection after the experience."];
    }
    return m;
  }

  function sheet(m) {
    var s = el("article", "sheet"); s.id = "sheet";
    var top = el("header", "s-top"), mark = el("span", "s-mark", "xrprof"), kind = el("span", "s-kind", "XR for Learning · Starting Brief");
    top.append(mark, kind);
    var meta = el("p", "s-meta"); meta.id = "s-meta";
    var hero = el("div", "s-hero"), big = el("div", "s-big" + (m.kind === "no" ? " no" : ""), m.big), ht = el("div");
    ht.append(el("h3", null, m.title), el("p", null, m.lead)); hero.append(big, ht);

    var cols = el("div", "s-cols"), a = el("section"), b = el("section");
    a.append(el("h4", null, "Your situation")); var dl = el("dl");
    m.facts.forEach(function (f) { var d = el("div"); d.append(el("dt", null, f[0]), el("dd", null, f[1])); dl.append(d); }); a.append(dl);
    b.append(el("h4", null, m.kind === "no" ? "What would change this" : "Watch-outs"));
    var ul = el("ul", "s-list");
    (m.kind === "no" ? [m.change].concat(m.watch) : m.watch).slice(0, 6).forEach(function (w) { if (w) ul.append(el("li", null, w)); });
    if (!ul.children.length) ul.append(el("li", null, "No specific cautions came up. Still allow time for onboarding and reflection."));
    b.append(ul); cols.append(a, b);

    var start = el("section", "s-start"); start.append(el("h4", null, m.startTitle));
    if (m.startText) start.append(el("p", null, m.startText));
    if (m.alts) { var al = el("ul", "s-list"); m.alts.forEach(function (x) { al.append(el("li", null, x)); }); start.append(al); }
    if (m.res && m.res.length) {
      var rl = el("ul", "s-res");
      m.res.slice(0, 3).forEach(function (k) { var r = R[k], li = el("li"), a2 = el("a", null, r.n); a2.href = r.u;
        li.append(a2, el("span", "u", shortUrl(r.u)), el("span", "d", r.d)); rl.append(li); });
      start.append(rl);
    }
    var nx = el("section", "s-next"); nx.append(el("h4", null, "Next steps")); var ol = el("ol");
    m.next.forEach(function (t) { ol.append(el("li", null, t)); }); nx.append(ol);

    var foot = el("footer", "s-foot");
    foot.append(el("p", null, "XR for Learning Decision Tree, by Daniel Pimentel \u00b7 xrprof.org/xr-decision-tree"),
      el("p", null, "A starting point for your own judgement, not a guarantee of results."));
    s.append(top, meta, hero, cols, start, nx, foot);
    return s;
  }
  function shortUrl(u) {                        /* host plus the start of the path, so long store links stay tidy */
    var m = /^https?:\/\/(?:www\.)?([^\/]+)(\/[^?#]*)?/.exec(u) || [], path = (m[2] || "").replace(/\/$/, "");
    return (m[1] || u) + (path.length > 22 ? path.slice(0, 20) + "\u2026" : path);
  }
  function stamp() {
    var m = document.getElementById("s-meta"); if (!m) return;
    var d = new Date().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    m.textContent = (project.trim() ? project.trim() + " · " : "") + d;
  }
  function fitSheet() {                         /* scale the preview to the column, and shrink type until it fits one page */
    var wrap = document.querySelector(".sheetwrap"), s = document.getElementById("sheet"); if (!wrap || !s) return;
    var fs = 13; s.style.setProperty("--fs", fs + "px");
    while (s.scrollHeight > 1056 && fs > 9.5) { fs -= 0.25; s.style.setProperty("--fs", fs + "px"); }
    var k = Math.min(1, wrap.clientWidth / 816); wrap.style.setProperty("--k", k); wrap.style.height = Math.round(1056 * k) + "px";
  }
  function asText(m) {
    var L = ["XR FOR LEARNING: STARTING BRIEF", (project.trim() ? project.trim() + " | " : "") + new Date().toLocaleDateString(), "", m.title.toUpperCase(), m.lead, "", "YOUR SITUATION"];
    m.facts.forEach(function (f) { L.push("- " + f[0] + ": " + f[1]); });
    L.push("", m.kind === "no" ? "WHAT WOULD CHANGE THIS" : "WATCH-OUTS"); (m.kind === "no" ? [m.change] : []).concat(m.watch).forEach(function (w) { L.push("- " + w); });
    L.push("", m.startTitle.toUpperCase()); if (m.startText) L.push(m.startText);
    (m.alts || []).forEach(function (x) { L.push("- " + x); });
    (m.res || []).slice(0, 3).forEach(function (k) { L.push("- " + R[k].n + ": " + R[k].u); });
    L.push("", "NEXT STEPS"); m.next.forEach(function (t, i) { L.push((i + 1) + ". " + t); });
    L.push("", "From the XR for Learning Decision Tree, xrprof.org/xr-decision-tree");
    return L.join("\n");
  }

  function renderEnd(st) {
    var m = model(st);
    app.append(phaseBar(null, true));
    var card = el("section", "qcard done");
    card.append(el("p", "chan", "Journey complete"));
    var h = el("h2", null, m.title); h.tabIndex = -1; card.append(h);
    card.append(el("p", "say", m.kind === "no"
      ? "That is a useful answer too. Your one-page brief below explains why, what to try instead, and what would change the picture."
      : m.kind === "content" ? "Awesome! Your one-page brief below pulls your answers, cautions and starting points together."
      : "Your one-page brief below pulls your answers, cautions and a route to building your own content together."));
    if (m.kind !== "no") {
      card.append(el("h3", "sub", m.startTitle));
      if (m.kind === "build") card.append(el("p", null, m.startText));
      card.append(resList(m.res));
      card.append(el("h3", "sub", "Best practices for running XR learning experiences"));
      card.append(resList(X.PRACTICE));
    }
    app.append(card);

    var ex = el("section", "export");
    ex.append(el("h2", null, "Your one-page brief"));
    var f = el("div", "row exrow"), lab = el("label", "fld"), inp = el("input");
    inp.type = "text"; inp.maxLength = 60; inp.placeholder = "Program or project name (optional)"; inp.value = project;
    lab.append(el("span", null, "Name on the brief"), inp);
    inp.addEventListener("input", function () { project = inp.value; stamp(); });
    var chk = el("label", "chk"), cb = el("input"); cb.type = "checkbox"; cb.checked = light;
    chk.append(cb, document.createTextNode(" Ink-saving version (white page)"));
    f.append(lab, chk); ex.append(f);
    var row = el("div", "row");
    var pb = el("button", "btn", "Export one-pager (PDF)"); pb.type = "button";
    pb.addEventListener("click", function () { var t = document.title; document.title = "XR starting brief" + (project.trim() ? " - " + project.trim() : ""); window.print(); setTimeout(function () { document.title = t; }, 500); });
    var cp = el("button", "btn ghost", "Copy as text"); cp.type = "button";
    cp.addEventListener("click", function () {
      var done = function () { cp.textContent = "Copied"; setTimeout(function () { cp.textContent = "Copy as text"; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(asText(m)).then(done, function () {});
    });
    row.append(pb, cp); ex.append(row);
    ex.append(el("p", "hint", "Export opens your browser's print window. Choose “Save as PDF” as the printer. If the dark page prints white, switch on “Background graphics” there."));
    var wrap = el("div", "sheetwrap"), sh = sheet(m); wrap.append(sh); ex.append(wrap);
    cb.addEventListener("change", function () { light = cb.checked; sh.classList.toggle("light", light); });
    sh.classList.toggle("light", light);
    app.append(ex, controls(st), pathLog(st));
    stamp(); fitSheet();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitSheet);
  }

  window.addEventListener("resize", fitSheet);
  window.__xrtree = { replay: replay, steps: function () { return steps; }, choose: choose };
  render(false);
})();
