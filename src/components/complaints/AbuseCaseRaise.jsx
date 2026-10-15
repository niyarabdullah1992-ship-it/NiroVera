import React, { useState } from "react";
import { getCompanyData } from "@/lib/store";
import { laborCalendarOf } from "@/lib/ummAlQuraCalendar";
import { ABUSE_GOV_PATH_AR, ABUSE_GOV_PATH_EN, ABUSE_KINDS, checkFileAbuseGate } from "@/lib/abuseComplaint";
import { fileAbuseCase } from "@/lib/abuseStore";
import { BORDER, CARD, CONTROL_RADIUS, MUTED } from "@/lib/platformStyles";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { toast } from "@/components/ui/use-toast";

const field = { fontFamily: "inherit", fontSize: 12.5, padding: "10px 12px", border: `1px solid ${BORDER}`, background: CARD, color: "var(--nv-ink)", outline: "none", width: "100%", boxSizing: "border-box", borderRadius: CONTROL_RADIUS };
const block = { padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 10 };
const label = { fontSize: 11.5, color: MUTED };

/**
 * «شكوى إيذاء أو تحرش» in طلباتي — the worker (or a witness) files a confidential case with the
 * establishment within five working days (model regulation Art. 55(1)). If the accused is the owner or
 * the top authority, the internal route is closed and the government path is shown instead.
 */
export default function AbuseCaseRaise({ employee, companyId, ar = true, onSent }) {
  const data = getCompanyData(companyId);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" }).format(new Date());
  const [role, setRole] = useState("victim");
  const [kind, setKind] = useState("");
  const [incidentAt, setIncidentAt] = useState("");
  const [accusedId, setAccusedId] = useState("");
  const [accusedTop, setAccusedTop] = useState(false);
  const [place, setPlace] = useState("");
  const [description, setDescription] = useState("");
  const [witnesses, setWitnesses] = useState("");
  const people = (data?.employees || []).filter((e) => String(e.id) !== String(employee?.id));
  const accused = people.find((e) => String(e.id) === String(accusedId));
  const topIds = new Set([String(data?.ownerId || "")]);
  const isTop = accusedTop || (accused && (topIds.has(String(accused.id)) || accused.role === "owner"));
  const gate = checkFileAbuseGate({
    role, kind, incidentAt, description, accusedId, accusedName: accused?.name, accusedTop: isTop, reporterId: employee?.id,
    filedAt: today, calendar: laborCalendarOf(data), restWeekdays: Array.isArray(data?.settings?.weeklyRestDays) ? data.settings.weeklyRestDays : undefined,
  });

  const send = () => {
    if (!gate.ok) return;
    const res = fileAbuseCase(companyId, { role, reporter: employee, accused: { id: accused?.id, name: accused?.name }, kind, incidentAt, place, description, witnesses, accusedTop: isTop });
    if (!res.ok) {
      toast({ description: ar ? res.reason : res.reasonEn, variant: "destructive" });
      return;
    }
    toast({ description: ar ? "أُرسلت شكواك بسرية — تُشكَّل لجنة تحقق خلال خمسة أيام عمل، ولا تُضارّ من تقديمها." : "Sent confidentially — a committee investigates within five working days." });
    setKind(""); setIncidentAt(""); setAccusedId(""); setPlace(""); setDescription(""); setWitnesses(""); setAccusedTop(false);
    onSent?.();
  };

  return (
    <div data-abuse-raise="">
      <div style={block}>
        <span style={{ fontSize: 12, lineHeight: 1.8, color: "var(--nv-ink2)" }}>
          {ar
            ? "الإيذاء كل إساءة أو استغلال أو ابتزاز أو إغراء أو تهديد — جسدي أو نفسي أو جنسي — في مكان العمل، بالقول أو الكتابة أو الإشارة أو الإيحاء أو الهاتف أو الوسائل الإلكترونية (النموذج الموحد م54). شكواك سرية، ولا يطّلع عليها المشكو في حقه."
            : "Abuse is any mistreatment, exploitation, blackmail, enticement or threat — physical, psychological or sexual — at the workplace, by any means (model Art. 54). Your complaint is confidential."}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {[["victim", ar ? "وقع عليّ" : "It happened to me"], ["witness", ar ? "شاهدته أو اطّلعت عليه" : "I witnessed it"]].map(([id, text]) => (
            <button key={id} type="button" onClick={() => setRole(id)} style={{ ...field, width: "auto", cursor: "pointer", fontWeight: role === id ? 700 : 500, borderColor: role === id ? "#3C7D50" : BORDER }}>{text}</button>
          ))}
        </div>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={label}>{ar ? "نوع الإيذاء" : "Kind"}</span>
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={field}>
            <option value="">—</option>
            {ABUSE_KINDS.map((k) => <option key={k.id} value={k.id}>{ar ? k.ar : k.en}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={label}>{ar ? "من صدر منه الإيذاء" : "Who did it"}</span>
          <select value={accusedId} onChange={(e) => setAccusedId(e.target.value)} style={field}>
            <option value="">—</option>
            {people.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </label>
        <label style={{ ...label, display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={accusedTop} onChange={(e) => setAccusedTop(e.target.checked)} />
          {ar ? "المشكو في حقه صاحب المنشأة أو أعلى سلطة فيها" : "The accused is the owner or the top authority"}
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={label}>{ar ? "تاريخ الواقعة" : "Date of the incident"}</span>
          <PlatformDateField ar={ar} value={incidentAt} onChange={setIncidentAt} />
        </label>
        <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder={ar ? "المكان" : "Place"} style={field} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={ar ? "ما الذي حدث؟" : "What happened?"} style={{ ...field, minHeight: 80 }} />
        <input value={witnesses} onChange={(e) => setWitnesses(e.target.value)} placeholder={ar ? "الشهود — اختياري" : "Witnesses — optional"} style={field} />
        {!gate.ok && gate.route === "government" ? (
          <div data-abuse-gov="" style={{ border: "1px solid var(--nv-warn-line)", borderRadius: 8, padding: "10px 12px", fontSize: 12, lineHeight: 1.8, color: "var(--nv-warn-ink)" }}>{ar ? gate.reason : gate.reasonEn}</div>
        ) : null}
        {!gate.ok && gate.route !== "government" && (kind || incidentAt || description) ? <span style={{ fontSize: 11.5, color: "var(--nv-bad-ink)" }}>{ar ? gate.reason : gate.reasonEn}</span> : null}
        {gate.ok && gate.lastDay ? <span style={label}>{ar ? `مهلة الشكوى للمنشأة حتى ${gate.lastDay} — خمسة أيام عمل من الواقعة (م55/1).` : `Internal complaint window until ${gate.lastDay}.`}</span> : null}
        <span style={label}>{ar ? ABUSE_GOV_PATH_AR : ABUSE_GOV_PATH_EN}</span>
      </div>
      <div style={{ padding: "14px 20px" }}>
        <button type="button" data-abuse-send="" disabled={!gate.ok} onClick={send} style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 700, height: 40, padding: "0 18px", borderRadius: 8, border: "none", background: gate.ok ? "#0B3D27" : "var(--nv-line)", color: gate.ok ? "#fff" : "var(--nv-muted)", cursor: gate.ok ? "pointer" : "default" }}>
          {ar ? "أرسل الشكوى بسرية" : "Send confidentially"}
        </button>
      </div>
    </div>
  );
}
