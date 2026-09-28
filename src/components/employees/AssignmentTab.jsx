import React, { useEffect, useState } from "react";
import { hcmCall } from "@/lib/hcmApi";
import { ACTION_LABELS, ACTION_REASONS } from "@/lib/hcmDerivations";
import StationTransferPanel from "@/components/employees/StationTransferPanel";
import { ACCENT, MUTED, NAVY, cardShell, tableShell } from "@/lib/platformStyles";

const STATUS_LABELS = {
  active: { ar: "على رأس العمل", en: "Active" },
  suspended: { ar: "موقوف", en: "Suspended" },
  terminated: { ar: "منتهي الخدمة", en: "Terminated" },
  not_hired: { ar: "بلا سجل تعيين", en: "No hire record" },
  active_underived: { ar: "قائم (إسناد مشتق)", en: "Active (derived assignment)" },
};

function Row({ label, value, mono }) {
  return (
    <div style={{ display: "flex", gap: "12px", padding: "9px 0", borderTop: "1px solid var(--nv-line)" }}>
      <span style={{ flex: "0 0 150px", fontSize: "11px", color: MUTED }}>{label}</span>
      <span dir={mono ? "ltr" : undefined} style={{ flex: 1, fontSize: "12px", color: NAVY, fontWeight: value === "—" ? 400 : 500 }}>{value}</span>
    </div>
  );
}

/** Employee file — the assignment and the register it derives from. */
export default function AssignmentTab({
  employee,
  companyId,
  lang = "ar",
  canManage = false,
  stations = [],
  currentUser,
  onTransferred,
}) {
  const ar = lang === "ar";
  const [state, setState] = useState(null);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    if (!companyId || !employee?.id) return undefined;
    hcmCall({ action: "assignment", companyId, employeeId: employee.id })
      .then((res) => {
        if (!alive) return;
        if (res?.ok) {
          setState(res);
          setError("");
        } else setError(ar ? (res?.reason || "") : (res?.reasonEn || ""));
      })
      .catch(() => {
        if (!alive) return;
        setError(ar
          ? "سجل الإسناد السحابي غير متصل — يمكنك نقل الفرع محليًا؛ تاريخ المناصب الكامل يعود مع خدمة HCM."
          : "Cloud assignment register is offline — you can still transfer branches locally; full position history returns with HCM.");
      });
    return () => { alive = false; };
  }, [companyId, employee?.id, ar, reloadKey]);

  const transferPanel = canManage ? (
    <StationTransferPanel
      employee={employee}
      stations={stations}
      companyId={companyId}
      actor={currentUser}
      ar={ar}
      onDone={() => {
        setReloadKey((k) => k + 1);
        onTransferred?.();
      }}
    />
  ) : (
    <div style={{ ...cardShell, fontSize: "12px", color: MUTED, lineHeight: 1.7 }}>
      {ar
        ? "نقل الفرع والمنصب من صلاحيات الإدارة أو الموارد البشرية — عبر «تنظيم» في الهيكل أو من هنا عند توفر الصلاحية."
        : "Branch and position moves are for management or HR — via Organize in the org tree, or here when permitted."}
    </div>
  );

  if (error && !state) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} dir={ar ? "rtl" : "ltr"}>
        {transferPanel}
        <div style={cardShell}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY, marginBottom: "6px" }}>
            {ar ? "فرع العمل الحالي" : "Current work branch"}
          </div>
          <Row
            label={ar ? "الفرع" : "Station"}
            value={stations.find((s) => String(s.id) === String(employee.stationId))?.name || (ar ? "غير مسند" : "Unassigned")}
          />
          <p style={{ margin: "12px 0 0", fontSize: "12px", lineHeight: 1.7, color: MUTED }}>{error}</p>
        </div>
      </div>
    );
  }
  if (!state) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} dir={ar ? "rtl" : "ltr"}>
        {transferPanel}
        <div style={{ ...cardShell, fontSize: "12px", color: MUTED }}>{ar ? "يُحمَّل الإسناد…" : "Loading assignment…"}</div>
      </div>
    );
  }

  const a = state.assignment;
  const history = state.history || [];
  const status = STATUS_LABELS[a.employmentStatus] || { ar: a.employmentStatus, en: a.employmentStatus };
  const stationName = stations.find((s) => String(s.id) === String(employee.stationId))?.name
    || a.orgUnitName
    || "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} dir={ar ? "rtl" : "ltr"}>
      {transferPanel}
      <div style={cardShell}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "10px", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 220px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
              {ar ? "الإسناد الحالي" : "Current assignment"}
            </div>
            <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px", lineHeight: 1.6 }}>
              {ar
                ? "الفرع والمنصب من الهيكل التنظيمي — ليسا بديلاً عن ملف العامل النظامي."
                : "Branch and position come from the org tree — they do not replace the statutory employee file."}
            </div>
          </div>
          <span style={{
            fontSize: "10px",
            fontWeight: 600,
            padding: "3px 9px",
            borderRadius: "20px",
            background: a.source === "action" ? "var(--nv-accent-soft)" : "var(--nv-warn-soft)",
            color: a.source === "action" ? "var(--nv-ok-ink)" : "var(--nv-warn-ink)",
            border: `1px solid ${a.source === "action" ? "var(--nv-ok-line)" : "var(--nv-line)"}`,
          }}
          >
            {a.source === "action"
              ? (ar ? "مشتق من سجل الإجراءات" : "Derived from the action register")
              : (ar ? "إسناد مشتق مؤقت" : "Temporary derived assignment")}
          </span>
        </div>

        {a.gap ? (
          <div style={{ marginTop: "10px", padding: "11px 13px", borderRadius: "10px", background: "var(--nv-warn-soft)", border: "1px solid var(--nv-line)", fontSize: "11px", color: "var(--nv-warn-ink)", lineHeight: 1.7 }}>
            {ar ? a.gap.reason : a.gap.reasonEn}
          </div>
        ) : null}

        <div style={{ marginTop: "12px" }}>
          <Row label={ar ? "الحالة الوظيفية" : "Employment status"} value={ar ? status.ar : status.en} />
          <Row label={ar ? "المنصب" : "Position"} value={a.positionRef ? `${a.positionRef} · ${a.jobTitle || "—"}` : (a.jobTitle || "—")} />
          <Row label={ar ? "الوظيفة" : "Job"} value={a.jobCode ? `${a.jobCode}` : "—"} mono={!!a.jobCode} />
          <Row label={ar ? "فرع العمل (الفرع)" : "Work branch (station)"} value={stationName} />
          <Row label={ar ? "الوحدة التنظيمية" : "Org unit"} value={a.orgUnitPath?.length ? a.orgUnitPath.join(" › ") : (a.orgUnitName || "—")} />
          <Row
            label={ar ? "مركز التكلفة" : "Cost centre"}
            value={a.costCenter ? `${a.costCenter}${a.costCenterInherited ? (ar ? " (موروث)" : " (inherited)") : ""}` : "—"}
            mono={!!a.costCenter}
          />
          <Row label={ar ? "رقم المنشأة" : "Establishment number"} value={a.establishmentNumber || "—"} mono={!!a.establishmentNumber} />
          <Row label={ar ? "نسبة الدوام" : "FTE"} value={String(a.fte)} mono />
          <Row label={ar ? "تاريخ المباشرة" : "Hire date"} value={a.hireDate || "—"} mono={!!a.hireDate} />
        </div>
      </div>

      <div style={tableShell}>
        <div style={{ padding: "16px 18px 12px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>{ar ? "تاريخ الإجراءات الوظيفية" : "Employment action history"}</div>
          <div style={{ fontSize: "11px", color: MUTED, marginTop: "3px", lineHeight: 1.6 }}>
            {ar
              ? "كل سطر مؤرَّخ بسبب مُرمَّز — النقل بين الفروع من هذه الصفحة؛ باقي الإجراءات من الهيكل التنظيمي."
              : "Every line is date-tracked with a coded reason — branch transfers from this page; other actions from Org Structure."}
          </div>
        </div>
        {history.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", fontSize: "12px", color: MUTED }}>
            {ar ? "لا إجراءات مسجَّلة بعد." : "No recorded actions yet."}
          </div>
        ) : history.map((h) => {
          const reason = (ACTION_REASONS[h.type] || []).find((r) => r.id === h.reasonCode);
          return (
            <div key={h.id} style={{ display: "flex", gap: "12px", alignItems: "baseline", padding: "11px 18px", borderTop: "1px solid var(--nv-line)", flexWrap: "wrap" }}>
              <span dir="ltr" style={{ flex: "0 0 92px", fontSize: "11px", color: MUTED }}>{h.effectiveDate}</span>
              <span style={{ flex: "0 0 96px", fontSize: "12px", fontWeight: 600, color: h.type === "termination" ? "var(--nv-bad-ink)" : ACCENT }}>
                {ar ? ACTION_LABELS[h.type]?.ar || h.type : ACTION_LABELS[h.type]?.en || h.type}
              </span>
              <span style={{ flex: "1 1 180px", fontSize: "11px", color: MUTED }}>
                {reason ? (ar ? reason.ar : reason.en) : h.reasonCode}
                {h.note ? ` · ${h.note}` : ""}
              </span>
              <span style={{ fontSize: "11px", color: MUTED }}>{h.recordedByName || "—"}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
