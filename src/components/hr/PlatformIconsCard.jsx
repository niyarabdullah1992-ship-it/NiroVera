import React from "react";
import { ChromeBox } from "@/components/shared/IdentityCard";
import NvIcon, { NV_ICON_LABELS, NV_ICON_NAMES } from "@/components/shared/NvIcon";
import { BORDER, MUTED, NAVY } from "@/lib/platformStyles";

/**
 * «رموز المنصة» — the one icon family, read-only reference. The rights scale comes first: every other
 * glyph is drawn from it (stroke, margins, bowls). Colour is meaning: green for the right / done,
 * amber and red only where the status calls for them.
 */
export default function PlatformIconsCard({ lang = "ar" }) {
  const ar = lang === "ar";
  return (
    <ChromeBox>
      <div style={{ fontSize: "13px", fontWeight: 600, color: NAVY }}>{ar ? "رموز المنصة" : "Platform icons"}</div>
      <p style={{ margin: "6px 0 0", fontSize: "12px", color: MUTED, lineHeight: 1.7, maxWidth: 640 }}>
        {ar
          ? "عائلة خطية واحدة مشتقة من رمز «حقك»: خط واحد بأطراف مستديرة، ولون الحالة معنى لا زينة."
          : "One line family drawn from the «Your right» mark: one stroke, round ends, and status colour as meaning, not decoration."}
      </p>
      <ul
        data-nv-icon-sheet="1"
        style={{ listStyle: "none", margin: "14px 0 0", padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))", gap: 8 }}
      >
        {NV_ICON_NAMES.map((name, index) => (
          <li
            key={name}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: "12px 6px 10px",
              borderRadius: 10,
              border: `1px solid ${index === 0 ? "var(--nv-ok-line)" : BORDER}`,
              background: index === 0 ? "var(--nv-ok-soft)" : "transparent",
              color: index === 0 ? "var(--nv-ok-ink)" : "var(--nv-ink)",
            }}
          >
            <NvIcon name={name} size={22} inline={false} />
            <span style={{ fontSize: 11, color: index === 0 ? "var(--nv-ok-ink)" : MUTED, fontWeight: index === 0 ? 700 : 500, textAlign: "center" }}>
              {ar ? NV_ICON_LABELS[name] : name}
            </span>
          </li>
        ))}
      </ul>
    </ChromeBox>
  );
}
