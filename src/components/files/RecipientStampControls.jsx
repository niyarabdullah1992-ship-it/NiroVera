import React from "react";
import { BORDER, CARD, MUTED, NAVY, SURFACE, field } from "@/lib/platformStyles";
import { STAMP_ACCENTS, STAMP_DESIGNS, STAMP_INKS, STAMP_MARK_COLORS, STAMP_NAME_FONTS, STAMP_PAPERS } from "@/lib/stampStudio";
import { signKicker } from "@/components/files/signingUi";
import StampHandMark from "@/components/files/StampHandMark";

function Swatches({ options, value, onPick, onFree, ar }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {options.map((option) => {
        const on = String(value || "").toUpperCase() === option.hex.toUpperCase();
        return (
          <button
            key={option.hex}
            type="button"
            title={ar ? option.name : option.en}
            aria-label={ar ? option.name : option.en}
            onClick={() => onPick(option.hex)}
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: option.hex,
              border: `2.5px solid ${on ? NAVY : CARD}`,
              boxShadow: `0 0 0 1px ${BORDER}`,
              cursor: "pointer",
              padding: 0,
            }}
          />
        );
      })}
      {onFree ? (
        <label
          title={ar ? "لون مخصص" : "Custom colour"}
          style={{
            display: "inline-flex",
            alignItems: "center",
            width: 22,
            height: 22,
            borderRadius: "50%",
            background: value || "#14284B",
            boxShadow: `0 0 0 1px ${BORDER}`,
            cursor: "pointer",
            overflow: "hidden",
          }}
        >
          <input
            type="color"
            value={value || "#14284B"}
            onChange={(event) => onFree(event.target.value)}
            style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}
          />
        </label>
      ) : null}
    </div>
  );
}

export default function RecipientStampControls({ ar, config, onPatch }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={signKicker}>{ar ? "شكل الختم — نفس الاستوديو" : "Seal shape — same studio"}</span>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
        {STAMP_DESIGNS.map((item) => {
          const on = config.design === item.id;
          const wide = item.w / item.h;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onPatch({ design: item.id })}
              title={ar ? item.ar : item.en}
              style={{
                fontFamily: "inherit",
                fontSize: 10,
                padding: "8px 4px 6px",
                borderRadius: 8,
                border: `1.5px solid ${on ? NAVY : BORDER}`,
                background: on ? SURFACE : CARD,
                color: NAVY,
                fontWeight: on ? 600 : 400,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ width: 36, height: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span
                  style={{
                    width: wide >= 1 ? 32 : Math.max(12, 22 * wide),
                    height: wide >= 1 ? Math.max(10, 32 / wide) : 22,
                    background: on ? config.paper : CARD,
                    border: `1.5px solid ${on ? config.accent : "#C7CCD6"}`,
                    borderRadius: item.id === "seal" ? "50%" : item.id === "line" ? 0 : 4,
                    clipPath: item.id === "hex" ? "polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%)" : "none",
                    display: "block",
                    boxSizing: "border-box",
                  }}
                />
              </span>
              {ar ? item.ar : item.en}
            </button>
          );
        })}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "grid", gap: 5 }}>
          <span style={{ fontSize: 11, color: MUTED }}>{ar ? "لون التمييز" : "Accent"}</span>
          <Swatches options={STAMP_ACCENTS} value={config.accent} onPick={(hex) => onPatch({ accent: hex })} ar={ar} />
        </div>
        <div style={{ display: "grid", gap: 5 }}>
          <span style={{ fontSize: 11, color: MUTED }}>{ar ? "لون النص" : "Ink"}</span>
          <Swatches options={STAMP_INKS} value={config.ink} onPick={(hex) => onPatch({ ink: hex })} ar={ar} />
        </div>
        <div style={{ display: "grid", gap: 5 }}>
          <span style={{ fontSize: 11, color: MUTED }}>{ar ? "الخلفية" : "Paper"}</span>
          <Swatches options={STAMP_PAPERS} value={config.paper} onPick={(hex) => onPatch({ paper: hex })} ar={ar} />
        </div>
        <div style={{ display: "grid", gap: 5 }}>
          <span style={{ fontSize: 11, color: MUTED }}>{ar ? "لون خط اليد" : "Handwriting colour"}</span>
          <Swatches
            options={STAMP_MARK_COLORS}
            value={config.markColor || ""}
            onPick={(hex) => onPatch({ markColor: hex })}
            onFree={(hex) => onPatch({ markColor: hex })}
            ar={ar}
          />
        </div>
      </div>

      <label style={{ display: "grid", gap: 5 }}>
        <span style={{ fontSize: 11, color: MUTED }}>{ar ? "الاسم على الختم" : "Name on the seal"}</span>
        <input
          value={config.name || ""}
          onChange={(event) => onPatch({ name: event.target.value })}
          dir="auto"
          placeholder={ar ? "اكتب اسمك…" : "Type your name…"}
          style={{ ...field, height: 38, background: SURFACE, fontFamily: (STAMP_NAME_FONTS.find((item) => item.id === config.nameFont) || STAMP_NAME_FONTS[1]).family }}
        />
      </label>
      <div style={{ display: "grid", gap: 5 }}>
        <span style={{ fontSize: 11, color: MUTED }}>{ar ? "خط الاسم" : "Name font"}</span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6 }}>
          {STAMP_NAME_FONTS.map((item) => {
            const on = (config.nameFont || "amiri") === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPatch({ nameFont: item.id })}
                style={{
                  fontFamily: item.family,
                  fontSize: 12,
                  padding: "7px 4px",
                  borderRadius: 8,
                  border: `1px solid ${on ? NAVY : BORDER}`,
                  background: on ? SURFACE : CARD,
                  color: NAVY,
                  fontWeight: on ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                {ar ? item.ar : item.en}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <span style={signKicker}>{ar ? "شارة التوقيع — تُدمج في الختم" : "Signature mark — joined into the seal"}</span>
        <StampHandMark
          ar={ar}
          name={config.name}
          markUrl={config.markUrl}
          onMark={(markUrl) => onPatch({ markUrl: markUrl || "" })}
        />
      </div>
    </div>
  );
}
