import React, { useMemo, useState } from "react";
import {
  ACTING_REASONS,
  BRANCH_PARENT_REASONS,
  branchPickList,
  branchRemovalImpact,
  closeUnitPlan,
  freezePatch,
  panelActions,
  reasonOf,
  structureRights,
} from "@/lib/orgActionPanel";
import { changeRequestHref, planMove } from "@/lib/orgChartActions";
import { branchKey } from "@/lib/orgBranches";
import { deriveSeatRegister, todayKey } from "@/lib/orgDesign";
import { patchSeatDesign } from "@/lib/orgDesignStore";
import {
  createVacantSeatsUnderManager,
  endSeatTenure,
  jobTitleCatalog,
  renameOrgBranch,
  setActingAssignment,
  setOrgBranchParent,
  setOrgUnitKind,
} from "@/lib/orgHire";
import { seatDrawerReason } from "@/lib/seatUnderManager";
import { gradesForTitle } from "@/lib/jobGrades";
import { deleteStationWithData } from "@/lib/stationData";
import { renameCompany } from "@/lib/companySettings";
import { isCompanyRootStation } from "@/lib/stationTree";
import StationTransferPanel from "@/components/employees/StationTransferPanel";
import { DrawerHead, GateLine, Note, OrgDrawer, btnGhost, btnPrimary, initialsOf, seatOptionLabel } from "./orgDesignUi";

const plusDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fail = (reason) => ({ ok: false, reason: reason?.ar || "", reasonEn: reason?.en || reason?.ar || "" });

/** The hierarchy as an indented list to pick a branch from (HQ → region → branch → site). */
function BranchPicker({ ar, rows, value, onPick, label }) {
  return (
    <div className="nv-oap-pick" role="listbox" aria-label={label}>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          role="option"
          aria-selected={value === row.id}
          aria-disabled={row.blocked ? "true" : undefined}
          data-level={row.level}
          style={{ paddingInlineStart: 10 + row.depth * 18 }}
          onClick={() => { if (!row.blocked) onPick(row.id); }}
        >
          <span className="nv-oap-pick__name">{row.name}</span>
          {row.blocked ? <span className="nv-oap-pick__why">{ar ? row.blocked.ar : row.blocked.en}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** A destructive step: the consequence in words, then «تأكيد» — or the blocking reason. */
function Confirm({ ar, text, blocked, onConfirm, onCancel, cta }) {
  return (
    <div className="nv-oap-confirm" role="group" aria-label={ar ? "تأكيد" : "Confirm"}>
      {blocked ? <GateLine gate={fail(blocked)} ar={ar} /> : <p className="nv-oap-confirm__text">{text}</p>}
      <div className="nv-oap-row">
        <button type="button" className="nv-oap-danger" disabled={Boolean(blocked)} onClick={onConfirm}>{cta || (ar ? "تأكيد" : "Confirm")}</button>
        <button type="button" style={btnGhost()} onClick={onCancel}>{ar ? "إلغاء" : "Cancel"}</button>
      </div>
    </div>
  );
}

/**
 * «شجرة الإدارة» — the action panel a card opens. Everything the old tree's drawers could do,
 * grouped إضافة · تكليف · نقل · تعديل · إزالة, each through the same function and gate as before
 * (see src/lib/orgActionPanel.js). Moves between managers keep the «التغييرات» path (Art. 58); an
 * employee's branch move is the dated transfer with its own Art. 58 gates.
 */
export default function OrgActionPanel({
  ar,
  node,
  data,
  user,
  companyId,
  initialForm = "",
  onClose,
  onHire,
  onMoveManager,
  onOpenFile,
  onOpenBranchDrawer,
  onAddUnit,
  onDone,
  onNavigate,
}) {
  const rights = structureRights(user, data);
  const groups = useMemo(() => panelActions(node, { data, user }), [node, data, user]);
  const items = groups.flatMap((g) => g.items);
  const [active, setActive] = useState(() => (initialForm && items.some((i) => i.id === initialForm) ? initialForm : ""));
  const [gate, setGate] = useState(null);
  const branch = node.kind === "branch";
  const station = (data?.stations || []).find((s) => String(s.id) === String(node.stationId)) || null;
  const seat = (data?.orgSeats || []).find((s) => String(s.id) === String(node.seatId)) || null;
  const employee = node.employeeId ? (data?.employees || []).find((e) => String(e.id) === String(node.employeeId)) : null;
  const day = todayKey();

  /* form state */
  const [title, setTitle] = useState("");
  const [gradeId, setGradeId] = useState("");
  const [qty, setQty] = useState(1);
  const [actor, setActor] = useState("");
  const [until, setUntil] = useState(plusDays(30));
  const [deputy, setDeputy] = useState(seat?.deputySeatId || "");
  const [dotted, setDotted] = useState(seat?.dottedToSeatId || "");
  const [seatForm, setSeatForm] = useState({ code: seat?.code || "", qiwaTitle: seat?.qiwaTitle || "", saudiOnly: Boolean(seat?.saudiOnly), state: seat?.state || "", plannedFrom: seat?.plannedFrom || "" });
  const [pick, setPick] = useState("");
  const [name, setName] = useState(node.name || "");

  const open = (id) => { setActive((cur) => (cur === id ? "" : id)); setGate(null); setPick(""); };
  // success: the panel closes so the tree's in-place update and the flash on the changed cards show
  const done = (keys = [], extra = {}) => { setGate(null); setActive(""); onDone?.({ keys: [node.key, ...keys], ...extra }); onClose(); };
  const seats = useMemo(() => deriveSeatRegister(data, day).filter((r) => r.seatId !== String(node.seatId)), [data, day, node.seatId]);
  const people = (data?.employees || []).filter((e) => e?.id && e.active !== false && e.role !== "system" && String(e.id) !== String(node.employeeId));
  const grades = gradesForTitle(data, title);
  const catalog = useMemo(() => jobTitleCatalog(data), [data]);

  /* actions that do not need a form */
  const run = (item) => {
    if (item.blocked) return;
    if (item.id === "hire") { onHire?.({ stationId: node.stationId || "", seatId: node.seatId || "" }); onClose(); return; }
    if (item.id === "hireHere") { onHire?.({ stationId: item.stationId || node.stationId || "" }); onClose(); return; }
    if (item.id === "hireManager") { onHire?.({ stationId: node.stationId || "", seatId: node.managerSeatId || "" }); onClose(); return; }
    if (item.form === "moveSheet") { onMoveManager?.(node); onClose(); return; }
    if (item.form === "file") { onOpenFile?.(node); onClose(); return; }
    if (item.form === "branchDrawer") { onOpenBranchDrawer?.(node.stationId); onClose(); return; }
    if (item.form === "addUnit") { onAddUnit?.(item.stationId || node.stationId); onClose(); return; }
    if (item.form === "decision") { onNavigate?.(changeRequestHref({ type: "freezeSeat", seatId: node.seatId })); return; }
    open(item.id);
  };

  /* the forms — each calls the old function and shows its named reason */
  const form = (item) => {
    if (active !== item.id) return null;
    switch (item.form) {
      case "addSeat":
        return (
          <div className="nv-oap-form">
            <label className="nv-od-field">{ar ? "مسمى المنصب" : "Seat title"}
              <input className="nv-od-input" list="nv-oap-titles" value={title} onChange={(e) => { setTitle(e.target.value); setGradeId(""); }} placeholder={ar ? "مثال: فني تشغيل" : "e.g. Operations technician"} />
              <datalist id="nv-oap-titles">{catalog.map((t) => <option key={t} value={t} />)}</datalist>
            </label>
            <div className="nv-oap-row">
              <label className="nv-od-field" style={{ flex: 1 }}>{ar ? "الدرجة" : "Grade"}
                <select className="nv-od-select" value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
                  <option value="">{grades.length ? (ar ? "— اختر —" : "— pick —") : (ar ? "اكتب المسمى أولاً" : "Type the title first")}</option>
                  {grades.map((g) => <option key={g.id} value={g.id}>{g.gradeNumber || g.name || g.id}</option>)}
                </select>
              </label>
              <label className="nv-od-field" style={{ width: 96 }}>{ar ? "العدد" : "Count"}
                <select className="nv-od-select" value={qty} onChange={(e) => setQty(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
            <button
              type="button"
              style={btnPrimary()}
              onClick={() => {
                const res = createVacantSeatsUnderManager(companyId, { managerId: node.employeeId, title: title.trim(), gradeId, qty });
                if (!res.ok) { setGate({ ok: false, reason: res.reason || seatDrawerReason(res.error, true), reasonEn: res.reasonEn || seatDrawerReason(res.error, false) }); return; }
                setTitle(""); setQty(1);
                done(res.seatIds || [], { expand: node.key });
              }}
            >
              {qty > 1 ? (ar ? `إنشاء ${qty} مناصب شاغرة` : `Create ${qty} open seats`) : (ar ? "إنشاء المنصب" : "Create the seat")}
            </button>
          </div>
        );
      case "acting":
        return (
          <div className="nv-oap-form">
            <label className="nv-od-field">{ar ? "المكلَّف" : "Acting person"}
              <select className="nv-od-select" value={actor} onChange={(e) => setActor(e.target.value)}>
                <option value="">{ar ? "— اختر —" : "— pick —"}</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="nv-od-field">{ar ? "حتى (ينتهي تلقائياً)" : "Until (ends by itself)"}
              <input className="nv-od-input" type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
            </label>
            <button
              type="button"
              style={btnPrimary()}
              onClick={() => {
                const res = setActingAssignment(companyId, actor, { stationId: seat?.stationId || node.stationId, seatId: node.seatId, title: seat?.title || node.title, from: day, until });
                if (!res.ok) { setGate(fail(reasonOf(ACTING_REASONS, res.error, ACTING_REASONS.FIELDS))); return; }
                done([]);
              }}
            >
              {ar ? "اسند التكليف" : "Assign acting"}
            </button>
          </div>
        );
      case "deputy":
        return (
          <div className="nv-oap-form">
            <label className="nv-od-field">{ar ? "النائب (التعاقب)" : "Deputy (succession)"}
              <select className="nv-od-select" value={deputy} onChange={(e) => setDeputy(e.target.value)}>
                <option value="">{ar ? "— بلا نائب —" : "— none —"}</option>
                {seats.map((r) => <option key={r.seatId} value={r.seatId}>{seatOptionLabel(r, ar)}</option>)}
              </select>
            </label>
            <label className="nv-od-field">{ar ? "خط منقّط (تبعية فنية)" : "Dotted line"}
              <select className="nv-od-select" value={dotted} onChange={(e) => setDotted(e.target.value)}>
                <option value="">{ar ? "— لا يوجد —" : "— none —"}</option>
                {seats.map((r) => <option key={r.seatId} value={r.seatId}>{seatOptionLabel(r, ar)}</option>)}
              </select>
            </label>
            <button type="button" style={btnPrimary()} onClick={() => { const res = patchSeatDesign(companyId, user, node.seatId, { deputySeatId: deputy, dottedToSeatId: dotted }); if (!res.ok) setGate(res); else done([]); }}>
              {ar ? "حفظ" : "Save"}
            </button>
          </div>
        );
      case "seatEdit":
        return (
          <div className="nv-oap-form">
            <div className="nv-oap-row">
              <label className="nv-od-field" style={{ flex: 1 }}>{ar ? "رمز المنصب" : "Seat code"}
                <input className="nv-od-input" dir="ltr" value={seatForm.code} onChange={(e) => setSeatForm((f) => ({ ...f, code: e.target.value }))} placeholder={node.seatCode} />
              </label>
              <label className="nv-od-field" style={{ flex: 1.4 }}>{ar ? "المسمى في قوى" : "Qiwa title"}
                <input className="nv-od-input" value={seatForm.qiwaTitle} onChange={(e) => setSeatForm((f) => ({ ...f, qiwaTitle: e.target.value }))} placeholder={node.title} />
              </label>
            </div>
            {node.vacant ? (
              <div className="nv-oap-row">
                <label className="nv-od-field" style={{ flex: 1 }}>{ar ? "حالة المنصب الشاغر" : "Open seat state"}
                  <select className="nv-od-select" value={seatForm.state} onChange={(e) => setSeatForm((f) => ({ ...f, state: e.target.value }))}>
                    <option value="">{ar ? "شاغر مفتوح للتعيين" : "Open vacancy"}</option>
                    <option value="frozen">{ar ? "مجمّد — لا يُعيَّن عليه" : "Frozen — no hiring"}</option>
                    <option value="planned">{ar ? "مخطط — يُفتح من تاريخ" : "Planned — opens on a date"}</option>
                  </select>
                </label>
                {seatForm.state === "planned" ? (
                  <label className="nv-od-field">{ar ? "يُفتح في" : "Opens on"}
                    <input className="nv-od-input" type="date" value={seatForm.plannedFrom} onChange={(e) => setSeatForm((f) => ({ ...f, plannedFrom: e.target.value }))} />
                  </label>
                ) : null}
              </div>
            ) : <Note>{ar ? "المنصب مشغول — حالته تتبع شاغله." : "Filled — its state follows the holder."}</Note>}
            <label className="nv-oap-check">
              <input type="checkbox" checked={seatForm.saudiOnly} onChange={(e) => setSeatForm((f) => ({ ...f, saudiOnly: e.target.checked }))} />
              {ar ? "مقصور على السعوديين (مهنة موطّنة)" : "Saudi-only (localised occupation)"}
            </label>
            <button
              type="button"
              style={btnPrimary()}
              onClick={() => {
                const patch = { code: seatForm.code, qiwaTitle: seatForm.qiwaTitle, saudiOnly: seatForm.saudiOnly };
                if (node.vacant) { patch.state = seatForm.state; patch.plannedFrom = seatForm.state === "planned" ? seatForm.plannedFrom : ""; }
                const res = patchSeatDesign(companyId, user, node.seatId, patch);
                if (!res.ok) setGate(res); else done([]);
              }}
            >
              {ar ? "حفظ بيانات المنصب" : "Save seat"}
            </button>
          </div>
        );
      case "transfer": {
        const rows = branchPickList(data, { purpose: "transfer", current: employee?.stationId });
        return (
          <div className="nv-oap-form">
            <BranchPicker ar={ar} rows={rows} value={pick} onPick={setPick} label={ar ? "الفرع الوجهة" : "Target branch"} />
            {pick && employee ? (
              <StationTransferPanel
                key={pick}
                employee={employee}
                stations={data?.stations || []}
                companyId={companyId}
                actor={user}
                ar={ar}
                startOpen
                initialToStationId={pick}
                onDone={(res) => { if (res?.ok !== false) done([], { expand: "" }); }}
              />
            ) : <Note>{ar ? "اختر الفرع من الهرم — يفتح نموذج النقل المؤرّخ بشروط المادة 58." : "Pick the branch — the dated transfer form opens with its Art. 58 conditions."}</Note>}
          </div>
        );
      }
      case "seatToBranch": {
        const rows = branchPickList(data, { purpose: "seat", current: node.stationId });
        const target = pick ? { key: branchKey(pick), kind: "branch", stationId: pick, name: rows.find((r) => r.id === pick)?.name || "" } : null;
        const plan = target ? planMove({ ...node, kind: "person" }, target, { data, user, today: day }) : null;
        return (
          <div className="nv-oap-form">
            <BranchPicker ar={ar} rows={rows} value={pick} onPick={setPick} label={ar ? "الفرع الوجهة" : "Target branch"} />
            {plan ? (plan.ok ? (
              <>
                <Note>{ar ? `يُفتح طلب في «التغييرات»: نقل المنصب إلى «${plan.unitName}» — يُعتمد ثم يُنشر في تاريخه.` : `A request opens in Changes: move the seat to “${plan.unitName}” — approved, then published on its date.`}</Note>
                <button type="button" style={btnPrimary()} onClick={() => onNavigate?.(changeRequestHref(plan.op))}>{ar ? "افتح طلب التغيير" : "Open the change request"}</button>
              </>
            ) : <GateLine gate={fail(plan.reason)} ar={ar} />) : null}
          </div>
        );
      }
      case "pickParent": {
        const rows = branchPickList(data, { purpose: "parent", current: String(station?.parentStationId || ""), moving: node.stationId });
        const targetName = rows.find((r) => r.id === pick)?.name || "";
        return (
          <div className="nv-oap-form">
            <BranchPicker ar={ar} rows={rows} value={pick} onPick={setPick} label={ar ? "الجهة الأعلى الجديدة" : "New parent"} />
            {pick ? (
              <Confirm
                ar={ar}
                text={ar ? `سيتبع «${node.name}» وكل ما تحته «${targetName}». تتغير سلسلة الاعتماد والتصعيد لموظفيه.` : `“${node.name}” and everything under it will report to “${targetName}”. Its people's approval and escalation path changes.`}
                cta={ar ? "انقل الفرع" : "Move the branch"}
                onCancel={() => setPick("")}
                onConfirm={() => {
                  const res = setOrgBranchParent(companyId, node.stationId, pick);
                  if (!res.ok) { setGate(fail(reasonOf(BRANCH_PARENT_REASONS, res.error))); return; }
                  done([branchKey(pick)], { expand: branchKey(pick) });
                }}
              />
            ) : null}
          </div>
        );
      }
      case "rename":
        return (
          <div className="nv-oap-form">
            <label className="nv-od-field">{ar ? "الاسم" : "Name"}
              <input className="nv-od-input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <button
              type="button"
              style={btnPrimary()}
              onClick={async () => {
                const next = name.trim();
                if (!next) { setGate(fail({ ar: "اكتب الاسم.", en: "Enter a name." })); return; }
                if (station && isCompanyRootStation(station)) {
                  const saved = await renameCompany(companyId, next);
                  if (!saved) { setGate(fail({ ar: "تعذّر تعديل اسم المنشأة.", en: "Could not rename the company." })); return; }
                } else {
                  const res = renameOrgBranch(companyId, node.stationId, next);
                  if (!res.ok) {
                    setGate(fail(res.error === "DUP" ? { ar: "يوجد فرع بالاسم نفسه.", en: "A branch has that name." } : { ar: "تعذّر تعديل اسم الفرع.", en: "Could not rename the branch." }));
                    return;
                  }
                }
                done([]);
              }}
            >
              {ar ? "حفظ الاسم" : "Save the name"}
            </button>
          </div>
        );
      case "unitKind":
        return (
          <div className="nv-oap-form">
            <div className="nv-oap-row">
              {[["branch", ar ? "فرع (مكان عمل)" : "Branch (workplace)"], ["manager", ar ? "إدارة منطقة" : "Region manager"]].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  style={btnGhost({ flex: 1, justifyContent: "center", ...(String(station?.unitKind || "branch") === value ? { borderColor: "var(--nv-navy)", fontWeight: 700 } : null) })}
                  onClick={() => {
                    const res = setOrgUnitKind(companyId, node.stationId, value);
                    if (!res.ok) { setGate(fail(reasonOf(BRANCH_PARENT_REASONS, res.error, { ar: "تعذّر تغيير النوع — في الفرع موظفون أو مناصب.", en: "Could not change the kind — people or seats are there." }))); return; }
                    done([]);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        );
      case "confirmVacate":
        return (
          <Confirm
            ar={ar}
            text={ar
              ? `تُقفل فترة ${node.name} على «${seat?.title || node.title}» اليوم وتصبح الوظيفة شاغرة. لا يُحذف أحد — يبقى ملفه.`
              : `${node.name}'s term on “${seat?.title || node.title}” ends today and the seat becomes vacant. Nobody is deleted.`}
            cta={ar ? "أخلِ المنصب" : "Vacate"}
            onCancel={() => setActive("")}
            onConfirm={() => {
              const res = endSeatTenure(companyId, node.employeeId);
              if (!res.ok) { setGate({ ok: false, reason: res.reason || seatDrawerReason(res.error, true), reasonEn: res.reasonEn || seatDrawerReason(res.error, false) }); return; }
              done([node.seatId].filter(Boolean));
            }}
          />
        );
      case "confirmFreeze": {
        const fp = freezePatch(data, node.seatId, day);
        return (
          <Confirm
            ar={ar}
            blocked={fp.ok ? null : fp.reason}
            text={fp.ok && fp.patch.state === "frozen"
              ? (ar ? "يُجمَّد المنصب: لا يُعيَّن عليه ولا يُحسب شاغراً مفتوحاً حتى يُفك تجميده." : "The seat is frozen: no hiring, not counted as an open vacancy until unfrozen.")
              : (ar ? "يعود المنصب شاغراً مفتوحاً للتعيين." : "The seat returns to an open vacancy.")}
            cta={fp.ok && fp.patch.state === "frozen" ? (ar ? "جمّد" : "Freeze") : (ar ? "فك التجميد" : "Unfreeze")}
            onCancel={() => setActive("")}
            onConfirm={() => { const res = patchSeatDesign(companyId, user, node.seatId, fp.patch); if (!res.ok) setGate(res); else done([]); }}
          />
        );
      }
      case "confirmClose": {
        const plan = closeUnitPlan(data, node.stationId, { today: day });
        return (
          <Confirm
            ar={ar}
            blocked={plan.ok ? null : plan.reason}
            text={ar ? `يُفتح طلب «إغلاق ${node.name}» في «التغييرات»؛ يُعتمد ثم يُغلق في تاريخ سريانه.` : `A request to close “${node.name}” opens in Changes; approved, then closed on its date.`}
            cta={ar ? "افتح طلب الإغلاق" : "Open the close request"}
            onCancel={() => setActive("")}
            onConfirm={() => onNavigate?.(changeRequestHref(plan.op))}
          />
        );
      }
      case "confirmDelete": {
        const impact = branchRemovalImpact(data, node.stationId);
        return (
          <Confirm
            ar={ar}
            blocked={impact.blocked}
            text={impact.blocked ? "" : (ar
              ? `يُزال «${node.name}» الآن، وينتقل إلى «${impact.targetName}»: ${impact.people} موظف، ${impact.seats} منصب، ${impact.children} وحدة تابعة، ومهامه وسجلات السلامة. تُنهى التكليفات السارية عليه. لا رجوع عن الإزالة.`
              : `“${node.name}” is removed now; ${impact.people} people, ${impact.seats} seats, ${impact.children} sub-units, its tasks and safety records move to “${impact.targetName}”. Running acting roles on it end. This cannot be undone.`)}
            cta={ar ? "أزل الفرع" : "Remove the branch"}
            onCancel={() => setActive("")}
            onConfirm={() => {
              const removed = deleteStationWithData(companyId, node.stationId, { mode: "transfer", targetStationId: impact.targetId });
              if (!removed) { setGate(fail({ ar: "تعذّرت إزالة الفرع.", en: "Could not remove the branch." })); return; }
              onDone?.({ keys: [branchKey(impact.targetId)], expand: branchKey(impact.targetId), removed: node.key });
              onClose();
            }}
          />
        );
      }
      default:
        return null;
    }
  };

  const who = branch ? node.name : (node.vacant ? (ar ? "منصب شاغر" : "Open seat") : node.name);
  return (
    <OrgDrawer label={ar ? `إدارة ${who}` : `Manage ${who}`} onClose={onClose} width={460}>
      <DrawerHead
        ar={ar}
        onClose={onClose}
        lead={<span className="nv-od-initials" data-vacant={node.vacant ? "1" : "0"} aria-hidden style={{ width: 36, height: 36, fontSize: 12 }}>{branch ? "⌂" : node.vacant ? "＋" : initialsOf(node.name)}</span>}
        title={who}
        sub={[node.title, branch ? "" : node.unit].filter(Boolean).join(" · ")}
      />
      <div className="nv-oap">
        {!rights.canManage ? <Note>{ar ? rights.reason.ar : rights.reason.en}</Note> : null}
        {groups.map((g) => (
          <section key={g.id} className="nv-oap-group" aria-label={ar ? g.ar : g.en}>
            <h3 className="nv-oap-group__head">{ar ? g.ar : g.en}</h3>
            {g.items.map((it) => (
              <div key={it.id} className="nv-oap-item" data-open={active === it.id ? "1" : "0"}>
                <button
                  type="button"
                  className="nv-oap-action"
                  data-destructive={it.destructive ? "1" : "0"}
                  aria-disabled={it.blocked ? "true" : undefined}
                  aria-expanded={it.form && !["moveSheet", "file", "branchDrawer", "addUnit", "decision"].includes(it.form) ? active === it.id : undefined}
                  onClick={() => run(it)}
                >
                  <span>{ar ? it.ar : it.en}</span>
                  {it.blocked ? <span className="nv-oap-why">{ar ? it.blocked.ar : it.blocked.en}</span> : null}
                </button>
                {form(it)}
                {active === it.id ? <GateLine gate={gate} ar={ar} /> : null}
              </div>
            ))}
          </section>
        ))}
        {!branch && node.employeeId ? (
          <button type="button" style={btnGhost({ alignSelf: "flex-start" })} onClick={() => { onOpenFile?.(node); onClose(); }}>{ar ? "ملف الموظف الكامل" : "Full employee file"}</button>
        ) : null}
      </div>
    </OrgDrawer>
  );
}
