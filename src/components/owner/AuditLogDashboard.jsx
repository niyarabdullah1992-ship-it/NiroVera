import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { History, Loader2 } from "lucide-react";
import OwnerExportButtons from "@/components/owner/OwnerExportButtons";
import { OwnerSectionHead, OwnerStatTile, ownerGrid, ownerPaper, ownerStack } from "@/components/owner/ownerUi";

export default function AuditLogDashboard({ ar, companies = [] }) {
  const [logs, setLogs] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([
      base44.functions.invoke("companyDirectory", { action: "getAllAuditLog", companyId: "platform" }),
      base44.entities.CompanyAccount.list("-created_date", 500),
    ]).then(([res, companyAccounts]) => {
      setLogs(res.data.logs || []);
      setAccounts(companyAccounts);
    }).catch(() => {
      setLogs([]);
      setError(true);
    });
  }, []);

  const names = useMemo(
    () => Object.fromEntries([
      ...companies.map((company) => [company.id, company.name]),
      ...accounts.map((account) => [account.companyId, account.name]),
    ]),
    [companies, accounts],
  );

  if (!logs) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
        <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--nv-accent)" }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ ...ownerPaper("bad"), padding: 24, textAlign: "center", fontSize: 13, color: "var(--nv-bad-ink)" }}>
        {ar ? "تعذر تحميل سجل التدقيق. يرجى المحاولة لاحقًا." : "Unable to load the audit log. Please try again later."}
      </div>
    );
  }

  const subscriptionLogs = logs.filter((log) => log.action?.startsWith("subscription_") || log.action?.startsWith("invoice_"));
  const reportHeaders = ar
    ? ["الشركة", "الإجراء", "القيمة السابقة", "القيمة الجديدة", "التفاصيل", "التاريخ"]
    : ["Company", "Action", "Old value", "New value", "Details", "Date"];
  const reportRows = subscriptionLogs.map((log) => [
    names[log.companyId] || log.companyId,
    log.action,
    log.oldValue || "—",
    log.newValue || "—",
    log.reason || log.details || "—",
    new Date(log.created_date).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB"),
  ]);

  return (
    <div style={ownerStack}>
      <OwnerSectionHead
        title={(
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <History className="h-5 w-5" style={{ color: "var(--nv-accent)" }} />
            {ar ? "سجل المراقبة والتدقيق" : "Monitoring & audit log"}
          </span>
        )}
        meta={(
          <OwnerExportButtons
            filename="powercare_audit_ledger"
            title={ar ? "سجل المراقبة والتدقيق" : "Monitoring and audit ledger"}
            headers={reportHeaders}
            rows={reportRows}
            ar={ar}
          />
        )}
      />
      <div style={ownerGrid}>
        <OwnerStatTile label={ar ? "إجراءات الاشتراك" : "Subscription actions"} value={subscriptionLogs.length} state="mute" />
        <OwnerStatTile label={ar ? "شركات متأثرة" : "Companies affected"} value={new Set(subscriptionLogs.map((log) => log.companyId)).size} state="mute" />
      </div>
      <div style={{ ...ownerPaper("mute"), overflow: "hidden", padding: 0 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {subscriptionLogs.map((log) => (
            <article
              key={log.id}
              style={{
                display: "grid",
                gap: 8,
                padding: 14,
                borderBottom: "1px solid var(--nv-line)",
                fontSize: 13,
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              }}
            >
              <div>
                <p style={{ margin: 0, fontWeight: 700, color: "var(--nv-ink)" }}>{names[log.companyId] || log.companyId}</p>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--nv-muted)" }}>{log.action}</p>
              </div>
              <p style={{ margin: 0, color: "var(--nv-muted)" }}>
                {log.oldValue || "—"} → <span style={{ color: "var(--nv-ink)" }}>{log.newValue || "—"}</span>
              </p>
              <p style={{ margin: 0, color: "var(--nv-muted)" }}>{log.reason || log.details || "—"}</p>
              <p style={{ margin: 0, fontSize: 11, color: "var(--nv-muted)" }}>
                {new Date(log.created_date).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")}
              </p>
            </article>
          ))}
          {!subscriptionLogs.length ? (
            <p style={{ margin: 0, padding: 40, textAlign: "center", fontSize: 13, color: "var(--nv-muted)" }}>
              {ar ? "لا توجد إجراءات بعد." : "No actions yet."}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
