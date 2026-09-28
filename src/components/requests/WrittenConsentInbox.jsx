import React, { useState } from "react";
import { useAuth } from "@/lib/PowerCareAuth";
import { answerWrittenConsent, attachWrittenConsentPaper } from "@/lib/store";
import { CONSENT_MINISTRY_HINT_AR, CONSENT_MINISTRY_HINT_EN, consentStatus, hashConsentFile, isNightWrittenConsent, mineWrittenConsents, nightWrittenConsentGlow, openWrittenConsentCount, readConsentFile } from "@/lib/writtenConsent";
import { isViewerOwnFile } from "@/lib/employeeFileView";
import { BORDER, CARD, INK, MUTED, NAVY_FILL, tableShell } from "@/lib/platformStyles";
import { formatUiNumber } from "@/lib/dateFormat";
import { toast } from "@/components/ui/use-toast";
import ConsentSignRow from "@/components/requests/ConsentSignRow";

const NIGHT_TITLE_AR = "موافقة خطية على الاستمرار كعامل ليلي";
const NIGHT_HINT_AR = "بعد ثلاثة أشهر كعامل ليلي تُطلب موافقة خطية محفوظة مع حق التراجع في أي وقت، أو يُدوَّر العمل لساعات عادية شهراً على الأقل.";

function chip(on) {
  return {
    fontFamily: "inherit",
    fontSize: 12,
    padding: "7px 12px",
    border: `1px solid ${on ? NAVY_FILL : BORDER}`,
    background: on ? NAVY_FILL : CARD,
    color: on ? "#fff" : MUTED,
    fontWeight: on ? 700 : 400,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

export default function WrittenConsentInbox({ employees, currentUser, ar, refresh }) {
  const { company } = useAuth();
  const scoped = employees.filter((row) => isViewerOwnFile(row, currentUser));
  const mine = mineWrittenConsents(scoped);
  const openCount = openWrittenConsentCount(scoped);
  const [filter, setFilter] = useState(openCount ? "mine" : "all");
  const [busyId, setBusyId] = useState("");
  const [ack, setAck] = useState({});

  const loadPaper = async (item, picked) => {
    if (!picked || !company?.id) return;
    setBusyId(item.id);
    try {
      const [hash, url] = await Promise.all([hashConsentFile(picked), readConsentFile(picked)]);
      const paper = {
        name: picked.name,
        size: picked.size,
        hash,
        url,
        type: picked.type,
      };
      const result = attachWrittenConsentPaper(company.id, item.employee.id, item.id, paper);
      if (!result.ok) {
        toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
        return;
      }
      refresh?.();
    } catch {
      toast({ description: ar ? "تعذّر قراءة الملف." : "Could not read the file.", variant: "destructive" });
    } finally {
      setBusyId("");
    }
  };

  const answer = (item, payload) => {
    if (!company?.id) return;
    const result = answerWrittenConsent(company.id, item.employee.id, item.id, payload);
    if (!result.ok) {
      toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
      return;
    }
    refresh?.();
  };

  if (!mine.length) return null;

  const openRows = mine.filter((row) => consentStatus(row) === "open");
  const settled = mine.filter((row) => consentStatus(row) !== "open");
  const nightGlow = nightWrittenConsentGlow(scoped);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {openRows.map((item) => {
        const night = isNightWrittenConsent(item);
        const from = [item.requestedBy, item.employee?.stationName].filter(Boolean).join(" · ");
        const title = night
          ? (ar ? NIGHT_TITLE_AR : "Written consent to continue as a night worker")
          : (ar ? (item.titleAr || "موافقة خطية") : (item.titleEn || "Written consent"));
        const cite = night ? (ar ? "قرار 18632" : "Decision 18632") : (item.article || item.decisionId || "");
        const hint = night
          ? (ar ? NIGHT_HINT_AR : "After three months as a night worker a written consent is required, with the right to withdraw at any time, or the work rotates to ordinary hours for at least a month.")
          : (ar ? CONSENT_MINISTRY_HINT_AR : CONSENT_MINISTRY_HINT_EN);
        const mineRow = item.employee?.id === currentUser?.id;
        const acked = !!ack[item.id];
        const hasPaper = !!item.paper?.name;
        const canAgree = hasPaper && acked && busyId !== item.id;
        return (
          <section
            key={item.id}
            style={{
              background: CARD,
              border: "1px solid var(--nv-line)",
              borderRadius: 14,
              boxShadow: "0 1px 2px rgba(12,20,16,.04), 0 10px 26px rgba(12,20,16,.05)",
              padding: "14px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              alignItems: "stretch",
            }}
          >
            <strong style={{ fontSize: 14, color: INK, lineHeight: 1.45 }}>{title}</strong>
            {cite ? (
              <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", height: 22, padding: "0 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: "#2F6B43", background: "#E6F2EA", border: "1px solid #BCDFCB" }}>{cite}</span>
            ) : null}
            <span style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.75 }}>
              {hint}{from ? ` ${ar ? "من" : "From"} ${from}.` : ""}
            </span>
            <span style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", minHeight: 22, padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: "#8A5A12", background: "#FBF3E1", border: "1px solid #E7D3A1" }}>
              {ar ? "بانتظار موافقتك" : "Awaiting your consent"}
            </span>
            {mineRow ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {hasPaper ? (
                  <span style={{ fontSize: 12, color: INK }}>{ar ? `النسخة الموقّعة: ${item.paper.name}` : `Signed copy: ${item.paper.name}`}</span>
                ) : null}
                <label className="nv-attach nv-attach--inline" style={{ alignSelf: "flex-start" }}>
                  {busyId === item.id ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "أرفق النسخة الموقّعة" : "Attach the signed copy")}
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    disabled={busyId === item.id}
                    onChange={(event) => {
                      const picked = event.target.files?.[0];
                      event.target.value = "";
                      if (picked) loadPaper(item, picked);
                    }}
                    style={{ display: "none" }}
                  />
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: INK, lineHeight: 1.7, cursor: "pointer" }}>
                  <input type="checkbox" checked={acked} onChange={(event) => setAck((map) => ({ ...map, [item.id]: event.target.checked }))} style={{ marginTop: 3 }} />
                  <span>{ar ? "أقرّ بأنني كتبت الموافقة ووقّعتها في قسم التوقيع، وأرفع النسخة هنا." : "I acknowledge that I wrote the consent, signed it in Digital signing, and upload the copy here."}</span>
                </label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    type="button"
                    disabled={!canAgree}
                    onClick={() => canAgree && answer(item, { accept: true, ack: true, paper: item.paper })}
                    style={{ fontFamily: "inherit", height: 34, padding: "0 14px", borderRadius: 8, border: "none", background: canAgree ? "#3C7D50" : "#E4E9E6", color: canAgree ? "#fff" : "#555C66", fontSize: 12, fontWeight: 600, cursor: canAgree ? "pointer" : "default" }}
                  >
                    {ar ? "أوافق" : "Agree"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => answer(item, { accept: false })}
                    style={{ fontFamily: "inherit", height: 34, padding: "0 12px", borderRadius: 8, border: "1px solid var(--nv-bad-line)", background: CARD, color: "var(--nv-bad-ink)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    {ar ? "أرفض" : "Refuse"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        );
      })}
      {settled.length ? (
        <section style={{ ...tableShell, borderRadius: 14 }}>
          <div style={{ padding: "10px 18px", display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" style={chip(filter === "archive")} onClick={() => setFilter(filter === "archive" ? "all" : "archive")}>
              {ar ? `أرشيف الموافقات · ${formatUiNumber(settled.length, true)}` : `Consent archive · ${settled.length}`}
            </button>
          </div>
          {filter === "archive" ? settled.map((item) => (
            <ConsentSignRow
              key={item.id}
              item={item}
              ar={ar}
              party={item.requestedBy}
              canAct={false}
              glow={isNightWrittenConsent(item) ? nightGlow : "off"}
            />
          )) : null}
        </section>
      ) : null}
    </div>
  );
}
