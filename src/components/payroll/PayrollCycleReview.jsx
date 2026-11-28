import React, { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { moneySar } from "@/lib/employeeFileView";
import { employeeWageSplit } from "@/lib/employeeFileView";
import { siteConditions } from "@/lib/allowanceKinds";
import { leaveEffects } from "@/lib/payrollLeaveEffects";
import { allowanceMatrix, employerCost, monthVariance, payrollStages, wpsPrecheck } from "@/lib/payrollReview";
import { serviceYearsFromHire } from "@/lib/leaveTypes";
import { chip, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import { payEquityReview, PAY_EQUITY_THRESHOLD } from "@/lib/employerDuties";
import { payHintFor } from "@/lib/rightHints.pay";
import RightHint from "@/components/shared/RightHint";

// Arabic count of days: 1 يوم واحد · 2 يومان · 3–10 أيام · 11+ يوماً (a bare «3 يوماً» read wrong).
const daysAr = (n) => { const v = Math.abs(Number(n) || 0); return v === 1 ? "يوم واحد" : v === 2 ? "يومان" : v >= 3 && v <= 10 ? `${v} أيام` : `${v} يوماً`; };

/**
 * مسير الأجور as one cycle: the stages in order at the top (each ready, to do, waiting), then what
 * must be read before approving — the month against last month, what leave and injury do to the wage,
 * every allowance kind per branch, the wage-protection checks — and what the month costs.
 */

const DK = { bg: "linear-gradient(160deg, #0B3D27 0%, #0F5535 100%)", soft: "#C5DBCD", faint: "#A9CDB8", line: "rgba(255,255,255,.14)", gold: "#C8A45A" };
const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", direction: "ltr", unicodeBidi: "isolate" };
const STATE = {
  done: { dot: "#7FD1A3", ink: "#CFF0DC", label: ["مكتملة", "Done"] },
  todo: { dot: "#C8A45A", ink: "#F3E3BC", label: ["تحتاج إجراء", "To do"] },
  note: { dot: "#C8A45A", ink: "#F3E3BC", label: ["للنظر", "To look at"] },
  wait: { dot: "rgba(255,255,255,.3)", ink: "#A9CDB8", label: ["بانتظار ما قبلها", "Waiting"] },
};
const PHASES = [
  { id: "prepare", ar: "تجهيز المسير", en: "Prepare the run", ids: ["att", "lines", "deduct", "gosi"] },
  { id: "approve", ar: "المراجعة والاعتماد", en: "Review and approve", ids: ["wpscheck", "review", "approve"] },
  { id: "pay", ar: "الصرف وحماية الأجور", en: "Pay and wage protection", ids: ["wps"] },
];
const FLAG = { big: ["تغيّر أكثر من 10٪", "Moved over 10%", "warn"], new: ["جديد", "New", "ok"], left: ["خرج", "Left", "bad"], zero: ["صافٍ صفر", "Zero net", "bad"] };

const th = { fontSize: 11, fontWeight: 600, color: "var(--nv-muted)", padding: "8px 12px", textAlign: "start", background: "var(--nv-soft, #F6F8FA)", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", whiteSpace: "nowrap" };
const td = { fontSize: 12, padding: "9px 12px", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", textAlign: "start", color: "var(--nv-ink2)", verticalAlign: "top" };

export function Fold({ id, title, note, trailing, defaultOpen = false, children }) {
  // Follows the data until the reader toggles it: a section that fills after load opens itself.
  const [chosen, setChosen] = useState(null);
  const open = chosen ?? defaultOpen;
  const setOpen = (fn) => setChosen(fn(open));
  // A cycle step that points here opens it first, then scrolls to it.
  React.useEffect(() => {
    const onOpen = (e) => { if (e.detail === id) setChosen(true); };
    window.addEventListener("nv:open-fold", onOpen);
    return () => window.removeEventListener("nv:open-fold", onOpen);
  }, [id]);
  return (
    <section id={id} data-cycle-section={id} style={{ ...slab, overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} style={{ fontFamily: "inherit", border: "none", background: "transparent", padding: 0, textAlign: "start", cursor: "pointer" }}>
        <SectionHead
          title={(
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <ChevronDown size={15} aria-hidden style={{ color: "var(--nv-muted)", transform: open ? "none" : "rotate(90deg)", transition: "transform .15s" }} />
              {title}
            </span>
          )}
          note={note}
          trailing={trailing}
        />
      </button>
      {open ? children : null}
    </section>
  );
}

export default function PayrollCycleReview({
  middle = null,
  ar = true,
  month,
  monthLabel,
  run,
  items = [],
  prevItems = [],
  employeeForItem = () => null,
  employees = [],
  stationName = (id) => id,
  stationOf = (l) => l.stationId,
  stations = [],
  attGaps = 0,
  issueCount = 0,
  deductionGaps = 0,
  gosiOpen = 0,
  onGo,
}) {
  const [showAll, setShowAll] = useState(false);
  const variance = monthVariance(items, prevItems, { ar });
  const wps = wpsPrecheck(items, employeeForItem, { ar, month });
  const { stages, currentId } = payrollStages({ run, items, attGaps, issueCount, deductionGaps, gosiOpen, variance, wps }, ar);
  const matrix = allowanceMatrix(items, stationOf);

  const effects = items.map((line) => {
    const e = employeeForItem(line);
    const fx = leaveEffects({ employee: e, month, line, monthlyWage: (Number(line.base) || 0) + (Number(line.allowances) || 0), ar });
    return { line, name: e?.name || line.employeeName || "", rows: fx.rows };
  }).filter((x) => x.rows.length);
  // «التزامك» per leave / injury effect, from that person's line.
  const effectHint = (x, r) => {
    const c = { view: "manager", ar, name: x.name, employeeId: x.line.employeeId, days: r.days, amount: Math.abs(Number(r.amount) || 0) };
    if (r.id === "sick") return payHintFor("sick", c);
    if (r.id === "annual") return payHintFor("annualAdvance", { ...c, startDate: r.startDate });
    if (r.id === "unpaid") return payHintFor("unpaidLeave", c);
    if (r.id === "injury") {
      const l = x.line;
      const mode = l.injuryCovered === false
        ? (Number(l.injuryUnpaid) > 0 ? "excluded" : Number(l.injuryReduction) > 0 ? "reduced" : "full")
        : "gosi";
      return payHintFor("injury", { ...c, mode });
    }
    return null;
  };

  const siteOpen = new Map();
  for (const line of items) {
    const e = employeeForItem(line);
    if (!e?.profile) continue;
    const st = stations.find((s) => s.id === e.stationId) || {};
    const site = siteConditions({ profile: e.profile, station: st, wage: employeeWageSplit(e.profile, e), nightWorker: Number(line.nightAllowance) > 0 });
    if (site.open) {
      const sid = stationOf(line) || "__unassigned__";
      siteOpen.set(sid, (siteOpen.get(sid) || 0) + 1);
    }
  }

  const costRows = new Map();
  for (const line of items) {
    const e = employeeForItem(line);
    const hire = e?.profile?.hireDate || e?.hireDate || e?.startDate || "";
    const years = hire ? serviceYearsFromHire(hire, `${month}-28`) : 0;
    const c = employerCost(line, { serviceYears: years });
    const sid = stationOf(line) || "__unassigned__";
    const row = costRows.get(sid) || { stationId: sid, heads: 0, gross: 0, gosiEmployer: 0, eosAccrual: 0, total: 0 };
    row.heads += 1;
    row.gross += c.gross;
    row.gosiEmployer += c.gosiEmployer;
    row.eosAccrual += c.eosAccrual;
    row.total += c.total;
    costRows.set(sid, row);
  }
  const cost = [...costRows.values()];
  const costTotal = cost.reduce((s, r) => ({ gross: s.gross + r.gross, gosiEmployer: s.gosiEmployer + r.gosiEmployer, eosAccrual: s.eosAccrual + r.eosAccrual, total: s.total + r.total }), { gross: 0, gosiEmployer: 0, eosAccrual: 0, total: 0 });

  const go = (stage) => {
    if (stage.tab === "run") {
      const target = stage.id === "review" ? "cycle-review" : stage.id === "wpscheck" ? "cycle-wps" : stage.id === "approve" ? "cycle-approve" : "";
      if (!target) return;
      window.dispatchEvent(new CustomEvent("nv:open-fold", { detail: target }));
      window.setTimeout(() => document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      return;
    }
    onGo?.(stage.tab);
  };

  // Ten at a time: with no last month every line is «new», and 97 rows bury the next step.
  const VARIANCE_PREVIEW = 10;
  const flaggedRows = variance.rows.filter((r) => r.flag);
  const shownVariance = showAll ? variance.rows : flaggedRows.slice(0, VARIANCE_PREVIEW);
  const current = stages.find((s) => s.id === currentId) || null;
  const currentIndex = current ? stages.indexOf(current) : -1;
  const deltaTotal = variance.total - variance.prevTotal;

  return (
    <div data-payroll-cycle="1" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* The cycle in order. */}
      <section style={{ background: DK.bg, color: "#fff", borderRadius: 14, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14, boxShadow: "0 8px 22px rgba(6,61,38,.18)" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
          <span style={{ display: "flex", flexDirection: "column", gap: 3, flex: "1 1 220px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11.5, fontWeight: 600, color: DK.faint }}>
              <span aria-hidden style={{ width: 12, height: 2, background: DK.gold, borderRadius: 8 }} />
              {ar ? "دورة المسير" : "The run cycle"}
            </span>
            <strong style={{ fontFamily: "var(--font-heading)", fontSize: 18 }}>{ar ? `مسير ${monthLabel}` : `${monthLabel} run`}</strong>
          </span>
          {[
            [ar ? "صافي المسير" : "Run net", moneySar(variance.total, ar), ""],
            variance.hasPrev ? [ar ? "عن الشهر الماضي" : "Against last month", `${deltaTotal >= 0 ? "+" : "−"}${moneySar(Math.abs(deltaTotal), ar)}`, deltaTotal ? "#F3E3BC" : ""] : null,
            [ar ? "تكلفة المنشأة" : "Establishment cost", moneySar(costTotal.total, ar), ""],
          ].filter(Boolean).map(([label, value, color]) => (
            <span key={label} style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
              <span style={{ fontSize: 11, color: DK.faint }}>{label}</span>
              <strong style={{ ...MONO, fontSize: 17, fontWeight: 700, color: color || "#fff" }}>{value}</strong>
            </span>
          ))}
        </div>
        {/* Three phases instead of eight boxes: prepare · review and approve · pay. Each lists only its own checks. */}
        <div data-cycle-phases="1" className="nv-cycle-phases" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10, paddingTop: 12, borderTop: `1px solid ${DK.line}` }}>
          {PHASES.map((ph, pi) => {
            const subs = ph.ids.map((id) => stages.find((x) => x.id === id)).filter(Boolean);
            const open = subs.filter((x) => x.state === "todo" || x.state === "note");
            const state = subs.every((x) => x.state === "done") ? "done"
              : subs.every((x) => x.state === "wait") ? "wait"
              : open.some((x) => x.state === "todo") ? "todo" : open.length ? "note"
              // done + still-waiting steps (e.g. approval not given yet) is not a finished phase
              : subs.some((x) => x.state === "wait") ? "wait" : "done";
            const st = STATE[state];
            const here = subs.some((x) => x.id === currentId);
            const first = open[0] || subs.find((x) => x.state !== "done") || subs[0];
            const summary = state === "done" ? (ar ? "مكتملة" : "Done")
              : state === "wait" ? (ar ? "بعد ما قبلها" : "After the previous phase")
              : (ar ? `${open.length} ${open.length === 1 ? "أمر يحتاج نظرة" : "أمور تحتاج نظرة"}` : `${open.length} to look at`);
            return (
              <div key={ph.id} data-phase={ph.id} data-state={state} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 12px 10px", borderRadius: 12, border: `1px solid ${here ? DK.gold : "rgba(255,255,255,.16)"}`, background: here ? "rgba(200,164,90,.14)" : "rgba(255,255,255,.05)" }}>
                <button type="button" onClick={() => first && go(first)} style={{ fontFamily: "inherit", border: "none", background: "transparent", color: "#fff", padding: 0, cursor: "pointer", textAlign: "start", display: "flex", alignItems: "center", gap: 8 }}>
                  <span aria-hidden style={{ width: 24, height: 24, borderRadius: 999, flexShrink: 0, boxSizing: "border-box", display: "inline-flex", alignItems: "center", justifyContent: "center", background: state === "done" ? st.dot : "transparent", border: `2px solid ${st.dot}`, color: "#0B3D27" }}>
                    {state === "done" ? <Check size={13} strokeWidth={3} /> : <span style={{ ...MONO, fontSize: 11, color: st.ink }}>{pi + 1}</span>}
                  </span>
                  <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                    <strong style={{ fontSize: 14 }}>{ar ? ph.ar : ph.en}</strong>
                    <span style={{ fontSize: 11.5, color: st.ink }}>{summary}</span>
                  </span>
                </button>
                <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                  {subs.map((x) => {
                    const xs = STATE[x.state];
                    return (
                      <li key={x.id} data-stage={x.id} data-state={x.state}>
                        <button type="button" onClick={() => go(x)} style={{ fontFamily: "inherit", width: "100%", border: "none", background: "transparent", color: "#fff", padding: "3px 0", cursor: "pointer", textAlign: "start", display: "flex", alignItems: "baseline", gap: 6, fontSize: 12 }}>
                          <span aria-hidden style={{ color: xs.dot, width: 12, flexShrink: 0 }}>{x.state === "done" ? "✓" : "•"}</span>
                          <span style={{ flex: "1 1 auto", minWidth: 0 }}>{ar ? x.ar : x.en}</span>
                          {x.state === "done" ? null : <span style={{ fontSize: 11, color: x.late ? "#F4A3A3" : xs.ink, whiteSpace: "nowrap" }}>{ar ? x.noteAr : x.noteEn}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
        {current ? (
          <div data-cycle-next="1" className="nv-cycle-next">
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 11.5, color: DK.faint }}>
                {ar ? "المطلوب منك الآن" : "What's needed now"}
              </span>
              <strong style={{ fontSize: 15, color: "#fff" }}>
                {ar ? current.ar : current.en}
                <span style={{ fontWeight: 500, color: "#F3E3BC", fontSize: 13 }}>{" — "}{ar ? current.noteAr : current.noteEn}</span>
              </strong>
            </span>
            <button type="button" onClick={() => go(current)} className="nv-cycle-next__go">
              {ar ? "ابدأ ›" : "Start ›"}
            </button>
          </div>
        ) : null}
      </section>

      {/* The run itself (totals, approval, the lines) sits right under the cycle; the checks below stay folded. */}
      {middle ? <div id="cycle-approve" style={{ scrollMarginTop: 80 }}>{middle}</div> : null}

      {/* 1. Against last month. */}
      <Fold
        id="cycle-review"
        title={ar ? "قبل الاعتماد — مقارنة بالشهر الماضي" : "Before approval — against last month"}
        note={variance.hasPrev
          ? (ar ? "يُرفع للمراجعة كل صافٍ تغيّر أكثر من 10٪، ومن دخل أو خرج، ومن صافيه صفر — مع سبب الفرق." : "Flagged: any net that moved over 10%, anyone who joined or left, any zero net — with the reason.")
          : (ar ? "لا مسير للشهر الماضي — يظهر كل موظف جديداً." : "No run for last month — everyone shows as new.")}
        trailing={<span style={chip(variance.flagged ? "warn" : "ok")}>{variance.flagged ? (ar ? `${variance.flagged} يحتاج نظرة` : `${variance.flagged} to look at`) : (ar ? "لا فروق لافتة" : "No notable change")}</span>}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr>
                <th style={th}>{ar ? "الموظف" : "Employee"}</th>
                <th style={th}>{ar ? "الشهر الماضي" : "Last month"}</th>
                <th style={th}>{ar ? "هذا الشهر" : "This month"}</th>
                <th style={th}>{ar ? "الفرق" : "Change"}</th>
                <th style={th}>{ar ? "السبب" : "Why"}</th>
              </tr>
            </thead>
            <tbody>
              {!shownVariance.length ? (
                <tr><td colSpan={5} style={{ ...td, color: "var(--nv-muted)", textAlign: "center", padding: 18 }}>{ar ? "لا أحد يحتاج نظرة — الفروق كلها دون 10٪." : "Nobody to look at — every change is under 10%."}</td></tr>
              ) : shownVariance.map((r) => (
                <tr key={r.employeeId} data-variance={r.flag || "ok"}>
                  <td style={td}>
                    <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <strong style={{ color: "var(--nv-ink)", fontSize: 12.5 }}>{r.name || r.employeeId}</strong>
                      {r.flag ? <span style={{ ...chip(FLAG[r.flag][2]), alignSelf: "flex-start" }}>{ar ? FLAG[r.flag][0] : FLAG[r.flag][1]}</span> : null}
                    </span>
                  </td>
                  <td style={td}><span style={MONO}>{r.prevNet == null ? "—" : moneySar(r.prevNet, ar)}</span></td>
                  <td style={td}><span style={MONO}>{moneySar(r.net, ar)}</span></td>
                  <td style={td}>
                    <span style={{ ...MONO, fontWeight: 700, color: r.delta > 0 ? "var(--nv-ok-ink)" : r.delta < 0 ? "var(--nv-bad-ink)" : "var(--nv-muted)" }}>
                      {r.delta === 0 ? "0" : `${r.delta > 0 ? "+" : "−"}${moneySar(Math.abs(r.delta), ar)}`}
                    </span>
                    {r.pct != null && r.prevNet ? <span style={{ ...MONO, display: "block", fontSize: 10.5, color: "var(--nv-muted)" }}>{`${r.pct > 0 ? "+" : ""}${Math.round(r.pct * 100)}%`}</span> : null}
                  </td>
                  <td style={{ ...td, lineHeight: 1.7 }}>{r.reasons.join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {variance.rows.length > shownVariance.length || showAll ? (
          <button type="button" onClick={() => setShowAll((v) => !v)} style={{ fontFamily: "inherit", height: 36, border: "none", borderTop: "1px solid var(--nv-line2, #EEF1EF)", background: "var(--nv-card)", color: "#0B3D27", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {showAll ? (ar ? "اعرض أقل" : "Show less") : (ar ? `اعرض الجميع · ${variance.rows.length}` : `Show everyone · ${variance.rows.length}`)}
          </button>
        ) : null}
      </Fold>

      {/* 2. Leave and injury. */}
      <Fold
        id="cycle-leave"
        title={ar ? "أثر الإجازات والإصابات على المسير" : "What leave and injury do to the run"}
        note={ar ? "تدخل تلقائياً: المرضية بشرائحها، والسنوية بأجرها المقدّم، وإصابات العمل، والإجازة بلا أجر أجراً غير مستحق." : "Applied automatically: sick bands, annual leave paid in advance, work injuries, and unpaid leave as wage not due."}
        trailing={<span style={chip(effects.length ? "warn" : "mute")}>{ar ? `${effects.length} موظفاً` : `${effects.length} people`}</span>}
      >
        {!effects.length ? (
          <p style={{ margin: 0, padding: "12px 18px 16px", fontSize: 12, color: "var(--nv-muted)" }}>{ar ? "لا إجازات معتمدة ولا إصابات في هذا الشهر." : "No approved leave or injuries this month."}</p>
        ) : (
          <ol style={{ listStyle: "none", margin: 0, padding: "4px 18px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
            {effects.map((x) => (
              <li key={x.line.employeeId} data-leave-effect={x.line.employeeId} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--nv-line)" }}>
                <strong style={{ fontSize: 12.5, color: "var(--nv-ink)" }}>{x.name}</strong>
                {x.rows.map((r) => (
                  <span key={r.id} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
                    <RightHint ar={ar} hint={effectHint(x, r)} />
                    <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.6 }}><strong style={{ color: "var(--nv-ink)" }}>{r.title}</strong>{r.detail ? ` — ${r.detail}` : ""}</span>
                    <span style={{ ...MONO, fontSize: 12.5, fontWeight: 700, color: r.amount < 0 ? "var(--nv-ink)" : "var(--nv-muted)" }}>{r.amount ? `−${moneySar(Math.abs(r.amount), ar)}` : "—"}</span>
                  </span>
                ))}
              </li>
            ))}
          </ol>
        )}
      </Fold>

      {/* 3. Allowances by kind, per branch. */}
      <Fold
        id="cycle-allowances"
        title={ar ? "البدلات بأنواعها حسب الفرع" : "Allowances by kind, per branch"}
        note={ar ? "كل نوع بدل في عمود، مع تنبيه للفرع الذي فيه موظف بالتزام موقع غير مغطّى (146–148)." : "One column per allowance kind, with a flag for a branch where someone has an uncovered site duty (146–148)."}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                <th style={th}>{ar ? "الفرع" : "Branch"}</th>
                {matrix.kinds.map((k) => <th key={k.id} style={th}>{ar ? k.ar : k.en}</th>)}
                <th style={th}>{ar ? "أخرى" : "Other"}</th>
                <th style={th}>{ar ? "الموقع" : "Site"}</th>
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((r) => (
                <tr key={r.stationId} data-matrix-station={r.stationId}>
                  <td style={td}><strong style={{ color: "var(--nv-ink)" }}>{stationName(r.stationId)}</strong> <span style={{ ...MONO, fontSize: 10.5, color: "var(--nv-muted)" }}>· {r.heads}</span></td>
                  {matrix.kinds.map((k) => <td key={k.id} style={td}><span style={MONO}>{r.cells[k.id] ? moneySar(r.cells[k.id], ar) : "—"}</span></td>)}
                  <td style={td}><span style={MONO}>{r.other ? moneySar(r.other, ar) : "—"}</span></td>
                  <td style={td}>{siteOpen.get(r.stationId) ? <span style={chip("warn")}>{ar ? `${siteOpen.get(r.stationId)} بلا تغطية` : `${siteOpen.get(r.stationId)} uncovered`}</span> : <span style={chip("ok")}>{ar ? "سليم" : "OK"}</span>}</td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 700, color: "var(--nv-ink)" }}>{ar ? "الإجمالي" : "Total"}</td>
                {matrix.kinds.map((k) => <td key={k.id} style={{ ...td, fontWeight: 700 }}><span style={MONO}>{moneySar(matrix.totals[k.id], ar)}</span></td>)}
                <td style={{ ...td, fontWeight: 700 }}><span style={MONO}>{moneySar(matrix.other, ar)}</span></td>
                <td style={td} />
              </tr>
            </tbody>
          </table>
        </div>
      </Fold>

      {/* 4. Wage protection, before approval. */}
      <Fold
        id="cycle-wps"
        title={ar ? "فحص حماية الأجور قبل الاعتماد" : "Wage-protection check before approval"}
        note={ar
          ? `القواعد نفسها التي يرفض بها ملف مدد الصفوف — تُفحص الآن لا بعد الاعتماد.${wps.deadline ? ` آخر موعد للملف ${wps.deadline}.` : ""}`
          : `The same rules the Mudad file refuses rows by — checked now, not after approval.${wps.deadline ? ` File due ${wps.deadline}.` : ""}`}
        trailing={(
          <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
            <span style={chip(wps.blocked ? "bad" : "ok")}>{wps.blocked ? (ar ? `${wps.blocked} صفاً مرفوضاً` : `${wps.blocked} refused`) : (ar ? "كل الصفوف مقبولة" : "Every row accepted")}</span>
            {wps.daysLeft != null ? <span style={chip(wps.daysLeft < 0 ? "bad" : wps.daysLeft <= 7 ? "warn" : "mute")}>{wps.daysLeft < 0 ? (ar ? `متأخر ${daysAr(-wps.daysLeft)}` : `${-wps.daysLeft} days late`) : (ar ? `باقٍ ${daysAr(wps.daysLeft)}` : `${wps.daysLeft} days left`)}</span> : null}
            <span style={chip(wps.unpaid ? "warn" : "ok")}>{ar ? `${wps.unpaid} لم يُدفع` : `${wps.unpaid} unpaid`}</span>
          </span>
        )}
      >
        {wps.rows.filter((r) => r.blockers.length || r.notes.length).length ? (
          <ol style={{ listStyle: "none", margin: 0, padding: "4px 18px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
            {wps.rows.filter((r) => r.blockers.length || r.notes.length).map((r) => (
              <li key={r.employeeId} data-wps-check={r.employeeId} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "8px 12px", borderRadius: 10, border: `1px solid ${r.blockers.length ? "var(--nv-bad-line)" : "var(--nv-warn-line)"}`, background: r.blockers.length ? "var(--nv-bad-soft)" : "var(--nv-warn-soft)" }}>
                <strong style={{ fontSize: 12.5, color: "var(--nv-ink)" }}>{r.employeeName}</strong>
                {r.blockers.map((b) => <span key={b} style={chip("bad")}>{b}</span>)}
                {r.notes.map((b) => <span key={b} style={chip("warn")}>{b}</span>)}
              </li>
            ))}
          </ol>
        ) : (
          <p style={{ margin: 0, padding: "12px 18px 16px", fontSize: 12, color: "var(--nv-muted)" }}>{ar ? "الهوية والآيبان واسم البنك وأجر قوى سليمة لكل الصفوف." : "ID, IBAN, bank name and Qiwa wage are clean on every row."}</p>
        )}
      </Fold>

      {/* 5. What the month costs. */}
      <Fold
        id="cycle-cost"
        title={ar ? "تكلفة المنشأة لهذا الشهر" : "What this month costs the establishment"}
        note={ar ? "الإجمالي + حصة صاحب العمل في التأمينات + مخصص مكافأة نهاية الخدمة الشهري (نصف شهر عن كل سنة من الخمس الأولى ثم شهر — المادة 84). للإدارة فقط." : "Gross + employer GOSI + the monthly end-of-service accrual (half a month a year for the first five, then a month — Art. 84). Management only."}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
            <thead>
              <tr>
                <th style={th}>{ar ? "الفرع" : "Branch"}</th>
                <th style={th}>{ar ? "الإجمالي" : "Gross"}</th>
                <th style={th}>{ar ? "تأمينات صاحب العمل" : "Employer GOSI"}</th>
                <th style={th}>{ar ? "مخصص نهاية الخدمة" : "End-of-service accrual"}</th>
                <th style={th}>{ar ? "التكلفة" : "Cost"}</th>
              </tr>
            </thead>
            <tbody>
              {cost.map((r) => (
                <tr key={r.stationId} data-cost-station={r.stationId}>
                  <td style={td}><strong style={{ color: "var(--nv-ink)" }}>{stationName(r.stationId)}</strong> <span style={{ ...MONO, fontSize: 10.5, color: "var(--nv-muted)" }}>· {r.heads}</span></td>
                  <td style={td}><span style={MONO}>{moneySar(r.gross, ar)}</span></td>
                  <td style={td}><span style={MONO}>{moneySar(r.gosiEmployer, ar)}</span></td>
                  <td style={td}><span style={MONO}>{moneySar(r.eosAccrual, ar)}</span></td>
                  <td style={{ ...td, fontWeight: 700, color: "var(--nv-ink)" }}><span style={MONO}>{moneySar(r.total, ar)}</span></td>
                </tr>
              ))}
              <tr>
                <td style={{ ...td, fontWeight: 700, color: "var(--nv-ink)" }}>{ar ? "الإجمالي" : "Total"}</td>
                <td style={{ ...td, fontWeight: 700 }}><span style={MONO}>{moneySar(costTotal.gross, ar)}</span></td>
                <td style={{ ...td, fontWeight: 700 }}><span style={MONO}>{moneySar(costTotal.gosiEmployer, ar)}</span></td>
                <td style={{ ...td, fontWeight: 700 }}><span style={MONO}>{moneySar(costTotal.eosAccrual, ar)}</span></td>
                <td style={{ ...td, fontWeight: 700, color: "#0B3D27" }}><span style={MONO}>{moneySar(costTotal.total, ar)}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Fold>
      {(() => {
        // Law Art. 61(4) — same job and grade, pay gaps by sex, nationality, age or disability: a review item, never a block.
        const equity = payEquityReview({ employees });
        return (
          <Fold
            id="pay-equity"
            title={ar ? "مراجعة تكافؤ الأجور (المادة 61/4)" : "Pay-equity review (Art. 61(4))"}
            note={ar
              ? `في الوظيفة والدرجة نفسيهما: فرق الوسيط بين الفئات فوق ${Math.round(PAY_EQUITY_THRESHOLD * 100)}٪ يُراجَع — لا يمنع المسير، ويُتحقق أنه لسبب مشروع لا تمييز.`
              : `Same job and grade: a median gap above ${Math.round(PAY_EQUITY_THRESHOLD * 100)}% is reviewed — it does not block the run.`}
            trailing={<span style={chip(equity.items.length ? "warn" : "ok")}>{equity.items.length ? (ar ? `${equity.items.length} للمراجعة` : `${equity.items.length} to review`) : (ar ? "لا فرق يتجاوز الحد" : "No gap over the threshold")}</span>}
          >
            <div data-pay-equity="" style={{ display: "flex", flexDirection: "column" }}>
              {equity.items.length ? equity.items.map((it) => (
                <div key={`${it.title}-${it.grade}-${it.dimension}`} style={{ ...td, lineHeight: 1.8 }}>{ar ? it.reason : it.reasonEn}</div>
              )) : <div style={td}>{ar ? `قورنت ${equity.cohorts} مجموعة وظيفية — لا فرق يتجاوز الحد.` : `${equity.cohorts} job groups compared — no gap over the threshold.`}</div>}
            </div>
          </Fold>
        );
      })()}
    </div>
  );
}
