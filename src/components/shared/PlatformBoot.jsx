import React from "react";
import Logo from "@/components/Logo";
import { useI18n } from "@/lib/i18n";
import { BORDER, CARD, INK, MUTED, NAVY_FILL, STAGE, SURFACE } from "@/lib/platformStyles";

/**
 * Institutional boot — no spinner, no greeting.
 * full: public / first paint card.
 * shell: session exists — same chrome as /app so the rail does not jump in.
 * interior: lazy section inside the live shell.
 */
export default function PlatformBoot({ variant = "full" }) {
  const { lang } = useI18n();
  const ar = lang !== "en";
  const interior = variant === "interior";
  const shell = variant === "shell";
  const title = interior
    ? (ar ? "جارٍ فتح القسم" : "Opening the section")
    : (ar ? "جارٍ فتح المنصة" : "Opening the platform");
  const hint = ar
    ? "حضور ثم مهمة ثم توقيع — الأرقام تُشتقّ من السجل."
    : "Attendance, then task, then sign — figures are derived from the record.";

  const copy = (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, textAlign: "start" }}>
      {shell || interior ? null : (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 28,
              height: 28,
              background: CARD,
              border: `1px solid ${BORDER}`,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Logo size={18} wordmark={false} />
          </span>
          <span style={{ fontSize: 11, letterSpacing: "0.12em", color: MUTED, fontFamily: "'IBM Plex Mono', monospace" }}>
            NIROVERA
          </span>
        </div>
      )}
      <h1 style={{ margin: 0, fontSize: interior || shell ? 18 : 20, fontWeight: 650, letterSpacing: "-0.02em", color: INK }}>
        {title}
      </h1>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: MUTED, maxWidth: 420 }}>{hint}</p>
      <span className="nv-boot-bar" aria-hidden />
    </div>
  );

  const stamp = (
    <div style={{ width: "100%", maxWidth: 1280, margin: "0 auto" }}>
      <section
        data-nv="stamp"
        style={{
          display: "flex",
          flexDirection: "column",
          border: `1px solid ${BORDER}`,
          background: STAGE,
        }}
      >
        <header style={{ background: CARD, padding: "16px 18px", borderBottom: `1px solid ${BORDER}` }}>
          {copy}
        </header>
        <div style={{ minHeight: interior ? 160 : 220 }} />
      </section>
    </div>
  );

  if (interior) {
    return (
      <div dir={ar ? "rtl" : "ltr"} role="status" aria-live="polite" aria-busy="true">
        {stamp}
      </div>
    );
  }

  if (shell) {
    return (
      <div
        className="powercare-shell"
        dir={ar ? "rtl" : "ltr"}
        role="status"
        aria-live="polite"
        aria-busy="true"
        style={{ display: "flex", height: "100dvh", maxHeight: "100dvh", overflow: "hidden" }}
      >
        <aside
          aria-hidden
          className="corporate-sidebar nv-suite-rail hidden md:flex"
          style={{
            width: 188,
            flexShrink: 0,
            flexDirection: "column",
            background: CARD,
            borderInlineEnd: `1px solid ${BORDER}`,
          }}
        >
          <div
            style={{
              height: 52,
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "0 12px",
              background: NAVY_FILL,
              color: "#fff",
              flexShrink: 0,
            }}
          >
            <span style={{ width: 26, height: 26, background: "var(--nv-card)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <Logo size={18} wordmark={false} />
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              <span style={{ fontSize: 12, fontWeight: 700 }}>NiroVera</span>
              <span style={{ fontSize: 10, color: "#C7D2E4" }}>PowerCare</span>
            </span>
          </div>
          <div style={{ flex: 1, background: CARD }} />
        </aside>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", background: SURFACE }}>
          <header style={{ height: 52, flexShrink: 0, background: CARD, borderBottom: `1px solid ${BORDER}` }} />
          <div className="platform-main-scroll" style={{ flex: 1, minHeight: 0, overflow: "auto", padding: 20 }}>
            {stamp}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      role="status"
      aria-live="polite"
      aria-busy="true"
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: SURFACE,
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          background: CARD,
          border: `1px solid ${BORDER}`,
          padding: "22px 22px 20px",
        }}
      >
        {copy}
      </div>
    </div>
  );
}
