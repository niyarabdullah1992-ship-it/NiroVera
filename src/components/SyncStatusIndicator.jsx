
import React, { useEffect, useState } from "react";
import { Cloud, CloudOff, RefreshCw } from "lucide-react";
import { getSyncStatus, subscribe } from "@/lib/store";
import { useI18n } from "@/lib/i18n";
import { ACCENT, MUTED } from "@/lib/platformStyles";

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
    gap: 5,
    height: 34,
    padding: "0 9px",
    borderRadius: 10,
    border: "1px solid var(--nv-line, #E2E8F0)",
    background: "var(--nv-card, #fff)",
    fontSize: 11,
    fontWeight: 600,
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  };

  if (status.offline || status.pending > 0) {
    return (
      <span style={{ ...shell, color: "#B45309", borderColor: "#FDE68A", background: "#FFFBEB" }} title={t("syncPendingTitle")}>
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
    <span style={{ ...shell, color: "#14683F", borderColor: "color-mix(in oklab, #1E9E63 35%, #fff)", background: "#ECFDF3" }} title={t("syncSavedTitle")}>
      <Cloud style={{ width: 14, height: 14, color: ACCENT }} strokeWidth={1.75} />
      <span className="hidden sm:inline">{t("synced")}</span>
    </span>
  );
}
