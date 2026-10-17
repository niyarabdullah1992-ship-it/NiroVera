import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/PowerCareAuth";
import { matchesStationScope } from "@/hooks/useStationScope";
import { ACCENT, MUTED, NAVY, OK, NEUTRAL, WARN, bar, ui, tableShell, CARD, SURFACE } from "@/lib/platformStyles";
import { ChromeBox } from "@/components/shared/IdentityCard";
import EmployeeIdentityRow from "@/components/employees/EmployeeIdentityRow";
import { isSaudiForNitaqat, localDateKey } from "@/lib/complianceDerivations";
import { hrEmployeeFlags } from "@/lib/hrOverview";
import StatusFilterPills from "@/components/shared/StatusFilterPills";
import { SummaryLine } from "@/components/hr/orgdesign/orgDesignUi";

/** Directory pills — the same rules as the «نظرة عامة» rows that open them (?filter=). */
const FILTER_IDS = ["all", "active", "saudi", "expat", "expiring", "contract", "probation", "gosi", "incomplete"];

const tableHead = {
  display: "grid",
  gridTemplateColumns: "minmax(240px,1.8fr) 120px 150px 96px 120px 120px",
  gap: "12px",
  padding: "11px 18px",
  background: SURFACE,
  borderBottom: "1px solid var(--nv-line)",
  fontSize: "10px",
  letterSpacing: "0.06em",
  color: MUTED,
  fontWeight: 600,
};

const tableRow = {
  display: "grid",
  gridTemplateColumns: "minmax(240px,1.8fr) 120px 150px 96px 120px 120px",
  gap: "12px",
  padding: "12px 18px",
  borderBottom: "1px solid var(--nv-line)",
  alignItems: "center",
  cursor: "pointer",
  textDecoration: "none",
  color: "inherit",
};

/**
 * «الموارد البشرية › الموظفون» — one summary line, the onboarding pipeline and the employee
 * directory with the shared status pills (الكل · نشط · سعودي · وافد · وثيقة تنتهي · عقد · تجربة ·
 * بلا تأمينات · ملف ناقص). «نظرة عامة» opens a pill by ?filter=.
 */
export default function HrDirectoryBoard({ lang = "ar", stationScope = "all", initialFilter = "" }) {
  const ar = lang === "ar";
  const { data } = useAuth();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(FILTER_IDS.includes(initialFilter) ? initialFilter : "all");
  useEffect(() => {
    if (FILTER_IDS.includes(initialFilter)) setFilter(initialFilter);
  }, [initialFilter]);
  const [hoverRow, setHoverRow] = useState(null);

  // Scope narrows the register itself, so the Saudization rate and the pipeline
  // below always describe the station on screen.
  const employees = useMemo(
    () => (data?.employees || []).filter((e) => matchesStationScope(e.stationId, stationScope, data?.stations)),
    [data?.employees, data?.stations, stationScope],
  );
  const stations = (data?.stations || []).filter((s) => matchesStationScope(s.id, stationScope, data?.stations));
  const stationName = (id) => stations.find((s) => s.id === id)?.name || (ar ? "—" : "—");

  const pendingLeave = employees.reduce(
    (n, e) => n + (e.leaveRequests || []).filter((r) => r.status === "pending").length,
    0,
  );
  const saudiCount = employees.filter((e) => isSaudiForNitaqat(e)).length;
  const saudiPct = employees.length ? Math.round((saudiCount / employees.length) * 100) : 0;

  const hires = (data?.onboarding || data?.newHires || []).slice(0, 6);
  const recentHires = useMemo(() => {
    if (hires.length) return hires;
    const cutoff = Date.now() - 45 * 86400000;
    return employees
      .filter((e) => {
        const hire = e.profile?.hireDate || e.hireDate;
        return hire && new Date(hire).getTime() >= cutoff;
      })
      .slice(0, 4)
      .map((e) => ({
        id: e.id,
        name: e.name,
        role: e.position || e.profile?.qiwaTitle || "—",
        stationId: e.stationId,
        startDate: e.profile?.hireDate || e.hireDate,
        progress: 60,
        steps: [
          { key: "id", label: ar ? "هوية / إقامة" : "ID / Iqama", done: !!e.profile?.idNumber },
          { key: "gosi", label: ar ? "التأمينات" : "GOSI", done: !!e.profile?.gosiNumber },
          { key: "iban", label: ar ? "آيبان" : "IBAN", done: !!e.profile?.iban },
          { key: "medical", label: ar ? "فحص طبي" : "Medical", done: e.profile?.medicalExam === "complete" },
        ],
      }));
  }, [hires, employees, ar]);

  const today = localDateKey();
  const flags = useMemo(() => {
    const map = new Map();
    employees.forEach((e) => {
      if (e.role === "owner" && !e.stationId) return;
      try {
        map.set(e.id, hrEmployeeFlags(e, { today, ar }));
      } catch {
        map.set(e.id, {});
      }
    });
    return map;
  }, [employees, today, ar]);
  const matches = (e, id) => {
    if (id === "all") return true;
    if (e.role === "owner" && !e.stationId) return id === "active";
    const isSaudi = isSaudiForNitaqat(e);
    if (id === "saudi") return isSaudi;
    if (id === "expat") return !isSaudi;
    if (id === "active") return e.status !== "inactive";
    return Boolean(flags.get(e.id)?.[id]);
  };
  const FILTER_LABELS = {
    all: ar ? "الكل" : "All",
    active: ar ? "نشط" : "Active",
    saudi: ar ? "سعودي" : "Saudi",
    expat: ar ? "وافد" : "Expat",
    expiring: ar ? "وثيقة تنتهي" : "Doc expiring",
    contract: ar ? "عقد يحتاج قراراً" : "Contract due",
    probation: ar ? "تجربة تنتهي" : "Probation ending",
    gosi: ar ? "بلا تأمينات" : "No GOSI",
    incomplete: ar ? "ملف ناقص" : "File gaps",
  };
  const pills = FILTER_IDS.map((id) => ({ id, label: FILTER_LABELS[id], n: employees.filter((e) => matches(e, id)).length }));

  const directory = useMemo(() => {
    const q = query.trim().toLowerCase();
    return employees.filter((e) => {
      if (!matches(e, filter)) return false;
      if (!q) return true;
      const hay = [e.name, e.position, e.id, stationName(e.stationId), e.profile?.qiwaTitle]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [employees, query, filter, stations, flags]);

  const leavePct = (e) => {
    const bal = Number(e.profile?.leaveBalance?.annual ?? e.leaveBalance?.annual ?? 12);
    const total = 21;
    return Math.min(100, Math.round((bal / total) * 100));
  };

  return (
    <div dir={ar ? "rtl" : "ltr"} style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "1320px" }}>
      {/* One summary line — numbers in ink, no stat tiles. */}
      <SummaryLine
        label={ar ? "ملخص الموظفين" : "People summary"}
        parts={ar
          ? [
            { key: "people", value: employees.length, label: "موظفاً" },
            { key: "stations", value: stations.length, label: "فروع" },
            { key: "leave", value: pendingLeave, label: "طلب إجازة معلّق" },
            { key: "saudi", value: `${saudiPct}%`, label: `سعودة (${saudiCount} سعودي)` },
            { key: "onboarding", value: recentHires.length, label: "قيد التهيئة" },
          ]
          : [
            { key: "people", value: employees.length, label: "employees" },
            { key: "stations", value: stations.length, label: "stations" },
            { key: "leave", value: pendingLeave, label: "pending leave" },
            { key: "saudi", value: `${saudiPct}%`, label: `Saudization (${saudiCount} Saudi)` },
            { key: "onboarding", value: recentHires.length, label: "onboarding" },
          ]}
      />

      {/* Onboarding — L909 */}
      <ChromeBox>
        <div style={{ display: "flex", alignItems: "baseline", gap: "12px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 280px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
              {ar ? "مسار التهيئة لأول يوم عمل" : "Onboarding to day one"}
            </div>
            <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px", lineHeight: 1.7, maxWidth: "840px" }}>
              {ar
                ? "كل تعيين يظهر هنا بخطوات الالتزام النظامي — لا يُغلق الملف قبل اكتمالها."
                : "Every hire appears here with regulatory steps — the file does not close until they complete."}
            </div>
          </div>
          {recentHires.length > 0 && (
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--nv-ok-ink)", background: "var(--nv-accent-soft)", border: "1px solid var(--nv-ok-line)", borderRadius: "8px", padding: "5px 11px", whiteSpace: "nowrap" }}>
              {ar ? `${recentHires.length} تعيين قيد التهيئة` : `${recentHires.length} hires onboarding`}
            </span>
          )}
        </div>

        {recentHires.length === 0 ? (
          <div style={{ padding: "22px 0 6px", textAlign: "center", fontSize: "13px", color: MUTED }}>
            {ar ? "لا تعيينات قيد التهيئة في هذا النطاق." : "No hires in onboarding for this scope."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "14px" }}>
            {recentHires.map((c) => {
              const pct = Number(c.progress) || Math.round(((c.steps || []).filter((x) => x.done).length / Math.max(1, (c.steps || []).length)) * 100);
              const ready = pct >= 100;
              return (
                <div key={c.id} style={{ border: "1px solid var(--nv-line)", borderRadius: "13px", padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "14px", fontWeight: 600, color: NAVY }}>{c.name}</span>
                    <span style={{ fontSize: "12px", color: MUTED }}>
                      {c.role} · {stationName(c.stationId)}
                    </span>
                    <span style={{ flex: 1 }} />
                    <span style={{ fontSize: "11px", color: MUTED, whiteSpace: "nowrap" }} dir="ltr">
                      {c.startDate || "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "10px" }}>
                    <span style={{ flex: 1, height: "5px", borderRadius: "4px", background: "var(--nv-soft)", overflow: "hidden" }}>
                      <span style={bar(pct, ACCENT)} />
                    </span>
                    <span style={{ fontSize: "11px", color: MUTED, whiteSpace: "nowrap" }} dir="ltr">{pct}%</span>
                    <span style={ready ? OK : WARN}>{ready ? (ar ? "جاهز" : "Ready") : (ar ? "قيد الإكمال" : "In progress")}</span>
                    {!ready && (
                      <Link
                        to={`/app/employees/${encodeURIComponent(c.id)}`}
                        style={{ ...ui.btnRow, padding: "6px 12px", fontSize: "11px", textDecoration: "none" }}
                      >
                        {ar ? "الملف" : "File"}
                      </Link>
                    )}
                  </div>
                  {(c.steps || []).length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", marginTop: "8px" }}>
                      {c.steps.map((x) => (
                        <div key={x.key} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderTop: "1px solid var(--nv-line)", flexWrap: "wrap" }}>
                          <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: x.done ? ACCENT : "var(--nv-warn-fill)", flexShrink: 0 }} />
                          <span style={{ flex: "1 1 220px", minWidth: 0 }}>
                            <span style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "12px", fontWeight: 600, color: NAVY }}>{x.label}</span>
                              <span style={x.done ? OK : WARN}>{x.done ? (ar ? "مكتمل" : "Done") : (ar ? "مطلوب" : "Required")}</span>
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ChromeBox>

      {/* Directory table — L961 */}
      <div style={tableShell}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "14px 18px", borderBottom: "1px solid var(--nv-line)", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 220px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
              {ar ? "دليل الموظفين" : "Employee directory"}
            </div>
            <div style={{ fontSize: "11px", color: MUTED, marginTop: "3px" }}>
              {ar
                ? `مرتبط بالهيكل التنظيمي — كل تغيير يُسجَّل · ${directory.length} ملفًا`
                : `Linked to the org structure — every change is logged · ${directory.length} files`}
            </div>
          </div>
          <Link
            to="/app/hr?tab=org"
            style={{
              padding: "7px 13px",
              borderRadius: "9px",
              border: "1px solid var(--nv-line)",
              background: CARD,
              color: MUTED,
              fontSize: "12px",
              cursor: "pointer",
              fontFamily: "inherit",
              whiteSpace: "nowrap",
              textDecoration: "none",
            }}
          >
            {ar ? "الهيكل" : "Org"}
          </Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "9px", padding: "12px 18px", borderBottom: "1px solid var(--nv-line)", flexWrap: "wrap" }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={ar ? "ابحث بالاسم أو المسمى أو الفرع" : "Search name, title, or station"}
            style={{
              flex: "1 1 240px",
              height: "36px",
              border: "1px solid var(--nv-line)",
              borderRadius: "9px",
              background: SURFACE,
              padding: "0 12px",
              fontSize: "12px",
              color: NAVY,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <StatusFilterPills bare items={pills} value={filter} onChange={setFilter} size="sm" hideZero dataKey="hr-directory" />
        </div>
        {directory.length === 0 ? (
          <div style={{ padding: "26px 18px", textAlign: "center", fontSize: "13px", color: MUTED }}>
            {ar ? "لا نتائج لهذا البحث أو الفلتر." : "No results for this search or filter."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: "900px" }}>
              <div style={tableHead}>
                <div>{ar ? "الموظف" : "EMPLOYEE"}</div>
                <div>{ar ? "الفرع" : "STATION"}</div>
                <div>{ar ? "المسمى" : "POSITION"}</div>
                <div>{ar ? "الدرجة" : "GRADE"}</div>
                <div>{ar ? "رصيد الإجازات" : "LEAVE BALANCE"}</div>
                <div>{ar ? "الحالة" : "STATUS"}</div>
              </div>
              {directory.map((p) => {
                const pct = leavePct(p);
                const active = p.status !== "inactive";
                return (
                  <Link
                    key={p.id}
                    to={`/app/employees/${encodeURIComponent(p.id)}`}
                    style={{
                      ...tableRow,
                      background: hoverRow === p.id ? "var(--nv-soft)" : undefined,
                    }}
                    onMouseEnter={() => setHoverRow(p.id)}
                    onMouseLeave={() => setHoverRow(null)}
                  >
                    <EmployeeIdentityRow
                      employee={p}
                      employeeId={p.id}
                      name={p.name}
                      compact
                      link={false}
                    />
                    <div style={{ fontSize: "12px", color: MUTED }}>{stationName(p.stationId)}</div>
                    <div style={{ fontSize: "12px", color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {p.position || p.profile?.qiwaTitle || "—"}
                    </div>
                    <div dir="ltr" style={{ fontSize: "12px", color: MUTED, fontFamily: "'IBM Plex Mono',monospace", textAlign: "right" }}>
                      {p.grade || p.profile?.grade || "—"}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                      <span style={{ flex: 1, height: "4px", borderRadius: "4px", background: "var(--nv-soft)", overflow: "hidden" }}>
                        <span style={bar(pct, ACCENT)} />
                      </span>
                      <span dir="ltr" style={{ fontSize: "10px", color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif", width: "34px", textAlign: "right" }}>
                        {Number(p.profile?.leaveBalance?.annual ?? p.leaveBalance?.annual ?? 12)}
                      </span>
                    </div>
                    <div>
                      <span style={active ? OK : NEUTRAL}>
                        {active ? (ar ? "نشط" : "Active") : (ar ? "موقوف" : "Inactive")}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
