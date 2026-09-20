(function () {
  var H = {};
  H.nap = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  H.vis = function (el) { var r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  H.all = function (sel, root) {
    return Array.from((root || document).querySelectorAll(sel || "button,a,[role=button],[role=option],[role=tab],[role=menuitem],summary"))
      .filter(H.vis);
  };
  H.find = function (t, o) {
    o = o || {};
    var root = o.root || document;
    var L = H.all(o.sel, root);
    var T = String(t).trim();
    var ex = L.filter(function (e) { return (e.innerText || e.textContent || "").trim() === T; });
    var inc = L.filter(function (e) { return (e.innerText || e.textContent || "").trim().indexOf(T) >= 0; });
    var p = ex.length ? ex : inc;
    return p[o.nth || 0] || null;
  };
  H.label = function (e) { return e ? (e.innerText || e.textContent || "").trim().slice(0, 140) : null; };
  H.click = function (t, o) {
    var e = H.find(t, o);
    if (!e) return { ok: false, reason: "not-found", q: t };
    if (e.disabled) return { ok: false, reason: "disabled", label: H.label(e) };
    e.scrollIntoView({ block: "center" });
    e.click();
    return { ok: true, label: H.label(e) };
  };
  H.clickSel = function (sel, nth) {
    var e = H.all(sel)[nth || 0];
    if (!e) return { ok: false, reason: "not-found", q: sel };
    if (e.disabled) return { ok: false, reason: "disabled", label: H.label(e) };
    e.scrollIntoView({ block: "center" });
    e.click();
    return { ok: true, label: H.label(e) };
  };
  H.card = function (text, sel) {
    return H.all(sel || "article,section,[data-nv-card],tr,li", document)
      .filter(function (a) { return (a.innerText || "").indexOf(text) >= 0; })
      .sort(function (a, b) { return (a.innerText || "").length - (b.innerText || "").length; })[0] || null;
  };
  H.cardClick = function (ct, bt, sel, nth) {
    var c = H.card(ct, sel);
    if (!c) return { ok: false, reason: "card-not-found", q: ct };
    var r = H.click(bt, { root: c, nth: nth || 0 });
    r.card = (c.innerText || "").replace(/\n+/g, " / ").slice(0, 70);
    return r;
  };
  H.cardText = function (ct, sel, max) {
    var c = H.card(ct, sel);
    return c ? (c.innerText || "").replace(/\n{2,}/g, "\n").trim().slice(0, max || 1200) : null;
  };
  H.grep = function (re, max) {
    return Array.from(new Set((document.body.innerText || "").split("\n")
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s && new RegExp(re).test(s); }))).slice(0, max || 40);
  };
  H.body = function (max) { return (document.body.innerText || "").replace(/\n{2,}/g, "\n").trim().slice(0, max || 4000); };
  H.buttons = function (root) {
    return H.all("button,[role=button],[role=tab]", root || document).map(function (e) {
      return { t: H.label(e), d: !!e.disabled };
    });
  };
  H.set = function (sel, val, nth, root) {
    var el = Array.from((root || document).querySelectorAll(sel))[nth || 0];
    if (!el) return false;
    var p = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(p, "value").set.call(el, String(val));
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };
  H.pick = function (sel, val, nth, root) {
    var el = Array.from((root || document).querySelectorAll(sel))[nth || 0];
    if (!el) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value").set.call(el, String(val));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };
  H.dlg = [];
  H.prompt = function (v) { window.prompt = function (m) { H.dlg.push("PROMPT|" + m); return v; }; return "prompt:" + v; };
  H.confirm = function (v) { window.confirm = function (m) { H.dlg.push("CONFIRM|" + m); return !!v; }; return "confirm:" + v; };
  H.alertOff = function () { window.alert = function (m) { H.dlg.push("ALERT|" + m); }; return "alert-off"; };
  H.store = function () { return JSON.parse(localStorage.getItem("powercare_company_local-preview-nirovera") || "{}"); };
  H.save = function (fn) {
    var k = "powercare_company_local-preview-nirovera";
    var d = JSON.parse(localStorage.getItem(k) || "{}");
    fn(d);
    localStorage.setItem(k, JSON.stringify(d));
    return "saved";
  };
  H.TOAST_RE = "\u062a\u0645 \u062d\u0641\u0638|\u0644\u0645 \u062a\u064f\u0642\u0628\u0644|\u062a\u0639\u0630\u0651\u0631|\u062a\u062c\u0627\u0648\u0632|\u0627\u0644\u0628\u0648\u0627\u0628\u0629|\u0644\u0627 \u0627\u0639\u062a\u0645\u0627\u062f|\u0645\u0637\u0644\u0648\u0628|\u063a\u064a\u0631 \u0645\u0633\u0645\u0648\u062d|\u0644\u0627 \u064a\u0645\u0643\u0646|\u0633\u062c\u0651\u0644\u0647 \u0641\u064a \u0627\u0644\u0645\u062e\u0632\u0648\u0646|\u0631\u0641\u0636|\u0641\u0634\u0644";
  H.toasts = function (n) {
    var seen = [];
    var i = 0;
    var re = new RegExp(H.TOAST_RE);
    function step() {
      return H.nap(200).then(function () {
        (document.body.innerText || "").split("\n").map(function (s) { return s.trim(); }).forEach(function (s) {
          if (s && re.test(s) && seen.indexOf(s) < 0) seen.push(s);
        });
        i++;
        if (i < (n || 10)) return step();
      });
    }
    return step().then(function () { return seen; });
  };
  H.PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVQI12P4z8AAAAMBAQAY3Y2wAAAAAElFTkSuQmCC";
  H.file = function (sel, name, type, nth) {
    var bin = atob(H.PNG);
    var arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    var fi = Array.from(document.querySelectorAll(sel))[nth || 0];
    if (!fi) return false;
    var dt = new DataTransfer();
    dt.items.add(new File([arr], name || "receipt.png", { type: type || "image/png" }));
    fi.files = dt.files;
    fi.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };
  H.pickToday = function () {
    var t = H.click("\u0627\u062e\u062a\u0631 \u0627\u0644\u062a\u0627\u0631\u064a\u062e");
    if (!t.ok) return t;
    return H.nap(300).then(function () {
      var d = document.querySelector("[role=dialog]");
      var b = d ? Array.from(d.querySelectorAll("button")).find(function (x) { return (x.innerText || "").trim() === "\u0627\u0644\u064a\u0648\u0645"; }) : null;
      if (b) b.click();
      return H.nap(250).then(function () { return { ok: !!b }; });
    });
  };
  window.H = H;
  return "boot-ok";
})()
