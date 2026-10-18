import React from "react";
import { Check, Minus } from "lucide-react";

/**
 * One ladder for صوت الموظف and المهام: who held it, who holds it now (and how much of the window
 * is gone), who is next and why, who it has not reached. Same people, same reading, both sections.
 *
 * steps: [{ name, role, state, note }]
 *   state: "passed" | "now" | "ruled" | "next" | "later" | "skipped" | "vacant"
 * window: { pct, label, tone } — shown under the step that holds it now.
 */

const MONO = { fontFamily: "'IBM Plex Mono', monospace", fontVariantNumeric: "tabular-nums", direction: "ltr", unicodeBidi: "isolate" };

const DOT = {
  passed: { bg: "var(--nv-ok-soft)", border: "var(--nv-ok-line)", ink: "var(--nv-ok-ink)" },
  ruled: { bg: "#0F5535", border: "#0F5535", ink: "#fff" },
  now: { bg: "#0B3D27", border: "#0B3D27", ink: "#fff" },
  next: { bg: "var(--nv-card)", border: "#C8A45A", ink: "#8A5A12" },
  later: { bg: "var(--nv-card)", border: "var(--nv-line)", ink: "var(--nv-muted)" },
  skipped: { bg: "var(--nv-soft)", border: "var(--nv-line)", ink: "var(--nv-muted)" },
  vacant: { bg: "#FBF3E1", border: "#EAD6A8", ink: "#8A5A12" },
};

export function splitLabel(label = "") {
  const [name, ...rest] = String(label || "").split(" — ");
  return { name: name || "—", role: rest.join(" — ") };
}

export function defaultNote(state, ar = true) {
  return {
    passed: ar ? "مضت مهلته" : "Window passed",
    ruled: ar ? "قرّر" : "Ruled",
    now: ar ? "عنده الآن" : "With them now",
    next: ar ? "التالي إن مضت المهلة" : "Next if the window passes",
    later: ar ? "لم يبلغه" : "Not reached",
    skipped: ar ? "تخطّاه" : "Skipped",
    vacant: ar ? "مقعد شاغر — يُتخطّى" : "Vacant — skipped",
  }[state] || "";
}

export default function EscalationLadder({ steps = [], window: win = null, ar = true, dataKey }) {
  if (!steps.length) return null;
  const cols = steps.length;
  return (
    <ol
      className="nv-ladder"
      data-ladder={dataKey || "1"}
      style={{ "--nv-ladder-cols": cols, listStyle: "none", margin: 0, padding: 0 }}
    >
      {steps.map((step, i) => {
        const st = DOT[step.state] || DOT.later;
        const hot = step.state === "now";
        const lineDone = i > 0 && ["passed", "now", "ruled", "skipped"].includes(step.state);
        return (
          <li key={`${step.name}-${i}`} className="nv-ladder-step" data-state={step.state} data-step={i}>
            {i > 0 ? <span aria-hidden className="nv-ladder-line" style={{ background: lineDone ? "#0F5535" : "var(--nv-line)" }} /> : null}
            <span
              aria-hidden
              className={hot ? "nv-ladder-dot nv-ladder-hot" : "nv-ladder-dot"}
              style={{ background: st.bg, color: st.ink, border: `${step.state === "vacant" || step.state === "skipped" ? "1.5px dashed" : step.state === "next" ? "2px solid" : "1px solid"} ${st.border}` }}
            >
              {step.state === "passed" || step.state === "ruled" ? <Check size={13} strokeWidth={3} /> : step.state === "skipped" ? <Minus size={12} strokeWidth={3} /> : <span style={{ ...MONO, fontSize: 11, fontWeight: 700 }}>{i + 1}</span>}
            </span>
            <span className="nv-ladder-body">
              <strong style={{ fontSize: 12.5, fontWeight: hot ? 800 : 700, color: step.state === "later" || step.state === "skipped" ? "var(--nv-ink2)" : step.state === "vacant" ? "#8A5A12" : "var(--nv-ink)", lineHeight: 1.4 }}>
                {step.name || "—"}
              </strong>
              {step.role ? <span style={{ fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.4 }}>{step.role}</span> : null}
              <span
                data-ladder-note="1"
                style={{
                  alignSelf: "flex-start",
                  marginTop: 3,
                  fontSize: 10.5,
                  fontWeight: 700,
                  padding: "1px 8px",
                  borderRadius: 999,
                  color: hot ? "var(--nv-ok-ink)" : step.state === "next" ? "#8A5A12" : step.state === "passed" ? "var(--nv-ok-ink)" : "var(--nv-muted)",
                  background: hot ? "var(--nv-ok-soft)" : step.state === "next" ? "#FBF3E1" : "var(--nv-soft)",
                  border: `1px solid ${hot ? "var(--nv-ok-line)" : step.state === "next" ? "#EAD6A8" : "var(--nv-line2, #EEF1EF)"}`,
                }}
              >
                {step.note || defaultNote(step.state, ar)}
              </span>
              {hot && win ? (
                <span data-ladder-window="1" style={{ display: "flex", flexDirection: "column", gap: 3, marginTop: 5, minWidth: 0 }}>
                  <span aria-hidden style={{ display: "block", height: 4, borderRadius: 999, background: "var(--nv-line2, #EEF1EF)", overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: `${Math.max(4, Math.min(100, win.pct || 0))}%`, borderRadius: 999, background: win.tone === "bad" ? "var(--nv-bad-fill)" : win.tone === "ok" ? "#0F5535" : "#C8A45A" }} />
                  </span>
                  {win.label ? <span style={{ fontSize: 10.5, color: win.tone === "bad" ? "var(--nv-bad-ink)" : "var(--nv-muted)", fontWeight: 600 }}>{win.label}</span> : null}
                </span>
              ) : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
