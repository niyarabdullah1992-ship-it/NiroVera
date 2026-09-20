import React from "react";
import { MapPin, ChevronLeft, ChevronRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { BORDER, MUTED, NAVY, CARD } from "@/lib/platformStyles";
import { identityIconWrap } from "@/components/shared/IdentityCard";

export default function StationFilesCard({ station, count, onOpen }) {
  const { lang, dir } = useI18n();
  const Chevron = dir === "rtl" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: "flex",
        width: "100%",
        alignItems: "center",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 14,
        boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)",
        border: `1px solid ${BORDER}`,
        background: CARD,
        textAlign: "start",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      <span style={identityIconWrap}>
        <MapPin style={{ width: 16, height: 16 }} strokeWidth={1.75} />
      </span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13, fontWeight: 600, color: NAVY }} dir="auto">
          {station.name}
        </span>
        <span style={{ display: "block", marginTop: 3, fontSize: 11, color: MUTED }}>
          {count} {lang === "ar" ? "عنصر" : "items"}
        </span>
      </span>
      <Chevron style={{ width: 16, height: 16, color: MUTED, flexShrink: 0 }} />
    </button>
  );
}
