import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "@/components/ui/use-toast";
import { renameCompany } from "@/lib/companySettings";
import {
  assignBranchHrManager,
  branchHrManager,
  createOrgBranch,
  findEmployeeByName,
  listBranchHrManagers,
  renameOrgBranch,
  setOrgBranchParent,
  setOrgUnitKind,
} from "@/lib/orgHire";
import { explainWorkplaceManager } from "@/lib/peopleTree";
import { setStationManager } from "@/lib/store";
import { deleteStationWithData } from "@/lib/stationData";
import {
  allowedStationParents,
  companyRootStation,
  effectiveUnitKind,
  isCompanyRootStation,
  isHrUnit,
  isManagerUnit,
  stationParentId,
  stationSubtreeIds,
} from "@/lib/stationTree";

const FIELD = {
  height: 34,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid var(--nv-line)",
  fontSize: 12,
  color: "var(--nv-ink)",
  outline: "none",
  background: "var(--nv-card)",
  fontFamily: "inherit",
  width: "100%",
  boxSizing: "border-box",
};

const NOTE = {
  fontSize: 11,
  color: "var(--nv-ink2)",
  background: "var(--nv-hover)",
  border: "1px solid var(--nv-line)",
  padding: "9px 11px",
  borderRadius: 12,
  lineHeight: 1.8,
};

const LABEL = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  fontSize: 11,
  color: "var(--nv-ink3)",
};

function SectionLabel({ children }) {
  return (
    <span style={{ fontSize: 10, letterSpacing: "0.14em", color: "var(--nv-ink3)", fontWeight: 600 }}>
      {children}
    </span>
  );
}

function FormError({ text }) {
  if (!text) return null;
  return (
    <div style={{ fontSize: 11, color: "var(--nv-bad-ink)", background: "var(--nv-bad-soft)", border: "1px solid var(--nv-bad-line)", padding: "8px 11px", borderRadius: 12 }}>
      {text}
    </div>
  );
}

function actionButton(background, color = "#fff") {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 36,
    borderRadius: 8,
    background,
    color,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    border: 0,
    fontFamily: "inherit",
    width: "100%",
  };
}

function parentError(code, ar) {
  if (code === "CYCLE_FORBIDDEN") return ar ? "لا يمكن نقل الفرع تحت فرع يتبعه" : "A branch cannot move under a branch that reports to it.";
  if (code === "COMPANY_ROOT") return ar ? "المنشأة هي الفرع الرئيسي ولا تتبع فرعاً آخر." : "The company apex cannot hang under another branch.";
  if (code === "FIXED_HR") return ar ? "وحدة الموارد البشرية ثابتة ولا تُنقل." : "The HR unit is fixed and cannot be moved.";
  if (code === "HR_NOT_PARENT") return ar ? "الفروع لا تتبع وحدة الموارد البشرية." : "Branches do not report to the HR unit.";
  if (code === "PARENT_NOT_FOUND") return ar ? "الجهة الأعلى غير موجودة." : "That parent is not on the tree.";
  return ar ? "تعذّر نقل الفرع." : "Could not move the branch.";
}

function DrawerShell({ ar, title, sub, chain, onClose, children }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      role="presentation"
      className="nv-v7-portal"
      dir={ar ? "rtl" : "ltr"}
      style={{ position: "fixed", inset: 0, zIndex: 490, display: "flex", justifyContent: "flex-start" }}
    >
      <div
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
        style={{ position: "absolute", inset: 0, background: "rgba(11,61,39,.32)" }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          position: "relative",
          width: "min(94vw, 420px)",
          height: "100%",
          background: "var(--nv-card)",
          borderInlineEnd: "1px solid var(--nv-line)",
          boxShadow: "0 0 40px rgba(6,61,38,.16)",
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
      >
        <div style={{ padding: "16px 18px", borderTop: "3px solid var(--nv-navy)", borderBottom: "1px solid var(--nv-line)", background: "var(--nv-hover)", display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <strong style={{ font: "700 16px 'Readex Pro', var(--font-heading), sans-serif", color: "var(--nv-ink)" }}>{title}</strong>
            <span style={{ flex: 1 }} />
            <button
              type="button"
              onClick={onClose}
              style={{ all: "unset", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "var(--nv-ink2)", fontFamily: "inherit" }}
            >
              {ar ? "إغلاق" : "Close"}
            </button>
          </div>
          {sub ? <span style={{ fontSize: 11.5, color: "var(--nv-ink2)" }}>{sub}</span> : null}
          {chain ? <span style={{ fontSize: 11, color: "var(--nv-ink3)" }}>{chain}</span> : null}
        </div>
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {children}
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function stationChain(stations, station) {
  const names = [];
  const byId = new Map((stations || []).map((item) => [String(item.id), item]));
  let current = station;
  const seen = new Set();
  while (current && !seen.has(String(current.id))) {
    seen.add(String(current.id));
    names.unshift(current.name || "");
    const parent = stationParentId(current);
    current = parent ? byId.get(String(parent)) : null;
  }
  return names.filter(Boolean).join(" ← ");
}

function occupiedCount(data, stationId) {
  const ids = new Set(stationSubtreeIds(data?.stations || [], stationId).map(String));
  return (data?.employees || []).filter((employee) => (
    employee
    && employee.role !== "system"
    && employee.active !== false
    && employee.profile?.employmentStatus !== "terminated"
    && ids.has(String(employee.stationId || ""))
  )).length;
}

export function OrgBranchDrawer({
  open,
  station = null,
  data = null,
  companyId = "",
  companyName = "",
  ar = true,
  canWrite = false,
  onHire,
  onAddChild,
  onClose,
  onDeleted,
}) {
  const stationId = String(station?.id || "");
  const isRoot = isCompanyRootStation(station);
  const fixedHr = isHrUnit(station);
  const kind = isRoot ? "branch" : effectiveUnitKind(station);
  const [name, setName] = useState(station?.name || "");
  const [moveSel, setMoveSel] = useState("");
  const [hrSel, setHrSel] = useState("");
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);

  useEffect(() => {
    setName(station?.name || "");
    setMoveSel("");
    setHrSel("");
    setErr("");
    setConfirmDel(false);
  }, [stationId, station?.name]);

  const people = useMemo(
    () => (data?.employees || []).filter((employee) => employee?.name && employee.role !== "system" && employee.active !== false),
    [data],
  );
  const managerId = String(station?.managerId || "");
  const manager = people.find((employee) => String(employee.id) === managerId) || null;
  const parentId = String(stationParentId(station) || "");
  const parent = (data?.stations || []).find((item) => String(item.id) === parentId) || null;
  const root = companyRootStation(data?.stations || []);
  const hrCurrent = branchHrManager(data, stationId);
  const hrOptions = useMemo(() => listBranchHrManagers(data), [data]);
  const moveOptions = useMemo(() => {
    if (!station || isRoot) return [];
    return allowedStationParents(data?.stations || [], stationId)
      .filter((item) => String(item.id) !== parentId)
      .map((item) => ({
        id: String(item.id),
        label: isCompanyRootStation(item)
          ? `${item.name || companyName} (${ar ? "مستوى أول" : "top level"})`
          : `${ar ? "تحت" : "Under"} ${item.name || ""}`,
      }));
  }, [station, isRoot, data?.stations, stationId, parentId, companyName, ar]);
  const occupied = station ? occupiedCount(data, stationId) : 0;
  const parentName = parent?.name || root?.name || companyName || "—";
  const managerNote = managerId ? explainWorkplaceManager(data, managerId, { ar }) : null;
  const sub = manager?.name || (ar ? "شاغرة" : "Vacant");
  const chain = station ? stationChain(data?.stations || [], station) : "";

  if (!open || !station || !canWrite) return null;

  const saveName = async () => {
    const next = name.trim();
    if (!companyId || !next || next === String(station.name || "").trim()) return;
    if (isRoot) {
      const saved = await renameCompany(companyId, next);
      if (!saved) {
        setErr(ar ? "تعذّر تعديل اسم المنشأة." : "Could not rename the company.");
        return;
      }
      setErr("");
      toast({ description: ar ? `صار اسم المنشأة «${next}».` : `Company renamed to “${next}”.` });
      return;
    }
    const result = renameOrgBranch(companyId, stationId, next);
    if (!result.ok) {
      setErr(result.error === "DUP"
        ? (ar ? "هذا الاسم مستخدم لفرع آخر." : "That name is already used by another branch.")
        : (ar ? "تعذّر تعديل اسم الفرع." : "Could not rename the branch."));
      return;
    }
    setErr("");
    toast({ description: ar ? `صار اسم الفرع «${next}».` : `Branch renamed to “${next}”.` });
  };

  const saveKind = (next) => {
    if (!companyId || isRoot || next === kind) return;
    const result = setOrgUnitKind(companyId, stationId, next);
    if (!result.ok) {
      setErr(result.error === "COMPANY_ROOT"
        ? (ar ? "رأس المنشأة فرع رئيسي دائمًا." : "The company apex stays a branch.")
        : (ar ? "تعذّر تغيير نوع العقدة." : "Could not change the node kind."));
      return;
    }
    setErr("");
    toast({
      description: next === "manager"
        ? (ar ? "صار إدارة: يظهر في الشجرة وليس مكان توظيف." : "Now an admin seat: on the tree, not a hire workplace.")
        : (ar ? "صار فرعًا: يمكنك التوظيف عليه الآن." : "Now a branch: you can hire on it now."),
    });
  };

  const saveManager = (employeeId) => {
    if (!companyId) return;
    const result = setStationManager(companyId, stationId, employeeId || null);
    if (!result?.ok) {
      setErr(ar ? "تعذّر حفظ المدير." : "Could not save the manager.");
      return;
    }
    setErr("");
    const note = employeeId ? explainWorkplaceManager(data, employeeId, { ar }) : null;
    toast({
      description: note?.line
        || (employeeId
          ? (ar ? "حُفظ مدير الفرع." : "Branch manager saved.")
          : (ar ? "أُزيل المدير." : "Manager cleared.")),
    });
  };

  const saveHr = () => {
    if (!hrSel) {
      setErr(ar ? "اختر مدير موارد بشرية" : "Choose an HR manager");
      return;
    }
    const result = assignBranchHrManager(companyId, stationId, hrSel);
    if (!result.ok) {
      const hrError = {
        NOT_HR: ar ? "هذا الموظف ليس مدير موارد بشرية إقليمياً." : "That person is not a regional HR manager.",
        HR_SPAN: ar ? "المدير الإقليمي يخدم ثلاثة فروع كحد أقصى." : "A regional HR manager serves at most three branches.",
        BRANCH_MANAGER: ar ? "مدير الفرع لا يكون مدير الموارد البشرية. الموارد البشرية تراجع قراره." : "A branch manager cannot be the HR manager. HR reviews that person's decisions.",
        DIRECTOR: ar ? "مديرة الموارد البشرية تتبع الرئيس التنفيذي ولا تُربط بفرع." : "The HR director reports to the CEO and is not linked to a branch.",
      };
      setErr(hrError[result.error] || (ar ? "تعذّر تعيين مدير الموارد البشرية." : "Could not assign the HR manager."));
      return;
    }
    setHrSel("");
    setErr("");
    toast({ description: ar ? "عُيّن مدير الموارد البشرية للفرع." : "HR manager assigned to the branch." });
  };

  const moveBranch = () => {
    if (!moveSel) {
      setErr(ar ? "اختر الجهة الأعلى" : "Choose the parent");
      return;
    }
    const result = setOrgBranchParent(companyId, stationId, moveSel);
    if (!result.ok) {
      setErr(parentError(result.error, ar));
      return;
    }
    setMoveSel("");
    setErr("");
    toast({ description: ar ? "نُقل الفرع." : "Branch moved." });
  };

  const removeBranch = () => {
    const target = parentId || root?.id || "";
    if (!target || target === stationId) {
      setErr(ar ? "لا جهة تستقبل الوظائف المشغولة." : "There is no parent to receive the occupied seats.");
      return;
    }
    const removed = deleteStationWithData(companyId, stationId, { mode: "transfer", targetStationId: target });
    if (!removed) {
      setErr(ar ? "تعذّرت إزالة الفرع." : "Could not remove the branch.");
      return;
    }
    toast({ description: ar ? `أُزيل «${station.name || ""}».` : `Removed “${station.name || ""}”.` });
    onDeleted?.(stationId, target);
  };

  const kindButton = (value, label) => {
    const on = kind === value;
    return (
      <button
        type="button"
        onClick={() => saveKind(value)}
        style={{
          cursor: "pointer",
          boxSizing: "border-box",
          width: "100%",
          height: 36,
          borderRadius: 8,
          textAlign: "center",
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "inherit",
          background: on ? "var(--nv-navy)" : "var(--nv-card)",
          color: on ? "#fff" : "var(--nv-ink2)",
          border: `1px solid ${on ? "var(--nv-navy)" : "var(--nv-line)"}`,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <DrawerShell
      ar={ar}
      title={station.name || (ar ? "فرع" : "Branch")}
      sub={isRoot ? (ar ? "فرع المقر الرئيسي" : "Head-office branch") : sub}
      chain={chain}
      onClose={onClose}
    >
      <label style={LABEL}>
        {ar ? "اسم الفرع" : "Branch name"}
        <input
          value={name}
          onChange={(event) => { setName(event.target.value); setErr(""); }}
          readOnly={isRoot || fixedHr}
          onBlur={saveName}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
          }}
          style={FIELD}
        />
      </label>

      <label style={LABEL}>
        {isRoot ? (ar ? "مدير المنشأة" : "Company manager") : fixedHr ? (ar ? "مديرة الموارد البشرية" : "HR director") : (ar ? "مدير الفرع" : "Branch manager")}
        <select
          value={managerId}
          onChange={(event) => saveManager(event.target.value)}
          style={{ ...FIELD, padding: "0 8px" }}
        >
          <option value="">{ar ? "بدون مدير" : "No manager"}</option>
          {people.map((employee) => (
            <option key={employee.id} value={employee.id}>{employee.name}</option>
          ))}
        </select>
      </label>
      {managerNote?.line ? (
        <span style={{ fontSize: 11, color: "var(--nv-ink3)", lineHeight: 1.7 }}>{managerNote.line}</span>
      ) : isManagerUnit(station) ? (
        <span style={{ fontSize: 11, color: "var(--nv-ink3)", lineHeight: 1.7 }}>
          {ar ? "هذه الإدارة ليست مكان توظيف أو حضور." : "This admin seat is not a hire or attendance workplace."}
        </span>
      ) : null}

      {fixedHr ? (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 12, background: "var(--nv-accent-soft)", border: "1px solid #C5DBCD", fontSize: 11.5, color: "var(--nv-ink)", lineHeight: 1.8 }}>
          <span style={{ fontSize: 14, lineHeight: 1.4 }}>🔒</span>
          <span>
            <strong>{ar ? "وحدة الموارد البشرية" : "HR unit"}</strong>
            {ar
              ? " — ثابتة تحت الرئيس التنفيذي: لا تُحذف ولا تُنقل. يتغيّر الشخص الذي يشغل المنصب فقط. موظفو الفروع لا يظهرون تحتها."
              : " — fixed under the CEO. It is not moved or removed. Only the person in the seat changes. Branch employees do not sit under it."}
          </span>
        </div>
      ) : !isRoot ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          {kindButton("branch", ar ? "فرع" : "Branch")}
          {kindButton("manager", ar ? "إدارة" : "Admin")}
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 12, background: "var(--nv-hover)", border: "1px solid var(--nv-ok-line)", fontSize: 11.5, color: "var(--nv-ink)", lineHeight: 1.8 }}>
          <span style={{ fontSize: 14, lineHeight: 1.4 }}>🔒</span>
          <span>
            <strong>{ar ? "فرع المقر الرئيسي" : "Head office"}</strong>
            {ar
              ? " — وحدة ثابتة في الهيكل: لا تُحذف ولا تُنقل. يتغيّر الاسم والمدير فقط."
              : " — a fixed unit: it is not moved or removed. Only the name and manager change."}
          </span>
        </div>
      )}

      {!isRoot && !fixedHr ? (
      <>
      <SectionLabel>{ar ? "مدير الموارد البشرية لهذا الفرع" : "HR manager for this branch"}</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", border: "1px solid var(--nv-line)", borderRadius: 12, fontSize: 11.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ color: "var(--nv-ink3)" }}>{ar ? "الحالي" : "Current"}</span>
          <strong>{hrCurrent ? `${hrCurrent.name}` : (ar ? "لا يوجد" : "None")}</strong>
        </div>
        <select value={hrSel} onChange={(event) => { setHrSel(event.target.value); setErr(""); }} style={{ ...FIELD, height: 34, borderRadius: 8, fontSize: 11.5, padding: "0 8px" }}>
          <option value="">{ar ? "— اختر مديراً إقليمياً —" : "— Choose a regional HR manager —"}</option>
          {hrOptions.map((employee) => {
            const seat = (data?.orgSeats || []).find((item) => String(item.employeeId || "") === String(employee.id));
            const title = seat?.title || employee.profile?.position || employee.position || "";
            return (
              <option key={employee.id} value={employee.id}>
                {title ? `${title} — ${employee.name}` : employee.name}
              </option>
            );
          })}
        </select>
        <button type="button" onClick={saveHr} style={actionButton("var(--nv-ok-ink)")}>
          {ar ? "ربط الفرع بمديره الإقليمي" : "Link the branch to its regional HR manager"}
        </button>
        <span style={{ fontSize: 10.5, color: "var(--nv-ink3)" }}>
          {ar
            ? "مدير واحد يخدم فرعين أو ثلاثة. الخط الثابت إلى مديرة الموارد البشرية، والخط المتقطع إلى مدير الفرع للتنسيق والجدول."
            : "One manager serves two or three branches. The solid line goes to the HR director, and the dotted line to the branch manager for the roster."}
        </span>
      </div>
      </>
      ) : null}

      {!isRoot && !fixedHr ? (
        <>
          <SectionLabel>{ar ? "تبعية الفرع" : "Branch parent"}</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", border: "1px solid var(--nv-line)", borderRadius: 12, fontSize: 11.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ color: "var(--nv-ink3)" }}>{ar ? "يتبع الآن" : "Reports to"}</span>
              <strong>{parent?.name || root?.name || companyName || "—"}</strong>
            </div>
            <select value={moveSel} onChange={(event) => { setMoveSel(event.target.value); setErr(""); }} style={{ ...FIELD, height: 34, borderRadius: 8, fontSize: 11.5, padding: "0 8px" }}>
              <option value="">{ar ? "— انقل تحت —" : "— Move under —"}</option>
              {moveOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <button type="button" onClick={moveBranch} style={actionButton("var(--nv-navy)")}>
              {ar ? "نقل الفرع" : "Move branch"}
            </button>
            <span style={{ fontSize: 10.5, color: "var(--nv-ink3)" }}>
              {ar
                ? "الفرع ينتقل بكل وظائفه وموظفيه. لا يمكن نقله تحت فرع يتبعه، وربط الموارد البشرية لا يتغيّر. يُسجَّل في سجل الأحداث."
                : "The branch moves with its seats and people. It cannot move under its own descendant. The HR link stays. The event log records it."}
            </span>
          </div>

          {onAddChild ? (
            <button type="button" onClick={() => onAddChild(stationId)} style={actionButton("var(--nv-navy)")}>
              {ar ? "فرع تابع" : "Child branch"}
            </button>
          ) : null}

          {isManagerUnit(station) ? (
            <div style={NOTE}>
              {ar ? "إدارة — ليست مكان توظيف. وظّف على فرع تشغيلي تحتها." : "Admin — not a hire workplace. Hire on a workplace branch under it."}
            </div>
          ) : onHire ? (
            <button type="button" onClick={() => onHire({ stationId })} style={actionButton("var(--nv-ok-ink)")}>
              {ar ? "وظّف على مقعد" : "Hire onto a seat"}
            </button>
          ) : null}

          <SectionLabel>{ar ? "إزالة الفرع" : "Remove branch"}</SectionLabel>
          <div style={NOTE}>
            {ar ? (
              <>
                إزالة الفرع تحذفه وتنقل ما تحته إلى <strong>{parentName}</strong>. الوظائف المشغولة تحته: <strong>{occupied}</strong> — تنتقل بموظفيها، ولا يُفصل أحد. كل ذلك يُسجَّل في سجل التدقيق.
              </>
            ) : (
              <>
                Removing the branch deletes it and moves what is under it to <strong>{parentName}</strong>. Occupied seats: <strong>{occupied}</strong> — people move with them. The audit log records it.
              </>
            )}
          </div>
          {confirmDel ? (
            <>
              <div style={{ background: "var(--nv-bad-soft)", border: "1px solid var(--nv-bad-line)", borderRadius: 12, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 3 }}>
                <strong style={{ fontSize: 12, color: "var(--nv-bad-ink)" }}>
                  {ar ? `هل أنت متأكد من إزالة «${station.name || ""}»؟` : `Remove “${station.name || ""}”?`}
                </strong>
                <span style={{ fontSize: 11, color: "var(--nv-bad-ink)", lineHeight: 1.8 }}>
                  {ar ? "الإزالة لا تُلغى، وتبقى مسجّلة في سجل الأحداث باسم من نفّذها وتاريخه." : "Removal is kept in the event log with who did it and when."}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={removeBranch} style={{ ...actionButton("var(--nv-bad-ink)"), flex: 1, fontWeight: 700 }}>
                  {ar ? "نعم، أزل الفرع" : "Yes, remove the branch"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDel(false)}
                  style={{ ...actionButton("#fff", "var(--nv-ink2)"), width: "auto", padding: "0 14px", border: "1px solid var(--nv-line)", fontWeight: 600 }}
                >
                  {ar ? "إلغاء" : "Cancel"}
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => { setConfirmDel(true); setErr(""); }}
              style={{ ...actionButton("#fff", "var(--nv-bad-ink)"), height: 34, border: "1px solid var(--nv-bad-line)", fontWeight: 600 }}
            >
              {ar ? "إزالة الفرع…" : "Remove branch…"}
            </button>
          )}
        </>
      ) : onHire ? (
        <button type="button" onClick={() => onHire({ stationId })} style={actionButton("var(--nv-ok-ink)")}>
          {ar ? "وظّف على مقعد" : "Hire onto a seat"}
        </button>
      ) : null}

      <FormError text={err} />
    </DrawerShell>
  );
}

export function OrgAddBranchDrawer({
  open,
  initialParentId = "",
  data = null,
  company = null,
  companyId = "",
  companyName = "",
  ar = true,
  onClose,
  onCreated,
}) {
  const root = companyRootStation(data?.stations || []);
  const [parentId, setParentId] = useState(initialParentId || root?.id || "");
  const [name, setName] = useState("");
  const [person, setPerson] = useState("");
  const [kind, setKind] = useState("branch");
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setParentId(initialParentId || root?.id || "");
    setName("");
    setPerson("");
    setKind("branch");
    setErr("");
  }, [open, initialParentId, root?.id]);

  const parents = useMemo(() => {
    const rows = [];
    if (root?.id) {
      rows.push({ id: String(root.id), label: `${root.name || companyName} (${ar ? "مستوى أول" : "top level"})` });
    }
    (data?.stations || []).forEach((station) => {
      if (!station?.id || String(station.id) === String(root?.id || "") || isHrUnit(station)) return;
      rows.push({ id: String(station.id), label: `${ar ? "تحت" : "Under"} ${station.name || ""}` });
    });
    return rows;
  }, [data?.stations, root, companyName, ar]);

  if (!open) return null;

  const create = () => {
    const title = name.trim();
    if (!title) {
      setErr(ar ? "اكتب اسم الفرع" : "Enter the branch name");
      return;
    }
    const managerName = person.trim();
    const manager = managerName ? findEmployeeByName(data, managerName) : null;
    if (managerName && !manager?.id) {
      setErr(ar ? "مدير الفرع يجب أن يكون موظفاً مسجّلاً بالاسم الكامل، أو اترك الحقل فارغاً." : "The manager must be a registered employee, full name — or leave the field empty.");
      return;
    }
    const result = createOrgBranch(companyId, title, company, data, parentId, kind);
    if (!result.ok) {
      setErr(result.error === "LIMIT"
        ? (ar ? "بلغت حد الفروع في الخطة." : "Branch limit reached.")
        : result.error === "PARENT"
          ? (ar ? "الفرع الأب غير موجود." : "Parent branch not found.")
          : (ar ? "تعذّر إنشاء الفرع." : "Could not create the branch."));
      return;
    }
    if (manager?.id && result.stationId) {
      const assigned = setStationManager(companyId, result.stationId, manager.id);
      if (!assigned?.ok) {
        toast({
          description: ar
            ? `أُنشئ «${title}» وتعذّر تعيين المدير.`
            : `“${title}” was created and the manager could not be assigned.`,
          variant: "destructive",
        });
        onCreated?.(result.stationId);
        return;
      }
    }
    toast({
      description: kind === "manager"
        ? (ar ? `أُضيفت إدارة «${title}».` : `Admin seat “${title}” added.`)
        : (ar ? `أُنشئ فرع «${title}».` : `Branch “${title}” created.`),
    });
    onCreated?.(result.stationId);
  };

  const kindButton = (value, label) => {
    const on = kind === value;
    return (
      <button
        type="button"
        onClick={() => setKind(value)}
        style={{
          cursor: "pointer",
          boxSizing: "border-box",
          width: "100%",
          height: 36,
          borderRadius: 8,
          textAlign: "center",
          fontSize: 12,
          fontWeight: 600,
          fontFamily: "inherit",
          background: on ? "var(--nv-navy)" : "var(--nv-card)",
          color: on ? "#fff" : "var(--nv-ink2)",
          border: `1px solid ${on ? "var(--nv-navy)" : "var(--nv-line)"}`,
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <DrawerShell
      ar={ar}
      title={ar ? "إضافة فرع" : "Add branch"}
      sub={ar ? "اختر الجهة الأعلى ثم الاسم" : "Choose the parent, then the name"}
      onClose={onClose}
    >
      <SectionLabel>{ar ? "فرع جديد" : "New branch"}</SectionLabel>
      <label style={LABEL}>
        {ar ? "يتبع (الجهة الأعلى)" : "Reports to"}
        <select value={parentId} onChange={(event) => setParentId(event.target.value)} style={{ ...FIELD, padding: "0 8px" }}>
          {parents.map((option) => (
            <option key={option.id} value={option.id}>{option.label}</option>
          ))}
        </select>
      </label>
      <label style={LABEL}>
        {ar ? "اسم الفرع" : "Branch name"}
        <input
          value={name}
          onChange={(event) => { setName(event.target.value); setErr(""); }}
          placeholder={ar ? "مثال: فرع الرس" : "Example: Rass branch"}
          style={FIELD}
        />
      </label>
      <label style={LABEL}>
        {ar ? "مدير الفرع (اختياري — يبقى شاغراً إن تُرك)" : "Branch manager (optional — stays vacant if empty)"}
        <input
          value={person}
          onChange={(event) => { setPerson(event.target.value); setErr(""); }}
          placeholder={ar ? "اسم المدير" : "Manager name"}
          style={FIELD}
        />
      </label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {kindButton("branch", ar ? "فرع" : "Branch")}
        {kindButton("manager", ar ? "إدارة" : "Admin")}
      </div>
      <div style={NOTE}>
        {ar
          ? "يُنشأ الفرع تحت الجهة المختارة. إن تُرك اسم المدير فارغاً يبقى مدير الفرع شاغراً، والتوظيف على المقاعد من بطاقاتها."
          : "The branch is created under the chosen parent. An empty manager stays vacant. Hire onto seats from their cards."}
      </div>
      <FormError text={err} />
      <button type="button" onClick={create} style={actionButton("var(--nv-navy)")}>
        {ar ? "إنشاء الفرع" : "Create branch"}
      </button>
    </DrawerShell>
  );
}
