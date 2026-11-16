/**
 * الطبقة ٢ — الوسيط لكيانات المنصة: باقات الاشتراك، حسابات الشركات، تقييمات
 * المنتج. هذه كيانات منصة لا بيانات شركة، فلا تمرّ بـ facts ولا بـ updateCompany.
 *
 * قبل هذا الملف كانت ست واجهات تنادي base44.entities مباشرة، فتتخطى الوسيط
 * ومنطق العمل وطبقة البيانات دفعةً واحدة. وكان شكل الاستعلام مكرَّراً في موضعين
 * لكل كيان — CompanyAccount.list("-created_date", 500) في لوحة التدقيق ولوحة
 * التقييمات، و SubscriptionPlan.list("sortOrder", 50) في صفحة الأسعار وإدارة
 * الباقات — فأي تغيير في الترتيب أو الحدّ يسهو عن أحد الموضعين بلا أن يشتكي
 * أحد. الترتيب والحدّ هنا مرة واحدة، والواجهة تطلب بالاسم لا بشكل الاستعلام.
 */

import { base44 } from "@/api/base44Client";

// حدود القراءة: كانت مبثوثة في الواجهات كأرقام عارية.
const ACCOUNT_LIMIT = 500;
const PLAN_LIMIT = 50;
const FEEDBACK_LIMIT = 500;

/* --------------------------- حسابات الشركات --------------------------- */

export function listCompanyAccounts() {
  return base44.entities.CompanyAccount.list("-created_date", ACCOUNT_LIMIT);
}

/* -------------------------- باقات الاشتراك --------------------------- */

export function listSubscriptionPlans() {
  return base44.entities.SubscriptionPlan.list("sortOrder", PLAN_LIMIT);
}

export function createSubscriptionPlan(plan) {
  return base44.entities.SubscriptionPlan.create(plan);
}

export function updateSubscriptionPlan(id, patch) {
  return base44.entities.SubscriptionPlan.update(id, patch);
}

export function deleteSubscriptionPlan(id) {
  return base44.entities.SubscriptionPlan.delete(id);
}

/* --------------------------- تقييمات المنتج --------------------------- */

export function listProductFeedback() {
  return base44.entities.ProductFeedback.list("-created_date", FEEDBACK_LIMIT);
}

export function submitProductFeedback(feedback) {
  return base44.entities.ProductFeedback.create(feedback);
}
