import React from "react";
import { PLATFORM_JUDGE_LEDE_AR, PLATFORM_JUDGE_LEDE_EN, PLATFORM_JUDGE_STANCE_AR, PLATFORM_JUDGE_STANCE_EN, PLATFORM_JUDGE_TITLE_AR, PLATFORM_JUDGE_TITLE_EN } from "@/lib/platformJudgment";
import { NIGHT_FACILITY_FLAGS } from "@/lib/decision18632";
import { slab, sourceBadge } from "@/components/schedules/scheduleChrome";

/** Verbatim copy, moved off the working surface. Rendered as one collapsed panel at the foot of the board. */
export function rotaPerfSteps(ar) {
  return [
    {
      n: "1",
      title: ar ? "الجدول يحدد المستحق — 65 يومًا حاليًا" : "The roster sets what is owed — currently 65 days",
      body: ar
        ? "مجموع الورديات المنشورة هو طول الفترة. وأثره في الأداء واحد ومحدد: من خدم جزءًا من الفترة تُعدَّل نقاط مهامه إلى معدّل الفترة الكاملة، فلا يُقارَن نصف ربع بربع كامل. أما الحضور نفسه فلا يدخل الدرجة إطلاقًا — يُرصد للأجر والانضباط."
        : "The sum of published shifts is the length of the period. Its effect on the score is single and specific: anyone who served only part of it has their task points pro-rated to a full-period rate. Attendance itself does not enter the score at all — it is recorded for pay and discipline.",
    },
    {
      n: "2",
      title: ar ? "البصمة تُقارن بالوردية لا باليوم" : "Check-in is compared to the shift",
      body: ar
        ? "التأخر يُقاس من بداية وردية الموظف هو، لا من ساعة موحدة. من ورديته ليلية لا يُعد متأخرًا لأنه لم يحضر صباحًا."
        : "Lateness is measured against that employee's own shift start, not a company-wide hour. Someone on nights is never late for not arriving in the morning.",
    },
    {
      n: "3",
      title: ar ? "الإجازة تخرج قبل الإسناد" : "Leave is removed before assignment",
      body: ar
        ? "من له إجازة معتمدة لا يُسند إلى وردية أصلًا، فلا يُسجَّل غيابه ولا يظهر في سجل الانضباط."
        : "Anyone on approved leave is never assigned a shift, so no absence is recorded and nothing enters their disciplinary record.",
    },
    {
      n: "4",
      title: ar ? "النقص يُقاس على الجدول لا على الموظف" : "Gaps are a roster fault, not a personal one",
      body: ar
        ? "الوردية ناقصة التغطية عبء جدولة، ولا تُحتسب غيابًا على أحد. ومن يتطوّع لسدّها تُحتسب له نقاط في بند تغطية الورديات."
        : "An under-covered shift is a scheduling burden and is never recorded as anyone's absence. Whoever volunteers to fill it is rewarded through the shift-coverage term.",
    },
  ];
}

export function clockSourceRows(ar) {
  return [
    [ar ? "مصدر الساعة" : "The clock", ar ? "الجدول المنشور — لا ساعة شركة افتراضية." : "The published roster — no company default hour."],
    [ar ? "شرط الوردية" : "Shift required", ar ? "إلزامي للفروع الثابتة، اختياري للمواقع الميدانية المتنقلة." : "Required at fixed stations; optional at mobile field sites."],
    [ar ? "التأخير" : "Lateness", ar ? "من أول دقيقة بعد بداية الوردية المنشورة. لا حدّ سماح." : "From the first minute after the published shift start. No grace."],
    [ar ? "الغياب" : "Absence", ar ? "وردية منشورة بلا تسجيل ولا إجازة معتمدة ولا إجازة اليوم الوطني أو يوم التأسيس أو العيد." : "A published shift with no punch, no approved leave, and no National Day / Founding Day / Eid leave."],
    [ar ? "العمل الليلي" : "Night work", ar ? "التنبيه عند الاستحقاق في الشريط وطلباتي — لا يُرسم على صف الجدول." : "Due alerts live on the rail and in My Requests — not on roster rows."],
  ];
}

function Group({ title, children }) {
  return (
    <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", display: "flex", flexDirection: "column", gap: 8 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)" }}>{title}</span>
      {children}
    </div>
  );
}

function Line({ label, value, badge }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(88px, 140px) minmax(0,1fr) auto", gap: 10, alignItems: "start", fontSize: 11.5, lineHeight: 1.7 }}>
      <span style={{ color: "var(--nv-ink2)", fontWeight: 600 }}>{label}</span>
      <span style={{ color: "var(--nv-muted)", minWidth: 0 }}>{value}</span>
      {badge ? <span style={sourceBadge()}>{badge}</span> : <span />}
    </div>
  );
}

export default function ScheduleHowItWorks({ ar = true, sections = ["judgment", "clock", "facility", "performance"] }) {
  const has = (key) => sections.includes(key);
  return (
    <details data-how-it-works="1" className="nv-sched-fold" style={{ ...slab, overflow: "hidden" }}>
      <summary
        style={{
          listStyle: "none",
          cursor: "pointer",
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          userSelect: "none",
        }}
      >
        <span className="nv-sched-fold-chevron" aria-hidden style={{ fontSize: 11, color: "var(--nv-muted)", flexShrink: 0 }}>▸</span>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--nv-ink)" }}>{ar ? "كيف يعمل الجدول" : "How the roster works"}</span>
          <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.6 }}>
            {ar ? "حكم المنصة · مصدر الوقت · التزامات المنشأة · ارتباط الجدول بالأداء" : "Platform judgment · clock source · workplace duties · how the roster reaches performance"}
          </span>
        </span>
      </summary>

      {has("judgment") ? (
        <Group title={ar ? PLATFORM_JUDGE_TITLE_AR : PLATFORM_JUDGE_TITLE_EN}>
          <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.75 }}>{ar ? PLATFORM_JUDGE_LEDE_AR : PLATFORM_JUDGE_LEDE_EN}</span>
          <span style={{ fontSize: 11.5, color: "var(--nv-ink2)", lineHeight: 1.75 }}>{ar ? PLATFORM_JUDGE_STANCE_AR : PLATFORM_JUDGE_STANCE_EN}</span>
        </Group>
      ) : null}

      {has("clock") ? (
        <Group title={ar ? "مصدر الوقت" : "Clock source"}>
          {clockSourceRows(ar).map(([label, value]) => <Line key={label} label={label} value={value} />)}
          <span style={{ fontSize: 11.5, color: "var(--nv-warn-ink)", lineHeight: 1.75 }}>
            {ar ? "الحضور بلا وردية منشورة لا يُحسب تأخيراً ولا غياباً — يُسجَّل بعلامة «بلا جدول» ويذهب للمدير." : "A punch without a published shift is neither late nor absent — it is flagged as unscheduled and sent to the manager."}
          </span>
        </Group>
      ) : null}

      {has("facility") ? (
        <Group title={ar ? "التزامات المنشأة" : "Workplace duties"}>
          <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.75 }}>
            {ar
              ? "التزامات المنشأة لليل: إسعافات أولية · نقل طارئ · وصول لطعام — أعلام إعدادات لا وحدة عيادة. تُسجَّل من «إعدادات الجدول ← إعداد الليل»."
              : "Night workplace duties: first aid · emergency transfer · food access — settings flags, not a clinic module. Recorded under Roster settings → Night settings."}
          </span>
          {NIGHT_FACILITY_FLAGS.map((flag) => <Line key={flag.key} label={ar ? flag.ar : flag.en} value="" badge="18632" />)}
        </Group>
      ) : null}

      {has("performance") ? (
        <Group title={ar ? "ارتباط الجدول بالأداء" : "How the roster reaches Performance"}>
          {rotaPerfSteps(ar).map((step) => (
            <div key={step.n} style={{ display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 10, alignItems: "start" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--nv-ok-fill)", marginTop: 7 }} />
              <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1.5 }}>{step.title}</span>
                <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.75 }}>{step.body}</span>
              </span>
            </div>
          ))}
        </Group>
      ) : null}
    </details>
  );
}
