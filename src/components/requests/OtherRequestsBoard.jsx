import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDate } from "@/lib/dateFormat";
import { useAuth } from "@/lib/PowerCareAuth";
import { submitOtherRequest, submitOtAssignment } from "@/lib/store";
import {
  OTHER_REQUEST_TYPES,
  checkSubmitOtherRequestGate,
  flattenOtherRequests,
  isArchivedOtherRequest,
  isManagerDecideOtherRequest,
  isPendingOtherRequest,
  otherRequestStatus,
  otherRequestTypeLabel,
} from "@/lib/otherRequestDerivations";
import { requestReplyCopy, requestReplyHref } from "@/lib/requestWorkspace";
import { checkRaiseOtAssignmentGate } from "@/lib/overtimeAssignment";
import { toast } from "@/components/ui/use-toast";
import EmployeeIdentityRow from "@/components/employees/EmployeeIdentityRow";
import { ChromeBox } from "@/components/shared/IdentityCard";
import RecordSmartArchive from "@/components/shared/RecordSmartArchive";
import { ACCENT, MUTED, NAVY, OK, WARN, BAD, emptyState, field, statCard, CARD, SURFACE } from "@/lib/platformStyles";
import PlatformDateField from "@/components/shared/PlatformDateField";

const COLS = "minmax(170px,1.4fr) 110px minmax(140px,1fr) minmax(160px,1.2fr) 90px 116px 150px";

function statusMeta(status, ar) {
  if (status === "approved") return { label: ar ? "معتمد" : "Approved", style: OK };
  if (status === "rejected") return { label: ar ? "مرفوض" : "Rejected", style: BAD };
  if (status === "refused_by_employee") return { label: ar ? "رفضه الموظف" : "Refused by worker", style: BAD };
  if (status === "pending_employee") return { label: ar ? "بانتظار الموظف" : "Awaiting worker", style: WARN };
  if (status === "pending_manager") return { label: ar ? "بانتظار المسؤول" : "Awaiting manager", style: WARN };
  return { label: ar ? "بانتظار القرار" : "Pending", style: WARN };
}

export default function OtherRequestsBoard({
  employees,
  stations,
  t,
  lang,
  view = "queue",
  canDecide = true,
  selfOnly = false,
}) {
  const ar = lang === "ar";
  const { company, currentUser, refresh, data } = useAuth();
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    employeeId: selfOnly ? (currentUser?.id || "") : "",
    type: "salary_letter",
    reason: "",
    date: "",
    hours: "",
    shiftTypeId: "",
    article106: false,
    article106Ground: "",
    manager106Ack: false,
  });

  const stationName = (id) => stations.find((station) => station.id === id)?.name || t("hq");

  const requests = useMemo(() => flattenOtherRequests(employees), [employees]);
  const pending = requests.filter(isPendingOtherRequest);
  const archived = requests.filter(isArchivedOtherRequest);

  if (view === "archive") {
    const archiveItems = archived.map((request) => {
      const st = statusMeta(request.status, ar);
      return {
        id: `${request.employee.id}-${request.id}`,
        date: request.reviewedAt || request.createdAt,
        title: request.employee?.name || "",
        text: [
          otherRequestTypeLabel(request.type, ar),
          request.reason,
          stationName(request.employee?.stationId),
        ].filter(Boolean).join(" · "),
        badge: st.label,
      };
    });
    return (
      <RecordSmartArchive
        items={archiveItems}
        lang={lang === "ar" ? "ar" : "en"}
        dir={ar ? "rtl" : "ltr"}
        emptyLabel={ar ? "لا طلبات أخرى مؤرشفة في هذا النطاق." : "No archived other requests in this scope."}
      />
    );
  }

  const assignmentRaise = form.type === "overtime" && !selfOnly;
  const gate = assignmentRaise
    ? checkRaiseOtAssignmentGate({
      reason: form.reason,
      hours: form.hours,
      date: form.date,
      article106: form.article106,
      article106Ground: form.article106Ground,
      manager106Ack: form.manager106Ack,
      annualCapConsent: form.annualCapConsent,
      otherRequests: employees.find((row) => row.id === form.employeeId)?.otherRequests,
    })
    : checkSubmitOtherRequestGate(form);
  const ready = gate.ok && form.employeeId && company?.id && !(assignmentRaise && form.article106);

  const emptyForm = {
    employeeId: selfOnly ? (currentUser?.id || "") : "",
    type: "salary_letter",
    reason: "",
    date: "",
    hours: "",
    shiftTypeId: "",
    article106: false,
    article106Ground: "",
    manager106Ack: false,
    annualCapConsent: false,
  };

  const createRequest = () => {
    if (!ready) {
      toast({ description: ar ? (gate.reason || "ارفع التكليف الإجباري من طلباتي مع ملف الواقعة.") : (gate.reasonEn || "Raise mandatory overtime from My Requests with the incident file."), variant: "destructive" });
      return;
    }
    const employee = employees.find((row) => row.id === form.employeeId);
    if (assignmentRaise) {
      const saved = submitOtAssignment(company.id, form.employeeId, {
        reason: form.reason,
        hours: form.hours,
        date: form.date,
        annualCapConsent: form.annualCapConsent,
        stationId: employee?.stationId,
        by: currentUser?.name,
      });
      if (saved && saved.ok === false) {
        toast({ description: ar ? saved.reason : saved.reasonEn, variant: "destructive" });
        return;
      }
      toast({ description: ar ? "سُجّل التكليف — بانتظار اختيار الموظف." : "Assignment recorded — awaiting the worker." });
      setForm(emptyForm);
      setFormOpen(false);
      refresh?.();
      return;
    }
    submitOtherRequest(company.id, form.employeeId, {
      type: form.type,
      reason: form.reason,
      date: form.date,
      hours: form.hours,
      shiftTypeId: form.shiftTypeId || undefined,
      stationId: employee?.stationId,
    });
    toast({
      description: ar
        ? "سُجّل الطلب — بانتظار الاعتماد"
        : "Request recorded — awaiting approval",
    });
    setForm(emptyForm);
    setFormOpen(false);
    refresh?.();
  };

  const replyHref = requestReplyHref({ mine: !!selfOnly });

  const headCell = {
    display: "grid",
    gridTemplateColumns: COLS,
    gap: "10px",
    padding: "10px 18px",
    background: SURFACE,
    borderBottom: "1px solid var(--nv-line)",
    fontSize: "10px",
    letterSpacing: "0.06em",
    color: MUTED,
    fontWeight: 600,
  };

  const rowCell = {
    display: "grid",
    gridTemplateColumns: COLS,
    gap: "10px",
    padding: "12px 18px",
    borderBottom: "1px solid var(--nv-line)",
    alignItems: "center",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} dir={ar ? "rtl" : "ltr"}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(166px,1fr))", gap: "12px" }}>
        <div style={statCard}>
          <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 24, fontWeight: 600, lineHeight: 1, textAlign: "right", color: pending.length ? "var(--nv-warn-ink)" : NAVY }}>
            {pending.length}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 7 }}>{ar ? "بانتظار القرار" : "awaiting a decision"}</div>
        </div>
        <div style={statCard}>
          <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 24, fontWeight: 600, lineHeight: 1, textAlign: "right", color: NAVY }}>
            {archived.filter((r) => r.status === "approved").length}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 7 }}>{ar ? "اعتُمدت" : "approved"}</div>
        </div>
        <div style={statCard}>
          <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: 24, fontWeight: 600, lineHeight: 1, textAlign: "right", color: NAVY }}>
            {archived.filter((r) => r.status === "rejected").length}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 7 }}>{ar ? "رُفضت" : "rejected"}</div>
        </div>
      </div>

      <ChromeBox padded={false}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--nv-line)" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 240px" }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>
                {ar ? "طلبات بانتظار القرار" : "Requests awaiting decision"}
              </div>
              <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
                {ar
                  ? "الشهادة والتعريف والاستئذان والإضافي والسلفة وتغيير الوردية وموافقة العمل الليلي — ليست إجازة."
                  : "Letters, permission, overtime, advances, shift changes, and night-work consent — not leave."}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setFormOpen((v) => !v)}
              style={{
                padding: "8px 15px",
                borderRadius: 8,
                border: "none",
                background: "var(--nv-btn-fill)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              {ar ? "+ سجّل طلباً" : "+ Record a request"}
            </button>
          </div>

          {formOpen && (
            <div style={{ marginTop: 13, padding: "15px 16px", borderRadius: 12, background: SURFACE, border: "1px solid var(--nv-line)" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 11 }}>
                {!selfOnly && (
                  <label style={{ display: "block" }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 5 }}>
                      {ar ? "الموظف" : "Employee"}
                    </span>
                    <select
                      value={form.employeeId}
                      onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}
                      style={field}
                    >
                      <option value="">{ar ? "اختر الموظف" : "Select an employee"}</option>
                      {employees.map((e) => (
                        <option key={e.id} value={e.id}>{e.name}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label style={{ display: "block" }}>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 5 }}>
                    {ar ? "نوع الطلب" : "Request type"}
                  </span>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    style={field}
                  >
                    {OTHER_REQUEST_TYPES.map((ty) => (
                      <option key={ty.key} value={ty.key}>{ar ? ty.ar : ty.en}</option>
                    ))}
                  </select>
                </label>
                {(form.type === "permission" || form.type === "overtime" || form.type === "shift_change" || form.type === "manual_punch") && (
                  <label style={{ display: "block" }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 5 }}>
                      {ar ? "التاريخ" : "Date"}
                    </span>
                    <PlatformDateField
                      ar={ar}
                      value={form.date}
                      onChange={(next) => setForm((f) => ({ ...f, date: next }))}
                    />
                  </label>
                )}
                {form.type === "shift_change" && (
                  <label style={{ display: "block" }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 5 }}>
                      {ar ? "الوردية المطلوبة" : "Requested shift"}
                    </span>
                    <select
                      value={form.shiftTypeId}
                      onChange={(e) => setForm((f) => ({ ...f, shiftTypeId: e.target.value }))}
                      style={field}
                    >
                      <option value="">{ar ? "راحة" : "Rest"}</option>
                      {((data?.schedules || []).find((row) => row.stationId === (employees.find((emp) => emp.id === form.employeeId)?.stationId || currentUser?.stationId))?.shiftTypes || []).map((shift) => (
                        <option key={shift.id} value={shift.id}>{shift.label} · {shift.start}–{shift.end}</option>
                      ))}
                    </select>
                  </label>
                )}
                {form.type === "overtime" && (
                  <label style={{ display: "block" }}>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 5 }}>
                      {ar ? "الساعات" : "Hours"}
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={form.hours}
                      onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
                      style={field}
                    />
                    {!selfOnly ? (
                      <span style={{ display: "block", fontSize: 10, color: MUTED, marginTop: 6, lineHeight: 1.7 }}>
                        {ar ? "تكليف اختياري من هنا. التكليف الإجباري (المادة 106) مع ملف الواقعة من إدارة طلباتي." : "Ordinary assignment from here. Mandatory Article 106 with the incident file is raised in Request admin."}
                      </span>
                    ) : null}
                  </label>
                )}
                <label style={{ display: "block", gridColumn: "1 / -1" }}>
                  <span style={{ display: "block", fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 5 }}>
                    {ar ? "السبب" : "Reason"}
                  </span>
                  <input
                    value={form.reason}
                    onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    style={field}
                    placeholder={ar ? "لماذا هذا الطلب؟" : "Why is this needed?"}
                  />
                </label>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 13 }}>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  style={{
                    height: 36,
                    padding: "0 14px",
                    borderRadius: 8,
                    border: "1px solid var(--nv-line)",
                    background: CARD,
                    color: MUTED,
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {ar ? "إلغاء" : "Cancel"}
                </button>
                <button
                  type="button"
                  disabled={!ready || busy}
                  onClick={createRequest}
                  style={{
                    height: 36,
                    padding: "0 16px",
                    borderRadius: 8,
                    border: "none",
                    background: ready ? ACCENT : "var(--nv-line)",
                    color: ready ? "#fff" : MUTED,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: ready && !busy ? "pointer" : "not-allowed",
                    fontFamily: "inherit",
                  }}
                >
                  {ar ? "أرسل الطلب للاعتماد" : "Submit for approval"}
                </button>
              </div>
            </div>
          )}
        </div>

        {pending.length === 0 ? (
          <div style={{ ...emptyState, border: "none", borderRadius: 0 }}>
            {archived.length > 0
              ? (ar ? "لا طلبات بانتظار القرار — المكتملة في الأرشيف." : "Nothing awaiting a decision — decided requests are in the archive.")
              : t("noOtherRequests")}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: 860 }}>
              <div style={headCell}>
                <div>{ar ? "الموظف" : "EMPLOYEE"}</div>
                <div>{ar ? "الفرع" : "STATION"}</div>
                <div>{ar ? "النوع" : "TYPE"}</div>
                <div>{ar ? "السبب" : "REASON"}</div>
                <div>{ar ? "التاريخ" : "DATE"}</div>
                <div>{ar ? "الحالة" : "STATUS"}</div>
                <div />
              </div>
              {pending.map((request) => {
                const st = statusMeta(otherRequestStatus(request), ar);
                return (
                  <div
                    key={`${request.employee.id}-${request.id}`}
                    style={rowCell}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "var(--nv-soft)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                  >
                    <EmployeeIdentityRow
                      employee={request.employee}
                      employeeId={request.employee.id}
                      name={request.employee.name}
                      showId={false}
                      compact
                    />
                    <div style={{ fontSize: 12, color: MUTED }}>{stationName(request.employee.stationId)}</div>
                    <div style={{ fontSize: 12, color: MUTED }}>{otherRequestTypeLabel(request.type, ar)}</div>
                    <div style={{ fontSize: 12, color: NAVY, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {request.reason || "—"}
                    </div>
                    <div dir="ltr" style={{ fontSize: 12, color: MUTED, textAlign: "right" }}>
                      {request.date ? formatDate(request.date, lang) : "—"}
                    </div>
                    <div><span style={st.style}>{st.label}</span></div>
                    <div style={{ display: "flex", gap: 7, justifyContent: "flex-end" }}>
                      {canDecide && request.type === "night_consent" && (request.status || "pending") === "pending" && (
                        <span style={{ fontSize: 11, color: request.phase === "manager" ? MUTED : "var(--nv-bad-ink)" }}>
                          {ar ? "سارية حتى يختار الموظف" : "In force until the worker chooses"}
                        </span>
                      )}
                      {canDecide && request.type !== "night_consent" && isManagerDecideOtherRequest(request) && (
                        <Link
                          to={replyHref}
                          style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-ok-ink)", textDecoration: "none", whiteSpace: "nowrap" }}
                        >
                          {requestReplyCopy(ar)}
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </ChromeBox>
    </div>
  );
}
