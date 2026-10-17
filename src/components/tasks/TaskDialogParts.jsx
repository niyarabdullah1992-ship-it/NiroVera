import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, Search, X } from "lucide-react";
import SubTypeOption, { SubTypeGrid } from "@/components/requests/SubTypeOption";
import NvIcon from "@/components/shared/NvIcon";
import { SectionHead, slab } from "@/components/schedules/scheduleChrome";
import { BORDER, CARD, CONTROL_RADIUS, MUTED } from "@/lib/platformStyles";
import { formatDate } from "@/lib/dateFormat";
import { peopleQueryMatches } from "@/lib/peopleTreeGraph";

/**
 * The task dialogs (توكيل · نقل · مكان التنفيذ · حذف) speak the طلباتي raise frame exactly — the same as
 * «طلب تعديل الملف الوظيفي»: a slab with a SectionHead, hairline blocks (14px 20px), labels above fields in
 * 11.5 muted, the request inputs, SubTypeOption choices, a plain inline acknowledgement, then the readiness
 * line («✓ جاهز …» or what is missing) over the full-width dark-green button.
 */

/** The request frame's own input — same font, padding, hairline and radius as FileCorrectionRaise. */
export const reqField = { fontFamily: "inherit", fontSize: 12.5, padding: "10px 12px", border: `1px solid ${BORDER}`, background: CARD, color: "var(--nv-ink)", outline: "none", width: "100%", boxSizing: "border-box", borderRadius: CONTROL_RADIUS };
const blockStyle = { padding: "14px 20px", borderBottom: "1px solid var(--nv-line2)", display: "flex", flexDirection: "column", gap: 10 };
const labelStyle = { fontSize: 11.5, color: MUTED };
const REQ_SEND = "#0B3D27"; // «أرسل الطلب»

export const dateKeyText = (key, ar, withYear = true) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(key || ""));
  if (!m) return "—";
  return formatDate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), ar ? "ar" : "en", {
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  });
};

/** The raise frame as a dialog: slab + SectionHead (quiet × to close), then the blocks. Esc closes. */
export function RequestFrameDialog({ ar, title, hint, onClose, dataNv, children, zIndex = 120 }) {
  useEffect(() => {
    const onKey = (event) => { if (event.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const node = (
    <div
      dir={ar ? "rtl" : "ltr"}
      role="presentation"
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex, background: "rgba(12,20,16,.42)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-nv-task-card={dataNv || undefined}
        onClick={(e) => e.stopPropagation()}
        style={{ ...slab, width: "100%", maxWidth: 620, maxHeight: "calc(100vh - 32px)", overflowY: "auto", display: "flex", flexDirection: "column" }}
      >
        <SectionHead
          title={title}
          note={hint}
          trailing={(
            <button
              type="button"
              onClick={onClose}
              aria-label={ar ? "إغلاق" : "Close"}
              style={{ width: 30, height: 30, borderRadius: CONTROL_RADIUS, border: "none", background: "transparent", color: MUTED, display: "grid", placeItems: "center", cursor: "pointer" }}
            >
              <X size={16} strokeWidth={1.75} />
            </button>
          )}
        />
        {children}
      </section>
    </div>
  );
  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}

/** A hairline block of the frame; `heading` is the 12/600 section line FileCorrectionRaise uses. */
export function FrameBlock({ heading, children, last = false, dataKey }) {
  return (
    <div data-task-block={dataKey || undefined} style={{ ...blockStyle, ...(last ? { borderBottom: "none" } : {}) }}>
      {heading ? <span style={{ fontSize: 12, fontWeight: 600 }}>{heading}</span> : null}
      {children}
    </div>
  );
}

/** Label above the field, 11.5 muted — the request frame's field label. */
export function FieldBlock({ label, hint, children, dataKey }) {
  return (
    <div data-task-field={dataKey || undefined} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      {children}
      {hint ? <span style={{ fontSize: 11, lineHeight: 1.7, color: MUTED }}>{hint}</span> : null}
    </div>
  );
}

const personTitle = (emp) => String(emp?.position || emp?.profile?.jobTitle || emp?.jobTitle || emp?.profile?.position || emp?.title || "").trim();
const personStation = (emp, stations) => {
  const id = String(emp?.profile?.workStationId || emp?.stationId || "");
  return emp?.stationName || (stations || []).find((row) => String(row.id) === id)?.name || "";
};

/** One person from the visible scope as SubTypeOption rows (name, then title · branch); searchable when long. */
export function TaskPersonPicker({ ar, options = [], value, onChange, stations = [], label }) {
  const [q, setQ] = useState("");
  const rows = useMemo(() => options.map((emp) => {
    const id = String(emp.employeeId || emp.id || "");
    const sub = [personTitle(emp), personStation(emp, stations)].filter(Boolean).join(" · ");
    return { id, name: emp.name || id, sub, hay: [emp.name, emp.nameEn, sub, id].filter(Boolean).join(" ") };
  }), [options, stations]);
  const shown = rows.filter((row) => peopleQueryMatches(row.hay, q));
  if (!rows.length) {
    return (
      <span data-task-people-empty="1" style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.7, color: "var(--nv-warn-ink, #8A5A12)" }}>
        {ar ? "لا موظف آخر ظاهر في نطاق هذا الفرع." : "No other visible employee in this station scope."}
      </span>
    );
  }
  return (
    <>
      {rows.length > 6 ? (
        <label style={{ position: "relative", display: "block" }}>
          <Search aria-hidden size={14} strokeWidth={1.75} style={{ position: "absolute", insetInlineStart: 11, top: "50%", transform: "translateY(-50%)", color: MUTED }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ar ? "ابحث بالاسم أو المسمى أو الفرع" : "Search by name, title or branch"}
            aria-label={ar ? "ابحث عن موظف" : "Search an employee"}
            style={{ ...reqField, padding: undefined, paddingBlock: 10, paddingInlineEnd: 12, paddingInlineStart: 32, "--nv-input-start": "32px" }}
          />
        </label>
      ) : null}
      <div style={{ maxHeight: 248, overflowY: "auto" }}>
        <SubTypeGrid label={label}>
          {shown.map((row) => (
            <SubTypeOption key={row.id} dataKey={row.id} on={String(value) === row.id} title={row.name} sub={row.sub || undefined} onClick={() => onChange(row.id)} />
          ))}
        </SubTypeGrid>
        {!shown.length ? (
          <span style={{ display: "block", padding: "8px 2px", fontSize: 11.5, color: MUTED }}>
            {ar ? `لا أحد يطابق «${q}».` : `Nobody matches “${q}”.`}
          </span>
        ) : null}
      </div>
    </>
  );
}

export function ReasonBox({ value, onChange, placeholder }) {
  return <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...reqField, resize: "vertical" }} />;
}

/** The plain inline acknowledgement line of the request frame — no box, no tint. */
export function AckLine({ checked, onChange, children }) {
  return (
    <label data-task-ack={checked ? "1" : "0"} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.7, color: "var(--nv-ink)", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 4 }} />
      <span>{children}</span>
    </label>
  );
}

/**
 * The consequence in the request frame's own voice: a line, not a box. `tone="danger"` turns the lead words
 * red for what cannot be undone; the rest stays the frame's muted note.
 */
export function ConsequenceSlab({ title, children, dataKey, tone = "danger" }) {
  return (
    <span data-task-consequence={dataKey || "1"} style={{ fontSize: 11.5, lineHeight: 1.8, color: MUTED }}>
      <strong style={{ fontWeight: 700, color: tone === "danger" ? "var(--nv-bad-ink)" : "var(--nv-ink)" }}>{title}</strong>
      {children ? <>{" — "}{children}</> : null}
    </span>
  );
}

/**
 * The raise frame's foot: the readiness line («✓ جاهز …» in green, or what is still missing in the warning
 * ink) over the full-width dark-green button — the same as «أرسل الطلب». Danger only on the final ready button.
 */
export function TaskDialogFooter({ ar, onConfirm, label, missing = [], busy = false, tone = "primary", readyText }) {
  const ready = !missing.length;
  const enabled = ready && !busy;
  const fill = tone === "danger" ? "var(--nv-bad-fill, #9B2335)" : REQ_SEND;
  return (
    <FrameBlock last dataKey="foot">
      <span data-task-ready={ready ? "ok" : "missing"} style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.7, color: ready ? "#2F6B43" : "var(--nv-warn-ink, #8A5A12)" }}>
        {ready
          ? <><NvIcon name="check" size={12} strokeWidth={2} /> {readyText || (ar ? "جاهز للتأكيد" : "Ready to confirm")}</>
          : <span data-task-missing="1">{ar ? "يبقى: " : "Still needed: "}{missing.join(" · ")}</span>}
      </span>
      <button
        type="button"
        data-task-action={enabled ? "ready" : "blocked"}
        disabled={!enabled}
        onClick={onConfirm}
        style={{ fontFamily: "inherit", fontSize: 13, fontWeight: 700, height: 42, border: "none", borderRadius: 8, background: enabled ? fill : "var(--nv-line)", color: enabled ? "#fff" : MUTED, cursor: enabled ? "pointer" : "default", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {label}
      </button>
    </FrameBlock>
  );
}
