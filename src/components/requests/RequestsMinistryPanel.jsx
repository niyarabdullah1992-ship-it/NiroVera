import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { lawArticleCards } from "@/lib/requestWorkspace";
import { profileLeaveGender } from "@/lib/leaveDerivations";
import { injuryLeaves, injuryStatus } from "@/lib/workInjury";
import { nursingSplitLabel, nursingSplitOf } from "@/lib/dutyRequests";
import { chipButton, mono, quietAction, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import MinistrySourceCards, {
  Counter,
  MINISTRY_SOURCE_KEYS,
  ministryBadgeStyle,
  ministryBadgeText,
  MinistryRow,
  MinistrySourceTabs,
} from "@/components/schedules/MinistrySourceCards";

/**
 * «أنظمة الوزارة — ما يخص طلباتي» — the same frame, cards, tabs and rows as «أنظمة الوزارة» in الحضور والدوام,
 * but only what a request touches. Hours, rest, overtime, night roster and sun-ban roster checks stay in the
 * duty section (ROSTER_COVERED_ARTICLES) and are not repeated here.
 *
 * A row's status is read from the person's own requests:
 *   waiting → a request under that rule awaits a decision
 *   settled → a request under that rule was approved
 *   void    → nothing filed yet (متاح) / information only (للعلم)
 */

const OPEN = new Set(["waiting"]);
const PENDING = new Set(["pending", "pending_manager", "pending_employee", "open", "revise"]);

/** Which request types each rule covers. `info` rows never carry a status of their own. */
const LABOUR_TYPES = {
  109: ["annual"],
  110: ["annual"],
  111: [],
  113: ["marriage", "bereavement", "bereavement_sibling", "paternity"],
  114: ["hajj"],
  115: ["exam", "study_consent"],
  116: ["unpaid"],
  117: ["sick"],
  118: [],
  151: ["maternity", "maternity_extend", "maternity_companion"],
  160: ["iddah"],
  75: ["resignation"],
  "79 مكرر": ["resignation"],
  58: [],
  59: [],
  60: [],
};
const FEMALE_ONLY = new Set(["151", "160", "154"]);

function Num({ children }) {
  return <span dir="ltr" style={mono}>{children}</span>;
}

function statusOf(types, requests, article) {
  const hits = requests.filter((row) => types.includes(row.type) || (article && String(row.article || "") === String(article) && row.type === "written_consent"));
  if (hits.some((row) => PENDING.has(row.status || "pending"))) return "waiting";
  if (hits.some((row) => (row.status || "") === "approved" || (row.status || "") === "signed")) return "settled";
  return "void";
}

function pillFor(status, ar, info) {
  if (status === "waiting") return ar ? "بانتظار قرار" : "Awaiting decision";
  if (status === "settled") return ar ? "معتمد" : "Approved";
  if (info) return ar ? "للعلم" : "Info";
  return ar ? "متاح" : "Available";
}

function addDays(key, days) {
  const d = new Date(`${String(key).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** What approvals already wrote on the file — shown under the rule it comes from. */
function fileFacts(profile = {}, ar = true) {
  const facts = {};
  if (profile.pregnant && profile.expectedBirthDate) {
    const from = addDays(profile.expectedBirthDate, -24 * 7);
    facts.pregnancy = ar
      ? `على الملف: الولادة المتوقعة ${profile.expectedBirthDate} · لا عمل ليلي من ${from}`
      : `On file: expected birth ${profile.expectedBirthDate} · no night work from ${from}`;
  }
  if (profile.nursingHour) {
    const where = nursingSplitLabel(nursingSplitOf(profile.nursingHour), ar);
    const until = profile.nursingHour.until ? (ar ? ` حتى ${profile.nursingHour.until}` : ` until ${profile.nursingHour.until}`) : "";
    facts.nursing = ar ? `على الملف: ${where}${until}` : `On file: ${where}${until}`;
  }
  const exit = profile.contractExit;
  if (exit && exit.reason === "resignation") {
    facts.resignation = ar
      ? `على الملف: إنهاء بالاستقالة${exit.effectiveDate ? ` · آخر يوم ${exit.effectiveDate}` : ""}`
      : `On file: ended by resignation${exit.effectiveDate ? ` · last day ${exit.effectiveDate}` : ""}`;
  }
  return facts;
}

export default function RequestsMinistryPanel({ ar = true, lang = "ar", subject, liveArticle = "", liveKind = "", own = true, dutyHref = "/app/attendance", fileMode = false }) {
  // In the employee file leave lives in طلباتي (every leave article there) and the duty tab holds the
  // night medical report — the panel keeps only what has no other home there.
  const FILE_LABOUR = new Set(["75", "79 مكرر", "58", "59", "60"]);
  const [source, setSource] = useState("all");
  const [view, setView] = useState("mine");

  const requests = useMemo(() => [
    ...(subject?.leaveRequests || []),
    ...(subject?.otherRequests || []),
  ], [subject]);
  const gender = profileLeaveGender(subject?.profile);
  const facts = fileFacts(subject?.profile || {}, ar);
  const firstName = String(subject?.name || "").split(" ")[0] || (ar ? "الموظف" : "the worker");

  const rows = useMemo(() => {
    const list = [];
    const keep = (art) => !(gender === "male" && FEMALE_ONLY.has(String(art)));
    lawArticleCards("requests", liveArticle, lang)
      .filter((card) => card.source !== "product" && card.citeKind !== "ops")
      .filter((card) => keep(card.art))
      .filter((card) => !fileMode || FILE_LABOUR.has(String(card.art)))
      .forEach((card) => {
        const types = LABOUR_TYPES[card.art] || [];
        const info = !types.length && !["58", "59", "60"].includes(String(card.art));
        list.push({
          key: `labour-${card.art}`,
          source: "labour",
          badge: ar ? `م ${card.art}` : `Art. ${card.art}`,
          title: card.name || (ar ? `المادة ${card.art}` : `Article ${card.art}`),
          note: card.impl || card.hint || "",
          status: info ? "void" : (facts.resignation && types.includes("resignation") ? "settled" : statusOf(types, requests, card.art)),
          sub: types.includes("resignation") ? facts.resignation : undefined,
          info,
          live: card.live,
        });
      });
    if (keep("154")) {
      list.push({
        key: "labour-154",
        source: "labour",
        badge: ar ? "م 154" : "Art. 154",
        title: ar ? "ساعة الرضاعة" : "Nursing hour",
        note: ar ? "ساعة يومياً تُحسب من ساعات العمل الفعلية بلا خصم، أول الدوام أو آخره — يُخصم بها التأخير في سجلك." : "One hour a day counted as work, start or end of shift — lateness on your record is reduced by it.",
        status: facts.nursing ? "settled" : statusOf(["nursing_hour"], requests),
        sub: facts.nursing,
        live: liveKind === "nursing_hour",
      });
    }
    const injuryOnFile = injuryLeaves(subject).length > 0;
    if (!fileMode || injuryOnFile) list.push({
      key: "labour-gosi",
      source: "labour",
      badge: ar ? "التأمينات" : "GOSI",
      title: ar ? "إجازة إصابة العمل" : "Work-injury leave",
      note: ar ? "بتقرير طبي — تُعوَّض عبر فرع الأخطار المهنية في التأمينات الاجتماعية، لا من رصيدك." : "With a medical report — compensated through GOSI occupational hazards, not from your balance.",
      status: statusOf(["work_injury"], requests),
      sub: (() => {
        const st = injuryOnFile ? injuryStatus({ employee: subject, company: subject?.__company, today: new Date().toISOString().slice(0, 10) }) : null;
        if (!st) return undefined;
        return ar
          ? `إصابة ${st.injuryDate} · يوم العلاج ${st.dayIndex}${st.active ? " (جارٍ)" : ""}${st.art139 ? " · سقط الحق (139)" : ""}`
          : `Injury ${st.injuryDate} · treatment day ${st.dayIndex}${st.active ? " (ongoing)" : ""}${st.art139 ? " · right lost (139)" : ""}`;
      })(),
      live: liveKind === "leave:work_injury",
    });
    // In the file the week panel above already judges the 3-month night consent.
    if (!fileMode) list.push({
      key: "18632-consent",
      source: "18632",
      title: ar ? "موافقة العمل الليلي الخطية" : "Written night-work consent",
      note: ar ? "بعد ثلاثة أشهر ليلية متصلة يلزم اختيارك: موافقة خطية، أو تقليص الساعات، أو تدوير الفترة. لك سحبها." : "After three straight night months you choose: written consent, fewer hours, or rotation. You may withdraw it.",
      status: statusOf(["night_consent"], requests),
      live: liveKind === "night_consent",
    });
    if (!fileMode) list.push({
      key: "18632-fitness",
      source: "18632",
      title: ar ? "إعفاء من العمل الليلي بتقرير طبي" : "Medical exemption from night work",
      note: ar ? "تقرير يثبت عدم اللياقة للعمل الليلي — يمنع الجدول إسنادك لليل خلال مدته." : "A report of unfitness for night work — the roster blocks night shifts for its duration.",
      status: statusOf(["night_fitness"], requests),
      live: liveKind === "night_fitness",
    });
    list.push({
      key: "18632-family",
      source: "18632",
      title: ar ? "مسؤوليات عائلية — مراعاة في الإسناد الليلي" : "Family responsibilities — considered at night",
      note: ar ? "القرار 18632 (هـ): يُراعى قدر الإمكان أصحاب المسؤوليات العائلية وكبار السن (50 فأكثر تلقائياً) عند الإسناد الليلي — مراعاة لا مانع." : "Decision 18632 (e): family responsibilities and older workers (50+ automatically) are considered for night assignment — not a block.",
      status: subject?.profile?.familyResponsibilities === true || subject?.profile?.familyResponsibilities === "yes" ? "settled" : statusOf(["family_duties"], requests),
      sub: subject?.profile?.familyResponsibilities === true || subject?.profile?.familyResponsibilities === "yes"
        ? (ar ? `على الملف${subject?.profile?.familyResponsibilitiesSince ? ` منذ ${subject.profile.familyResponsibilitiesSince}` : ""}` : "On file")
        : undefined,
      live: liveKind === "family_duties",
    });
    if (keep("154")) {
      list.push({
        key: "18632-pregnancy",
        source: "18632",
        title: ar ? "إبلاغ الحمل" : "Pregnancy notice",
        note: ar ? "بعد الاعتماد لا عمل ليلي في الـ24 أسبوعاً قبل الوضع، ويُوفَّر عمل مناسب في الساعات المعتادة." : "Once approved, no night work in the 24 weeks before birth; ordinary-hours work is offered.",
        status: facts.pregnancy ? "settled" : statusOf(["pregnancy_notice"], requests),
        sub: facts.pregnancy,
        live: liveKind === "pregnancy_notice",
      });
    }
    list.push({
      key: "3337-report",
      source: "3337",
      title: ar ? "بلاغ عمل مكشوف وقت الحظر" : "Exposed-work report in the ban hours",
      note: ar ? "إن كُلّفت بعمل تحت الشمس في ساعات الحظر ارفع بلاغاً — تصل الإدارة تنبيهاً، وتبقى المخالفة ظاهرة حتى تُعالج." : "If assigned sun work in the ban hours, file a report — management is alerted and the violation stays visible until fixed.",
      status: statusOf(["heat_report"], requests),
      live: liveKind === "heat_report",
    });
    return list;
  }, [requests, gender, liveArticle, liveKind, lang, ar, subject, fileMode]);

  const tally = (list) => ({
    waiting: list.filter((row) => row.status === "waiting").length,
    settled: list.filter((row) => row.status === "settled").length,
    free: list.filter((row) => row.status === "void" && !row.info).length,
  });
  const countersOf = (t) => [
    <Counter key="w" value={t.waiting} label={ar ? "بانتظار" : "waiting"} tone="warn" />,
    <Counter key="s" value={t.settled} label={ar ? "معتمد" : "approved"} tone="ok" />,
    <Counter key="f" value={t.free} label={ar ? "متاح" : "available"} tone="mute" />,
  ];

  const cards = [
    {
      key: "18632",
      title: ar ? "القرار 18632 — العمل الليلي" : "Decision 18632 — night work",
      scope: fileMode
        ? (ar ? "المسؤوليات العائلية وإبلاغ الحمل. الموافقة الخطية والتقرير الطبي في أنظمة الأسبوع أعلاه." : "Family responsibilities and pregnancy notice. Consent and the medical report are in the week panel above.")
        : (ar ? "طلباتك فيه: الموافقة الخطية، الإعفاء الطبي، إبلاغ الحمل." : "Your requests under it: written consent, medical exemption, pregnancy notice."),
    },
    {
      key: "3337",
      title: ar ? "القرار 3337 — حظر العمل المكشوف" : "Decision 3337 — open-sun ban",
      scope: ar ? "طلبك فيه: بلاغ عمل مكشوف وقت الحظر." : "Your request under it: an exposed-work report in the ban hours.",
    },
    {
      key: "labour",
      title: fileMode ? (rows.some((row) => row.key === "labour-154") ? (ar ? "نظام العمل — العقد والرضاعة" : "Labour Law — contract and nursing") : (ar ? "نظام العمل — العقد" : "Labour Law — contract")) : (ar ? "نظام العمل — الإجازات والعقد" : "Labour Law — leave and contract"),
      scope: fileMode
        ? (ar ? `${rows.some((row) => row.key === "labour-154") ? "ساعة الرضاعة، " : ""}الاستقالة والإشعار، تغيير شروط العقد. الإجازات في طلباتي.` : "Resignation and notice, contract changes. Leave is in My requests.")
        : (ar ? "الإجازات بأنواعها، ساعة الرضاعة، الاستقالة والإشعار، تغيير شروط العقد." : "All leave types, the nursing hour, resignation and notice, contract changes."),
    },
  ].filter((card) => !fileMode || rows.some((row) => row.source === card.key)).map((card) => {
    const list = rows.filter((row) => row.source === card.key);
    const t = tally(list);
    return { ...card, tone: t.waiting ? "warn" : t.settled ? "ok" : "mute", counters: countersOf(t) };
  });

  const total = tally(rows);
  const mine = (row) => row.status !== "void" || row.live;
  const sourceCounts = { all: rows.length };
  MINISTRY_SOURCE_KEYS.forEach((key) => { sourceCounts[key] = rows.filter((row) => row.source === key).length; });
  const groups = MINISTRY_SOURCE_KEYS
    .filter((key) => cards.some((card) => card.key === key))
    .filter((key) => source === "all" || source === key)
    .map((key) => {
      const all = rows.filter((row) => row.source === key);
      return { key, card: cards.find((card) => card.key === key), all, rows: view === "mine" ? all.filter(mine) : all };
    });
  const hiddenN = rows.filter((row) => (source === "all" || row.source === source) && !mine(row)).length;

  return (
    <section data-req-ministry="1" style={{ ...slab, display: "flex", flexDirection: "column" }}>
      <SectionHead
        title={own
          ? (ar ? "أنظمة الوزارة — ما يخص طلباتي" : "Ministry rules — what my requests touch")
          : (ar ? `أنظمة الوزارة — ما يخص طلبات ${firstName}` : `Ministry rules — ${firstName}'s requests`)}
        note={ar
          ? <>قراءة فقط · <Num>{rows.length}</Num> مادة وقراراً تحكم {own ? "طلباتك" : "طلباته"}. ساعات العمل والراحة والإضافي وجدول الليل والشمس {dutyHref ? (own ? "في «الحضور والدوام»" : "في تبويب «الدوام»") : "في القسم أعلاه"}.</>
          : <>Read only · <Num>{rows.length}</Num> rules govern your requests. Hours, rest, overtime and the night/sun roster live in Attendance.</>}
        trailing={(
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {countersOf(total)}
          </div>
        )}
      />
      <div style={{ padding: "14px 18px 12px", display: "flex", flexDirection: "column", gap: 12, borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
        <MinistrySourceCards cards={cards} active={source} onPick={setSource} ar={ar} />
        {fileMode ? null : <MinistrySourceTabs active={source} onPick={setSource} ar={ar} chipButton={chipButton} counts={sourceCounts} />}
      </div>
      <div data-req-ministry-rows="1" data-view={view} style={{ display: "flex", flexDirection: "column" }}>
        {view === "mine" && !groups.some((group) => group.rows.length) ? (
          <span style={{ padding: "14px 18px", fontSize: 12.5, color: "var(--nv-ink2)", lineHeight: 1.7, borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
            {own
              ? (ar ? "لا طلب لك تحت هذه الأنظمة بعد. اعرض كل المواد لتعرف حقوقك." : "No request of yours under these rules yet. Show all to see your rights.")
              : (ar ? "لا طلب له تحت هذه الأنظمة بعد. اعرض كل المواد." : "No request under these rules yet. Show all.")}
          </span>
        ) : null}
        {groups.filter((group) => group.rows.length).map((group) => {
          const t = tally(group.all);
          return (
            <div key={group.key} data-req-ministry-group={group.key} style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "9px 18px", background: "var(--nv-soft, #F6F8FA)", borderBottom: "1px solid var(--nv-line2, #EEF2F7)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
                <span style={ministryBadgeStyle(group.key, ar)}>{ministryBadgeText(group.key, ar)}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)", lineHeight: 1.5, flex: "1 1 180px", minWidth: 0 }}>{group.card?.title}</span>
                <span style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", fontSize: 11, color: "var(--nv-muted)" }}>
                  {t.waiting ? <span><Num>{t.waiting}</Num> {ar ? "بانتظار" : "waiting"}</span> : null}
                  {t.settled ? <span><Num>{t.settled}</Num> {ar ? "معتمد" : "approved"}</span> : null}
                  <span><Num>{group.all.length}</Num> {ar ? "في المجموع" : "in all"}</span>
                </span>
              </div>
              {group.rows.map((row) => (
                <MinistryRow
                  key={row.key}
                  rowKey={row.key}
                  source={row.source}
                  badge={row.badge}
                  status={row.live && row.status === "void" ? "alert" : row.status}
                  pill={row.live && row.status === "void" ? (ar ? "طلبك الحالي" : "Your request") : pillFor(row.status, ar, row.info)}
                  title={row.title}
                  note={row.note}
                  sub={row.sub}
                  ar={ar}
                />
              ))}
            </div>
          );
        })}
      </div>
      <div style={{ padding: "10px 18px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", borderBottom: "1px solid var(--nv-line2, #EEF2F7)" }}>
        <button
          type="button"
          data-req-ministry-fold="1"
          aria-expanded={view === "all"}
          onClick={() => setView(view === "all" ? "mine" : "all")}
          style={quietAction({ fontSize: 12.5, fontWeight: 700, color: "var(--nv-ink)" })}
        >
          {view === "all" ? (ar ? (own ? "ما يخص طلباتي فقط" : "ما يخص طلباته فقط") : "Only filed requests") : (ar ? "عرض كل المواد" : "Show all rules")}
          {view === "all" ? null : <> (<span dir="ltr" style={mono}>{hiddenN}</span>)</>}
        </button>
        <span style={{ fontSize: 11.5, color: "var(--nv-muted)", lineHeight: 1.7 }}>
          {ar ? (own ? "الحالة تُقرأ من طلباتك وملفك — لا تقدير." : "الحالة تُقرأ من طلباته وملفه — لا تقدير.") : "Status is read from the requests and the file — no estimates."}
        </span>
      </div>
      <div style={{ padding: "10px 18px 12px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: 11, color: "var(--nv-muted)", lineHeight: 1.7, flex: "1 1 260px" }}>
          {ar
            ? "نظام العمل (م/51) وقرارات الوزارة هي مصدر الحكم — عند الخلاف يُرجع إلى النص الرسمي وإلى الموارد البشرية."
            : "The Labour Law (M/51) and ministerial decisions govern — in a dispute, the official text and HR prevail."}
        </p>
        {dutyHref ? <Link to={dutyHref} style={quietAction({ fontSize: 12, color: "var(--nv-ok-ink)" })}>
          {own ? (ar ? "أنظمة الدوام في الحضور والدوام" : "Duty rules in Attendance") : (ar ? "أنظمة الدوام في تبويب الدوام" : "Duty rules in the Duty tab")}
        </Link> : null}
      </div>
    </section>
  );
}
