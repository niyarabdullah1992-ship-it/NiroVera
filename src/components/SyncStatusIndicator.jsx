
import React, { useEffect, useState } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { getSyncStatus, subscribe } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

export default function SyncStatusIndicator({ isSyncing, className = "" }) {
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

  const cls = className ? ` ${className}` : "";
  if (status.offline || status.pending > 0) {
    return (
      <span className={`nv-hdr-seg nv-hdr-sync${cls}`} data-sync="pending" role="status" title={t("syncPendingTitle")}>
        <CloudOff aria-hidden style={{ width: 14, height: 14 }} strokeWidth={1.75} />
        <span>{t("syncPending")}</span>
      </span>
    );
  }
  if (isSyncing) {
    return (
      <span className={`nv-hdr-seg nv-hdr-sync${cls}`} data-sync="syncing" role="status" title={t("syncing")}>
        <RefreshCw aria-hidden style={{ width: 13, height: 13 }} strokeWidth={1.75} className="animate-spin" />
        <span>{t("syncing")}</span>
      </span>
    );
  }
  return (
    <span className={`nv-hdr-seg nv-hdr-sync nv-sync-ok${cls}`} data-sync="ok" role="status" title={t("syncSavedTitle")}>
      <span aria-hidden className="nv-hdr-sync-dot" />
      <span>{t("synced")}</span>
    </span>
  );
}
