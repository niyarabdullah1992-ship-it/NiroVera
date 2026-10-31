import React, { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PlanForm from "@/components/owner/PlanForm";
import PlanCard from "@/components/owner/PlanCard";
import { normalizePlanConfig } from "@/lib/subscriptionPlans";
import { OwnerSectionHead, ownerGateBanner, ownerPrimaryBtn, ownerStack } from "@/components/owner/ownerUi";

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
  // كان الحفظ والحذف والتبديل بلا مسك للفشل: يُرفض الطلب فلا يُقال شيء — يبقى النموذج
  // مفتوحاً كما هو، ولا يعرف المالك هل كُتبت الباقة أم لا. والباقة تحكم البوابات والفوترة،
  // فالصمت هنا أسوأ من الخطأ. البوابة بشكل {ok:false, reason, reasonEn} كما في بقية اللوحة.
  const [gate, setGate] = useState(null);
  const fail = (reason, reasonEn) => setGate({ ok: false, error: "PLAN_WRITE", reason, reasonEn });
  const load = () => base44.entities.SubscriptionPlan.list("sortOrder", 50)
    .then((items) => setPlans(items.map(normalizePlanConfig)))
    .catch(() => fail("تعذر تحميل الباقات.", "The plans could not be loaded."));
  useEffect(() => { load(); }, []);
  const save = async (event) => {
    event.preventDefault();
    setGate(null);
    const { id, created_date, updated_date, created_by_id, created_by, ...payload } = editing;
    try {
      if (id) await base44.entities.SubscriptionPlan.update(id, payload);
      else await base44.entities.SubscriptionPlan.create(payload);
    } catch {
      // النموذج يبقى مفتوحاً بما كتبه المالك: لا يُفقد ما كتب على فشل لم يُكتب.
      fail("تعذر حفظ الباقة — لم يُكتب شيء.", "The plan could not be saved — nothing was written.");
      return;
    }
    setEditing(null);
    load();
  };
  const remove = async (plan) => {
    if (!window.confirm(ar ? `حذف باقة ${plan.nameAr}؟` : `Delete ${plan.nameEn}?`)) return;
    setGate(null);
    try {
      await base44.entities.SubscriptionPlan.delete(plan.id);
    } catch {
      fail("تعذر حذف الباقة — ما زالت قائمة.", "The plan could not be deleted — it is still there.");
      return;
    }
    load();
  };
  const toggle = async (plan) => {
    setGate(null);
    try {
      await base44.entities.SubscriptionPlan.update(plan.id, { active: !plan.active });
    } catch {
      fail("تعذر تغيير حالة الباقة — بقيت على ما كانت.", "The plan's state could not be changed — it stayed as it was.");
      return;
    }
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
      {ownerGateBanner(gate, ar)}
      {editing ? <PlanForm value={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} ar={ar} /> : null}
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} ar={ar} onEdit={() => setEditing({ ...plan })} onToggle={() => toggle(plan)} onDelete={() => remove(plan)} />
        ))}
      </div>
    </div>
  );
}
