import React, { useState } from "react";
import PublicSignShell from "@/components/files/PublicSignShell";
import PublicSignSteps from "@/components/files/PublicSignSteps";
import PublicSignStateCard from "@/components/files/PublicSignStateCard";
import RecipientSignStudio from "@/components/files/RecipientSignStudio";
import StampStudio from "@/components/files/StampStudio";
import SectionBackLink from "@/components/shared/SectionBackLink";
import SigningSectionFrame, { SIGN_LINE, SIGN_WHITE, signTab } from "@/components/files/SigningSectionFrame";
import usePublicSigning from "@/hooks/usePublicSigning";
import { useAuth } from "@/lib/PowerCareAuth";
import { pageKicker } from "@/lib/moduleMeta";
import { BORDER, CARD, INK, MUTED } from "@/lib/platformStyles";
import { signGhostBtn, signMono as mono, signPrimaryBtn } from "@/components/files/signingUi";

function docTitle(fileName = "") {
  return String(fileName).replace(/\.pdf$/i, "") || fileName;
}

export default function PublicSignFlow({ token, variant = "public", onBack, homeLabel }) {
  const { company, currentUser } = useAuth() || {};
  const [studioOpen, setStudioOpen] = useState(false);
  const persist = company?.id && currentUser?.id
    ? { companyId: company.id, userId: currentUser.id, user: currentUser }
    : null;
  const signing = usePublicSigning(token, { profile: currentUser?.profile, persist });
  const [leaveAsk, setLeaveAsk] = useState(false);
  const { ar, info, failure, loading, done, error, signing: busy, retract, reload } = signing;
  const expired = info?.expiresAt && new Date(info.expiresAt).getTime() <= Date.now();
  const deleted = info?.status === "deleted";
  const waiting = !deleted && info?.signer?.status === "pending" && !info?.canSign;
  const skipped = info?.signer?.status === "skipped";
  const rejected = done?.rejected || info?.status === "rejected" || info?.signer?.status === "rejected";
  const success = !deleted && !rejected && (done || info?.signer?.status === "signed");
  const invalidMessage = ar ? "رابط التوقيع غير صالح أو منتهي. اطلب من المرسل إنشاء طلب جديد." : "This signing link is invalid or expired. Ask the sender to create a new request.";
  const errorMessage = ar ? "تعذّر تحميل المستند بسبب خطأ مؤقت." : "The document couldn't be loaded because of a temporary error.";
  const live = !loading && !failure && !expired && !deleted && !waiting && !skipped && !rejected && !success;
  const step = success ? 3 : live ? 2 : 1;
  const remaining = !live ? "" : (ar ? "بانتظار ختمك" : "Awaiting your seal");
  const tip = !live ? "" : (ar ? "راجع المستند ثم اضغط ابدأ. الإنهاء يختم بتوقيعك الآمن وبصمة التراث." : "Review the document, then press Start. Finishing seals it with Secure Sign and the heritage fingerprint.");
  const leaveDialog = leaveAsk && live ? (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(event) => { if (event.target === event.currentTarget) setLeaveAsk(false); }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,40,75,.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 200,
      }}
    >
      <div dir={ar ? "rtl" : "ltr"} style={{ width: "min(420px, 100%)", background: CARD, border: `1px solid ${BORDER}`, padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: INK }}>
          {ar ? "الملف لم يُوقَّع بعد" : "The file is not signed yet"}
        </span>
        <p style={{ margin: 0, fontSize: 13, color: MUTED, lineHeight: 1.7 }}>
          {ar
            ? "مغادرة الصفحة قبل الإنهاء تُبقي المستند بلا توقيعك."
            : "Leaving before you finish keeps the document unsigned."}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setLeaveAsk(false)} style={signPrimaryBtn}>
            {ar ? "البقاء والتوقيع" : "Stay and sign"}
          </button>
          <button type="button" onClick={() => { setLeaveAsk(false); onBack?.(); }} style={signGhostBtn}>
            {ar ? "مغادرة دون توقيع" : "Leave unsigned"}
          </button>
        </div>
      </div>
    </div>
  ) : null;
  const title = info ? docTitle(info.fileName) : (ar ? "طلب توقيع إلكتروني" : "Electronic signature request");
  const requestBack = () => {
    if (busy || !live) {
      onBack?.();
      return;
    }
    setLeaveAsk(true);
  };
  const body = loading ? <PublicSignStateCard ar={ar} type="loading" />
    : failure ? <PublicSignStateCard ar={ar} type="error" message={failure.type === "invalid" ? invalidMessage : `${errorMessage}${failure.message ? ` ${failure.message}` : ""}`} onRetry={reload} />
    : expired ? <PublicSignStateCard ar={ar} type="error" message={invalidMessage} onRetry={reload} />
    : deleted ? <PublicSignStateCard ar={ar} type="deleted" info={info} />
    : waiting ? <PublicSignStateCard ar={ar} type="waiting" info={info} onRetry={reload} />
    : skipped ? <PublicSignStateCard ar={ar} type="skipped" info={info} />
    : rejected ? <PublicSignStateCard ar={ar} type="rejected" info={info} done={done} />
    : success ? <PublicSignStateCard ar={ar} type="success" info={info} done={done} onRetract={retract} retracting={busy} retractError={error} />
    : null;

  if (studioOpen && persist) {
    return (
      <StampStudio
        companyId={company.id}
        companyName={company.name}
        currentUser={currentUser}
        ar={signing.ar}
        onClose={() => setStudioOpen(false)}
        onSaved={(saved) => {
          signing.applySavedSeal(saved);
          setStudioOpen(false);
        }}
      />
    );
  }

  if ((live || success || rejected) && info) {
    return (
      <>
        <RecipientSignStudio
          signing={signing}
          onBack={requestBack}
          onOpenStudio={persist ? () => setStudioOpen(true) : undefined}
        />
        {leaveDialog}
      </>
    );
  }

  if (variant === "app") {
    const steps = [
      { value: "1", num: "01", label: ar ? "مراجعة المستند" : "Review document" },
      { value: "2", num: "02", label: ar ? "الحقول والتوقيع" : "Fields & sign" },
      { value: "3", num: "03", label: ar ? "تم" : "Done" },
    ];
    return (
      <SigningSectionFrame
        ar={ar}
        kicker={pageKicker("/app/signing", ar ? "ar" : "en")}
        title={title}
        hint={tip || remaining}
        meta={remaining && tip ? remaining : null}
      >
        <div style={{ background: SIGN_WHITE, border: `1px solid ${SIGN_LINE}`, borderTop: "none", padding: "9px 14px", display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center", boxSizing: "border-box" }}>
          <SectionBackLink ar={ar} label={homeLabel || (ar ? "التوقيع الرقمي" : "Digital signing")} onClick={requestBack} />
          {steps.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => {
                if (item.value === "3" && !success) return;
              }}
              style={signTab(String(step) === item.value)}
            >
              <span dir="ltr" style={{ ...mono, fontSize: 10, opacity: 0.75 }}>{item.num}</span>
              {item.label}
            </button>
          ))}
        </div>
        <div style={{ background: SIGN_WHITE, border: `1px solid ${SIGN_LINE}`, borderTop: "none", minHeight: 0 }}>
          {body}
        </div>
        {leaveDialog}
      </SigningSectionFrame>
    );
  }

  return (
    <PublicSignShell
      ar={ar}
      onBack={requestBack}
      info={info}
      remaining={remaining}
    >
      {!loading && (
        <PublicSignSteps
          ar={ar}
          current={step}
          tip={tip}
          onStep={(value) => {
            if (value === 3 && !success) return;
          }}
        />
      )}
      {body}
      {leaveDialog}
    </PublicSignShell>
  );
}
