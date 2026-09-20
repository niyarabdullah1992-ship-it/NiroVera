import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  designSystemCatalog,
  docFrame,
  dsDegree,
  DS_STATES,
  DS_TOKEN_KEYS,
  stateChip,
} from "@/lib/designSystem";
import { BORDER, CARD, INK, MUTED, SURFACE, navPill, pillRail } from "@/lib/platformStyles";
import { ChromeBox } from "@/components/shared/IdentityCard";

const TABS = [
  { id: "rules", num: "01", ar: "قواعد الشكل", en: "Form rules" },
  { id: "behave", num: "02", ar: "قاعدتا السلوك", en: "Behaviour" },
  { id: "surfaces", num: "03", ar: "الأسطح", en: "Surfaces" },
];

function RuleCard({ num, title, body, no, demo }) {
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))",
        border: `1px solid ${BORDER}`,
        background: CARD,
        borderRadius: 14,
        boxShadow: "0 1px 2px var(--nv-shadow2), 0 10px 26px var(--nv-shadow)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
          <span dir="ltr" style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: MUTED }}>{num}</span>
          <span className="nv-h" style={{ fontSize: 17, fontWeight: 700, color: INK }}>{title}</span>
        </span>
        <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.95 }}>{body}</span>
        <span
          style={{
            fontSize: 11.5,
            color: dsDegree("blocked", "ink"),
            background: dsDegree("blocked", "soft"),
            border: `1px solid ${dsDegree("blocked", "line")}`,
            padding: "9px 11px",
            borderRadius: 10,
            lineHeight: 1.9,
          }}
        >
          {no}
        </span>
      </div>
      <div style={{ padding: "16px 18px", background: SURFACE, display: "flex", flexDirection: "column", gap: 9 }}>
        <span style={{ fontSize: 10.5, letterSpacing: "0.1em", color: MUTED }}>{demo.label}</span>
        {demo.body}
      </div>
    </section>
  );
}

export default function DesignSystemBoard({ ar = true }) {
  const [tab, setTab] = useState("rules");
  const catalog = designSystemCatalog({ ar });

  return (
    <ChromeBox>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
            <span style={{ fontSize: 11, letterSpacing: "0.14em", color: MUTED, display: "flex", gap: 7, alignItems: "center" }}>
              <span dir="ltr" style={{ fontFamily: "var(--font-mono)" }}>00</span>
              <span>·</span>
              <span>{ar ? "المرجع" : "Reference"}</span>
            </span>
            <span className="nv-h" style={{ fontSize: 24, fontWeight: 700, color: INK }}>{catalog.title}</span>
            <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.85, maxWidth: 760 }}>{catalog.lede}</span>
          </div>
          <span style={stateChip("settled", { padding: "8px 13px", fontSize: 11.5 })}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: dsDegree("settled", "fill"), marginInlineEnd: 8 }} />
            {catalog.appliedIn}
          </span>
        </div>

        <div style={pillRail}>
          {TABS.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setTab(row.id)}
              style={navPill(tab === row.id)}
            >
              <span dir="ltr" style={{ fontFamily: "var(--font-mono)", fontSize: 10, opacity: 0.8 }}>{row.num}</span>
              {ar ? row.ar : row.en}
            </button>
          ))}
        </div>

        {tab === "rules" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <RuleCard
              num="01"
              title={ar ? catalog.form[0].ar : catalog.form[0].en}
              body={ar ? catalog.form[0].dAr : catalog.form[0].dEn}
              no={ar ? catalog.form[0].noAr : catalog.form[0].noEn}
              demo={{
                label: ar ? "النموذج" : "Model",
                body: (
                  <div style={{ ...docFrame("waiting"), overflow: "hidden" }}>
                    <span style={{ display: "block", padding: "10px 13px", borderBottom: `1px solid ${BORDER}`, fontSize: 12.5, fontWeight: 700 }}>
                      {ar ? "بطاقة بحالة واحدة" : "One-state card"}
                    </span>
                    <span style={{ display: "block", padding: "10px 13px", fontSize: 11, color: "var(--nv-ink2)", lineHeight: 1.85 }}>
                      {ar ? "حدّ هيكل رقيق، وشريط 3px على الحرف البادئ يحمل الحالة." : "A thin structure edge, and a 3px start mark carries status."}
                    </span>
                  </div>
                ),
              }}
            />
            <RuleCard
              num="02"
              title={ar ? catalog.form[1].ar : catalog.form[1].en}
              body={ar ? catalog.form[1].dAr : catalog.form[1].dEn}
              no={ar ? catalog.form[1].noAr : catalog.form[1].noEn}
              demo={{
                label: ar ? "النموذج" : "Model",
                body: (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
                    {Object.values(DS_STATES).map((row) => (
                      <span key={row.id} style={{ ...docFrame(row.id), padding: "10px 12px", display: "flex", flexDirection: "column", gap: 5 }}>
                        <span style={stateChip(row.id)}>{ar ? row.ar : row.en}</span>
                        <span style={{ fontSize: 10.5, color: "var(--nv-ink2)", lineHeight: 1.75 }}>{ar ? row.jobAr : row.jobEn}</span>
                      </span>
                    ))}
                  </div>
                ),
              }}
            />
            <RuleCard
              num="03"
              title={ar ? catalog.form[2].ar : catalog.form[2].en}
              body={ar ? catalog.form[2].dAr : catalog.form[2].dEn}
              no={ar ? catalog.form[2].noAr : catalog.form[2].noEn}
              demo={{
                label: ar ? "النموذج" : "Model",
                body: (
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {[
                      { k: "ink", ar: "نصّ وأزرار", en: "Text and buttons", demo: <span style={{ fontSize: 11.5, fontWeight: 700, color: dsDegree("settled", "ink") }}>{ar ? "نصّ أخضر" : "Green text"}</span> },
                      { k: "soft", ar: "خلفية وسم", en: "Chip wash", demo: <span style={stateChip("settled")}>{ar ? "وسم خفيف" : "Soft chip"}</span> },
                      { k: "fill", ar: "أشرطة ونقاط", en: "Bars and dots", demo: (
                        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: dsDegree("settled", "fill") }} />
                          <span style={{ height: 6, width: 78, background: dsDegree("settled", "fill") }} />
                          <span style={{ fontSize: 10, color: MUTED }}>{ar ? "بلا نصّ فوقه" : "No text on it"}</span>
                        </span>
                      ) },
                    ].map((row) => (
                      <span key={row.k} style={{ display: "grid", gridTemplateColumns: "72px minmax(0,1fr) auto", gap: 10, alignItems: "center", background: CARD, border: `1px solid ${BORDER}`, padding: "9px 11px" }}>
                        <span dir="ltr" style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, fontWeight: 600, color: "var(--nv-ink2)" }}>{row.k}</span>
                        <span>{row.demo}</span>
                        <span style={{ fontSize: 10, color: MUTED, whiteSpace: "nowrap" }}>{ar ? row.ar : row.en}</span>
                      </span>
                    ))}
                  </div>
                ),
              }}
            />
            <RuleCard
              num="04"
              title={ar ? catalog.form[3].ar : catalog.form[3].en}
              body={ar ? catalog.form[3].dAr : catalog.form[3].dEn}
              no={ar ? catalog.form[3].noAr : catalog.form[3].noEn}
              demo={{
                label: ar ? "النموذج" : "Model",
                body: (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(50%,116px),1fr))", gap: 1, background: BORDER, border: `1px solid ${BORDER}` }}>
                    {DS_TOKEN_KEYS.map((key) => (
                      <span key={key} style={{ background: CARD, padding: "9px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                        <span style={{ height: 18, background: `var(${key})`, border: `1px solid ${BORDER}` }} />
                        <span dir="ltr" style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--nv-ink2)", wordBreak: "break-all" }}>{key}</span>
                      </span>
                    ))}
                  </div>
                ),
              }}
            />
            <RuleCard
              num="05"
              title={ar ? catalog.form[4].ar : catalog.form[4].en}
              body={ar ? catalog.form[4].dAr : catalog.form[4].dEn}
              no={ar ? catalog.form[4].noAr : catalog.form[4].noEn}
              demo={{
                label: ar ? "النموذج" : "Model",
                body: (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {catalog.typeRows.map((row) => (
                      <span key={row.id} style={{ background: CARD, border: `1px solid ${BORDER}`, padding: "10px 12px", display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center" }}>
                        <span style={row.style}>{ar ? row.ar : row.en}</span>
                        <span dir="ltr" style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: MUTED, whiteSpace: "nowrap" }}>{row.spec}</span>
                      </span>
                    ))}
                  </div>
                ),
              }}
            />
            <RuleCard
              num="06"
              title={ar ? catalog.form[5].ar : catalog.form[5].en}
              body={ar ? catalog.form[5].dAr : catalog.form[5].dEn}
              no={ar ? catalog.form[5].noAr : catalog.form[5].noEn}
              demo={{
                label: ar ? "النموذج" : "Model",
                body: (
                  <span style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.85 }}>
                    {ar ? "الرموز من خريطة التنقّل الحيّة — وزن واحد في الصفحة." : "Glyphs come from the live nav map — one weight on the page."}
                  </span>
                ),
              }}
            />
          </div>
        ) : null}

        {tab === "behave" ? (
          <section style={{ border: `1px solid ${BORDER}`, background: CARD }}>
            <div style={{ padding: "15px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 3 }}>
              <span className="nv-h" style={{ fontSize: 17, fontWeight: 700 }}>{ar ? "قاعدتان في السلوك" : "Two behaviour rules"}</span>
              <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.85 }}>
                {ar ? "هما ما يفرّق هذا النظام عن قوالب ERP: الرقم يُشتقّ، والمنع يعلن سببه." : "This is what separates the system from an ERP skin: the figure is derived, and a hold names its reason."}
              </span>
            </div>
            {catalog.behave.map((row) => (
              <div key={row.id} style={{ padding: "15px 20px", borderBottom: `1px solid ${BORDER}`, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))", gap: 16 }}>
                <span style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 700 }}>{ar ? row.ar : row.en}</span>
                  <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.95 }}>{ar ? row.dAr : row.dEn}</span>
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <span style={{ ...stateChip("settled"), padding: "9px 11px", fontWeight: 600, fontSize: 11, whiteSpace: "normal", lineHeight: 1.85 }}>
                    {ar ? row.okAr : row.okEn}
                  </span>
                  <span style={{ ...stateChip("blocked"), padding: "9px 11px", fontWeight: 600, fontSize: 11, whiteSpace: "normal", lineHeight: 1.85 }}>
                    {ar ? row.badAr : row.badEn}
                  </span>
                </span>
              </div>
            ))}
          </section>
        ) : null}

        {tab === "surfaces" ? (
          <section style={{ border: `1px solid ${BORDER}`, background: CARD }}>
            <div style={{ padding: "15px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
              <span className="nv-h" style={{ fontSize: 17, fontWeight: 700 }}>{ar ? "الأسطح المطبِّقة" : "Surfaces that apply it"}</span>
              <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
                {ar ? "لكل سطح عمل واحد وقسمان: ما يراه الموظف وما تديره الإدارة." : "One job per surface, and two sides: what the worker sees and what management runs."}
              </span>
            </div>
            {catalog.surfaces.map((row) => (
              <Link
                key={row.href}
                to={row.href}
                style={{
                  padding: "12px 20px",
                  borderBottom: `1px solid ${BORDER}`,
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) auto auto",
                  gap: 13,
                  alignItems: "center",
                  textDecoration: "none",
                  color: INK,
                }}
              >
                <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{ar ? row.ar : row.en}</span>
                  <span style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.75 }}>{ar ? row.jobAr : row.jobEn}</span>
                </span>
                <span style={{ fontSize: 10, color: "var(--nv-ink2)", background: SURFACE, border: `1px solid ${BORDER}`, padding: "2px 9px", whiteSpace: "nowrap" }}>
                  {ar ? row.empAr : row.empEn}
                </span>
                <span style={stateChip("settled")}>{ar ? row.mgrAr : row.mgrEn}</span>
              </Link>
            ))}
          </section>
        ) : null}
      </div>
    </ChromeBox>
  );
}
