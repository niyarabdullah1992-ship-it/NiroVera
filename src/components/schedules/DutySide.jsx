import React from "react";
import { Link } from "react-router-dom";
import { Scale, Sun } from "lucide-react";
import { heatSeasonNoticeCopy, isLiveHeatBanDay, SW, weekDays } from "@/lib/shiftWeek";
import FileHoursAlertsRail from "@/components/employees/FileHoursAlertsRail";
import { SectionHead, slab } from "@/components/schedules/scheduleChrome";
import { dutyChip, dutyLabel, dutyTone } from "@/components/schedules/dutyStatus";
import { myRosterDayHref, openLinkStyle } from "@/components/schedules/dutyLinks";

/** تنبيهاتي → the day it is about, on جدولي (week opened, day outlined). */
export function myAlertLinks(ar = true) {
  return (card) => {
    const day = card?.onDate || card?.items?.find((row) => row?.onDate)?.onDate || "";
    if (!day) return null;
    return (
      <Link to={myRosterDayHref(String(day))} data-alert-open="day" style={openLinkStyle()}>
        {ar ? "افتح اليوم في جدولي ›" : "Open the day on My roster ›"}
      </Link>
    );
  };
}

/**
 * 3337 — the seasonal notice for the viewed week (same for every employee),
 * with a personal line only when this employee is marked «مكشوف».
 */
export function dutyHeatCopy({ weekStart, dayRows = [], ar = true, now = new Date() }) {
  const days = weekDays(weekStart);
  const live = days.some((day) => isLiveHeatBanDay(day.key, now));
  if (!live) return null;
  return heatSeasonNoticeCopy(days[0]?.key, { ar, fieldDays: dayRows.filter((row) => row.sunField).map((row) => row.day.key) });
}

/** Seasonal awareness card — 3337, while the viewed week is in season. */
export function HeatAwarenessCard({ heatCopy, ar = true }) {
  if (!heatCopy) return null;
  const warn = dutyTone("warn");
  return (
    <section data-heat-awareness="1" role="note" style={{ ...slab, display: "flex", flexDirection: "column", borderTop: `3px solid ${warn.fill}` }}>
      <SectionHead
        title={ar ? "توعية — حظر العمل المكشوف" : "Awareness — open-sun ban"}
        note={ar ? `القرار 3337 · ${heatCopy.window}` : `Decision 3337 · ${heatCopy.window}`}
        trailing={<Sun aria-hidden style={{ width: 16, height: 16, color: warn.ink }} />}
      />
      <div style={{ padding: "4px 18px 14px", display: "flex", flexDirection: "column", gap: 8, fontSize: 12, lineHeight: 1.8, color: SW.mid, textAlign: "start" }}>
        <span>{heatCopy.body}</span>
        {ar ? (
          <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            <li><strong style={{ color: SW.ink }}>مكشوف</strong>: عمل تحت أشعة الشمس المباشرة في موقع غير مظلّل — يسري عليه الحظر.</li>
            <li><strong style={{ color: SW.ink }}>مظلّل</strong>: عمل داخل مبنى أو تحت مظلّة تحجب الشمس — لا يسري عليه الحظر.</li>
            <li>إذا وقعت ورديتك في ساعات الحظر تحدّد الإدارة تلقائيًا هل عملك فيها مكشوف أم مظلّل، ويظهر لك ذلك على بطاقة اليوم.</li>
            <li>عند {heatCopy.window.split("–")[0]} في أيام الموسم يصلك إشعار تذكير، وتصل الإدارة كذلك إن كان عملك «مكشوف».</li>
            <li>إن كُلِّفت بعمل مكشوف بين {heatCopy.window.replace("–", " و")} فلك أن ترفض، و<Link to="/app/requests?kind=heat_report" style={{ color: "var(--nv-ok-ink)", fontWeight: 700 }}>بلّغ من «طلبات الدوام» ›</Link></li>
          </ul>
        ) : (
          <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            <li><strong style={{ color: SW.ink }}>Exposed</strong>: work in direct sun at an unshaded site — the ban applies.</li>
            <li><strong style={{ color: SW.ink }}>Shaded</strong>: work indoors or under cover — the ban does not apply.</li>
            <li>When your shift falls in the ban hours, management marks it exposed or shaded and it shows on your day card.</li>
            <li>If you are assigned exposed work in {heatCopy.window}, you may refuse — <Link to="/app/requests?kind=heat_report" style={{ color: "var(--nv-ok-ink)", fontWeight: 700 }}>report it from Duty requests ›</Link></li>
          </ul>
        )}
      </div>
    </section>
  );
}

/** Out of season: a short, static note on the duty rights the platform already enforces. */
export function RightsNoteCard({ ar = true }) {
  const items = ar
    ? [
        ["98", "الحد النظامي 8 ساعات يومياً و48 ساعة أسبوعياً."],
        ["101", "راحة لا تقل عن نصف ساعة بعد 5 ساعات عمل متصلة — لا تُحتسب من ساعات العمل."],
        ["104", "يوم راحة أسبوعي بأجر كامل."],
        ["", "الإجازة المعتمدة لا تُحتسب غياباً ولا تأخيراً."],
      ]
    : [
        ["98", "Statutory limit: 8 hours a day and 48 a week."],
        ["101", "At least half an hour of rest after 5 straight hours — not counted as work."],
        ["104", "One paid weekly rest day."],
        ["", "Approved leave never counts as absence or lateness."],
      ];
  return (
    <section data-duty-rights="1" role="note" style={{ ...slab, display: "flex", flexDirection: "column" }}>
      <SectionHead
        title={ar ? "توعية — حقوقك في الدوام" : "Awareness — your duty rights"}
        note={ar ? "نظام العمل — تطبّقه المنصة على جدولك" : "Labor Law — the platform applies it to your roster"}
        trailing={<Scale aria-hidden style={{ width: 16, height: 16, color: SW.muted }} />}
      />
      <ul style={{ margin: 0, padding: "6px 18px 14px", listStyle: "none", display: "flex", flexDirection: "column", gap: 7 }}>
        {items.map(([article, text]) => (
          <li key={text} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.75, color: SW.mid, textAlign: "start" }}>
            <span style={{ ...dutyChip("rest", { height: 20, fontSize: 10, padding: "0 6px", flex: "none", marginTop: 2, minWidth: 40, justifyContent: "center" }) }}>
              {article ? (
                <>
                  {ar ? "م " : "Art. "}
                  <span dir="ltr">{article}</span>
                </>
              ) : (ar ? "إجازة" : "Leave")}
            </span>
            <span style={{ minWidth: 0 }}>{text}</span>
          </li>
        ))}
      </ul>
      <div style={{ padding: "0 18px 14px", fontSize: 11.5, lineHeight: 1.8, color: SW.mid, textAlign: "start" }}>
        {ar ? "ما يغيّر يوم دوامك يُطلب من " : "What changes a duty day is requested from "}
        <Link to="/app/requests?kind=permission" style={{ color: "var(--nv-ok-ink)", fontWeight: 700 }}>{ar ? "«طلبات الدوام» ›" : "Duty requests ›"}</Link>
        {ar ? " استئذان، تغيير وردية، ساعة الرضاعة (م 154)، إبلاغ حمل (18632)، بلاغ عمل مكشوف (3337)." : " permission, shift change, nursing hour (Art. 154), pregnancy notice (18632), exposed-work report (3337)."}
      </div>
    </section>
  );
}

/**
 * The side column of the employee duty pages. Each card lives on ONE page only (no repeats):
 *   بصمتي → «تنبيهاتي» · سجلي → «توعية — حقوقك» · جدولي → توعية 3337 in season.
 * alerts: show تنبيهاتي. awareness: "auto" (3337 in season, else rights) · "heat" (3337 only) · "rights" · false.
 */
export default function DutySide({
  ar = true,
  lang = "ar",
  employee,
  schedule,
  weekStart,
  currentUser,
  laborCalendar,
  gates,
  station,
  data,
  heatCopy,
  railProps = {},
  alerts = true,
  awareness = "auto",
  children,
}) {
  const personal = heatCopy?.personal ? (
    <div data-heat-season-row="1" style={{ padding: "10px 18px", borderBottom: "1px solid var(--nv-line2)", display: "flex", alignItems: "flex-start", gap: 8, fontSize: 11.5, lineHeight: 1.8, color: SW.mid }}>
      <span style={dutyChip("exposed", { height: 20, fontSize: 10, padding: "0 6px", gap: 3, flex: "none", marginTop: 2 })}>
        <Sun aria-hidden style={{ width: 11, height: 11, flex: "none" }} strokeWidth={2.4} />
        {dutyLabel("exposed", ar)}
      </span>
      <strong style={{ flex: 1, minWidth: 0, color: dutyTone("bad").ink }}>{heatCopy.personal}</strong>
    </div>
  ) : null;
  const awarenessCard = awareness === "rights"
    ? <RightsNoteCard ar={ar} />
    : awareness === "heat"
      ? (heatCopy ? <HeatAwarenessCard heatCopy={heatCopy} ar={ar} /> : null)
      : awareness
        ? (heatCopy ? <HeatAwarenessCard heatCopy={heatCopy} ar={ar} /> : <RightsNoteCard ar={ar} />)
        : null;
  return (
    <>
      {alerts ? <FileHoursAlertsRail
        employee={employee}
        schedule={schedule}
        weekStart={weekStart}
        currentUser={currentUser}
        lang={lang}
        laborCalendar={laborCalendar}
        gates={gates}
        station={station}
        settings={data?.settings}
        company={data}
        canApplyOrdinary={false}
        quietEdge
        leadNotice={personal}
        cardLinks={myAlertLinks(ar)}
        {...railProps}
      /> : null}
      {awarenessCard}
      {children}
    </>
  );
}
