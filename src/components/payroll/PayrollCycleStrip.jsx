import React from "react";
import { Check, GitBranch } from "lucide-react";
import { ACCENT, BORDER, MUTED, NAVY, SURFACE, CARD } from "@/lib/platformStyles";
import { payrollCycleState } from "@/lib/payrollDerivations";
import IdentityCard from "@/components/shared/IdentityCard";

const LABELS = {
  prepare: { ar: "تجهيز المسير", en: "Prepare the run", arHint: "من ملف الموظف والحضور", enHint: "From profiles and attendance" },
  review: { ar: "مراجعة البنود", en: "Review lines", arHint: "المادة 92 و93 و107", enHint: "Articles 92, 93 and 107" },
  approve: { ar: "اعتماد المسير", en: "Approve the run", arHint: "بوابة بأسماء الأسباب", enHint: "Named blocking reasons" },
  protect: { ar: "حماية الأجور", en: "Wage protection", arHint: "ملف مدى — خلال 30 يوماً", enHint: "Mudad file — within 30 days" },
};

export default function PayrollCycleStrip({
  ar,
  hasRun,
  heads,
  issueCount,
  status,
  wpsLate,
  activeTab,
  onOpenTab,
}) {
  const cycle = payrollCycleState({ hasRun, heads, issueCount, status, wpsLate });

  return (
    <IdentityCard
      icon={GitBranch}
      kicker={ar ? "الدورة النظامية" : "Statutory cycle"}
      title={ar ? "مسير الأجور الشهري" : "Monthly wage run"}
      subtitle={ar
        ? "حضور معتمد → بند خصم موثّق → صافٍ → ملف مدى جاهز. الإرسال الحي عند الاعتماد."
        : "Approved attendance → documented deduction → net → Mudad file ready. Live send when credentials are approved."}
      dir={ar ? "rtl" : "ltr"}
      bodySurface
    >
      <div style={{ display: "flex", alignItems: "stretch", gap: 8, flexWrap: "wrap" }}>
        {cycle.steps.map((step, index) => {
          const copy = LABELS[step.key];
          const current = cycle.currentKey === step.key;
          const selected = current || (activeTab === step.tab && step.key === "protect" && activeTab === "wps");
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => onOpenTab(step.tab)}
              style={{
                flex: "1 1 160px",
                minWidth: 148,
                display: "flex",
                alignItems: "flex-start",
                gap: 8,
                minHeight: 40,
                textAlign: "start",
                padding: "8px 10px 8px 8px",
                borderRadius: 10,
                border: `1px solid ${selected || step.done ? "color-mix(in oklab, #14284B 22%, #fff)" : BORDER}`,
                background: selected || step.done ? CARD : SURFACE,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: selected ? `inset 3px 0 0 ${NAVY}` : "none",
              }}
            >
              <span style={{
                width: 22,
                height: 22,
                borderRadius: 7,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: step.done ? ACCENT : CARD,
                color: step.done ? "#fff" : NAVY,
                border: step.done ? "none" : `1px solid ${BORDER}`,
                fontSize: 11,
                fontWeight: 700,
              }}
              >
                {step.done ? <Check style={{ width: 12, height: 12 }} strokeWidth={2.4} /> : index + 1}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: NAVY }}>
                  {ar ? copy.ar : copy.en}
                </span>
                <span style={{ display: "block", marginTop: 2, fontSize: 10, fontWeight: 600, color: step.warn ? "#B45309" : MUTED, lineHeight: 1.45 }}>
                  {step.warn
                    ? (ar ? "المهلة النظامية تجاوزت" : "Past the statutory deadline")
                    : (ar ? copy.arHint : copy.enHint)}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </IdentityCard>
  );
}
