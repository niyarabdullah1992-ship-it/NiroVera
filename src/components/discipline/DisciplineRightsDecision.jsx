import React, { useState } from "react";
import RequestDecisionComposer from "@/components/requests/RequestDecisionComposer";
import ConsentFileLink from "@/components/requests/ConsentFileLink";
import { SectionHead, slab } from "@/components/schedules/scheduleChrome";
import { GRIEVANCE_KINDS, GRIEVANCE_TYPE, damageObjectionDeadline, grievanceState } from "@/lib/rightsRequests";
import { regulationDate } from "@/lib/workRegulation";
import { decideOtherRequest, otherRequestDecisionState } from "@/lib/otherRequestDecision";
import { toast } from "@/components/ui/use-toast";

const MONO = "var(--font-mono, 'IBM Plex Mono', monospace)";

function Fact({ label, children, mono = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid var(--nv-line2, #EEF1EF)", fontSize: 12.5 }}>
      <span style={{ color: "var(--nv-muted)" }}>{label}</span>
      <span dir={mono ? "ltr" : undefined} style={{ color: "var(--nv-ink)", fontWeight: 600, fontFamily: mono ? MONO : "inherit", textAlign: "end", overflowWrap: "anywhere" }}>{children}</span>
    </div>
  );
}

/**
 * The decision card for a grievance (model Art. 71) or an Art. 91 damage objection, beside the queue in
 * «قائمة الجزاءات». The facts, then the same RequestDecisionComposer and the same decision path
 * (decideOtherRequest) as the طلباتي inbox — reason, attachment, approve / return / refuse.
 */
export default function DisciplineRightsDecision({ row, ar = true, companyId, actor, today, isHoliday, canDecide = false, refresh }) {
  const [note, setNote] = useState("");
  const [ground, setGround] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!row) return null;
  const grievance = row.type === GRIEVANCE_TYPE;
  const kind = GRIEVANCE_KINDS.find((k) => k.key === row.grievanceKind);
  const st = grievance ? grievanceState(row, today, isHoliday) || {} : null;
  const last = !grievance ? (row.objectionLastDay || damageObjectionDeadline(row.notifiedOn)) : "";
  const pending = ["pending", "pending_manager"].includes(String(row.status || "pending"));
  const state = otherRequestDecisionState(row, { note, ground, verified, ar });

  const decide = (status) => {
    if (busy || !canDecide || !companyId) return;
    setBusy(true);
    try {
      const result = decideOtherRequest({ companyId, row, status, note, ground, verified, actor, ar });
      if (!result.ok) {
        toast({ description: ar ? result.reason : result.reasonEn, variant: "destructive" });
        return;
      }
      setNote(""); setGround(""); setVerified(false);
      refresh?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    <article data-disc-rights-decision={row.id} style={{ ...slab, overflow: "hidden", minWidth: 0 }}>
      <SectionHead
        title={grievance
          ? (ar ? `تظلّم — ${row.employee?.name || "—"}` : `Grievance — ${row.employee?.name || "—"}`)
          : (ar ? `اعتراض على خصم إتلاف — ${row.employee?.name || "—"}` : `Damage objection — ${row.employee?.name || "—"}`)}
        note={grievance
          ? (ar ? "النموذج الموحد م71 · يُبتّ فيه كتابةً خلال 15 يوماً" : "Model Art. 71 · decided in writing within 15 days")
          : (ar ? "نظام العمل م91 · إن قُبل رُدّ المبلغ في المسير" : "Labour Law Art. 91 · if accepted, refunded on payroll")}
      />
      <div style={{ padding: "8px 18px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          {grievance ? <Fact label={ar ? "يتظلّم من" : "Grieves"}>{kind ? (ar ? kind.ar : kind.en) : "—"}</Fact> : null}
          {!grievance ? <Fact label={ar ? "المبلغ المخصوم" : "Amount deducted"} mono>{`${Number(row.amount) || 0} ${ar ? "ر.س" : "SAR"}`}</Fact> : null}
          <Fact label={ar ? "أُبلغ في" : "Told on"} mono>{String(row.notifiedOn || "").slice(0, 10) || "—"}</Fact>
          {grievance && st?.replyBy ? <Fact label={ar ? "الرد عليه حتى" : "Answer due by"} mono>{st.replyBy}</Fact> : null}
          {!grievance && last ? <Fact label={ar ? "آخر يوم للاعتراض" : "Last day to object"} mono>{last}</Fact> : null}
        </div>
        <p style={{ margin: 0, fontSize: 13, color: "var(--nv-ink)", lineHeight: 1.9, background: "var(--nv-soft)", border: "1px solid var(--nv-line2, #EEF1EF)", borderRadius: 8, padding: "10px 12px", overflowWrap: "anywhere" }}>
          {row.reason || "—"}
        </p>
        {(row.files || []).filter((f) => f?.url).map((f) => (
          <ConsentFileLink key={f.hash || f.name} file={f} ar={ar}>{ar ? `نزّل المرفق: ${f.name}` : `Download: ${f.name}`}</ConsentFileLink>
        ))}
        {pending && canDecide ? (
          <RequestDecisionComposer
            ar={ar}
            busy={busy}
            note={note}
            onNote={setNote}
            approveGate={state.approveGate}
            rejectGate={state.rejectGate}
            refuseBlocked={state.refuseBlocked}
            noteReady={Boolean(note.trim())}
            approveLabel={grievance ? (ar ? "اقبل التظلم" : "Uphold the grievance") : (ar ? "اقبل الاعتراض ورد المبلغ" : "Accept and refund")}
            grounds={state.refusalGrounds}
            groundName={`disc-${row.id}`}
            ground={ground}
            onGround={setGround}
            verified={verified}
            onVerified={setVerified}
            onApprove={() => decide("approved")}
            onReject={() => !state.refuseBlocked && decide("rejected")}
            onRevise={() => note.trim() && decide("revise")}
          />
        ) : (
          <span style={{ fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.8 }}>
            {row.status === "approved"
              ? (ar ? "قُبل" : "Accepted")
              : row.status === "rejected"
                ? (ar ? `رُفض${row.reviewNote ? ` — ${row.reviewNote}` : ""}` : "Refused")
                : pending
                  ? (ar ? "بانتظار من يقرّر فيه في نطاقه." : "Awaiting whoever decides it in scope.")
                  : (ar ? "مبتوت فيه" : "Decided")}
            {grievance && st?.courtBy && row.status === "rejected" ? (ar ? ` · المحكمة العمالية حتى ${regulationDate(st.courtBy)}` : ` · labour court by ${st.courtBy}`) : ""}
          </span>
        )}
      </div>
    </article>
  );
}
