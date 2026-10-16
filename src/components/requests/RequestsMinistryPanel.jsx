import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { requestsMinistryRows } from "@/lib/requestsMinistryRows";
import useHashScroll from "@/hooks/useHashScroll";
import { chipButton, mono, quietAction, SectionHead, slab } from "@/components/schedules/scheduleChrome";
import MinistrySourceCards, {
  Counter,
  MINISTRY_SOURCE_KEYS,
  ministryBadgeStyle,
  ministryBadgeText,
  MinistryRow,
  MinistrySourceTabs,
  RegsSourceLine,
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

function Num({ children }) {
  return <span dir="ltr" style={mono}>{children}</span>;
}

function pillFor(status, ar, info) {
  if (status === "waiting") return ar ? "بانتظار قرار" : "Awaiting decision";
  if (status === "settled") return ar ? "معتمد" : "Approved";
  if (info) return ar ? "للعلم" : "Info";
  return ar ? "متاح" : "Available";
}

export default function RequestsMinistryPanel({ ar = true, lang = "ar", subject, liveArticle = "", liveKind = "", own = true, dutyHref = "/app/attendance", fileMode = false }) {
  const [source, setSource] = useState("all");
  const [view, setView] = useState("mine");
  useHashScroll("nv-ministry-requests");
  const firstName = String(subject?.name || "").split(" ")[0] || (ar ? "الموظف" : "the worker");

  const rows = useMemo(
    () => requestsMinistryRows({ subject, liveArticle, liveKind, lang, ar, fileMode }),
    [subject, liveArticle, liveKind, lang, ar, fileMode],
  );

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
        : (ar ? "الإجازات بأنواعها، ساعة الرضاعة، الاستقالة والإشعار، تغيير شروط العقد، نفقات النقل والانتداب (النموذج الموحد م12، 24)." : "All leave types, the nursing hour, resignation and notice, contract changes, relocation and missions (model Arts. 12, 24)."),
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
    <section id="nv-ministry-requests" data-req-ministry="1" style={{ ...slab, display: "flex", flexDirection: "column", scrollMarginTop: 88 }}>
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
      <RegsSourceLine ar={ar} />
    </section>
  );
}
