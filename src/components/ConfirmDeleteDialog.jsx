import React from "react";
import { useI18n } from "@/lib/i18n";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export default function ConfirmDeleteDialog({ trigger, onConfirm, title, description, confirmLabel, cancelLabel, danger = true, dir }) {
  const { t } = useI18n();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent dir={dir}>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-heading">{title || t("confirmDelete")}</AlertDialogTitle>
          <AlertDialogDescription className="font-body">
            {description || t("confirmDeleteDesc")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="font-body">{cancelLabel || t("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={danger
              ? "font-body bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : "font-body"}
          >
            {confirmLabel || t("delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}