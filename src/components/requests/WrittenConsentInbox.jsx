import React, { useMemo, useState } from "react";
import { useAuth } from "@/lib/PowerCareAuth";
import { answerWrittenConsent, attachWrittenConsentPaper } from "@/lib/store";
import { CONSENT_MINISTRY_HINT_AR, CONSENT_MINISTRY_HINT_EN, consentStatus, hashConsentFile, isNightWrittenConsent, mineWrittenConsents, nightWrittenConsentGlow, openWrittenConsentCount, readConsentFile } from "@/lib/writtenConsent";
import { isViewerOwnFile } from "@/lib/employeeFileView";
import { BORDER, CARD, INK, MUTED, SURFACE, tableShell } from "@/lib/platformStyles";
import { formatUiNumber } from "@/lib/dateFormat";
import { toast } from "@/components/ui/use-toast";
import ConsentSignRow from "@/components/requests/ConsentSignRow";

const GRID = "minmax(200px, 2.2fr) minmax(0, 1.2fr) 140px 118px";

function chip(on) {
  return {
    fontFamily: "inherit",
    fontSize: 12,
    padding: "7px 12px",
    border: `1px solid ${on ? INK : BORDER}`,
    background: on ? INK : CARD,
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

  const rows = useMemo(() => {
    if (filter === "mine") return mine.filter((row) => consentStatus(row) === "open");
    if (filter === "archive") return mine.filter((row) => consentStatus(row) !== "open");
    return mine;
  }, [filter, mine]);

  const loadPaper = async (item, picked) => {
    if (!picked || !company?.id) return;
    setBusyId(item.id);
    try {
      const [hash, url] = await Promise.all([hashConsentFile(picked), readConsentFile(picked)]);
      const result = attachWrittenConsentPaper(company.id, item.employee.id, item.id, {
        name: picked.name,
        size: picked.size,
        hash,
        url,
        type: picked.type,
      });
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

  const settled = mine.filter((row) => consentStatus(row) !== "open").length;
  const nightGlow = nightWrittenConsentGlow(scoped);

  return (
    <section style={tableShell}>
      <div style={{ padding: "16px 18px 12px", display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: INK }}>{ar ? "موافقاتي الخطية" : "My written consents"}</span>
          <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.7, maxWidth: 640 }}>
            {ar ? CONSENT_MINISTRY_HINT_AR : CONSENT_MINISTRY_HINT_EN}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={chip(filter === "all")} onClick={() => setFilter("all")}>
            {ar ? `الكل · ${formatUiNumber(mine.length, true)}` : `All · ${mine.length}`}
          </button>
          <button type="button" style={chip(filter === "mine")} onClick={() => setFilter("mine")}>
            {ar ? `مفتوحة · ${formatUiNumber(openCount, true)}` : `Open · ${openCount}`}
          </button>
          <button type="button" style={chip(filter === "archive")} onClick={() => setFilter("archive")}>
            {ar ? `الأرشيف · ${formatUiNumber(settled, true)}` : `Archive · ${settled}`}
          </button>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: GRID, gap: 16, padding: "11px 18px", background: SURFACE, borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, fontSize: 10, letterSpacing: "0.06em", color: MUTED, fontWeight: 600 }}>
        <span>{ar ? "الملف" : "File"}</span>
        <span>{ar ? "من" : "From"}</span>
        <span>{ar ? "الحالة" : "Status"}</span>
        <span>{ar ? "الوقت" : "When"}</span>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: "22px 18px", fontSize: 12, color: MUTED }}>
          {filter === "mine"
            ? (ar ? "لا موافقة مفتوحة." : "No open consent.")
            : (ar ? "لا صفوف في هذا المرشح." : "No rows in this filter.")}
        </div>
      ) : rows.map((item) => (
        <ConsentSignRow
          key={item.id}
          item={item}
          ar={ar}
          party={item.requestedBy}
          canAct={consentStatus(item) === "open" && item.employee?.id === currentUser?.id}
          paperBusy={busyId === item.id}
          onPaper={(picked) => loadPaper(item, picked)}
          onAccept={({ ack, paper }) => answer(item, { accept: true, ack, paper: paper || item.paper })}
          onRefuse={({ note }) => answer(item, { accept: false, note })}
          glow={isNightWrittenConsent(item) ? nightGlow : "off"}
        />
      ))}
    </section>
  );
}
