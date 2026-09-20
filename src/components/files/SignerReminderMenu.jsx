import React from "react";
import { BellRing, CheckCircle2, ChevronDown, Loader2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { signGhostBtn } from "@/components/files/signingUi";

export default function SignerReminderMenu({ requestId, signers, ar, busyKey, sentKey, onRemind }) {
  const pending = signers.filter((signer) => signer.status === "pending");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" style={signGhostBtn}>
          <BellRing className="h-3.5 w-3.5" />
          {ar ? `إرسال تذكير (${pending.length})` : `Send reminder (${pending.length})`}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={ar ? "start" : "end"} className="max-h-64 w-72 overflow-y-auto p-2">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{ar ? "اختر الموقّع المراد تذكيره" : "Choose a signer to remind"}</DropdownMenuLabel>
        {pending.map((signer) => {
          const key = `${requestId}:${signer.email}`;
          return <DropdownMenuItem key={signer.email} disabled={busyKey === key} onSelect={() => onRemind(signer)} className="min-h-11 cursor-pointer">
            {busyKey === key ? <Loader2 className="animate-spin" /> : sentKey === key ? <CheckCircle2 className="text-emerald-600" /> : <BellRing />}
            <span className="min-w-0"><span className="block truncate text-sm font-medium">{signer.name}</span><span dir="ltr" className="block truncate text-[10px] text-muted-foreground">{signer.email}</span></span>
          </DropdownMenuItem>;
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}