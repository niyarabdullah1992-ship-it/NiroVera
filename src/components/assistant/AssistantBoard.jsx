import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import { getCompanyToken } from "@/lib/store";
import { allowedNavFor } from "@/lib/navVisibility";
import { checkAskGate } from "@/lib/assistantDerivations";
import { INK, ACCENT, BRAND, MUTED, NAVY, ui, SURFACE, CARD } from "@/lib/platformStyles";
import { toast } from "@/components/ui/use-toast";
import { ChromeBox } from "@/components/shared/IdentityCard";

async function assistantApi(payload) {
  const res = await base44.functions.invoke("assistant", payload);
  return res?.data ?? res;
}

function sectionsFromNav(user, data, company) {
  const routes = [...allowedNavFor(user, data, company)];
  const keys = new Set(["assistant"]);
  routes.forEach((r) => {
    if (r === "/app/assistant") keys.add("assistant");
    if (r === "/app/tasks") keys.add("tasks");
    if (r === "/app/attendance") keys.add("attendance");
    if (r === "/app/safety") keys.add("safety");
    if (r === "/app/performance") keys.add("performance");
    if (r === "/app/payroll") keys.add("payroll");
    if (r === "/app/hr") keys.add("hr");
  });
  return [...keys];
}

export default function AssistantBoard({ lang = "ar", onPickPrompt }) {
  const ar = lang === "ar";
  const { company, currentUser, data } = useAuth();
  const [answer, setAnswer] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [busy, setBusy] = useState(false);
  const [gateHint, setGateHint] = useState(null);

  const actor = currentUser
    ? {
      role: currentUser.role,
      owner: currentUser.role === "owner" || data?.ownerId === currentUser.id,
      admin: currentUser.role === "admin",
      stationId: currentUser.stationId || null,
      allStations: ["owner", "director", "ops_manager", "pgm", "hr_manager", "hr", "admin"].includes(currentUser.role)
        || data?.ownerId === currentUser.id,
      stationIds: currentUser.stationId ? [currentUser.stationId] : [],
    }
    : null;

  const basePayload = () => ({
    companyId: company?.id,
    sessionToken: company?.id ? getCompanyToken(company.id) : undefined,
    planConfig: company?.planConfig || null,
    allowedSections: sectionsFromNav(currentUser, data, company),
    stationIds: actor?.stationIds || [],
  });

  const applyRemote = (remote) => {
    if (remote?.answer) setAnswer(remote.answer);
    if (Array.isArray(remote?.prompts)) setPrompts(remote.prompts);
  };

  const load = async (promptId) => {
    if (!company?.id) return;
    setBusy(true);
    try {
      let remote = await assistantApi({ ...basePayload(), action: "board", promptId });
      if (remote?.empty || !remote?.answer) {
        remote = await assistantApi({ ...basePayload(), action: "seedDemo" });
      }
      if (promptId && remote?.ok !== false) {
        remote = await assistantApi({ ...basePayload(), action: "ask", promptId });
      }
      if (remote?.error) {
        setGateHint(ar ? remote.reason : (remote.reasonEn || remote.error));
        applyRemote({ answer: null, prompts: [] });
      } else {
        setGateHint(null);
        applyRemote(remote);
      }
    } catch {
      setAnswer(null);
      setPrompts([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => { load(); }, [company?.id, currentUser?.id]);

  const pickPrompt = async (p) => {
    const preview = checkAskGate({
      promptId: p.id,
      question: ar ? p.textAr : p.textEn,
      plan: company?.planConfig,
      actor,
      allowedSections: sectionsFromNav(currentUser, data, company),
    });
    if (!preview.ok) {
      setGateHint(ar ? preview.reason : preview.reasonEn);
      toast({ title: ar ? preview.reason : preview.reasonEn, variant: "destructive" });
      return;
    }
    if (typeof onPickPrompt === "function") {
      onPickPrompt(ar ? p.textAr : p.textEn);
    }
    await load(p.id);
  };

  if (!company?.id) return null;

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }} dir={ar ? "rtl" : "ltr"}>
      {gateHint && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--nv-bad-ink)", border: "1px solid var(--nv-bad-line)", background: "var(--nv-bad-soft)", borderRadius: 10, padding: "10px 12px" }}>
          {gateHint}
        </p>
      )}

      {answer && (
        <ChromeBox>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <Sparkles className="h-4 w-4" style={{ color: ACCENT }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{ar ? answer.questionAr : answer.questionEn}</span>
            {busy && <Loader2 className="h-4 w-4 animate-spin" style={{ color: MUTED, marginInlineStart: "auto" }} />}
          </div>
          <div style={{ fontSize: 13, color: INK, lineHeight: 1.75 }}>
            {ar ? answer.answerAr : answer.answerEn}
          </div>
          {(answer.evidence || []).length > 0 && (
            <div className="nv-kpi-strip" style={{ marginTop: 12, border: "1px solid var(--nv-line)", borderRadius: 12, overflow: "hidden" }}>
              {(answer.evidence || []).map((e, i) => (
                <div key={i} style={{ padding: "10px 14px", minWidth: 0, background: SURFACE }}>
                  <div style={{ fontSize: 10, color: MUTED }}>{ar ? e.sourceAr : e.sourceEn}</div>
                  <div dir="ltr" style={{ fontSize: 18, fontWeight: 600, fontFamily: "'IBM Plex Sans',sans-serif", marginTop: 4, color: NAVY }}>
                    {e.value}
                  </div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{ar ? e.labelAr : e.labelEn}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {(answer.goOps || answer.goSafety) && (
              <Link to={answer.goSafety || answer.goOps} style={{ ...ui.btnPrimary, textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                {ar ? answer.primaryActionAr : answer.primaryActionEn}
              </Link>
            )}
            <button
              type="button"
              style={{ ...ui.btnSecondary }}
              onClick={() => toast({ description: ar ? answer.secondaryActionAr : answer.secondaryActionEn })}
            >
              {ar ? answer.secondaryActionAr : answer.secondaryActionEn}
            </button>
          </div>
        </ChromeBox>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {prompts.map((p) => {
          const active = answer?.promptId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              disabled={busy || p.allowed === false}
              onClick={() => pickPrompt(p)}
              title={p.allowed === false ? (ar ? "لا صلاحية" : "Not allowed") : undefined}
              style={{
                padding: "7px 12px",
                borderRadius: 9,
                border: active ? `1px solid ${BRAND}` : "1px solid var(--nv-line)",
                background: active ? "var(--nv-accent-soft)" : CARD,
                color: active ? "var(--nv-ok-ink)" : NAVY,
                fontSize: 12,
                fontWeight: 500,
                cursor: "pointer",
                fontFamily: "inherit",
                opacity: busy || p.allowed === false ? 0.45 : 1,
              }}
            >
              {ar ? p.textAr : p.textEn}
            </button>
          );
        })}
      </div>
    </div>
  );
}
