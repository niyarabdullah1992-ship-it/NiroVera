import React, { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import SubTypeOption, { SubTypeGrid } from "@/components/requests/SubTypeOption";
import { BTN_FILL, BTN_INK, DANGER_FILL, field, textarea } from "@/lib/platformStyles";
import { formatDate } from "@/lib/dateFormat";
import { peopleQueryMatches } from "@/lib/peopleTreeGraph";

/**
 * The parts the three task dialogs share (توكيل · نقل · مكان التنفيذ) inside ComposerModalShell:
 * a labelled field, a people picker in the طلباتي sub-option language, the reason box, the
 * acknowledgement line, and one footer whose disabled button names what is still missing.
 */

export const dateKeyText = (key, ar, withYear = true) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(key || ""));
  if (!m) return "—";
  return formatDate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])), ar ? "ar" : "en", {
    day: "numeric",
    month: "long",
    ...(withYear ? { year: "numeric" } : {}),
  });
};

export function FieldBlock({ label, hint, children, dataKey }) {
  return (
    <div data-task-field={dataKey || undefined} style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--nv-ink2, var(--nv-ink))" }}>{label}</span>
      {children}
      {hint ? <span style={{ fontSize: 11, lineHeight: 1.6, color: "var(--nv-muted)" }}>{hint}</span> : null}
    </div>
  );
}

const personTitle = (emp) => String(emp?.position || emp?.profile?.jobTitle || emp?.jobTitle || emp?.profile?.position || emp?.title || "").trim();
const personStation = (emp, stations) => {
  const id = String(emp?.profile?.workStationId || emp?.stationId || "");
  return emp?.stationName || (stations || []).find((row) => String(row.id) === id)?.name || "";
};

/** One person from the visible scope — name, then title · branch; searchable once the list grows. */
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
      <span data-task-people-empty="1" style={{ fontSize: 12, lineHeight: 1.7, color: "var(--nv-warn-ink)" }}>
        {ar ? "لا موظف آخر ظاهر في نطاق هذا الفرع." : "No other visible employee in this station scope."}
      </span>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.length > 6 ? (
        <label style={{ position: "relative", display: "block" }}>
          <Search aria-hidden size={14} strokeWidth={1.75} style={{ position: "absolute", insetInlineStart: 11, top: "50%", transform: "translateY(-50%)", color: "var(--nv-muted)" }} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={ar ? "ابحث بالاسم أو المسمى أو الفرع" : "Search by name, title or branch"}
            aria-label={ar ? "ابحث عن موظف" : "Search an employee"}
            style={{ ...field, width: "100%", boxSizing: "border-box", paddingInlineStart: 32 }}
          />
        </label>
      ) : null}
      <div style={{ maxHeight: 232, overflowY: "auto", paddingInlineEnd: 2 }}>
        <SubTypeGrid label={label} wide>
          {shown.map((row) => (
            <SubTypeOption key={row.id} dataKey={row.id} on={String(value) === row.id} title={row.name} sub={row.sub || null} onClick={() => onChange(row.id)} />
          ))}
        </SubTypeGrid>
        {!shown.length ? (
          <span style={{ display: "block", padding: "8px 2px", fontSize: 12, color: "var(--nv-muted)" }}>
            {ar ? `لا أحد يطابق «${q}».` : `Nobody matches “${q}”.`}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ReasonBox({ value, onChange, placeholder }) {
  return (
    <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ ...textarea, width: "100%", boxSizing: "border-box" }} />
  );
}

export function AckLine({ checked, onChange, children, tone = "ok" }) {
  return (
    <label
      data-task-ack={checked ? "1" : "0"}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 9,
        padding: "10px 12px",
        borderRadius: 8,
        border: `1px solid ${checked ? (tone === "danger" ? "var(--nv-bad-line)" : "var(--nv-ok-line, var(--nv-line))") : "var(--nv-line)"}`,
        background: checked ? (tone === "danger" ? "var(--nv-bad-soft)" : "var(--nv-ok-soft)") : "var(--nv-card)",
        fontSize: 12.5,
        lineHeight: 1.7,
        color: "var(--nv-ink)",
        cursor: "pointer",
      }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ marginTop: 4, accentColor: tone === "danger" ? "var(--nv-bad-fill)" : "var(--nv-ok-fill, #3C7D50)" }} />
      <span>{children}</span>
    </label>
  );
}

/**
 * Cancel + one action. Disabled, the action says what is still missing — never a silent grey button.
 * `tone="danger"` is kept for the irreversible transfer only.
 */
export function TaskDialogFooter({ ar, onClose, onConfirm, label, missing = [], busy = false, tone = "primary" }) {
  const enabled = !missing.length && !busy;
  const fill = tone === "danger" ? DANGER_FILL : BTN_FILL;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          onClick={onClose}
          style={{ height: 36, padding: "0 16px", borderRadius: 8, background: "var(--nv-card)", border: "1px solid var(--nv-line)", color: "var(--nv-ink2)", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}
        >
          {ar ? "إلغاء" : "Cancel"}
        </button>
        <button
          type="button"
          data-task-action={enabled ? "ready" : "blocked"}
          disabled={!enabled}
          onClick={onConfirm}
          style={{
            flex: 1,
            height: 36,
            borderRadius: 8,
            border: "none",
            background: enabled ? fill : "var(--nv-line)",
            color: enabled ? BTN_INK : "var(--nv-muted)",
            fontSize: 13.5,
            fontWeight: 650,
            cursor: enabled ? "pointer" : "not-allowed",
            fontFamily: "inherit",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {label}
        </button>
      </div>
      {missing.length && !busy ? (
        <span data-task-missing="1" style={{ fontSize: 11.5, lineHeight: 1.6, color: "var(--nv-muted)", textAlign: "start" }}>
          {ar ? "يبقى: " : "Still needed: "}{missing.join(ar ? " · " : " · ")}
        </span>
      ) : null}
    </div>
  );
}
