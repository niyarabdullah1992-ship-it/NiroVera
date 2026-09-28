import React, { useEffect, useState } from "react";
import { useAuth } from "@/lib/PowerCareAuth";
import { toast } from "@/components/ui/use-toast";
import { identityFrame } from "@/components/shared/IdentityCard";
import {
  BTN_FILL,
  CONTROL_RADIUS,
  DANGER,
  INK,
  MUTED,
  field,
} from "@/lib/platformStyles";
import {
  PLATFORM_LOGIN_EMPTY,
  addPlatformLoginIdentity,
  canManagePlatformLoginMail,
  parseLoginIdentity,
  platformLoginCountLabel,
  platformLoginRows,
  removePlatformLoginIdentity,
} from "@/lib/platformLoginMail";

export default function PlatformLoginMailCard({ lang = "ar" }) {
  const ar = lang === "ar";
  const { company, data, currentUser, refresh } = useAuth();
  const canManage = canManagePlatformLoginMail(currentUser, data);
  const [draft, setDraft] = useState("");
  const [rows, setRows] = useState(() => platformLoginRows(company?.id, data, company));

  useEffect(() => {
    setRows(platformLoginRows(company?.id, data, company));
  }, [company?.id, company?.allowedEmailDomain, data?.settings?.platformLoginIdentities]);

  if (!canManage) return null;

  const parsed = parseLoginIdentity(draft);
  const duplicate = parsed.ok && rows.some((row) => row.value === parsed.row.value);
  const canAdd = parsed.ok && !duplicate;

  const add = () => {
    if (!company?.id || !canAdd) return;
    const result = addPlatformLoginIdentity(company.id, draft, data, company);
    if (!result.ok) {
      toast({
        description: ar
          ? (result.error === "duplicate" ? "هذا المعرّف مضاف مسبقاً." : "اكتب بريداً صحيحاً أو نطاقاً يبدأ بـ @.")
          : (result.error === "duplicate" ? "That identity is already listed." : "Enter a valid email or a domain starting with @."),
        variant: "destructive",
      });
      return;
    }
    setRows(result.rows);
    setDraft("");
    refresh?.();
    toast({
      description: ar
        ? "حُفظ بريد الدخول على سجل الشركة. الجلسة الحالية كما هي."
        : "Login mail saved on the company record. This session stays signed in.",
    });
  };

  const remove = (value) => {
    if (!company?.id) return;
    const result = removePlatformLoginIdentity(company.id, value, data, company);
    if (!result.ok) return;
    setRows(result.rows);
    refresh?.();
    toast({
      description: ar ? "حُذف المعرّف من سجل الشركة. الجلسة الحالية كما هي." : "Identity removed from the company record. This session stays signed in.",
    });
  };

  return (
    <section
      data-nv="platform-login-mail"
      aria-label={ar ? "بريد الدخول إلى المنصة" : "Platform login mail"}
      style={{ ...identityFrame, borderRadius: 12, padding: "16px 18px", gap: 12, boxShadow: "0 1px 2px rgba(12,20,16,.04)" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
        <strong style={{ fontSize: 14, color: INK }}>{ar ? "بريد الدخول إلى المنصة" : "Platform login mail"}</strong>
        <span style={{ fontSize: 11.5, color: MUTED }}>{platformLoginCountLabel(rows)}</span>
      </div>
      <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.7 }}>
        {ar
          ? "بريد المنشأة للعرض والدعوات. النطاق يبدأ بـ @، والبريد لمن ليس على النطاق. الحفظ لا يبدّل بريد حسابك ولا يُخرج هذه الجلسة."
          : "Company mail for display and invites. A domain starts with @. Saving does not replace your account email or sign this session out."}
      </span>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.length === 0 ? (
          <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: MUTED, direction: "ltr" }}>{PLATFORM_LOGIN_EMPTY}</div>
        ) : rows.map((row) => (
          <div
            key={row.value}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 10px",
              border: "1px solid #EEF1EF",
              borderRadius: 9,
              background: "#FAFBFA",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 20,
                padding: "0 8px",
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 700,
                background: row.kind === "domain" ? "var(--nv-ok-soft, #E6F2EA)" : "#F2F5F3",
                color: row.kind === "domain" ? "var(--nv-ok-ink, #2F6B43)" : "#3A4048",
              }}
            >
              {row.kind === "domain" ? (ar ? "نطاق" : "Domain") : (ar ? "بريد" : "Email")}
            </span>
            <span style={{ font: "600 12.5px 'IBM Plex Mono', monospace", direction: "ltr", unicodeBidi: "isolate", color: INK }}>{row.value}</span>
            <span style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: MUTED, whiteSpace: "nowrap" }}>{row.via}</span>
            {row.locked ? null : (
              <button
                type="button"
                onClick={() => remove(row.value)}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  fontSize: 12,
                  color: DANGER,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontFamily: "inherit",
                }}
              >
                {ar ? "حذف" : "Remove"}
              </button>
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              add();
            }
          }}
          placeholder="name@company.sa أو @company.sa"
          aria-label={ar ? "بريد أو نطاق الدخول" : "Login email or domain"}
          autoComplete="off"
          inputMode="email"
          spellCheck={false}
          dir="ltr"
          style={{ ...field, direction: "ltr", textAlign: "left", borderRadius: CONTROL_RADIUS, fontFamily: "'IBM Plex Mono', monospace", height: 42 }}
        />
        <button
          type="button"
          onClick={add}
          disabled={!canAdd}
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 42,
            padding: "0 18px",
            borderRadius: CONTROL_RADIUS,
            border: "none",
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: "nowrap",
            fontFamily: "inherit",
            background: canAdd ? BTN_FILL : "#E4E9E6",
            color: canAdd ? "#fff" : MUTED,
            cursor: canAdd ? "pointer" : "not-allowed",
          }}
        >
          {ar ? "إضافة" : "Add"}
        </button>
      </div>
    </section>
  );
}
