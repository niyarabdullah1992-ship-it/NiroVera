import React, { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import {
  createListGrade,
  gradesForList,
  jobGradeLabel,
  removeListGrade,
  seedDefaultLadder,
} from "@/lib/jobGrades";
import {
  OWNER_ONLY_DEPARTMENTS,
  addListPosition,
  companyLists,
  createCompanyList,
  ensureCompanyListsFromTree,
  listPositions,
  removeListPosition,
  renameCompanyList,
  saveListPermissions,
  templateLabel,
} from "@/lib/permissionTemplates";
import { SMART_DEPARTMENTS, SMART_SECTION_GROUPS } from "@/lib/smartPositions";
import { BORDER, CARD, MUTED, NAVY, SURFACE } from "@/lib/platformStyles";
import { orgBtnGhost, orgBtnPrimary as orgBtnPrimaryStyle, orgInput } from "@/lib/orgWorkspaceStyles";
import { OrgAccessPanel, OrgSectionTitle } from "@/components/hr/OrgWorkspace";
import { downloadHireTemplate } from "@/lib/hireTemplate";

const GREEN = "hsl(154 79% 27%)";

const LEVELS = [
  { id: "hidden", ar: "مخفي", en: "Off" },
  { id: "view", ar: "قراءة", en: "View" },
  { id: "manage", ar: "إدارة", en: "Manage" },
];

function accessOf(permissions, id) {
  return permissions?.[id] && permissions[id] !== "hidden" ? permissions[id] : "hidden";
}

function grantedModules(permissions, ar) {
  return SMART_DEPARTMENTS
    .filter((department) => accessOf(permissions, department.id) !== "hidden")
    .map((department) => (ar ? department.ar : department.en));
}

export default function OrgListAccessBoard({ data, companyId, ar, canWrite, ownerMode = false, treeLists = [], wide = false, onHire }) {
  const stored = companyLists(data);
  const packs = useMemo(() => {
    const rows = [...stored];
    const have = new Set(rows.flatMap((pack) => [pack.ar, pack.en].filter(Boolean)));
    (treeLists || []).forEach((item) => {
      const name = String(item?.name || "").trim();
      if (!name || name === "عام" || name === "بلا فرع" || have.has(name)) return;
      rows.push({
        id: `tree_${name}`,
        ar: name,
        en: name,
        permissions: {},
        positions: (item.titles || [])
          .map((title) => String(title || "").trim())
          .filter((title) => title && title !== "—")
          .map((title, index) => ({ id: `tree_${name}_${index}`, title })),
      });
      have.add(name);
    });
    return rows;
  }, [stored, treeLists]);
  const [openId, setOpenId] = useState("");
  const [permOpen, setPermOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [gradeDraft, setGradeDraft] = useState("");

  useEffect(() => {
    if (!companyId) return;
    ensureCompanyListsFromTree(companyId, data, treeLists);
  }, [companyId, data, treeLists]);

  const resetDrafts = () => {
    setTitleDraft("");
    setGradeDraft("");
  };

  const realPack = (pack) => {
    if (!pack?.id?.startsWith("tree_")) return pack;
    const id = createCompanyList(companyId, pack.ar);
    return { ...pack, id: id || pack.id };
  };

  const renameList = (pack) => {
    if (!companyId || !canWrite) return;
    const name = renameDraft.trim();
    if (!name) {
      toast({ description: ar ? "أدخل اسم القائمة." : "Enter a list name.", variant: "destructive" });
      return;
    }
    if (name === templateLabel(pack, ar) || name === pack.ar || name === pack.en) return;
    const clash = packs.find((item) => item.id !== pack.id && (item.ar === name || item.en === name));
    if (clash) {
      toast({ description: ar ? "هذا الاسم مستخدم لقائمة أخرى." : "That name is already used by another list.", variant: "destructive" });
      return;
    }
    const persisted = realPack(pack);
    const result = renameCompanyList(companyId, persisted.id, name);
    if (!result.ok) {
      toast({
        description: result.error === "DUP"
          ? (ar ? "هذا الاسم مستخدم لقائمة أخرى." : "That name is already used by another list.")
          : (ar ? "تعذّر تعديل اسم القائمة." : "Could not rename the list."),
        variant: "destructive",
      });
      return;
    }
    setOpenId(result.id || persisted.id);
    toast({ description: ar ? `صار اسم القائمة «${name}».` : `List renamed to “${name}”.` });
  };

  const addList = () => {
    if (!companyId || !canWrite) return;
    const name = newName.trim();
    if (!name) {
      toast({ description: ar ? "أدخل اسم القائمة." : "Enter a list name.", variant: "destructive" });
      return;
    }
    const hit = packs.find((pack) => pack.ar === name || pack.en === name);
    if (hit) {
      setNewName("");
      setOpenId(hit.id);
      resetDrafts();
      toast({ description: ar ? "هذه القائمة موجودة." : "That list already exists." });
      return;
    }
    const id = createCompanyList(companyId, name);
    setNewName("");
    setOpenId(id);
    resetDrafts();
    setPermOpen(true);
    toast({ description: ar ? `أُنشئت «${name}» للمنشأة.` : `“${name}” created for the company.` });
  };

  const addTitle = (pack) => {
    if (!companyId || !canWrite) return;
    const persisted = realPack(pack);
    const result = addListPosition(companyId, persisted, titleDraft);
    if (!result.ok) {
      toast({ description: ar ? "أدخل مسمّى غير مكرر." : "Enter a unique title.", variant: "destructive" });
      return;
    }
    setOpenId(persisted.id);
    setTitleDraft("");
  };

  const deleteTitle = (pack, positionId) => {
    if (!companyId || !canWrite) return;
    const persisted = realPack(pack);
    const result = removeListPosition(companyId, persisted, positionId);
    if (!result?.ok) {
      toast({ description: ar ? "تعذّر حذف المسمّى." : "Could not remove the title.", variant: "destructive" });
      return;
    }
    setOpenId(persisted.id);
    if (titleDraft.trim() === result.title) setTitleDraft("");
    toast({ description: ar ? `حُذف «${result.title}».` : `Removed “${result.title}”.` });
  };

  return (
    <OrgAccessPanel>
      <OrgSectionTitle meta={ar ? `${packs.length} ${packs.length === 1 ? "قائمة" : "قوائم"}` : `${packs.length} list${packs.length === 1 ? "" : "s"}`}>
        {ar ? "حزم الصلاحية" : "Access packs"}
      </OrgSectionTitle>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
        {ar
          ? "أنشئ حزمة وأضف المناصب. القالب يعرض فروع المنصة في عمود الفرع لتختار أين يوضع كل موظف. التعبئة تُحفظ في ملف الموظف عند التطبيق."
          : "Create a pack and add titles. The template lists live platform branches in the branch column so you pick where each person sits. Filling a row writes to the employee file on apply."}
      </p>
      {canWrite ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <button type="button" onClick={() => downloadHireTemplate(data, ar, { mode: "blank" })} style={orgBtnGhost}>
            {ar ? "تنزيل قالب فارغ" : "Download blank template"}
          </button>
          <button type="button" onClick={() => downloadHireTemplate(data, ar, { mode: "files" })} style={orgBtnGhost}>
            {ar ? "تنزيل الملفات الحالية والنواقص" : "Download current files and gaps"}
          </button>
        </div>
      ) : null}

      {canWrite ? (
        <div className="nv-org-access-toolbar">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") addList(); }}
            placeholder={ar ? "اسم حزمة جديدة" : "New pack name"}
            style={{ ...orgInput, flex: 1, height: 34 }}
          />
          <button type="button" onClick={addList} style={{ ...orgBtnPrimaryStyle(), display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus style={{ width: 13, height: 13 }} />
            {ar ? "إنشاء" : "Create"}
          </button>
        </div>
      ) : null}

      {!packs.length ? (
        <p style={{ margin: 0, padding: "16px", fontSize: 12, color: MUTED, lineHeight: 1.65 }}>
          {ar ? "لا حزم بعد. أنشئ صلاحية قبل توزيع المناصب — بلا قائمة لا يستطيع الموارد البشرية وضع موظف على فرع." : "No packs yet. Create an access pack before distributing titles — without a list HR cannot place someone on a branch."}
        </p>
      ) : (
      <div className="nv-org-access-grid">
      {packs.map((pack) => {
        const opened = openId === pack.id;
        const grades = gradesForList(data, pack.id);
        const titles = listPositions(pack);
        const label = templateLabel(pack, ar);
        const granted = grantedModules(pack.permissions, ar);
        return (
          <div key={pack.id} className={`nv-org-pack${opened ? " nv-org-pack--open" : ""}`}>
            <button
              type="button"
              className="nv-org-pack__head"
              onClick={() => {
                const nextOpen = opened ? "" : pack.id;
                setOpenId(nextOpen);
                resetDrafts();
                setRenameDraft(label);
                setPermOpen(Boolean(nextOpen));
              }}
            >
              <span className="nv-org-pack__row">
                <span className="nv-org-pack__name">{label}</span>
                <span className="nv-org-pack__count">
                  {ar ? `${titles.length} منصب · ${grades.length} درجة` : `${titles.length} titles · ${grades.length} grades`}
                </span>
              </span>
              <span className="nv-org-pack__tags">
                {granted.length ? granted.slice(0, 5).map((name) => (
                  <span key={name} className="nv-org-pack__tag">{name}</span>
                )) : (
                  <span className="nv-org-pack__tag">{ar ? "بلا صلاحيات" : "No access"}</span>
                )}
              </span>
            </button>

            {opened ? (
              <div className="nv-org-pack__body">
                {canWrite ? (
                  <section>
                    <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 600, color: MUTED }}>{ar ? "اسم الحزمة" : "Pack name"}</p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <input
                        value={renameDraft}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        onKeyDown={(event) => { if (event.key === "Enter") renameList(pack); }}
                        placeholder={ar ? "اسم القائمة" : "List name"}
                        style={{ ...orgInput, flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => renameList(pack)}
                        style={{ all: "unset", cursor: "pointer", height: 32, padding: "0 10px", borderRadius: 8, background: GREEN, color: "#fff", fontSize: 12, fontFamily: "inherit" }}
                      >
                        {ar ? "حفظ الاسم" : "Save name"}
                      </button>
                    </div>
                  </section>
                ) : null}
                <div className="nv-org-pack__cols">
                <section>
                  <p className="nv-org-pack__section-title">{ar ? "المناصب" : "Titles"}</p>
                  {titles.length ? titles.map((item) => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{ ...orgInput, flex: 1, display: "flex", alignItems: "center", background: SURFACE }}>{item.title}</span>
                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() => deleteTitle(pack, item.id)}
                          style={{ all: "unset", cursor: "pointer", height: 32, padding: "0 10px", borderRadius: 8, border: "1px solid hsl(0 72% 90%)", background: "hsl(0 86% 97%)", color: "hsl(0 72% 42%)", fontSize: 12, fontFamily: "inherit" }}
                        >
                          {ar ? "حذف" : "Delete"}
                        </button>
                      ) : null}
                    </div>
                  )) : (
                    <p style={{ margin: "0 0 8px", fontSize: 11, color: MUTED }}>{ar ? "لا مسمّيات بعد." : "No titles yet."}</p>
                  )}
                  {canWrite ? (
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <input
                        value={titleDraft}
                        onChange={(event) => setTitleDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") addTitle(pack);
                        }}
                        placeholder={ar ? "أضف مسمّى المنصب" : "Add a job title"}
                        style={{ ...orgInput, flex: 1 }}
                      />
                      <button
                        type="button"
                        onClick={() => addTitle(pack)}
                        style={{ all: "unset", cursor: "pointer", height: 32, padding: "0 10px", borderRadius: 8, background: GREEN, color: "#fff", fontSize: 12, fontFamily: "inherit" }}
                      >
                        {ar ? "إضافة" : "Add"}
                      </button>
                    </div>
                  ) : null}
                </section>

                <section>
                  <p className="nv-org-pack__section-title">{ar ? "الدرجات" : "Grades"}</p>
                  {grades.length ? grades.map((grade) => (
                    <div key={grade.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                      <span style={{ ...orgInput, flex: 1, display: "flex", alignItems: "center", background: SURFACE }}>{grade.title || jobGradeLabel(grade)}</span>
                      {canWrite ? (
                        <button
                          type="button"
                          onClick={() => {
                            removeListGrade(companyId, grade.id);
                            toast({ description: ar ? `حُذفت «${grade.title || jobGradeLabel(grade)}».` : `Removed “${grade.title || jobGradeLabel(grade)}”.` });
                          }}
                          style={{ all: "unset", cursor: "pointer", height: 32, padding: "0 10px", borderRadius: 8, border: "1px solid hsl(0 72% 90%)", background: "hsl(0 86% 97%)", color: "hsl(0 72% 42%)", fontSize: 12, fontFamily: "inherit" }}
                        >
                          {ar ? "حذف" : "Delete"}
                        </button>
                      ) : null}
                    </div>
                  )) : (
                    <p style={{ margin: "0 0 8px", fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
                      {ar ? "لا درجات بعد. أضف اسمًا أو السلّم الجاهز." : "No grades yet. Add a name or the ready ladder."}
                    </p>
                  )}
                  {canWrite ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          value={gradeDraft}
                          onChange={(event) => setGradeDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key !== "Enter") return;
                            const result = createListGrade(companyId, { title: gradeDraft, listId: realPack(pack).id });
                            if (!result.ok) {
                              toast({ description: ar ? "أدخل اسم درجة غير مكرر." : "Enter a unique grade name.", variant: "destructive" });
                              return;
                            }
                            setGradeDraft("");
                          }}
                          placeholder={ar ? "مثل: مبتدئ" : "e.g. Junior"}
                          style={{ ...orgInput, flex: 1 }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const result = createListGrade(companyId, { title: gradeDraft, listId: realPack(pack).id });
                            if (!result.ok) {
                              toast({ description: ar ? "أدخل اسم درجة غير مكرر." : "Enter a unique grade name.", variant: "destructive" });
                              return;
                            }
                            setGradeDraft("");
                          }}
                          style={{ all: "unset", cursor: "pointer", height: 32, padding: "0 10px", borderRadius: 8, background: GREEN, color: "#fff", fontSize: 12, fontFamily: "inherit" }}
                        >
                          {ar ? "إضافة" : "Add"}
                        </button>
                      </div>
                      {!grades.length ? (
                        <button
                          type="button"
                          onClick={() => {
                            const persisted = realPack(pack);
                            const result = seedDefaultLadder(companyId, persisted.id, persisted.ar, ar);
                            toast({
                              description: result.ok
                                ? (ar ? "أُضيف السلّم: مبتدئ · متوسط · أول · مشرف · مدير." : "Added the ladder: Junior · Mid · Senior · Supervisor · Manager.")
                                : (ar ? "الدرجات موجودة." : "Grades already exist."),
                            });
                          }}
                          style={{ all: "unset", cursor: "pointer", height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: CARD, color: NAVY, fontSize: 12, fontFamily: "inherit", textAlign: "center" }}
                        >
                          {ar ? "سلّم جاهز: مبتدئ إلى مدير" : "Ready ladder: Junior to Manager"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </section>
                </div>

                <section>
                  <button
                    type="button"
                    onClick={() => setPermOpen((open) => !open)}
                    style={{ all: "unset", cursor: "pointer", fontSize: 11, fontWeight: 600, color: NAVY, fontFamily: "inherit" }}
                  >
                    {ar ? "الصلاحيات" : "Access"}
                  </button>
                  {permOpen ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                      {SMART_SECTION_GROUPS.map((group) => {
                        const rows = SMART_DEPARTMENTS.filter((department) => department.group === group.id);
                        if (!rows.length) return null;
                        return (
                          <div key={group.id} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <span style={{ fontSize: 10, color: MUTED }}>{ar ? group.ar : group.en}</span>
                            {rows.map((department) => {
                              const locked = !ownerMode && OWNER_ONLY_DEPARTMENTS.includes(department.id);
                              const access = accessOf(pack.permissions, department.id);
                              return (
                                <div key={department.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, opacity: locked ? 0.5 : 1 }}>
                                  <span style={{ fontSize: 11.5, color: NAVY }}>{ar ? department.ar : department.en}</span>
                                  <span style={{ display: "flex", gap: 3 }}>
                                    {LEVELS.map((level) => (
                                      <button
                                        key={level.id}
                                        type="button"
                                        disabled={!canWrite || locked}
                                        onClick={() => {
                                          if (locked) return;
                                          const next = { ...(pack.permissions || {}) };
                                          if (level.id === "hidden") delete next[department.id];
                                          else next[department.id] = level.id;
                                          saveListPermissions(companyId, realPack(pack), next);
                                        }}
                                        style={{
                                          all: "unset",
                                          cursor: canWrite && !locked ? "pointer" : "default",
                                          fontSize: 9.5,
                                          padding: "3px 7px",
                                          borderRadius: 99,
                                          fontFamily: "inherit",
                                          background: access === level.id ? GREEN : "hsl(220 16% 95%)",
                                          color: access === level.id ? "#fff" : MUTED,
                                        }}
                                      >
                                        {ar ? level.ar : level.en}
                                      </button>
                                    ))}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
                {canWrite && onHire ? (
                  <button
                    type="button"
                    onClick={() => onHire({ listId: realPack(pack).id })}
                    style={{ ...orgBtnPrimaryStyle(), width: "100%", textAlign: "center" }}
                  >
                    {ar ? "وظّف بهذه الحزمة" : "Hire with this pack"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
      </div>
      )}
    </OrgAccessPanel>
  );
}
