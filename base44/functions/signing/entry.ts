import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { authPowerCareSession } from "../../shared/powerCareSession.ts";
import {
  checkRaiseGate,
  checkSendSignedGate,
  checkSignGate,
  checkSignIntentGate,
  checkVerifySealGate,
  deriveSigningStats,
  enrichSigningDoc,
  fingerprintFor,
  sealIdFor,
  type SigningDocLike,
  type SignerLike,
} from "../../shared/signingDerivations.ts";

/**
 * do-not-invoke-from-frontend — live envelopes are SignatureRequest via multiSign.
 * Do not write `signingChain`. Leftover callers should invoke multiSign.
 */
const SIGNING_CATEGORY = "signatureRequests";
const SIGNING_LEGACY_CATEGORY = "signingChain"; // do-not-write

function requireCompanyId(companyId: unknown) {
  const id = typeof companyId === "string" ? companyId.trim() : "";
  if (!id) return null;
  return id;
}

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const action = String(body.action || "");
    const companyId = requireCompanyId(body.companyId);
    if (!companyId) {
      return Response.json({ error: "Missing companyId — record without tenant is rejected" }, { status: 400 });
    }

    const sessionAuth = await authPowerCareSession(base44, companyId, body.sessionToken);
    if (!sessionAuth) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const auth = {
      companyId,
      userId: sessionAuth.userId || null,
      name: sessionAuth.name || "User",
      role: sessionAuth.role || "employee",
      owner: !!sessionAuth.owner || sessionAuth.role === "owner" || sessionAuth.admin,
      admin: !!sessionAuth.admin,
    };

    const loadBlob = async () => {
      const rows = await base44.asServiceRole.entities.CompanyDataBlob.filter({
        companyId: auth.companyId,
        category: SIGNING_LEGACY_CATEGORY,
      });
      return rows[0] || null;
    };

    const loadDocs = async (): Promise<SigningDocLike[]> => {
      const blob = await loadBlob();
      const payload = Array.isArray(blob?.payload) ? blob.payload : [];
      return payload.filter((d: SigningDocLike & { companyId?: string }) => d && d.companyId === auth.companyId && d.docKey);
    };

    const saveDocs = async (_docs: SigningDocLike[]) => {
      // do-not-write signingChain. Canonical store is the SignatureRequest entity (multiSign).
    };

    const audit = async (actionKey: string, details: string, extra: Record<string, unknown> = {}) => {
      await base44.asServiceRole.entities.AuditLog.create({
        companyId: auth.companyId,
        action: actionKey,
        performedBy: auth.name,
        details,
        reason: extra.reason || null,
        oldValue: extra.oldValue || null,
        newValue: extra.newValue || null,
      });
    };

    const enrichAll = (docs: SigningDocLike[]) => ({
      ok: true,
      docs: docs.map((d) => enrichSigningDoc(d, auth.userId)),
      stats: deriveSigningStats(docs, auth.userId),
    });

    if (action === "list") {
      const docs = await loadDocs();
      return Response.json(enrichAll(docs));
    }

    if (action === "raise") {
      const gate = checkRaiseGate(body);
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
      }
      const docs = await loadDocs();
      const sourceRef = String(body.sourceRef).trim();
      const existing = docs.find((d) => d.source === gate.source && d.sourceRef === sourceRef);
      if (existing) {
        return Response.json({ ok: true, doc: enrichSigningDoc(existing, auth.userId), ...enrichAll(docs), duplicate: true });
      }
      const rawSigners: SignerLike[] = Array.isArray(body.signers) ? body.signers : [];
      const signers = rawSigners.map((s, i) => ({
        sid: String(s.sid || `s${i + 1}`),
        name: String(s.name || "").trim() || `Signer ${i + 1}`,
        userId: s.userId || null,
        signedAt: null,
        sealId: null,
        fingerprint: null,
      }));
      const doc: SigningDocLike & { companyId: string } = {
        companyId: auth.companyId,
        id: uid("sig"),
        docKey: String(body.docKey || `${gate.source}:${sourceRef}`),
        title: String(body.title).trim(),
        purpose: String(body.purpose || "").trim() || null,
        source: gate.source,
        sourceRef,
        contentHash: String(body.contentHash || sourceRef),
        signers,
        sentAt: null,
        createdAt: new Date().toISOString(),
        raisedByName: auth.name,
        raisedByRole: auth.role,
      };
      docs.unshift(doc);
      await saveDocs(docs);
      await audit("signing.raise", `Raised signing doc ${doc.docKey} from ${gate.source}:${sourceRef}`);
      return Response.json({ ok: true, doc: enrichSigningDoc(doc, auth.userId), ...enrichAll(docs) });
    }

    if (action === "sign") {
      const docKey = String(body.docKey || body.id || "");
      const docs = await loadDocs();
      const idx = docs.findIndex((d) => d.docKey === docKey || d.id === docKey);
      if (idx < 0) {
        return Response.json({ error: "DOC_NOT_FOUND", reason: "مستند التوقيع غير موجود." }, { status: 404 });
      }
      const doc = docs[idx];
      const intentGate = checkSignIntentGate(body.intent);
      if (!intentGate.ok) {
        return Response.json({ error: intentGate.error, reason: intentGate.reason, reasonEn: intentGate.reasonEn }, { status: 400 });
      }
      const gate = checkSignGate(doc, {
        sid: body.sid || null,
        userId: body.userId || auth.userId,
      });
      if (!gate.ok) {
        return Response.json({
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
          headSid: "headSid" in gate ? gate.headSid : undefined,
          headName: "headName" in gate ? gate.headName : undefined,
        }, { status: 400 });
      }
      const signedAt = String(body.signedAt || new Date().toISOString());
      const signer = { ...gate.signer };
      const sealId = sealIdFor(doc, signer, signedAt);
      const fingerprint = fingerprintFor(doc, signer, signedAt);
      const signers = [...(doc.signers || [])];
      signers[gate.headIndex] = {
        ...signer,
        signedAt,
        sealId,
        fingerprint,
        name: auth.name || signer.name,
        userId: signer.userId || auth.userId,
        signerTitle: String(body.signerTitle || auth.role || "").trim() || null,
        signerCompany: String(body.signerCompany || "").trim() || null,
        intentAt: signedAt,
      };
      docs[idx] = { ...doc, signers };
      await saveDocs(docs);
      await audit("signing.sign", `Signed ${doc.docKey} as ${signers[gate.headIndex].sid}`, { newValue: sealId });
      return Response.json({
        ok: true,
        sealId,
        fingerprint,
        doc: enrichSigningDoc(docs[idx], auth.userId),
        ...enrichAll(docs),
      });
    }

    if (action === "verify") {
      const docKey = String(body.docKey || "");
      const sid = String(body.sid || "");
      const docs = await loadDocs();
      const doc = docs.find((d) => d.docKey === docKey || d.id === docKey);
      const gate = checkVerifySealGate(doc, sid);
      if (!gate.ok) {
        return Response.json({
          error: gate.error,
          reason: gate.reason,
          reasonEn: gate.reasonEn,
          expectedId: "expectedId" in gate ? gate.expectedId : undefined,
        }, { status: 400 });
      }
      return Response.json({ ok: true, verified: true, sealId: gate.sealId, fingerprint: gate.fingerprint });
    }

    if (action === "send") {
      const docKey = String(body.docKey || "");
      const docs = await loadDocs();
      const idx = docs.findIndex((d) => d.docKey === docKey || d.id === docKey);
      if (idx < 0) return Response.json({ error: "DOC_NOT_FOUND" }, { status: 404 });
      const gate = checkSendSignedGate(docs[idx]);
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn }, { status: 400 });
      }
      docs[idx] = { ...docs[idx], sentAt: new Date().toISOString() };
      await saveDocs(docs);
      await audit("signing.send", `Sent sealed copy of ${docs[idx].docKey}`);
      return Response.json({ ok: true, doc: enrichSigningDoc(docs[idx], auth.userId), ...enrichAll(docs) });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return Response.json({ error: String((err as Error)?.message || err) }, { status: 500 });
  }
});
