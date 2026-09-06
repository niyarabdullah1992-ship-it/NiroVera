import React from "react";
import { Link } from "react-router-dom";
import { DISCIPLINE_STEPS } from "@/lib/disciplineDerivations";
import DisciplineCaseThread from "@/components/employees/DisciplineCaseThread";
import { BORDER, CARD, MUTED, NAVY } from "@/lib/platformStyles";

export default function DisciplineOnFile({
  employee,
  companyId,
  currentUser,
  cases,
  canManage,
  ar,
}) {
  const mine = (cases || []).filter((c) => c.employeeId === employee.id);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: NAVY }}>
          {ar ? "الجزاءات والتحقيق" : "Sanctions and investigation"}
        </p>
        {canManage ? (
          <Link to="/app/discipline" style={{ fontSize: 11, color: MUTED, textDecoration: "none" }}>
            {ar ? "فتح مسار المواد 66–73 ←" : "Open Articles 66–73 path →"}
          </Link>
        ) : null}
      </div>
      {mine.length === 0 ? (
        <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
          {ar
            ? "لا ملف جزاء مفتوح. عند فتح واقعة يمكن كتابة الرسالة وإرفاق الملف في المحادثة هنا."
            : "No open sanction file. When a case is opened, write the message and attach the file in the conversation here."}
        </p>
      ) : mine.map((c) => {
        const step = DISCIPLINE_STEPS.find((s) => s.id === c.status) || DISCIPLINE_STEPS[0];
        return (
          <div key={c.id} style={{ border: `1px solid ${BORDER}`, borderRadius: 16, padding: "14px 16px", background: CARD }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12, color: MUTED }}>{ar ? step.ar : step.en}</span>
            </div>
            {c.note ? <p style={{ margin: "6px 0 0", fontSize: 13, color: NAVY }}>{c.note}</p> : null}
            <DisciplineCaseThread
              caseRow={c}
              companyId={companyId}
              currentUser={currentUser}
              canManage={canManage}
              isSubject={currentUser?.id === employee.id}
              ar={ar}
            />
          </div>
        );
      })}
    </div>
  );
}
