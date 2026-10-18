/**
 * The employment contract written from the unified model (Law Arts. 51–52 · Regs Art. 18 · model work
 * regulation Art. 6): two Arabic copies, one for each party; the content the model requires —
 *
 *   «اسم صاحب العمل ومكانه، واسم العامل وجنسيته، وما يلزم لإثبات شخصيته، وعنوان إقامته، والأجر المتفق
 *    عليه بما في ذلك المزايا والبدلات، ونوع العمل ومكانه، وتاريخ الالتحاق به، ومدة العقد إن كان محدد
 *    المدة، وحقوق كل طرف والتزاماته الأساسية» (المادة 52/1)
 *
 * plus the probation clause when agreed (Art. 53 · Regs Art. 19: stated expressly, ≤ 180 days, split only
 * into contiguous periods stated at signing), working hours (Art. 98) and annual leave (Art. 109), and the
 * worker's acknowledgement of the work regulation (model Art. 3(3)). Documenting on Qiwa stays a flag
 * (Regs Art. 18(2)). Pure builder + checks; printing goes through printSheet.
 */

import { ruleValue } from "./laborRules.js";

function dateOnly(v) {
  const s = String(v || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** The model's fields, read from the employee file, the company and the contract draft. */
export function contractModelFields({ employee = {}, company = {}, station = null, contract = {}, today } = {}) {
  const p = employee.profile || {};
  const type = contract.type || p.contractType || "indefinite";
  const start = dateOnly(contract.startDate || p.hireDate);
  const end = type === "fixed" ? dateOnly(contract.endDate || p.contractEndDate) : "";
  const day = dateOnly(today) || start || new Date().toISOString().slice(0, 10);
  const probation = Boolean(contract.probation ?? p.probation);
  const housing = num(p.housingAllowance);
  const transport = num(p.transportAllowance);
  const other = num(p.otherAllowances ?? p.allowances);
  return {
    employer: {
      name: String(company.legalName || company.name || "").trim(),
      place: String(company.address || company.city || company.headquarters || "").trim(),
      cr: String(company.crNumber || company.commercialRegister || "").trim(),
    },
    worker: {
      name: String(employee.name || "").trim(),
      nationality: String(employee.nationality || p.nationality || "").trim(),
      idNumber: String(employee.nationalId || p.nationalId || p.iqamaNumber || p.passportNumber || "").trim(),
      address: String(p.address || p.nationalAddress || employee.address || "").trim(),
      email: String(p.personalEmail || employee.email || "").trim(),
    },
    job: String(employee.position || p.position || p.jobTitle || "").trim(),
    place: String(contract.place || station?.name || p.workPlace || "").trim(),
    wage: { base: num(p.baseSalary), housing, transport, other, total: num(p.baseSalary) + housing + transport + other },
    type,
    start,
    end,
    probation: probation ? {
      days: num(contract.probationDays ?? p.probationDays),
      segments: contract.probationSegments ?? p.probationSegments ?? null,
    } : null,
    hours: { daily: num(p.dailyHours) || ruleValue("hours.shift.ordinaryHours", day), weekly: num(p.weeklyHours) || ruleValue("hours.week.ordinaryMaxHours", day) },
    annualLeave: num(p.leaveTotals?.annual) || ruleValue("leave.annual.days", day),
    regulationAck: true,
  };
}

/** Missing required content (Art. 52(1) · model Art. 6 · Art. 53). Empty list → it may be saved. */
export function checkContractRequiredContent(f = {}, ar = true) {
  const missing = [];
  const need = (ok, labelAr, labelEn) => { if (!ok) missing.push(ar ? labelAr : labelEn); };
  need(f.employer?.name, "اسم صاحب العمل", "employer's name");
  need(f.employer?.place, "مكان صاحب العمل (العنوان)", "employer's place");
  need(f.worker?.name, "اسم العامل", "worker's name");
  need(f.worker?.nationality, "جنسية العامل", "worker's nationality");
  need(f.worker?.idNumber, "ما يثبت شخصية العامل (رقم الهوية أو الإقامة)", "worker's ID number");
  need(f.worker?.address, "عنوان إقامة العامل", "worker's address");
  need(f.wage?.base > 0, "الأجر الأساسي المتفق عليه", "agreed basic wage");
  need(f.job, "نوع العمل (المسمى)", "type of work");
  need(f.place, "مكان العمل", "place of work");
  need(f.start, "تاريخ الالتحاق بالعمل", "start date");
  if (f.type === "fixed") need(f.end, "مدة العقد (تاريخ نهاية العقد المحدد المدة)", "fixed-term end date");
  if (f.probation) need(f.probation.days > 0, "مدة التجربة بعدد الأيام (المادة 53)", "probation length in days (Art. 53)");
  return missing;
}

/** Saving a contract: an uploaded signed PDF, or one generated from the model with its content complete. */
export function checkContractSaveGate({ fields, hasFile = false, generated = false, ar = true } = {}) {
  if (!hasFile && !generated) {
    return { ok: false, error: "CONTRACT_DOCUMENT_REQUIRED", reason: "أنشئ العقد من النموذج الموحد أو ارفع النسخة الموقعة PDF (المادتان 51–52).", reasonEn: "Generate the contract from the unified model or upload the signed PDF (Arts. 51–52)." };
  }
  if (generated) {
    const missing = checkContractRequiredContent(fields, ar);
    if (missing.length) {
      return { ok: false, error: "CONTRACT_CONTENT_MISSING", reason: `ينقص العقد ما يوجبه النموذج الموحد: ${missing.join("، ")} (المادة 52/1 · اللائحة م18).`, reasonEn: `The contract lacks what the unified model requires: ${missing.join(", ")} (Art. 52(1) · Regs Art. 18).`, missing };
    }
  }
  return { ok: true };
}

const money = (n) => `${Math.round(Number(n) || 0).toLocaleString("en-US")} ر.س`;

/** The contract as one printable sheet (printSheet shape). */
export function contractSheet(f, { ar = true, ref = "", company = "" } = {}) {
  const typeAr = f.type === "fixed" ? `محدد المدة من ${f.start} إلى ${f.end}` : f.type === "task" ? "لأداء عمل معين" : `غير محدد المدة، يبدأ في ${f.start}`;
  const probationAr = f.probation
    ? `يخضع العامل لفترة تجربة مدتها ${f.probation.days} يوماً${Array.isArray(f.probation.segments) && f.probation.segments.length > 1 ? ` مقسّمة إلى مدد متصلة: ${f.probation.segments.map((s) => `${s.from} – ${s.to}`).join("، ")}` : ""}، لا يدخل في حسابها إجازة عيدي الفطر والأضحى واليوم الوطني ويوم التأسيس والإجازة المرضية، ولكل طرف إنهاء العقد خلالها (المادة 53 · اللائحة م19).`
    : "لا يخضع العامل لفترة تجربة.";
  return {
    ar,
    kicker: "عقد عمل — النموذج الموحد (المادتان 51–52 · اللائحة م18)",
    title: "عقد عمل",
    subtitle: `${f.employer.name} — ${f.worker.name}`,
    ref,
    company,
    status: { label: f.type === "fixed" ? "محدد المدة" : "غير محدد المدة", tone: "ok" },
    facts: [
      { label: "الطرف الأول (صاحب العمل)", value: f.employer.name },
      { label: "مكانه", value: f.employer.place },
      { label: "السجل التجاري", value: f.employer.cr, mono: true },
      { label: "الطرف الثاني (العامل)", value: f.worker.name },
      { label: "الجنسية", value: f.worker.nationality },
      { label: "رقم الهوية / الإقامة", value: f.worker.idNumber, mono: true },
      { label: "عنوان الإقامة (المختار للتبليغ)", value: f.worker.address, wide: true },
      { label: "البريد الإلكتروني الشخصي", value: f.worker.email },
      { label: "نوع العمل (المسمى)", value: f.job },
      { label: "مكان العمل", value: f.place },
      { label: "تاريخ مباشرة العمل", value: f.start, mono: true },
      { label: "نوع العقد ومدته", value: typeAr, wide: true },
    ],
    blocks: [
      {
        type: "table",
        heading: "الأجر والمزايا والبدلات (المادة 52/1)",
        cols: ["البند", "شهرياً"],
        rows: [
          ["الأجر الأساسي", money(f.wage.base)],
          ["بدل السكن", money(f.wage.housing)],
          ["بدل النقل", money(f.wage.transport)],
          ["بدلات أخرى", money(f.wage.other)],
          ["الإجمالي", money(f.wage.total)],
        ],
      },
      { type: "text", heading: "فترة التجربة", body: probationAr },
      { type: "text", heading: "ساعات العمل والإجازات", body: `ساعات العمل ${f.hours.daily} ساعات يومياً و${f.hours.weekly} ساعة أسبوعياً، تُخفّض في رمضان للعمال المسلمين (المادة 98). الإجازة السنوية ${f.annualLeave} يوماً بأجر كامل، تزاد إلى ثلاثين بعد خمس سنوات متصلة (المادة 109). وللعامل الإجازات والعطل الرسمية المقررة في النظام.` },
      { type: "text", heading: "حقوق كل طرف والتزاماته الأساسية", body: "يلتزم صاحب العمل بالأجر في موعده عبر حماية الأجور، وبالمعاملة اللائقة وعدم التمييز (المادة 61)، وبوسائل السلامة (المادة 122)، وبالتأمين الصحي والاجتماعي. ويلتزم العامل بإنجاز العمل وفق أصول المهنة وتعليمات صاحب العمل المشروعة، والعناية بالعهد، وحسن السلوك، وحفظ الأسرار (المادة 65)." },
      { type: "text", heading: "لائحة تنظيم العمل", body: "اطّلع العامل على لائحة تنظيم العمل المعتمدة في المنشأة عند التعاقد، وتعد مكملة لهذا العقد فيما لا يتعارض مع حقوقه (النموذج الموحد م3)." },
      { type: "text", heading: "النسخ والتوثيق", body: "حُرّر هذا العقد من نسختين باللغة العربية، تسلم إحداهما للعامل وتودع الأخرى في ملف خدمته، ويوثق إلكترونياً عبر المنصة المعتمدة لدى الوزارة (قوى) — المادة 51 · اللائحة م18/2. والنص العربي هو المعتمد." },
    ],
    signatures: [
      { label: "الطرف الأول — صاحب العمل", name: f.employer.name },
      { label: "الطرف الثاني — العامل", name: f.worker.name },
    ],
    note: "نظام العمل الصادر بالمرسوم الملكي م/51 ولائحته التنفيذية هما المرجع عند الخلاف.",
  };
}

/** A stable text of the contract's terms — the worker's acknowledgement is tied to its hash. */
export function contractTermsText(f) {
  return JSON.stringify([f.employer?.name, f.worker?.name, f.worker?.idNumber, f.job, f.place, f.start, f.type, f.end, f.wage, f.probation, f.hours, f.annualLeave]);
}

/** The worker's acknowledgement (signature) of the generated contract. */
export function checkContractAckGate({ contract, employee, viewerId, ack } = {}) {
  if (!contract?.generated) return { ok: false, error: "CONTRACT_NOT_GENERATED", reason: "لا عقد مُنشأ من النموذج بانتظار توقيعك.", reasonEn: "No generated contract awaits your signature." };
  if (String(viewerId || "") !== String(employee?.id || "")) return { ok: false, error: "CONTRACT_ACK_SELF", reason: "يوقع العامل على عقده بنفسه.", reasonEn: "Only the worker signs their own contract." };
  if (!ack) return { ok: false, error: "CONTRACT_ACK_REQUIRED", reason: "أقرّ بأنك قرأت العقد ونسخة لائحة تنظيم العمل قبل التوقيع.", reasonEn: "Confirm you read the contract and the work regulation." };
  return { ok: true };
}
