import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  getSession, startLogin, completeLoginOtp, switchUser, clearSession, getCompanyData,
  subscribe, getCompanyMeta, hydrateEmployeesFromEntity, hydrateStationsFromEntity,
  hydrateBlobFromEntity, BLOB_CATEGORIES, getLastLocalWriteAt, fetchCloudVersions, setAuditActor,
  repairOwnerSession, cacheCloudData, googleCompanyLogin, companyAccountExists, ensureLocalCompany,
  sendPresenceHeartbeat,
} from "./store";
import { base44 } from "@/api/base44Client";
import { DEFAULT_SUBSCRIPTION_PLANS, planConfigForName } from "@/lib/subscriptionPlans";
import { isLocalPreviewActive, LOCAL_PREVIEW_COMPANY_ID } from "@/lib/localPreview";

// Skip merging in cloud data if this browser wrote locally very recently —
// gives the in-flight edit a moment to finish syncing before a poll/refresh
// could otherwise overwrite it with a stale server copy (simple conflict guard).
const RECENT_WRITE_GUARD_MS = 4000;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Read the saved session synchronously on first render — otherwise a direct
  // visit to /app redirects logged-in users to the landing page before the
  // first effect has a chance to restore the session.
  const [session, setSession] = useState(() => getSession());
  const [company, setCompany] = useState(() => {
    const s = getSession();
    return s?.companyId ? getCompanyMeta(s.companyId) : null;
  });
  const [data, setData] = useState(() => {
    try {
      const s = getSession();
      return s?.companyId ? getCompanyData(s.companyId) : null;
    } catch (error) {
      console.error("NiroVera company data:", error);
      return null;
    }
  });
  const [tick, setTick] = useState(0); // force refresh on store changes
  const [isSyncing, setIsSyncing] = useState(false); // true while pulling the latest data from the cloud
  const [planConfig, setPlanConfig] = useState(() => {
    const s = getSession();
    const meta = s?.companyId ? getCompanyMeta(s.companyId) : null;
    return planConfigForName(DEFAULT_SUBSCRIPTION_PLANS, meta?.plan || "free");
  });
  const [planLoading, setPlanLoading] = useState(false);
  // Per-collection version stamps from the last successful pull — lets each poll skip
  // downloading collections that haven't changed on the server (delta sync).
  const lastVersionsRef = useRef({});
  const syncInFlightRef = useRef(false);

  useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    const unsub = subscribe(refresh);
    return unsub;
  }, []);

  useEffect(() => {
    if (!company?.plan) { setPlanConfig(planConfigForName(DEFAULT_SUBSCRIPTION_PLANS, "free")); setPlanLoading(false); return; }
    // Local preview: never wait on Base44 plan entities.
    if (isLocalPreviewActive() || company.id === LOCAL_PREVIEW_COMPANY_ID) {
      setPlanConfig(planConfigForName(DEFAULT_SUBSCRIPTION_PLANS, company.plan || "enterprise"));
      setPlanLoading(false);
      return;
    }
    let active = true;
    const applyLocalPlan = () => {
      if (active) setPlanConfig(planConfigForName(DEFAULT_SUBSCRIPTION_PLANS, company.plan));
    };
    const loadPlan = () => base44.entities.SubscriptionPlan.list("sortOrder", 50)
      .then((plans) => {
        if (active) setPlanConfig(planConfigForName(plans.length ? plans : DEFAULT_SUBSCRIPTION_PLANS, company.plan));
      })
      .catch(() => {
        applyLocalPlan();
      })
      .finally(() => { if (active) setPlanLoading(false); });
    setPlanLoading(true); loadPlan();
    let unsubscribe = null;
    try {
      unsubscribe = base44.entities.SubscriptionPlan.subscribe(() => loadPlan());
    } catch {
      applyLocalPlan();
      setPlanLoading(false);
    }
    return () => { active = false; if (typeof unsubscribe === "function") unsubscribe(); };
  }, [company?.plan, company?.id]);

  const refresh = useCallback(() => {
    let s;
    try {
      s = getSession();
    } catch (error) {
      console.error("NiroVera session refresh:", error);
      return;
    }
    setSession(s);
    if (s && s.companyId) {
      try {
      // A saved session with no local workspace (partially cleared storage)
      // previously rendered a blank app — rebuild it so cloud sync refills it.
      if (!getCompanyData(s.companyId)) ensureLocalCompany(s.companyId);
      setCompany(getCompanyMeta(s.companyId));
      const localData = getCompanyData(s.companyId);
      setData(localData);
      // Owner sessions saved without a userId (empty new accounts) render a blank
      // app — create the owner user record and re-save the session once.
      if (!s.userId && localData) {
        repairOwnerSession(s.companyId);
        return;
      }
      // A stale session userId (e.g. saved before the account was restored, or
      // created locally before cloud data arrived) that no longer matches any
      // employee rendered a blank app — re-point the session at the company
      // owner/director from the synced roster.
      if (s.userId && localData) {
        const emps = localData.employees || [];
        if (emps.length > 0 && !emps.some((e) => e.id === s.userId || e.employeeId === s.userId)) {
          const fallback = emps.find((e) => e.id === localData.ownerId) || emps.find((e) => e.role === "director");
          if (fallback) {
            switchUser(fallback.id);
            return;
          }
        }
      }
      // Keep the audit trail attributed to whoever is actually acting in this session.
      const actorName = s.userId ? localData?.employees?.find((e) => e.id === s.userId)?.name : null;
      setAuditActor(actorName || getCompanyMeta(s.companyId)?.ownerEmail || "owner");
      // Local preview workspace is offline-only — never wait on cloud hydration.
      if (isLocalPreviewActive() || s.companyId === LOCAL_PREVIEW_COMPANY_ID) {
        return;
      }
      // Always reconcile with the persisted database (not just on an empty cache) so
      // records created on another device/browser eventually show up here too. Local-only
      // records (not yet synced) are kept as-is; server records are merged in additively.
      if (localData && !syncInFlightRef.current && Date.now() - getLastLocalWriteAt(s.companyId) > RECENT_WRITE_GUARD_MS) {
        syncInFlightRef.current = true;
        // Server records are authoritative for anything already synced (so leave requests,
        // certificates, HR messages, points etc. approved/edited on another device show up
        // here too). Any local record not yet synced (no server copy yet) is kept as-is.
        setIsSyncing(true);
        // Delta sync: one lightweight versions call tells us which collections actually
        // changed on the server — only those get downloaded. If the versions call fails,
        // fall back to hydrating everything (previous behavior).
        fetchCloudVersions(s.companyId).then((versions) => {
          const prev = lastVersionsRef.current[s.companyId] || {};
          const changed = (key) => !versions || versions[key] !== prev[key];
          const hydrationTasks = [];
          if (changed("employees")) hydrationTasks.push(
            hydrateEmployeesFromEntity(s.companyId).then((employees) => {
              if (!employees) return;
              cacheCloudData(s.companyId, { employees });
              setData(getCompanyData(s.companyId));
            })
          );
          if (changed("stations")) hydrationTasks.push(
            hydrateStationsFromEntity(s.companyId).then((stations) => {
              if (!stations) return;
              cacheCloudData(s.companyId, { stations });
              // Always read the merged workspace — raw hydrate used to wipe local managerId edits.
              setData(getCompanyData(s.companyId));
            })
          );
          BLOB_CATEGORIES.forEach((category) => {
            if (!changed("blob:" + category)) return;
            hydrationTasks.push(
              hydrateBlobFromEntity(s.companyId, category).then((records) => {
                if (!records) return;
                cacheCloudData(s.companyId, { [category]: records });
                setData((prevData) => (prevData ? { ...prevData, [category]: records } : prevData));
              })
            );
          });
          if (changed("blob:leaveRoster")) hydrationTasks.push(
            hydrateBlobFromEntity(s.companyId, "leaveRoster").then((records) => {
              if (!records) return;
              cacheCloudData(s.companyId, { leaveRoster: records });
              setData((prevData) => (prevData ? { ...prevData, leaveRoster: records } : prevData));
            })
          );
          // Company-wide settings (name, plan, chat groups, rate limits) — single record, server wins.
          if (changed("blob:companyMeta")) hydrationTasks.push(
            hydrateBlobFromEntity(s.companyId, "companyMeta").then((records) => {
              const meta = records && records[0];
              if (!meta) return;
              const metaEstablishment = String(meta.gosiEstablishment || "").trim();
              const metaUpdates = {
                name: meta.name, plan: meta.plan, directorId: meta.directorId,
                ownerId: meta.ownerId, stationChatGroups: meta.stationChatGroups,
                crossStationChatEnabled: meta.crossStationChatEnabled,
                settings: meta.settings, reportBranding: meta.reportBranding,
                orgStructureLog: Array.isArray(meta.orgStructureLog) ? meta.orgStructureLog : undefined,
                ...(metaEstablishment ? { gosiEstablishment: metaEstablishment } : {}),
              };
              cacheCloudData(s.companyId, Object.fromEntries(Object.entries(metaUpdates).filter(([, value]) => value !== undefined)));
              setData((prevData) => (prevData ? {
                ...prevData,
                name: meta.name ?? prevData.name,
                plan: meta.plan ?? prevData.plan,
                directorId: meta.directorId ?? prevData.directorId,
                ownerId: meta.ownerId ?? prevData.ownerId,
                stationChatGroups: meta.stationChatGroups ?? prevData.stationChatGroups,
                crossStationChatEnabled: meta.crossStationChatEnabled ?? prevData.crossStationChatEnabled,
                settings: meta.settings ?? prevData.settings,
                reportBranding: meta.reportBranding ?? prevData.reportBranding,
                orgStructureLog: Array.isArray(meta.orgStructureLog) ? meta.orgStructureLog : prevData.orgStructureLog,
                gosiEstablishment: String(meta.gosiEstablishment || "").trim() || prevData.gosiEstablishment,
                } : prevData));
            })
          );
          Promise.allSettled(hydrationTasks).then(() => {
            if (versions) lastVersionsRef.current[s.companyId] = versions;
            syncInFlightRef.current = false;
            setIsSyncing(false);
          });
        });
      }
      } catch (error) {
        console.error("NiroVera session refresh:", error);
      }
    } else {
      setCompany(null);
      setData(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, tick]);

  // If the saved session points at a company account that no longer exists on the
  // server (e.g. it was deleted), the app would render blank — sign out instead so
  // the user lands back on the login page.
  useEffect(() => {
    if (!session?.companyId) return;
    companyAccountExists(session.companyId).then((exists) => {
      if (!exists) {
        clearSession();
        refresh();
      }
    });
  }, [session?.companyId, refresh]);

  // Website presence heartbeat — only a visible tab counts as online.
  useEffect(() => {
    if (!session?.companyId) return;
    const beat = () => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) {
        sendPresenceHeartbeat(session.companyId).catch(() => {});
      }
    };
    beat();
    const interval = window.setInterval(beat, 30000);
    window.addEventListener("focus", beat);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", beat); };
  }, [session?.companyId]);

  // Live cross-device sync: periodically pull the latest persisted data while the app stays open,
  // so changes made on another device/browser show up here without needing a manual reload.
  useEffect(() => {
    const poll = () => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) {
        if (session?.companyId) companyAccountExists(session.companyId).finally(refresh);
        else refresh();
      }
    };
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Instant cross-device sync: the backend bumps a tiny SyncSignal record after every
  // write, and this realtime subscription pulls the changes the moment it fires —
  // no waiting for the next poll. Also refreshes when the user returns to the tab.
  useEffect(() => {
    if (!session?.companyId) return;
    let unsubscribe = null;
    try {
      unsubscribe = base44.entities.SyncSignal.subscribe((event) => {
        if (event?.data?.companyId === session.companyId) companyAccountExists(session.companyId).finally(refresh);
      });
    } catch {
      // realtime unavailable — the 10s poll above remains the fallback
    }
    const onVisible = () => { if (document.visibilityState !== "hidden") refresh(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [session?.companyId, refresh]);

  // Step 1 verifies the password and returns an OTP challenge after the server emails the code.
  const login = async (email, password, preferKind) => {
    const r = await startLogin(email, password, preferKind);
    if (r?.company) refresh();
    return r;
  };

  // Step 2: exchanges the emailed code for the real session.
  const verifyOtp = async (pendingId, code, chooseCompanyId) => {
    const c = await completeLoginOtp(pendingId, code, chooseCompanyId);
    if (c) refresh();
    return c;
  };

  const loginWithGoogle = async (preferKind, accountKey) => {
    const company = await googleCompanyLogin(preferKind, accountKey);
    if (company) refresh();
    return company;
  };

  const doSwitchUser = (userId) => {
    switchUser(userId);
    refresh();
  };

  const logout = () => {
    clearSession();
    refresh();
  };

  const currentUser = data && session?.userId
    ? (data.employees || []).find((e) => e.id === session.userId || e.employeeId === session.userId)
    : null;
  const companyWithPlan = useMemo(() => company ? { ...company, planConfig } : company, [company, planConfig]);

  return (
    <AuthContext.Provider
      value={{ session, company: companyWithPlan, data, currentUser, login, loginWithGoogle, verifyOtp, switchUser: doSwitchUser, logout, refresh, tick, isSyncing, planConfig, planLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}