import React, { useState } from "react";
import { Link } from "react-router-dom";
import { BORDER, CARD, MUTED, NAVY, NAVY_FILL, SURFACE } from "@/lib/platformStyles";

const RING_TONE = {
  ok: { mark: "✓", color: "#137a49", bg: "color-mix(in oklab, #1E9E63 10%, #fff)", border: "color-mix(in oklab, #1E9E63 28%, #fff)", weight: 400 },
  bad: { mark: "✕", color: "#8a1c2b", bg: "#fbf1f2", border: "#e9c4c9", weight: 700 },
  wait: { mark: "—", color: "#8a6516", bg: "#fdf6e8", border: "#ecd9a8", weight: 600 },
  leave: { mark: "◌", color: "#3d2410", bg: "#efe0cc", border: "#d4b896", weight: 700 },
};

/** Real product chain — shift → punch → geofence → register. Not NFC / Passkey. */
export function buildAttendanceRings({ ar, scheduled, punched, geofence, register, onLeave = false }) {
  const geoState = onLeave ? "leave" : geofence === "inside" ? "ok" : geofence === "outside" ? "bad" : "wait";
  const punchState = onLeave ? "leave" : punched ? "ok" : scheduled ? "wait" : "bad";
  const shiftState = onLeave ? "leave" : scheduled ? "ok" : "bad";
  const registerState = onLeave
    ? "leave"
    : register === "closed" ? "ok" : register === "missing" ? "bad" : "wait";
  const defs = [
    { tag: "01", title: ar ? "وردية" : "Shift", state: shiftState },
    { tag: "02", title: ar ? "بصمة" : "Punch", state: punchState },
    { tag: "03", title: ar ? "نطاق" : "Range", state: geoState },
    { tag: "04", title: ar ? "سجل" : "Register", state: registerState },
  ];
  return defs.map((item) => ({ ...item, ...RING_TONE[item.state] }));
}

export function brokeAtLabel(ar, rings) {
  const shift = rings.find((item) => item.tag === "01");
  const punch = rings.find((item) => item.tag === "02");
  const range = rings.find((item) => item.tag === "03");
  const record = rings.find((item) => item.tag === "04");
  if (shift?.state === "leave" || punch?.state === "leave") {
    return ar ? "أُغلق بإجازة معتمدة" : "Closed by approved leave";
  }
  if (shift?.state === "bad") return ar ? "انكسرت عند الوردية" : "Broke at the shift";
  if (punch?.state !== "ok") return ar ? "انكسرت عند البصمة" : "Broke at the punch";
  if (range?.state === "bad") return ar ? "انكسرت عند النطاق" : "Broke at the range";
  if (record?.state !== "ok") return ar ? "لم يُغلق السجل" : "Register still open";
  return "";
}

export function AttendanceRingChips({ rings, brokeAt }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {rings.map((item) => (
        <span
          key={item.tag}
          title={`${item.tag} ${item.title}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            padding: "3px 9px",
            border: `1px solid ${item.border}`,
            background: item.bg,
            color: item.color,
            fontWeight: item.weight,
          }}
        >
          <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10 }}>{item.tag}</span>
          {item.title}
          {" "}
          {item.mark}
        </span>
      ))}
      {brokeAt ? <span style={{ fontSize: 11, color: MUTED, paddingInlineStart: 4 }}>{brokeAt}</span> : null}
    </div>
  );
}

export function punchChainFromAttendance(attendance, { scheduled = false, onLeave = false } = {}) {
  const punched = !!(attendance?.check_in_at || attendance?.checkInAt);
  const closed = !!(attendance?.check_out_at || attendance?.checkOutAt);
  const loc = attendance?.location_status || attendance?.locationStatus;
  return {
    scheduled: !!scheduled,
    onLeave: !!onLeave,
    punched,
    geofence: loc === "outside" ? "outside" : loc === "inside" ? "inside" : "none",
    register: closed ? "closed" : punched ? "open" : "wait",
  };
}

const CHAIN_COPY = {
  ar: {
    sub: "أربع حلقات حقيقية. الموظف يلمس البصمة فقط.",
    by: { system: "النظام", employee: "الموظف", background: "الخلفية", register: "السجل" },
    state: { ok: "مستوفاة", bad: "مكسورة", wait: "بانتظار", leave: "إجازة" },
    items: {
      "01": {
        title: "الوردية",
        by: "system",
        ok: "ورديتك اليوم من الجدول المنشور — مصدر الوقت الوحيد.",
        bad: "غير مدرج في جدول اليوم. لا بصمة ذاتية، ولا يُحتسب غياب بلا وردية.",
        leave: "إجازة معتمدة اليوم — يوم الحضور مغلق، لا يُعدّ وردية مكسورة.",
      },
      "02": {
        title: "البصمة",
        by: "employee",
        ok: "سُجّل الحضور. ضغطة الانصراف تغلق اليوم.",
        wait: "ضغطة واحدة عند الوصول. هذا ما يلمسه الموظف.",
        bad: "البصمة مغلقة — لا وردية منشورة اليوم.",
        leave: "لا يمكن تسجيل الحضور — لديك إجازة معتمدة لهذا اليوم.",
      },
      "03": {
        title: "النطاق",
        by: "background",
        ok: "نقطة التسجيل داخل نطاق الفرع.",
        bad: "خارج النطاق. السجل يُوسم ويظهر للمدير — لا يُرفض لتقنية لم تُبنَ.",
        wait: "نطاق الفرع يُفحص عند التسجيل ويظهر عند الفشل.",
        leave: "لا نطاق يُفحص — اليوم خارج حساب الحضور.",
      },
      "04": {
        title: "السجل",
        by: "register",
        ok: "أُغلق بانصراف. الحالة تغذي المهام ثم المسير.",
        wait: "اليوم ما زال مفتوحاً حتى الانصراف.",
        bad: "لم يُغلق السجل.",
        leave: "خارج حساب الحضور — إجازة معتمدة، بلا ساعات مخترعة.",
      },
    },
  },
  en: {
    sub: "Four live links. The employee only touches the punch.",
    by: { system: "System", employee: "Employee", background: "Background", register: "Register" },
    state: { ok: "Met", bad: "Broken", wait: "Waiting", leave: "Leave" },
    items: {
      "01": {
        title: "Shift",
        by: "system",
        ok: "Today's shift comes from the published rota — the only clock.",
        bad: "Not on today's rota. No self-punch, and no absence without a published shift.",
        leave: "Approved leave today — the attendance day is closed, not a broken shift.",
      },
      "02": {
        title: "Punch",
        by: "employee",
        ok: "Checked in. Checkout closes the day.",
        wait: "One tap on arrival. This is what the employee touches.",
        bad: "Punch is closed — no published shift today.",
        leave: "Check-in blocked — you have approved leave for this day.",
      },
      "03": {
        title: "Range",
        by: "background",
        ok: "The punch point is inside the station range.",
        bad: "Outside the range. The row is flagged for the manager — not refused for a feature we did not build.",
        wait: "Station range is checked on punch and shown on failure.",
        leave: "No range check — the day is outside the attendance account.",
      },
      "04": {
        title: "Register",
        by: "register",
        ok: "Closed on checkout. Status feeds tasks, then payroll.",
        wait: "The day stays open until checkout.",
        bad: "The register was not closed.",
        leave: "Outside the attendance account — approved leave, no invented hours.",
      },
    },
  },
};

export function AttendanceProofChain({ ar, scheduled, punched, geofence, register, onLeave = false }) {
  const copy = ar ? CHAIN_COPY.ar : CHAIN_COPY.en;
  const rings = buildAttendanceRings({ ar, scheduled, punched, geofence, register, onLeave });

  return (
    <section className="nv-att-card" style={{ background: CARD, border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "سلسلة الإثبات" : "Proof chain"}</span>
        <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.7 }}>{copy.sub}</span>
      </div>
      {rings.map((item) => {
        const text = copy.items[item.tag];
        const note = text[item.state] || text.wait || text.ok;
        const RowTag = item.tag === "01" ? Link : "div";
        return (
          <RowTag
            key={item.tag}
            to={item.tag === "01" ? "/app/shifts" : undefined}
            className="nv-att-chain-row"
            data-nv-att-line
            style={{
              padding: "13px 20px",
              borderBottom: `1px solid ${BORDER}`,
              display: "grid",
              gridTemplateColumns: "auto auto minmax(0,1fr) auto",
              gap: 11,
              alignItems: "start",
              textDecoration: "none",
              color: "inherit",
              background: item.state === "bad" ? "#fbf1f2" : item.state === "ok" ? "transparent" : SURFACE,
            }}
          >
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: MUTED, paddingTop: 3 }}>{item.tag}</span>
            <span style={{
              width: 18,
              height: 18,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 700,
              color: item.color,
              border: `1px solid ${item.border}`,
              background: item.bg,
            }}
            >
              {item.mark}
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <span style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>{item.title}</span>
                <span style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: item.color,
                  background: item.bg,
                  border: `1px solid ${item.border}`,
                  padding: "1px 7px",
                  whiteSpace: "nowrap",
                }}
                >
                  {copy.state[item.state]}
                </span>
              </span>
              <span style={{ fontSize: 11, color: MUTED, lineHeight: 1.8 }}>{note}</span>
              {item.tag === "01" ? (
                <span style={{ fontSize: 11, fontWeight: 600, color: "#137a49" }}>{ar ? "مصدر الوقت ←" : "Clock source →"}</span>
              ) : null}
            </span>
            <span style={{ fontSize: 10, color: MUTED, whiteSpace: "nowrap", paddingTop: 3 }}>{copy.by[text.by]}</span>
          </RowTag>
        );
      })}
    </section>
  );
}

export function AttendanceEmployeeGuide({ ar }) {
  const [open, setOpen] = useState(false);
  const facing = ar
    ? [
        { title: "سجّل الحضور", cost: "ضغطة", note: "عندما تصل إلى الفرع. وقت الوردية من الجدول فقط." },
        { title: "سجّل الانصراف", cost: "ضغطة", note: "عند المغادرة. لا درجات ولا فحوصات ظاهرة إن نجح التسجيل." },
      ]
    : [
        { title: "Check in", cost: "One tap", note: "When you arrive. Shift times come from the rota only." },
        { title: "Check out", cost: "One tap", note: "When you leave. No scores or checks if the punch succeeds." },
      ];
  const background = ar
    ? [
        { title: "الوردية", note: "الأوقات من الجدول المنشور. غير المدرج في وردية اليوم لا يُسمح له بالبصمة.", when: "قبل الضغط" },
        { title: "الإجازة", note: "إجازة معتمدة تغلق يوم الحضور.", when: "قبل الضغط" },
        { title: "نطاق الفرع", note: "خارج النطاق يظهر للمدير. لا يُخترع رفض لتقنية غير موجودة.", when: "عند الفشل" },
      ]
    : [
        { title: "Shift", note: "Times come from the published rota. Unscheduled staff cannot punch.", when: "Before tap" },
        { title: "Leave", note: "Approved leave closes the attendance day.", when: "Before tap" },
        { title: "Station range", note: "Outside the range goes to the manager. No invented GPS-spoof reject.", when: "On failure" },
      ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, minWidth: 0 }}>
      <section className="nv-att-card" style={{ background: CARD, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: NAVY }}>{ar ? "ما يواجهه الموظف" : "What the employee faces"}</div>
          <div style={{ fontSize: 12, color: MUTED, marginTop: 3 }}>{ar ? "خطوتان، لا أكثر" : "Two steps, no more"}</div>
        </div>
        {facing.map((item, index) => (
          <div key={item.title} style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "grid", gridTemplateColumns: "36px minmax(0,1fr)", gap: 14 }}>
            <span
              style={{
                width: 36,
                height: 36,
                border: `1px solid ${BORDER}`,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                color: NAVY,
                fontWeight: 700,
                fontSize: 13,
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              {index + 1}
            </span>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{item.title}</span>
                <span style={{ fontSize: 11, color: "#137a49", fontWeight: 600 }}>{item.cost}</span>
              </div>
              <p style={{ margin: "5px 0 0", fontSize: 12, color: MUTED, lineHeight: 1.8 }}>{item.note}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="nv-att-card" style={{ background: CARD, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          style={{
            fontFamily: "inherit",
            width: "100%",
            textAlign: "start",
            padding: "16px 20px",
            border: "none",
            background: "none",
            cursor: "pointer",
            color: NAVY,
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) auto",
            gap: 12,
            alignItems: "center",
          }}
        >
          <span>
            <span style={{ display: "block", fontSize: 15, fontWeight: 700 }}>{ar ? "ما يعمل في الخلفية" : "What runs in the background"}</span>
            <span style={{ display: "block", fontSize: 12, color: MUTED, marginTop: 3 }}>
              {ar ? "لا يراه الموظف. يظهر للمدير عند الفشل." : "Hidden from the employee. Shown to the manager on failure."}
            </span>
          </span>
          <span style={{ fontSize: 12, color: "#137a49", fontWeight: 600, whiteSpace: "nowrap" }}>
            {open ? (ar ? "إخفاء" : "Hide") : (ar ? "إظهار" : "Show")}
          </span>
        </button>
        {open ? background.map((item) => (
          <div key={item.title} data-nv-att-line style={{ padding: "13px 20px", borderTop: `1px solid ${BORDER}`, display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 14 }}>
            <span>
              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: NAVY }}>{item.title}</span>
              <span style={{ display: "block", fontSize: 12, color: MUTED, lineHeight: 1.75, marginTop: 3 }}>{item.note}</span>
            </span>
            <span style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap", paddingTop: 3 }}>{item.when}</span>
          </div>
        )) : null}
      </section>

      <section
        className="nv-att-card"
        style={{ background: NAVY_FILL, color: "#fff", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8 }}
      >
        <span style={{ fontSize: 13, fontWeight: 700 }}>{ar ? "لا شيء يمنع الموظف بسبب عطل غير موجود" : "Nothing blocks the employee for a feature we do not have"}</span>
        <span style={{ fontSize: 12, lineHeight: 1.9, color: "rgba(255,255,255,.85)" }}>
          {ar
            ? "البصمة تسجّل مَن وأين. إن فشل النطاق تظهر الحالة للمدير. لا يُرفض الحضور لتقنية لم نبنها."
            : "The punch records who and where. If the range fails, the manager sees it. Attendance is not refused for a feature we did not build."}
        </span>
        <Link to="/app/tasks" style={{ color: "#4ade9b", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
          {ar ? "بعد البصمة: المهام" : "After punch: tasks"}
        </Link>
      </section>
    </div>
  );
}
