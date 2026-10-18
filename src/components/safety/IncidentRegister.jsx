import React, { useMemo, useState } from "react";
import { ListStack } from "@/components/shared/TwoPaneWorkspace";
import StatusFilterPills from "@/components/shared/StatusFilterPills";
import { useCollapsibleItems } from "@/components/shared/CollapsibleItemCard";
import { DisciplineRow, DisciplineRowList, AttentionChip } from "@/components/discipline/DisciplineRows";
import { FieldLabel, GateLine, LawLine, SendButton, StepHead, inputStyle, textareaStyle } from "@/components/discipline/DisciplineFormKit";
import {
  INCIDENT_CLASS_LABEL,
  ROOT_CAUSES,
  checkInvestigationGate,
  incidentClass,
  injuryReportState,
  isTrackedIncident,
} from "@/lib/safetyOps";
import { SafetyKpiRow, SafetyPanel } from "@/components/safety/SafetyOpsKit";

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)";
const PYRAMID = ["fatality", "lti", "medical", "firstAid", "damage", "nearMiss"];

function Investigation({ ar, row, canEdit, onSave }) {
  const L = (a, e) => (ar ? a : e);
  const inv = row.item.investigation || {};
  const [form, setForm] = useState({
    rootCause: inv.rootCause || "",
    capa: inv.capa || "",
    capaOwner: inv.capaOwner || "",
    capaDue: inv.capaDue || "",
    lostDays: inv.lostDays == null ? "" : String(inv.lostDays),
    gosiReportedAt: inv.gosiReportedAt || "",
    capaDone: Boolean(inv.capaDoneAt),
  });
  const patch = (next) => setForm((cur) => ({ ...cur, ...next }));
  const draft = { ...form, lostDays: form.lostDays === "" ? "" : Number(form.lostDays) };
  const gate = checkInvestigationGate(row.item, draft);
  const card = row.item.card || {};
  const report = injuryReportState(row.item);
  return (
    <div data-investigation={row.item.id} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {card.what || row.item.description ? (
        <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.8, color: "var(--nv-ink2)" }}>
          {card.what || row.item.description}
          {card.where ? <span style={{ color: "var(--nv-muted)" }}>{` — ${card.where}`}</span> : null}
        </p>
      ) : null}
      {report ? (
        <LawLine cite={L("التأمينات", "GOSI")}>
          {ar
            ? `إصابة العمل تُبلَّغ للتأمينات خلال ${report.days} أيام من وقوعها — آخر موعد ${report.dueKey}.`
            : `A work injury is reported to GOSI within ${report.days} days — last day ${report.dueKey}.`}
        </LawLine>
      ) : null}
      {!canEdit ? (
        <span style={{ fontSize: 12, color: "var(--nv-muted)" }}>{inv.capa ? `${L("الإجراء", "Action")}: ${inv.capa}` : L("لا تحقيق بعد.", "No investigation yet.")}</span>
      ) : (
        <>
          <StepHead first label={L("السبب الجذري", "Root cause")} />
          <div role="radiogroup" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ROOT_CAUSES.map((c) => {
              const on = form.rootCause === c.id;
              return (
                <button key={c.id} type="button" role="radio" aria-checked={on} data-root-cause={c.id} onClick={() => patch({ rootCause: c.id })} style={{ fontFamily: "inherit", height: 30, padding: "0 12px", borderRadius: 999, fontSize: 12, fontWeight: on ? 700 : 500, cursor: "pointer", border: on ? "1px solid var(--nv-ok-fill, #3C7D50)" : "1px solid var(--nv-line)", background: on ? "var(--nv-ok-fill, #3C7D50)" : "var(--nv-card)", color: on ? "#fff" : "var(--nv-ink2)" }}>
                  {ar ? c.ar : c.en}
                </button>
              );
            })}
          </div>
          <StepHead label={L("الإجراء التصحيحي", "Corrective action")} note={L("ما يمنع التكرار، لا ما عولج به الحادث وحده", "What prevents a repeat, not only the fix")} />
          <textarea data-inv-field="capa" value={form.capa} onChange={(e) => patch({ capa: e.target.value })} style={{ ...textareaStyle, minHeight: 64 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <FieldLabel>{L("المسؤول", "Owner")}</FieldLabel>
              <input data-inv-field="owner" value={form.capaOwner} onChange={(e) => patch({ capaOwner: e.target.value })} style={inputStyle} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <FieldLabel>{L("الموعد", "Due")}</FieldLabel>
              <input data-inv-field="due" type="date" value={form.capaDue} onChange={(e) => patch({ capaDue: e.target.value })} style={{ ...inputStyle, fontFamily: MONO }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <FieldLabel note={L("0 إن لم يتغيّب", "0 if none")}>{L("أيام العمل المفقودة", "Lost workdays")}</FieldLabel>
              <input data-inv-field="lost" inputMode="numeric" value={form.lostDays} onChange={(e) => patch({ lostDays: e.target.value.replace(/[^0-9]/g, "") })} style={{ ...inputStyle, fontFamily: MONO }} />
            </label>
            {card.injured ? (
              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <FieldLabel>{L("أُبلغت التأمينات في", "GOSI told on")}</FieldLabel>
                <input data-inv-field="gosi" type="date" value={form.gosiReportedAt} onChange={(e) => patch({ gosiReportedAt: e.target.value })} style={{ ...inputStyle, fontFamily: MONO }} />
              </label>
            ) : null}
          </div>
          {inv.capa ? (
            <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: "var(--nv-ink)", cursor: "pointer" }}>
              <input type="checkbox" data-inv-field="done" checked={form.capaDone} onChange={(e) => patch({ capaDone: e.target.checked })} />
              {L("نُفِّذ الإجراء التصحيحي", "The corrective action is done")}
            </label>
          ) : null}
          <GateLine gate={gate} ar={ar} dataAttr={{ "data-inv-gate": "1" }} />
          <SendButton ready={gate.ok} dataAttr={{ "data-inv-save": "1" }} onClick={() => onSave(row, draft)}>
            {inv.capa ? L("حدّث التحقيق", "Update the investigation") : L("سجّل التحقيق", "Record the investigation")}
          </SendButton>
          {inv.by ? <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? `آخر تحديث: ${inv.by} · ${String(inv.at).slice(0, 10)}` : `Last update: ${inv.by} · ${String(inv.at).slice(0, 10)}`}</span> : null}
        </>
      )}
    </div>
  );
}

/** الحوادث والإصابات — the incident register: class on the Bird pyramid, GOSI window, investigation and CAPA. */
export default function IncidentRegister({ ar, stations, recFor, canEdit, onSave }) {
  const L = (a, e) => (ar ? a : e);
  const now = Date.now();
  const rows = useMemo(() => stations.flatMap((s) => (recFor(s.id)?.incidentLog || []).map((item) => ({ item, stationId: s.id, stationName: s.name, cls: incidentClass(item) })))
    .filter((row) => isTrackedIncident(row.item))
    .sort((a, b) => String(b.item.at).localeCompare(String(a.item.at))), [stations, recFor]);
  const yearAgo = now - 365 * 86400000;
  const year = rows.filter((row) => new Date(row.item.at).getTime() >= yearAgo);
  const gosiOpen = rows.filter((row) => ["due", "overdue"].includes(injuryReportState(row.item, now)?.state));
  const gosiLate = rows.filter((row) => injuryReportState(row.item, now)?.state === "overdue");
  const lost = year.reduce((sum, row) => sum + (Number(row.item.investigation?.lostDays) || 0), 0);
  const todayKey = new Date(now + 3 * 3600000).toISOString().slice(0, 10);
  const capaLate = rows.filter((row) => row.item.investigation?.capa && !row.item.investigation.capaDoneAt && String(row.item.investigation.capaDue) < todayKey);
  const noInvestigation = rows.filter((row) => !row.item.investigation?.capa && ["fatality", "lti", "medical", "firstAid", "damage"].includes(row.cls));
  const [face, setFace] = useState("attention");
  const needs = (row) => gosiOpen.includes(row) || capaLate.includes(row) || noInvestigation.includes(row);
  const faces = [
    { id: "attention", label: L("تحتاج إجراء", "Need action"), n: rows.filter(needs).length, test: needs },
    { id: "injury", label: L("إصابات", "Injuries"), n: rows.filter((r) => r.item.card?.injured).length, test: (r) => r.item.card?.injured },
    { id: "near", label: L("حوادث وشيكة", "Near misses"), n: rows.filter((r) => r.cls === "nearMiss").length, test: (r) => r.cls === "nearMiss" },
    { id: "all", label: L("الكل", "All"), n: rows.length, test: () => true },
  ];
  const shown = rows.filter((faces.find((f) => f.id === face) || faces[3]).test);
  const fold = useCollapsibleItems(shown.map((r) => r.item.id));
  const pyramid = PYRAMID.map((key) => ({ key, n: year.filter((row) => row.cls === key).length }));
  return (
    <div data-hse="admin-incidents" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <SafetyKpiRow items={[
        { key: "tracked", label: L("حوادث آخر 12 شهراً", "Incidents, last 12 months"), value: year.length, sub: L("إصابة وضرر وحادث وشيك", "Injury, damage and near miss"), tone: null },
        { key: "gosi", label: L("بانتظار إبلاغ التأمينات", "Awaiting GOSI report"), value: gosiOpen.length, sub: gosiLate.length ? (ar ? `${gosiLate.length} تجاوزت المهلة` : `${gosiLate.length} past the window`) : L("خلال عشرة أيام من الإصابة", "Within ten days of the injury"), tone: gosiLate.length ? "bad" : gosiOpen.length ? "warn" : "ok" },
        { key: "lost", label: L("أيام عمل مفقودة", "Lost workdays"), value: lost, sub: L("من تحقيقات آخر 12 شهراً", "From last-12-month investigations"), tone: lost ? "warn" : null },
        { key: "capa", label: L("إجراءات تصحيحية متأخرة", "Overdue corrective actions"), value: capaLate.length, sub: noInvestigation.length ? (ar ? `${noInvestigation.length} بلا تحقيق` : `${noInvestigation.length} without investigation`) : L("كل حادث له تحقيق", "Every incident investigated"), tone: capaLate.length ? "bad" : noInvestigation.length ? "warn" : "ok" },
      ]} />

      <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }}>
        <ListStack data-incident-list="1" style={{ flex: "1 1 520px", minWidth: 0 }}>
          <StatusFilterPills card dataKey="incidents" title={L("سجل الحوادث", "Incident register")} value={face} onChange={setFace} items={faces} />
          <DisciplineRowList dataKey="incidents" empty={L("لا حوادث في هذا الترشيح.", "No incidents in this filter.")}>
            {shown.map((row) => {
              const card = row.item.card || {};
              const rep = injuryReportState(row.item, now);
              const inv = row.item.investigation;
              const chip = rep?.state === "overdue"
                ? <AttentionChip tone="bad">{L("تجاوز مهلة التأمينات", "Past GOSI window")}</AttentionChip>
                : rep?.state === "due"
                  ? <AttentionChip tone="warn">{ar ? `أبلغ التأمينات خلال ${rep.left} يوم` : `Tell GOSI within ${rep.left} d`}</AttentionChip>
                  : capaLate.includes(row)
                    ? <AttentionChip tone="bad">{L("إجراء متأخر", "Action overdue")}</AttentionChip>
                    : noInvestigation.includes(row)
                      ? <AttentionChip tone="warn">{L("بلا تحقيق", "Not investigated")}</AttentionChip>
                      : inv?.capaDoneAt
                        ? <span style={{ fontSize: 11, fontWeight: 700, color: "var(--nv-ok-ink)" }}>{L("أُغلق بإجراء", "Closed by action")}</span>
                        : null;
              return (
                <DisciplineRow
                  key={row.item.id}
                  id={row.item.id}
                  dataKey="incident"
                  ar={ar}
                  badge={<span dir="ltr" style={{ fontFamily: MONO }}>{card.code || "—"}</span>}
                  title={`${ar ? INCIDENT_CLASS_LABEL[row.cls].ar : INCIDENT_CLASS_LABEL[row.cls].en} — ${card.categoryAr && ar ? card.categoryAr : card.categoryEn || row.item.description || "—"}`}
                  sub={`${row.stationName}${card.injured && card.injuredName ? ` · ${card.injuredName}` : ""}${inv?.lostDays ? (ar ? ` · ${inv.lostDays} يوم مفقود` : ` · ${inv.lostDays} lost days`) : ""}`}
                  date={String(row.item.at || "").slice(0, 10)}
                  chip={chip}
                  open={fold.isOpen(row.item.id)}
                  onOpen={() => fold.toggle(row.item.id)}
                >
                  <Investigation ar={ar} row={row} canEdit={canEdit} onSave={onSave} />
                </DisciplineRow>
              );
            })}
          </DisciplineRowList>
        </ListStack>

        <div style={{ flex: "1 1 300px", maxWidth: 400, minWidth: 0 }}>
        <SafetyPanel dataKey="pyramid" title={L("هرم الحوادث — 12 شهراً", "Incident pyramid — 12 months")} note={L("كل حادث وشيك يُعالج اليوم إصابةٌ لا تقع غداً.", "Every near miss handled today is an injury that does not happen tomorrow.")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {pyramid.map((p, i) => (
              <div key={p.key} data-pyramid={p.key} style={{ display: "grid", gridTemplateColumns: "120px 1fr 28px", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11.5, color: "var(--nv-ink2)" }}>{ar ? INCIDENT_CLASS_LABEL[p.key].ar : INCIDENT_CLASS_LABEL[p.key].en}</span>
                <span style={{ display: "flex", justifyContent: "center" }}>
                  <span style={{ height: 18, borderRadius: 4, width: `${24 + i * 15}%`, background: p.n ? (i < 2 ? "var(--nv-bad-ink, #9B2335)" : i < 4 ? "#C8A45A" : "var(--nv-ok-fill, #3C7D50)") : "var(--nv-line)", opacity: p.n ? 1 : 0.6 }} />
                </span>
                <strong dir="ltr" style={{ fontFamily: MONO, fontSize: 12.5, textAlign: "end" }}>{p.n}</strong>
              </div>
            ))}
          </div>
        </SafetyPanel>
        </div>
      </div>
    </div>
  );
}
