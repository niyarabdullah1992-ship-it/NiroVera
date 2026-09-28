import React, { useMemo, useState } from "react";

const NAVY = "var(--nv-navy)";
const LINE = "var(--nv-line)";
const MUTED = "var(--nv-muted)";
const INK = "var(--nv-ink)";

const STEPS = [
  { id: 1, ar: "الموقّعون والحقول", en: "Signers and fields" },
  { id: 2, ar: "التوقيع", en: "Signing" },
  { id: 3, ar: "حقول", en: "Fields" },
];

function RailIcon({ name }) {
  const common = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" };
  if (name === "summary") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h10" />
      </svg>
    );
  }
  if (name === "pages") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M7 3h8l4 4v14H7z" />
        <path d="M15 3v4h4" />
      </svg>
    );
  }
  if (name === "download") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M12 4v10" />
        <path d="M8 10l4 4 4-4" />
        <path d="M5 19h14" />
      </svg>
    );
  }
  if (name === "print") {
    return (
      <svg {...common} aria-hidden="true">
        <path d="M7 8V4h10v4" />
        <path d="M6 16H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
        <path d="M7 14h10v6H7z" />
      </svg>
    );
  }
  if (name === "in") {
    return (
      <svg {...common} aria-hidden="true">
        <circle cx="11" cy="11" r="6" />
        <path d="M15.5 15.5L20 20M11 8v6M8 11h6" />
      </svg>
    );
  }
  return (
    <svg {...common} aria-hidden="true">
      <circle cx="11" cy="11" r="6" />
      <path d="M15.5 15.5L20 20M8 11h6" />
    </svg>
  );
}

const RAIL_LINE = "var(--nv-line)";

function railCell(on) {
  return {
    fontFamily: "inherit",
    boxSizing: "border-box",
    width: "100%",
    height: 40,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 6,
    padding: "0 8px",
    border: on ? `1px solid ${NAVY}` : `1px solid ${RAIL_LINE}`,
    borderRadius: 10,
    background: on ? NAVY : "var(--nv-card)",
    color: on ? "#fff" : MUTED,
    fontSize: 12,
    fontWeight: 600,
    lineHeight: 1.2,
    cursor: "pointer",
    textAlign: "start",
  };
}

function RailGlyph({ name, on }) {
  return (
    <span style={{ width: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", flex: "none", color: on ? "#fff" : NAVY }}>
      <RailIcon name={name} />
    </span>
  );
}

/**
 * Sender studio chrome from the inner signing screens: navy steps, field hint, icon rail.
 * The document and the tool column are passed in so placement stays on the live PDF.
 */
export default function SigningStudioFrame({
  ar,
  title,
  envelopeId,
  pageLabel,
  step = 1,
  fieldCount = 0,
  nextLabel,
  onBack,
  onStep,
  onNext,
  onAutoPlace,
  autoPlaceBusy,
  signers = [],
  signerIndex = 0,
  onPickSigner,
  onAddSigners,
  people = [],
  peopleQuery = "",
  onPeopleQuery,
  onAddPerson,
  rail,
  onRail,
  zoom = 1,
  onZoom,
  onDownload,
  onPrint,
  note,
  error,
  toolbarExtra,
  thumbs,
  panel,
  children,
}) {
  const [addOpen, setAddOpen] = useState(false);
  const needle = String(peopleQuery || "").trim().toLowerCase();
  const shownPeople = useMemo(
    () => (people || []).filter((person) => !needle || `${person.name || ""} ${person.title || ""} ${person.code || ""} ${person.email || ""}`.toLowerCase().includes(needle)).slice(0, 8),
    [people, needle],
  );
  const fieldsStep = step === 1;
  return (
    <div dir={ar ? "rtl" : "ltr"} className="nv-sign-workshop nv-sign-studio" style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", height: "100dvh", background: "var(--nv-page)", overflow: "hidden", color: INK, fontSize: 13 }}>
      <header style={{ background: NAVY, color: "#fff", height: 56, padding: "0 18px", display: "flex", alignItems: "center", gap: 14, flex: "none" }}>
        <button type="button" onClick={onBack} style={{ fontFamily: "inherit", border: "none", background: "transparent", color: "#C5DBCD", cursor: "pointer", fontSize: 12, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 2px", whiteSpace: "nowrap" }}>
          <span aria-hidden="true">{ar ? "→" : "←"}</span>
          {ar ? "العودة إلى التوقيع" : "Back to signing"}
        </button>
        <span style={{ width: 1, height: 26, background: "rgba(255,255,255,.18)", flex: "none" }} />
        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1, lineHeight: 1.4 }}>
          <strong style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</strong>
          <span style={{ fontSize: 10.5, color: "#C5DBCD", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {pageLabel ? <span>{pageLabel} · </span> : null}
            {ar ? "مظروف " : "Envelope "}
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", unicodeBidi: "isolate", color: "#A9CDB8" }}>{envelopeId}</span>
          </span>
        </div>
        <ol style={{ listStyle: "none", display: "flex", alignItems: "center", gap: 0, margin: 0, padding: 0, flex: "none" }}>
          {STEPS.map((item, index) => {
            const on = step === item.id;
            return (
              <li key={item.id} style={{ display: "flex", alignItems: "center" }}>
                {index > 0 ? <span aria-hidden="true" style={{ width: 18, height: 1, background: "rgba(255,255,255,.3)", margin: "0 6px" }} /> : null}
                <button type="button" onClick={() => onStep?.(item.id)} style={{ fontFamily: "inherit", border: "none", background: "transparent", color: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: on ? 700 : 500, padding: 0, opacity: on ? 1 : 0.72 }}>
                  <span style={{ width: 18, height: 18, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, background: on ? "#fff" : "transparent", color: on ? NAVY : "#fff", border: on ? "none" : "1px solid rgba(255,255,255,.35)" }}>{item.id}</span>
                  {ar ? item.ar : item.en}
                </button>
              </li>
            );
          })}
        </ol>
        <span style={{ fontSize: 11, color: "#C5DBCD", whiteSpace: "nowrap", flex: "none" }}>
          <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: "#fff" }}>{fieldCount}</span>
          {ar ? " حقول" : " fields"}
        </span>
        <button type="button" onClick={onNext} style={{ fontFamily: "inherit", height: 36, padding: "0 16px", borderRadius: 10, border: "1px solid rgba(255,255,255,.35)", background: "transparent", color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer", whiteSpace: "nowrap", flex: "none" }}>
          {nextLabel}
        </button>
      </header>

      {fieldsStep ? (
      <div style={{ background: "var(--nv-card)", borderBottom: `1px solid ${LINE}`, height: 48, padding: "0 18px", display: "flex", alignItems: "center", gap: 8, flex: "none", minWidth: 0 }}>
        <span style={{ fontSize: 11.5, color: MUTED, fontWeight: 600, whiteSpace: "nowrap" }}>{ar ? "الحقول لـ:" : "Fields for:"}</span>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", minWidth: 0, maxWidth: "50%" }}>
          {signers.map((signer, index) => {
            const on = signerIndex === index;
            return (
              <button key={signer.key || index} type="button" onClick={() => onPickSigner?.(index)} style={{ fontFamily: "inherit", height: 30, padding: "0 10px", borderRadius: 4, border: `1px solid ${on ? NAVY : LINE}`, background: on ? "var(--nv-accent-soft)" : "var(--nv-card)", color: INK, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap", flex: "none" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: signer.color || "var(--nv-ok-ink)", flex: "none" }} />
                <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{signer.name || (ar ? "موقّع" : "Signer")}</span>
              </button>
            );
          })}
        </div>
        <div style={{ position: "relative", flex: "none" }}>
          <button type="button" onClick={() => setAddOpen((value) => !value)} style={{ fontFamily: "inherit", height: 30, padding: "0 12px", borderRadius: 4, border: "1px dashed var(--nv-line)", background: "var(--nv-card)", color: INK, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            ＋ {ar ? "إضافة موقّعين" : "Add signers"}
          </button>
          {addOpen ? (
            <div style={{ position: "absolute", top: 36, insetInlineStart: 0, zIndex: 30, width: "min(340px, 90vw)", boxSizing: "border-box", background: "var(--nv-card)", border: `1px solid ${LINE}`, borderRadius: 6, boxShadow: "0 14px 36px rgba(20,33,61,.18)", padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 10.5, letterSpacing: ".08em", color: NAVY, fontWeight: 700 }}>{ar ? "من المنشأة — اختر واحداً أو أكثر" : "From the company"}</span>
              <input value={peopleQuery} onChange={(event) => onPeopleQuery?.(event.target.value)} placeholder={ar ? "⌕ ابحث بالاسم أو الصفة أو الرقم الوظيفي" : "Search name, title, or number"} style={{ height: 32, padding: "0 10px", borderRadius: 4, border: `1px solid ${LINE}`, fontSize: 12, color: INK, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" }} />
              <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 196, overflowY: "auto" }}>
                {shownPeople.length ? shownPeople.map((person) => (
                  <button key={person.id || person.email} type="button" onClick={() => onAddPerson?.(person)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", border: 0, background: "transparent", cursor: "pointer", textAlign: "start", fontFamily: "inherit", color: INK }}>
                    <span style={{ width: 16, height: 16, borderRadius: 3, border: `1px solid ${LINE}`, flex: "none" }} />
                    <span style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
                      <strong style={{ fontSize: 12 }}>{person.name}</strong>
                      <span style={{ fontSize: 10.5, color: MUTED }}>{[person.title, person.code].filter(Boolean).join(" · ") || person.email}</span>
                    </span>
                  </button>
                )) : (
                  <span style={{ fontSize: 11, color: MUTED, padding: "6px 4px" }}>{ar ? "لا موظفون مطابقون." : "No matching employees."}</span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => { setAddOpen(false); onAddSigners?.(); }} style={{ flex: 1, height: 34, borderRadius: 4, border: 0, background: NAVY, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{ar ? "موقّع خارجي" : "External signer"}</button>
                <button type="button" onClick={() => setAddOpen(false)} style={{ height: 34, padding: "0 14px", borderRadius: 4, border: `1px solid ${LINE}`, background: "var(--nv-card)", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{ar ? "إلغاء" : "Cancel"}</button>
              </div>
            </div>
          ) : null}
        </div>
        <span style={{ flex: 1, minWidth: 12, fontSize: 11, color: MUTED, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textAlign: "center" }}>
          {ar ? "اسحب «التوقيع» أو اضغط على الصفحة لوضعه" : "Drag a signature or click the page to place it"}
        </span>
        <button type="button" onClick={onAutoPlace} disabled={autoPlaceBusy} style={{ fontFamily: "inherit", height: 30, padding: "0 12px", borderRadius: 4, border: `1px solid ${LINE}`, background: "var(--nv-card)", color: INK, fontSize: 12, cursor: autoPlaceBusy ? "wait" : "pointer", whiteSpace: "nowrap", opacity: autoPlaceBusy ? 0.6 : 1 }}>
          {autoPlaceBusy ? (ar ? "جارٍ الوضع…" : "Placing…") : (ar ? "وضع الحقول تلقائياً" : "Place fields automatically")}
        </button>
      </div>
      ) : null}

      {toolbarExtra}
      {note ? <p style={{ margin: 0, padding: "6px 14px", background: "var(--nv-accent-soft)", color: "var(--nv-ok-ink)", fontSize: 12 }}>{note}</p> : null}
      {error ? <p style={{ margin: 0, padding: "6px 14px", background: "var(--nv-bad-soft)", color: "var(--nv-bad-ink)", fontSize: 12 }}>{error}</p> : null}

      <div className="nv-sign-body" style={{ flex: 1, minHeight: 0, display: "flex", background: "var(--nv-page)" }}>
        <aside className="nv-sign-panel" style={{ width: 300, flex: "none", background: "var(--nv-soft)", borderInlineEnd: `1px solid ${LINE}`, overflow: "auto", minHeight: 0 }}>
          {panel}
        </aside>
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex" }}>
          <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 24, padding: "28px 16px 60px", position: "relative" }}>
            {children}
          </div>
          {thumbs}
        </main>
        <nav className="nv-sign-rail" aria-label={ar ? "أدوات المستند" : "Document tools"} style={{ width: 156, flex: "none", alignSelf: "stretch", background: "var(--nv-card)", borderInlineStart: `1px solid ${LINE}`, display: "flex", flexDirection: "column", alignItems: "stretch", justifyContent: "flex-start", gap: 12, padding: 8, boxSizing: "border-box" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button type="button" style={railCell(rail === "summary")} aria-pressed={rail === "summary"} onClick={() => onRail?.("summary")}>
              <RailGlyph name="summary" on={rail === "summary"} />
              <span style={{ minWidth: 0, whiteSpace: "nowrap" }}>{ar ? "ملخص" : "Summary"}</span>
            </button>
            <button type="button" style={railCell(rail === "pages")} aria-pressed={rail === "pages"} onClick={() => onRail?.("pages")}>
              <RailGlyph name="pages" on={rail === "pages"} />
              <span style={{ minWidth: 0, whiteSpace: "nowrap" }}>{ar ? "الصفحات" : "Pages"}</span>
            </button>
            <button type="button" style={railCell(false)} onClick={onDownload}>
              <RailGlyph name="download" />
              <span style={{ minWidth: 0, whiteSpace: "nowrap" }}>{ar ? "تنزيل" : "Download"}</span>
            </button>
            <button type="button" style={railCell(false)} onClick={onPrint}>
              <RailGlyph name="print" />
              <span style={{ minWidth: 0, whiteSpace: "nowrap" }}>{ar ? "طباعة" : "Print"}</span>
            </button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button type="button" style={railCell(false)} onClick={() => onZoom?.(1)} aria-label={ar ? "تكبير" : "Zoom in"}>
              <RailGlyph name="in" />
              <span style={{ minWidth: 0, whiteSpace: "nowrap" }}>{ar ? "تكبير" : "Zoom in"}</span>
            </button>
            <span dir="ltr" style={{ ...railCell(false), cursor: "default", justifyContent: "center", color: INK, fontFamily: "'IBM Plex Mono', monospace" }}>{Math.round(zoom * 100)}%</span>
            <button type="button" style={railCell(false)} onClick={() => onZoom?.(-1)} aria-label={ar ? "تصغير" : "Zoom out"}>
              <RailGlyph name="out" />
              <span style={{ minWidth: 0, whiteSpace: "nowrap" }}>{ar ? "تصغير" : "Zoom out"}</span>
            </button>
          </div>
        </nav>
      </div>
    </div>
  );
}
