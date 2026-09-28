import React from "react";
import PlatformDateField from "@/components/shared/PlatformDateField";
import GreenMenu from "@/components/discipline/GreenMenu";
import {
  DISCIPLINE_PENALTY_KINDS,
  deriveRaiseDisciplineChips,
  listedPenaltyKind,
  listedPenaltyLabel,
} from "@/lib/disciplineDerivations";

const ACTION = "#3C7D50";
const GOLD = "#C8A45A";
const WORK_LINK_AR = "متصلة بالعمل أو بصاحب العمل أو بالمدير المسؤول";
const WORK_LINK_EN = "Connected to the work, the employer, or the responsible manager";

const field = {
  fontFamily: "inherit",
  fontSize: 14,
  height: 44,
  padding: "0 14px",
  border: "1px solid var(--nv-line)",
  borderRadius: 10,
  background: "var(--nv-page)",
  color: "var(--nv-ink)",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

function personLabel(person, stations) {
  const name = String(person?.name || "").trim() || "—";
  const station = stations.find((row) => String(row.id) === String(person?.stationId || person?.station_id));
  return station?.name ? `${name} — ${station.name}` : name;
}

function gateTone(state) {
  if (state === "fail") {
    return { color: "var(--nv-bad-ink)", bg: "transparent", border: "var(--nv-bad-line)", mark: "✕" };
  }
  if (state === "warn") {
    return { color: "var(--nv-warn-ink)", bg: "transparent", border: "var(--nv-warn-line)", mark: "!" };
  }
  return { color: "var(--nv-ok-ink)", bg: "transparent", border: "var(--nv-ok-line)", mark: "✓" };
}

function MarkBox({ on, label, onToggle }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      onClick={onToggle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0,
        gridColumn: "1 / -1",
        fontFamily: "inherit",
        fontSize: 13,
        color: "var(--nv-ink)",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        textAlign: "start",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 20,
          height: 20,
          borderRadius: 5,
          flex: "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12,
          color: "var(--nv-btn-ink)",
          background: on ? ACTION : "var(--nv-card)",
          border: on ? `1px solid ${ACTION}` : "1.5px solid var(--nv-muted)",
        }}
      >
        {on ? "✓" : ""}
      </span>
      <span>{label}</span>
    </button>
  );
}

export default function DisciplineRaiseForm({
  ar,
  employees = [],
  stations = [],
  cases = [],
  actor,
  today,
  employeeId,
  onEmployee,
  penaltyKind,
  onPenaltyKind,
  cutDays,
  onCutDays,
  discoveredAt,
  onDiscovered,
  note,
  onNote,
  offSite,
  onOffSite,
  workConnected,
  onWorkConnected,
  dismissGround,
  onDismissGround,
  onSubmit,
}) {
  const person = employees.find((row) => String(row.id) === String(employeeId)) || null;
  const kindSpec = listedPenaltyKind(penaltyKind) || DISCIPLINE_PENALTY_KINDS[0];
  const chips = deriveRaiseDisciplineChips({
    employee: person,
    actor,
    note,
    today,
    discoveredAt,
    penaltyKind,
    cutDays,
    dismissGround,
    offSite,
    workConnected,
    cases,
    ar,
  });
  const hasFacts = Boolean(String(note || "").trim());
  const failing = chips.filter((chip) => chip.state === "fail");
  const blocked = failing.length > 0;
  const buttonLabel = (() => {
    if (!hasFacts) return ar ? "اكتب المخالفة أولاً" : "Write the offence first";
    if (failing.some((row) => row.key === "69")) return ar ? "خارج مهلة المادة 69" : "Outside the Article 69 window";
    if (failing.some((row) => row.key === "70-place")) return ar ? "غير متصلة بالعمل — المادة 70" : "Not connected to the work — Article 70";
    if (blocked) return ar ? "البوابة تمنع الفتح" : "A gate blocks opening";
    return ar ? "افتح ملف الجزاء" : "Open the sanction file";
  })();
  const people = employees.map((row) => ({ value: row.id, label: personLabel(row, stations) }));
  const kinds = DISCIPLINE_PENALTY_KINDS.map((row) => ({ value: row.id, label: ar ? row.ar : row.en }));
  const dayChoices = (kindSpec?.days || []).filter((n) => n > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div
        data-raise-info=""
        style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: 8, padding: "11px 16px", fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.8 }}
      >
        <span>
          {ar
            ? "يفتح الملف في مرحلة «أُبلغ كتابةً» على محطة عمل الموظف. بوابات المواد 66 و67 و69 و70 و71 تُفحص قبل الفتح، ولا يُفتح ملف تخالفها."
            : "The file opens at written notice on the employee's work station. Articles 66, 67, 69, 70 and 71 are checked before it opens, and a file that breaks them does not open."}
        </span>
      </div>
      <section
        data-raise-form=""
        style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderBottom: `3px solid ${GOLD}`, borderRadius: 10, padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}
      >
        <strong style={{ fontSize: 15, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1.7 }}>
          {ar
            ? "رفع جزاء — يفتح الملف في مرحلة «أُبلغ كتابةً» على محطة عمل الموظف لا نطاق الرأس"
            : "Raise a sanction — the file opens at written notice on the employee's work station, not the header scope"}
        </strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,220px),1fr))", gap: "12px 16px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 12.5, color: "var(--nv-ink2)" }}>{ar ? "الموظف" : "Employee"}</span>
            <GreenMenu
              ariaLabel={ar ? "الموظف" : "Employee"}
              menuId="discipline-raise-employee"
              value={employeeId}
              options={people}
              placeholder="—"
              onChange={onEmployee}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 12.5, color: "var(--nv-ink2)" }}>{ar ? "الجزاء من المادة 66" : "Penalty from Article 66"}</span>
            <GreenMenu
              ariaLabel={ar ? "الجزاء من المادة 66" : "Penalty from Article 66"}
              menuId="discipline-raise-penalty"
              value={penaltyKind}
              options={kinds}
              onChange={onPenaltyKind}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 12.5, color: "var(--nv-ink2)" }}>{ar ? "تاريخ كشف المخالفة — المادة 69" : "Date the offence was discovered — Article 69"}</span>
            <PlatformDateField ar={ar} value={discoveredAt} onChange={onDiscovered} style={{ height: 44, minHeight: 44, fontSize: 14, background: "var(--nv-page)", borderRadius: 10 }} />
          </label>
          {dayChoices.length ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
              <span style={{ fontSize: 12.5, color: "var(--nv-ink2)" }}>{ar ? "الأيام" : "Days"}</span>
              <GreenMenu
                ariaLabel={ar ? "أيام الجزاء" : "Penalty days"}
                menuId="discipline-raise-days"
                value={String(cutDays)}
                options={dayChoices.map((n) => ({ value: String(n), label: listedPenaltyLabel(penaltyKind, n, ar) }))}
                onChange={(next) => onCutDays(Number(next))}
              />
            </label>
          ) : null}
          <label style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, gridColumn: "1 / -1" }}>
            <span style={{ fontSize: 12.5, color: "var(--nv-ink2)" }}>{ar ? "المخالفة كما ستُبلَّغ كتابةً" : "Offence as it will be notified in writing"}</span>
            <input
              value={note}
              onChange={(event) => onNote(event.target.value)}
              data-raise-facts=""
              placeholder={ar ? "مثال: تأخر عن تسليم عهدة الفرع يوم 12 سبتمبر — 10 أحرف على الأقل" : "Example: late handing over the branch custody on 12 September"}
              style={field}
            />
          </label>
          {penaltyKind === "dismiss" ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, gridColumn: "1 / -1" }}>
              <span style={{ fontSize: 12.5, color: "var(--nv-ink2)" }}>{ar ? "الحالة المقررة للفصل — المادة 66" : "Prescribed dismissal case — Article 66"}</span>
              <input value={dismissGround} onChange={(event) => onDismissGround(event.target.value)} placeholder={ar ? "اكتب الحالة المقررة كما في النظام" : "Write the prescribed case as in the Law"} style={field} />
            </label>
          ) : null}
          <MarkBox
            on={offSite}
            label={ar ? "ارتُكبت خارج مكان العمل — المادة 70" : "Committed outside the workplace — Article 70"}
            onToggle={() => {
              const next = !offSite;
              onOffSite(next);
              if (!next) onWorkConnected("");
            }}
          />
          {offSite ? (
            <MarkBox
              on={Boolean(String(workConnected || "").trim())}
              label={ar ? WORK_LINK_AR : WORK_LINK_EN}
              onToggle={() => onWorkConnected(String(workConnected || "").trim() ? "" : (ar ? WORK_LINK_AR : WORK_LINK_EN))}
            />
          ) : null}
        </div>
        <div data-raise-gates="" style={{ display: "flex", flexDirection: "column", gap: 7, background: "var(--nv-page)", border: "1px solid var(--nv-line)", borderRadius: 10, padding: "12px 14px" }}>
          {chips.map((chip) => {
            const tone = gateTone(chip.state);
            return (
              <div
                key={chip.key}
                data-raise-gate={chip.key}
                data-raise-state={chip.state}
                style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 24, padding: "0 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 700, flex: "none", color: tone.color, background: "transparent", border: `1px solid ${tone.border}`, whiteSpace: "nowrap" }}>
                  {tone.mark} {chip.label}
                </span>
                <span style={{ fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.7, flex: 1, minWidth: 0 }}>{chip.text || "—"}</span>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          data-raise-submit=""
          disabled={blocked}
          onClick={() => !blocked && onSubmit?.()}
          style={{
            fontFamily: "inherit",
            fontSize: 15,
            fontWeight: 700,
            height: 48,
            padding: "0 26px",
            border: "none",
            borderRadius: 10,
            background: blocked ? "var(--nv-line)" : ACTION,
            color: blocked ? "var(--nv-muted)" : "var(--nv-btn-ink)",
            cursor: blocked ? "default" : "pointer",
            alignSelf: "flex-start",
          }}
        >
          {buttonLabel}
        </button>
      </section>
    </div>
  );
}
