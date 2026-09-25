import React, { useState } from "react";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import { checkDisposeDisciplineFinesGate, fineLedgerBalance } from "@/lib/disciplineDerivations";

const field = {
  fontFamily: "inherit",
  fontSize: 12,
  padding: "9px 10px",
  border: "1px solid var(--nv-line)",
  borderRadius: 10,
  background: "var(--nv-card)",
  color: "var(--nv-ink)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

export default function DisciplineFineFund({ ledger = [], ar, today, onDispose }) {
  const [authority, setAuthority] = useState("committee");
  const [note, setNote] = useState("");
  const balance = fineLedgerBalance(ledger);
  const gate = checkDisposeDisciplineFinesGate({ authority, note, ledger, today });
  return (
    <section style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 14, boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line3)", display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{ar ? "سجل الغرامات وصرفها — المادة 73" : "Fine register and disposal — Article 73"}</span>
        <LaborArticleCite ruleId="discipline.fines.register.cite" ar={ar} showText />
        <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
          {ar
            ? "القيد: الاسم والأجر والمقدار والسبب والتاريخ. الصرف لنفع عمال المنشأة فقط — بقرار اللجنة العمالية أو بموافقة الوزارة إن لم توجد لجنة. لا يُختلق سند."
            : "The register: name, wage, amount, reason, and date. Disposal is for the establishment's workers only — by the labour committee, or with the Ministry's approval if there is no committee. No invented instrument."}
        </span>
      </div>
      <div style={{ padding: "14px 20px", display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 10 }}>
        <span style={{ fontSize: 12, color: "var(--nv-ink2)" }}>{ar ? "مقيَّد" : "Posted"} · <b dir="ltr">{balance.posted}</b></span>
        <span style={{ fontSize: 12, color: "var(--nv-ink2)" }}>{ar ? "مُلغى" : "Voided"} · <b dir="ltr">{balance.voided}</b></span>
        <span style={{ fontSize: 12, color: "var(--nv-ok-ink)" }}>{ar ? "قابل للصرف" : "Available"} · <b dir="ltr">{balance.available}</b></span>
      </div>
      <div style={{ padding: "0 20px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "جهة الصرف" : "Disposal authority"}</span>
          <select value={authority} onChange={(event) => setAuthority(event.target.value)} style={field}>
            <option value="committee">{ar ? "اللجنة العمالية في المنشأة" : "Establishment labour committee"}</option>
            <option value="ministry">{ar ? "موافقة الوزارة — لا لجنة" : "Ministry approval — no committee"}</option>
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "سند الصرف — رقم القرار أو الموافقة" : "Disposal instrument — decision or approval number"}</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder={ar ? "اكتب المرجع كما هو — لا يُصرف بلا سند" : "Write the reference as it is — no disposal without an instrument"} style={field} />
        </label>
        <button
          type="button"
          onClick={() => gate.ok && onDispose?.({ authority, note })}
          style={{
            fontFamily: "inherit",
            fontSize: 12,
            fontWeight: 600,
            padding: "10px 14px",
            border: "none",
            borderRadius: 10,
            background: gate.ok ? "var(--nv-navy)" : "var(--nv-line3)",
            color: gate.ok ? "var(--nv-btn-ink)" : "var(--nv-muted)",
            cursor: gate.ok ? "pointer" : "default",
            alignSelf: "flex-start",
          }}
        >
          {gate.ok ? (ar ? `اصرف ${balance.available} ر.س لنفع العمال` : `Dispose ${balance.available} SAR for the workers`) : (ar ? gate.reason : gate.reasonEn)}
        </button>
      </div>
    </section>
  );
}
