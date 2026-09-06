# Labour Law in the product vs live government rails

NiroVera **applies** نظام العمل as dated operational rules inside attendance, leave, payroll, and HR.
It does **not** seek ministry product accreditation. A statutory chip (`المادة …`) appears only when the in-force rule has a Labour Law article.

Live rails for **Qiwa · GOSI · Mudad (WPS) · Nafath** are intentionally **not** wired for production calls.

## Current product state

| System | In-app today | Live API |
| --- | --- | --- |
| Qiwa | Establishment validation · wage match · hire/offboarding checklist | No |
| GOSI | Onboarding step · monthly file derivation + simulated send (`compliance.gosiMonthly`) | No |
| Mudad / WPS | File-ready rows (national ID · IBAN · net · Qiwa match) + simulated send | No |
| Nafath | Not implemented | No |

## Enablement checklist (human)

1. Obtain official sandboxes / production credentials for each channel.
2. Store secrets only in Base44 / server env — never in the client or git.
3. Replace `simulated: true` paths in `base44/functions/compliance/entry.ts` with signed outbound adapters.
4. Keep **named gates** (`QIWA_MISMATCH`, `GOSI_ESTABLISHMENT_REQUIRED`, …) — never silent failures.
5. Audit every outbound send with actor name + local timestamp.

## Adapter contract (future)

```ts
// Pseudo — do not invent credentials
type GovSendResult =
  | { ok: true; channel: "qiwa" | "gosi" | "mudad" | "nafath"; externalRef: string }
  | { ok: false; error: string; reason: string; reasonEn: string };
```

Until then, `compliance.overview.liveIntegrations` reports all channels as `false`.
