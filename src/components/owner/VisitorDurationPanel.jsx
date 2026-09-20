import React from "react";
import { Clock3 } from "lucide-react";

const duration = (seconds, ar) => {
  const value = Math.max(0, Number(seconds) || 0);
  if (value < 60) return `${Math.round(value)} ${ar ? "ث" : "sec"}`;
  const minutes = Math.floor(value / 60);
  const rest = Math.round(value % 60);
  return `${minutes} ${ar ? "د" : "min"}${rest ? ` ${rest} ${ar ? "ث" : "sec"}` : ""}`;
};

export default function VisitorDurationPanel({ stats, ar }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs text-[#5A6B85]">
          <Clock3 className="h-3.5 w-3.5" />
          {ar ? "مدة الزيارات" : "Visit duration"}
        </p>
        <p className="text-xs font-semibold text-[#14284B]">
          {ar ? "المتوسط" : "Average"}: {duration(stats.averageVisitSeconds, ar)}
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-[#E2E8F0]">
        <table className="w-full min-w-[520px] text-xs">
          <thead className="bg-[#F7F8FA] text-[#5A6B85]">
            <tr>
              <th className="px-3 py-2 text-start">{ar ? "التاريخ" : "Date"}</th>
              <th className="px-3 py-2 text-start">{ar ? "الدولة" : "Country"}</th>
              <th className="px-3 py-2 text-start">{ar ? "الجهاز" : "Device"}</th>
              <th className="px-3 py-2 text-end">{ar ? "المدة" : "Duration"}</th>
            </tr>
          </thead>
          <tbody>
            {stats.recentVisits?.map((visit) => (
              <tr key={visit.id} className="border-t border-[#E2E8F0] text-[#14284B]">
                <td className="px-3 py-2">{new Date(visit.createdAt).toLocaleString(ar ? "ar-SA-u-ca-gregory-nu-latn" : "en-GB")}</td>
                <td className="px-3 py-2">
                  {visit.country || (ar ? "غير معروف" : "Unknown")}
                  {visit.city ? ` — ${visit.city}` : ""}
                </td>
                <td className="px-3 py-2">{visit.device || "—"}</td>
                <td className="px-3 py-2 text-end font-semibold">{duration(visit.durationSeconds, ar)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
