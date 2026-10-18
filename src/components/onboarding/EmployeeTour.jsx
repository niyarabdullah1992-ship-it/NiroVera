import React, { useState } from "react";
import { useI18n } from "@/lib/i18n";
import { MapPin, ListTodo, MessageSquare, Megaphone, Sparkles, PartyPopper, ChevronRight, ChevronLeft, X } from "lucide-react";
import IdentityCard from "@/components/shared/IdentityCard";
import { ACCENT, MUTED, dialogOverlay, ui } from "@/lib/platformStyles";

const STEPS = [
  { icon: PartyPopper, ar: { title: "أهلًا بك في NiroVera!", desc: "هذه جولة سريعة (دقيقة واحدة) تعرّفك على أهم ما تحتاجه في يومك. يمكنك تخطيها في أي وقت." }, en: { title: "Welcome to NiroVera!", desc: "A quick one-minute tour of everything you need day to day. You can skip anytime." } },
  { icon: MapPin, ar: { title: "تسجيل الحضور", desc: "أول شيء في يومك: بطاقة تسجيل الحضور أعلى الصفحة الرئيسية — ضغطة واحدة وسيتم التحقق من موقعك تلقائيًا داخل نطاق الفرع." }, en: { title: "Check-in", desc: "First thing each day: the check-in card at the top of your home page — one tap, and your GPS location is verified automatically." } },
  { icon: ListTodo, ar: { title: "مهامي", desc: "من قسم «المهام» تتابع كل مهمة مسندة إليك: سجّل تقدمك، أرفق إثبات الإنجاز عند الاكتمال، وبلّغ عن أي معوّق يوقف العمل." }, en: { title: "My Tasks", desc: "In the Tasks section you track every task assigned to you: log progress, attach completion proof, and report blocking issues." } },
  { icon: MessageSquare, ar: { title: "المحادثات", desc: "تواصل مع فريق فرعك في المحادثة الجماعية، أو راسل أي زميل مباشرة — مع إمكانية إرفاق صور وملفات." }, en: { title: "Chat", desc: "Talk with your station's team group chat, or message any colleague directly — with photos and file attachments." } },
  { icon: Megaphone, ar: { title: "صوت الموظف", desc: "شكوى جهرية تبدأ عند مديرك وتتصعّد إن لم تُحل؛ والشكوى السرية والاقتراح وشكوى التحرش تصل إلى الموارد البشرية فقط — لا يراها مديرك." }, en: { title: "Employee Voice", desc: "An open complaint starts with your manager and climbs if unresolved; confidential complaints, suggestions and harassment reach HR only — your manager does not see them." } },
  { icon: Sparkles, ar: { title: "المساعد الذكي نيرو", desc: "اسأل نيرو عن مهامك، حضورك، أو أي قسم في المنصة — ويمكنه تنفيذ إجراءات فعلية مثل تسجيل تقدم مهمة. جرّبه الآن!" }, en: { title: "Niro AI Assistant", desc: "Ask Niro about your tasks, attendance, or any section — it can even execute real actions like logging task progress. Try it!" } },
];

export default function EmployeeTour({ user, company }) {
  const { lang } = useI18n();
  const isAr = lang === "ar";
  const key = `powercare_tour_done_${company?.id}_${user?.id}`;
  const [open, setOpen] = useState(() => {
    try { return !localStorage.getItem(key); } catch { return false; }
  });
  const [step, setStep] = useState(0);

  if (!open) return null;

  const finish = () => {
    try { localStorage.setItem(key, "1"); } catch { /* ignore */ }
    setOpen(false);
  };

  const s = STEPS[step];
  const txt = isAr ? s.ar : s.en;
  const Icon = s.icon;
  const last = step === STEPS.length - 1;
  const Next = isAr ? ChevronLeft : ChevronRight;
  const Back = isAr ? ChevronRight : ChevronLeft;

  return (
    <div style={dialogOverlay} dir={isAr ? "rtl" : "ltr"}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <IdentityCard
          icon={Icon}
          kicker={`${step + 1} / ${STEPS.length}`}
          title={txt.title}
          subtitle={txt.desc}
          meta={(
            <button type="button" onClick={finish} aria-label="skip" style={{ ...ui.btnGhost, padding: 6 }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          )}
          dir={isAr ? "rtl" : "ltr"}
        >
          <div style={{ display: "flex", justifyContent: "center", gap: 6, marginBottom: 14 }}>
            {STEPS.map((_, i) => (
              <span
                key={i}
                style={{
                  height: 6,
                  width: i === step ? 20 : 6,
                  borderRadius: 20,
                  background: i === step ? ACCENT : MUTED,
                  opacity: i === step ? 1 : 0.3,
                }}
              />
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {step > 0 ? (
              <button type="button" onClick={() => setStep(step - 1)} style={{ ...ui.btnSecondary, display: "inline-flex", alignItems: "center", gap: 4 }}>
                <Back style={{ width: 14, height: 14 }} /> {isAr ? "السابق" : "Back"}
              </button>
            ) : (
              <button type="button" onClick={finish} style={ui.btnGhost}>
                {isAr ? "تخطي" : "Skip"}
              </button>
            )}
            <button
              type="button"
              onClick={() => (last ? finish() : setStep(step + 1))}
              style={{ ...ui.btnPrimary, flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}
            >
              {last ? (isAr ? "ابدأ العمل" : "Get started") : (isAr ? "التالي" : "Next")}
              {!last && <Next style={{ width: 14, height: 14 }} />}
            </button>
          </div>
        </IdentityCard>
      </div>
    </div>
  );
}
