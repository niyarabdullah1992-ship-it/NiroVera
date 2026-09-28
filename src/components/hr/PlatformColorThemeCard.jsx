import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import { ChromeBox } from "@/components/shared/IdentityCard";
import { ACCENT, BORDER, CARD, INK, MUTED, NAVY, SURFACE, field, ui } from "@/lib/platformStyles";
import {
  PLATFORM_THEMES,
  DEFAULT_THEME,
  THEME_CHANGE_EVENT,
  applyStoredPlatformTheme,
  canEditPlatformTheme,
  isHexColor,
  normalizeTheme,
  persistPlatformTheme,
  publishPlatformTheme,
  readStoredTheme,
} from "@/lib/platformTheme";

async function themeApi(payload) {
  const res = await base44.functions.invoke("settings", payload);
  return res?.data ?? res;
}

export default function PlatformColorThemeCard({ lang = "ar" }) {
  const ar = lang === "ar";
  const { company, data, currentUser } = useAuth();
  const canEdit = canEditPlatformTheme(currentUser, data);
  const [theme, setTheme] = useState(() => readStoredTheme(company?.id));
  const [hint, setHint] = useState("");
  const remoteTimer = useRef(null);

  useEffect(() => {
    const next = applyStoredPlatformTheme(company?.id);
    setTheme(next);
    return () => {
      if (remoteTimer.current) window.clearTimeout(remoteTimer.current);
    };
  }, [company?.id]);

  useEffect(() => {
    const onChange = (event) => {
      if (event?.detail) setTheme(normalizeTheme(event.detail));
    };
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  }, []);

  const save = (nextInput) => {
    const next = publishPlatformTheme(nextInput, company?.id);
    setTheme(next);
    if (!canEdit || !company?.id) return;
    if (remoteTimer.current) window.clearTimeout(remoteTimer.current);
    remoteTimer.current = window.setTimeout(async () => {
      try {
        const remote = await themeApi({
          action: "setColorTheme",
          companyId: company.id,
          colorTheme: next,
        });
        if (remote?.colorTheme) {
          const saved = persistPlatformTheme(remote.colorTheme, company.id);
          applyStoredPlatformTheme(company.id);
          setTheme(saved);
        }
        setHint(ar ? "حُفظت ألوان المنصة لهذه الشركة." : "Platform colors saved for this company.");
      } catch {
        setHint(ar
          ? "طُبّقت الألوان على هذا الجهاز. تعذّر المزامنة مع الشركة الآن."
          : "Colors applied on this device. Company sync is unavailable right now.");
      }
    }, 400);
  };

  const pickPreset = (preset) => {
    if (!canEdit) return;
    save(preset);
  };

  const pickCustom = (key, value) => {
    if (!canEdit || !isHexColor(value)) return;
    save({ id: "custom", navy: key === "navy" ? value : theme.navy, accent: key === "accent" ? value : theme.accent });
  };

  return (
    <ChromeBox>
      <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>
        {ar ? "ألوان المنصة" : "Platform colors"}
      </div>
      <p style={{ margin: "6px 0 0", fontSize: "12px", color: MUTED, lineHeight: 1.7, maxWidth: 640 }}>
        {ar
          ? "لوحة رسمية واحدة: أساس أخضر ولون تمييز واحد. وضعية الليل من الشريط العلوي، والحضور والغياب يبقيان أخضر وأحمر."
          : "One official palette: a green base and a single accent. Night mode stays on the header control, and present/absent stay green and red."}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(148px, 1fr))",
          gap: 10,
          marginTop: 16,
        }}
      >
        {PLATFORM_THEMES.map((preset) => {
          const selected = theme.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={!canEdit}
              onClick={() => pickPreset(preset)}
              aria-pressed={selected}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                padding: "12px 12px 11px",
                borderRadius: 12,
                border: selected ? "1px solid var(--nv-accent-border)" : `1px solid ${BORDER}`,
                background: selected ? "var(--nv-accent-soft)" : CARD,
                cursor: canEdit ? "pointer" : "default",
                textAlign: "start",
                fontFamily: "inherit",
                opacity: canEdit ? 1 : 0.92,
              }}
            >
              <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ width: 22, height: 22, borderRadius: 7, background: preset.navy, flexShrink: 0 }} />
                <span style={{ width: 22, height: 22, borderRadius: 7, background: preset.accent, flexShrink: 0 }} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>
                {ar ? preset.labelAr : preset.labelEn}
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: 12,
          marginTop: 16,
        }}
      >
        {[
          { key: "navy", label: ar ? "الأساس" : "Base", value: theme.navy },
          { key: "accent", label: ar ? "التمييز" : "Accent", value: theme.accent },
        ].map((item) => (
          <label key={item.key} style={{ display: "block" }}>
            <span style={{ display: "block", fontSize: 11, color: MUTED, marginBottom: 6 }}>{item.label}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="color"
                value={item.value}
                disabled={!canEdit}
                onChange={(event) => pickCustom(item.key, event.target.value)}
                style={{
                  width: 42,
                  height: 36,
                  padding: 0,
                  border: `1px solid ${BORDER}`,
                  borderRadius: 9,
                  background: CARD,
                  cursor: canEdit ? "pointer" : "default",
                }}
              />
              <input
                dir="ltr"
                value={item.value}
                disabled={!canEdit}
                onChange={(event) => pickCustom(item.key, event.target.value)}
                style={{ ...field, fontFamily: "'IBM Plex Sans', monospace" }}
              />
            </span>
          </label>
        ))}
      </div>

      <div
        aria-hidden
        style={{
          marginTop: 16,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          overflow: "hidden",
          background: SURFACE,
        }}
      >
        <div style={{ height: 3, background: "var(--nv-navy)" }} />
        <div style={{ display: "flex", alignItems: "stretch", minHeight: 88 }}>
          <div style={{ width: 88, padding: 10, background: CARD, borderInlineEnd: `1px solid ${BORDER}` }}>
            <div style={{ height: 8, borderRadius: 4, background: "var(--nv-navy)", marginBottom: 8 }} />
            <div style={{ height: 22, borderRadius: 7, background: "var(--nv-accent-soft)", border: "1px solid var(--nv-accent-border)" }} />
          </div>
          <div style={{ flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: INK }}>
              {ar ? "معاينة مباشرة" : "Live preview"}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span style={{ ...ui.btnPrimary, pointerEvents: "none" }}>
                {ar ? "إجراء رئيسي" : "Primary action"}
              </span>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                height: 28,
                padding: "0 10px",
                borderRadius: 8,
                background: CARD,
                border: `1px solid ${BORDER}`,
                color: MUTED,
                fontSize: 11,
              }}>
                {ar ? "تبويب" : "Tab"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 14 }}>
        {canEdit ? (
          <button type="button" onClick={() => save(DEFAULT_THEME)} style={ui.btnGhost}>
            {ar ? "أعد ألوان نيرافيرا" : "Reset to NiroVera"}
          </button>
        ) : (
          <span style={{ fontSize: 11, color: MUTED }}>
            {ar
              ? "يحدد المالك أو المدير أو العمليات ألوان الشركة. أنت ترى اللوحة الحالية."
              : "The owner, director, or operations sets company colors. You are viewing the current palette."}
          </span>
        )}
        {hint ? <span style={{ fontSize: 11, color: ACCENT }}>{hint}</span> : null}
      </div>
    </ChromeBox>
  );
}
