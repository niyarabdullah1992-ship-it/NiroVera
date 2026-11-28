import React from "react";
import { escalationRouteLevels } from "@/lib/orgDerivations";
import { setEscalationRoute } from "@/lib/orgTree";
import OrgLookupField from "@/components/hr/OrgLookupField";

const MONO = { fontFamily: "var(--font-mono, 'IBM Plex Mono', monospace)", fontVariantNumeric: "tabular-nums" };
const MAX_LEVELS = 6;

/**
 * «سلسلة التصعيد» — one route per kind of case:
 *   المهام          المدير المباشر ← الموارد البشرية (مستوى أو أكثر)
 *   الشكوى الجهرية  المدير المباشر ← الموارد البشرية (مستوى أو أكثر)
 *   صوت الموظف     الموارد البشرية مباشرة (الاقتراح · الشكوى السرية · البلاغ المكشوف · شكوى التحرش)
 * A higher HR level receives the case when the level below lets its window pass. الجزاءات keep their own path.
 */
const ROUTES = [
  {
    id: "tasks",
    ar: "المهام",
    en: "Tasks",
    startsWithManager: true,
    noteAr: "تبدأ عند المدير المباشر وتنتهي في الموارد البشرية.",
    noteEn: "Starts with the direct manager and ends in HR.",
  },
  {
    id: "complaint",
    ar: "الشكوى الجهرية",
    en: "Named complaint",
    startsWithManager: true,
    noteAr: "تبدأ عند المدير المباشر، وإن لم تُحل في مهلته تنتقل إلى الموارد البشرية.",
    noteEn: "Starts with the direct manager; unresolved in its window, it moves to HR.",
  },
  {
    id: "voice",
    ar: "صوت الموظف",
    en: "Employee voice",
    startsWithManager: false,
    kindsAr: ["الاقتراح", "الشكوى السرية", "البلاغ المكشوف", "شكوى التحرش"],
    kindsEn: ["Suggestion", "Confidential complaint", "Open report", "Harassment complaint"],
    noteAr: "تبدأ مباشرة في الموارد البشرية — لا تمر على المدير ولا يراها.",
    noteEn: "Starts straight in HR — never passes the manager, who never sees it.",
  },
];

function Node({ index, title, sub, tone = "hr", children }) {
  const manager = tone === "manager";
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", position: "relative", padding: "8px 0" }}>
      <span
        aria-hidden
        style={{
          flex: "none", width: 26, height: 26, borderRadius: "50%", marginTop: 2,
          display: "inline-flex", alignItems: "center", justifyContent: "center", ...MONO, fontSize: 11, fontWeight: 700,
          background: manager ? "var(--nv-soft)" : "var(--nv-accent-soft, #E3F2E9)",
          color: manager ? "var(--nv-ink2)" : "var(--nv-accent-deep, #0F5132)",
          border: `1px solid ${manager ? "var(--nv-line)" : "var(--nv-accent-border, #B7DCC6)"}`,
        }}
      >
        {index}
      </span>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        <strong style={{ fontSize: 12.5, color: "var(--nv-ink)" }}>{title}</strong>
        {sub ? <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.6 }}>{sub}</span> : null}
        {children}
      </div>
    </div>
  );
}

function RouteCard({ route, ar, data, companyId, canWrite, personOptions, people }) {
  const levels = escalationRouteLevels(data, route.id);
  const save = (next) => { if (canWrite) setEscalationRoute(companyId, route.id, next); };
  const setPerson = (i, employeeId) => save(levels.map((row, j) => (j === i ? { ...row, employeeId } : row)));
  const setHours = (i, hours) => save(levels.map((row, j) => (j === i ? { ...row, hours } : row)));
  const remove = (i) => save(levels.filter((_, j) => j !== i));
  const add = () => {
    if (levels.length >= MAX_LEVELS) return;
    const used = new Set(levels.map((row) => String(row.employeeId)));
    const next = people.find((p) => !used.has(String(p.id)));
    if (next) save([...levels, { employeeId: String(next.id), hours: 24 }]);
  };
  const offset = route.startsWithManager ? 1 : 0;

  return (
    <section data-esc-route={route.id} style={{ border: "1px solid var(--nv-line)", borderRadius: 10, background: "var(--nv-card)", overflow: "hidden" }}>
      <header style={{ padding: "10px 14px", background: "var(--nv-soft)", borderBottom: "1px solid var(--nv-line2, var(--nv-line))", display: "flex", flexDirection: "column", gap: 4 }}>
        <strong style={{ fontSize: 13.5, color: "var(--nv-ink)" }}>{ar ? route.ar : route.en}</strong>
        <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.6 }}>{ar ? route.noteAr : route.noteEn}</span>
        {route.kindsAr ? (
          <span style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            {(ar ? route.kindsAr : route.kindsEn).map((k) => (
              <span key={k} style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "var(--nv-card)", border: "1px solid var(--nv-line)", color: "var(--nv-ink2)" }}>{k}</span>
            ))}
          </span>
        ) : null}
      </header>
      <div style={{ padding: "4px 14px 12px" }}>
        {route.startsWithManager ? (
          <Node index={1} tone="manager" title={ar ? "المدير المباشر" : "Direct manager"} sub={ar ? "يُشتق من الهيكل لكل موظف — لا يُعيَّن هنا." : "Derived from the structure for each person — not set here."} />
        ) : null}
        {levels.map((row, i) => (
          <Node key={`${row.employeeId}-${i}`} index={i + 1 + offset} title={ar ? `الموارد البشرية — المستوى ${i + 1}` : `HR — level ${i + 1}`}>
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 92px auto", gridTemplateAreas: '"who who who" ". hours del"', gap: 8, alignItems: "end" }}>
              <div style={{ gridArea: "who", minWidth: 0 }}>
              <OrgLookupField
                ar={ar}
                value={String(row.employeeId)}
                disabled={!canWrite}
                onChange={(employeeId) => setPerson(i, employeeId)}
                options={personOptions}
                placeholder={ar ? "ابحث بالاسم أو الوظيفة" : "Search name or title"}
              />
              </div>
              <label style={{ gridArea: "hours", display: "flex", flexDirection: "column", gap: 3, fontSize: 10.5, fontWeight: 600, color: "var(--nv-muted)" }}>
                {ar ? "المهلة (ساعة)" : "Window (h)"}
                <input type="number" min={1} value={row.hours || 24} disabled={!canWrite} onChange={(e) => setHours(i, e.target.value)}
                  style={{ height: 32, padding: "0 8px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "var(--nv-card)", ...MONO, fontSize: 12, direction: "ltr", color: "var(--nv-ink)" }} />
              </label>
              {canWrite ? (
                <button type="button" onClick={() => remove(i)} aria-label={ar ? "احذف المستوى" : "Remove level"}
                  style={{ gridArea: "del", height: 32, padding: "0 10px", borderRadius: 8, border: "1px solid var(--nv-line)", background: "transparent", color: "var(--nv-bad-ink)", fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>
                  {ar ? "احذف" : "Remove"}
                </button>
              ) : null}
            </div>
          </Node>
        ))}
        {!levels.length ? (
          <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>
            {route.id === "voice"
              ? (ar ? "لا مستويات بعد — يستلمها الآن من يملك إدارة صوت الموظف." : "No levels yet — whoever manages employee voice receives it now.")
              : (ar ? "لا مستويات في الموارد البشرية بعد — يُستخدم خط الهيكل الحالي حتى تضيفها." : "No HR levels yet — the structure's line is used until you add them.")}
          </p>
        ) : null}
        {canWrite && levels.length < MAX_LEVELS ? (
          <button type="button" onClick={add}
            style={{ marginTop: 8, height: 32, padding: "0 12px", borderRadius: 8, border: "1px dashed var(--nv-accent-border, var(--nv-line))", background: "transparent", color: "var(--nv-accent-deep, var(--nv-accent))", fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {ar ? "＋ مستوى في الموارد البشرية" : "+ HR level"}
          </button>
        ) : null}
      </div>
    </section>
  );
}

export default function EscalationRoutesBoard({ ar = true, data, companyId, canWrite = false, personOptions = [], people = [] }) {
  return (
    <div data-esc-routes="1" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <p style={{ margin: 0, fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.75 }}>
        {ar
          ? "لكل نوع مساره. داخل الموارد البشرية تضيف أكثر من مستوى: إن مضت مهلة المستوى دون حسم، يستلمها المستوى الأعلى. والتصعيد على الشخص في الوظيفة — إن كان عليها مكلَّف وصلته في مدته."
          : "Each kind has its route. Inside HR you can stack levels: when a level's window passes, the one above receives it."}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))", gap: 12 }}>
        {ROUTES.map((route) => (
          <RouteCard key={route.id} route={route} ar={ar} data={data} companyId={companyId} canWrite={canWrite} personOptions={personOptions} people={people} />
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>
        {ar ? "الجزاءات: مسارها كما هو دون تغيير." : "Sanctions: their path stays as it is."}
      </p>
    </div>
  );
}
