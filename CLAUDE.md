# CLAUDE.md — PowerCare / NiroVera

## What this product is

**NiroVera** is the HR operating product. **PowerCare** is the care/company layer around it (sessions, ownership, packaging, trust). Treat them as one connected system, not two competing brands.

Core idea: HR that does not only *record* work — it **proves** work was done.

### The Proof Cycle (never break this chain)

1. **Attendance** — person + place + time  
2. **Task** — effort weight, field gate, evidence, employee attestation  
3. **Review** — approve / reject with written reason, audit trail  
4. **Escalation** — auto-escalate when time quota is burned without progress  
5. **Sign / stamp** — Secure Sign + heritage fingerprint  
6. **Client proof** — disclose only allowed fields, hash, public verify link  

If a change severs this chain, it is the wrong change.

## Claude design principles (ideas, not a visual clone)

Apply these as product UX rules — calm, clear, connected:

1. **One job per surface** — dashboard decides; forms capture; proofs verify.  
2. **Typography and hierarchy first** — calm density, readable Arabic, no noisy chrome.  
3. **One restrained accent** — status color is meaning, not decoration.  
4. **Connected language** — copy should show how modules feed each other (attendance → payroll, task → proof).  
5. **Whitespace as trust** — prefer clarity over packing widgets.  
6. **Do not fake Claude’s cream/terracotta skin** — keep NiroVera/PowerCare identity; borrow *thinking*, not palette cosplay.

## Working rules

- Follow `AGENTS.md` for Base44 workflow.  
- Prefer `npm run dev` for frontend-only; `base44 dev` when backend is needed.  
- Reuse existing pages under `src/pages/` and libs under `src/lib/` before inventing parallel modules.  
- Preserve RTL Arabic-first behavior and role/plan visibility (`navVisibility`, auth gates).  
- Never commit secrets from `.env.local`.
- Company data is one blob per `companyId`, written only through `updateCompany`. It is read in three named passes: `src/lib/data/companyMigrations.js` (one-time, versioned by `schemaVersion`, append-only), `src/lib/data/companyInvariants.js` (rules kept true on every read), `src/lib/preview/previewUpkeep.js` (demo seeds, preview only). A legacy-shape fix is a migration; a rule new records must also satisfy is an invariant; nothing demo-only goes anywhere else.

### Design — live platform only

The visual source of truth is the running app (`/app` via `src/pages/` and `src/components/Layout.jsx`). Do not add parallel HTML mockups or restore deleted screens.

1. **Start with the server, not a second UI.** Schema, auth, `companyId` isolation, and named derivation gates live under `base44/`.
2. Recreate with Base44 entities/functions + existing React patterns.
3. Gates must name their blocking reason. On-screen figures are **derived**, not hard-coded.

## Priority surfaces

| Surface | Intent |
| --- | --- |
| `Landing.jsx` | Explain Proof Cycle + trust for buyers |
| `Dashboard.jsx` | Decision glance across people/care/ops/trust |
| `Operations.jsx` | Proof cycle in daily work |
| `Attendance.jsx` | Live attendance feeding later payroll/tasks |
| `FileSigning.jsx` / `WorkProof.jsx` | Trust closure of the cycle |
| `Assistant.jsx` | Ask enterprise data in Arabic within permissions | |

When unsure, optimize for: **connected proof, Saudi-ready HR, quiet confident UI.**
