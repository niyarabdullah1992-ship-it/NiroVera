import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/PowerCareAuth";
import { useI18n } from "@/lib/i18n";
import { isOnApprovedLeave } from "@/lib/leaveTypes";
import { checkPublishGates } from "@/lib/shiftDerivations";
import { ShieldCheck } from "lucide-react";
import { ACCENT, MUTED, NAVY, cardShell, dot } from "@/lib/platformStyles";
import LaborArticleCite from "@/components/shared/LaborArticleCite";

async function workforce(payload) {
  const res = await base44.functions.invoke("workforce", payload);
  return res?.data ?? res;
}

const CHECK_NOTES = {
  hours_48: {
    ar: "محسوب لكل أسبوع تقويمي على حدة من المصفوفة نفسها — أثقل أسبوع لأثقل موظف، لا متوسط الشهر.",
    en: "Computed per calendar week from the matrix itself — the heaviest week for the heaviest employee, never a monthly average.",
  },
  rest_11h: {
    ar: "فاصل تشغيلي 11 ساعة بين الورديات — ليست المادة 101.",
    en: "Operational 11-hour gap between shifts — not Article 101.",
  },
  workplace_hours: {
    ar: "لا يبقى العامل في مكان العمل أكثر من 12 ساعة في اليوم — المادة 101.",
    en: "A worker may not remain at the workplace more than 12 hours a day — Art. 101.",
  },
  hours_ramadan: {
    ar: "في رمضان تُخفَّض ساعات المسلمين إلى 6 يومياً أو 36 أسبوعياً — المادة 98.",
    en: "In Ramadan, Muslim hours drop to 6 a day or 36 a week — Art. 98.",
  },
  rest_5h: {
    ar: "لا يجوز تشغيل العامل أكثر من خمس ساعات متواصلة دون راحة وصلاة وطعام لا تقل عن نصف ساعة — المادة 101. والراحة ليست ساعات عمل — المادة 102.",
    en: "A worker may not work more than five consecutive hours without a rest of at least half an hour — Art. 101. Rest periods are not working hours — Art. 102.",
  },
  weekly_rest: {
    ar: "يوم راحة كامل لكل موظف في كل أسبوع، ولا يُستبدل بأجر.",
    en: "A full rest day every week for every employee, never substituted with pay.",
  },
  coverage: {
    ar: "اضغط + في أي خلية فارغة في المصفوفة أعلاه لإسناد موظف — النقص يُسدّ بالإسناد لا بتمديد وردية قائمة.",
    en: "Press + in any empty cell in the matrix above to assign someone — a gap is closed by assignment, never by extending an existing shift.",
  },
  leave_excluded: {
    ar: "من له إجازة معتمدة لا يظهر في الإسناد أصلًا، فلا يُسجَّل غيابه.",
    en: "Anyone on approved leave never enters the assignment, so they are never recorded absent.",
  },
};

/**
 * Platform.dc.html pre-publication checks — L2067–2084 / L6806–6817.
 */
export default function RotaPublishPanel({ stationId, year, monthIndex, shiftTypes, assignments, canManage }) {
  const { company, data } = useAuth();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [checks, setChecks] = useState(null);
  const [blocked, setBlocked] = useState(false);
  const [failed, setFailed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const runLocal = () => {
    const namesById = {};
    const onLeaveIds = [];
    (data?.employees || []).forEach((e) => {
      namesById[e.id] = e.name;
      const days = new Date(year, monthIndex + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
        if (isOnApprovedLeave(e, key)) {
          onLeaveIds.push(e.id);
          break;
        }
      }
    });
    return checkPublishGates({ year, monthIndex, shiftTypes, assignments, onLeaveIds, namesById });
  };

  const refresh = async () => {
    setMessage("");
    const local = runLocal();
    setChecks(local.checks);
    setBlocked(local.blocked);
    setFailed(local.failed);
    if (!company?.id || !stationId) return;
    try {
      const remote = await workforce({
        action: "checkPublish",
        companyId: company.id,
        stationId,
        year,
        monthIndex,
      });
      if (remote?.checks) {
        const byId = Object.fromEntries((local.checks || []).map((row) => [row.id, row]));
        setChecks(remote.checks.map((row) => ({
          ...row,
          article: row.article || byId[row.id]?.article,
        })));
        setBlocked(!!remote.blocked);
        setFailed(remote.failed || null);
      }
    } catch {
      // Keep local derivation when the function is not yet deployed.
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stationId, year, monthIndex, JSON.stringify(shiftTypes), JSON.stringify(assignments)]);

  const publish = async () => {
    if (!canManage || !company?.id) return;
    setBusy(true);
    setMessage("");
    try {
      const remote = await workforce({
        action: "publish",
        companyId: company.id,
        stationId,
        year,
        monthIndex,
      });
      if (remote?.error === "PUBLISH_BLOCKED") {
        setBlocked(true);
        setFailed(remote.failed || null);
        setChecks(remote.checks || checks);
        setMessage(ar ? remote.reason : (remote.reasonEn || remote.reason));
      } else if (remote?.ok) {
        setBlocked(false);
        setFailed(null);
        setChecks(remote.checks || checks);
        setMessage(ar ? "نُشر الجدول وأُبلغ الفريق." : "Roster published and crew notified.");
      } else {
        setMessage(ar ? "تعذّر النشر." : "Publish failed.");
      }
    } catch (err) {
      const local = runLocal();
      if (local.blocked) {
        setBlocked(true);
        setFailed(local.failed);
        setMessage(ar ? `لا يمكن النشر — ${local.failed?.labelAr}` : `Cannot publish — ${local.failed?.labelEn}`);
      } else {
        setMessage(String(err?.message || err));
      }
    } finally {
      setBusy(false);
    }
  };

  if (!checks) return null;

  const publishStyle = blocked || busy
    ? {
        height: "38px",
        padding: "0 16px",
        borderRadius: "9px",
        background: "#E2E8F0",
        color: MUTED,
        border: "none",
        fontSize: "12px",
        fontWeight: 600,
        cursor: "not-allowed",
        fontFamily: "inherit",
      }
    : {
        height: "38px",
        padding: "0 16px",
        borderRadius: "9px",
        background: ACCENT,
        color: "#fff",
        border: "none",
        fontSize: "12px",
        fontWeight: 600,
        cursor: "pointer",
        fontFamily: "inherit",
      };

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      style={{
        ...cardShell,
        maxWidth: 1320,
        boxShadow: "0 1px 0 #E2E8F0",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#ECFDF3",
            color: ACCENT,
            flexShrink: 0,
          }}
        >
          <ShieldCheck style={{ width: 15, height: 15 }} strokeWidth={1.75} />
        </span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>
            {ar ? "فحص ما قبل النشر" : "Pre-publication checks"}
          </div>
          <div style={{ fontSize: 11, color: MUTED, marginTop: 2, lineHeight: 1.55, maxWidth: 820 }}>
            {ar
              ? "كل فحص من المصفوفة أعلاه — لا يُنشر جدول يخالف أيًّا منها."
              : "Every check comes from the matrix — a failing roster cannot be published."}
          </div>
        </div>
      </div>

      <div style={{ marginTop: "12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: "0 24px", marginTop: "6px" }}>
          {checks.map((c) => {
            const note = CHECK_NOTES[c.id];
            return (
              <div key={c.id} style={{ display: "flex", gap: "10px", padding: "10px 0", borderTop: "1px solid #F1F5F9" }}>
                <span style={dot(c.ok ? ACCENT : "#DC2626")} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: c.ok ? NAVY : "#B91C1C",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "7px",
                      flexWrap: "wrap",
                    }}
                  >
                    {ar ? c.labelAr : c.labelEn}
                    {c.article ? <LaborArticleCite cite={{ article: c.article }} ar={ar} /> : null}
                  </span>
                  {note && (
                    <span style={{ display: "block", fontSize: "11px", color: MUTED, lineHeight: 1.65, marginTop: "3px" }}>
                      {ar ? note.ar : note.en}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>

        {canManage && (
          <div style={{ marginTop: "14px" }}>
            <button type="button" disabled={busy || blocked} onClick={publish} style={publishStyle}>
              {blocked
                ? (ar ? `لا يمكن النشر — ${failed?.labelAr || ""}` : `Cannot publish — ${failed?.labelEn || ""}`)
                : busy
                  ? (ar ? "جاري النشر…" : "Publishing…")
                  : (ar ? "انشر الجدول وأبلغ الفريق" : "Publish and notify the crew")}
            </button>
          </div>
        )}

        {message && (
          <div style={{ marginTop: "10px", fontSize: "11px", color: MUTED, lineHeight: 1.65 }}>{message}</div>
        )}
      </div>
    </div>
  );
}
