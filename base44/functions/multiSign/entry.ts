import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { createMimeMessage } from 'npm:mimetext@3.0.24';
import { authPowerCareSession } from '../../shared/powerCareSession.ts';
import { fetchWithRetry } from '../../shared/fetchRetry.ts';
import { POWERCARE_MARK_URL } from '../../shared/brand.ts';
import { resolveAppOrigin } from '../../shared/publicHosts.ts';

function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Multi-party document signing:
// - create: an authenticated company user uploads a document and invites several
//   signers (company members or external emails). Each signer receives a unique
//   one-time signing link by email.
// - list: requests I created or where I'm a signer (session-authenticated).
// - getByToken / submitSignature: PUBLIC, authorized purely by the unguessable
//   per-signer token. Each signature stamps a new version of the document; when
//   the last signer finishes, the final file's SHA-256 fingerprint is registered
//   in the verification registry and the creator is notified.

const rid = () => crypto.randomUUID().replace(/-/g, '');
const trustedDocumentHosts = new Set(['media.base44.com', 'base44.app']);
const allowedStampThemes = new Set(['heritage', 'executive', 'minimal', 'certificate', 'vault', 'horizon']);
const isAllowedDocUrl = (value) => {
  try {
    const raw = String(value || '');
    if (!raw || raw.length > 2000) return false;
    const url = new URL(raw);
    return url.protocol === 'https:'
      && trustedDocumentHosts.has(url.hostname.toLowerCase())
      && (url.port === '' || url.port === '443')
      && url.username === ''
      && url.password === '';
  } catch {
    return false;
  }
};

const authSession = authPowerCareSession;

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
// A refusal (or a closed retract window) continues the file without silent
// parties. Settling with at least one signature still closes and registers the
// file — the refusal is carried on its face, not a dead end.
const settleStatus = (signers) => {
  if (signers.some((s) => s.status === 'pending')) return 'pending';
  if (signers.every((s) => s.status === 'signed')) return 'completed';
  if (signers.some((s) => s.status === 'signed')) return 'completed_with_refusal';
  return 'rejected';
};
const isDeletedRequest = (rec) => Boolean(rec) && (rec.status === 'deleted' || Boolean(rec.deletedAt));
const requestAcceptsSignatures = (rec) => {
  if (!rec || isDeletedRequest(rec)) return false;
  const pending = (rec.signers || []).filter((item) => item.status === 'pending');
  return rec.status === 'pending' || (rec.status === 'rejected' && pending.length > 0);
};
/** Parallel only — list order and currentSignerIndex never gate a pending party. */
const canSignerSign = (rec, signer) => requestAcceptsSignatures(rec) && signer?.status === 'pending';
const signedAuditEvent = (signer, extras = {}) => ({
  type: 'signed',
  at: extras.at || signer?.signedAt || new Date().toISOString(),
  actorName: signer?.name || extras.actorName || '',
  actorEmail: signer?.email || extras.actorEmail || '',
  actorId: signer?.employeeId || extras.actorId || null,
  actorRole: signer?.role || extras.actorRole || 'signer',
  documentHash: extras.documentHash || signer?.documentHash || null,
  retractDays: extras.retractDays ?? signer?.retractDays ?? null,
  retractUntil: extras.retractUntil || signer?.retractUntil || null,
  location: extras.location || null,
});
const sameSignedParty = (event, signer) => {
  if (event?.type !== 'signed' || !signer) return false;
  const email = String(event.actorEmail || event.targetEmail || '').toLowerCase();
  const signerEmail = String(signer.email || '').toLowerCase();
  if (email && signerEmail && email === signerEmail) return true;
  if (event.actorId && signer.employeeId && String(event.actorId) === String(signer.employeeId)) return true;
  return Boolean(event.actorName && event.actorName === signer.name);
};
const ensureSignedAudit = (trail, signers) => {
  const events = Array.isArray(trail) ? trail.filter(Boolean) : [];
  (signers || []).forEach((signer) => {
    if (signer.status !== 'signed') return;
    if (events.some((event) => sameSignedParty(event, signer))) return;
    events.push(signedAuditEvent(signer));
  });
  return events;
};
const publicAuditOf = (events) => (events || []).map((event) => ({
  type: event.type,
  at: event.at,
  actorName: event.actorName || '',
  actorRole: event.actorRole || '',
  targetName: event.targetName || '',
  documentHash: event.documentHash || null,
  retractDays: event.retractDays ?? null,
  retractUntil: event.retractUntil || null,
  reason: event.reason || '',
  cause: event.cause || null,
}));

const skipPendingSigners = (signers, { now, reason, cause }) => {
  const skipped = [];
  const next = (signers || []).map((row) => {
    if (row.status !== 'pending') return row;
    skipped.push(row);
    return { ...row, status: 'skipped', skippedAt: now, skipReason: reason, skipCause: cause };
  });
  return { signers: next, skipped };
};

const continueWithoutPending = (signers, { now, reason, cause, actorName }) => {
  const { signers: next, skipped } = skipPendingSigners(signers, { now, reason, cause });
  const events = [
    ...skipped.map((row) => ({ type: 'skipped', at: now, actorName, targetName: row.name, targetEmail: row.email, reason, cause })),
    { type: 'continued', at: now, actorName, reason, skippedCount: skipped.length, cause },
  ];
  return { signers: next, skipped, events };
};
const isRegistrable = (status) => status === 'completed' || status === 'completed_with_refusal';
const RETRACT_DAYS = [0, 1, 2, 3];
const clampRetractDays = (value) => (RETRACT_DAYS.includes(Math.round(Number(value))) ? Math.round(Number(value)) : 1);
const retractUntilAt = (signedAt, days) => {
  const n = clampRetractDays(days);
  if (n === 0) return null;
  return new Date(Date.parse(signedAt) + n * 86400000).toISOString();
};
const canRetractSigner = (signer, now = Date.now()) => signer?.status === 'signed' && !!signer.retractUntil && Date.parse(signer.retractUntil) > (typeof now === 'number' ? now : Date.parse(now));
const shouldSkipSilentAfterRetractClose = (signers, now = Date.now()) => {
  const rows = signers || [];
  if (!rows.some((row) => row.status === 'pending')) return false;
  if (rows.some((row) => canRetractSigner(row, now))) return false;
  return rows.some((row) => row.status === 'signed' && row.retractUntil);
};
const coolingUntilOf = (signers, now = Date.now()) => {
  const open = (signers || []).filter((row) => canRetractSigner(row, now)).map((row) => Date.parse(row.retractUntil)).filter(Number.isFinite);
  return open.length ? new Date(Math.max(...open)).toISOString() : null;
};
const lastSignedHash = (signers) => (signers || [])
  .filter((s) => s.status === 'signed' && s.documentHash && s.signedAt)
  .sort((a, b) => new Date(a.signedAt).getTime() - new Date(b.signedAt).getTime())
  .pop()?.documentHash || null;
const isReleased = (rec) => Boolean(rec?.releasedAt) || rec?.status === 'completed' || rec?.status === 'completed_with_refusal' || rec?.status === 'rejected';
const creatorIsSoleSigner = (rec, signers) => {
  const rows = signers || [];
  if (rows.length !== 1) return false;
  const row = rows[0];
  return (row.employeeId && String(row.employeeId) === String(rec.creatorId || ''))
    || (row.email && String(row.email).toLowerCase() === String(rec.creatorEmail || '').toLowerCase());
};
const derivedState = (rec, now = Date.now()) => {
  const rows = rec.signers || [];
  const pending = rows.filter((row) => row.status === 'pending').length;
  const coolingUntil = coolingUntilOf(rows, now);
  const cooling = pending === 0 && !!coolingUntil;
  const outcome = pending > 0 || cooling ? 'pending' : settleStatus(rows);
  const released = outcome === 'pending' ? false : isReleased(rec);
  const state = outcome === 'pending' ? 'pending' : (released ? outcome : 'awaiting_release');
  return { state, outcome, cooling, coolingUntil, awaitingRelease: state === 'awaiting_release', settled: released && outcome !== 'pending' };
};
const completionNotice = (rec, ar) => {
  const signed = (rec.signers || []).filter((row) => row.status === 'signed').length;
  const total = (rec.signers || []).length;
  if (rec.status === 'completed_with_refusal') {
    return ar
      ? `اكتمل التوقيع مع رفض: ${rec.fileName} — وقّع ${signed} من ${total}. يمكن تنزيل النسخة النهائية.`
      : `Signing completed with a refusal: ${rec.fileName} — ${signed} of ${total} signed. The final copy can be downloaded.`;
  }
  if (rec.status === 'rejected') {
    return ar
      ? `أُغلق طلب التوقيع دون نسخة نهائية: ${rec.fileName}.`
      : `The signing request closed without a final copy: ${rec.fileName}.`;
  }
  return ar
    ? `اكتمل التوقيع: ${rec.fileName} — يمكن تنزيل النسخة النهائية.`
    : `Signing completed: ${rec.fileName} — the final copy can be downloaded.`;
};
const REFUSAL_EXPLICIT = 'explicit';
const REFUSAL_DEADLINE = 'deadline_elapsed';
const DEADLINE_REFUSAL_REASON = 'رفض بانتهاء المدة';
const refusalCauseOf = (signer) => {
  if (!signer || signer.status !== 'rejected') return signer?.rejectionCause || null;
  if (signer.rejectionCause === REFUSAL_DEADLINE || signer.rejectionReason === DEADLINE_REFUSAL_REASON) return REFUSAL_DEADLINE;
  return signer.rejectionCause || REFUSAL_EXPLICIT;
};
const refusalKindLabel = (signerOrCause, ar) => {
  const cause = typeof signerOrCause === 'string' ? signerOrCause : refusalCauseOf(signerOrCause);
  if (cause === REFUSAL_DEADLINE) return ar ? 'رفض بانتهاء المدة' : 'Refused — deadline elapsed';
  return ar ? 'رفض' : 'Refused';
};
const refusePendingByDeadline = (signers, { now, actorName = 'NiroVera' }) => {
  const refused = [];
  const next = (signers || []).map((row) => {
    if (row.status !== 'pending') return row;
    refused.push(row);
    return { ...row, status: 'rejected', rejectedAt: now, rejectionReason: DEADLINE_REFUSAL_REASON, rejectionCause: REFUSAL_DEADLINE };
  });
  const events = [
    ...refused.map((row) => ({ type: 'rejected', at: now, actorName, targetName: row.name, targetEmail: row.email, reason: DEADLINE_REFUSAL_REASON, cause: REFUSAL_DEADLINE })),
    { type: 'deadline_elapsed', at: now, actorName, refusedCount: refused.length, cause: REFUSAL_DEADLINE },
  ];
  return { signers: next, refused, events };
};
const refusalLines = (signers, ar) => (signers || [])
  .filter((s) => s.status === 'rejected')
  .map((s) => {
    const kind = refusalKindLabel(s, ar);
    const detail = s.rejectionReason && s.rejectionReason !== DEADLINE_REFUSAL_REASON ? s.rejectionReason : '';
    return detail ? `${s.name} — ${kind}: ${detail}` : `${s.name} — ${kind}`;
  })
  .join('\n');

const cleanLocation = (value) => value?.available === true && Number.isFinite(Number(value.lat)) && Number.isFinite(Number(value.lng)) ? { lat: Number(value.lat), lng: Number(value.lng), accuracy: Math.max(0, Number(value.accuracy) || 0) } : { available: false };

function signatureRequestEmail({ ar, signerName, creatorName, fileName, link, signerIndex = 0, totalSigners = 1, expiresAt }) {
  const direction = ar ? 'rtl' : 'ltr';
  const align = ar ? 'right' : 'left';
  const title = ar ? 'طلب توقيع مستند' : 'Document signature request';
  const greeting = ar ? `مرحبًا ${signerName}` : `Hello ${signerName}`;
  const intro = ar ? 'لديك مستند جديد بانتظار مراجعتك وتوقيعك الإلكتروني.' : 'A new document is waiting for your review and electronic signature.';
  const senderLabel = ar ? 'مرسل الطلب' : 'Requested by';
  const documentLabel = ar ? 'المستند المطلوب توقيعه' : 'Document to sign';
  const button = ar ? 'مراجعة المستند والتوقيع' : 'Review and sign document';
  const note = ar ? 'هذا الرابط آمن ومخصص لك فقط. يرجى عدم مشاركته مع أي شخص آخر.' : 'This secure link is unique to you. Please do not share it with anyone else.';
  const footer = ar ? 'توقيع إلكتروني موثّق وآمن' : 'Secure, verified electronic signing';
  const orderLabel = ar ? 'الأطراف' : 'Parties';
  const expiryLabel = ar ? 'صلاحية رابط التوقيع' : 'Signing link expires';
  const expiryText = expiresAt ? new Date(expiresAt).toLocaleString(ar ? 'ar-SA' : 'en-GB', { timeZone: 'Asia/Riyadh' }) : '—';
  const securityLabel = ar ? 'مراجعة آمنة قبل التوقيع' : 'Secure review before signing';
  const securityText = ar ? 'ستراجع المستند أولًا، ثم تختار مهلة تراجع أو بدون مهلة وتوقّع. التوقيع متوازٍ — لا تنتظر طرفًا آخر. ليست شهادة حكومية مؤهلة.' : 'You review the document first, then choose a retract window or none and sign. Signing is parallel — you do not wait for another party. This is not a qualified government certificate.';

  return `<!doctype html>
<html lang="${ar ? 'ar' : 'en'}" dir="${direction}">
  <body style="margin:0;padding:0;background:#F7F8FA;color:#14284B;font-family:Arial,'Helvetica Neue',sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#F7F8FA;">
      <tr>
        <td align="center" style="padding:36px 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;background:#ffffff;border:1px solid #E2E8F0;border-radius:16px;overflow:hidden;box-shadow:0 8px 28px rgba(20,40,75,0.08);">
            <tr>
              <td style="padding:28px 32px;background:#14284B;text-align:${align};">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                  <tr>
                    <td style="vertical-align:middle;text-align:${align};">
                      <img src="${POWERCARE_MARK_URL}" width="74" height="74" alt="NiroVera" style="display:inline-block;object-fit:contain;vertical-align:middle;" />
                    </td>
                  </tr>
                </table>
                <h1 style="margin:22px 0 0;color:#ffffff;font-size:26px;line-height:1.35;font-weight:700;">${title}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;text-align:${align};">
                <h2 style="margin:0 0 10px;color:#14284B;font-size:21px;line-height:1.5;font-weight:700;">${escapeHtml(greeting)}</h2>
                <p style="margin:0 0 26px;color:#5A6B85;font-size:15px;line-height:1.8;">${intro}</p>

                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-bottom:14px;background:#F7F8FA;border:1px solid #E2E8F0;border-radius:12px;">
                  <tr>
                    <td style="padding:16px 18px;text-align:${align};">
                      <div style="margin-bottom:6px;color:#5A6B85;font-size:11px;font-weight:bold;letter-spacing:0.5px;">${senderLabel}</div>
                      <div style="color:#14284B;font-size:16px;font-weight:700;">${escapeHtml(creatorName)}</div>
                    </td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border:1px solid #E2E8F0;border-radius:12px;">
                  <tr>
                    <td width="62" style="padding:18px 0 18px 18px;text-align:center;vertical-align:middle;">
                      <div style="display:inline-block;width:42px;height:42px;line-height:42px;background:#F7F8FA;border:1px solid #E2E8F0;border-radius:10px;color:#1E9E63;font-size:11px;font-weight:bold;text-align:center;">PDF</div>
                    </td>
                    <td style="padding:18px;text-align:${align};vertical-align:middle;">
                      <div style="margin-bottom:6px;color:#5A6B85;font-size:11px;font-weight:bold;letter-spacing:0.5px;">${documentLabel}</div>
                      <div style="color:#14284B;font-size:15px;font-weight:700;line-height:1.5;word-break:break-word;">${escapeHtml(fileName)}</div>
                    </td>
                  </tr>
                </table>

                <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin-top:14px;background:#F7F8FA;border:1px solid #E2E8F0;border-radius:12px;">
                  <tr>
                    <td width="50%" style="padding:16px 18px;text-align:${align};border-${ar ? 'left' : 'right'}:1px solid #E2E8F0;">
                      <div style="margin-bottom:6px;color:#5A6B85;font-size:11px;font-weight:bold;">${orderLabel}</div>
                      <div style="color:#14284B;font-size:15px;font-weight:700;">${ar ? `${totalSigners} — يوقّع كلٌ متى شاء` : `${totalSigners} — anyone may sign first`}</div>
                    </td>
                    <td width="50%" style="padding:16px 18px;text-align:${align};">
                      <div style="margin-bottom:6px;color:#5A6B85;font-size:11px;font-weight:bold;">${expiryLabel}</div>
                      <div style="color:#14284B;font-size:13px;font-weight:700;">${escapeHtml(expiryText)}</div>
                    </td>
                  </tr>
                </table>
                <div style="margin-top:14px;padding:16px 18px;background:#ECFDF3;border-left:3px solid #1E9E63;border-radius:10px;text-align:${align};">
                  <div style="margin-bottom:5px;color:#14284B;font-size:13px;font-weight:700;">${securityLabel}</div>
                  <div style="color:#5A6B85;font-size:12px;line-height:1.7;">${securityText}</div>
                </div>

                <div style="padding:30px 0 24px;text-align:center;">
                  <a href="${escapeHtml(link)}" style="display:inline-block;background:#14284B;color:#ffffff;text-decoration:none;padding:15px 28px;border-radius:10px;font-size:15px;font-weight:bold;line-height:1.2;box-shadow:0 5px 14px rgba(20,40,75,0.22);">${button}</a>
                </div>
                <p style="margin:0;padding-top:18px;border-top:1px solid #E2E8F0;color:#5A6B85;font-size:12px;line-height:1.8;text-align:center;">${note}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px;background:#F7F8FA;border-top:1px solid #E2E8F0;color:#5A6B85;font-size:11px;line-height:1.6;text-align:center;">
                <strong style="color:#14284B;">NiroVera</strong> · ${footer}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Send via the connected Gmail account first (works for ANY external address —
// gmail, outlook, corporate…); fall back to the platform mailer if Gmail fails.
async function sendMail(base44, to, subject, bodyText, bodyHtml = '') {
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    // Microsoft (Outlook/Hotmail) rejects mail whose From address doesn't match
    // the sending Gmail account (SPF/DKIM spoof detection) — always send from
    // the real connected address.
    const prof = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const senderAddr = prof?.email;
    if (!senderAddr) throw new Error('gmail profile unavailable');
    const msg = createMimeMessage();
    msg.setSender({ name: 'PowerCare', addr: senderAddr });
    msg.setRecipient(to);
    msg.setSubject(subject);
    msg.addMessage({ contentType: 'text/plain', data: bodyText });
    if (bodyHtml) msg.addMessage({ contentType: 'text/html', data: bodyHtml });
    const res = await fetchWithRetry('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: toBase64Url(msg.asRaw()) }),
    });
    if (res.ok) return true;
    console.error('multiSign gmail send failed for', to, JSON.stringify(await res.json().catch(() => ({}))));
  } catch (e) {
    console.error('multiSign gmail unavailable:', e.message);
  }
  try {
    await base44.asServiceRole.integrations.Core.SendEmail({
      from_name: 'PowerCare',
      to,
      subject,
      body: bodyHtml || bodyText,
    });
    return true;
  } catch (e) {
    console.error('multiSign email failed for', to, e.message);
    return false;
  }
}

async function notifySigningComplete(base44, rec, ar) {
  const text = completionNotice(rec, ar);
  const ids = new Set();
  if (rec.creatorId) ids.add(String(rec.creatorId));
  (rec.signers || []).forEach((row) => { if (row.employeeId) ids.add(String(row.employeeId)); });
  try {
    const blobs = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId: rec.companyId, category: 'notifications' });
    const payload = Array.isArray(blobs[0]?.payload) ? [...blobs[0].payload] : [];
    const now = new Date().toISOString();
    [...ids].forEach((userId) => {
      payload.unshift({ id: `ntf_${crypto.randomUUID()}`, userId, text, read: false, createdAt: now });
    });
    if (blobs[0]) await base44.asServiceRole.entities.CompanyDataBlob.update(blobs[0].id, { payload });
    else await base44.asServiceRole.entities.CompanyDataBlob.create({ companyId: rec.companyId, category: 'notifications', payload });
  } catch (error) {
    console.error('multiSign completion notice failed:', error.message);
  }
  if (rec.creatorEmail) {
    const withRefusal = rec.status === 'completed_with_refusal';
    const subject = withRefusal
      ? (ar ? `أُغلق المستند مع رفض: ${rec.fileName}` : `Closed with a refusal: ${rec.fileName}`)
      : rec.status === 'rejected'
        ? (ar ? `أُغلق طلب التوقيع: ${rec.fileName}` : `Signing request closed: ${rec.fileName}`)
        : (ar ? `اكتمل التوقيع: ${rec.fileName}` : `Signing completed: ${rec.fileName}`);
    await sendMail(base44, rec.creatorEmail, subject, text);
  }
}

async function expireRetractWindows(Docs, rec) {
  if (isDeletedRequest(rec)) return rec;
  const now = new Date().toISOString();
  const signers = rec.signers || [];
  const closed = [];
  let nextSigners = signers.map((row) => {
    if (row.status !== 'signed' || !row.retractUntil || row.retractClosedAt) return row;
    if (Date.parse(row.retractUntil) > Date.now()) return row;
    closed.push(row);
    return { ...row, retractClosedAt: now };
  });
  const events = closed.map((row) => ({
    type: 'retract_closed',
    at: now,
    actorName: row.name,
    retractDays: row.retractDays,
    retractUntil: row.retractUntil,
  }));
  const expired = rec.expiresAt && Date.parse(rec.expiresAt) <= Date.now();
  const pendingLeft = nextSigners.some((row) => row.status === 'pending');
  const autoDeadline = shouldSkipSilentAfterRetractClose(nextSigners);
  if (autoDeadline) {
    const lapsed = refusePendingByDeadline(nextSigners, { now });
    nextSigners = lapsed.signers;
    events.push(...lapsed.events);
  } else if (expired && pendingLeft) {
    const skipped = [];
    nextSigners = nextSigners.map((row) => {
      if (row.status !== 'pending') return row;
      skipped.push(row);
      return { ...row, status: 'skipped', skippedAt: now, skipReason: 'link_expired', skipCause: 'expired' };
    });
    events.push(...skipped.map((row) => ({ type: 'skipped', at: now, actorName: row.name, targetName: row.name, reason: 'link_expired', cause: 'expired' })));
    events.push({ type: 'lapsed', at: now, actorName: 'NiroVera', skippedCount: skipped.length, reason: 'link_expired', cause: 'expired' });
  }
  if (!closed.length && !autoDeadline && !(expired && pendingLeft)) return rec;
  const patch = {
    signers: nextSigners,
    status: 'pending',
    finalHash: null,
    lastActivityAt: now,
    auditTrail: [...(rec.auditTrail || []), ...events],
  };
  await Docs.update(rec.id, patch);
  return { ...rec, ...patch };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const Docs = base44.asServiceRole.entities.SignatureRequest;

    if (action === 'create') {
      const { companyId, sessionToken } = body;
      const actor = await authSession(base44, companyId, sessionToken);
      if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const creatorRoles = new Set(['owner', 'director', 'ops_manager', 'pgm', 'station_manager']);
      if (!actor.admin && !creatorRoles.has(actor.role) && !actor.hrLevelId) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const signersIn = Array.isArray(body.signers) ? body.signers.slice(0, 100) : [];
      const signers = signersIn
        .map((s) => ({
          token: rid(),
          name: String(s.name || '').trim().slice(0, 120),
          email: String(s.email || '').toLowerCase().trim().slice(0, 160),
          status: 'pending',
          signedAt: null,
          rejectedAt: null,
          employeeId: String(s.employeeId || '').slice(0, 64) || null,
          role: String(s.role || '').slice(0, 80),
          stationId: String(s.stationId || '').slice(0, 64) || null,
          signatureUrl: isAllowedDocUrl(s.signatureUrl) ? String(s.signatureUrl).slice(0, 2000) : '',
          stampTheme: allowedStampThemes.has(String(body.signatureTheme || '')) ? String(body.signatureTheme) : 'heritage',
          // Creator-assigned fields: one or more signatures plus optional text fields.
          spots: (Array.isArray(s.spots) && s.spots.length ? s.spots : s.spot ? [{ ...s.spot, type: 'signature' }] : [{ id: 'auto-signature', type: 'signature', page: 1, x: 75, y: 88, scale: 100 }]).slice(0, 30).map((field, fieldIndex) => ({
            id: String(field.id || `field-${fieldIndex}`).slice(0, 80),
            type: field.type === 'text' ? 'text' : 'signature',
            label: String(field.label || '').slice(0, 60),
            page: Math.max(1, Number(field.page) || 1),
            x: Math.min(100, Math.max(0, Number(field.x) || 0)),
            y: Math.min(100, Math.max(0, Number(field.y) || 0)),
            scale: Math.min(200, Math.max(50, Number(field.scale) || 100)),
          })),
          spot: null,
        }))
        .map((s) => ({ ...s, spot: s.spots.find((field) => field.type === 'signature') || null }))
        .filter((s, index, rows) => s.name && s.spot && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.email) && rows.findIndex((row) => row.email === s.email) === index);
      if (signers.length === 0 || signers.length !== signersIn.length || !isAllowedDocUrl(body.docUrl) || !String(body.fileName || '').toLowerCase().endsWith('.pdf') || !String(body.verificationId || '').trim()) {
        return Response.json({ error: 'A PDF document and a valid, unique email for every signer are required' }, { status: 400 });
      }
      const duplicateRequests = await Docs.filter({ verificationId: String(body.verificationId).slice(0, 40) });
      if (duplicateRequests.length) return Response.json({ error: 'SIGNATURE_REUSE' }, { status: 409 });
      const rec = await Docs.create({
        companyId: String(companyId).slice(0, 64),
        creatorId: String(actor.userId || body.creatorId || '').slice(0, 64),
        creatorName: String(actor.admin ? (body.creatorName || actor.name) : actor.name).slice(0, 120),
        creatorEmail: String(actor.admin ? (body.creatorEmail || actor.email) : actor.email).toLowerCase().slice(0, 160),
        fileName: String(body.fileName).slice(0, 200),
        docUrl: String(body.docUrl).slice(0, 2000),
        verificationId: String(body.verificationId || '').slice(0, 40),
        finalHash: null,
        status: 'pending',
        signingMode: body.signingMode === 'sequential' ? 'sequential' : 'parallel',
        currentSignerIndex: 0,
        stationId: actor.stationId || null,
        appUrl: resolveAppOrigin(body.appUrl),
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        lastActivityAt: new Date().toISOString(),
        rejectionReason: null,
        signers,
        auditTrail: [{ type: 'created', at: new Date().toISOString(), actorId: actor.userId || null, actorName: actor.name, actorRole: actor.role || 'admin', location: { available: false } }],
      });
      // Email each signer their personal signing link. The link host is never
      // trusted from the client — only known app domains are allowed, otherwise
      // the canonical published domain is used (prevents phishing-link injection).
      const appUrl = resolveAppOrigin(body.appUrl);
      const ar = body.lang === 'ar';
      const links = Object.fromEntries(signers.map((s) => [s.email, `${appUrl}/sign?token=${rec.id}.${s.token}`]));
      const deliveryResults = await Promise.all(signers.map(async (signer, signerIndex) => {
        const link = links[signer.email];
        const turnText = ar
          ? `يمكنك مراجعة المستند "${rec.fileName}" وتوقيعه الآن بشكل مستقل عن بقية الموقّعين.`
          : `You can review and sign "${rec.fileName}" now, independently of the other signers.`;
        const ok = await sendMail(base44, signer.email, ar ? `طلب توقيع: ${rec.fileName}` : `Signature request: ${rec.fileName}`, ar ? `مرحبًا ${signer.name}،\n\n${turnText}\n${link}` : `Hello ${signer.name},\n\n${turnText}\n${link}`, signatureRequestEmail({ ar, signerName: signer.name, creatorName: rec.creatorName, fileName: rec.fileName, link, signerIndex, totalSigners: signers.length, expiresAt: rec.expiresAt }));
        return { email: signer.email, ok };
      }));
      const emailFailed = deliveryResults.filter((result) => !result.ok).map((result) => result.email);
      return Response.json({ ok: true, requestId: rec.id, links, emailFailed });
    }

    if (action === 'list') {
      const { companyId, sessionToken } = body;
      const actor = await authSession(base44, companyId, sessionToken);
      if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const userId = String(actor.userId || (actor.admin ? body.userId : '') || '');
      const email = String(actor.email || (actor.admin ? body.email : '') || '').toLowerCase();
      const rows = await Docs.filter({ companyId }, '-created_date', 100);
      const expired = await Promise.all(rows.map((row) => expireRetractWindows(Docs, row)));
      const mine = expired
        .filter((r) => r.creatorId === userId || (!!email && r.creatorEmail === email) || (r.signers || []).some((s) => !!email && s.email === email))
        .map((r) => {
          const rows = r.signers || [];
          const mySigner = rows.find((s) => s.email === email);
          const derived = derivedState(r);
          const coolingUntil = derived.coolingUntil;
          return {
            id: r.id,
            fileName: r.fileName,
            creatorName: r.creatorName,
            status: derived.state === 'awaiting_release' ? 'pending' : derived.state,
            settled: derived.settled,
            awaitingRelease: derived.awaitingRelease,
            releasedAt: r.releasedAt || null,
            canDownloadFinal: isRegistrable(derived.state) && !derived.cooling,
            canRelease: (r.creatorId === userId || (!!email && r.creatorEmail === email)) && derived.awaitingRelease,
            deletedAt: r.deletedAt || null,
            deletionReason: r.deletionReason || null,
            createdAt: r.created_date,
            lastActivityAt: r.lastActivityAt || r.updated_date,
            docUrl: r.docUrl,
            stationId: r.stationId || null,
            currentSignerIndex: r.currentSignerIndex || 0,
            rejectionReason: r.rejectionReason || null,
            verificationId: r.verificationId || null,
            finalHash: r.finalHash || null,
            totalCount: rows.length,
            signedCount: rows.filter((s) => s.status === 'signed').length,
            rejectedCount: rows.filter((s) => s.status === 'rejected').length,
            skippedCount: rows.filter((s) => s.status === 'skipped').length,
            pendingCount: rows.filter((s) => s.status === 'pending').length,
            refusals: rows
              .filter((s) => s.status === 'rejected')
              .map((s) => ({ name: s.name, email: s.email, at: s.rejectedAt || null, reason: s.rejectionReason || null, cause: refusalCauseOf(s) })),
            auditTrail: ensureSignedAudit(r.auditTrail, rows),
            isCreator: r.creatorId === userId || (!!email && r.creatorEmail === email),
            myStatus: mySigner ? mySigner.status : null,
            myToken: mySigner ? `${r.id}.${mySigner.token}` : null,
            myCanRetract: r.status !== 'deleted' && canRetractSigner(mySigner),
            myRetractUntil: mySigner?.retractUntil || null,
            coolingUntil,
            signers: rows.map((s) => ({
              name: s.name,
              email: s.email,
              role: s.role || '',
              stationId: s.stationId || null,
              status: s.status,
              signedAt: s.signedAt,
              rejectedAt: s.rejectedAt || null,
              rejectionReason: s.rejectionReason || null,
              rejectionCause: refusalCauseOf(s),
              signToken: (r.creatorId === userId || (!!email && r.creatorEmail === email)) && s.token ? `${r.id}.${s.token}` : null,
              skippedAt: s.skippedAt || null,
              skipReason: s.skipReason || null,
              skipCause: s.skipCause || null,
              retractDays: s.retractDays ?? null,
              retractUntil: s.retractUntil || null,
              canRetract: canRetractSigner(s),
            })),
          };
        });
      return Response.json({ requests: mine });
    }

    if (action === 'remind') {
      const { companyId, sessionToken } = body;
      const actor = await authSession(base44, companyId, sessionToken);
      if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const rec = await Docs.get(String(body.requestId || '')).catch(() => null);
      if (!rec || rec.companyId !== companyId) return Response.json({ error: 'Not found' }, { status: 404 });
      const actorId = String(actor.userId || (actor.admin ? body.userId : '') || '');
      const actorEmail = String(actor.email || '').toLowerCase();
      if (rec.creatorId !== actorId && (!actorEmail || rec.creatorEmail !== actorEmail)) return Response.json({ error: 'Only the creator can send reminders' }, { status: 403 });
      if (rec.status !== 'pending') return Response.json({ error: 'REQUEST_CLOSED' }, { status: 409 });
      const signerEmail = String(body.signerEmail || '').toLowerCase().trim();
      const signer = (rec.signers || []).find((item) => item.email === signerEmail && item.status === 'pending');
      if (!signer) return Response.json({ error: 'Pending signer not found' }, { status: 404 });
      const signerIndex = (rec.signers || []).findIndex((item) => item.token === signer.token);
      const link = `${resolveAppOrigin(rec.appUrl)}/sign?token=${rec.id}.${signer.token}`;
      const ar = body.lang === 'ar';
      const sent = await sendMail(base44, signer.email, ar ? `تذكير بالتوقيع: ${rec.fileName}` : `Signing reminder: ${rec.fileName}`, ar ? `مرحبًا ${signer.name}،\n\nتذكير بوجود المستند "${rec.fileName}" بانتظار توقيعك.\n${link}` : `Hello ${signer.name},\n\nThis is a reminder that "${rec.fileName}" is waiting for your signature.\n${link}`, signatureRequestEmail({ ar, signerName: signer.name, creatorName: rec.creatorName, fileName: rec.fileName, link, signerIndex, totalSigners: (rec.signers || []).length, expiresAt: rec.expiresAt }));
      if (!sent) return Response.json({ error: 'Reminder email could not be delivered' }, { status: 502 });
      const remindedAt = new Date().toISOString();
      await Docs.update(rec.id, { lastActivityAt: remindedAt, auditTrail: [...(rec.auditTrail || []), { type: 'reminder_sent', at: remindedAt, actorId: actor.userId || null, actorName: actor.name, actorRole: actor.role || 'admin', targetName: signer.name, targetEmail: signer.email, location: { available: false } }] });
      return Response.json({ ok: true, signerEmail: signer.email });
    }

    if (action === 'delete') {
      const { companyId, sessionToken } = body;
      const actor = await authSession(base44, companyId, sessionToken);
      if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const rec = await Docs.get(String(body.requestId || '')).catch(() => null);
      if (!rec || rec.companyId !== companyId) {
        return Response.json({ error: 'Not found' }, { status: 404 });
      }
      const actorId = String(actor.userId || (actor.admin ? body.userId : '') || '');
      const actorEmail = String(actor.email || '').toLowerCase();
      if (rec.creatorId !== actorId && (!actorEmail || rec.creatorEmail !== actorEmail)) {
        return Response.json({ error: 'Only the creator can delete this request' }, { status: 403 });
      }
      if (isDeletedRequest(rec)) return Response.json({ error: 'REQUEST_CLOSED' }, { status: 409 });
      const note = String(body.reason || '').trim().slice(0, 1000);
      if (!note) return Response.json({ error: 'REASON_REQUIRED', reason: 'Deletion reason is required' }, { status: 400 });
      const now = new Date().toISOString();
      await Docs.update(rec.id, {
        status: 'deleted',
        deletedAt: now,
        deletionReason: note,
        lastActivityAt: now,
        auditTrail: [...(rec.auditTrail || []), {
          type: 'deleted',
          at: now,
          actorId: actor.userId || null,
          actorName: actor.name || rec.creatorName,
          actorRole: actor.role || 'admin',
          reason: note,
        }],
      });
      return Response.json({ ok: true, status: 'deleted' });
    }

    if (action === 'continueWithout' || action === 'release') {
      const { companyId, sessionToken } = body;
      const actor = await authSession(base44, companyId, sessionToken);
      if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const rec = await Docs.get(String(body.requestId || '')).catch(() => null);
      if (!rec || rec.companyId !== companyId) return Response.json({ error: 'Not found' }, { status: 404 });
      const actorId = String(actor.userId || (actor.admin ? body.userId : '') || '');
      const actorEmail = String(actor.email || '').toLowerCase();
      if (rec.creatorId !== actorId && (!actorEmail || rec.creatorEmail !== actorEmail)) {
        return Response.json({ error: 'Only the creator can continue this file' }, { status: 403 });
      }
      if (isDeletedRequest(rec)) return Response.json({ error: 'REQUEST_CLOSED' }, { status: 409 });
      if (isReleased(rec) && rec.status !== 'pending') return Response.json({ error: 'ALREADY_RELEASED' }, { status: 409 });
      const pending = (rec.signers || []).filter((item) => item.status === 'pending');
      const now = new Date().toISOString();
      const note = String(body.reason || '').trim().slice(0, 1000) || (pending.length ? 'file_continued' : 'file_released');
      let signers = rec.signers || [];
      const events = [];
      if (pending.length) {
        signers = signers.map((item) => item.status === 'pending'
          ? { ...item, status: 'skipped', skippedAt: now, skipReason: note, skipCause: 'continued' }
          : item);
        events.push(...pending.map((item) => ({ type: 'skipped', at: now, actorId: actor.userId || null, actorName: actor.name, targetName: item.name, targetEmail: item.email, reason: note, cause: 'continued' })));
        events.push({ type: 'continued', at: now, actorId: actor.userId || null, actorName: actor.name, reason: note, skippedCount: pending.length });
      }
      const cooling = !!coolingUntilOf(signers);
      if (cooling) {
        await Docs.update(rec.id, { signers, status: 'pending', finalHash: null, lastActivityAt: now, auditTrail: [...(rec.auditTrail || []), ...events] });
        return Response.json({ ok: true, continued: true, released: false, status: 'pending' });
      }
      const nextStatus = settleStatus(signers);
      if (nextStatus === 'pending') return Response.json({ error: 'NOT_READY' }, { status: 409 });
      const closingHash = isRegistrable(nextStatus) ? (rec.finalHash || lastSignedHash(signers)) : null;
      events.push({ type: 'released', at: now, actorId: actor.userId || null, actorName: actor.name || rec.creatorName, actorRole: 'creator' });
      let registryRecord = null;
      if (closingHash) {
        const Registry = base44.asServiceRole.entities.SignedDocument;
        const existing = await Registry.filter({ verificationId: rec.verificationId });
        if (!existing.length) {
          registryRecord = await Registry.create({
            verificationId: rec.verificationId,
            fileHash: closingHash,
            signerName: signers.filter((item) => item.status === 'signed').map((item) => item.name).join(', ').slice(0, 120),
            signerId: rec.creatorId,
            companyId: rec.companyId,
            fileName: rec.fileName,
            signedAt: now,
          });
        }
      }
      try {
        await Docs.update(rec.id, {
          signers,
          status: nextStatus,
          releasedAt: now,
          releasedByName: actor.name || rec.creatorName,
          finalHash: closingHash,
          lastActivityAt: now,
          auditTrail: [...(rec.auditTrail || []), ...events],
        });
      } catch (error) {
        if (registryRecord) await base44.asServiceRole.entities.SignedDocument.delete(registryRecord.id).catch(() => {});
        throw error;
      }
      const closed = { ...rec, signers, status: nextStatus, releasedAt: now, finalHash: closingHash };
      const ar = body.lang === 'ar';
      await notifySigningComplete(base44, closed, ar);
      return Response.json({ ok: true, continued: true, released: true, status: nextStatus, notifyComplete: true });
    }

    if (action === 'reopen') {
      const { companyId, sessionToken } = body;
      const actor = await authSession(base44, companyId, sessionToken);
      if (!actor) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const rec = await Docs.get(String(body.requestId || '')).catch(() => null);
      if (!rec || rec.companyId !== companyId) return Response.json({ error: 'Not found' }, { status: 404 });
      const actorId = String(actor.userId || (actor.admin ? body.userId : '') || '');
      const actorEmail = String(actor.email || '').toLowerCase();
      if (rec.creatorId !== actorId && (!actorEmail || rec.creatorEmail !== actorEmail)) {
        return Response.json({ error: 'FORBIDDEN', reason: 'Only the creator can reopen a refused party' }, { status: 403 });
      }
      if (isDeletedRequest(rec)) return Response.json({ error: 'REQUEST_CLOSED', reason: 'Deleted requests cannot be reopened' }, { status: 409 });
      const target = String(body.signerEmail || '').toLowerCase().trim();
      const signer = (rec.signers || []).find((row) => row.email === target);
      if (!signer) return Response.json({ error: 'NOT_FOUND', reason: 'That party is not on this request' }, { status: 404 });
      if (signer.status !== 'rejected') return Response.json({ error: 'NOT_REFUSED', reason: 'Reopen is only for a party who refused' }, { status: 409 });
      const now = new Date().toISOString();
      const signers = rec.signers.map((row) => (
        row.email === target
          ? { ...row, status: 'pending', rejectedAt: null, rejectionReason: null, rejectionCause: null, skippedAt: null, skipReason: null, skipCause: null }
          : row
      ));
      await Docs.update(rec.id, {
        signers,
        status: 'pending',
        releasedAt: null,
        releasedByName: null,
        finalHash: null,
        rejectionReason: signers.some((row) => row.status === 'rejected')
          ? (signers.find((row) => row.status === 'rejected')?.rejectionReason || rec.rejectionReason)
          : null,
        lastActivityAt: now,
        auditTrail: [
          ...(rec.auditTrail || []),
          {
            type: 'reopened',
            at: now,
            actorId: actor.userId || null,
            actorName: actor.name || rec.creatorName,
            targetName: signer.name,
            targetEmail: signer.email,
            priorCause: refusalCauseOf(signer),
          },
        ],
      });
      return Response.json({ ok: true, reopened: true, status: nextStatus });
    }

    // ---- PUBLIC (token-authorized) actions ----
    const resolveToken = async (token) => {
      const [id, part] = String(token || '').split('.');
      if (!id || !part) return null;
      const rec = await Docs.get(id).catch(() => null);
      if (!rec) return null;
      const fresh = await expireRetractWindows(Docs, rec);
      const signer = (fresh.signers || []).find((s) => s.token === part);
      const expired = !!rec.expiresAt && new Date(rec.expiresAt).getTime() <= Date.now();
      return signer ? { rec: fresh, signer, expired } : null;
    };

    if (action === 'getByToken') {
      const found = await resolveToken(body.token);
      if (!found) return Response.json({ error: 'Invalid or expired signing link' }, { status: 404 });
      const { rec, signer, expired } = found;
      if (expired) {
        return Response.json({ expiresAt: rec.expiresAt, signer: { name: signer.name, status: signer.status } });
      }
      const deleted = isDeletedRequest(rec);
      const pending = (rec.signers || []).filter((s) => s.status === 'pending');
      return Response.json({
        fileName: rec.fileName,
        creatorName: rec.creatorName,
        docUrl: rec.docUrl,
        status: deleted ? 'deleted' : rec.status,
        deletionReason: rec.deletionReason || null,
        expiresAt: rec.expiresAt,
        verificationId: rec.verificationId,
        finalHash: rec.finalHash || null,
        signer: {
          name: signer.name,
          email: signer.email,
          status: signer.status,
          employeeId: signer.employeeId || null,
          role: signer.role || '',
          stationId: signer.stationId || null,
          signatureUrl: signer.signatureUrl || '',
          stampTheme: signer.stampTheme || 'heritage',
          stampConfig: signer.stampConfig || null,
          spot: signer.spot || null,
          spots: signer.spots || (signer.spot ? [{ ...signer.spot, id: 'signature', type: 'signature', label: '' }] : []),
          retractDays: signer.retractDays ?? null,
          retractUntil: signer.retractUntil || null,
          canRetract: !deleted && canRetractSigner(signer),
          rejectionReason: signer.rejectionReason || null,
          rejectionCause: signer.rejectionCause || null,
        },
        rejectionReason: rec.rejectionReason || signer.rejectionReason || null,
        signedCount: (rec.signers || []).filter((s) => s.status === 'signed').length,
        pendingCount: (rec.signers || []).filter((s) => s.status === 'pending').length,
        totalCount: (rec.signers || []).length,
        canSign: canSignerSign(rec, signer),
        canRetract: !deleted && canRetractSigner(signer),
        isLast: signer.status === 'pending' && pending.length === 1,
        signerNames: (rec.signers || []).map((s) => s.name).join(', '),
        parties: (rec.signers || []).map((row) => ({
          name: row.name,
          status: row.status || 'pending',
          rejectionCause: row.status === 'rejected' ? refusalCauseOf(row) : null,
          you: row.token === signer.token,
        })),
        auditTrail: publicAuditOf(ensureSignedAudit(rec.auditTrail, rec.signers)),
      });
    }

    if (action === 'reject') {
      const found = await resolveToken(body.token);
      if (!found) return Response.json({ error: 'Invalid or expired signing link' }, { status: 404 });
      const { rec, signer, expired } = found;
      if (expired) return Response.json({ error: 'Invalid or expired signing link' }, { status: 404 });
      if (isDeletedRequest(rec)) return Response.json({ error: 'REQUEST_CLOSED' }, { status: 409 });
      const pendingBeforeRejection = (rec.signers || []).filter((item) => item.status === 'pending');
      const requestAcceptsResponses = rec.status === 'pending' || (rec.status === 'rejected' && pendingBeforeRejection.length > 0);
      if (!requestAcceptsResponses || signer.status !== 'pending') return Response.json({ error: 'REQUEST_CLOSED' }, { status: 409 });
      const reason = String(body.reason || '').trim().slice(0, 1000);
      if (!reason) return Response.json({ error: 'REASON_REQUIRED' }, { status: 400 });
      const rejectedAt = new Date().toISOString();
      const location = cleanLocation(body.location);
      let signers = (rec.signers || []).map((item) => item.token === signer.token ? { ...item, status: 'rejected', rejectedAt, rejectionReason: reason, rejectionCause: REFUSAL_EXPLICIT, location } : item);
      const events = [{ type: 'rejected', at: rejectedAt, actorId: signer.employeeId || null, actorName: signer.name, actorRole: signer.role || 'signer', location, reason, cause: REFUSAL_EXPLICIT }];
      await Docs.update(rec.id, {
        signers,
        status: 'pending',
        finalHash: null,
        rejectionReason: reason,
        lastActivityAt: rejectedAt,
        auditTrail: [...(rec.auditTrail || []), ...events],
      });
      if (rec.creatorEmail) {
        const ar = body.lang === 'ar';
        const remaining = signers.filter((item) => item.status === 'pending').length;
        const tail = remaining
          ? (ar ? `المستند لا يتوقف — ${remaining} ما زالوا يوقّعون. التنزيل بعد تمرير المنشئ.` : `The document does not stop — ${remaining} still signing. Download waits for the creator to release.`)
          : (ar ? 'الأطراف أجابت. نزّل الملف بعد أن يمرّر المنشئ التوقيع.' : 'Every party has answered. Download waits for the creator to release the file.');
        await sendMail(
          base44,
          rec.creatorEmail,
          ar ? `رفض توقيع: ${rec.fileName}` : `Signature refused: ${rec.fileName}`,
          ar ? `رفض ${signer.name} توقيع المستند.\n\nالسبب: ${reason}\n\n${tail}` : `${signer.name} refused to sign the document.\n\nReason: ${reason}\n\n${tail}`,
        );
      }
      return Response.json({ ok: true, reason, status: 'pending' });
    }

    if (action === 'retractSignature') {
      const found = await resolveToken(body.token);
      if (!found) return Response.json({ error: 'Invalid or expired signing link' }, { status: 404 });
      const { rec, signer, expired } = found;
      if (expired) return Response.json({ error: 'Invalid or expired signing link' }, { status: 404 });
      if (isDeletedRequest(rec)) return Response.json({ error: 'REQUEST_CLOSED' }, { status: 409 });
      if (!canRetractSigner(signer)) return Response.json({ error: 'RETRACT_CLOSED', reason: 'The retraction window has closed' }, { status: 409 });
      const retractedAt = new Date().toISOString();
      const reason = String(body.reason || '').trim().slice(0, 1000);
      const signers = (rec.signers || []).map((item) => item.token === signer.token
        ? { ...item, status: 'pending', signedAt: null, documentHash: null, fieldValues: {}, retractClosedAt: retractedAt, retractedAt }
        : item);
      const nextStatus = settleStatus(signers);
      await Docs.update(rec.id, {
        signers,
        docUrl: signer.previousDocUrl || rec.docUrl,
        status: nextStatus,
        finalHash: null,
        currentSignerIndex: signers.filter((item) => item.status === 'signed').length,
        lastActivityAt: retractedAt,
        auditTrail: [...(rec.auditTrail || []), {
          type: 'retracted',
          at: retractedAt,
          actorId: signer.employeeId || null,
          actorName: signer.name,
          actorRole: signer.role || 'signer',
          retractDays: signer.retractDays,
          retractUntil: signer.retractUntil,
          reason,
          targetName: rec.creatorName,
        }],
      });
      if (rec.creatorEmail) {
        const ar = body.lang === 'ar';
        await sendMail(
          base44,
          rec.creatorEmail,
          ar ? `تراجع عن التوقيع: ${rec.fileName}` : `Signature retracted: ${rec.fileName}`,
          ar
            ? `تراجع ${signer.name} عن توقيع المستند "${rec.fileName}" خلال مهلة ${signer.retractDays || 1} يوم.\n${reason ? `\nالسبب: ${reason}\n` : ''}\nسُجّل التراجع في سجل التدقيق، والطلب عاد بانتظار توقيعه.`
            : `${signer.name} retracted their signature on "${rec.fileName}" within the ${signer.retractDays || 1}-day window.${reason ? `\n\nReason: ${reason}` : ''}\n\nThe retraction is in the audit trail and the request is waiting for their signature again.`,
        );
      }
      return Response.json({ ok: true, retracted: true, status: nextStatus });
    }

    if (action === 'submitSignature') {
      const found = await resolveToken(body.token);
      if (!found) return Response.json({ error: 'Invalid or expired signing link' }, { status: 404 });
      const { rec, signer, expired } = found;
      if (expired) return Response.json({ error: 'Invalid or expired signing link' }, { status: 404 });
      if (isDeletedRequest(rec)) return Response.json({ error: 'REQUEST_CLOSED' }, { status: 409 });
      if (!canSignerSign(rec, signer)) return Response.json({ error: 'ALREADY_SIGNED' }, { status: 409 });
      const fileHash = String(body.fileHash || '').toLowerCase().slice(0, 64);
      if (!/^[0-9a-f]{64}$/.test(fileHash)) return Response.json({ error: 'Signed version fingerprint is required' }, { status: 400 });
      const newDocUrl = String(body.newDocUrl || '').slice(0, 2000);
      if (!isAllowedDocUrl(newDocUrl)) return Response.json({ error: 'A valid signed document URL is required' }, { status: 400 });
      const submittedValues = body.textValues && typeof body.textValues === 'object' ? body.textValues : {};
      const textFields = (signer.spots || []).filter((field) => field.type === 'text');
      const fieldValues = Object.fromEntries(textFields.map((field) => [field.id, String(submittedValues[field.id] || '').trim().slice(0, 1000)]));
      if (textFields.some((field) => !fieldValues[field.id])) return Response.json({ error: 'All text fields are required' }, { status: 400 });

      const signedAt = new Date().toISOString();
      const location = cleanLocation(body.location);
      const days = clampRetractDays(body.retractDays);
      const retractUntil = retractUntilAt(signedAt, days);
      const signers = (rec.signers || []).map((s) =>
        s.token === signer.token
          ? { ...s, status: 'signed', signedAt, fieldValues, documentHash: fileHash, location, previousDocUrl: rec.docUrl || '', retractDays: days, retractUntil, retractClosedAt: null }
          : s
      );
      const nextStatus = settleStatus(signers);
      const cooling = !!coolingUntilOf(signers);
      const autoRelease = creatorIsSoleSigner(rec, signers) && isRegistrable(nextStatus) && !cooling;
      let registryRecord = null;
      if (autoRelease) {
        const Registry = base44.asServiceRole.entities.SignedDocument;
        const existing = await Registry.filter({ verificationId: rec.verificationId });
        if (existing.length) return Response.json({ error: 'SIGNATURE_REUSE' }, { status: 409 });
        registryRecord = await Registry.create({
          verificationId: rec.verificationId,
          fileHash,
          signerName: signers.filter((s) => s.status === 'signed').map((s) => s.name).join(', ').slice(0, 120),
          signerId: rec.creatorId,
          companyId: rec.companyId,
          fileName: rec.fileName,
          signedAt: new Date().toISOString(),
        });
      }
      try {
        await Docs.update(rec.id, {
          signers,
          docUrl: newDocUrl,
          status: autoRelease ? nextStatus : 'pending',
          releasedAt: autoRelease ? signedAt : rec.releasedAt || null,
          releasedByName: autoRelease ? (rec.creatorName || signer.name) : rec.releasedByName || null,
          finalHash: autoRelease ? fileHash : null,
          currentSignerIndex: signers.filter((item) => item.status === 'signed').length,
          lastActivityAt: signedAt,
          auditTrail: ensureSignedAudit([
            ...(rec.auditTrail || []),
            signedAuditEvent(signer, { at: signedAt, documentHash: fileHash, retractDays: days, retractUntil, location }),
            ...(days > 0 && retractUntil
              ? [{ type: 'retract_window', at: signedAt, actorName: signer.name, retractDays: days, retractUntil, targetName: rec.creatorName }]
              : []),
            ...(autoRelease ? [{ type: 'released', at: signedAt, actorId: rec.creatorId || null, actorName: rec.creatorName, actorRole: 'creator' }] : []),
          ], signers),
          });
      } catch (error) {
        if (registryRecord) await base44.asServiceRole.entities.SignedDocument.delete(registryRecord.id).catch(() => {});
        throw error;
      }

      if (rec.creatorEmail && days > 0 && retractUntil) {
        const ar = body.lang === 'ar';
        const untilText = new Date(retractUntil).toLocaleString(ar ? 'ar-SA' : 'en-GB', { timeZone: 'Asia/Riyadh' });
        const windowNote = ar
          ? `وقّع ${signer.name} المستند "${rec.fileName}" واختار مهلة تراجع ${days === 2 ? 'يومين' : days === 3 ? 'ثلاثة أيام' : 'يوم واحد'} — يمكنه التراجع حتى ${untilText}. بعد انتهائها يُغلق التراجع ويُثبت في سجل التدقيق.`
          : `${signer.name} signed "${rec.fileName}" and chose a ${days}-day retraction window — they can retract until ${untilText}. After that the retraction closes and the audit trail keeps it.`;
        await sendMail(base44, rec.creatorEmail, ar ? `توقيع مع مهلة تراجع: ${rec.fileName}` : `Signed with retract window: ${rec.fileName}`, windowNote);
      }

      if (autoRelease) {
        await notifySigningComplete(base44, { ...rec, signers, status: nextStatus, releasedAt: signedAt, finalHash: fileHash }, body.lang === 'ar');
      }
      return Response.json({ ok: true, completed: autoRelease && nextStatus === 'completed', status: autoRelease ? nextStatus : 'pending', cooling, retractDays: days, retractUntil, docUrl: newDocUrl, finalHash: autoRelease ? fileHash : null });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('multiSign error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});