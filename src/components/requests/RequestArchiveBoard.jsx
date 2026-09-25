import React, { useEffect, useMemo, useState } from "react";
import RecordSmartArchive from "@/components/shared/RecordSmartArchive";
import {
  collectRequestArchive,
  filterRequestArchive,
  formatArDate,
  requestArchiveSmartItems,
  requestAuditTrailRows,
} from "@/lib/requestWorkspace";
import { BORDER, CARD, CONTROL_RADIUS, MUTED, NAVY, PILL_RADIUS } from "@/lib/platformStyles";
import LaborArticleCite from "@/components/shared/LaborArticleCite";

function chip(on) {
  return {
    fontFamily: "inherit",
    fontSize: 11,
    padding: "7px 12px",
    border: `1px solid ${on ? "var(--nv-navy, #14213d)" : BORDER}`,
    background: on ? "var(--nv-navy, #14213d)" : CARD,
    color: on ? "#fff" : MUTED,
    fontWeight: on ? 700 : 400,
    cursor: "pointer",
    whiteSpace: "nowrap",
    borderRadius: PILL_RADIUS,
  };
}

function RequestAuditTrail({ request, ar }) {
  const events = requestAuditTrailRows(request?.source || request, ar);
  if (!events.length) {
    return (
      <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>
        {ar ? "لا سطر تدقيق محفوظ على هذا الطلب بعد." : "No audit row is stored on this request yet."}
      </span>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {events.map((event, index) => (
        <div key={`${event.at || "e"}-${index}`} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: NAVY }}>{event.text}</span>
          <span style={{ fontSize: 10, color: MUTED, lineHeight: 1.7 }}>
            {[event.by, event.at ? formatArDate(String(event.at).slice(0, 10), ar ? "ar" : "en") : ""].filter(Boolean).join(" · ")}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function RequestArchiveBoard({
  employees,
  ar,
  currentUser,
  onWithdrawLeave,
  stations = [],
  focusStationId = "",
  canManage = false,
  scope: scopeProp,
}) {
  const lang = ar ? "ar" : "en";
  const [query, setQuery] = useState("");
  const lockedScope = scopeProp === "mine" || scopeProp === "manage" ? scopeProp : "";
  const [scope, setScope] = useState(lockedScope || (canManage ? "manage" : "mine"));
  const [withdrawAck, setWithdrawAck] = useState({});

  useEffect(() => {
    if (lockedScope) setScope(lockedScope);
  }, [lockedScope]);

  const packed = useMemo(() => collectRequestArchive(employees, lang), [employees, lang]);
  const result = useMemo(() => filterRequestArchive({
    rows: packed.rows,
    stations,
    query,
    stationId: scope === "manage" ? (focusStationId || "all") : "all",
    viewer: currentUser,
    lane: scope === "mine" ? "mine" : "",
    lang,
  }), [packed.rows, stations, query, focusStationId, currentUser, scope, lang]);

  const items = useMemo(
    () => requestArchiveSmartItems(result.rows, { lang, stations, hideEmployeeName: scope === "mine" }),
    [result.rows, lang, stations, scope],
  );

  const emptyText = result.reason || (ar
    ? "لا بنود مستقرّة بعد. ما يُعتمد أو يُرفض أو يُسحب ينتقل إلى الأرشيف."
    : "Nothing has settled yet. Approved, refused, or withdrawn moves here.");

  const showScopeToggle = canManage && !lockedScope;

  return (
    <RecordSmartArchive
      items={items}
      lang={lang}
      dir={ar ? "rtl" : "ltr"}
      query={query}
      onQueryChange={setQuery}
      skipFilter
      emptyLabel={emptyText}
      noMatchLabel={result.error === "NO_MATCH" ? result.reason : undefined}
      searchPlaceholder={ar ? "بحث في الأرشيف…" : "Search archive…"}
      subtitle={scope === "mine"
        ? (ar ? "طلباتك المستقرّة فقط — مجمّعة يومًا بيوم. قيد النظر يبقى في ملفي. اضغط السطر لسجل التدقيق." : "Only your settled requests — grouped day by day. Pending stays on My file. Open a row for the audit trail.")
        : (ar ? "ما استقرّ في نطاق فروعك — مجمّعة يومًا بيوم. قيد النظر يبقى في صندوق القرار. اضغط السطر لسجل التدقيق." : "What settled in your branch scope — grouped day by day. Pending stays in the decision inbox. Open a row for the audit trail.")}
      meta={showScopeToggle ? (
        <span style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <button type="button" onClick={() => setScope("manage")} style={chip(scope === "manage")}>{ar ? "إدارة" : "Manage"}</button>
          <button type="button" onClick={() => setScope("mine")} style={chip(scope === "mine")}>{ar ? "ملفي" : "My file"}</button>
        </span>
      ) : null}
      renderOpen={(item) => {
        const row = item.row;
        if (!row) return null;
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 2, borderTop: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: NAVY, paddingTop: 10 }}>{ar ? "سجل التدقيق" : "Audit trail"}</span>
            <LaborArticleCite
              article={row.article || undefined}
              leaveType={row.kind === "leave" ? row.type : undefined}
              decisionId={row.decisionId || undefined}
              productOnly={row.productOnly}
              ar={ar}
              showOfficial
              entitlement={row.kind === "leave" || row.decisionId === "18632"}
            />
            <RequestAuditTrail request={row} ar={ar} />
            {row.kind === "leave" && row.status === "approved" && row.withdrawOpen && row.employeeId === currentUser?.id && onWithdrawLeave ? (
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 10, color: NAVY, lineHeight: 1.7 }}>
                <span style={{ display: "flex", gap: 8, alignItems: "flex-start", cursor: "pointer" }}>
                  <input type="checkbox" checked={!!withdrawAck[row.id]} onChange={(e) => setWithdrawAck((m) => ({ ...m, [row.id]: e.target.checked }))} style={{ marginTop: 2 }} />
                  <span>{ar ? "أقرّ بسحب إجازتي المعتمدة قبل موعد بدئها، وإشعار الإدارة لتعديل الجدول." : "I withdraw my approved leave before it starts, and notify operations to adjust the roster."}</span>
                </span>
                <button type="button" disabled={!withdrawAck[row.id]} onClick={() => onWithdrawLeave(row)} style={{ fontFamily: "inherit", fontSize: 10, fontWeight: 600, padding: "5px 9px", border: `1px solid ${withdrawAck[row.id] ? "#e9c4c9" : BORDER}`, background: CARD, color: withdrawAck[row.id] ? "#8a1c2b" : MUTED, cursor: withdrawAck[row.id] ? "pointer" : "default", alignSelf: "flex-start", borderRadius: CONTROL_RADIUS }}>
                  {ar ? "اسحب الإجازة المعتمدة" : "Withdraw approved leave"}
                </button>
              </label>
            ) : null}
          </div>
        );
      }}
    />
  );
}
