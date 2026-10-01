import React from "react";
import IdentityCard from "@/components/shared/IdentityCard";
import PublicPaperShell, { legalCopy } from "@/components/shared/PublicPaperShell";

export default function Privacy() {
  return (
    <PublicPaperShell>
      <IdentityCard title="سياسة الخصوصية — Privacy Policy" dir="rtl" bodySurface>
        <div style={legalCopy.wrap}>
          <p style={{ margin: 0 }}>آخر تحديث: 27 يوليو 2026</p>
          <h2 style={legalCopy.h2}>البيانات التي نجمعها</h2>
          <p style={{ margin: 0 }}>تجمع منصة NiroVera البيانات اللازمة لتشغيل الخدمة فقط: بيانات حساب الشركة (الاسم والبريد الإلكتروني)، بيانات الموظفين المُدخلة من قِبل الشركة، وسجلات الحضور والمهام والتقارير. عند استخدام تسجيل الدخول عبر Google أو Microsoft أو Apple، نحصل فقط على معلومات الحساب الأساسية التي يتيحها مزود الخدمة، مثل البريد الإلكتروني والاسم، للتحقق من هويتك وإنشاء جلسة الدخول. لا نحصل على كلمة مرور حسابك لدى أي من هذه الخدمات.</p>
          <h2 style={legalCopy.h2}>كيف نستخدم البيانات</h2>
          <p style={{ margin: 0 }}>تُستخدم البيانات حصريًا لتقديم خدمات المنصة لشركتك: إدارة الموظفين، الحضور، المهام والتقارير. لا نبيع بياناتك ولا نشاركها مع أي طرف ثالث لأغراض تسويقية.</p>
          <h2 style={legalCopy.h2}>حماية البيانات</h2>
          <p style={{ margin: 0 }}>تُخزن كلمات المرور بصيغة مشفّرة غير قابلة للاسترجاع، وتُعزل بيانات كل شركة عن غيرها بالكامل. يقتصر الوصول إلى بيانات الشركة على مستخدميها المصرح لهم.</p>
          <h2 style={legalCopy.h2}>حقوقك</h2>
          <p style={{ margin: 0 }}>بيانات الشركة والموظفين تبقى محفوظة وسرية داخل المنصة؛ لا يُحذف حساب الشركة من داخل التطبيق، ولا يُحذف ملف الموظف — إنهاء العلاقة يكون بإنهاء الخدمة أو الاستقالة وفق نظام العمل. للاستفسارات تواصل معنا عبر: niyar@powercares.pro</p>
          <hr style={legalCopy.hr} />
          <p style={legalCopy.en}>NiroVera collects only the data required to operate the service (company account, employee records, attendance, tasks and reports). When you sign in with Google, Microsoft, or Apple, we receive only the basic account information made available by the provider, such as your email and name, for identity verification and session creation. We never receive your password for these services, and we never sell or share your data with third parties. Company and employee data remain stored and confidential; the company account cannot be deleted in-app, and employee files are not deleted — employment ends by termination or resignation under the Labour Law. Contact: niyar@powercares.pro</p>
        </div>
      </IdentityCard>
    </PublicPaperShell>
  );
}
