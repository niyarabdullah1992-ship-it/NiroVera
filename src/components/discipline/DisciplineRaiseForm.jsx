import React from "react";
import PlatformDateField from "@/components/shared/PlatformDateField";
import GreenMenu from "@/components/discipline/GreenMenu";
import {
  ART80_GROUNDS,
  DISCIPLINE_PENALTY_KINDS,
  art80Ground,
  deriveRaiseDisciplineChips,
  listedPenaltyKind,
  listedPenaltyLabel,
} from "@/lib/disciplineDerivations";
import NvIcon, { NvMark } from "@/components/shared/NvIcon";
import { LawLine } from "@/components/discipline/DisciplineFormKit";

const ACTION = "#3C7D50";
const WORK_LINK_AR = "متصلة بالعمل أو بصاحب العمل أو بالمدير المسؤول";
const WORK_LINK_EN = "Connected to the work, the employer, or the responsible manager";

const field = {
  fontFamily: "inherit",
  fontSize: 14,
  height: 44,
  padding: "0 14px",
  border: "1px solid var(--nv-line)",
  borderRadius: 8,
  background: "var(--nv-card)",
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
    return { color: "var(--nv-bad-ink)", bg: "transparent", border: "var(--nv-bad-line)", mark: "cross" };
  }
  if (state === "warn") {
    return { color: "var(--nv-warn-ink)", bg: "transparent", border: "var(--nv-warn-line)", mark: "!" };
  }
  return { color: "var(--nv-ok-ink)", bg: "transparent", border: "var(--nv-ok-line)", mark: "check" };
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
        {on ? <NvIcon name="check" size={12} strokeWidth={2.25} inline={false} /> : ""}
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
  art80 = {},
  onArt80,
  onSubmit,
  regulation = null,
  clauseId = "",
  onClause,
  clauseStep = null,
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
    regulation,
    clauseId,
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
  const baseDays = (kindSpec?.days || []).filter((n) => n > 0);
  const dayChoices = penaltyKind === "fine" && Number(cutDays) > 0 && Number(cutDays) < 1 ? [Number(cutDays), ...baseDays] : baseDays;
  const own = regulation?.source === "own";
  const clauseOptions = [
    { value: "", label: ar ? "— لم يُحدَّد —" : "— Not set —" },
    ...(regulation?.clauses || []).map((c, i) => ({ value: c.id, label: `${i + 1}. ${ar ? c.ar || c.en : c.en || c.ar}` })),
  ];

  return (
    <div data-raise-form="" style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
      <LawLine cite={ar ? "م 66 · 67 · 69 · 70 · 71" : "Arts. 66 · 67 · 69 · 70 · 71"}>
        {ar
          ? "يُفتح الملف في «أُبلغ كتابةً» على محطة عمل الموظف، ولا يُفتح ملف يخالف بوابة من بواباته."
          : "The file opens at written notice on the employee's work station; a file that breaks a gate does not open."}
      </LawLine>
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
          {regulation ? (
            <label data-raise-clause="" style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, gridColumn: "1 / -1" }}>
              <span style={{ fontSize: 12.5, color: "var(--nv-ink2)" }}>
                {own
                  ? (ar ? `بند المخالفة في لائحة تنظيم العمل المعتمدة${regulation.approvalNo ? ` (${regulation.approvalNo})` : ""} — المادة 67` : "Offence clause in the approved regulation — Article 67")
                  : (ar ? "بند المخالفة — من النموذج الاسترشادي حتى تُسجَّل لائحة المنشأة (المادة 67)" : "Offence clause — from the model until the establishment's regulation is recorded (Article 67)")}
              </span>
              <GreenMenu
                ariaLabel={ar ? "بند المخالفة" : "Offence clause"}
                menuId="discipline-raise-clause"
                value={clauseId}
                options={clauseOptions}
                onChange={onClause}
              />
              {clauseStep ? (
                <span data-raise-clause-step="" style={{ fontSize: 12, color: "var(--nv-ink2)", lineHeight: 1.7 }}>
                  {ar
                    ? <>{clauseStep.timeLabel} لهذا الموظف{clauseStep.lastAt ? ` — السابقة وُقّعت ${clauseStep.lastAtLabel}` : ""}{clauseStep.lapsed && clauseStep.time === 1 ? " — مضى 180 يوماً على السابقة فلا تشديد (المادة 68)" : ""}. اللائحة تنص على: <strong style={{ color: "var(--nv-ink)" }}>{clauseStep.label}</strong>{clauseStep.beyond ? " (آخر درجة في البند)" : ""} — طُبّق على الجزاء أدناه.</>
                    : <>{clauseStep.timeLabel} for this employee. The regulation says: <strong>{clauseStep.label}</strong> — applied below.</>}
                </span>
              ) : null}
            </label>
          ) : null}
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
            <PlatformDateField ar={ar} value={discoveredAt} onChange={onDiscovered} style={{ height: 44, minHeight: 44, fontSize: 14, background: "var(--nv-card)", borderRadius: 8 }} />
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
            <div data-raise-art80="" style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, gridColumn: "1 / -1" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 12.5, color: "var(--nv-ink2)" }}>{ar ? "حالة الفسخ من المادة 80 — تُختار من النص لا تُكتب" : "Article 80 case — picked from the text"}</span>
                <GreenMenu
                  ariaLabel={ar ? "حالة المادة 80" : "Article 80 case"}
                  menuId="discipline-raise-art80"
                  value={art80Ground(dismissGround) ? dismissGround : ""}
                  options={[{ value: "", label: ar ? "— اختر الحالة —" : "— Pick the case —" }, ...ART80_GROUNDS.map((g) => ({ value: g.id, label: `${g.para}. ${ar ? g.ar : g.en}` }))]}
                  onChange={onDismissGround}
                />
              </label>
              {art80Ground(dismissGround)?.absence ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,180px),1fr))", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--nv-ink2)" }}>{ar ? "نوع الغياب" : "Absence type"}</span>
                    <GreenMenu
                      ariaLabel={ar ? "نوع الغياب" : "Absence type"}
                      menuId="discipline-raise-art80-mode"
                      value={art80.mode === "intermittent" ? "intermittent" : "consecutive"}
                      options={[
                        { value: "consecutive", label: ar ? "متصل — أكثر من 15 يوماً، إنذار بعد 10" : "Consecutive — over 15 days, warning after 10" },
                        { value: "intermittent", label: ar ? "متقطع — أكثر من 30 يوماً، إنذار بعد 20" : "Intermittent — over 30 days, warning after 20" },
                      ]}
                      onChange={(v) => onArt80?.({ ...art80, mode: v })}
                    />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--nv-ink2)" }}>{ar ? "أيام الغياب حتى اليوم" : "Days absent to date"}</span>
                    <input type="number" min="0" value={art80.days ?? ""} onChange={(e) => onArt80?.({ ...art80, days: Number(e.target.value) || 0 })} style={field} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--nv-ink2)" }}>{ar ? "تاريخ الإنذار الكتابي" : "Written warning date"}</span>
                    <PlatformDateField ar={ar} value={art80.warnedAt || ""} onChange={(v) => onArt80?.({ ...art80, warnedAt: v })} style={{ height: 44, minHeight: 44, fontSize: 14, background: "var(--nv-card)", borderRadius: 8 }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--nv-ink2)" }}>{ar ? "أيام الغياب يوم الإنذار" : "Days absent when warned"}</span>
                    <input type="number" min="0" value={art80.warnedAtDays ?? ""} onChange={(e) => onArt80?.({ ...art80, warnedAtDays: Number(e.target.value) || 0 })} style={field} />
                  </label>
                </div>
              ) : null}
              {art80Ground(dismissGround)?.warning ? (
                <label style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 260 }}>
                  <span style={{ fontSize: 12, color: "var(--nv-ink2)" }}>{ar ? "تاريخ الإنذار الكتابي السابق (المادة 80/2)" : "Prior written warning date (Art. 80(2))"}</span>
                  <PlatformDateField ar={ar} value={art80.warnedAt || ""} onChange={(v) => onArt80?.({ ...art80, warnedAt: v })} style={{ height: 44, minHeight: 44, fontSize: 14, background: "var(--nv-card)", borderRadius: 8 }} />
                </label>
              ) : null}
              {art80Ground(dismissGround)?.report24h ? (
                <label style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 260 }}>
                  <span style={{ fontSize: 12, color: "var(--nv-ink2)" }}>{ar ? "تاريخ إبلاغ الجهات المختصة (خلال 24 ساعة — المادة 80/4)" : "Date the authorities were told (within 24h — Art. 80(4))"}</span>
                  <PlatformDateField ar={ar} value={art80.reportedAt || ""} onChange={(v) => onArt80?.({ ...art80, reportedAt: v })} style={{ height: 44, minHeight: 44, fontSize: 14, background: "var(--nv-card)", borderRadius: 8 }} />
                </label>
              ) : null}
              <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>
                {ar
                  ? "المادة 80: لا يُوقَّع الفسخ إلا بقرار مكتوب بعد إتاحة الفرصة للعامل لإبداء أسباب معارضته — يُثبت ذلك في المحضر قبل التوقيع."
                  : "Article 80: the dismissal is signed only as a written decision after the worker had the chance to object — recorded before signing."}
              </span>
            </div>
          ) : null}
          {penaltyKind === "dismissal_with_award" ? (
            <label style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0, gridColumn: "1 / -1" }}>
              <span style={{ fontSize: 12.5, color: "var(--nv-ink2)" }}>{ar ? "السبب المشروع للفصل مع المكافأة (النموذج الموحد م58/6)" : "Legitimate reason for dismissal with award (model Art. 58(6))"}</span>
              <input value={art80Ground(dismissGround) ? "" : dismissGround} onChange={(event) => onDismissGround(event.target.value)} placeholder={ar ? "مثال: تكرار التدخين في الأماكن المحظورة للمرة الرابعة" : "e.g. fourth repeat of smoking in prohibited areas"} style={field} />
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
        <div data-raise-gates="" style={{ display: "flex", flexDirection: "column", gap: 7, background: "var(--nv-soft)", border: "1px solid var(--nv-line2, #EEF1EF)", borderRadius: 8, padding: "12px 14px" }}>
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
                  <NvMark mark={tone.mark} size={12} /> {chip.label}
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
            fontSize: 13,
            fontWeight: 700,
            height: 40,
            width: "100%",
            border: "none",
            borderRadius: 8,
            background: blocked ? "var(--nv-soft, #E4E9E6)" : "var(--nv-ok-fill, #3C7D50)",
            color: blocked ? "var(--nv-muted)" : "#fff",
            cursor: blocked ? "default" : "pointer",
          }}
        >
          {buttonLabel}
        </button>
    </div>
  );
}
