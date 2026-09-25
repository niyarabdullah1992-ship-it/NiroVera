import React, { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { checkPublicApplyGate } from "@/lib/hiringDerivations";
import {
  CAREERS_ROLE_SECTIONS,
  CAREERS_SAMPLE_ROLES,
  CAREERS_STEPS,
} from "@/lib/careersContent";
import { BORDER, INK, MUTED, SURFACE } from "@/lib/publicChrome";
import AttachFileButton from "@/components/shared/AttachFileButton";

async function hiringPublic(payload) {
  const res = await base44.functions.invoke("hiring", payload);
  return res?.data ?? res;
}

const INP = {
  width: "100%",
  height: "40px",
  border: `1px solid ${BORDER}`,
  borderRadius: "9px",
  background: SURFACE,
  padding: "0 11px",
  fontSize: "13px",
  color: INK,
  outline: "none",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const NUM_STYLE = {
  width: "26px",
  height: "26px",
  borderRadius: "50%",
  background: "var(--nv-accent-soft)",
  color: "var(--nv-accent-deep)",
  fontSize: "12px",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  fontFamily: "'IBM Plex Sans',sans-serif",
};

const LABEL = {
  display: "block",
  fontSize: "11px",
  fontWeight: 600,
  color: MUTED,
  marginBottom: "5px",
};

/**
 * Careers apply board — Careers.dc.html L40–182 (literal).
 * Keeps publicList / publicApply hiring hooks.
 */
export default function CareersIntake({
  ar,
  companyId,
  initialJobKey,
  onJobChange,
}) {
  const [loading, setLoading] = useState(Boolean(companyId));
  const [company, setCompany] = useState(null);
  const [vacancies, setVacancies] = useState([]);
  const [error, setError] = useState(null);
  const [jobKey, setJobKey] = useState(initialJobKey || "");
  const [form, setForm] = useState({
    name: "",
    nameEn: "",
    nationalId: "",
    phone: "",
    email: "",
    exp: "",
    nat: "saudi",
    cvName: "",
  });
  const [busy, setBusy] = useState(false);
  const [sentRef, setSentRef] = useState(null);
  const [gateMsg, setGateMsg] = useState(null);
  const [demoNotify, setDemoNotify] = useState("");
  const [demoNotified, setDemoNotified] = useState(false);

  const live = Boolean(companyId);
  const startAlign = ar ? "right" : "left";
  const T = (a, e) => (ar ? a : e);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      setCompany(null);
      setVacancies([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const remote = await hiringPublic({ action: "publicList", companyId });
        if (cancelled) return;
        if (remote?.error) {
          setError(ar ? (remote.reason || remote.error) : (remote.reasonEn || remote.reason || remote.error));
          setVacancies([]);
          setCompany(null);
        } else {
          setCompany(remote.company || { companyId, name: companyId });
          setVacancies(remote.vacancies || []);
          const keys = (remote.vacancies || []).map((v) => v.key);
          if (initialJobKey && keys.includes(initialJobKey)) setJobKey(initialJobKey);
          else if (keys.length && !keys.includes(jobKey)) setJobKey(keys[0]);
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err?.message || err));
          setVacancies([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, ar]);

  useEffect(() => {
    if (initialJobKey) setJobKey(initialJobKey);
  }, [initialJobKey]);

  const selectJob = (key) => {
    setJobKey(key);
    setSentRef(null);
    setGateMsg(null);
    onJobChange?.(key);
  };

  const liveJob = vacancies.find((v) => v.key === jobKey) || vacancies[0] || null;
  const sampleJob =
    CAREERS_SAMPLE_ROLES.find((r) => r.key === jobKey) || CAREERS_SAMPLE_ROLES[0];
  const hasJob = live ? Boolean(liveJob) : Boolean(sampleJob);
  const isNone = live && !loading && vacancies.length === 0;

  const title = live
    ? liveJob?.title || T("لا شواغر معلنة حاليًا", "No vacancies advertised")
    : ar
      ? sampleJob.titleAr
      : sampleJob.titleEn;

  const jobCode = live ? (liveJob?.key || liveJob?.code || "—") : sampleJob?.key || "R1";

  const facts = live && liveJob
    ? [
        { value: liveJob.stationName, label: T("الموقع", "Location") },
        { value: T("دوام كامل", "Full time"), label: T("نوع التعاقد", "Contract") },
        { value: liveJob.grade, label: T("الدرجة", "Grade") },
        {
          value: liveJob.saudiFirst ? T("سعودة أولًا", "Saudi-first") : T("مفتوح", "Open"),
          label: T("القناة", "Channel"),
        },
      ]
    : [
        { value: ar ? sampleJob.stationAr : sampleJob.stationEn, label: T("الموقع", "Location") },
        { value: ar ? sampleJob.contractAr : sampleJob.contractEn, label: T("نوع التعاقد", "Contract") },
        { value: sampleJob.grade, label: T("الدرجة", "Grade") },
        { value: ar ? sampleJob.expAr : sampleJob.expEn, label: T("الخبرة", "Experience") },
      ];

  const others = live
    ? vacancies.filter((v) => v.key !== (liveJob?.key || jobKey)).slice(0, 4)
    : CAREERS_SAMPLE_ROLES.filter((r) => r.key !== sampleJob.key);

  const closesLabel = live && liveJob?.closes
    ? liveJob.closes
    : live && liveJob?.opened
      ? (ar ? `فُتح ${liveJob.opened}` : `Opened ${liveJob.opened}`)
      : (ar ? sampleJob?.closesAr : sampleJob?.closesEn) || T("يغلق 24 أغسطس 2026", "Closes 24 August 2026");

  const ready =
    String(form.name || "").trim()
    && String(form.nationalId || "").trim()
    && String(form.phone || "").trim()
    && !!form.cvName;
  const notifyReady = /.+@.+\..+/.test(String(demoNotify || ""));

  const submit = async (e) => {
    e.preventDefault();
    setGateMsg(null);
    if (!live) {
      setGateMsg(
        T(
          "هذه صفحة تعريفية. افتح رابط وظائف الشركة /careers?company=… لإرسال طلب حقيقي.",
          "This is the product surface. Open the company careers link /careers?company=… to submit a real application.",
        ),
      );
      return;
    }
    if (!liveJob) {
      setGateMsg(T("لا يوجد شاغر مفتوح للتقديم.", "No open vacancy to apply for."));
      return;
    }
    const gate = checkPublicApplyGate({
      name: form.name,
      phone: form.phone,
      vacancyKey: liveJob.key,
    });
    if (!gate.ok) {
      setGateMsg(ar ? gate.reason : gate.reasonEn);
      return;
    }
    setBusy(true);
    try {
      const remote = await hiringPublic({
        action: "publicApply",
        companyId,
        vacancyKey: liveJob.key,
        name: form.name,
        nameEn: form.nameEn,
        phone: form.phone,
        email: form.email,
        nationalId: form.nationalId,
        nat: form.nat,
        cvName: form.cvName,
        saudi: form.nat !== "other",
      });
      if (remote?.error) {
        setGateMsg(ar ? (remote.reason || remote.error) : (remote.reasonEn || remote.reason || remote.error));
      } else if (remote?.ref) {
        setSentRef(remote.ref);
      } else {
        setGateMsg(T("تعذّر إرسال الطلب.", "Could not submit the application."));
      }
    } catch (err) {
      setGateMsg(String(err?.message || err));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", minHeight: "40vh", alignItems: "center", justifyContent: "center", color: "#5A6B85" }}>
        <Loader2 style={{ width: "24px", height: "24px" }} className="animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {hasJob && !isNone ? (
        <div dir="ltr" style={{ fontSize: "11px", color: "#5A6B85", fontFamily: "'IBM Plex Mono',monospace", textAlign: startAlign }}>
          nirovera.sa/jobs/{jobCode}
        </div>
      ) : null}

      <h1 style={{ margin: "10px 0 0", fontSize: "30px", fontWeight: 600, letterSpacing: "-0.02em", lineHeight: 1.25, textWrap: "pretty" }}>
        {title}
      </h1>

      {hasJob && !isNone ? (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "14px" }}>
          {facts.map((f) => (
            <span
              key={f.label}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "7px",
                padding: "6px 12px",
                borderRadius: "9px",
                background: "var(--nv-card)",
                border: "1px solid var(--nv-line)",
                fontSize: "12px",
                color: "#5A6B85",
              }}
            >
              <span style={{ fontWeight: 600, color: "#14284B" }}>{f.value}</span>
              <span>{f.label}</span>
            </span>
          ))}
        </div>
      ) : null}

      {error ? (
        <div style={{ marginTop: "14px", padding: "11px 13px", borderRadius: "10px", background: "#FEF2F2", border: "1px solid #FECACA", fontSize: "12px", color: "#B91C1C", lineHeight: 1.7 }}>
          {error}
        </div>
      ) : null}

      {isNone ? (
        <div style={{ marginTop: "18px", background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: "14px", padding: "26px 24px", maxWidth: "620px" }}>
          <div style={{ fontSize: "13px", color: "#5A6B85", lineHeight: 1.8, textWrap: "pretty" }}>
            {T(
              `لا يوجد ما يُقدَّم عليه الآن، ولن نطلب منك بياناتك بلا شاغر قائم. اترك بريدك لنبلغك أول ما يُنشر شاغر يناسبك، أو تابع الصفحة لاحقًا.`,
              `There is nothing to apply for right now, and we will not take your details without a live vacancy. Leave your email and we will tell you the moment a suitable role is posted, or check back later.`,
            )}
          </div>
          {demoNotified ? (
            <div style={{ marginTop: "14px", padding: "11px 13px", borderRadius: "10px", background: "#ECFDF3", border: "1px solid #BBF7D0", fontSize: "12px", color: "#166534", lineHeight: 1.7 }}>
              {T("سنبلغك على بريدك أول ما يُنشر شاغر مناسب.", "We will email you as soon as a suitable role is posted.")}
            </div>
          ) : (
            <div style={{ display: "flex", gap: "9px", marginTop: "14px", flexWrap: "wrap" }}>
              <input
                type="email"
                value={demoNotify}
                onChange={(e) => setDemoNotify(e.target.value)}
                placeholder="name@example.com"
                style={{
                  flex: "1 1 220px",
                  height: "40px",
                  border: "1px solid var(--nv-line)",
                  borderRadius: "10px",
                  background: "var(--nv-inset)",
                  padding: "0 11px",
                  fontSize: "13px",
                  color: "#14284B",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <button
                type="button"
                onClick={() => {
                  if (notifyReady) setDemoNotified(true);
                }}
                style={
                  notifyReady
                    ? { height: "40px", padding: "0 16px", borderRadius: "10px", border: "none", background: "#1E9E63", color: "#fff", fontSize: "13px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }
                    : { height: "40px", padding: "0 16px", borderRadius: "10px", border: "none", background: "#E2E8F0", color: "#5A6B85", fontSize: "13px", fontWeight: 600, cursor: "not-allowed", fontFamily: "inherit" }
                }
              >
                {T("أبلغني عند نشر شاغر", "Notify me when a role opens")}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {!isNone && hasJob ? (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginTop: "14px",
              padding: "11px 14px",
              borderRadius: "11px",
              background: "#ECFDF3",
              border: "1px solid #BBF7D0",
              flexWrap: "wrap",
            }}
          >
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#1E9E63", flexShrink: 0 }} />
            <span style={{ flex: "1 1 260px", fontSize: "12px", color: "#166534", lineHeight: 1.7, textWrap: "pretty" }}>
              {T(
                "التقديم مفتوح، وتُراجَع الطلبات أولًا بأول — لا تنتظر إغلاق الباب.",
                "Applications are open and reviewed as they arrive — do not wait for the closing date.",
              )}
            </span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#14683F", whiteSpace: "nowrap" }}>{closesLabel}</span>
          </div>

          <div style={{ display: "flex", gap: "18px", marginTop: "22px", flexWrap: "wrap", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: "14px" }}>
              {CAREERS_ROLE_SECTIONS.map((section) => (
                <div key={section.titleEn} style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: "14px", padding: "18px 20px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 600 }}>{ar ? section.titleAr : section.titleEn}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "9px", marginTop: "11px" }}>
                    {(ar ? section.itemsAr : section.itemsEn).map((item) => (
                      <div key={item} style={{ display: "flex", gap: "10px" }}>
                        <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#1E9E63", flexShrink: 0, marginTop: "8px" }} />
                        <span style={{ flex: 1, fontSize: "13px", lineHeight: 1.75, color: "#5A6B85", textWrap: "pretty" }}>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: "14px", padding: "18px 20px" }}>
                <div style={{ fontSize: "14px", fontWeight: 600 }}>{T("ماذا يحدث بعد أن ترسل طلبك", "What happens after you apply")}</div>
                <div style={{ fontSize: "12px", color: "#5A6B85", marginTop: "4px", lineHeight: 1.7, textWrap: "pretty" }}>
                  {T(
                    "لكل مرحلة مهلة معلنة. إن تجاوزناها فلك أن تسأل عن سبب التأخر بالرقم المرجعي.",
                    "Every stage has a published deadline. If we exceed it, you may ask why using your reference number.",
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", marginTop: "10px" }}>
                  {CAREERS_STEPS.map((step) => (
                    <div key={step.n} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "11px 0", borderTop: "1px solid #F1F5F9" }}>
                      <span style={NUM_STYLE}>{step.n}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: "block", fontSize: "13px", fontWeight: 600 }}>{ar ? step.ar.label : step.en.label}</span>
                        <span style={{ display: "block", fontSize: "12px", color: "#5A6B85", marginTop: "2px" }}>{ar ? step.ar.when : step.en.when}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: "var(--nv-card)", border: "1px dashed var(--nv-line)", borderRadius: "14px", padding: "16px 18px" }}>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#14284B" }}>{T("بياناتك", "Your data")}</div>
                <div style={{ fontSize: "12px", color: "#5A6B85", marginTop: "5px", lineHeight: 1.75, textWrap: "pretty" }}>
                  {T(
                    "تُستخدم بياناتك لتقييم هذا الطلب فقط، وتُحفظ سنة واحدة ثم تُحذف ما لم تأذن ببقائها لشواغر أخرى. لك أن تطلب حذفها في أي وقت بالرقم المرجعي.",
                    "Your data is used to assess this application only. It is kept for one year and then deleted unless you allow us to keep it for other vacancies. You may request deletion at any time using your reference number.",
                  )}
                </div>
              </div>
            </div>

            <div style={{ flex: "1 1 320px", minWidth: 0, position: "sticky", top: "18px" }}>
              <div style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderRadius: "14px", padding: "18px 20px" }}>
                {sentRef ? (
                  <div style={{ textAlign: "center", padding: "8px 0" }}>
                    <div style={{ width: "46px", height: "46px", borderRadius: "50%", background: "#ECFDF3", border: "1px solid #BBF7D0", color: "#15803D", display: "flex", alignItems: "center", justifyContent: "center", marginInline: "auto", fontSize: "20px" }}>✓</div>
                    <div style={{ fontSize: "15px", fontWeight: 600, marginTop: "12px" }}>{T("وصل طلبك", "Your application is in")}</div>
                    <div style={{ fontSize: "12px", color: "#5A6B85", marginTop: "6px", lineHeight: 1.75, textWrap: "pretty" }}>
                      {T(
                        "سيصلك إشعار عند كل تغيّر في حالة طلبك، سواء تقدّم أو رُفض — لن نتركك بلا رد.",
                        "You will be notified at every change of status, whether you advance or are rejected — you will not be left without an answer.",
                      )}
                    </div>
                    <div dir="ltr" style={{ marginTop: "12px", fontSize: "13px", fontWeight: 600, color: "#14683F", fontFamily: "'IBM Plex Mono',monospace", background: "#ECFDF3", border: "1px solid #BBF7D0", borderRadius: "9px", padding: "8px 12px" }}>
                      {sentRef}
                    </div>
                    <div style={{ fontSize: "12px", color: "#5A6B85", marginTop: "8px" }}>
                      {T("احفظ هذا الرقم — به تتابع طلبك أو تطلب حذف بياناتك.", "Keep this number — use it to follow your application or request deletion.")}
                    </div>
                  </div>
                ) : (
                  <form onSubmit={submit}>
                    <div style={{ fontSize: "15px", fontWeight: 600 }}>{T("قدّم على هذه الوظيفة", "Apply for this role")}</div>
                    <div style={{ fontSize: "12px", color: "#5A6B85", marginTop: "4px", lineHeight: 1.65, textWrap: "pretty" }}>
                      {T("دقيقتان — بلا حساب وبلا كلمة مرور.", "Two minutes — no account, no password.")}
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: "11px", marginTop: "14px" }}>
                      {[
                        ["name", T("الاسم الكامل", "Full name"), T("كما في الهوية", "As on your ID")],
                        ["nameEn", T("الاسم بالإنجليزية (كما في الجواز)", "Name in English (as on your passport)"), "Rayan Aldosari"],
                        ["nationalId", T("رقم الهوية أو الإقامة", "National ID or Iqama"), "1xxxxxxxxx"],
                        ["phone", T("رقم الجوال", "Mobile number"), "+9665xxxxxxxx"],
                        ["email", T("البريد الإلكتروني", "Email"), "name@example.com"],
                        ["exp", T("سنوات الخبرة", "Years of experience"), "5"],
                      ].map(([key, label, ph]) => (
                        <label key={key} style={{ display: "block" }}>
                          <span style={LABEL}>{label}</span>
                          <input
                            value={form[key]}
                            onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                            placeholder={ph}
                            required={key === "name" || key === "phone" || key === "nationalId"}
                            style={INP}
                          />
                        </label>
                      ))}

                      <label style={{ display: "block" }}>
                        <span style={LABEL}>{T("الجنسية", "Nationality")}</span>
                        <select
                          value={form.nat}
                          onChange={(e) => setForm((f) => ({ ...f, nat: e.target.value }))}
                          style={{ ...INP, padding: "0 11px" }}
                        >
                          <option value="saudi">{T("سعودي / سعودية", "Saudi")}</option>
                          <option value="other">{T("غير سعودي", "Non-Saudi")}</option>
                        </select>
                      </label>

                      <label style={{ display: "block" }}>
                        <span style={LABEL}>{T("السيرة الذاتية (PDF أو Word)", "CV (PDF or Word)")}</span>
                        <AttachFileButton
                          ar={ar}
                          accept=".pdf,.doc,.docx"
                          label={form.cvName || T("أرفق السيرة الذاتية", "Attach the CV")}
                          onPick={(file) => setForm((current) => ({ ...current, cvName: file?.name || "" }))}
                        />
                      </label>
                    </div>

                    {gateMsg ? (
                      <div style={{ marginTop: "12px", padding: "9px 12px", borderRadius: "9px", background: "#FFFBEB", border: "1px solid #FDE68A", fontSize: "12px", color: "#B45309", lineHeight: 1.65 }}>
                        {gateMsg}
                      </div>
                    ) : null}

                    <button
                      type="submit"
                      disabled={busy || (live && !ready)}
                      style={
                        (!live || ready) && !busy
                          ? { width: "100%", height: "44px", marginTop: "14px", borderRadius: "10px", border: "none", background: "#1E9E63", color: "#fff", fontSize: "14px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }
                          : { width: "100%", height: "44px", marginTop: "14px", borderRadius: "10px", border: "none", background: "#E2E8F0", color: "#5A6B85", fontSize: "14px", fontWeight: 600, cursor: "not-allowed", fontFamily: "inherit" }
                      }
                    >
                      {busy ? "…" : T("أرسل الطلب", "Submit application")}
                    </button>
                    <div style={{ fontSize: "12px", color: "#5A6B85", marginTop: "9px", lineHeight: 1.7, textWrap: "pretty" }}>
                      {T(
                        "بإرسال الطلب توافق على مراجعة بياناتك لهذا الشاغر وفق ما ورد أعلاه.",
                        "By submitting you agree to your data being reviewed for this vacancy as described above.",
                      )}
                    </div>
                  </form>
                )}
              </div>

              {others.length > 0 ? (
                <div style={{ background: "#14284B", borderRadius: "14px", padding: "16px 18px", marginTop: "14px", color: "#fff" }}>
                  <div style={{ fontSize: "11px", letterSpacing: "0.1em", color: "#6EE7B7", fontWeight: 600 }}>
                    {T("شواغر أخرى مفتوحة", "OTHER OPEN ROLES")}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", marginTop: "8px" }}>
                    {others.map((o) => {
                      const key = o.key;
                      const oTitle = live ? o.title : ar ? o.titleAr : o.titleEn;
                      const meta = live
                        ? `${o.stationName} · ${o.grade}`
                        : `${ar ? o.stationAr : o.stationEn} · ${o.grade}`;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => selectJob(key)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "10px 0",
                            borderTop: "1px solid rgba(255,255,255,.1)",
                            borderLeft: "none",
                            borderRight: "none",
                            borderBottom: "none",
                            background: "transparent",
                            color: "inherit",
                            textAlign: "start",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            width: "100%",
                          }}
                        >
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#fff" }}>{oTitle}</span>
                            <span style={{ display: "block", fontSize: "11px", color: "#A8B4C8", marginTop: "2px" }}>{meta}</span>
                          </span>
                          <span style={{ color: "#6EE7B7", fontSize: "13px" }}>{ar ? "←" : "→"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}

      {!live ? (
        <p style={{ marginTop: "28px", maxWidth: "640px", fontSize: "12px", lineHeight: 1.7, color: "#5A6B85", textWrap: "pretty" }}>
          {T(
            "للشركات على NiroVera: شارك رابط وظائف شركتك /careers?company=… — الطلبات تدخل طابور التوظيف باتجاه واحد دون إنشاء حساب موظف.",
            "For companies on NiroVera: share your careers link /careers?company=… — applications enter the hiring queue one-way without creating an employee account.",
          )}
        </p>
      ) : null}
    </div>
  );
}
