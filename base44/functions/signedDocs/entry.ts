import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Document verification registry:
// - register: stores (verificationId, SHA-256 hash, signer, timestamp) for a freshly
//   signed document. A verificationId can only ever be bound to ONE file hash —
//   this makes reusing a signature badge on a different file impossible.
// - verify: given a file's SHA-256 hash, returns 'valid' (with signer details),
//   'tampered' (a known verificationId exists but the hash doesn't match), or 'unknown'.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const Docs = base44.asServiceRole.entities.SignedDocument;

    if (action === 'register') {
      // Registration is NOT public: only a logged-in user (owner/employee session
      // issued after email-verified login, or the platform builder) may register
      // a signature — and employees may only register as themselves.
      const platformUser = await base44.auth.me().catch(() => null);
      if (!platformUser || platformUser.role !== 'admin') {
        const sessionToken = String(body.sessionToken || '');
        const companyId = String(body.companyId || '');
        let session = null;
        if (sessionToken && companyId) {
          const sessions = await base44.asServiceRole.entities.CompanySession.filter({ token: sessionToken, companyId });
          const s = sessions[0];
          if (s && new Date(s.expiresAt).getTime() > Date.now()) session = s;
        }
        if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
        // Identity boundary: an employee session can only register its own signature.
        if (session.userId && String(body.signerId || '') !== session.userId) {
          return Response.json({ error: 'Forbidden' }, { status: 403 });
        }
      }
      const verificationId = String(body.verificationId || '').slice(0, 40);
      const fileHash = String(body.fileHash || '').toLowerCase().slice(0, 64);
      if (!verificationId || !/^[0-9a-f]{64}$/.test(fileHash)) {
        return Response.json({ error: 'verificationId and a valid SHA-256 fileHash are required' }, { status: 400 });
      }
      // Signature-reuse protection: one verification ID ↔ one file hash, forever.
      const existing = await Docs.filter({ verificationId });
      if (existing.length > 0) {
        console.error('signedDocs: reuse attempt for', verificationId);
        return Response.json({ error: 'SIGNATURE_REUSE' }, { status: 409 });
      }
      const rec = await Docs.create({
        verificationId,
        fileHash,
        signerName: String(body.signerName || '').slice(0, 120),
        signerId: String(body.signerId || '').slice(0, 64),
        companyId: String(body.companyId || '').slice(0, 64),
        fileName: String(body.fileName || '').slice(0, 200),
        signedAt: new Date().toISOString(),
      });
      return Response.json({ ok: true, id: rec.id });
    }

    if (action === 'lookup') {
      const verificationId = String(body.verificationId || '').slice(0, 40);
      if (!verificationId) return Response.json({ error: 'verificationId required' }, { status: 400 });
      const rows = await Docs.filter({ verificationId });
      if (rows.length === 0) return Response.json({ found: false });
      const r = rows[0];
      return Response.json({
        found: true,
        verificationId: r.verificationId,
        signerName: r.signerName,
        fileName: r.fileName,
        signedAt: r.signedAt || r.created_date,
      });
    }

    if (action === 'verify') {
      const fileHash = String(body.fileHash || '').toLowerCase().slice(0, 64);
      if (!/^[0-9a-f]{64}$/.test(fileHash)) {
        return Response.json({ error: 'A valid SHA-256 fileHash is required' }, { status: 400 });
      }
      const verificationId = String(body.verificationId || '').slice(0, 40);
      const publicOf = (r, extra = {}) => ({
        verificationId: r.verificationId || null,
        signerName: r.signerName || null,
        fileName: r.fileName || null,
        signedAt: r.signedAt || r.created_date || null,
        uploadedHash: fileHash,
        registryHash: r.fileHash || '',
        ...extra,
      });
      const byHash = await Docs.filter({ fileHash });
      const byId = verificationId ? await Docs.filter({ verificationId }) : [];
      if (byHash.length && byId.length && byHash[0].verificationId !== byId[0].verificationId) {
        return Response.json({ status: 'reuse', kind: 'reuse', ...publicOf(byId[0], { originalFileName: byId[0].fileName }) });
      }
      if (byHash.length > 0) {
        return Response.json({ status: 'valid', kind: 'ok', ...publicOf(byHash[0]) });
      }
      if (byId.length > 0) {
        return Response.json({ status: 'tampered', kind: 'modified', ...publicOf(byId[0]) });
      }
      const fileNameKey = (value) => String(value || '').toLowerCase().replace(/-signed(?=\.pdf$)/i, '').replace(/\.pdf$/i, '').replace(/[\s_\-]+/g, '');
      const requestHashes = (rec) => {
        const hashes = new Set();
        const sealed = String(rec?.finalHash || '').toLowerCase();
        if (sealed) hashes.add(sealed);
        (rec?.signers || []).forEach((row) => {
          const hash = String(row.documentHash || '').toLowerCase();
          if (/^[0-9a-f]{64}$/.test(hash)) hashes.add(hash);
        });
        return hashes;
      };
      const answerFromRequest = (rec) => {
        const now = Date.now();
        const open = (rec.signers || [])
          .filter((row) => row?.status === 'signed' && row.retractUntil && Date.parse(row.retractUntil) > now)
          .map((row) => Date.parse(row.retractUntil))
          .filter(Number.isFinite);
        const coolingUntil = open.length ? new Date(Math.max(...open)).toISOString() : null;
        const signed = (rec.signers || []).filter((row) => row.status === 'signed');
        const last = signed.slice().sort((a, b) => Date.parse(a.signedAt || 0) - Date.parse(b.signedAt || 0)).at(-1);
        const requestPublic = {
          verificationId: rec.verificationId || null,
          signerName: signed.map((row) => row.name).filter(Boolean).join('، ') || rec.creatorName || null,
          fileName: rec.fileName || null,
          signedAt: last?.signedAt || rec.lastActivityAt || rec.created_date || null,
          uploadedHash: fileHash,
        };
        if (coolingUntil && !rec.finalHash) {
          return { status: 'cooling', kind: 'cooling', coolingUntil, registryHash: '', ...requestPublic };
        }
        const sealed = String(rec.finalHash || last?.documentHash || '').toLowerCase();
        if (sealed && sealed === fileHash) {
          return { status: 'valid', kind: 'ok', registryHash: sealed, ...requestPublic };
        }
        if (requestHashes(rec).has(fileHash)) {
          return { status: 'valid', kind: 'ok', registryHash: fileHash, ...requestPublic };
        }
        if (sealed && sealed !== fileHash) {
          return { status: 'tampered', kind: 'modified', registryHash: sealed, ...requestPublic };
        }
        return null;
      };
      try {
        const Requests = base44.asServiceRole.entities.SignatureRequest;
        const byVerify = verificationId ? await Requests.filter({ verificationId }) : [];
        if (byVerify[0]) {
          const fromId = answerFromRequest(byVerify[0]);
          if (fromId) return Response.json(fromId);
        }
        const companyId = String(body.companyId || '').trim();
        const sessionToken = String(body.sessionToken || '');
        if (companyId && sessionToken) {
          const sessions = await base44.asServiceRole.entities.CompanySession.filter({ token: sessionToken, companyId });
          const session = sessions[0];
          if (session && new Date(session.expiresAt).getTime() > Date.now()) {
            const reqs = await Requests.filter({ companyId }, '-created_date', 100);
            const byHash = reqs.find((rec) => requestHashes(rec).has(fileHash));
            if (byHash) {
              const fromHash = answerFromRequest(byHash);
              if (fromHash) return Response.json(fromHash);
            }
            const nameKey = fileNameKey(body.fileName);
            const byName = nameKey ? reqs.find((rec) => fileNameKey(rec.fileName) === nameKey) : null;
            if (byName) {
              const fromName = answerFromRequest(byName);
              if (fromName) return Response.json(fromName);
            }
          }
        }
      } catch (lookupError) {
        console.error('signedDocs: request lookup', lookupError);
      }
      return Response.json({ status: 'unknown', kind: 'none', uploadedHash: fileHash, registryHash: '' });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('signedDocs error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});