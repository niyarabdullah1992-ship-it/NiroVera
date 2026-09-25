import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PlanForm from "@/components/owner/PlanForm";
import PlanCard from "@/components/owner/PlanCard";
import { normalizePlanConfig } from "@/lib/subscriptionPlans";
import { OwnerSectionHead, ownerPrimaryBtn, ownerStack } from "@/components/owner/ownerUi";

const emptyPlan = normalizePlanConfig({
  slug: "",
  nameAr: "",
  nameEn: "",
  monthlyPrice: 0,
  yearlyPrice: 0,
  currency: "USD",
  featuresAr: [],
  featuresEn: [],
  active: true,
  freeNow: true,
  sortOrder: 99,
});

export default function PlanManagement({ ar }) {
  const [plans, setPlans] = useState([]);
  const [editing, setEditing] = useState(null);
  const load = () => base44.entities.SubscriptionPlan.list("sortOrder", 50).then((items) => setPlans(items.map(normalizePlanConfig)));
  useEffect(() => { load(); }, []);
  const save = async (event) => {
    event.preventDefault();
    const { id, created_date, updated_date, created_by_id, created_by, ...payload } = editing;
    if (id) await base44.entities.SubscriptionPlan.update(id, payload);
    else await base44.entities.SubscriptionPlan.create(payload);
    setEditing(null);
    load();
  };
  const remove = async (plan) => {
    if (!window.confirm(ar ? `حذف باقة ${plan.nameAr}؟` : `Delete ${plan.nameEn}?`)) return;
    await base44.entities.SubscriptionPlan.delete(plan.id);
    load();
  };
  const toggle = async (plan) => {
    await base44.entities.SubscriptionPlan.update(plan.id, { active: !plan.active });
    load();
  };

  return (
    <div style={ownerStack}>
      <OwnerSectionHead
        kicker={ar ? "كتالوج الاشتراكات" : "Subscription catalog"}
        title={ar ? "باقات NiroVera" : "NiroVera plans"}
        meta={(
          <button type="button" onClick={() => setEditing({ ...emptyPlan })} style={ownerPrimaryBtn()}>
            <Plus className="h-4 w-4" />
            {ar ? "إنشاء باقة" : "Create plan"}
          </button>
        )}
      />
      {editing ? <PlanForm value={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} ar={ar} /> : null}
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} ar={ar} onEdit={() => setEditing({ ...plan })} onToggle={() => toggle(plan)} onDelete={() => remove(plan)} />
        ))}
      </div>
    </div>
  );
}
