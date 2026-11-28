import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { enterLocalPreview, isBase44BackendConfigured, LOCAL_PREVIEW_OWNER_ID, openApp } from "@/lib/localPreview";
import PlatformBoot from "@/components/shared/PlatformBoot";

/**
 * باب مالك المنصة: /admin يفتح لوحة المالك مباشرة.
 * مع خادم Base44 يمرّ عبر /owner (حارسها يطلب الدخول وصلاحية admin)،
 * ومحليًا يفتح جلسة مالك المنصة في المعاينة ثم يذهب إلى /owner.
 */
export default function AdminEntry() {
  const backend = isBase44BackendConfigured();
  const [error, setError] = useState("");

  useEffect(() => {
    if (backend) return;
    try {
      enterLocalPreview({ userId: LOCAL_PREVIEW_OWNER_ID });
      openApp("/owner");
    } catch (err) {
      console.error(err);
      setError(err?.message || "admin_entry_failed");
    }
  }, [backend]);

  if (backend) return <Navigate to="/owner" replace />;

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="font-heading text-xl">تعذّر فتح لوحة مالك المنصة</p>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  return <PlatformBoot variant="full" />;
}
