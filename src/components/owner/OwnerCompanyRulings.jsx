import React, { useEffect, useState } from "react";
import { Crown } from "lucide-react";
import {
  companySubscriptionRow,
  holidayDraft,
  ramadanHoursRuling,
  rulingSubscriptionPlans,
} from "@/lib/ownerBoard";
import { getCompanyData, saveOwnerHolidays, saveOwnerRamadan, saveOwnerSubscriptions } from "@/lib/store";
import { laborCalendarOf, ramadanAnnouncementOf } from "@/lib/ummAlQuraCalendar";
import IdentityCard from "@/components/shared/IdentityCard";
import { labelMuted, MUTED } from "@/lib/platformStyles";
import {
  ownerChip,
  ownerField,
  ownerGateBanner,
  ownerOkBanner,
  ownerPrimaryBtn,
  ownerStatusChip,
} from "@/components/owner/ownerUi";

const YEARS = [2025, 2026, 2027, 2028];

/** Platform rulings: one company's subscription price, plus holidays and Ramadan for every tenant. */
export default function OwnerCompanyRulings({
  ar,
  actor,
  companies,
  focus = "subscriptions",
  stamp,
  onStamp,
}) {
  const [selectedId, setSelectedId] = useState("");
  const [planForm, setPlanForm] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [ramadan, setRamadan] = useState({ year: 2026, from: "", to: "" });
  const [planGate, setPlanGate] = useState(null);
  const [holidayGate, setHolidayGate] = useState(null);
  const [ramadanGate, setRamadanGate] = useState(null);

  const selected = companies.find((company) => company.id === selectedId) || null;
  const selectedData = selected ? getCompanyData(selected.id) : null;
  const row = selected ? companySubscriptionRow(selected, selectedData) : null;
  // Holidays and Ramadan are platform-wide — never wait on a company pick.
  const platformCalendar = laborCalendarOf({});
  const calendar = focus === "holidays" || focus === "ramadan"
    ? platformCalendar
    : laborCalendarOf(selectedData || {});
  const ramadanStatus = ramadanAnnouncementOf(ramadan.year, calendar);
  const hours = ramadan.from ? ramadanHoursRuling({
    ...calendar,
    [String(ramadan.year)]: {
      ...(calendar?.[String(ramadan.year)] || {}),
      ...(ramadan.from ? { ownerRamadanFrom: ramadan.from } : {}),
      ...(ramadan.to ? { ownerRamadanTo: ramadan.to } : {}),
    },
  }, ramadan.from, {}) : null;

  useEffect(() => {
    const next = focus === "holidays" || focus === "ramadan"
      ? laborCalendarOf({})
      : laborCalendarOf(selectedData || {});
    setHolidays(holidayDraft(next));
    const year = YEARS.includes(new Date().getFullYear()) ? new Date().getFullYear() : 2026;
    const status = ramadanAnnouncementOf(year, next);
    setRamadan({
      year,
      from: status.from || "",
      to: status.ownerRuled && status.length ? (status.lastDay || "") : "",
    });
  }, [selectedId, stamp, focus]);

  useEffect(() => {
    if (!selected || !selectedData) {
      setPlanForm(null);
      return;
    }
    const plans = rulingSubscriptionPlans(selectedData.settings?.ownerBoard?.plans);
    const current = row?.view?.ok ? plans.find((plan) => plan.slug === row.view.slug) : null;
    setPlanForm(current ? {
      slug: current.slug,
      nameAr: current.nameAr,
      nameEn: current.nameEn,
      monthlyPrice: current.monthlyPrice,
      yearlyPrice: current.yearlyPrice,
    } : null);
  }, [selectedId, stamp, selected, selectedData, row?.view?.ok, row?.view?.slug]);

  useEffect(() => {
    setPlanGate(null);
    setHolidayGate(null);
    setRamadanGate(null);
  }, [selectedId, focus]);

  const bump = () => onStamp?.();

  const savePlans = () => {
    if (!selected || !planForm) return;
    const plans = rulingSubscriptionPlans(selectedData?.settings?.ownerBoard?.plans).map((plan) => (
      plan.slug === planForm.slug ? { ...plan, ...planForm } : plan
    ));
    const result = saveOwnerSubscriptions(selected.id, plans, { actor });
    setPlanGate(result.ok ? { ok: true } : result);
    if (result.ok) bump();
  };

  const saveHolidays = () => {
    const result = saveOwnerHolidays("", holidays, { actor });
    setHolidayGate(result.ok ? { ok: true } : result);
    if (result.ok) bump();
  };

  const saveRamadan = () => {
    const result = saveOwnerRamadan("", ramadan, { actor });
    setRamadanGate(result.ok ? { ok: true } : result);
    if (result.ok) bump();
  };

  if (focus === "subscriptions") {
    return (
      <>
        <IdentityCard
          icon={Crown}
          title={ar ? `اشتراكات الشركات (${companies.length})` : `Company subscriptions (${companies.length})`}
          subtitle={ar
            ? "اختر شركة لتغيير اسم اشتراكها وسعرها. الحكم خارج منصة الشركة — لا شريحة اشتراك داخل /app."
            : "Choose a company to change its plan name and price. The ruling lives outside the company app — no plan chip inside /app."}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {companies.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{ar ? "لا شركات في السجل." : "No companies in the registry."}</p> : null}
            {companies.map((company) => {
              const item = companySubscriptionRow(company, getCompanyData(company.id));
              const on = company.id === selectedId;
              return (
                <button
                  key={company.id}
                  type="button"
                  onClick={() => setSelectedId(company.id)}
                  style={{
                    ...ownerChip(on),
                    textAlign: "inherit",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    width: "100%",
                    padding: "10px 12px",
                  }}
                >
                  <span>
                    <strong>{company.name || company.id}</strong>
                    <span style={{ display: "block", fontSize: 11, color: on ? "inherit" : MUTED, opacity: on ? 0.85 : 1 }}>{company.ownerEmail || ""}</span>
                  </span>
                  <span style={{ fontSize: 12, textAlign: "end" }}>
                    {item.view.ok ? `${ar ? item.view.nameAr : item.view.nameEn} · ${item.view.monthlyPrice} ${item.view.currency}` : (ar ? item.view.reason : item.view.reasonEn)}
                    <span style={{ display: "block", marginTop: 4 }}>
                      <span style={ownerStatusChip(item.status.id === "active" ? "ok" : item.status.id === "frozen" ? "bad" : item.status.id === "ended" ? "bad" : "warn")}>
                        {ar ? item.status.ar : item.status.en}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </IdentityCard>

        {selected ? (
          <IdentityCard
            icon={Crown}
            title={selected.name || selected.id}
            subtitle={ar ? "هذا الحفظ يحكم اشتراك هذه الشركة فقط." : "This save rules this company's subscription only."}
          >
            {!selectedData || !planForm ? (
              <p style={{ margin: 0, fontSize: 13, color: MUTED }}>{ar ? "لا سجل محلي لهذه الشركة — لا يُخترع سعر." : "No local record for this company — a price is not invented."}</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
                  {row?.view?.ok
                    ? (ar
                      ? `اشتراك ${selected.name} الآن: ${row.view.nameAr} · ${row.view.monthlyPrice} ${row.view.currency} / شهر · ${row.status.ar}.`
                      : `${selected.name}'s subscription is now: ${row.view.nameEn} · ${row.view.monthlyPrice} ${row.view.currency} / month · ${row.status.en}.`)
                    : (ar ? row?.view?.reason : row?.view?.reasonEn)}
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                  <label>
                    <span style={labelMuted}>{ar ? "اسم الاشتراك بالعربية" : "Arabic plan name"}</span>
                    <input style={ownerField()} value={planForm.nameAr} onChange={(event) => setPlanForm((form) => ({ ...form, nameAr: event.target.value }))} />
                  </label>
                  <label>
                    <span style={labelMuted}>{ar ? "اسم الاشتراك بالإنجليزية" : "English plan name"}</span>
                    <input style={ownerField()} value={planForm.nameEn} onChange={(event) => setPlanForm((form) => ({ ...form, nameEn: event.target.value }))} />
                  </label>
                  <label>
                    <span style={labelMuted}>{ar ? "السعر الشهري" : "Monthly price"}</span>
                    <input style={ownerField()} type="number" min="0" step="0.01" value={planForm.monthlyPrice} onChange={(event) => setPlanForm((form) => ({ ...form, monthlyPrice: event.target.value }))} />
                  </label>
                  <label>
                    <span style={labelMuted}>{ar ? "السعر السنوي" : "Yearly price"}</span>
                    <input style={ownerField()} type="number" min="0" step="0.01" value={planForm.yearlyPrice} onChange={(event) => setPlanForm((form) => ({ ...form, yearlyPrice: event.target.value }))} />
                  </label>
                </div>
                <div>
                  <button type="button" style={ownerPrimaryBtn()} onClick={savePlans}>{ar ? "حفظ اشتراك الشركة" : "Save company subscription"}</button>
                  {ownerGateBanner(planGate, ar)}
                  {planGate?.ok ? ownerOkBanner(ar ? "حُفظ. الفوترة وبوابات هذه الشركة تقرأ هذا الحكم." : "Saved. This company's billing and gates read this ruling.") : null}
                </div>
              </div>
            )}
          </IdentityCard>
        ) : null}
      </>
    );
  }

  if (focus === "holidays") {
    return (
      <IdentityCard
        icon={Crown}
        title={ar ? "الإجازات الرسمية" : "Official holidays"}
        subtitle={ar
          ? "حكم المنصة لكل الشركات. اليوم الوطني 23 سبتمبر ويوم التأسيس 22 فبراير ثابتان حتى تغيّرهما هنا. العيد يبقى على أم القرى حتى تحكم موعده."
          : "Platform ruling for every company. National Day stays 23 September and Founding Day 22 February until you change them here. Eid stays on Umm al-Qura until you rule its dates."}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {holidays.map((item) => {
            const civic = item.id === "national" || item.id === "founding";
            return (
              <div key={item.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
                <label>
                  <span style={labelMuted}>{ar ? "الاسم بالعربية" : "Arabic name"}</span>
                  <input style={ownerField()} value={item.nameAr} onChange={(event) => setHolidays((rows) => rows.map((row) => row.id === item.id ? { ...row, nameAr: event.target.value } : row))} />
                </label>
                <label>
                  <span style={labelMuted}>{ar ? "الاسم بالإنجليزية" : "English name"}</span>
                  <input style={ownerField()} value={item.nameEn} onChange={(event) => setHolidays((rows) => rows.map((row) => row.id === item.id ? { ...row, nameEn: event.target.value } : row))} />
                </label>
                {civic ? (
                  <>
                    <label>
                      <span style={labelMuted}>{ar ? "الشهر" : "Month"}</span>
                      <input style={ownerField()} type="number" min="1" max="12" value={item.month} onChange={(event) => setHolidays((rows) => rows.map((row) => row.id === item.id ? { ...row, month: event.target.value } : row))} />
                    </label>
                    <label>
                      <span style={labelMuted}>{ar ? "اليوم" : "Day"}</span>
                      <input style={ownerField()} type="number" min="1" max="31" value={item.day} onChange={(event) => setHolidays((rows) => rows.map((row) => row.id === item.id ? { ...row, day: event.target.value } : row))} />
                    </label>
                  </>
                ) : (
                  <>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                      <input type="checkbox" checked={item.dateOverride === true} onChange={(event) => setHolidays((rows) => rows.map((row) => row.id === item.id ? { ...row, dateOverride: event.target.checked } : row))} />
                      {ar ? "حكم المالك على الموعد" : "Owner rules these dates"}
                    </label>
                    <label>
                      <span style={labelMuted}>{ar ? "من" : "From"}</span>
                      <input style={ownerField()} type="date" disabled={!item.dateOverride} value={item.from || ""} onChange={(event) => setHolidays((rows) => rows.map((row) => row.id === item.id ? { ...row, from: event.target.value } : row))} />
                    </label>
                    <label>
                      <span style={labelMuted}>{ar ? "إلى" : "To"}</span>
                      <input style={ownerField()} type="date" disabled={!item.dateOverride} value={item.to || ""} onChange={(event) => setHolidays((rows) => rows.map((row) => row.id === item.id ? { ...row, to: event.target.value } : row))} />
                    </label>
                  </>
                )}
              </div>
            );
          })}
          <div>
            <button type="button" style={ownerPrimaryBtn()} onClick={saveHolidays}>{ar ? "تطبيق حكم الإجازات" : "Apply holiday ruling"}</button>
            {ownerGateBanner(holidayGate, ar)}
            {holidayGate?.ok ? ownerOkBanner(ar ? "حُفظ. جداول كل الشركات تقرأ هذا الحكم." : "Saved. Every company's roster reads this ruling.") : null}
            {!holidays.length ? (
              <p style={{ margin: "8px 0 0", fontSize: 12, color: MUTED }}>
                {ar
                  ? `الافتراضي من التقويم: ${holidayDraft(platformCalendar).map((row) => row.nameAr).join(" · ")}.`
                  : `Calendar defaults: ${holidayDraft(platformCalendar).map((row) => row.nameEn).join(" · ")}.`}
              </p>
            ) : null}
          </div>
        </div>
      </IdentityCard>
    );
  }

  return (
    <IdentityCard
      icon={Crown}
      title={ar ? "موعد رمضان" : "Ramadan date"}
      subtitle={ar
        ? "بداية رمضان المحفوظة تحكم ساعات كل الشركات: 5×8 تصبح 6، وبقاء 12 في نظام 4×12 يبقى 12."
        : "The saved Ramadan start rules every company's hours: 5×8 becomes 6, and a 4×12 stay stays 12."}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
          {ramadanStatus.predictedFrom
            ? (ar ? `توقع أم القرى: ${ramadanStatus.predictedFrom}.` : `Umm al-Qura: ${ramadanStatus.predictedFrom}.`)
            : (ar ? "لا نافذة مرمّزة لهذه السنة." : "No encoded window for this year.")}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
          <label>
            <span style={labelMuted}>{ar ? "السنة" : "Year"}</span>
            <select
              style={ownerField()}
              value={ramadan.year}
              onChange={(event) => {
                const year = Number(event.target.value);
                const next = ramadanAnnouncementOf(year, calendar);
                setRamadan({ year, from: next.from || "", to: next.ownerRuled && next.length ? (next.lastDay || "") : "" });
              }}
            >
              {YEARS.map((year) => <option key={year} value={year}>{year}</option>)}
            </select>
          </label>
          <label>
            <span style={labelMuted}>{ar ? "البداية" : "Start"}</span>
            <input style={ownerField()} type="date" value={ramadan.from} onChange={(event) => setRamadan((value) => ({ ...value, from: event.target.value }))} />
          </label>
          <label>
            <span style={labelMuted}>{ar ? "النهاية (29 أو 30)" : "End (29 or 30)"}</span>
            <input style={ownerField()} type="date" value={ramadan.to} onChange={(event) => setRamadan((value) => ({ ...value, to: event.target.value }))} />
          </label>
        </div>
        {hours?.ramadan ? (
          <p style={{ margin: 0, fontSize: 12, color: MUTED }}>{ar ? `حد اليوم ${hours.dailyCap} ساعات، وسقف البقاء ${hours.stayCap}.` : `Day cap ${hours.dailyCap} hours, stay ceiling ${hours.stayCap}.`}</p>
        ) : null}
        <div>
          <button type="button" style={ownerPrimaryBtn()} onClick={saveRamadan}>{ar ? "تطبيق موعد رمضان" : "Apply Ramadan date"}</button>
          {ownerGateBanner(ramadanGate, ar)}
          {ramadanGate?.ok ? ownerOkBanner(ar ? "حُفظ. ساعات كل الشركات تُشتق من هذا الموعد." : "Saved. Every company's hours derive from this date.") : null}
        </div>
      </div>
    </IdentityCard>
  );
}
