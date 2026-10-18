import React from "react";
import { citeRule } from "@/lib/laborRules";
import { SW } from "@/lib/shiftWeek";

/**
 * «إعلان الجدول في موقع العمل» — Art. 17, for the manager's knowledge only (no recording, no gate). It sits
 * with the table it is about: the roster built here is the table the law means, every worker sees it in
 * «جدولي», and the law asks for it posted in a visible place at the work site as well.
 */
export default function WorkPostingSetting({ ar = true, onDate }) {
  const cite = citeRule("hours.posting.cite", onDate);
  return (
    <div data-work-posting-info="1" role="note" style={{ padding: "11px 18px", borderBottom: `1px solid ${SW.hair}`, display: "flex", flexDirection: "column", gap: 3, fontSize: 12, color: SW.ink, lineHeight: 1.7 }}>
      <strong style={{ fontWeight: 600 }}>{ar ? `للعلم — إعلان الجدول في موقع العمل (${cite?.labelAr || "المادة 17"})` : `For your information — posting the table at the work site (${cite?.labelEn || "Art. 17"})`}</strong>
      <span style={{ fontSize: 11, color: SW.mid }}>
        {ar
          ? "يلزم النظام صاحب العمل بوضع جدول مواعيد العمل وفترات الراحة ويوم الراحة الأسبوعي ومواعيد بدء كل نوبة وانتهائها في مكان ظاهر بموقع العمل. هذا الجدول هو ما تبنيه هنا، ويراه كل موظف في «جدولي». وإن غيّرته فعلّق النسخة الجديدة في الموقع."
          : "The law requires the employer to post the table of working hours, rest periods, weekly rest day and each shift's start and end in a visible place at the work site. It is the table you build here, and every worker sees it in «My schedule». If you change it, post the new copy on site."}
      </span>
    </div>
  );
}
