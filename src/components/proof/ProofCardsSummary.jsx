import React from "react";
import { Users, Package, FileText, Target } from "lucide-react";
import { vehicleLabel } from "@/lib/proofVehicle";

// بطاقات العميل كما تظهر في التقرير المُصدَر: العقد، عدد الموظفين الداخلين، والمواد.
export default function ProofCardsSummary({ cards = [], ar }) {
  if (!cards.length) return null;
  const totalCrew = cards.reduce((sum, card) => sum + (card.crew?.length || 0), 0);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{ar ? "بيانات العقد والعمالة" : "Contract & workforce"}</p>
        {totalCrew > 0 && (
          <p className="inline-flex items-center gap-1.5 text-xs text-foreground font-body">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            {ar ? `إجمالي الموظفين الداخلين: ${totalCrew}` : `Total employees entered: ${totalCrew}`}
          </p>
        )}
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {cards.map((card, index) => (
          <article key={card.id || index} className="space-y-1.5 rounded-xl border border-border bg-card p-4 text-card-foreground">
            <p className="text-sm font-semibold">{card.companyName || card.clientName}</p>
            <p className="text-xs text-muted-foreground font-body">
              {card.projectName || ""}
              {card.contractNumber ? ` · ${ar ? "عقد" : "contract"} ${card.contractNumber}` : ""}
            </p>
            {card.purpose && (
              <p className="inline-flex items-center gap-1.5 text-xs font-body">
                <Target className="h-3 w-3 text-muted-foreground" /> {ar ? "الغرض من الدخول:" : "Purpose of entry:"} {card.purpose}
              </p>
            )}
            {card.crew?.length > 0 && (
              <div className="space-y-1 rounded border border-dashed border-border bg-muted/30 p-2 text-[11px] font-body">
                <p className="inline-flex items-center gap-1 text-muted-foreground">
                  <Users className="h-3 w-3" /> {ar ? `الموظفون الذين دخلوا (${card.crew.length})` : `Employees entered (${card.crew.length})`}
                </p>
                {card.crew.map((crew, crewIndex) => (
                  <p key={crew.id || crewIndex}>
                    {crew.name}
                    {crew.idNumber ? ` · ${crew.idNumber}` : ""}
                    {(crew.vehicles?.length ? crew.vehicles : []).map((vehicle) => ` · ${vehicleLabel(vehicle)}`).join("")}
                  </p>
                ))}
              </div>
            )}
            {card.notes && <p className="text-xs font-body">{card.notes}</p>}
            {card.materials && (
              <p className="whitespace-pre-line rounded border border-dashed border-border bg-muted/30 p-2 text-[11px] font-body">
                <span className="inline-flex items-center gap-1 text-muted-foreground"><Package className="h-3 w-3" /> {ar ? "المواد المصروفة" : "Materials issued"}</span>
                {"\n"}{card.materials}
              </p>
            )}
            {card.beforeFiles?.length > 0 && (
              <div className="space-y-1 rounded border border-dashed border-border bg-muted/30 p-2 text-[11px] font-body">
                <p className="text-muted-foreground">{ar ? "صور قبل العمل" : "Before photos"}</p>
                <div className="flex flex-wrap gap-1.5">
                  {card.beforeFiles.map((file) => (
                    <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-0.5 hover:bg-muted">
                      <FileText className="h-3 w-3" /> {file.name}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {card.completion && (
              <div className="space-y-1 rounded border border-[var(--nv-line)] bg-[var(--nv-soft)] p-2 text-[11px] font-body">
                <p className="text-[var(--nv-ok-ink)]">
                  {ar ? `إثبات إنهاء العمل — اعتماد: ${card.completion.approvedByName}` : `Completion proof — approved by: ${card.completion.approvedByName}`}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {card.completion.files.map((file) => (
                    <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-0.5 hover:bg-muted">
                      <FileText className="h-3 w-3" /> {file.name}
                    </a>
                  ))}
                </div>
              </div>
            )}
            {card.files?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {card.files.map((file) => (
                  <a key={file.url} href={file.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-border px-2 py-0.5 text-[11px] font-body hover:bg-muted">
                    <FileText className="h-3 w-3" /> {file.name}
                  </a>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}