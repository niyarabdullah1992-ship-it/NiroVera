import React, { useState } from "react";

export default function VoiceLawPanel({ ar, breached = 0 }) {
  const [open, setOpen] = useState(false);
  const rows = [
    {
      art: ar ? "لائحة تنظيم العمل" : "Work regulations",
      name: ar ? "قناة داخلية بمهلة" : "Internal channel with a deadline",
      text: ar ? "يصعّد الصوت إلى المستوى التالي عند انتهاء مهلته، ولا يُهمل." : "A voice is raised to the next level when its window ends. It is not dropped.",
      tone: breached > 0 ? "warn" : "ok",
    },
    {
      art: ar ? "المادة 61" : "Article 61",
      name: ar ? "حسن المعاملة وحفظ الكرامة" : "Decent treatment and dignity",
      text: ar ? "أي جزاء مرتبط بشكوى يُبطل. الشكوى لا تصل إلى من هي عنه." : "Any sanction tied to a complaint is void. A complaint never reaches the person it is about.",
      tone: "ok",
    },
    {
      art: ar ? "المادة 220" : "Article 220",
      name: ar ? "التسوية الودية ثم المحكمة العمالية" : "Amicable settlement, then the labour court",
      text: ar ? "بعد المسار الداخلي تبقى التسوية الودية ثم المحكمة العمالية." : "After the internal path, amicable settlement and then the labour court remain open.",
      tone: "ok",
    },
  ];
  const met = rows.filter((row) => row.tone === "ok").length;
  const head = breached > 0
    ? (ar ? `${breached > 1 ? breached : 1} تنبيه — مهلة فاتت فصعد الصوت` : `${breached} alert — a missed window raised the voice`)
    : (ar ? `مستقر · ${met} مستوفى` : `Steady · ${met} met`);
  const shown = open ? rows : rows.filter((row) => row.tone === "warn");
  return (
    <section style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: "var(--nv-ink)" }}>{ar ? "حكم المنصة على الصوت" : "Platform judgment on the voice"}</span>
        <span style={{ display: "inline-flex", alignItems: "center", minHeight: 26, padding: "0 12px", borderRadius: 999, fontSize: 12, fontWeight: 700, background: breached ? "var(--nv-warn-soft)" : "var(--nv-ok-soft)", color: breached ? "var(--nv-warn-ink)" : "var(--nv-ok-ink)" }}>{head}</span>
        <span style={{ flex: 1, minWidth: 12 }} />
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          style={{ fontFamily: "inherit", fontSize: 12, fontWeight: 600, height: 32, padding: "0 12px", borderRadius: 999, cursor: "pointer", border: "1px solid var(--nv-line)", background: open ? "#0B3D27" : "var(--nv-card)", color: open ? "#fff" : "var(--nv-ink2)" }}
        >
          {open ? (ar ? "إخفاء المواد ▴" : "Hide the articles ▴") : (ar ? `عرض المواد (${rows.length}) ▾` : `Show articles (${rows.length}) ▾`)}
        </button>
      </div>
      {shown.map((row) => (
        <div key={row.art} style={{ padding: "12px 16px", borderTop: "1px solid var(--nv-line)", display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-ink)" }}>{row.art}</span>
            <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{row.name}</span>
            <span style={{ marginInlineStart: "auto", display: "inline-flex", alignItems: "center", height: 22, padding: "0 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: row.tone === "warn" ? "var(--nv-bad-ink)" : "var(--nv-ok-ink)", background: row.tone === "warn" ? "var(--nv-bad-soft)" : "var(--nv-ok-soft)" }}>
              {row.tone === "warn" ? (ar ? "مخالفة" : "Breach") : (ar ? "✓ مستوفى" : "✓ Met")}
            </span>
          </span>
          <span style={{ fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.7 }}>{row.text}</span>
        </div>
      ))}
    </section>
  );
}
