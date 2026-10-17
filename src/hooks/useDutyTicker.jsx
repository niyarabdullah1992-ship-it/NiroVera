import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { addNotification, directManagerIdOf, getCompanyData } from "@/lib/store";
import { getLocalTodayAttendance } from "@/lib/localAttendanceFallback";
import { isLocalPreviewActive } from "@/lib/localPreview";
import { dutyContextOf, breakClockOf, nextDutyTickAt, planDutyTick } from "@/lib/dutyTicker";
import { toRiyadhDateKey } from "@/lib/riyadhDate";
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";

/** Today's attendance row the ticker last saw (cloud mode), per person and day — a per-tab convenience. */
const cacheKey = (companyId, userId) => `nv-duty-att:${companyId}:${userId}:${toRiyadhDateKey()}`;
function readCache(companyId, userId) {
  try {
    const raw = sessionStorage.getItem(cacheKey(companyId, userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeCache(companyId, userId, row) {
  try { sessionStorage.setItem(cacheKey(companyId, userId), JSON.stringify(row || null)); } catch { /* best-effort */ }
}

/** A device notification — only when the person already granted it (asked from the punch card only). */
export function deviceNotify(title, body, { tag, onClick } = {}) {
  try {
    if (typeof window === "undefined" || !("Notification" in window) || window.Notification.permission !== "granted") return false;
    const note = new window.Notification(title, { body, tag, lang: "ar", dir: "rtl" });
    note.onclick = () => {
      try { window.focus(); } catch { /* ignore */ }
      onClick?.();
      note.close();
    };
    return true;
  } catch {
    return false;
  }
}

/**
 * The one app-level duty ticker (mounted once in Layout): every minute — and at the break's exact
 * end — it reads today's duty for the signed-in person, sends the notices that are due (bell +
 * toast + device notification when permitted; the direct manager's bell on a real breach), and
 * returns the running break for the header pill. Dedupe is the bell's keys (per shift + alert id).
 */
export default function useDutyTicker({ company, currentUser, ar = true, navigate }) {
  const companyId = company?.id || "";
  const userId = currentUser?.id || "";
  const [cloudRow, setCloudRow] = useState(() => (companyId && userId ? readCache(companyId, userId) : null));
  const [now, setNow] = useState(() => Date.now());
  const rowRef = useRef(cloudRow);
  rowRef.current = cloudRow;
  const navRef = useRef(navigate);
  navRef.current = navigate;

  // The attendance row: the card's punches (event), else one quiet fetch of today's cloud status.
  useEffect(() => {
    if (!companyId || !userId) return undefined;
    setCloudRow(readCache(companyId, userId));
    const onUpdate = (event) => {
      const row = event?.detail;
      if (!row || String(row.employee_id ?? row.employeeId ?? userId) !== String(userId)) return;
      setCloudRow(row);
      writeCache(companyId, userId, row);
    };
    window.addEventListener("attendance-updated", onUpdate);
    let cancelled = false;
    if (!isLocalPreviewActive()) {
      base44.functions.invoke("supabaseAttendance", { action: "getTodayStatus", employeeId: userId })
        .then((res) => {
          const row = res?.data?.attendance;
          if (cancelled || !row) return;
          setCloudRow(row);
          writeCache(companyId, userId, row);
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
      window.removeEventListener("attendance-updated", onUpdate);
    };
  }, [companyId, userId]);

  // Local preview: the store's row is the record. Cloud: the server's row (fetched, or the card's
  // last punch); a local fallback row only when the cloud has no check-in for today.
  const attendanceNow = () => {
    const local = companyId && userId ? getLocalTodayAttendance(companyId, userId) : null;
    if (isLocalPreviewActive()) return local;
    const raw = rowRef.current;
    const cloud = raw && String(raw.date || toRiyadhDateKey()).slice(0, 10) === toRiyadhDateKey() ? raw : null;
    return cloud?.check_in_at ? cloud : (local || cloud);
  };

  // The tick: next minute boundary, or the break's end if sooner — so «انتهت راحتك» lands on time.
  useEffect(() => {
    if (!companyId || !userId) return undefined;
    let timer = null;
    let stopped = false;
    const run = () => {
      if (stopped) return;
      const t = Date.now();
      setNow(t);
      let clock = null;
      try {
        const data = getCompanyData(companyId);
        const employee = (data?.employees || []).find((row) => String(row.id) === String(userId)) || currentUser;
        const tick = planDutyTick({ data, user: currentUser, attendance: attendanceNow(), now: t, managerId: directManagerIdOf(data, employee), ar });
        clock = tick.clock;
        for (const plan of tick.plans) {
          addNotification(companyId, plan.userId, plan.text, { key: plan.key, to: plan.to });
          if (String(plan.userId) !== String(userId)) continue;
          const open = () => navRef.current?.(plan.to);
          toast({
            title: ar ? "تنبيه الدوام" : "Duty alert",
            description: plan.text,
            variant: plan.breach ? "warning" : "default",
            duration: 9000,
            action: plan.action === "break_start"
              ? <ToastAction altText={ar ? "بدأت راحتي" : "I started my break"} onClick={open}>{ar ? "بدأت راحتي" : "Start my break"}</ToastAction>
              : undefined,
          });
          deviceNotify(ar ? "تنبيه الدوام" : "Duty alert", plan.text, { tag: plan.key, onClick: open });
        }
      } catch {
        /* notices are best-effort; the next tick tries again */
      }
      timer = window.setTimeout(run, Math.max(250, nextDutyTickAt(Date.now(), clock) - Date.now() + 40));
    };
    run();
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, userId, ar]);

  // The header pill's break: re-read on each tick and whenever the row changes.
  const clock = useMemo(() => {
    if (!companyId || !userId) return null;
    try {
      const data = getCompanyData(companyId);
      return breakClockOf(dutyContextOf({ data, user: currentUser, attendance: attendanceNow(), now }), now);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, userId, now, cloudRow]);

  return { clock };
}
