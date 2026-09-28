import React, { useEffect, useMemo, useState } from "react";
import GreenMenu from "@/components/discipline/GreenMenu";
import { employeeContractWage, monthCapDaysByKind } from "@/lib/disciplineDerivations";
import { ruleValue } from "@/lib/laborRules";
import { money } from "@/lib/disciplineBoard";

function personLabel(person, stations) {
  const name = String(person?.name || "").trim() || "—";
  const station = stations.find((row) => String(row.id) === String(person?.stationId || person?.station_id));
  return station?.name ? `${name} — ${station.name}` : name;
}

export default function DisciplineCutCalculator({ ar, employees = [], stations = [], cases = [], today }) {
  const cap = ruleValue("discipline.fine.maxDays", today) || 5;
  const [employeeId, setEmployeeId] = useState("");
  const [kind, setKind] = useState("fine");
  const [days, setDays] = useState(1);

  useEffect(() => {
    if (employees.some((person) => String(person.id) === String(employeeId))) return;
    setEmployeeId(employees[0]?.id || "");
  }, [employeeId, employees]);

  const person = employees.find((row) => String(row.id) === String(employeeId)) || null;
  const wage = person ? employeeContractWage(person) : 0;
  const used = person ? monthCapDaysByKind(cases, person.id, today, kind) : 0;
  const dayWage = wage > 0 ? wage / 30 : 0;
  const amount = wage > 0 && days > 0 ? Math.round((days * wage) / 30 * 100) / 100 : null;
  const left = Math.max(0, cap - used);
  const over = used + days > cap;

  const people = useMemo(
    () => employees.map((row) => ({ value: row.id, label: personLabel(row, stations) })),
    [employees, stations],
  );
  const kinds = [
    { value: "fine", label: ar ? "غرامة" : "Fine" },
    { value: "suspend", label: ar ? "الإيقاف عن العمل مع الحرمان من الأجر" : "Unpaid suspension" },
  ];
  const dayOptions = Array.from({ length: cap }, (_, index) => {
    const n = index + 1;
    return { value: String(n), label: ar ? `${n}` : String(n) };
  });

  const figure = (value, unit) => (value == null || value === "" ? "—" : `${value}${unit ? ` ${unit}` : ""}`);

  return (
    <section
      className="nv-paper"
      data-discipline-calc=""
      style={{ background: "var(--nv-card)", border: "1px solid var(--nv-line)", borderBottom: "3px solid #C8A45A", borderRadius: 10, display: "flex", flexDirection: "column" }}
    >
      <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--nv-line)", display: "flex", flexDirection: "column", gap: 4 }}>
        <strong style={{ fontSize: 15, color: "var(--nv-ink)" }}>{ar ? "حاسبة الحسم النظامي" : "Statutory cut calculator"}</strong>
        <span style={{ fontSize: 12, color: "var(--nv-muted)", lineHeight: 1.7 }}>
          {ar
            ? "أجر اليوم من عقد الموظف الحي، والسقف من المادة 70. الحاسبة لا تفتح ملفاً."
            : "The day's wage comes from the live contract, and the cap from Article 70. The calculator does not open a file."}
        </span>
      </div>
      <div style={{ padding: "14px 16px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,190px),1fr))", gap: 10 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "الموظف" : "Employee"}</span>
          <GreenMenu
            ariaLabel={ar ? "الموظف" : "Employee"}
            menuId="discipline-calc-employee"
            value={employeeId}
            options={people}
            placeholder="—"
            onChange={setEmployeeId}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "نوع الحسم" : "Cut kind"}</span>
          <GreenMenu
            ariaLabel={ar ? "نوع الحسم" : "Cut kind"}
            menuId="discipline-calc-kind"
            value={kind}
            options={kinds}
            onChange={setKind}
          />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 11, color: "var(--nv-muted)" }}>{ar ? "الأيام" : "Days"}</span>
          <GreenMenu
            ariaLabel={ar ? "الأيام" : "Days"}
            menuId="discipline-calc-days"
            value={String(days)}
            options={dayOptions}
            onChange={(next) => setDays(Number(next) || 1)}
          />
        </label>
      </div>
      <div style={{ padding: "0 16px 14px", display: "flex", flexDirection: "column" }}>
        {[
          [ar ? "الأجر الشهري" : "Monthly wage", wage > 0 ? `${money(wage)} ${ar ? "ر.س" : "SAR"}` : "—"],
          [ar ? "أجر اليوم" : "Day's wage", dayWage > 0 ? `${money(dayWage)} ${ar ? "ر.س" : "SAR"}` : "—"],
          [ar ? "مقدار هذا الحسم" : "This cut", amount != null ? `${money(amount)} ${ar ? "ر.س" : "SAR"}` : "—"],
          [ar ? "المستخدم هذا الشهر" : "Used this month", person ? String(used) : "—"],
          [ar ? "المتبقي ضمن السقف" : "Left under the cap", person ? String(left) : "—"],
        ].map(([head, value]) => (
          <div key={head} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "10px 0", borderTop: "1px solid var(--nv-line)", fontSize: 12 }}>
            <span style={{ color: "var(--nv-ink2)" }}>{head}</span>
            <span dir="ltr" style={{ fontFamily: "'IBM Plex Mono',monospace", fontWeight: 600 }}>{figure(value)}</span>
          </div>
        ))}
        <span style={{ fontSize: 11, color: over ? "var(--nv-bad-ink)" : "var(--nv-muted)", lineHeight: 1.7, paddingTop: 8 }}>
          {over
            ? (ar ? `موقوف — لا يُحسم أكثر من أجر ${cap} أيام في الشهر.` : `Blocked — no more than ${cap} days' wage may be cut in a month.`)
            : (ar ? `السقف ${cap} أيام في الشهر. بلا أجر في العقد يبقى المقدار «—».` : `The cap is ${cap} days in a month. With no contract wage the amount stays «—».`)}
        </span>
      </div>
    </section>
  );
}
