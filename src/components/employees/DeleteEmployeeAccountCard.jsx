import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Loader2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { deleteEmployeeAccount } from "@/lib/store";
import ConfirmDeleteDialog from "@/components/ConfirmDeleteDialog";
import { MUTED, CARD } from "@/lib/platformStyles";

export default function DeleteEmployeeAccountCard({ employee, companyId }) {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const ar = lang === "ar";

  const remove = async () => {
    setDeleting(true); setError("");
    try {
      const ok = await deleteEmployeeAccount(companyId, employee.id);
      if (ok) navigate("/app/employees");
      else setError(ar ? "تعذر حذف الحساب." : "Account could not be deleted.");
    } catch {
      setError(ar ? "تعذر حذف الحساب." : "Account could not be deleted.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{
      borderRadius: "14px",
      border: "1px solid var(--nv-line)",
      background: CARD,
      padding: "16px 18px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    }}
    >
      <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", fontWeight: 600, color: "var(--nv-bad-ink)" }}>
        <Trash2 style={{ width: 16, height: 16 }} />
        {ar ? "حذف حساب الموظف" : "Delete employee account"}
      </h3>
      <p style={{ margin: 0, fontSize: "12px", color: MUTED, lineHeight: 1.65 }}>
        {ar
          ? "متاح لمالك الشركة ومسؤولي الموارد البشرية، ويوقف دخول الموظف نهائيًا."
          : "Available to the company owner and HR staff, and permanently revokes employee access."}
      </p>
      <ConfirmDeleteDialog
        onConfirm={remove}
        title={ar ? "حذف حساب الموظف؟" : "Delete employee account?"}
        description={ar ? "سيتم حذف الحساب وبيانات الدخول ولا يمكن التراجع." : "The account and login access will be deleted permanently."}
        trigger={(
          <button
            type="button"
            disabled={deleting}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              borderRadius: "9px",
              border: "1px solid var(--nv-bad-line)",
              background: CARD,
              color: "var(--nv-bad-ink)",
              fontSize: "13px",
              padding: "8px 12px",
              cursor: deleting ? "not-allowed" : "pointer",
              opacity: deleting ? 0.5 : 1,
              fontFamily: "inherit",
            }}
          >
            {deleting && <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />}
            {ar ? "حذف الحساب" : "Delete account"}
          </button>
        )}
      />
      {error && <p style={{ margin: 0, fontSize: "12px", color: "var(--nv-bad-ink)" }}>{error}</p>}
    </div>
  );
}
