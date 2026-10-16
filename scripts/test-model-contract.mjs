import assert from "node:assert/strict";
// Model regulation Art. 11 — the return ticket at the end of service: derived from nationality and the
// exit, gating the close-out, read in the contract panel; the server twin answers the same.
import * as fe from "../src/lib/returnTicket.js";
import * as be from "../base44/shared/returnTicket.ts";
import { checkCompleteOffboardingGate } from "../src/lib/offboardingDerivations.js";
import { checkCompleteOffboardingGate as beComplete } from "../base44/shared/offboardingDerivations.ts";
import { contractMinistryRows } from "../src/lib/contractMinistryRows.js";

let n = 0;
const ok = (name, fn) => { fn(); n += 1; console.log(`✓ ${name}`); };

const expat = (exit = {}) => ({ id: "e2", profile: { nationality: "هندي", nationalId: "2123456789", contractExit: { reason: "contract_end", serviceCertificateIssued: true, documentsReturned: true, ...exit } } });
const saudi = { id: "e3", profile: { nationality: "سعودي", nationalId: "1123456789", contractExit: { reason: "contract_end" } } };

ok("model 11: owed for a leaving non-Saudi; not for a Saudi; pending before the exit", () => {
  assert.equal(fe.deriveReturnTicket(expat()).state, "owed");
  assert.equal(fe.deriveReturnTicket(saudi).state, "na");
  assert.equal(fe.deriveReturnTicket({ profile: { nationality: "مصري" } }).state, "pending");
  assert.equal(fe.deriveReturnTicket(expat({ returnTicket: { providedAt: "2026-10-16" } })).state, "provided");
  assert.equal(fe.deriveReturnTicket(expat({ returnTicket: { exception: "deported", note: "قرار ترحيل" } })).state, "excepted");
});

ok("model 11(4): the exception matches the exit and names its basis", () => {
  assert.equal(fe.checkReturnTicketExceptionGate({ exception: "deported", note: "قرار ترحيل رقم 12", exitReason: "contract_end" }).error, "RETURN_EXCEPTION_MISMATCH");
  assert.equal(fe.checkReturnTicketExceptionGate({ exception: "own_wish", note: "x", exitReason: "resignation" }).error, "RETURN_EXCEPTION_NOTE");
  assert.equal(fe.checkReturnTicketExceptionGate({ exception: "probation_unfit", note: "محضر تقييم التجربة", exitReason: "contract_end" }).ok, true);
});

ok("the exit file does not close while the ticket is owed — client and server", () => {
  const caseRow = { status: "in_progress", assets: [{ id: "a", name: "حاسب", returnedAt: "2026-10-10" }] };
  const owed = checkCompleteOffboardingGate(caseRow, { employee: expat(), contractExit: expat().profile.contractExit, today: "2026-10-16" });
  assert.equal(owed.error, "RETURN_TICKET_OWED");
  assert.match(owed.reason, /النموذج الموحد م11\/3/);
  const done = expat({ returnTicket: { providedAt: "2026-10-16" } });
  assert.equal(checkCompleteOffboardingGate(caseRow, { employee: done, contractExit: done.profile.contractExit, today: "2026-10-16" }).ok, true);
  assert.equal(beComplete(caseRow, { employee: expat(), contractExit: expat().profile.contractExit, today: "2026-10-16" }).error, "RETURN_TICKET_OWED");
});

ok("contract panel row reads the same state", () => {
  const row = (e) => contractMinistryRows(e, { today: "2026-10-16", ar: true }).find((r) => r.key === "model-11");
  assert.equal(row(expat()).status, "alert");
  assert.equal(row(saudi).status, "void");
  assert.equal(row(expat({ returnTicket: { providedAt: "2026-10-16" } })).status, "settled");
});

ok("server twin parity", () => {
  for (const e of [expat(), saudi, expat({ returnTicket: { providedAt: "2026-10-01" } }), { profile: {} }]) {
    assert.equal(be.deriveReturnTicket(e).state, fe.deriveReturnTicket(e).state);
    assert.deepEqual(be.checkReturnTicketGate(e), fe.checkReturnTicketGate(e));
  }
});

console.log(`model contract: ${n} checks passed`);
