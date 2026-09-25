import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Logo from "@/components/Logo";

const W = 1920;
const H = 1080;
const FONT = "'IBM Plex Sans Arabic', sans-serif";
const FONT_LATIN = "'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif";

const TONES = {
  navy: { background: "var(--nv-navy, #14284B)", color: "#FFFFFF" },
  light: { background: "var(--nv-soft, #F7F8FA)", color: "var(--nv-ink, #14284B)" },
  white: { background: "var(--nv-card, #FFFFFF)", color: "var(--nv-ink, #14284B)" },
};

function SlideShell({ children, tone = "light", style = {}, ar }) {
  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        width: W,
        height: H,
        boxSizing: "border-box",
        padding: "100px 100px 80px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: FONT,
        ...TONES[tone],
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SlideCover({ slide, ar }) {
  return (
    <SlideShell tone="navy" ar={ar} style={{ justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <Logo size={72} />
        <span
          style={{
            fontFamily: FONT_LATIN,
            fontSize: 40,
            fontWeight: 600,
            letterSpacing: "-0.01em",
          }}
        >
          NiroVera
        </span>
      </div>
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 104,
            fontWeight: 600,
            lineHeight: 1.15,
            letterSpacing: "-0.03em",
            maxWidth: 1400,
            textWrap: "pretty",
          }}
        >
          {ar ? slide.titleAr : slide.titleEn}
        </h1>
        <p
          style={{
            margin: "40px 0 0",
            fontSize: 44,
            fontWeight: 300,
            color: "#94A3B8",
            maxWidth: 1200,
            lineHeight: 1.5,
          }}
        >
          {ar ? slide.subAr : slide.subEn}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 28,
          fontSize: 28,
          color: "#64748B",
        }}
      >
        <span>{ar ? "عرض تعريفي" : "Sales briefing"}</span>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#1E9E63",
            flexShrink: 0,
          }}
          aria-hidden
        />
        <span>{ar ? "أغسطس 2026" : "August 2026"}</span>
      </div>
    </SlideShell>
  );
}

function SlideDivider({ slide, ar }) {
  return (
    <SlideShell tone="navy" ar={ar} style={{ justifyContent: "center" }}>
      <span
        dir="ltr"
        style={{
          fontFamily: FONT_LATIN,
          fontSize: 32,
          fontWeight: 600,
          color: "#1E9E63",
          letterSpacing: "0.14em",
        }}
      >
        {slide.chapter}
      </span>
      <h1
        style={{
          margin: "28px 0 0",
          fontSize: 120,
          fontWeight: 600,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {ar ? slide.titleAr : slide.titleEn}
      </h1>
    </SlideShell>
  );
}

function SlideProblem({ slide, ar }) {
  return (
    <SlideShell tone="light" ar={ar}>
      <h1
        style={{
          margin: 0,
          fontSize: 72,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {ar ? slide.titleAr : slide.titleEn}
      </h1>
      <p
        style={{
          margin: "28px 0 0",
          fontSize: 34,
          color: "#5A6B85",
          maxWidth: 1200,
          lineHeight: 1.6,
        }}
      >
        {ar ? slide.subAr : slide.subEn}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 32,
          marginTop: 80,
        }}
      >
        {slide.stats.map((stat) => {
          const unit = ar ? stat.unitAr : stat.unitEn;
          return (
            <div
              key={stat.bodyEn}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E2E8F0",
                borderRadius: 20,
                padding: 44,
              }}
            >
              <div
                dir="ltr"
                style={{
                  fontFamily: FONT_LATIN,
                  fontSize: 96,
                  fontWeight: 600,
                  lineHeight: 1,
                  color: stat.tone === "danger" ? "#DC2626" : "#14284B",
                }}
              >
                {stat.value}
                {unit ? (
                  <span
                    style={{
                      fontSize: 44,
                      fontWeight: 400,
                      color: "#5A6B85",
                      paddingRight: 10,
                    }}
                  >
                    {unit}
                  </span>
                ) : null}
              </div>
              <p
                style={{
                  margin: "24px 0 0",
                  fontSize: 32,
                  lineHeight: 1.5,
                  color: "#14284B",
                }}
              >
                {ar ? stat.bodyAr : stat.bodyEn}
              </p>
            </div>
          );
        })}
      </div>
    </SlideShell>
  );
}

function SlideCost({ slide, ar }) {
  return (
    <SlideShell tone="white" ar={ar}>
      <h1
        style={{
          margin: 0,
          fontSize: 72,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {ar ? slide.titleAr : slide.titleEn}
      </h1>
      <div
        style={{
          display: "flex",
          gap: 80,
          marginTop: 72,
          alignItems: "flex-start",
        }}
      >
        <div style={{ flex: 1 }}>
          {slide.items.map((item, i) => (
            <div
              key={item.titleEn}
              style={{
                borderTop: i === 0 ? "2px solid #14284B" : "1px solid #E2E8F0",
                paddingTop: 32,
                marginTop: i === 0 ? 0 : 40,
              }}
            >
              <div style={{ fontSize: 34, fontWeight: 600 }}>
                {ar ? item.titleAr : item.titleEn}
              </div>
              <p
                style={{
                  margin: "16px 0 0",
                  fontSize: 30,
                  color: "#5A6B85",
                  lineHeight: 1.6,
                }}
              >
                {ar ? item.bodyAr : item.bodyEn}
              </p>
            </div>
          ))}
        </div>
        <aside
          style={{
            width: 620,
            flexShrink: 0,
            background: "#14284B",
            borderRadius: 20,
            padding: 56,
            color: "#FFFFFF",
          }}
        >
          <div
            style={{
              fontSize: 28,
              color: "#1E9E63",
              fontWeight: 600,
              letterSpacing: "0.1em",
            }}
          >
            {ar ? "المحصلة" : "OUTCOME"}
          </div>
          <p
            style={{
              margin: "32px 0 0",
              fontSize: 40,
              lineHeight: 1.55,
              fontWeight: 300,
            }}
          >
            {ar ? slide.outcomeAr : slide.outcomeEn}
          </p>
        </aside>
      </div>
    </SlideShell>
  );
}

function SlideCommand({ slide, ar }) {
  return (
    <SlideShell tone="light" ar={ar}>
      <h1
        style={{
          margin: 0,
          fontSize: 72,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {ar ? slide.titleAr : slide.titleEn}
      </h1>
      <p
        style={{
          margin: "28px 0 0",
          fontSize: 34,
          color: "#5A6B85",
          maxWidth: 1300,
          lineHeight: 1.6,
        }}
      >
        {ar ? slide.subAr : slide.subEn}
      </p>
      <div
        style={{
          display: "flex",
          gap: 36,
          marginTop: 64,
          alignItems: "stretch",
        }}
      >
        <div
          style={{
            width: 520,
            flexShrink: 0,
            background: "#14284B",
            borderRadius: 20,
            padding: 52,
            color: "#FFFFFF",
          }}
        >
          <div
            style={{
              fontSize: 26,
              letterSpacing: "0.1em",
              color: "#6EE7B7",
              fontWeight: 600,
            }}
          >
            {ar ? slide.scoreHintAr : slide.scoreHintEn}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              gap: 16,
              marginTop: 28,
            }}
          >
            <span
              dir="ltr"
              style={{
                fontFamily: FONT_LATIN,
                fontSize: 140,
                fontWeight: 600,
                lineHeight: 1,
                letterSpacing: "-0.04em",
              }}
            >
              {slide.score}
            </span>
            <span dir="ltr" style={{ fontSize: 40, color: "#64748B" }}>
              /100
            </span>
          </div>
          <p
            style={{
              margin: "32px 0 0",
              fontSize: 28,
              color: "#94A3B8",
              lineHeight: 1.6,
            }}
          >
            {ar ? slide.scoreBodyAr : slide.scoreBodyEn}
          </p>
        </div>
        <div
          style={{
            flex: 1,
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: 20,
            padding: 52,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 36,
          }}
        >
          {slide.queue.map((item, i) => (
            <React.Fragment key={item.titleEn}>
              {i > 0 ? (
                <div style={{ height: 1, background: "#E2E8F0" }} />
              ) : null}
              <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    background: item.severity === "danger" ? "#DC2626" : "#F59E0B",
                    flexShrink: 0,
                  }}
                  aria-hidden
                />
                <span style={{ flex: 1, fontSize: 34, fontWeight: 500 }}>
                  {ar ? item.titleAr : item.titleEn}
                </span>
                <span style={{ fontSize: 28, color: "#5A6B85" }}>
                  {ar ? item.metaAr : item.metaEn}
                </span>
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>
    </SlideShell>
  );
}

function SlideModules({ slide, ar }) {
  return (
    <SlideShell tone="white" ar={ar}>
      <h1
        style={{
          margin: 0,
          fontSize: 72,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {ar ? slide.titleAr : slide.titleEn}
      </h1>
      <p
        style={{
          margin: "28px 0 0",
          fontSize: 34,
          color: "#5A6B85",
          maxWidth: 1300,
          lineHeight: 1.6,
        }}
      >
        {ar ? slide.subAr : slide.subEn}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 18,
          marginTop: 56,
        }}
      >
        {slide.modules.map((mod) => (
          <div
            key={mod.en}
            style={{
              background: mod.featured ? "var(--nv-navy)" : "var(--nv-inset)",
              border: mod.featured ? "1px solid var(--nv-navy)" : "1px solid var(--nv-line)",
              borderRadius: 14,
              padding: "26px 22px",
              fontSize: 27,
              fontWeight: 500,
              color: mod.featured ? "#FFFFFF" : "var(--nv-ink)",
            }}
          >
            {ar ? mod.ar : mod.en}
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function SlideAssistant({ slide, ar }) {
  return (
    <SlideShell tone="light" ar={ar}>
      <h1
        style={{
          margin: 0,
          fontSize: 72,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {ar ? slide.titleAr : slide.titleEn}
      </h1>
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 20,
          padding: 56,
          marginTop: 56,
        }}
      >
        <div
          style={{
            fontSize: 28,
            color: "#5A6B85",
            fontWeight: 600,
            letterSpacing: "0.08em",
          }}
        >
          {ar ? "السؤال" : "QUESTION"}
        </div>
        <p
          style={{
            margin: "20px 0 0",
            fontSize: 44,
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          {ar ? slide.questionAr : slide.questionEn}
        </p>
        <div style={{ height: 1, background: "#E2E8F0", margin: "40px 0" }} />
        <p
          style={{
            margin: 0,
            fontSize: 34,
            lineHeight: 1.7,
            color: "#334155",
            maxWidth: 1500,
          }}
        >
          {ar ? slide.answerAr : slide.answerEn}
        </p>
        <div style={{ display: "flex", gap: 24, marginTop: 44 }}>
          {slide.metrics.map((m) => (
            <div
              key={m.labelEn}
              style={{
                flex: 1,
                background: "#F7F8FA",
                border: "1px solid #E2E8F0",
                borderRadius: 16,
                padding: 32,
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  color: "#5A6B85",
                  letterSpacing: "0.08em",
                }}
              >
                {ar ? m.labelAr : m.labelEn}
              </div>
              <div
                dir="ltr"
                style={{
                  fontFamily: FONT_LATIN,
                  fontSize: 48,
                  fontWeight: 600,
                  marginTop: 14,
                  textAlign: ar ? "right" : "left",
                }}
              >
                {m.value}
              </div>
            </div>
          ))}
          <div
            style={{
              flex: 1.4,
              background: "#1E9E63",
              borderRadius: 16,
              padding: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontSize: 32,
              fontWeight: 600,
              textAlign: "center",
            }}
          >
            {ar ? slide.actionAr : slide.actionEn}
          </div>
        </div>
      </div>
    </SlideShell>
  );
}

function SlideSafety({ slide, ar }) {
  return (
    <SlideShell tone="white" ar={ar}>
      <h1
        style={{
          margin: 0,
          fontSize: 72,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {ar ? slide.titleAr : slide.titleEn}
      </h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 32,
          marginTop: 72,
        }}
      >
        {slide.pillars.map((p) => (
          <div
            key={p.titleEn}
            style={{ borderTop: "2px solid #1E9E63", paddingTop: 36 }}
          >
            <div style={{ fontSize: 38, fontWeight: 600 }}>
              {ar ? p.titleAr : p.titleEn}
            </div>
            <p
              style={{
                margin: "20px 0 0",
                fontSize: 30,
                color: "#5A6B85",
                lineHeight: 1.65,
              }}
            >
              {ar ? p.bodyAr : p.bodyEn}
            </p>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: "auto",
          display: "flex",
          alignItems: "center",
          gap: 40,
          background: "#F7F8FA",
          borderRadius: 20,
          padding: 48,
        }}
      >
        <div
          dir="ltr"
          style={{
            fontFamily: FONT_LATIN,
            fontSize: 96,
            fontWeight: 600,
            lineHeight: 1,
            color: "#1E9E63",
          }}
        >
          {slide.streak}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 34,
            color: "#14284B",
            lineHeight: 1.5,
          }}
        >
          {ar ? slide.streakAr : slide.streakEn}
        </p>
      </div>
    </SlideShell>
  );
}

function SlideCompare({ slide, ar }) {
  return (
    <SlideShell tone="light" ar={ar}>
      <h1
        style={{
          margin: 0,
          fontSize: 72,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {ar ? slide.titleAr : slide.titleEn}
      </h1>
      <div
        style={{
          marginTop: 64,
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: 20,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            background: "#14284B",
            color: "#FFFFFF",
          }}
        >
          <div style={{ padding: "32px 40px", fontSize: 30, fontWeight: 600 }}>
            {ar ? "المعيار" : "Criterion"}
          </div>
          <div
            style={{
              padding: "32px 40px",
              fontSize: 30,
              fontWeight: 600,
              color: "#94A3B8",
            }}
          >
            {ar ? "نظام موارد تقليدي" : "Traditional"}
          </div>
          <div
            style={{
              padding: "32px 40px",
              fontSize: 30,
              fontWeight: 600,
              color: "#6EE7B7",
            }}
          >
            NiroVera
          </div>
        </div>
        {slide.rows.map((row, i) => (
          <div
            key={row.criterionEn}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              borderBottom:
                i < slide.rows.length - 1 ? "1px solid #E2E8F0" : "none",
            }}
          >
            <div
              style={{
                padding: "34px 40px",
                fontSize: 30,
                fontWeight: 500,
              }}
            >
              {ar ? row.criterionAr : row.criterionEn}
            </div>
            <div
              style={{
                padding: "34px 40px",
                fontSize: 30,
                color: "#5A6B85",
              }}
            >
              {ar ? row.otherAr : row.otherEn}
            </div>
            <div
              style={{
                padding: "34px 40px",
                fontSize: 30,
                color: "#14284B",
                fontWeight: 500,
              }}
            >
              {ar ? row.oursAr : row.oursEn}
            </div>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function SlideRoi({ slide, ar }) {
  return (
    <SlideShell tone="navy" ar={ar}>
      <h1
        style={{
          margin: 0,
          fontSize: 72,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {ar ? slide.titleAr : slide.titleEn}
      </h1>
      <p
        style={{
          margin: "28px 0 0",
          fontSize: 32,
          color: "#94A3B8",
          maxWidth: 1300,
          lineHeight: 1.6,
        }}
      >
        {ar ? slide.subAr : slide.subEn}
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 48,
          marginTop: "auto",
        }}
      >
        {slide.figures.map((fig) => (
          <div key={fig.value}>
            <div
              dir="ltr"
              style={{
                fontFamily: FONT_LATIN,
                fontSize: 130,
                fontWeight: 600,
                lineHeight: 1,
                letterSpacing: "-0.04em",
                color: "#6EE7B7",
                textAlign: ar ? "right" : "left",
              }}
            >
              {fig.value}
            </div>
            <p
              style={{
                margin: "28px 0 0",
                fontSize: 32,
                lineHeight: 1.55,
                color: "#E2E8F0",
              }}
            >
              {ar ? fig.bodyAr : fig.bodyEn}
            </p>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function SlideRollout({ slide, ar }) {
  return (
    <SlideShell tone="white" ar={ar}>
      <h1
        style={{
          margin: 0,
          fontSize: 72,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {ar ? slide.titleAr : slide.titleEn}
      </h1>
      <div
        style={{
          display: "flex",
          gap: 0,
          marginTop: 80,
          alignItems: "stretch",
        }}
      >
        {slide.weeks.map((week, i) => (
          <React.Fragment key={week.weekEn}>
            {i > 0 ? (
              <div style={{ width: 1, background: "#E2E8F0", flexShrink: 0 }} />
            ) : null}
            <div
              style={{
                flex: 1,
                paddingInlineStart: i === 0 ? 0 : 48,
                paddingInlineEnd: i === slide.weeks.length - 1 ? 0 : 48,
              }}
            >
              <div
                style={{
                  fontFamily: FONT_LATIN,
                  fontSize: 28,
                  fontWeight: 600,
                  color: "#1E9E63",
                  letterSpacing: "0.1em",
                }}
              >
                {ar ? week.weekAr : week.weekEn}
              </div>
              <div style={{ fontSize: 42, fontWeight: 600, marginTop: 20 }}>
                {ar ? week.titleAr : week.titleEn}
              </div>
              <p
                style={{
                  margin: "20px 0 0",
                  fontSize: 30,
                  color: "#5A6B85",
                  lineHeight: 1.65,
                }}
              >
                {ar ? week.bodyAr : week.bodyEn}
              </p>
            </div>
          </React.Fragment>
        ))}
      </div>
      <div
        style={{
          marginTop: "auto",
          background: "#F7F8FA",
          borderRadius: 20,
          padding: "44px 48px",
          fontSize: 32,
          color: "#14284B",
          lineHeight: 1.55,
        }}
      >
        {ar ? slide.footnoteAr : slide.footnoteEn}
      </div>
    </SlideShell>
  );
}

function SlidePlans({ slide, ar }) {
  return (
    <SlideShell tone="light" ar={ar}>
      <h1
        style={{
          margin: 0,
          fontSize: 72,
          fontWeight: 600,
          letterSpacing: "-0.02em",
        }}
      >
        {ar ? slide.titleAr : slide.titleEn}
      </h1>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 32,
          marginTop: 72,
          flex: 1,
        }}
      >
        {slide.plans.map((plan) => (
          <div
            key={plan.nameEn}
            style={{
              background: plan.featured ? "var(--nv-navy)" : "var(--nv-card)",
              border: plan.featured ? "1px solid var(--nv-navy)" : "1px solid var(--nv-line)",
              borderRadius: 20,
              padding: 48,
              display: "flex",
              flexDirection: "column",
              color: plan.featured ? "#FFFFFF" : "var(--nv-ink)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 38, fontWeight: 600 }}>
                {ar ? plan.nameAr : plan.nameEn}
              </span>
              {plan.featured && (ar ? plan.badgeAr : plan.badgeEn) ? (
                <span
                  style={{
                    fontSize: 26,
                    background: "#1E9E63",
                    borderRadius: 20,
                    padding: "6px 16px",
                    fontWeight: 600,
                    color: "#FFFFFF",
                  }}
                >
                  {ar ? plan.badgeAr : plan.badgeEn}
                </span>
              ) : null}
            </div>
            <div
              style={{
                marginTop: 24,
                display: "flex",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              {plan.priceNum ? (
                <>
                  <span
                    dir="ltr"
                    style={{
                      fontFamily: FONT_LATIN,
                      fontSize: 72,
                      fontWeight: 600,
                      lineHeight: 1,
                    }}
                  >
                    {plan.priceNum}
                  </span>
                  <span
                    style={{
                      fontSize: 28,
                      color: plan.featured ? "#94A3B8" : "var(--nv-muted)",
                    }}
                  >
                    {ar ? plan.priceUnitAr : plan.priceUnitEn}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 52, fontWeight: 600, lineHeight: 1 }}>
                  {ar ? plan.priceLabelAr : plan.priceLabelEn}
                </span>
              )}
            </div>
            <p
              style={{
                margin: "32px 0 0",
                fontSize: 30,
                color: plan.featured ? "#CBD5E1" : "var(--nv-muted)",
                lineHeight: 1.65,
              }}
            >
              {ar ? plan.bodyAr : plan.bodyEn}
            </p>
          </div>
        ))}
      </div>
    </SlideShell>
  );
}

function SlideClose({ slide, ar }) {
  return (
    <SlideShell tone="navy" ar={ar} style={{ justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
        <Logo size={60} />
        <span
          style={{
            fontFamily: FONT_LATIN,
            fontSize: 34,
            fontWeight: 600,
          }}
        >
          NiroVera
        </span>
      </div>
      <div>
        <h1
          style={{
            margin: 0,
            fontSize: 88,
            fontWeight: 600,
            letterSpacing: "-0.03em",
            lineHeight: 1.2,
            maxWidth: 1400,
            textWrap: "pretty",
          }}
        >
          {ar ? slide.titleAr : slide.titleEn}
        </h1>
        <p
          style={{
            margin: "36px 0 0",
            fontSize: 38,
            color: "#94A3B8",
            maxWidth: 1200,
            lineHeight: 1.5,
          }}
        >
          {ar ? slide.subAr : slide.subEn}
        </p>
      </div>
      <div
        style={{
          display: "flex",
          gap: 64,
          fontSize: 30,
          color: "#CBD5E1",
        }}
      >
        <span>{ar ? slide.contactNameAr : slide.contactNameEn}</span>
        <span dir="ltr">{slide.email}</span>
        <span dir="ltr">{slide.phone}</span>
      </div>
    </SlideShell>
  );
}

const RENDERERS = {
  cover: SlideCover,
  divider: SlideDivider,
  problem: SlideProblem,
  cost: SlideCost,
  command: SlideCommand,
  modules: SlideModules,
  assistant: SlideAssistant,
  safety: SlideSafety,
  compare: SlideCompare,
  roi: SlideRoi,
  rollout: SlideRollout,
  plans: SlidePlans,
  close: SlideClose,
};

export default function SalesDeckStage({ slides, index, ar }) {
  const slide = slides[index];
  const Renderer = RENDERERS[slide.kind] || SlideCover;
  const containerRef = React.useRef(null);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w <= 0 || h <= 0) return;
      setScale(Math.min(w / W, h / H));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        background: "#0B1220",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: W,
          height: H,
          flexShrink: 0,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            style={{ width: W, height: H }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <Renderer slide={slide} ar={ar} />
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
