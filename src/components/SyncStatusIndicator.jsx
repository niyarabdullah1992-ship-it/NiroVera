
import React, { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { getSyncStatus, subscribe } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { MUTED } from "@/lib/platformStyles";

export default function SyncStatusIndicator({ isSyncing }) {
  const { t } = useI18n();
  const [status, setStatus] = useState(getSyncStatus());

  useEffect(() => {
    const update = () => setStatus(getSyncStatus());
    const unsub = subscribe(update);
    const interval = setInterval(update, 4000);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      unsub();
      clearInterval(interval);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  const shell = {
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    height: 32,
    padding: "0 12px",
    borderRadius: 9,
    border: "1px solid var(--nv-line, #E4E9E6)",
    background: "var(--nv-card)",
    fontSize: 12.5,
    fontWeight: 700,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
    cursor: "default",
  };

  if (status.offline || status.pending > 0) {
    return (
      <span style={{ ...shell, color: "var(--nv-warn-ink)", borderColor: "var(--nv-warn-line)", background: "var(--nv-warn-soft)" }} title={t("syncPendingTitle")}>
        <CloudOff style={{ width: 14, height: 14 }} strokeWidth={1.75} />
        <span className="hidden sm:inline">{t("syncPending")}</span>
      </span>
    );
  }
  if (isSyncing) {
    return (
      <span style={{ ...shell, color: MUTED }}>
        <RefreshCw style={{ width: 13, height: 13 }} strokeWidth={1.75} className="animate-spin" />
        <span className="hidden sm:inline">{t("syncing")}</span>
      </span>
    );
  }
  return (
    <span className="nv-sync-ok" style={{ ...shell, color: "var(--nv-ok-ink, #2F6B43)" }} title={t("syncSavedTitle")}>
      <Cloud style={{ width: 16, height: 16, color: "#3C7D50" }} strokeWidth={1.75} />
      <span>{t("synced")}</span>
    </span>
  );
}
