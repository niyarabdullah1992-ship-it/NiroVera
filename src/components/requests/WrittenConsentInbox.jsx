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

  const loadPaper = async (item, picked, { accept = false } = {}) => {
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
      if (accept) {
        const saved = answerWrittenConsent(company.id, item.employee.id, item.id, { accept: true, ack: true, paper });
        if (!saved.ok) {
          toast({ description: ar ? saved.reason : saved.reasonEn, variant: "destructive" });
        }
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
        return (
          <section
            key={item.id}
            style={{
              background: CARD,
              border: "1px solid #ECD9A8",
              borderRadius: 14,
              boxShadow: "0 1px 2px rgba(20,33,61,.04), 0 10px 26px rgba(20,33,61,.045)",
              padding: "14px 18px",
              display: "grid",
              gridTemplateColumns: "auto minmax(0,1fr) auto",
              gap: 14,
              alignItems: "center",
            }}
          >
            <span aria-hidden style={{ width: 9, height: 9, borderRadius: "50%", background: "var(--nv-warn-fill, #C9962B)" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ fontSize: 13, color: INK }}>{title}</strong>
                {cite ? (
                  <span style={{ display: "inline-flex", alignItems: "center", height: 18, padding: "0 7px", borderRadius: 999, fontSize: 10, fontWeight: 600, color: "#137A49", background: "#F2FAF6", border: "1px solid #BFE6D2" }}>{cite}</span>
                ) : null}
              </div>
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
                {hint}{from ? ` ${ar ? "من" : "From"} ${from}.` : ""}
              </span>
            </div>
            {mineRow ? (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <label className="nv-attach nv-attach--inline">
                  {busyId === item.id ? (ar ? "جارٍ الحفظ…" : "Saving…") : (ar ? "أرفق النسخة الموقّعة" : "Attach the signed copy")}
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    disabled={busyId === item.id}
                    onChange={(event) => {
                      const picked = event.target.files?.[0];
                      event.target.value = "";
                      if (picked) loadPaper(item, picked, { accept: true });
                    }}
                    style={{ display: "none" }}
                  />
                </label>
                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => answer(item, { accept: false })}
                  style={{ fontFamily: "inherit", height: 32, padding: "0 12px", borderRadius: 9, border: "1px solid #E9C4C9", background: CARD, color: "#8A1C2B", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
                >
                  {ar ? "أرفض" : "Refuse"}
                </button>
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
