import React from "react";
import { citeRule, ruleValue } from "@/lib/laborRules";
import { DISCIPLINE_PENALTY_KINDS } from "@/lib/disciplineDerivations";

const DANGER = "#9B2335";
const GOLD = "#C8A45A";

/** Model ladder from the ministry work-organization schedule. Not live people. */
const LADDER = [
  ["التأخر حتى 15 دقيقة دون إذن", "إنذار كتابي", "5%", "10%", "20%", "Late by up to 15 minutes without leave", "Written warning", "5%", "10%", "20%"],
  ["التأخر من 15 إلى 30 دقيقة", "10%", "15%", "25%", "50%", "Late by 15 to 30 minutes", "10%", "15%", "25%", "50%"],
  ["الانصراف قبل الموعد دون إذن", "إنذار كتابي", "10%", "15%", "يوم", "Leaving before the end without leave", "Written warning", "10%", "15%", "One day"],
  ["الغياب يوماً دون عذر", "حسم يومين", "3 أيام", "4 أيام", "فصل مع المكافأة", "One day absent without excuse", "Two days deducted", "3 days", "4 days", "Dismissal with the award"],
  ["عدم ارتداء معدات السلامة", "10%", "25%", "يوم", "يومان", "Not wearing safety gear", "10%", "25%", "One day", "Two days"],
  ["التدخين في مكان محظور", "إنذار كتابي", "10%", "25%", "يوم", "Smoking in a prohibited place", "Written warning", "10%", "25%", "One day"],
  ["إهمال العهدة أو الأدوات", "إنذار كتابي", "25%", "يوم", "يومان", "Neglect of custody or tools", "Written warning", "25%", "One day", "Two days"],
];

const OUTSIDE = [
  ["80", "الفصل دون مكافأة أو إشعار يقتصر على حالات المادة 80، ويُسمع دفاع العامل قبله.", "Dismissal without the award or notice is limited to Article 80 cases, and the worker's defence is heard first."],
  ["70", "الغرامات والإيقاف لا تتجاوز أجر خمسة أيام في الشهر.", "Fines and suspension do not exceed five days' wage in a month."],
  ["68", "مضيّ 180 يوماً على الجزاء السابق يُعيد السلّم إلى «أول مرة».", "180 days after the previous sanction resets the ladder to the first step."],
];

function cellTone(text) {
  if (/فصل|يومان|Dismissal|Two days/.test(String(text || ""))) return DANGER;
  if (/إنذار|يوم|warning|One day|deducted/i.test(String(text || ""))) return GOLD;
  return "var(--nv-ink)";
}

export default function DisciplineScheduleBoard({ ar, today }) {
  const art = citeRule("discipline.penalties.cite", today)?.article || "—";
  const cap = ruleValue("discipline.fine.maxDays", today);
  const heads = ar
    ? ["المخالفة", "أول مرة", "ثاني مرة", "ثالث مرة", "رابع مرة"]
    : ["Offence", "First", "Second", "Third", "Fourth"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <section
        className="nv-paper"
        data-discipline-schedule=""
        style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--nv-line)", fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
          {ar
            ? "سلّم الجزاء يتدرّج بتكرار المخالفة نفسها خلال 180 يوماً (المادة 68). النسب من الأجر اليومي، والجدول نموذج — المعتمد هو لائحة تنظيم العمل المعتمدة لدى المنشأة."
            : "The ladder steps up when the same offence repeats within 180 days (Article 68). Percents are of the daily wage. The table is a model — the adopted work-organization regulations govern."}
        </div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ minWidth: 760, display: "grid", gridTemplateColumns: "minmax(180px,1.6fr) 112px 112px 112px 148px" }}>
            {heads.map((label) => (
              <span key={label} style={{ padding: "8px 12px", fontSize: 11.5, fontWeight: 700, color: "var(--nv-ink2)", borderBottom: "1px solid var(--nv-line)", background: "var(--nv-hover)" }}>{label}</span>
            ))}
            {LADDER.map((row) => {
              const cells = ar ? row.slice(0, 5) : row.slice(5, 10);
              return cells.map((text, index) => (
                <span
                  key={`${cells[0]}-${index}`}
                  style={{
                    padding: "9px 12px",
                    borderBottom: "1px solid var(--nv-line)",
                    fontSize: index === 0 ? 13 : 12,
                    fontWeight: index === 0 ? 700 : 600,
                    color: index === 0 ? "var(--nv-ink)" : cellTone(text),
                    fontFamily: index === 0 || /[\u0600-\u06FF]/.test(text) ? "inherit" : "'IBM Plex Mono', monospace",
                    whiteSpace: index === 0 ? "normal" : "nowrap",
                    lineHeight: 1.45,
                    background: "var(--nv-card)",
                  }}
                >
                  {text || "—"}
                </span>
              ));
            })}
          </div>
        </div>
      </section>

      <section
        className="nv-paper"
        data-discipline-ladder-limit=""
        style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden" }}
      >
        <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--nv-line)", fontSize: 13, fontWeight: 700, background: "var(--nv-hover)" }}>
          {ar ? "ما لا يدخل السلّم" : "What stays off the ladder"}
        </div>
        {OUTSIDE.map((row) => (
          <div key={row[0]} style={{ padding: "8px 14px", borderBottom: "1px solid var(--nv-line)", display: "grid", gridTemplateColumns: "52px minmax(0,1fr)", gap: 10, alignItems: "center", background: "var(--nv-card)" }}>
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 15, fontWeight: 600 }}>{row[0]}</span>
            <span style={{ fontSize: 12, color: "var(--nv-ink)", lineHeight: 1.55 }}>{ar ? row[1] : row[2]}</span>
          </div>
        ))}
      </section>

      <section
        className="nv-paper"
        data-discipline-kinds=""
        style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}
      >
        <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--nv-line)", display: "flex", flexDirection: "column", gap: 3, background: "var(--nv-hover)" }}>
          <span style={{ fontSize: 14, fontWeight: 700 }}>{ar ? "جزاءات المادة 66 — القائمة المغلقة" : "Article 66 — the closed list"}</span>
          <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.6 }}>
            {ar
              ? "ما يجوز توقيعه فقط. لا جزاء يُكتب نصّاً حرّاً خارج هذه القائمة."
              : "Only what may be imposed. A penalty is not free text outside this list."}
          </span>
        </div>
        {DISCIPLINE_PENALTY_KINDS.map((kind) => {
          const wage = kind.id === "fine" || kind.id === "suspend";
          const note = wage
            ? (ar ? `حتى ${cap || "—"} أيام` : `Up to ${cap || "—"} days`)
            : (kind.deferMonths ? (ar ? "حتى سنة" : "Up to one year") : "—");
          return (
            <div
              key={kind.id}
              style={{
                padding: "8px 14px",
                borderBottom: "1px solid var(--nv-line)",
                display: "grid",
                gridTemplateColumns: "36px minmax(0,1fr) auto",
                gap: 10,
                alignItems: "center",
                background: "var(--nv-card)",
              }}
            >
              <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 15, fontWeight: 600 }}>{kind.limb || "—"}</span>
              <span style={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>{ar ? kind.ar : kind.en}</span>
                <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{note}</span>
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "var(--nv-ok-ink)", border: "1px solid var(--nv-ok-line)", borderRadius: 999, padding: "2px 9px", whiteSpace: "nowrap", background: "transparent" }}>
                {ar ? `المادة ${art}` : `Art. ${art}`}
              </span>
            </div>
          );
        })}
        <div style={{ padding: "10px 14px", fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7 }}>
          {ar
            ? "المادة 67: لا يُوقَّع جزاء غير وارد في النظام أو في لائحة تنظيم العمل المعتمدة."
            : "Article 67: no penalty may be imposed that is not in the Law or the adopted work-organization regulations."}
        </div>
      </section>
    </div>
  );
}
