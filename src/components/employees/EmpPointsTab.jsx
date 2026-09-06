import React, { useMemo } from "react";
import { BORDER, MUTED, NAVY, NAVY_FILL, OK, WARN, SURFACE } from "@/lib/platformStyles";
import { ChromeBox } from "@/components/shared/IdentityCard";

/**
 * Platform emp file Points tab — L2765–2808.
 * Derives from company task/target records when present; otherwise empty chrome.
 * No invented scores.
 */
export default function EmpPointsTab({ employee, data, lang = "ar" }) {
  const ar = lang === "ar";
  const name = employee?.name || "";

  const rows = useMemo(() => {
    const tasks = [
      ...(data?.tasks || []),
      ...(data?.targets || []),
    ];
    return tasks
      .filter((t) => {
        const assignee = t.assigneeId || t.employeeId || t.assignment_id || t.employee_id;
        const byName = t.assignee === name || t.ownerName === name;
        return assignee === employee?.id || byName;
      })
      .map((t) => {
        const pri = Number(t.priorityValue ?? (t.priority === "high" || t.priority === "urgent" ? 3 : t.priority === "medium" ? 2 : 1));
        const w = Number(t.weight || t.effortWeight || 1) || 1;
        const done = t.status === "completed" || t.status === "done" || !!t.proofApproved;
        return {
          task: t.title || t.name || "—",
          pri: pri === 3 ? (ar ? "عالية" : "High") : pri === 2 ? (ar ? "متوسطة" : "Medium") : (ar ? "منخفضة" : "Low"),
          weight: `×${w}`,
          points: String(pri * w),
          state: done ? (ar ? "مُنحت" : "Granted") : (ar ? "بانتظار اعتماد الإثبات" : "Awaiting proof approval"),
          stateStyle: done ? OK : WARN,
          granted: done,
          score: pri * w,
        };
      });
  }, [data?.tasks, data?.targets, employee?.id, name, ar]);

  const granted = rows.filter((r) => r.granted).reduce((n, r) => n + r.score, 0);
  const held = rows.filter((r) => !r.granted).reduce((n, r) => n + r.score, 0);

  const head = {
    display: "grid",
    gridTemplateColumns: "minmax(220px,1.8fr) 110px 90px 90px 170px",
    gap: "12px",
    padding: "10px 20px",
    background: SURFACE,
    borderTop: `1px solid ${BORDER}`,
    borderBottom: `1px solid ${BORDER}`,
    fontSize: "10px",
    letterSpacing: "0.06em",
    color: MUTED,
    fontWeight: 600,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }} dir={ar ? "rtl" : "ltr"}>
      <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 200px", background: NAVY_FILL, borderRadius: "14px", padding: "20px", color: "#fff" }}>
          <div style={{ fontSize: "11px", color: "#6EE7B7", letterSpacing: "0.1em", fontWeight: 600 }}>
            {ar ? "النقاط الممنوحة" : "GRANTED"}
          </div>
          <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "42px", fontWeight: 600, lineHeight: 1, marginTop: "10px", textAlign: "right" }}>
            {granted}
          </div>
        </div>
        <ChromeBox style={{ flex: "1 1 200px" }}>
          <div style={{ fontSize: "11px", color: MUTED, letterSpacing: "0.1em", fontWeight: 600 }}>
            {ar ? "معلّقة" : "HELD"}
          </div>
          <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "42px", fontWeight: 600, lineHeight: 1, marginTop: "10px", color: "#B45309", textAlign: "right" }}>
            {held}
          </div>
        </ChromeBox>
      </div>

      <ChromeBox padded={false}>
        <div style={{ padding: "16px 20px 12px" }}>
          <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
            {ar ? "نقاط الأداء" : "Performance points"}
          </div>
          <div style={{ fontSize: "11px", color: MUTED, marginTop: "4px", textWrap: "pretty" }}>
            {ar
              ? `النقاط = قيمة الأولوية × وزن الجهد، محسوبة من مهام ${name} وحدها، ولا تُمنح إلا بعد اعتماد إثبات الإنجاز.`
              : `Points = priority value × effort weight, computed from ${name}'s own tasks and granted only after the completion proof is approved.`}
          </div>
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: "22px 20px", fontSize: "13px", color: MUTED }}>
            {ar ? "لا نقاط بعد — تظهر هنا بعد تسجيل مهام بإثبات معتمد." : "No points yet — they appear here after tasks with approved proof."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: "620px" }}>
              <div style={head}>
                <div>{ar ? "المهمة" : "TASK"}</div>
                <div>{ar ? "الأولوية" : "PRIORITY"}</div>
                <div>{ar ? "الوزن" : "WEIGHT"}</div>
                <div>{ar ? "النقاط" : "POINTS"}</div>
                <div>{ar ? "الحالة" : "STATUS"}</div>
              </div>
              {rows.map((p, i) => (
                <div
                  key={`${p.task}-${i}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(220px,1.8fr) 110px 90px 90px 170px",
                    gap: "12px",
                    padding: "13px 20px",
                    borderBottom: "1px solid #F1F5F9",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: "13px", fontWeight: 500, color: NAVY }}>{p.task}</div>
                  <div style={{ fontSize: "12px", color: MUTED }}>{p.pri}</div>
                  <div dir="ltr" style={{ fontSize: "12px", color: MUTED, fontFamily: "'IBM Plex Sans',sans-serif", textAlign: "right" }}>{p.weight}</div>
                  <div dir="ltr" style={{ fontSize: "14px", fontWeight: 600, fontFamily: "'IBM Plex Sans',sans-serif", textAlign: "right", color: NAVY }}>{p.points}</div>
                  <div><span style={p.stateStyle}>{p.state}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ChromeBox>
    </div>
  );
}
