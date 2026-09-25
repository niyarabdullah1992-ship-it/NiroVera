import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ownerField } from "@/components/owner/ownerUi";

export default function OwnerConfirmActionDialog({
  open,
  onOpenChange,
  title,
  description,
  ar,
  requireReason = false,
  destructive = false,
  onConfirm,
}) {
  const [reason, setReason] = useState("");
  const confirm = async () => {
    await onConfirm(reason.trim());
    setReason("");
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent dir={ar ? "rtl" : "ltr"}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {requireReason ? (
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={ar ? "اكتب سبب الإجراء…" : "Enter the reason…"}
            style={{ ...ownerField(), minHeight: 96 }}
          />
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel>
          <AlertDialogAction
            disabled={requireReason && !reason.trim()}
            onClick={(event) => {
              event.preventDefault();
              confirm();
            }}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {ar ? "تأكيد" : "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
