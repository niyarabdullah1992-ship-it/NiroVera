import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "@/components/ui/use-toast";
import { renameCompany } from "@/lib/companySettings";
import {
  assignBranchHrManager,
  branchHrManager,
  clearBranchHrManager,
  createOrgBranch,
  findEmployeeByName,
  listBranchHrCandidates,
  renameOrgBranch,
  setStationLocation,
  setOrgBranchParent,
  setOrgUnitKind,
} from "@/lib/orgHire";
import { explainWorkplaceManager } from "@/lib/peopleTree";
import { setStationManager } from "@/lib/store";
import { deleteStationWithData } from "@/lib/stationData";
import { DEFAULT_COUNTRY, stationPlace } from "@/lib/geoPlaces";
import LocationPicker, { placeLine } from "@/components/hr/orgdesign/LocationPicker";
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
import NvIcon from "@/components/shared/NvIcon";
import { fieldBranchesForHr } from "@/lib/hrTree";

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
        style={{ position: "absolute", inset: 0, background: "color-mix(in oklab, var(--nv-navy) 26%, transparent)" }}
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
          boxShadow: "0 18px 44px var(--nv-shadow)",
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
        }}
      >
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--nv-line)", background: "var(--nv-hover)", display: "flex", flexDirection: "column", gap: 4 }}>
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

const HR_ERRORS = (ar) => ({
  NOT_HR: ar ? "هذا الموظف ليس من الموارد البشرية." : "That person is not in HR.",
  HR_SPAN: ar ? "مدير الموارد البشرية يخدم ثلاثة فروع كحد أقصى." : "An HR manager serves at most three branches.",
  BRANCH_MANAGER: ar ? "مدير الفرع لا يكون مدير الموارد البشرية. الموارد البشرية تراجع قراره." : "A branch manager cannot be the HR manager.",
  DIRECTOR: ar ? "مدير الموارد البشرية للقسم لا يُربط بفرع." : "The HR director is not linked to a branch.",
});

/** «الموارد البشرية»: the unit director over all branches, then one HR manager per branch — picked from the company or hired new. */
function BranchHrAssignments({ data, companyId, ar, canWrite, onError, onHire, hrUnitId }) {
  const branches = useMemo(() => fieldBranchesForHr(data), [data]);
  const candidates = useMemo(() => listBranchHrCandidates(data), [data]);
  const director = useMemo(() => {
    const unit = (data?.stations || []).find((item) => String(item.id) === String(hrUnitId));
    return (data?.employees || []).find((employee) => String(employee.id) === String(unit?.managerId || "")) || null;
  }, [data, hrUnitId]);
  const [picked, setPicked] = useState({});
  const label = (employee) => {
    const seat = (data?.orgSeats || []).find((item) => String(item.employeeId || "") === String(employee.id));
    const title = seat?.title || employee.profile?.position || employee.position || "";
    const where = (data?.stations || []).find((item) => String(item.id) === String(employee.stationId || ""))?.name || "";
    return [employee.name, [title, where].filter(Boolean).join(" · ")].filter(Boolean).join(" — ");
  };
  const assign = (station) => {
    const eid = picked[station.id];
    if (!eid) return;
    if (eid === "__hire") {
      setPicked((cur) => ({ ...cur, [station.id]: "" }));
      onHire?.({ stationId: hrUnitId, hrBranchId: station.id });
      return;
    }
    const result = eid === "__none"
      ? clearBranchHrManager(companyId, station.id)
      : assignBranchHrManager(companyId, station.id, eid);
    if (!result.ok) { onError(HR_ERRORS(ar)[result.error] || (ar ? "تعذّر الحفظ." : "Could not save.")); return; }
    onError("");
    setPicked((cur) => ({ ...cur, [station.id]: "" }));
    toast({ description: eid === "__none"
      ? (ar ? `أُزيل مدير الموارد البشرية من ${station.name}.` : `HR manager cleared for ${station.name}.`)
      : (ar ? `عُيّن مدير الموارد البشرية لـ${station.name}.` : `HR manager set for ${station.name}.`) });
  };
  if (!branches.length) return <span style={{ fontSize: 11.5, color: "var(--nv-ink3)" }}>{ar ? "لا فروع بعد." : "No branches yet."}</span>;
  return (
    <div data-branch-hr-list="1" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div data-hr-director-row="1" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "11px 12px", borderRadius: 10, background: "var(--nv-accent-soft)", border: "1px solid var(--nv-ok-line, var(--nv-line))", fontSize: 11.5 }}>
        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 10.5, color: "var(--nv-ink3)", letterSpacing: 0.2 }}>{ar ? "مدير وحدة الموارد البشرية · لكل الفروع" : "HR unit director · all branches"}</span>
          <strong style={{ fontSize: 13 }}>{director ? director.name : (ar ? "شاغر" : "Vacant")}</strong>
        </span>
        <span style={{ fontSize: 10.5, color: "var(--nv-ink3)" }}>{ar ? "يرأس مدراء الفروع أدناه" : "Heads the branch managers below"}</span>
      </div>
      <span style={{ fontSize: 10.5, color: "var(--nv-ink3)", padding: "6px 2px 0" }}>{ar ? "مدراء الموارد البشرية للفروع — يتبعون مدير الوحدة" : "Branch HR managers — report to the unit director"}</span>
      {branches.map((station) => {
        const current = branchHrManager(data, station.id);
        const value = picked[station.id] || "";
        const hrList = candidates.hr.filter((employee) => String(employee.id) !== String(current?.id || ""));
        const companyList = candidates.company.filter((employee) => String(employee.id) !== String(current?.id || ""));
        return (
          <div key={station.id} data-branch-hr-row={station.id} style={{ display: "flex", flexDirection: "column", gap: 6, padding: "9px 11px", border: "1px solid var(--nv-line)", borderRadius: 10, fontSize: 11.5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
              <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <strong style={{ fontSize: 12.5 }}>{station.name}</strong>
                <span style={{ fontSize: 10, color: "var(--nv-ink3)" }}>{ar ? "مدير الموارد البشرية للفرع" : "Branch HR manager"}</span>
              </span>
              <span style={{ color: current ? "var(--nv-ink)" : "var(--nv-warn-ink, #8a5a00)", fontWeight: 600 }}>{current ? current.name : (ar ? "شاغر" : "Vacant")}</span>
            </div>
            {canWrite ? (
              <div style={{ display: "flex", gap: 6 }}>
                <select aria-label={ar ? `مدير الموارد البشرية لـ${station.name}` : `HR manager for ${station.name}`} value={value} onChange={(event) => setPicked((cur) => ({ ...cur, [station.id]: event.target.value }))} style={{ ...FIELD, height: 32, borderRadius: 8, fontSize: 11.5, padding: "0 8px", flex: 1, minWidth: 0 }}>
                  <option value="">{ar ? (current ? "— تغيير المدير —" : "— اختر مديراً —") : "— Choose —"}</option>
                  {onHire ? <option value="__hire">{ar ? "+ توظيف مدير جديد" : "+ Hire a new manager"}</option> : null}
                  {hrList.length ? (
                    <optgroup label={ar ? "من الموارد البشرية" : "From HR"}>
                      {hrList.map((employee) => <option key={employee.id} value={employee.id}>{label(employee)}</option>)}
                    </optgroup>
                  ) : null}
                  {companyList.length ? (
                    <optgroup label={ar ? "من موظفي المنشأة" : "From the company"}>
                      {companyList.map((employee) => <option key={employee.id} value={employee.id}>{label(employee)}</option>)}
                    </optgroup>
                  ) : null}
                  {current ? <option value="__none">{ar ? "إزالة المدير" : "Clear"}</option> : null}
                </select>
                <button type="button" disabled={!value} onClick={() => assign(station)} style={{ ...actionButton("var(--nv-ok-ink)"), opacity: value ? 1 : 0.5, height: 32, flex: "0 0 auto", width: "auto", padding: "0 12px" }}>
                  {value === "__hire" ? (ar ? "توظيف" : "Hire") : (ar ? "حفظ" : "Save")}
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
      <span style={{ fontSize: 10.5, color: "var(--nv-ink3)", lineHeight: 1.8 }}>
        {ar
          ? "لكل فرع مدير موارد بشرية واحد، يُختار من الموارد البشرية أو من أي موظف في المنشأة أو يُوظَّف جديداً، ويحمل مسمّى «مدير موارد بشرية». يخدم المدير ثلاثة فروع كحد أقصى، ويظهر اسمه في ملف كل موظف في الفرع. ولمدير أي فرع أن يوظّف تحته موظفي موارد بشرية للفرع."
          : "Each branch has one HR manager, picked from HR, from anyone in the company, or hired new. One manager serves up to three branches. Any branch manager may also have HR staff under them."}
      </span>
    </div>
  );
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
  const [err, setErr] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const known = stationPlace(station);
  const [place, setPlace] = useState({ countryCode: known.countryCode || DEFAULT_COUNTRY, city: known.city, cityRegion: known.cityRegion });

  useEffect(() => {
    const p = stationPlace(station);
    setPlace({ countryCode: p.countryCode || DEFAULT_COUNTRY, city: p.city, cityRegion: p.cityRegion });
    setName(station?.name || "");
    setMoveSel("");
    setErr("");
    setConfirmDel(false);
  }, [stationId, station?.name, station?.city, station?.countryCode]);

  /* «الموقع»: country and city — the tree regroups by city at once */
  const saveLocation = () => {
    const result = setStationLocation(companyId, stationId, place);
    if (!result.ok) { setErr(ar ? result.reason : (result.reasonEn || result.reason)); return; }
    setErr("");
    toast({ description: ar ? `«${station?.name || ""}» في ${result.place.city || "—"}.` : `“${station?.name || ""}” is in ${result.place.city || "—"}.` });
  };

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
      {canWrite && !fixedHr ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <SectionLabel>{ar ? "الموقع" : "Location"}</SectionLabel>
          {known.city ? (
            <div style={NOTE}>
              {placeLine(known, ar)}
              {known.derived ? (ar ? " — مقروءة من الاسم، لم تُحفظ بعد" : " — read from the name, not saved yet") : ""}
            </div>
          ) : null}
          <LocationPicker ar={ar} value={place} required={!isManagerUnit(station)} onChange={(next) => { setPlace(next); setErr(""); }} />
          <button type="button" onClick={saveLocation} style={actionButton("var(--nv-navy)")}>{ar ? "حفظ الموقع" : "Save location"}</button>
        </div>
      ) : null}

      <label style={LABEL}>
        {isRoot ? (ar ? "مدير المنشأة" : "Company manager") : fixedHr ? (ar ? "مدير وحدة الموارد البشرية (لكل الفروع)" : "HR unit director (all branches)") : (ar ? "مدير الفرع" : "Branch manager")}
        <select
          value={managerId}
          onChange={(event) => saveManager(event.target.value)}
          style={{ ...FIELD, padding: "0 8px" }}
        >
          <option value="">{ar ? "بدون مدير" : "No manager"}</option>
          {people.map((employee) => {
            // name — title · branch: two people with one name are told apart
            const seat = (data?.orgSeats || []).find((item) => String(item.employeeId || "") === String(employee.id));
            const title = seat?.title || employee.profile?.position || employee.customTitle || "";
            const home = (data?.stations || []).find((item) => String(item.id) === String(employee.stationId || ""))?.name || "";
            const tail = [title, home].filter(Boolean).join(" · ");
            return <option key={employee.id} value={employee.id}>{tail ? `${employee.name} — ${tail}` : employee.name}</option>;
          })}
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
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 12, background: "var(--nv-accent-soft)", border: "1px solid var(--nv-line)", fontSize: 11.5, color: "var(--nv-ink)", lineHeight: 1.8 }}>
          <span style={{ display: "inline-flex", paddingTop: 4, color: "var(--nv-muted)" }}><NvIcon name="lock" size={14} inline={false} /></span>
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
          <span style={{ display: "inline-flex", paddingTop: 4, color: "var(--nv-muted)" }}><NvIcon name="lock" size={14} inline={false} /></span>
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
      <div data-branch-hr-readonly="1" style={{ display: "flex", flexDirection: "column", gap: 4, padding: "10px 12px", border: "1px solid var(--nv-line)", borderRadius: 12, fontSize: 11.5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
          <span style={{ color: "var(--nv-ink3)" }}>{ar ? "الحالي" : "Current"}</span>
          <strong>{hrCurrent ? `${hrCurrent.name}` : (ar ? "شاغر" : "Vacant")}</strong>
        </div>
        <span style={{ fontSize: 10.5, color: "var(--nv-ink3)" }}>
          {ar ? "يُعيَّن من بطاقة «وحدة الموارد البشرية» في الهيكل." : "Set from the «HR unit» card in the structure."}
        </span>
      </div>
      </>
      ) : null}

      {fixedHr ? (
        <>
          <SectionLabel>{ar ? "مدير الوحدة ومدراء الموارد البشرية للفروع" : "Unit director and branch HR managers"}</SectionLabel>
          <BranchHrAssignments data={data} companyId={companyId} ar={ar} canWrite={canWrite} onError={setErr} onHire={onHire} hrUnitId={stationId} />
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
  initialPlace = null,
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
  const [place, setPlace] = useState({ countryCode: DEFAULT_COUNTRY, city: "", cityRegion: "" });
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setParentId(initialParentId || root?.id || "");
    setName("");
    setPerson("");
    setKind("branch");
    setPlace({ countryCode: initialPlace?.countryCode || DEFAULT_COUNTRY, city: initialPlace?.city || "", cityRegion: initialPlace?.cityRegion || "" });
    setErr("");
  }, [open, initialParentId, root?.id, initialPlace?.city, initialPlace?.countryCode]);

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
    // a workplace says where it is; a region / admin unit may leave the city empty
    const where = kind === "branch" || place.city ? place : null;
    const result = createOrgBranch(companyId, title, company, data, parentId, kind, where);
    if (!result.ok) {
      if (result.reason) { setErr(ar ? result.reason : (result.reasonEn || result.reason)); return; }
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
      sub={ar ? "الجهة الأعلى، ثم الدولة والمدينة، ثم الاسم" : "Parent, then country and city, then the name"}
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
      <LocationPicker ar={ar} value={place} required={kind === "branch"} onChange={(next) => { setPlace(next); setErr(""); }} />
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
