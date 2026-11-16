import React, { useEffect, useState } from "react";
import ContractLeaveFields from "@/components/hr/ContractLeaveFields";
import { ANNUAL_MIN, applyContractLeave, contractLeaveOf, restDefaults, restWord } from "@/lib/contractLeave";

/** «الإجازات والراحة في العقد» — in «العقد والأجر»: what was written, and HR can raise it (never below the law). */
export default function ContractLeaveCard({ employee, companyId, canEdit = false, fileEditing = false, onTermsChange }) {
  const now = contractLeaveOf(employee);
  const annual = now.annual || ANNUAL_MIN;
  const count = now.restCount || 1;
  const dows = now.restDows.length ? now.restDows : restDefaults(count);
  const [editing, setEditing] = useState(false);
  const [terms, setTerms] = useState({ annual, restCount: count, restDows: dows });
  // «تحرير الملف» opens this card too — one edit mode for the whole file.
  useEffect(() => {
    if (!canEdit) return;
    if (fileEditing) { setTerms({ annual, restCount: count, restDows: dows }); setEditing(true); onTermsChange?.(null); }
    else setEditing(false);
  }, [fileEditing, canEdit]);
  const row = (label, value, note) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "9px 0", borderBottom: "1px solid var(--nv-line2, var(--nv-line))", alignItems: "baseline" }}>
      <span style={{ fontSize: 12.5, color: "var(--nv-muted)" }}>{label}</span>
      <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        <strong style={{ fontSize: 13.5, color: "var(--nv-ink)" }}>{value}</strong>
        {note ? <span style={{ fontSize: 10.5, color: "var(--nv-muted)" }}>{note}</span> : null}
      </span>
    </div>
  );
  return (
    <section data-contract-leave-card="1" style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <strong style={{ fontSize: 14 }}>الإجازات والراحة في العقد</strong>
        {canEdit && !editing && !fileEditing ? <button type="button" onClick={() => { setTerms({ annual, restCount: count, restDows: dows }); setEditing(true); }} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 700, border: "1px solid var(--nv-line)", background: "var(--nv-card)", borderRadius: 8, height: 28, padding: "0 10px", cursor: "pointer" }}>تعديل</button> : null}
      </div>
      <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>ما كُتب في العقد. لا يقل عن الحد النظامي، ولصاحب المنشأة أن يزيد عليه.</span>
      {editing ? (
        <>
          <ContractLeaveFields hideTitle value={terms} onChange={(next) => { setTerms(next); if (fileEditing) onTermsChange?.(next); }} />
          {fileEditing ? null : <span style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => { applyContractLeave(companyId, employee.id, terms); setEditing(false); }} style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 700, border: "1px solid var(--nv-navy)", background: "var(--nv-navy)", color: "var(--nv-btn-ink, #fff)", borderRadius: 8, height: 30, padding: "0 12px", cursor: "pointer" }}>حفظ الإجازات والراحة</button>
            <button type="button" onClick={() => setEditing(false)} style={{ fontFamily: "inherit", fontSize: 12, border: "1px solid var(--nv-line)", background: "var(--nv-card)", borderRadius: 8, height: 30, padding: "0 12px", cursor: "pointer" }}>إلغاء</button>
          </span>}
        </>
      ) : (
        <div>
          {row("الإجازة السنوية", `${annual} يوماً`, now.annual ? (annual > ANNUAL_MIN ? `أعلى من الحد النظامي (${ANNUAL_MIN}) بـ ${annual - ANNUAL_MIN}` : "الحد النظامي") : "لم تُحدَّد في العقد — يُطبَّق الحد النظامي")}
          {row("الراحة الأسبوعية", restWord(count), "الأيام تُحدَّد في جدول الدوام")}
          {row("الرصيد في «طلباتي»", `${annual} يوماً في السنة`, "يُحسب منه المكتسب والمتبقي")}
        </div>
      )}
    </section>
  );
}
