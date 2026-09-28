import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import MarketingChrome from "@/components/landing/MarketingChrome";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/PowerCareAuth";
import { trackVisit } from "@/lib/trackVisit";
import { MUTED, INK, CARD, SURFACE } from "@/lib/platformStyles";

/** Thin phone bezel — content styles from Mobile.dc.html (android-frame.jsx not copied). */
function PhoneFrame({ title, children, dir }) {
  return (
    <div
      title={title}
      style={{
        width: "392px",
        height: "844px",
        borderRadius: "36px",
        border: "10px solid var(--nv-navy)",
        overflow: "hidden",
        background: SURFACE,
        boxShadow: "0 24px 60px rgba(20,40,75,.18)",
        flexShrink: 0,
      }}
    >
      <div dir={dir} style={{ height: "100%", overflow: "auto" }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Field companion marketing — NiroVera Mobile.dc.html L23–210.
 */
export default function Mobile() {
  const { lang, setLang } = useI18n();
  const { session, currentUser } = useAuth();
  const loggedIn = Boolean(session?.userId && currentUser);
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";
  const T = (a, e) => (ar ? a : e);

  useEffect(() => {
    trackVisit("/mobile");
  }, []);

  return (
    <MarketingChrome ar={ar} lang={lang} loggedIn={loggedIn} onToggleLang={() => setLang(ar ? "en" : "ar")} ctaHref="/pricing">
      <div style={{ maxWidth: "1500px", margin: "0 auto", padding: "44px 40px 60px" }}>

        <h1 style={{ margin: "26px 0 0", fontSize: "34px", fontWeight: 600, letterSpacing: "-0.02em" }}>
          {T("ما يراه الفني في الفرع", "What the technician sees on site")}
        </h1>
        <p style={{ margin: "12px 0 0", fontSize: "16px", color: MUTED, maxWidth: "760px", lineHeight: 1.7, textWrap: "pretty" }}>
          {T(
            "أربع شاشات تغطي يوم عمل كامل: تسجيل الحضور بالموقع، المهام المسندة، إغلاق العمل بالصورة، والبلاغ المجهول. لا قوائم ولا إعدادات — كل شاشة فعل واحد.",
            "Four screens cover a full workday: geo check-in, assigned tasks, closing work with a photo, and anonymous reporting. No menus, no settings — one action per screen.",
          )}
        </p>

        <div style={{ display: "flex", gap: "36px", marginTop: "44px", flexWrap: "wrap", alignItems: "flex-start" }}>
          {/* 01 Attendance L38–73 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", width: "392px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
              <span style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "13px", fontWeight: 600, color: "var(--nv-ok-ink)" }}>01</span>
              <span style={{ fontSize: "16px", fontWeight: 600 }}>{T("تسجيل الحضور", "Check-in")}</span>
            </div>
            <p style={{ margin: 0, fontSize: "14px", color: MUTED, lineHeight: 1.65 }}>
              {T("الزر يعمل فقط داخل نطاق الفرع. خارجه يظهر السبب والمسافة، لا رسالة خطأ مبهمة.", "The button works only inside the station geofence. Outside it, you see the reason and distance — not a vague error.")}
            </p>
            <PhoneFrame title={T("الحضور", "Attendance")} dir={dir}>
              <div style={{ fontFamily: "'IBM Plex Sans Arabic',sans-serif", background: SURFACE, height: "100%", padding: "20px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ background: "var(--nv-navy)", borderRadius: "18px", padding: "22px", color: "#fff" }}>
                  <div style={{ fontSize: "12px", color: "#A9CDB8", letterSpacing: "0.1em", fontWeight: 600 }}>{T("وردية الصباح", "Morning shift")}</div>
                  <div dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "52px", fontWeight: 600, lineHeight: 1, marginTop: "12px", textAlign: "right" }}>05:47</div>
                  <div style={{ fontSize: "14px", color: "var(--nv-muted)", marginTop: "6px" }}>{T("الأحد 9 أغسطس · فرع الجبيل 1", "Sunday 9 Aug · Jubail 1")}</div>
                </div>
                <div style={{ background: CARD, border: "1px solid var(--nv-line)", borderRadius: "16px", padding: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "var(--nv-btn-fill)", flexShrink: 0 }} />
                    <span style={{ fontSize: "15px", fontWeight: 500 }}>{T("داخل نطاق الفرع", "Inside station geofence")}</span>
                  </div>
                  <div style={{ fontSize: "13px", color: MUTED, marginTop: "8px", lineHeight: 1.6 }}>{T("تبعد 12 مترًا عن مركز الفرع. دقة الموقع 4 أمتار.", "12m from station centre. Location accuracy 4m.")}</div>
                </div>
                <button type="button" style={{ width: "100%", height: "64px", borderRadius: "16px", background: "var(--nv-btn-fill)", color: "#fff", border: "none", fontFamily: "inherit", fontSize: "19px", fontWeight: 600, cursor: "pointer" }}>
                  {T("تسجيل الدخول للوردية", "Check in to shift")}
                </button>
                <div style={{ background: CARD, border: "1px solid var(--nv-line)", borderRadius: "16px", padding: "18px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: MUTED }}>{T("وردية أمس", "Yesterday's shift")}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "12px" }}>
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "15px", fontWeight: 500 }}>05:52</span>
                    <span style={{ flex: 1, height: "3px", background: "#E2E8F0", borderRadius: "3px" }} />
                    <span dir="ltr" style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "15px", fontWeight: 500 }}>14:06</span>
                  </div>
                  <div style={{ fontSize: "13px", color: MUTED, marginTop: "10px" }}>{T("8 ساعات و14 دقيقة · بلا ملاحظات", "8h 14m · no notes")}</div>
                </div>
              </div>
            </PhoneFrame>
          </div>

          {/* 02 Tasks L75–126 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", width: "392px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
              <span style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "13px", fontWeight: 600, color: "var(--nv-ok-ink)" }}>02</span>
              <span style={{ fontSize: "16px", fontWeight: 600 }}>{T("مهامي", "My tasks")}</span>
            </div>
            <p style={{ margin: 0, fontSize: "14px", color: MUTED, lineHeight: 1.65 }}>
              {T("مهام اليوم فقط، مرتبة بأولويتها. المتأخرة أعلى القائمة بلونها.", "Today's tasks only, ordered by priority. Overdue items sit at the top in colour.")}
            </p>
            <PhoneFrame title={T("مهامي", "My tasks")} dir={dir}>
              <div style={{ fontFamily: "'IBM Plex Sans Arabic',sans-serif", background: SURFACE, height: "100%", padding: "20px 18px", display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", gap: "8px" }}>
                  <span style={{ padding: "8px 14px", borderRadius: "20px", background: "var(--nv-navy)", color: "#fff", fontSize: "14px", fontWeight: 600 }}>{T("اليوم · 4", "Today · 4")}</span>
                  <span style={{ padding: "8px 14px", borderRadius: "20px", background: CARD, border: "1px solid var(--nv-line)", color: MUTED, fontSize: "14px" }}>{T("الأسبوع · 11", "Week · 11")}</span>
                </div>
                <div style={{ background: CARD, border: "1px solid var(--nv-line)", borderRadius: "16px", padding: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "var(--nv-bad-fill)", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: "16px", fontWeight: 600, lineHeight: 1.4 }}>{T("استبدال صمام الضغط العالي", "Replace high-pressure valve")}</span>
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--nv-bad-ink)", marginTop: "10px", fontWeight: 500 }}>{T("متأخرة يومين · وحدة التبريد الرئيسية", "2 days overdue · main chiller")}</div>
                  <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
                    <button type="button" style={{ flex: 1, height: "44px", borderRadius: "12px", background: "var(--nv-btn-fill)", color: "#fff", border: "none", fontFamily: "inherit", fontSize: "15px", fontWeight: 600, cursor: "pointer" }}>{T("ابدأ", "Start")}</button>
                    <button type="button" style={{ height: "44px", padding: "0 16px", borderRadius: "12px", background: CARD, border: "1px solid var(--nv-line)", color: MUTED, fontFamily: "inherit", fontSize: "15px", cursor: "pointer" }}>{T("تفاصيل", "Details")}</button>
                  </div>
                </div>
                <div style={{ background: CARD, border: "1px solid var(--nv-line)", borderRadius: "16px", padding: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "var(--nv-warn-fill)", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: "16px", fontWeight: 600, lineHeight: 1.4 }}>{T("فحص دوري لوحدة التبريد", "Chiller periodic inspection")}</span>
                  </div>
                  <div style={{ fontSize: "13px", color: MUTED, marginTop: "10px" }}>{T("اليوم 16:00 · قيد التنفيذ 70%", "Today 16:00 · 70% in progress")}</div>
                  <div style={{ height: "5px", borderRadius: "4px", background: "var(--nv-soft)", marginTop: "12px", overflow: "hidden" }}>
                    <span style={{ display: "block", width: "70%", height: "100%", background: "var(--nv-warn-fill)", borderRadius: "4px" }} />
                  </div>
                </div>
                <div style={{ background: CARD, border: "1px solid var(--nv-line)", borderRadius: "16px", padding: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#94A3B8", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: "16px", fontWeight: 600, lineHeight: 1.4 }}>{T("معايرة أجهزة قياس التدفق", "Flow meter calibration")}</span>
                  </div>
                  <div style={{ fontSize: "13px", color: MUTED, marginTop: "10px" }}>{T("غدًا · لم تبدأ", "Tomorrow · not started")}</div>
                </div>
                <div style={{ background: CARD, border: "1px solid var(--nv-line)", borderRadius: "16px", padding: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#94A3B8", flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: "16px", fontWeight: 600, lineHeight: 1.4 }}>{T("جرد قطع الغيار الحرجة", "Critical spares stocktake")}</span>
                  </div>
                  <div style={{ fontSize: "13px", color: MUTED, marginTop: "10px" }}>{T("بعد 4 أيام · لم تبدأ", "In 4 days · not started")}</div>
                </div>
              </div>
            </PhoneFrame>
          </div>

          {/* 03 Close L128–175 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", width: "392px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
              <span style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "13px", fontWeight: 600, color: "var(--nv-ok-ink)" }}>03</span>
              <span style={{ fontSize: "16px", fontWeight: 600 }}>{T("إغلاق العمل", "Close work")}</span>
            </div>
            <p style={{ margin: 0, fontSize: "14px", color: MUTED, lineHeight: 1.65 }}>
              {T("لا يُغلق العمل دون صورة بعد التنفيذ، مختومة بالموقع والوقت تلقائيًا.", "Work does not close without an after photo, stamped with location and time automatically.")}
            </p>
            <PhoneFrame title={T("إثبات العمل", "Work proof")} dir={dir}>
              <div style={{ fontFamily: "'IBM Plex Sans Arabic',sans-serif", background: SURFACE, height: "100%", padding: "20px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <div style={{ fontSize: "17px", fontWeight: 600, lineHeight: 1.4 }}>{T("استبدال صمام الضغط العالي", "Replace high-pressure valve")}</div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: "13px", color: "var(--nv-muted)", marginTop: "4px" }}>OPS-4821</div>
                </div>
                <div style={{ display: "flex", gap: "10px" }}>
                  <div style={{ flex: 1, height: "150px", background: CARD, border: "1px solid var(--nv-line)", borderRadius: "14px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--nv-muted)", letterSpacing: "0.08em" }}>{T("قبل", "BEFORE")}</span>
                    <span dir="ltr" style={{ fontSize: "14px", color: "#CBD5E1", fontFamily: "'IBM Plex Sans',sans-serif" }}>06:18</span>
                    <span style={{ fontSize: "12px", color: "var(--nv-ok-ink)", fontWeight: 500 }}>{T("مرفوعة", "Uploaded")}</span>
                  </div>
                  <div style={{ flex: 1, height: "150px", background: CARD, border: "2px dashed var(--nv-accent-border)", borderRadius: "14px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--nv-muted)", letterSpacing: "0.08em" }}>{T("بعد", "AFTER")}</span>
                    <span style={{ fontSize: "14px", color: "var(--nv-ok-ink)", fontWeight: 600 }}>{T("التقط صورة", "Take photo")}</span>
                  </div>
                </div>
                <div style={{ background: CARD, border: "1px solid var(--nv-line)", borderRadius: "14px", padding: "16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "var(--nv-btn-fill)", flexShrink: 0 }} />
                    <span style={{ fontSize: "14px", color: INK }}>{T("داخل نطاق الجبيل 1 · 5 أمتار", "Inside Jubail 1 · 5m")}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "12px" }}>
                    <span style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#CBD5E1", flexShrink: 0 }} />
                    <span style={{ fontSize: "14px", color: MUTED }}>{T("يراجعها فهد القحطاني بعد الرفع", "Reviewed by F. Alqahtani after upload")}</span>
                  </div>
                </div>
                <div style={{ background: CARD, border: "1px solid var(--nv-line)", borderRadius: "14px", padding: "16px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: MUTED }}>{T("ملاحظة التنفيذ", "Execution note")}</div>
                  <div style={{ fontSize: "14px", color: "var(--nv-muted)", marginTop: "8px", lineHeight: 1.6 }}>{T("اكتب ما تغيّر، أو ما يحتاج متابعة لاحقة…", "Note what changed, or what needs follow-up…")}</div>
                </div>
                <div style={{ marginTop: "auto", display: "flex", gap: "10px" }}>
                  <button type="button" style={{ flex: 1, height: "56px", borderRadius: "14px", background: "#E2E8F0", color: "var(--nv-muted)", border: "none", fontFamily: "inherit", fontSize: "17px", fontWeight: 600 }}>{T("أغلق العمل", "Close work")}</button>
                </div>
                <div style={{ fontSize: "12px", color: "var(--nv-muted)", textAlign: "center" }}>{T("يُفعَّل الزر بعد رفع صورة \"بعد\"", "Enabled after the after photo is uploaded")}</div>
              </div>
            </PhoneFrame>
          </div>

          {/* 04 Anonymous L177–207 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", width: "392px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
              <span style={{ fontFamily: "'IBM Plex Sans',sans-serif", fontSize: "13px", fontWeight: 600, color: "var(--nv-ok-ink)" }}>04</span>
              <span style={{ fontSize: "16px", fontWeight: 600 }}>{T("بلاغ مجهول", "Anonymous report")}</span>
            </div>
            <p style={{ margin: 0, fontSize: "14px", color: MUTED, lineHeight: 1.65 }}>
              {T("الرمز يتغيّر كل ثلاثين يومًا. الشاشة تقول صراحةً من يقرأ البلاغ ومن لا يقرأه.", "The code rotates every thirty days. The screen states clearly who can read the report and who cannot.")}
            </p>
            <PhoneFrame title={T("بلاغ مجهول", "Anonymous report")} dir={dir}>
              <div style={{ fontFamily: "'IBM Plex Sans Arabic',sans-serif", background: SURFACE, height: "100%", padding: "20px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ background: "var(--nv-navy)", borderRadius: "16px", padding: "20px", color: "#fff" }}>
                  <div style={{ fontSize: "13px", color: "#A9CDB8", fontWeight: 600 }}>{T("هويتك محمية", "Your identity is protected")}</div>
                  <p style={{ margin: "10px 0 0", fontSize: "14px", lineHeight: 1.7, color: "#CBD5E1" }}>{T("يصل بلاغك برمز مؤقت. لا يستطيع مديرك ولا مدير النظام ربطه بك.", "Your report arrives under a temporary code. Neither your manager nor the system admin can link it to you.")}</p>
                  <div dir="ltr" style={{ marginTop: "14px", fontFamily: "'IBM Plex Mono',monospace", fontSize: "16px", background: "rgba(255,255,255,.08)", borderRadius: "9px", padding: "10px 14px", textAlign: "center" }}>ANON-4F2B91C0</div>
                  <div style={{ fontSize: "12px", color: "var(--nv-muted)", marginTop: "8px", textAlign: "center" }}>{T("يتغيّر الرمز بعد 21 يومًا", "Code rotates in 21 days")}</div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <span style={{ padding: "9px 15px", borderRadius: "20px", background: "var(--nv-navy)", color: "#fff", fontSize: "14px", fontWeight: 600 }}>{T("سلامة", "Safety")}</span>
                  <span style={{ padding: "9px 15px", borderRadius: "20px", background: CARD, border: "1px solid var(--nv-line)", color: MUTED, fontSize: "14px" }}>{T("سلوك", "Conduct")}</span>
                  <span style={{ padding: "9px 15px", borderRadius: "20px", background: CARD, border: "1px solid var(--nv-line)", color: MUTED, fontSize: "14px" }}>{T("مرافق", "Facilities")}</span>
                  <span style={{ padding: "9px 15px", borderRadius: "20px", background: CARD, border: "1px solid var(--nv-line)", color: MUTED, fontSize: "14px" }}>{T("اقتراح", "Suggestion")}</span>
                </div>
                <div style={{ flex: 1, background: CARD, border: "1px solid var(--nv-line)", borderRadius: "16px", padding: "18px" }}>
                  <div style={{ fontSize: "15px", color: "var(--nv-muted)", lineHeight: 1.7 }}>{T("اشرح ما حدث، ومتى، وأين. أرفق صورة إن أمكن.", "Explain what happened, when, and where. Attach a photo if you can.")}</div>
                </div>
                <button type="button" style={{ width: "100%", height: "56px", borderRadius: "14px", background: "var(--nv-btn-fill)", color: "#fff", border: "none", fontFamily: "inherit", fontSize: "17px", fontWeight: 600, cursor: "pointer" }}>{T("أرسل البلاغ", "Send report")}</button>
                <div style={{ fontSize: "12px", color: "var(--nv-muted)", textAlign: "center", lineHeight: 1.6 }}>{T("يصل إلى منسق السلامة مباشرة، ويُصعَّد تلقائيًا إن تجاوز 24 ساعة", "Goes straight to the safety coordinator and escalates automatically after 24 hours")}</div>
              </div>
            </PhoneFrame>
          </div>
        </div>

        <div style={{ marginTop: "40px", display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "13px", color: MUTED }}>
          <Link to="/" style={{ color: MUTED }}>{T("الرئيسية", "Home")}</Link>
          <Link to="/login" style={{ color: MUTED }}>{T("دخول المنصة", "Platform login")}</Link>
          <Link to="/app/attendance" style={{ color: MUTED }}>{T("الحضور", "Attendance")}</Link>
          <Link to="/app/tasks" style={{ color: MUTED }}>{T("المهام", "Tasks")}</Link>
        </div>
      </div>
    </MarketingChrome>
  );
}
