import React from "react";
import { GitBranch } from "lucide-react";
import RoadmapScorecard from "@/components/owner/RoadmapScorecard";
import RoadmapPhase from "@/components/owner/RoadmapPhase";
import { roadmapPhases, strengths } from "@/lib/powercareRoadmap";
import { OwnerSectionHead, ownerPaper, ownerStack } from "@/components/owner/ownerUi";

export default function PlatformRoadmap({ ar }) {
  const language = ar ? "ar" : "en";
  return (
    <section style={ownerStack}>
      <OwnerSectionHead
        kicker={ar ? "NiroVera 2026 · تحديث يوليو" : "NiroVera 2026 · July update"}
        title={(
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <GitBranch className="h-5 w-5" style={{ color: "var(--nv-accent)" }} />
            {ar ? "خارطة التطور المحدثة" : "Updated development roadmap"}
          </span>
        )}
      />
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "var(--nv-muted)", maxWidth: 720 }}>
        {ar
          ? "عرض محدث لما تم إنجازه، وما نعمل عليه الآن، وخطوات التوسع المؤسسي التالية."
          : "A current view of delivered capabilities, active priorities, and the next stage of enterprise expansion."}
      </p>
      <RoadmapScorecard ar={ar} />
      <div style={{ ...ownerPaper("mute"), padding: 16 }}>
        <h2 className="nv-h" style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "var(--nv-ink)" }}>
          {ar ? "القدرات المتاحة الآن" : "Capabilities available now"}
        </h2>
        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {strengths[language].map((item) => (
            <span
              key={item}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "6px 11px",
                borderRadius: 999,
                border: "1px solid var(--nv-ok-line)",
                background: "var(--nv-ok-soft)",
                color: "var(--nv-ink2)",
              }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {roadmapPhases[language].map((phase) => <RoadmapPhase key={phase.phase} data={phase} />)}
      </div>
      <div style={{ ...ownerPaper("ok"), padding: 14, fontSize: 13, lineHeight: 1.7, color: "var(--nv-ink2)" }}>
        <strong style={{ color: "var(--nv-ink)" }}>{ar ? "التوجه الاستراتيجي: " : "Strategic direction: "}</strong>
        {ar
          ? "نحوّل القدرات التي تم إطلاقها إلى تشغيل مؤسسي موثوق، ثم نوسّع التكاملات والتحليلات الذكية دون إضافة تعقيد غير ضروري."
          : "Turn delivered capabilities into reliable enterprise operations, then expand integrations and intelligent analytics without unnecessary complexity."}
      </div>
    </section>
  );
}
