
import React, { useEffect, useRef, useState } from "react";
import { Plus, AlertTriangle, History, X, CalendarDays, ShieldCheck, ShieldQuestion, Camera, Loader2, Trash2, Clock3, Siren } from "lucide-react";
import FlowSwipeAction from "@/components/flow/FlowSwipeAction";
import ApprovalHistory from "@/components/safety/ApprovalHistory";
import SafetyApprovalControl from "@/components/safety/SafetyApprovalControl";
import StationSafetyLog from "@/components/safety/StationSafetyLog";
import { canSetSafetyLevelSafe, safetyLevelMeta, whySafeIsBlocked } from "@/lib/safetyLogic";
import { HIERARCHY_OF_CONTROLS, checkHazardCloseGate } from "@/lib/hseDerivations";
import { formatOpenDuration, formatOpenDurationShort } from "@/lib/dateFormat";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import PlatformDateField from "@/components/shared/PlatformDateField";
import { MUTED, NAVY, SURFACE, field, ui, CARD } from "@/lib/platformStyles";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

const LEVELS = [
  { key: "green", ar: "آمنة", en: "Safe", accent: "var(--nv-ok-fill)", soft: "var(--nv-ok-soft)", border: "var(--nv-ok-line)", fg: "var(--nv-ok-ink)" },
  { key: "amber", ar: "تحت المراقبة", en: "Watch", accent: "var(--nv-warn-fill)", soft: "var(--nv-warn-soft)", border: "var(--nv-warn-line)", fg: "var(--nv-warn-ink)" },
  { key: "red", ar: "حرجة", en: "Critical", accent: "var(--nv-bad-fill)", soft: "var(--nv-bad-soft)", border: "var(--nv-bad-line)", fg: "var(--nv-bad-ink)" },
];

function hazardLabel(h) {
  return typeof h === "string" ? h : h?.description || h?.title || String(h);
}

function hazardBeforePhoto(h) {
  if (!h || typeof h === "string") return null;
  const photo = h.beforePhoto;
  if (!photo) return null;
  if (typeof photo === "string") return { url: photo };
  return photo.url || photo.file_url ? photo : null;
}

function newHazardId() {
  return `haz_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

const cardShell = {
  borderRadius: 14,
  border: `1px solid var(--nv-line)`,
  background: CARD,
  boxShadow: "var(--nv-paper)",
};

export default function SafetyOverviewTab({
  station, rec, canEdit, canApprove, approvalIssues, lang,
  onUpdate, onCloseHazard, onApprove, onRevokeApproval, onIncident,
  pane = "all",
}) {
  const ar = lang === "ar";
  const L = (a, e) => (ar ? a : e);
  const [hazard, setHazard] = useState("");
  const [openBeforePhoto, setOpenBeforePhoto] = useState(null);
  const [incident, setIncident] = useState("");
  const [incidentAck, setIncidentAck] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [closingIdx, setClosingIdx] = useState(null);
  const [controlId, setControlId] = useState("eng");
  const [legacyBeforePhoto, setLegacyBeforePhoto] = useState(null);
  const [afterPhoto, setAfterPhoto] = useState(null);
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const openBeforeInputRef = useRef(null);
  const legacyBeforeInputRef = useRef(null);
  const afterInputRef = useRef(null);

  const hazards = rec?.hazards || [];
  const openHazardCount = hazards.length;

  useEffect(() => {
    if (!openHazardCount) return undefined;
    const id = window.setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => window.clearInterval(id);
  }, [openHazardCount]);
  const activeLevel = safetyLevelMeta(rec?.level, ar);
  const whySafe = whySafeIsBlocked(rec, ar);
  const canLogIncident = Boolean(incident.trim() && incidentAck && !uploadingSlot);
  const showWork = pane !== "status";
  const showStatus = pane !== "work";
  const inputStyle = { ...field, height: 36, background: CARD, fontSize: 12 };
  const closingHazard = closingIdx != null ? hazards[closingIdx] : null;
  const closingBefore = hazardBeforePhoto(closingHazard) || legacyBeforePhoto;
  const needsLegacyBefore = closingIdx != null && !hazardBeforePhoto(closingHazard);
  const canAddHazard = Boolean(hazard.trim() && openBeforePhoto?.url && !uploadingSlot);
  const canConfirmClose = Boolean(closingBefore?.url && afterPhoto?.url && !uploadingSlot);

  const addHazard = () => {
    if (!hazard.trim()) {
      toast({ description: L("أدخل وصف الخطر.", "Enter a hazard description."), variant: "destructive" });
      return;
    }
    if (!openBeforePhoto?.url) {
      toast({ description: L("ارفع صورة قبل عند فتح الخطر.", "Upload a before photo when opening the hazard."), variant: "destructive" });
      return;
    }
    const entry = {
      id: newHazardId(),
      description: hazard.trim(),
      beforePhoto: openBeforePhoto,
      openedAt: new Date().toISOString(),
      status: "open",
    };
    onUpdate({ hazards: [...hazards, entry] });
    setHazard("");
    setOpenBeforePhoto(null);
    toast({
      description: L(
        "فُتح الخطر. يبقى مفتوحًا ويمنع الاعتماد حتى يُغلق بصورة بعد.",
        "Hazard opened. It stays open and blocks approval until closed with an after photo."
      ),
    });
  };

  const attemptClose = (i) => {
    setClosingIdx(i);
    setControlId("eng");
    setLegacyBeforePhoto(null);
    setAfterPhoto(null);
    setUploadingSlot(null);
  };

  const uploadProofPhoto = async (slot, file, setter) => {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type) && !file.type.startsWith("image/")) {
      toast({
        description: L("الصيغ المدعومة: JPG، PNG، WEBP.", "Supported formats: JPG, PNG, WEBP."),
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast({
        description: L("حجم الصورة يجب ألا يتجاوز 10 ميجابايت.", "Image must not exceed 10 MB."),
        variant: "destructive",
      });
      return;
    }
    setUploadingSlot(slot);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setter({
        url: file_url,
        name: file.name,
        stamped: true,
        at: new Date().toISOString(),
      });
    } catch {
      toast({
        description: L("تعذر رفع الصورة. حاول مرة أخرى.", "Photo upload failed. Please try again."),
        variant: "destructive",
      });
    } finally {
      setUploadingSlot(null);
    }
  };

  const confirmClose = () => {
    if (closingIdx == null) return;
    const beforePhoto = hazardBeforePhoto(hazards[closingIdx]) || legacyBeforePhoto;
    const gate = checkHazardCloseGate({
      controlId,
      likelihood: 3,
      severity: 3,
      beforePhoto,
      afterPhoto,
    });
    if (!gate.ok) {
      toast({ description: ar ? gate.reason : (gate.reasonEn || gate.reason), variant: "destructive" });
      return;
    }
    const result = onCloseHazard(closingIdx, {
      controlId,
      beforePhoto,
      afterPhoto,
      likelihood: 3,
      severity: 3,
    });
    if (result && result.ok === false) {
      toast({ description: ar ? result.reason : (result.reasonEn || result.reason), variant: "destructive" });
      return;
    }
    setClosingIdx(null);
    setLegacyBeforePhoto(null);
    setAfterPhoto(null);
  };

  const renderPhotoSlot = ({ slot, photo, inputRef, onClear, onPick, label, locked = false, minHeight = 110 }) => {
    const busy = uploadingSlot === slot;
    return (
      <div style={{ flex: "1 1 140px", minWidth: 140 }}>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            onPick(file);
          }}
        />
        {photo?.url ? (
          <div
            style={{
              position: "relative",
              borderRadius: 11,
              border: "1px solid #BBF7D0",
              background: "var(--nv-ok-soft)",
              overflow: "hidden",
            }}
          >
            <img
              src={photo.url}
              alt={label}
              style={{ display: "block", width: "100%", height: minHeight, objectFit: "cover" }}
            />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 6,
                padding: "7px 9px",
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: "#15803D" }}>{label} ✓</span>
              {!locked && (
                <button
                  type="button"
                  onClick={onClear}
                  style={{ border: "none", background: "transparent", color: "#DC2626", cursor: "pointer", padding: 2 }}
                  aria-label={L("إزالة", "Remove")}
                >
                  <Trash2 style={{ width: 13, height: 13 }} strokeWidth={1.75} />
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || !!uploadingSlot || locked}
            onClick={() => inputRef.current?.click()}
            style={{
              width: "100%",
              minHeight,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              borderRadius: 11,
              border: "1px dashed #CBD5E1",
              background: CARD,
              color: MUTED,
              cursor: busy || locked ? "not-allowed" : "pointer",
              opacity: busy ? 0.65 : 1,
              fontFamily: "inherit",
              padding: 12,
            }}
          >
            {busy ? (
              <Loader2 style={{ width: 18, height: 18, color: "#1E9E63" }} className="animate-spin" strokeWidth={1.75} />
            ) : (
              <Camera style={{ width: 18, height: 18, color: "#1E9E63" }} strokeWidth={1.75} />
            )}
            <span style={{ fontSize: 12, fontWeight: 600, color: NAVY }}>
              {busy ? L("جارٍ الرفع…", "Uploading…") : label}
            </span>
            <span style={{ fontSize: 10, color: MUTED }}>
              {L("التقاط أو رفع من الجهاز", "Capture or upload")}
            </span>
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }} dir={ar ? "rtl" : "ltr"}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: showWork && showStatus ? "minmax(0, 1fr) minmax(240px, 360px)" : "1fr",
          gap: 16,
          alignItems: "stretch",
        }}
        className="hse-overview-grid"
      >
        {showWork ? (
        <section
          id="hse-work-card"
          style={{
            ...cardShell,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 16,
            minWidth: 0,
            outline: openHazardCount ? "1px solid #FDE68A" : "none",
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: NAVY }}>{L("المخاطر المفتوحة", "Open hazards")}</p>
              <span
                style={{
                  minWidth: 22,
                  height: 22,
                  padding: "0 7px",
                  borderRadius: 20,
                  background: openHazardCount ? "var(--tint-amber-bg)" : "var(--nv-ok-soft)",
                  color: openHazardCount ? "#B45309" : "#15803D",
                  border: `1px solid ${openHazardCount ? "#FDE68A" : "#BBF7D0"}`,
                  fontSize: 11,
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'IBM Plex Sans',sans-serif",
                }}
              >
                {openHazardCount}
              </span>
            </div>

            {openHazardCount > 0 && (
              <p
                style={{
                  margin: "0 0 10px",
                  padding: "8px 10px",
                  borderRadius: 9,
                  background: "var(--tint-amber-bg)",
                  border: "1px solid #FDE68A",
                  fontSize: 11,
                  color: "#92400E",
                  lineHeight: 1.5,
                }}
              >
                {L(
                  "كل خطر يبقى مفتوحًا بصورته قبل — عند الإغلاق ارفع صورة بعد فقط.",
                  "Each hazard stays open with its before photo — upload an after photo only when closing."
                )}
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {hazards.map((h, i) => {
                const before = hazardBeforePhoto(h);
                const openedAt = typeof h === "object" ? h.openedAt : null;
                const duration = openedAt ? formatOpenDuration(openedAt, lang, nowTick) : "";
                const durationShort = openedAt ? formatOpenDurationShort(openedAt, lang, nowTick) : "";
                return (
                  <div
                    key={typeof h === "object" && h.id ? h.id : i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "11px 12px",
                      borderRadius: 11,
                      border: "1px solid #E2E8F0",
                      background: SURFACE,
                    }}
                  >
                    {before?.url ? (
                      <img
                        src={before.url}
                        alt=""
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 9,
                          objectFit: "cover",
                          border: "1px solid #E2E8F0",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 9,
                          background: "var(--tint-amber-bg)",
                          border: "1px solid #FDE68A",
                          color: "#B45309",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <AlertTriangle style={{ width: 16, height: 16 }} strokeWidth={1.75} />
                      </span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: NAVY }}>{hazardLabel(h)}</span>
                        {durationShort && (
                          <span
                            title={duration}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              height: 20,
                              padding: "0 7px",
                              borderRadius: 20,
                              background: "#EFF6FF",
                              border: "1px solid #BFDBFE",
                              color: "#1D4ED8",
                              fontSize: 10,
                              fontWeight: 700,
                              fontFamily: "'IBM Plex Sans',sans-serif",
                            }}
                          >
                            <Clock3 style={{ width: 11, height: 11 }} strokeWidth={2} />
                            {durationShort}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: MUTED, marginTop: 3 }}>
                        {duration
                          ? L(`مفتوح منذ ${duration}`, `Open for ${duration}`)
                          : L("مفتوح", "Open")}
                        {before?.url
                          ? L(" · صورة قبل محفوظة", " · before photo saved")
                          : L(" · بلا صورة قبل", " · missing before photo")}
                      </div>
                    </div>
                    {canEdit && (
                      <div style={{ width: 148, flexShrink: 0 }}>
                        <FlowSwipeAction
                          sensitive
                          label={L("اسحب للإغلاق", "Swipe to close")}
                          onAction={() => attemptClose(i)}
                          confirmLabel={L("تأكيد", "Confirm")}
                          cancelLabel={L("إلغاء", "Cancel")}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {openHazardCount === 0 && (
                <div
                  style={{
                    padding: "22px 14px",
                    borderRadius: 11,
                    border: "1px dashed #CBD5E1",
                    background: SURFACE,
                    textAlign: "center",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: NAVY }}>{L("لا مخاطر مفتوحة", "No open hazards")}</p>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: MUTED }}>
                    {approvalIssues?.length
                      ? L("لا يعني الجاهزية للاعتماد — أكمل التفتيش والمستوى وقوائم التحقق أولًا.", "This does not mean ready to approve — complete inspection, level, and checklists first.")
                      : L("لا حالات قائمة تمنع الاعتماد من جهة المخاطر.", "No standing conditions blocking approval from hazards.")}
                  </p>
                </div>
              )}
            </div>

            {canEdit && (
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid #E2E8F0",
                  background: CARD,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: NAVY }}>
                  {L("فتح خطر جديد", "Open new hazard")}
                </p>
                <input
                  value={hazard}
                  onChange={(e) => setHazard(e.target.value)}
                  placeholder={L("وصف الخطر الجديد", "New hazard description")}
                  style={{ ...inputStyle, width: "100%" }}
                  onKeyDown={(e) => { if (e.key === "Enter") addHazard(); }}
                />
                {renderPhotoSlot({
                  slot: "open-before",
                  photo: openBeforePhoto,
                  inputRef: openBeforeInputRef,
                  onClear: () => setOpenBeforePhoto(null),
                  onPick: (file) => uploadProofPhoto("open-before", file, setOpenBeforePhoto),
                  label: L("صورة قبل (عند الفتح)", "Before photo (at open)"),
                  minHeight: 96,
                })}
                <button
                  type="button"
                  onClick={addHazard}
                  disabled={!canAddHazard}
                  style={{
                    ...ui.btnPrimary,
                    height: 36,
                    padding: "0 14px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    opacity: canAddHazard ? 1 : 0.4,
                    cursor: canAddHazard ? "pointer" : "not-allowed",
                  }}
                >
                  <Plus style={{ width: 14, height: 14 }} strokeWidth={1.75} />
                  {L("فتح الخطر", "Open hazard")}
                </button>
              </div>
            )}
          </div>

          {closingIdx != null && closingHazard && (
            <div
              style={{
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                background: SURFACE,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: NAVY }}>
                    {L("إغلاق الخطر", "Close hazard")}
                  </p>
                  <p style={{ margin: "3px 0 0", fontSize: 11, color: MUTED }}>{hazardLabel(closingHazard)}</p>
                  {typeof closingHazard === "object" && closingHazard.openedAt ? (
                    <p style={{ margin: "4px 0 0", fontSize: 11, fontWeight: 600, color: "#1D4ED8" }}>
                      {L(
                        `مدة الفتح: ${formatOpenDuration(closingHazard.openedAt, lang, nowTick)}`,
                        `Open duration: ${formatOpenDuration(closingHazard.openedAt, lang, nowTick)}`
                      )}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setClosingIdx(null);
                    setLegacyBeforePhoto(null);
                    setAfterPhoto(null);
                  }}
                  style={{ border: "none", background: "transparent", color: MUTED, cursor: "pointer", padding: 4 }}
                >
                  <X style={{ width: 14, height: 14 }} />
                </button>
              </div>
              <select value={controlId} onChange={(e) => setControlId(e.target.value)} style={{ ...inputStyle, appearance: "auto" }}>
                {HIERARCHY_OF_CONTROLS.map((c) => (
                  <option key={c.id} value={c.id}>{ar ? c.ar : c.en}</option>
                ))}
              </select>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: MUTED }}>
                {L("صورة قبل محفوظة منذ الفتح — ارفع صورة بعد للإغلاق", "Before photo kept since open — upload after photo to close")}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {needsLegacyBefore
                  ? renderPhotoSlot({
                      slot: "legacy-before",
                      photo: legacyBeforePhoto,
                      inputRef: legacyBeforeInputRef,
                      onClear: () => setLegacyBeforePhoto(null),
                      onPick: (file) => uploadProofPhoto("legacy-before", file, setLegacyBeforePhoto),
                      label: L("صورة قبل (ناقصة)", "Before photo (missing)"),
                    })
                  : renderPhotoSlot({
                      slot: "saved-before",
                      photo: closingBefore,
                      inputRef: legacyBeforeInputRef,
                      onClear: () => {},
                      onPick: () => {},
                      label: L("صورة قبل", "Before photo"),
                      locked: true,
                    })}
                {renderPhotoSlot({
                  slot: "after",
                  photo: afterPhoto,
                  inputRef: afterInputRef,
                  onClear: () => setAfterPhoto(null),
                  onPick: (file) => uploadProofPhoto("after", file, setAfterPhoto),
                  label: L("صورة بعد (عند الإغلاق)", "After photo (at close)"),
                })}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={confirmClose}
                  disabled={!canConfirmClose}
                  style={{
                    ...ui.btnPrimary,
                    height: 34,
                    opacity: canConfirmClose ? 1 : 0.4,
                    cursor: canConfirmClose ? "pointer" : "not-allowed",
                  }}
                >
                  {L("أغلق", "Close")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClosingIdx(null);
                    setLegacyBeforePhoto(null);
                    setAfterPhoto(null);
                  }}
                  style={{ ...ui.btnGhost, height: 34 }}
                >
                  {L("إلغاء", "Cancel")}
                </button>
              </div>
            </div>
          )}

          {canEdit && (
            <div style={{
              borderTop: "1px solid #F1F5F9",
              paddingTop: 14,
              padding: 12,
              borderRadius: 12,
              border: "1px solid #FECACA",
              background: "#FEF2F2",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
            >
              <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#991B1B" }}>
                <Siren style={{ width: 15, height: 15 }} strokeWidth={1.75} />
                {L("تسجيل حادث", "Log incident")}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <input
                  value={incident}
                  onChange={(e) => setIncident(e.target.value)}
                  placeholder={L("وصف مختصر لما وقع", "Short description of what happened")}
                  style={{ ...inputStyle, flex: "1 1 200px" }}
                />
                <button
                  type="button"
                  disabled={!canLogIncident}
                  onClick={() => {
                    onIncident(incident.trim());
                    setIncident("");
                    setIncidentAck(false);
                  }}
                  style={{
                    ...ui.btnDanger,
                    height: 36,
                    opacity: canLogIncident ? 1 : 0.4,
                    cursor: canLogIncident ? "pointer" : "not-allowed",
                  }}
                >
                  {L("تسجيل", "Log")}
                </button>
              </div>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11, lineHeight: 1.5, color: "#7F1D1D", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={incidentAck}
                  onChange={(e) => setIncidentAck(e.target.checked)}
                  style={{ marginTop: 2 }}
                />
                <span>
                  {L(
                    "أقرّ أن هذا حدث وقع، وليس خطرًا ما زال قائمًا في الموقع.",
                    "I confirm this is an event that occurred, not a hazard still present on site."
                  )}
                </span>
              </label>
            </div>
          )}
        </section>
        ) : null}

        {showStatus ? (
        <aside
          id="hse-status-card"
          style={{
            ...cardShell,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ height: 4, background: activeLevel.accent }} />
          <div style={{ padding: "14px 14px 16px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: activeLevel.soft,
                  color: activeLevel.fg,
                  border: `1px solid ${activeLevel.border}`,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {activeLevel.key === "none"
                  ? <ShieldQuestion style={{ width: 17, height: 17 }} strokeWidth={1.75} />
                  : <ShieldCheck style={{ width: 17, height: 17 }} strokeWidth={1.75} />}
              </span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.04, color: MUTED, textTransform: "uppercase" }}>
                  {L("بطاقة الحالة", "Status card")}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: NAVY, marginTop: 2 }}>
                  {activeLevel.label}
                </div>
                {activeLevel.key === "none" ? (
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 3, lineHeight: 1.45 }}>
                    {L("لم يُحدَّد بعد — اختيار «آمنة» لا يُعرض قبل استيفاء الشروط.", "Not set yet — Safe is not shown as selected until the conditions are met.")}
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: MUTED }}>{L("مستوى السلامة", "Safety level")}</p>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 11,
                  border: "1px solid #E2E8F0",
                  overflow: "hidden",
                  background: SURFACE,
                }}
              >
                {LEVELS.map((lv, i) => {
                  const on = rec?.level === lv.key;
                  const blocked = !canEdit || (lv.key === "green" && !canSetSafetyLevelSafe(rec));
                  return (
                    <button
                      key={lv.key}
                      type="button"
                      disabled={blocked}
                      onClick={() => onUpdate({ level: lv.key })}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        width: "100%",
                        padding: "11px 12px",
                        border: "none",
                        borderTop: i === 0 ? "none" : "1px solid #E2E8F0",
                        background: on ? lv.soft : "transparent",
                        color: on ? lv.fg : MUTED,
                        fontSize: 12,
                        fontWeight: on ? 600 : 500,
                        cursor: blocked ? "not-allowed" : "pointer",
                        opacity: blocked ? 0.55 : 1,
                        fontFamily: "inherit",
                        textAlign: "start",
                      }}
                    >
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          marginTop: 4,
                          borderRadius: "50%",
                          background: on ? lv.accent : "#CBD5E1",
                          boxShadow: on ? `0 0 0 3px ${lv.soft}` : "none",
                          flexShrink: 0,
                        }}
                      />
                      <span>
                        <span style={{ display: "block" }}>{ar ? lv.ar : lv.en}</span>
                        {lv.key === "green" && blocked && canEdit && whySafe.length ? (
                          <span style={{ display: "block", marginTop: 4, fontSize: 10, fontWeight: 500, color: MUTED, lineHeight: 1.45 }}>
                            {whySafe.join(" · ")}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <label style={{ display: "block" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 7 }}>
                <CalendarDays style={{ width: 13, height: 13 }} strokeWidth={1.75} />
                {L("آخر تفتيش", "Last inspection")}
              </span>
              <PlatformDateField
                ar={ar}
                disabled={!canEdit}
                max={new Date().toISOString().slice(0, 10)}
                value={rec?.lastInspection ? String(rec.lastInspection).slice(0, 10) : ""}
                onChange={(next) => onUpdate({ lastInspection: next ? new Date(`${next}T00:00:00`).toISOString() : null })}
              />
            </label>

            <div style={{ marginTop: "auto", paddingTop: 4 }}>
              <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: MUTED }}>{L("الاعتماد", "Approval")}</p>
              <SafetyApprovalControl
                rec={rec}
                canApprove={canApprove}
                approvalIssues={approvalIssues}
                openHazardCount={openHazardCount}
                lang={lang}
                onApprove={onApprove}
                onRevoke={onRevokeApproval}
              />
            </div>
          </div>
        </aside>
        ) : null}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
        {showWork ? (
        <button
          type="button"
          onClick={() => setShowLog(true)}
          style={{
            ...ui.btnSecondary,
            height: 34,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: SURFACE,
          }}
        >
          <History style={{ width: 14, height: 14 }} strokeWidth={1.75} />
          {L("سجل الفرع", "Station record")}
        </button>
        ) : null}
        {showStatus ? (
        <div style={{ flex: 1, minWidth: 200 }}>
          <ApprovalHistory log={rec?.approvalLog} lang={lang} />
        </div>
        ) : null}
      </div>

      {showLog && <StationSafetyLog station={station} rec={rec} lang={lang} onClose={() => setShowLog(false)} />}

      <style>{`
        @media (max-width: 780px) {
          .hse-overview-grid {
            grid-template-columns: 1fr !important;
          }
          .hse-work-lanes {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
