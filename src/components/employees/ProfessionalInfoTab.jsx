import React, { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { updateEmployeeProfile } from "@/lib/store";
import {
  PROFILE_GROUPS,
  canEditProfileKey,
  canonicalFieldValue,
  displayProfileField,
  isProfileFieldVisible,
  profileFieldLabel,
  profileFieldOptions,
  profileFieldRuleId,
  profileFieldValue,
  isFixedContractType,
} from "@/lib/employeeProfileFields";
import MobileSelect from "@/components/mobile/MobileSelect";
import { MUTED, NAVY, NAVY_FILL, OK, WARN, BAD, field, ui } from "@/lib/platformStyles";
import { checkSaudiIdentityGate, EXPIRY_WARN_DAYS } from "@/lib/complianceDerivations";
import { workPatternForcesFixed } from "@/lib/contractLawDerivations";
import IdentityCard from "@/components/shared/IdentityCard";
import LaborArticleCite from "@/components/shared/LaborArticleCite";
import CommentFiles, { CommentAttachments } from "@/components/tasks/CommentFiles";
import { Fingerprint, HeartPulse, Briefcase, Contact, Landmark, Layers } from "lucide-react";

export { PROFILE_GROUPS };

function daysTo(iso) {
  if (!iso) return null;
  const d = Math.round((new Date(`${String(iso).slice(0, 10)}T00:00:00`) - Date.now()) / 86400000);
  return Number.isFinite(d) ? d : null;
}

function expiryChip(iso, ar) {
  const d = daysTo(iso);
  if (d === null) return null;
  if (d < 0) return { text: ar ? "منتهٍ" : "Expired", style: BAD };
  if (d <= EXPIRY_WARN_DAYS) return { text: ar ? `${d} يومًا` : `${d} days`, style: WARN };
  return { text: ar ? "ساري" : "Valid", style: OK };
}

function niceDate(iso, ar) {
  if (!iso) return "";
  try {
    return new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString(
      ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB",
      { year: "numeric", month: "short", day: "numeric" },
    );
  } catch {
    return String(iso).slice(0, 10);
  }
}

const GROUP_ICON = {
  identity: Fingerprint,
  socialInsurance: HeartPulse,
  employment: Briefcase,
  contact: Contact,
  wps: Landmark,
};

const inputStyle = { ...field };

function QualificationFiles({ files, canAttach, onChange, ar }) {
  return (
    <div style={{ marginTop: 8 }}>
      {canAttach ? (
        <CommentFiles files={files} setFiles={onChange} />
      ) : (
        <CommentAttachments files={files} />
      )}
      {canAttach ? (
        <p style={{ margin: "6px 0 0", fontSize: 11, color: MUTED, lineHeight: 1.6 }}>
          {ar ? "ارفع شهادة المؤهل أو بيان الدرجات — يُحفظ في الملف." : "Upload the qualification certificate or transcript — it is kept on the file."}
        </p>
      ) : null}
    </div>
  );
}

/** Platform isTabInfo — L2669–2692, grouped to MHRSD employee-file order. */
export default function ProfessionalInfoTab({
  employee,
  companyId,
  canEdit,
  isSelf,
  canEditGrade,
  grades,
  fallbackPosition,
  stationName,
  autoEdit = false,
}) {
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const canManage = Boolean(canEdit);
  const canFill = canManage;
  const [editing, setEditing] = useState(Boolean(autoEdit && canFill));
  const profile = employee.profile || {};

  useEffect(() => {
    if (autoEdit && canFill) setEditing(true);
  }, [autoEdit, canFill]);

  const allFields = PROFILE_GROUPS.flatMap((g) => g.fields);
  const allKeys = allFields.map((f) => f.key);
  const [form, setForm] = useState(() => ({
    ...allFields.reduce((acc, fieldDef) => {
      let v = profileFieldValue(profile, fieldDef.key, employee);
      if (fieldDef.key === "position") v = profile.position || fallbackPosition || "";
      return { ...acc, [fieldDef.key]: canonicalFieldValue(fieldDef, v) };
    }, {}),
    gradeId: profile.gradeId || "",
    maxStations: profile.maxStations ?? "",
  }));

  const readVal = (key) => {
    if (key === "position") return profile.position || fallbackPosition || "";
    return profileFieldValue(profile, key, employee);
  };

  const displayVal = (fieldDef) => {
    const raw = editing ? form[fieldDef.key] : readVal(fieldDef.key);
    if (!raw) return "—";
    if (fieldDef.type === "date" && !editing) return niceDate(raw, ar) || "—";
    const labelled = displayProfileField(fieldDef, raw, ar);
    return labelled || raw;
  };

  const save = () => {
    const payload = { ...form, maxStations: form.maxStations === "" ? null : Number(form.maxStations) };
    if (!canEditGrade) {
      delete payload.gradeId;
      delete payload.maxStations;
    }
    if (!canManage) {
      allKeys.forEach((key) => delete payload[key]);
      delete payload.gradeId;
      delete payload.maxStations;
      return;
    }
    allKeys.forEach((key) => {
      if (!canEditProfileKey(key, { canManage, isSelf })) delete payload[key];
    });
    const identity = checkSaudiIdentityGate(payload);
    if (!identity.ok) {
      return;
    }
    if (workPatternForcesFixed(payload.workPattern)) {
      payload.contractType = "fixed";
    }
    if (!isFixedContractType(payload.contractType) && profile.contract) {
      payload.contract = { ...profile.contract, type: payload.contractType || "indefinite", endDate: "" };
      payload.contractEndDate = "";
    } else if (isFixedContractType(payload.contractType) && profile.contract) {
      payload.contract = { ...profile.contract, type: "fixed" };
    }
    updateEmployeeProfile(companyId, employee.id, payload);
    setEditing(false);
  };

  const identityLive = checkSaudiIdentityGate(editing ? form : profile);

  const editMeta = (canFill || canEditGrade) ? (
    editing ? (
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" onClick={() => setEditing(false)} style={ui.btnGhost}>
          {ar ? "إلغاء" : "Cancel"}
        </button>
        <button type="button" onClick={save} style={{ ...ui.btnGhost, background: NAVY_FILL, color: "#fff", border: "none", fontWeight: 600 }}>
          {t("save")}
        </button>
      </div>
    ) : (
      <button type="button" onClick={() => setEditing(true)} style={ui.btnGhost}>
        {t("edit")}
      </button>
    )
  ) : null;

  const gradeCard = (canEditGrade || profile.gradeId || profile.maxStations) ? (
    <IdentityCard
      icon={Layers}
      kicker={ar ? "من الهيكل" : "From org tree"}
      title={t("gradeAndStationScope")}
      subtitle={ar ? "الدرجة ونطاق الفروع يُشتقّان من المقعد، لا من إدخال حر." : "Grade and station scope come from the seat, not a free-hand entry."}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: "14px" }}>
        <div>
          <div style={{ fontSize: "11px", color: MUTED }}>{t("jobGrade")}</div>
          <div style={{ marginTop: "6px" }}>
            {editing && canEditGrade ? (
              <MobileSelect
                value={form.gradeId}
                onChange={(gradeId) => setForm({ ...form, gradeId })}
                options={[{ value: "", label: "—" }, ...grades.map((g) => ({ value: g.id, label: `${g.gradeNumber} · ${g.title}` }))]}
              />
            ) : (
              <span style={{ fontSize: "13px", color: NAVY }}>
                {grades.find((g) => g.id === profile.gradeId)
                  ? `${grades.find((g) => g.id === profile.gradeId).gradeNumber} · ${grades.find((g) => g.id === profile.gradeId).title}`
                  : "—"}
              </span>
            )}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "11px", color: MUTED }}>{t("maxStations")}</div>
          <div style={{ marginTop: "6px" }}>
            {editing && canEditGrade ? (
              <input
                type="number"
                min="1"
                value={form.maxStations}
                onChange={(e) => setForm({ ...form, maxStations: e.target.value })}
                placeholder="∞"
                style={inputStyle}
              />
            ) : (
              <span style={{ fontSize: "13px", color: NAVY }}>{profile.maxStations || "∞"}</span>
            )}
          </div>
        </div>
      </div>
    </IdentityCard>
  ) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }} dir={ar ? "rtl" : "ltr"}>
      <IdentityCard
        icon={Fingerprint}
        kicker={ar ? "سجل نظامي" : "Statutory file"}
        title={ar ? "ملف العامل وفق سياسة الوزارة" : "Employee file — MHRSD order"}
        subtitle={ar
          ? "الهوية ثم التأمينات ثم قوى ثم حماية الأجور. المادة تُعرض عند الخيار الذي يستند إليها."
          : "Identity, then GOSI, then Qiwa, then wage protection. The article appears on the option that relies on it."}
        meta={editMeta}
      >
        {isSelf && !canManage ? (
          <p style={{ margin: 0, fontSize: "12px", color: MUTED, lineHeight: 1.7 }}>
            {ar
              ? "ملف المعلومات المهنية للعرض فقط — تُكمله الإدارة أو الموارد البشرية."
              : "Professional info is view-only — management or HR completes this file."}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: "12px", color: MUTED, lineHeight: 1.7 }}>
            {ar
              ? "يُحفظ الأمر في الملف. لا مادة مخترعة: التأمينات ومدد بلا شارة نظام العمل."
              : "Each command is saved on the file. No invented article: GOSI and Mudad stay without a Labour Law chip."}
          </p>
        )}
      </IdentityCard>

      {PROFILE_GROUPS.map((group) => {
        const fields = group.fields.filter((f) => isProfileFieldVisible(f, { profile, form, editing }));
        const idType = editing ? form.idType : readVal("idType");
        const Icon = GROUP_ICON[group.id];
        return (
          <React.Fragment key={group.id}>
            <IdentityCard
              icon={Icon}
              kicker={ar ? "بند الملف" : "File block"}
              title={ar ? group.ar : group.en}
              subtitle={ar ? group.noteAr : group.noteEn}
              meta={group.ruleId ? <LaborArticleCite ruleId={group.ruleId} ar={ar} /> : null}
            >
              {group.id === "identity" && identityLive.mismatch ? (
                <div style={{ ...BAD, marginBottom: "12px", fontSize: "12px", lineHeight: 1.6 }}>
                  {ar ? identityLive.reason : identityLive.reasonEn}
                </div>
              ) : null}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: "14px" }}>
                {group.showStation && (
                  <div>
                    <div style={{ fontSize: "11px", color: MUTED }}>
                      {ar ? "الفرع" : "Branch"}
                      <span style={{ marginInlineStart: 6, fontSize: 10, color: "#94A3B8" }}>
                        {ar ? "· من الهيكل" : "· from org tree"}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                      <span style={{ flex: 1, fontSize: "13px", color: NAVY, minWidth: 0, wordBreak: "break-word" }}>
                        {stationName || "—"}
                      </span>
                    </div>
                  </div>
                )}
                {fields.map((fieldDef) => {
                  const canEditField = editing && canEditProfileKey(fieldDef.key, { canManage, isSelf });
                  const chip = !editing && fieldDef.expiry ? expiryChip(readVal(fieldDef.key), ar) : null;
                  const opts = profileFieldOptions(fieldDef);
                  const currentVal = editing ? form[fieldDef.key] : readVal(fieldDef.key);
                  const ruleId = profileFieldRuleId(fieldDef, currentVal);
                  return (
                    <div key={fieldDef.key} style={fieldDef.area || fieldDef.key === "qualification" ? { gridColumn: "1 / -1" } : undefined}>
                      <div style={{ fontSize: "11px", color: MUTED }}>
                        {profileFieldLabel(fieldDef, idType, ar)}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                        {canEditField ? (
                          fieldDef.area ? (
                            <textarea
                              value={form[fieldDef.key]}
                              onChange={(e) => setForm({ ...form, [fieldDef.key]: e.target.value })}
                              rows={3}
                              dir={fieldDef.dir}
                              style={{ ...inputStyle, height: "auto", padding: "10px 11px", resize: "vertical" }}
                            />
                          ) : opts ? (
                            <select
                              value={form[fieldDef.key]}
                              onChange={(e) => setForm({ ...form, [fieldDef.key]: e.target.value })}
                              style={inputStyle}
                            >
                              <option value="">—</option>
                              {opts.map((o) => (
                                <option key={o.value} value={o.value}>{ar ? o.ar : o.en}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={fieldDef.type || "text"}
                              dir={fieldDef.dir}
                              value={form[fieldDef.key]}
                              onChange={(e) => setForm({ ...form, [fieldDef.key]: e.target.value })}
                              style={inputStyle}
                            />
                          )
                        ) : (
                          <>
                            <span
                              dir={fieldDef.dir && displayVal(fieldDef) !== "—" ? fieldDef.dir : "auto"}
                              style={{ flex: 1, fontSize: "13px", color: NAVY, minWidth: 0, wordBreak: "break-word" }}
                            >
                              {displayVal(fieldDef)}
                            </span>
                            {chip && <span style={chip.style}>{chip.text}</span>}
                          </>
                        )}
                      </div>
                      {fieldDef.key === "qualification" ? (
                        <QualificationFiles
                          files={profile.qualificationFiles || []}
                          canAttach={isSelf || canManage}
                          onChange={(next) => updateEmployeeProfile(companyId, employee.id, { qualificationFiles: next })}
                          ar={ar}
                        />
                      ) : null}
                      {ruleId ? (
                        <div style={{ marginTop: 8 }}>
                          <LaborArticleCite ruleId={ruleId} ar={ar} showText />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </IdentityCard>
            {group.id === "employment" ? gradeCard : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}
