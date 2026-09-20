import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { createMimeMessage } from 'npm:mimetext@3.0.24';
import { fetchWithRetry } from '../../shared/fetchRetry.ts';
import { filterBlobPayload, redactEmployee, attachEmployeeRequestFields, canSeeEmployeeRequests, APPEND_ONLY_CATEGORIES, inspectAppendOnly } from '../../shared/blobVisibility.ts';
import {
  WORKSPACE_SEARCH_MAX,
  accountMatchesWorkspaceQuery,
  checkWorkspaceSearchGate,
  derivePublicWorkspaceCard,
} from '../../shared/workspaceDerivations.ts';
import { POWERCARE_MARK_URL } from '../../shared/brand.ts';
import { companyMetaCreatePayload, creatorEmployeeRecord } from '../../shared/companyBootstrap.ts';

// System emails (OTP codes, welcome messages) go out through the app's connected
// Gmail account, because the built-in email service refuses recipients who are
// not registered platform users — which owners/employees usually are not.
function toBase64Url(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Branded HTML email template — local N mark, same asset as other NiroVera mailers.
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
function emailHtml({ title, lines = [], code = null, footerNote = '' }) {
  const paragraphs = lines.map((line) => `<p style="margin:0 auto 22px;max-width:520px;font-size:20px;line-height:1.55;color:#17202b;text-align:center;" dir="auto">${escapeHtml(line)}</p>`).join('');
  const codeBlock = code
    ? `<div style="margin:24px 0 26px;padding:17px 20px;border-radius:6px;background:#d0ad63;color:#101820;font-size:40px;line-height:1.1;letter-spacing:5px;font-weight:500;text-align:center;" dir="ltr">${escapeHtml(code)}</div>`
    : '';
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>@media(max-width:600px){.pc-wrap{padding:28px 14px!important}.pc-body{padding:38px 24px 34px!important}.pc-title{font-size:29px!important}.pc-copy{font-size:17px!important}.pc-code{font-size:34px!important}}</style></head><body style="margin:0;padding:0;background:#ffffff;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f0e3;"><tr><td class="pc-wrap" align="center" style="padding:72px 20px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:650px;background:#ffffff;border:1px solid #d8d8d4;border-radius:8px;overflow:hidden;box-shadow:0 10px 28px rgba(24,42,60,.08);">
      <tr><td align="center" style="background:#183957;padding:29px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:12px;"><img src="${POWERCARE_MARK_URL}" width="42" height="42" alt="NiroVera" style="display:block;width:42px;height:42px;object-fit:contain;border:0;" /></td>
          <td style="font-size:29px;line-height:42px;font-weight:600;color:#ffffff;letter-spacing:-.5px;">PowerCare</td>
        </tr></table>
      </td></tr>
      <tr><td class="pc-body" style="padding:48px 34px 40px;text-align:center;">
        <h1 class="pc-title" style="margin:0 0 20px;font-size:38px;line-height:1.2;color:#101820;font-family:Georgia,'Times New Roman',serif;font-weight:700;text-align:center;" dir="auto">${escapeHtml(title)}</h1>
        <div class="pc-copy">${paragraphs}</div>
        <div class="pc-code">${codeBlock}</div>
        <p style="margin:0 auto;max-width:540px;font-size:18px;line-height:1.55;color:#28313b;text-align:center;" dir="auto">${escapeHtml(footerNote || 'PowerCare — إدارة ذكية لفريقك ومهامك · Smart workforce management')}</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;
}

const SYSTEM_MAIL_COPY = {
  en:{verifyTitle:'Login verification code',verifyLine:'Use the following code to complete signing in to your account:',valid:'The code is valid for 10 minutes. If you did not try to sign in, ignore this email.',employeeTitle:'Welcome to PowerCare',employeeReady:'Your PowerCare account is ready.',employeeAccess:'Sign in with this email and the temporary password provided securely by your company manager. A 10-minute verification code will then be emailed to you.'},
  ar:{verifyTitle:'رمز التحقق لتسجيل الدخول',verifyLine:'استخدم الرمز التالي لإتمام تسجيل الدخول إلى حسابك:',valid:'الرمز صالح لمدة 10 دقائق. إذا لم تحاول تسجيل الدخول، تجاهل هذه الرسالة.',employeeTitle:'مرحبًا بك في PowerCare',employeeReady:'تم تجهيز حسابك في PowerCare.',employeeAccess:'سجّل الدخول بهذا البريد وكلمة المرور المؤقتة التي يزوّدك بها مدير الشركة، وسيصلك بعدها رمز تحقق صالح لمدة 10 دقائق.'},
  de:{verifyTitle:'Bestätigungscode für die Anmeldung',verifyLine:'Verwenden Sie diesen Code, um die Anmeldung abzuschließen:',valid:'Der Code ist 10 Minuten gültig. Falls Sie sich nicht anmelden wollten, ignorieren Sie diese E-Mail.',employeeTitle:'Willkommen bei PowerCare',employeeReady:'Ihr PowerCare-Konto ist bereit.',employeeAccess:'Melden Sie sich mit dieser E-Mail und dem temporären Passwort Ihres Managers an. Anschließend erhalten Sie einen 10 Minuten gültigen Bestätigungscode.'},
  fr:{verifyTitle:'Code de vérification de connexion',verifyLine:'Utilisez le code suivant pour terminer votre connexion :',valid:'Le code est valable 10 minutes. Si vous n’avez pas tenté de vous connecter, ignorez cet e-mail.',employeeTitle:'Bienvenue sur PowerCare',employeeReady:'Votre compte PowerCare est prêt.',employeeAccess:'Connectez-vous avec cet e-mail et le mot de passe temporaire fourni par votre responsable. Un code valable 10 minutes vous sera ensuite envoyé.'},
  es:{verifyTitle:'Código de verificación de acceso',verifyLine:'Usa el siguiente código para completar el inicio de sesión:',valid:'El código es válido durante 10 minutos. Si no intentaste iniciar sesión, ignora este correo.',employeeTitle:'Bienvenido a PowerCare',employeeReady:'Tu cuenta de PowerCare está lista.',employeeAccess:'Inicia sesión con este correo y la contraseña temporal proporcionada por tu responsable. Después recibirás un código válido durante 10 minutos.'},
  pt:{verifyTitle:'Código de verificação de login',verifyLine:'Use o código abaixo para concluir seu login:',valid:'O código é válido por 10 minutos. Se você não tentou entrar, ignore este e-mail.',employeeTitle:'Bem-vindo ao PowerCare',employeeReady:'Sua conta PowerCare está pronta.',employeeAccess:'Entre com este e-mail e a senha temporária fornecida pelo seu gestor. Em seguida, você receberá um código válido por 10 minutos.'},
  ru:{verifyTitle:'Код подтверждения входа',verifyLine:'Используйте следующий код для завершения входа:',valid:'Код действует 10 минут. Если вы не пытались войти, проигнорируйте это письмо.',employeeTitle:'Добро пожаловать в PowerCare',employeeReady:'Ваша учётная запись PowerCare готова.',employeeAccess:'Войдите с этой почтой и временным паролем от руководителя. Затем вы получите код подтверждения, действующий 10 минут.'},
  ja:{verifyTitle:'ログイン確認コード',verifyLine:'ログインを完了するには、次のコードを使用してください。',valid:'コードは10分間有効です。ログイン操作をしていない場合は、このメールを無視してください。',employeeTitle:'PowerCareへようこそ',employeeReady:'PowerCareアカウントの準備が完了しました。',employeeAccess:'このメールアドレスと会社管理者から安全に共有された仮パスワードでログインしてください。その後、10分間有効な確認コードが届きます。'},
  ko:{verifyTitle:'로그인 인증 코드',verifyLine:'로그인을 완료하려면 다음 코드를 사용하세요.',valid:'코드는 10분간 유효합니다. 로그인을 시도하지 않았다면 이 이메일을 무시하세요.',employeeTitle:'PowerCare에 오신 것을 환영합니다',employeeReady:'PowerCare 계정이 준비되었습니다.',employeeAccess:'이 이메일과 회사 관리자가 안전하게 제공한 임시 비밀번호로 로그인하세요. 이후 10분간 유효한 인증 코드가 전송됩니다.'},
};
function systemMailCopy(language) { return SYSTEM_MAIL_COPY[language] || SYSTEM_MAIL_COPY.en; }

async function sendSystemEmail(base44, { to, subject, body, html }) {
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
    const profile = profileRes.ok ? await profileRes.json() : null;
    if (!profile?.email) throw new Error('Connected Gmail sender identity is unavailable');
    const msg = createMimeMessage();
    msg.setSender({ name: 'PowerCare', addr: profile.email });
    msg.setRecipient(to);
    msg.setSubject(subject);
    if (html) {
      msg.addMessage({ contentType: 'text/html', data: html });
    } else {
      msg.addMessage({ contentType: 'text/plain', data: body });
    }
    const res = await fetchWithRetry('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: toBase64Url(msg.asRaw()) }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error?.message || `Gmail send failed (${res.status})`);
    }
    return;
  } catch (gmailError) {
    console.error('Gmail system email failed, falling back to Core.SendEmail:', gmailError.message);
    await base44.asServiceRole.integrations.Core.SendEmail({ to, from_name: 'PowerCare', subject, body });
  }
}

// Company-scoped Employee/Station access. Runs with the service role only —
// the Employee/Station entities themselves are locked down (no public RLS),
// so this function is the sole gateway and always filters by companyId,
// preventing one company from ever reading or writing another's records.
// Passwords are stored as slow PBKDF2 hashes; legacy SHA-256 hashes are upgraded after a valid login. Plaintext is never stored.
async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function hashPassword(password, salt) {
  const s = salt || crypto.randomUUID().replace(/-/g, '');
  const hex = await sha256Hex(s + '::' + password);
  return `sha256$${s}$${hex}`;
}
async function pbkdf2Password(password, salt, iterations = 100000) {
  const s = salt || crypto.randomUUID().replace(/-/g, '');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(s), iterations },
    key, 256,
  );
  const hex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2$${iterations}$${s}$${hex}`;
}
async function verifyPassword(password, stored) {
  if (!stored) return false;
  if (String(stored).startsWith('pbkdf2$')) {
    const [, rounds, salt] = String(stored).split('$');
    return (await pbkdf2Password(password, salt, Number(rounds))) === stored;
  }
  if (String(stored).startsWith('sha256$')) {
    const salt = String(stored).split('$')[1];
    return (await hashPassword(password, salt)) === stored;
  }
  return stored === password;
}

/** Login portal kind: individual | company | gov (company/gov exclude individual plans). */
function accountPortalKind(account) {
  if (String(account?.plan || '').toLowerCase() === 'individual') return 'individual';
  return account?.orgType === 'gov' ? 'gov' : 'company';
}
function matchesPreferKind(account, preferKind) {
  if (!preferKind) return true;
  return accountPortalKind(account) === preferKind;
}
function normalizeOrgType(value) {
  return value === 'gov' ? 'gov' : 'company';
}

/* ----- login OTP (email second factor) ----- */
const OTP_TTL_MS = 10 * 60 * 1000;
async function createLoginOtp(base44, { kind, companyId, employeeId, email }) {
  const oldCodes = await base44.asServiceRole.entities.LoginOtp.filter({ email });
  const lastIssuedAt = oldCodes.reduce((latest, item) => Math.max(latest, Date.parse(item.created_date || '') || 0), 0);
  if (lastIssuedAt && Date.now() - lastIssuedAt < 60000) throw new Error('OTP_RATE_LIMIT');
  for (const old of oldCodes) await base44.asServiceRole.entities.LoginOtp.delete(old.id);
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  const code = String(100000 + (random[0] % 900000));
  const pendingId = crypto.randomUUID();
  await base44.asServiceRole.entities.LoginOtp.create({
    pendingId, kind, companyId, employeeId: employeeId || null, email,
    codeHash: await sha256Hex(pendingId + '::' + code),
    expiresAt: new Date(Date.now() + OTP_TTL_MS).toISOString(), attempts: 0,
  });
  const accounts = await base44.asServiceRole.entities.CompanyAccount.filter({ companyId });
  const language = SYSTEM_MAIL_COPY[accounts[0]?.emailLanguage] ? accounts[0].emailLanguage : 'en';
  const copy = systemMailCopy(language);
  await sendSystemEmail(base44, {
    to: email,
    subject: `PowerCare — ${copy.verifyTitle}`,
    body: `${copy.verifyLine}\n\n${code}\n\n${copy.valid}`,
    html: emailHtml({ title: copy.verifyTitle, lines: [copy.verifyLine], code, footerNote: copy.valid }),
  });
  return pendingId;
}

/* ----- session-based authorization ----- */
const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
async function makeSession(base44, companyId, userId, role) {
  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  await base44.asServiceRole.entities.CompanySession.create({
    companyId, token, userId: userId || null, role,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    lastSeenAt: new Date().toISOString(),
  });
  return token;
}
// Validates the caller: either the platform builder (Base44 admin) or a valid
// session token for this specific company — issued only at a successful login.
async function getAuth(base44, body) {
  const user = await base44.auth.me().catch(() => null);
  if (user && user.role === 'admin') return { role: 'owner', admin: true };
  const { sessionToken, companyId } = body;
  if (!sessionToken || !companyId) return null;
  const sessions = await base44.asServiceRole.entities.CompanySession.filter({ token: sessionToken, companyId });
  const s = sessions[0];
  if (!s || new Date(s.expiresAt).getTime() < Date.now()) return null;
  return { role: s.role, userId: s.userId };
}

/* ----- realtime change signal ----- */
// Bumps a tiny public counter after every write so other open devices get an
// instant realtime event and pull the changes immediately (instead of waiting
// for the next poll). The signal carries no data beyond companyId + version.
async function bumpSignal(base44, companyId) {
  try {
    const existing = await base44.asServiceRole.entities.SyncSignal.filter({ companyId });
    if (existing.length) {
      await base44.asServiceRole.entities.SyncSignal.update(existing[0].id, { version: (existing[0].version || 0) + 1 });
    } else {
      await base44.asServiceRole.entities.SyncSignal.create({ companyId, version: 1 });
    }
  } catch (e) {
    console.error('bumpSignal failed:', e.message);
  }
}

/* ----- delta sync ----- */
// Upserts a collection by diff: creates new records, updates only changed ones and
// deletes removed ones — instead of wiping and re-inserting everything on every sync.
async function diffSync(entity, current, incoming, key) {
  const seen = new Set();
  const toDelete = [];
  const currentByKey = new Map();
  for (const r of current) {
    if (seen.has(r[key])) { toDelete.push(r.id); continue; } // stray duplicate
    seen.add(r[key]);
    currentByKey.set(r[key], r);
  }
  const incomingKeys = new Set(incoming.map((r) => r[key]));
  const toCreate = [];
  const toUpdate = [];
  for (const rec of incoming) {
    const existing = currentByKey.get(rec[key]);
    if (!existing) { toCreate.push(rec); continue; }
    const changed = Object.keys(rec).some((k) => JSON.stringify(rec[k] ?? null) !== JSON.stringify(existing[k] ?? null));
    if (changed) toUpdate.push({ id: existing.id, ...rec });
  }
  for (const [k, r] of currentByKey) if (!incomingKeys.has(k)) toDelete.push(r.id);
  // Deletion-only changes must still bump a version stamp so other devices notice.
  if (!toCreate.length && !toUpdate.length && toDelete.length && incoming.length) {
    const survivor = currentByKey.get(incoming[0][key]);
    if (survivor) toUpdate.push({ id: survivor.id, ...incoming[0] });
  }
  if (toCreate.length) await entity.bulkCreate(toCreate);
  if (toUpdate.length) await entity.bulkUpdate(toUpdate);
  for (const id of toDelete) await entity.delete(id);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, companyId } = body;

    // Public workspace registry — name/CR lookup only. Never returns owner email,
    // passwords, employee rows, or payroll. Careers + staff login stay separate channels.
    if (action === 'publicWorkspaceSearch') {
      const gate = checkWorkspaceSearchGate(body.query ?? body.q);
      if (!gate.ok) {
        return Response.json({ error: gate.error, reason: gate.reason, reasonEn: gate.reasonEn, results: [] }, { status: 400 });
      }
      const accounts = await base44.asServiceRole.entities.CompanyAccount.list('-created_date', 500);
      const eligible = accounts.filter((account) => {
        if (!account?.companyId || account.frozen === true) return false;
        if (String(account.plan || '').toLowerCase() === 'individual') return false;
        return true;
      });

      const wantDigits = String(gate.query || '').replace(/\D/g, '');
      const crByCompany = new Map();
      if (wantDigits.length >= 4) {
        // Only load settings blobs when the query looks like a commercial registration.
        const [metaBlobs, legacyBlobs] = await Promise.all([
          base44.asServiceRole.entities.CompanyDataBlob.filter({ category: 'companyMeta' }),
          base44.asServiceRole.entities.CompanyDataBlob.filter({ category: 'companySettings' }),
        ]);
        const takeCr = (blob) => {
          const raw = Array.isArray(blob?.payload) ? (blob.payload[0] || {}) : (blob?.payload && typeof blob.payload === 'object' ? blob.payload : {});
          const record = raw.record && typeof raw.record === 'object' ? raw.record : raw;
          const cr = String(record?.commercialRegistration || '').replace(/\D/g, '');
          if (cr && blob.companyId) crByCompany.set(blob.companyId, cr);
        };
        for (const blob of legacyBlobs) takeCr(blob);
        for (const blob of metaBlobs) takeCr(blob);
      }

      const matched = [];
      for (const account of eligible) {
        const cr = crByCompany.get(account.companyId) || '';
        if (!accountMatchesWorkspaceQuery(account, gate.query, cr)) continue;
        matched.push(account);
        if (matched.length >= WORKSPACE_SEARCH_MAX) break;
      }

      const results = [];
      for (const account of matched) {
        const [stations, employees] = await Promise.all([
          base44.asServiceRole.entities.Station.filter({ companyId: account.companyId }),
          base44.asServiceRole.entities.Employee.filter({ companyId: account.companyId }),
        ]);
        results.push(derivePublicWorkspaceCard(account, {
          sites: stations.length,
          staff: employees.length,
          commercialRegistration: crByCompany.get(account.companyId) || '',
        }));
      }

      return Response.json({
        ok: true,
        query: gate.query,
        results,
        employees: null,
        ownerEmail: null,
      });
    }

    // Google verifies the email identity. It may belong to company owners, employees,
    // or both; when several workspaces match, the user chooses one explicitly.
    if (action === 'googleOwnerLogin') {
      const user = await base44.auth.me().catch(() => null);
      const email = String(user?.email || '').trim().toLowerCase();
      if (!email) return Response.json({ error: 'Google authentication required' }, { status: 401 });
      const [ownerAccounts, credentials] = await Promise.all([
        base44.asServiceRole.entities.CompanyAccount.filter({ ownerEmail: email }, '-created_date'),
        base44.asServiceRole.entities.EmployeeCredential.filter({ email }, '-created_date'),
      ]);
      const wantIndividual = body.preferKind === 'individual';
      const ownerMatches = body.preferKind
        ? ownerAccounts.filter((account) => matchesPreferKind(account, body.preferKind))
        : ownerAccounts;
      const options = ownerMatches.map((account) => ({
        accountKey: `owner:${account.companyId}`, kind: 'owner', companyId: account.companyId,
        name: account.name || 'PowerCare', plan: account.plan || '', orgType: accountPortalKind(account),
      }));
      if (!wantIndividual) {
        for (const credential of credentials) {
          const [accounts, employees] = await Promise.all([
            base44.asServiceRole.entities.CompanyAccount.filter({ companyId: credential.companyId }),
            base44.asServiceRole.entities.Employee.filter({ companyId: credential.companyId, employeeId: credential.employeeId }),
          ]);
          if (accounts[0] && employees[0] && matchesPreferKind(accounts[0], body.preferKind)) options.push({
            accountKey: `employee:${credential.companyId}:${credential.employeeId}`,
            kind: 'employee', companyId: credential.companyId, employeeId: credential.employeeId,
            name: accounts[0].name || 'PowerCare', employeeName: employees[0].name || email,
            orgType: accountPortalKind(accounts[0]),
          });
        }
      }
      const uniqueOptions = [...new Map(options.map((option) => [option.accountKey, option])).values()];
      options.length = 0;
      options.push(...uniqueOptions);
      if (!options.length) return Response.json({ error: 'No workspace is linked to this Google account' }, { status: 404 });
      if (!body.accountKey && options.length > 1) return Response.json({ selectionRequired: true, accounts: options });
      const selected = body.accountKey ? options.find((option) => option.accountKey === body.accountKey) : options[0];
      if (!selected) return Response.json({ error: 'Workspace not found' }, { status: 404 });
      const accounts = await base44.asServiceRole.entities.CompanyAccount.filter({ companyId: selected.companyId });
      const account = accounts[0];
      const pendingId = await createLoginOtp(base44, {
        kind: selected.kind,
        companyId: selected.companyId,
        employeeId: selected.employeeId || null,
        email,
      });
      return Response.json({ otpRequired: true, pendingId, email, accountKey: selected.accountKey });
    }

    // Company registration always starts with ownership verification by email.
    if (action === 'startSignupOtp') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });
      const existing = await base44.asServiceRole.entities.CompanyAccount.filter({ ownerEmail: email });
      const newIsIndividual = String(body.plan || '').toLowerCase() === 'individual';
      const signupOrg = newIsIndividual ? 'individual' : normalizeOrgType(body.orgType);
      const sameKind = existing.some((account) => accountPortalKind(account) === signupOrg);
      if (sameKind) return Response.json({ error: 'email_exists' }, { status: 409 });
      const pendingId = await createLoginOtp(base44, { kind: 'signup', companyId: 'pending-signup', email });
      return Response.json({ otpRequired: true, pendingId });
    }

    // Cross-device login lookup — doesn't need a companyId yet, since the caller is
    // trying to discover which company an email/password combination belongs to.
    if (action === 'findAccountByEmail') {
      const email = String(body.email || '').trim().toLowerCase();
      const { password } = body;
      if (!email || !password) return Response.json({ error: 'Missing credentials' }, { status: 400 });
      const accounts = await base44.asServiceRole.entities.CompanyAccount.filter({ ownerEmail: email }, '-created_date');
      // One email may own several accounts (e.g. a company AND a personal/individual
      // workspace) — collect every account this password unlocks so the client can
      // let the user pick which one to enter after the OTP step.
      const allMatches = [];
      for (const account of accounts) {
        if (await verifyPassword(password, account.ownerPassword)) allMatches.push(account);
      }
      // Enforce the chosen login tab server-side: a "Company Login" attempt only ever
      // considers company accounts (and vice versa). If the password unlocked accounts
      // but none of the chosen kind, tell the client explicitly instead of routing
      // the user into the wrong workspace.
      const wantIndividual = body.preferKind === 'individual';
      const matches = body.preferKind
        ? allMatches.filter((a) => matchesPreferKind(a, body.preferKind))
        : allMatches;
      if (allMatches.length && !matches.length) return Response.json({ wrongKind: true });
      const found = matches[0] || null;
      if (!found) return Response.json({ company: null });
      // Upgrade legacy plaintext/SHA-256 records to slow PBKDF2 after a valid login.
      if (!String(found.ownerPassword).startsWith('pbkdf2$')) {
        await base44.asServiceRole.entities.CompanyAccount.update(found.id, { ownerPassword: await pbkdf2Password(password) });
      }
      // Password verified — second factor for owners too: email a one-time code
      // instead of issuing the session directly (OTP is mandatory for everyone).
      const pendingId = await createLoginOtp(base44, { kind: 'owner', companyId: found.companyId, email: found.ownerEmail });
      return Response.json({
        otpRequired: true, pendingId,
        accounts: matches.map((a) => ({ companyId: a.companyId, name: a.name, plan: a.plan, orgType: accountPortalKind(a) })),
      });
    }

    // Per-employee login — each employee signs in with their own email + personal password.
    if (action === 'employeeLogin') {
      const { email, password } = body;
      if (!email || !password) return Response.json({ error: 'Missing credentials' }, { status: 400 });
      const creds = await base44.asServiceRole.entities.EmployeeCredential.filter({ email: String(email).toLowerCase() });
      let match = null;
      for (const c of creds) {
        if (await verifyPassword(password, c.passwordHash)) { match = c; break; }
      }
      if (!match) return Response.json({ employee: null });
      if (body.preferKind && body.preferKind !== 'individual') {
        const accounts = await base44.asServiceRole.entities.CompanyAccount.filter({ companyId: match.companyId });
        if (accounts[0] && !matchesPreferKind(accounts[0], body.preferKind)) {
          return Response.json({ wrongKind: true });
        }
      }
      // Password verified — second factor: email a one-time code instead of issuing a session.
      const pendingId = await createLoginOtp(base44, { kind: 'employee', companyId: match.companyId, employeeId: match.employeeId, email: match.email });
      return Response.json({ otpRequired: true, pendingId });
    }

    // Unified password recovery for owners and employees. The response never reveals
    // whether the email exists; after email verification, every credential controlled
    // by that address receives the new password.
    if (action === 'requestPasswordReset') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });
      const [accounts, credentials] = await Promise.all([
        base44.asServiceRole.entities.CompanyAccount.filter({ ownerEmail: email }, '-created_date'),
        base44.asServiceRole.entities.EmployeeCredential.filter({ email }, '-created_date'),
      ]);
      const target = accounts[0]
        ? { companyId: accounts[0].companyId, employeeId: null }
        : credentials[0]
          ? { companyId: credentials[0].companyId, employeeId: credentials[0].employeeId }
          : null;
      const pendingId = target
        ? await createLoginOtp(base44, { kind: 'password_reset', companyId: target.companyId, employeeId: target.employeeId, email })
        : crypto.randomUUID();
      return Response.json({ ok: true, pendingId });
    }

    if (action === 'resetPassword') {
      const { pendingId, code, newPassword } = body;
      const email = String(body.email || '').trim().toLowerCase();
      if ((!pendingId && !email) || !code || String(newPassword || '').length < 6) return Response.json({ error: 'Invalid fields' }, { status: 400 });
      let recs = email
        ? await base44.asServiceRole.entities.LoginOtp.filter({ email, kind: 'password_reset' }, '-created_date', 1)
        : [];
      if (!recs[0] && pendingId) recs = await base44.asServiceRole.entities.LoginOtp.filter({ pendingId });
      const rec = recs[0];
      if (!rec || rec.kind !== 'password_reset' || new Date(rec.expiresAt).getTime() < Date.now() || (rec.attempts || 0) >= 5) {
        return Response.json({ error: 'invalid_or_expired' }, { status: 401 });
      }
      const codeHash = await sha256Hex(rec.pendingId + '::' + String(code).trim());
      if (codeHash !== rec.codeHash) {
        await base44.asServiceRole.entities.LoginOtp.update(rec.id, { attempts: (rec.attempts || 0) + 1 });
        return Response.json({ error: 'invalid_code' }, { status: 401 });
      }
      const [accounts, credentials] = await Promise.all([
        base44.asServiceRole.entities.CompanyAccount.filter({ ownerEmail: rec.email }),
        base44.asServiceRole.entities.EmployeeCredential.filter({ email: rec.email }),
      ]);
      const passwordHash = await pbkdf2Password(String(newPassword));
      if (accounts.length) await base44.asServiceRole.entities.CompanyAccount.bulkUpdate(accounts.map((account) => ({ id: account.id, ownerPassword: passwordHash })));
      if (credentials.length) await base44.asServiceRole.entities.EmployeeCredential.bulkUpdate(credentials.map((credential) => ({ id: credential.id, passwordHash })));
      await base44.asServiceRole.entities.LoginOtp.delete(rec.id);
      return Response.json({ ok: true });
    }

    // Secure owner password recovery: requesting a reset never reveals whether an email exists.
    if (action === 'requestOwnerPasswordReset') {
      const email = String(body.email || '').trim().toLowerCase();
      if (!email) return Response.json({ error: 'Missing email' }, { status: 400 });
      const accounts = await base44.asServiceRole.entities.CompanyAccount.filter({ ownerEmail: email }, '-created_date');
      const account = accounts[0];
      const pendingId = account
        ? await createLoginOtp(base44, { kind: 'owner_reset', companyId: account.companyId, email: account.ownerEmail })
        : crypto.randomUUID();
      return Response.json({ ok: true, pendingId });
    }

    if (action === 'resetOwnerPassword') {
      const { pendingId, code, newPassword } = body;
      const email = String(body.email || '').trim().toLowerCase();
      if ((!pendingId && !email) || !code || String(newPassword || '').length < 6) return Response.json({ error: 'Invalid fields' }, { status: 400 });
      let recs = email
        ? await base44.asServiceRole.entities.LoginOtp.filter({ email, kind: 'owner_reset' }, '-created_date', 1)
        : [];
      if (!recs[0] && pendingId) {
        recs = await base44.asServiceRole.entities.LoginOtp.filter({ pendingId });
      }
      const rec = recs[0];
      if (!rec || rec.kind !== 'owner_reset' || new Date(rec.expiresAt).getTime() < Date.now() || (rec.attempts || 0) >= 5) {
        return Response.json({ error: 'invalid_or_expired' }, { status: 401 });
      }
      const codeHash = await sha256Hex(rec.pendingId + '::' + String(code).trim());
      if (codeHash !== rec.codeHash) {
        await base44.asServiceRole.entities.LoginOtp.update(rec.id, { attempts: (rec.attempts || 0) + 1 });
        return Response.json({ error: 'invalid_code' }, { status: 401 });
      }
      const accounts = await base44.asServiceRole.entities.CompanyAccount.filter({ companyId: rec.companyId });
      if (!accounts[0]) return Response.json({ error: 'Account not found' }, { status: 404 });
      await base44.asServiceRole.entities.CompanyAccount.update(accounts[0].id, { ownerPassword: await pbkdf2Password(String(newPassword)) });
      await base44.asServiceRole.entities.LoginOtp.delete(rec.id);
      return Response.json({ ok: true });
    }

    // Second login step — verifies the emailed code and only then issues the session.
    if (action === 'verifyLoginOtp') {
      const { pendingId, code } = body;
      if (!pendingId || !code) return Response.json({ error: 'Missing fields' }, { status: 400 });
      const recs = await base44.asServiceRole.entities.LoginOtp.filter({ pendingId });
      const rec = recs[0];
      if (!rec || new Date(rec.expiresAt).getTime() < Date.now()) {
        return Response.json({ error: 'expired' }, { status: 401 });
      }
      if ((rec.attempts || 0) >= 5) return Response.json({ error: 'too_many_attempts' }, { status: 401 });
      const hash = await sha256Hex(pendingId + '::' + String(code).trim());
      if (hash !== rec.codeHash) {
        await base44.asServiceRole.entities.LoginOtp.update(rec.id, { attempts: (rec.attempts || 0) + 1 });
        return Response.json({ error: 'invalid_code' }, { status: 401 });
      }
      await base44.asServiceRole.entities.LoginOtp.delete(rec.id);
      // Owner emails may own multiple accounts — honor the account the user chose,
      // but only if that account really belongs to the same verified email.
      let targetCompanyId = rec.companyId;
      if (rec.kind === 'owner' && body.chooseCompanyId && body.chooseCompanyId !== rec.companyId) {
        const chosen = await base44.asServiceRole.entities.CompanyAccount.filter({ companyId: body.chooseCompanyId, ownerEmail: rec.email });
        if (chosen[0]) targetCompanyId = body.chooseCompanyId;
      }
      const accounts = await base44.asServiceRole.entities.CompanyAccount.filter({ companyId: targetCompanyId });
      const acc = accounts[0] || {};
      if (rec.kind === 'owner') {
        const { ownerPassword: _pw2, ...safe } = acc;
        const metaRows = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId: targetCompanyId, category: 'companyMeta' });
        const ownerId = metaRows[0]?.payload?.[0]?.ownerId || null;
        const token = await makeSession(base44, targetCompanyId, null, 'owner');
        return Response.json({ kind: 'owner', company: safe, token, ownerId });
      }
      const token = await makeSession(base44, rec.companyId, rec.employeeId, 'employee');
      return Response.json({
        kind: 'employee', token,
        employee: { companyId: rec.companyId, employeeId: rec.employeeId },
        company: { companyId: rec.companyId, name: acc.name || '', plan: acc.plan || '', orgType: accountPortalKind(acc), allowedEmailDomain: acc.allowedEmailDomain || '', ownerEmail: acc.ownerEmail || '', emailLanguage: acc.emailLanguage || 'en', subscriptionStart: acc.subscriptionStart || null, subscriptionEnd: acc.subscriptionEnd || null, subscriptionExempt: acc.subscriptionExempt === true, frozen: acc.frozen === true, frozenAt: acc.frozenAt || null, frozenReason: acc.frozenReason || null },
      });
    }

    if (!companyId) return Response.json({ error: 'Missing companyId' }, { status: 400 });

    // Public existence check — lets clients detect a deleted account and sign out
    // instead of rendering a blank app from a stale session.
    if (action === 'accountExists') {
      const accounts = await base44.asServiceRole.entities.CompanyAccount.filter({ companyId });
      const account = accounts[0];
      return Response.json({ exists: !!account, name: account?.name || '', plan: account?.plan || '', orgType: account ? accountPortalKind(account) : '', subscriptionStart: account?.subscriptionStart || null, subscriptionEnd: account?.subscriptionEnd || null, subscriptionExempt: account?.subscriptionExempt === true, frozen: account?.frozen === true, frozenAt: account?.frozenAt || null, frozenReason: account?.frozenReason || null });
    }

    /* ----- server-side authorization for all company-scoped actions ----- */
    const auth = await getAuth(base44, body);

    if (action === 'syncAccount') {
      const { name, ownerEmail, ownerPassword, plan, allowedEmailDomain, emailLanguage, subscriptionStart, subscriptionEnd } = body;
      const existing = await base44.asServiceRole.entities.CompanyAccount.filter({ companyId });
      const email = String(ownerEmail || '').trim().toLowerCase();
      const newIsIndividual = String(plan || '').toLowerCase() === 'individual';
      const orgType = newIsIndividual ? 'company' : normalizeOrgType(body.orgType ?? existing[0]?.orgType);
      let signupOtp = null;

      if (body.signupPendingId) {
        const otpRows = await base44.asServiceRole.entities.LoginOtp.filter({ pendingId: body.signupPendingId });
        const candidate = otpRows[0];
        if (candidate && candidate.kind === 'signup' && candidate.email === email && new Date(candidate.expiresAt).getTime() >= Date.now() && (candidate.attempts || 0) < 5) {
          const otpHash = await sha256Hex(candidate.pendingId + '::' + String(body.signupOtpCode || '').trim());
          if (otpHash !== candidate.codeHash) {
            await base44.asServiceRole.entities.LoginOtp.update(candidate.id, { attempts: (candidate.attempts || 0) + 1 });
            return Response.json({ error: 'invalid_code' }, { status: 401 });
          }
          signupOtp = candidate;
        }
      }

      // If account creation completed but the browser lost the response, the same
      // verified signup request may safely finish the owner session on retry.
      const canResumeSignup = existing.length > 0 && signupOtp && String(existing[0].ownerEmail || '').trim().toLowerCase() === email;
      if (existing.length && (!auth || auth.role !== 'owner') && !canResumeSignup) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (!existing.length && !signupOtp) {
        return Response.json({ error: 'signup_otp_required' }, { status: 401 });
      }

      let storedPassword = ownerPassword;
      if (storedPassword && !String(storedPassword).startsWith('pbkdf2$')) {
        storedPassword = await pbkdf2Password(storedPassword);
      } else if (!storedPassword && existing.length) {
        storedPassword = existing[0].ownerPassword;
      }

      if (!existing.length) {
        const dupes = await base44.asServiceRole.entities.CompanyAccount.filter({ ownerEmail: email });
        const signupPortal = newIsIndividual ? 'individual' : orgType;
        const sameKind = dupes.some((account) => accountPortalKind(account) === signupPortal);
        if (sameKind) return Response.json({ error: 'email_exists' }, { status: 409 });
      }

      const supportedEmailLanguages = ['en', 'ar', 'de', 'fr', 'es', 'pt', 'ru', 'ja', 'ko'];
      const fields = { companyId, name, ownerEmail: email, ownerPassword: storedPassword, plan, orgType, allowedEmailDomain: allowedEmailDomain || '', emailLanguage: supportedEmailLanguages.includes(emailLanguage) ? emailLanguage : (existing[0]?.emailLanguage || 'en'), subscriptionStart: Object.prototype.hasOwnProperty.call(body, 'subscriptionStart') ? subscriptionStart : (existing[0]?.subscriptionStart ?? null), subscriptionEnd: Object.prototype.hasOwnProperty.call(body, 'subscriptionEnd') ? subscriptionEnd : (existing[0]?.subscriptionEnd ?? null) };
      let token = null;
      if (existing.length) {
        await base44.asServiceRole.entities.CompanyAccount.update(existing[0].id, fields);
        if (canResumeSignup) token = await makeSession(base44, companyId, null, 'owner');
      } else {
        await base44.asServiceRole.entities.CompanyAccount.create(fields);
        token = await makeSession(base44, companyId, null, 'owner');
      }
      const ownerId = String(body.ownerId || '').trim() || (existing.length ? '' : `emp_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`);
      const ownerName = String(body.ownerName || email.split('@')[0] || 'Owner').trim();
      if (ownerId) {
        const owners = await base44.asServiceRole.entities.Employee.filter({ companyId, employeeId: ownerId });
        if (!owners.length) {
          const row = creatorEmployeeRecord({ ownerId, name: ownerName, email, companyId });
          await base44.asServiceRole.entities.Employee.create({
            employeeId: row.id,
            companyId,
            name: row.name,
            email: row.email,
            role: row.role,
            stationId: row.stationId,
            phone: row.phone,
            anonymousId: row.anonymousId,
          });
        }
        const metaRows = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: 'companyMeta' });
        const currentMeta = metaRows[0]?.payload?.[0] || {};
        if (!metaRows.length) {
          await base44.asServiceRole.entities.CompanyDataBlob.create({
            companyId,
            category: 'companyMeta',
            payload: [companyMetaCreatePayload({ name, plan, ownerId, directorId: ownerId, settings: { orgType } })],
          });
        } else if (!currentMeta.ownerId) {
          const payload = Array.isArray(metaRows[0].payload) ? [...metaRows[0].payload] : [{}];
          payload[0] = { ...currentMeta, ...companyMetaCreatePayload({ ...currentMeta, name: currentMeta.name || name, plan: currentMeta.plan || plan, ownerId, directorId: currentMeta.directorId || ownerId, settings: currentMeta.settings || { orgType } }) };
          await base44.asServiceRole.entities.CompanyDataBlob.update(metaRows[0].id, { payload });
        }
      }
      if (signupOtp) await base44.asServiceRole.entities.LoginOtp.delete(signupOtp.id);
      return Response.json({ ok: true, token, ownerId: ownerId || null });
    }

    if (!auth) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Track visible website sessions independently from physical attendance.
    if (action === 'presenceHeartbeat') {
      const sessions = await base44.asServiceRole.entities.CompanySession.filter({ token: body.sessionToken, companyId });
      if (sessions[0]) await base44.asServiceRole.entities.CompanySession.update(sessions[0].id, { lastSeenAt: new Date().toISOString() });
      return Response.json({ ok: true });
    }

    if (action === 'getOnlineEmployees') {
      const cutoff = Date.now() - 90000;
      const sessions = await base44.asServiceRole.entities.CompanySession.filter({ companyId });
      const employeeIds = [...new Set(sessions
        .filter((session) => session.userId && new Date(session.expiresAt).getTime() > Date.now() && new Date(session.lastSeenAt || 0).getTime() >= cutoff)
        .map((session) => session.userId))];
      return Response.json({ employeeIds });
    }

    if (action === 'getNiroMemory' || action === 'saveNiroMemory') {
      const actorKey = auth.role === 'owner' || auth.admin ? 'owner' : auth.userId;
      if (!actorKey) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const category = `niroMemory:${actorKey}`;
      const records = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category });
      if (action === 'getNiroMemory') return Response.json({ memory: records[0]?.payload || [] });
      const memory = (Array.isArray(body.memory) ? body.memory : []).map((item) => String(item).trim().slice(0, 500)).filter(Boolean).slice(-20);
      if (records[0]) await base44.asServiceRole.entities.CompanyDataBlob.update(records[0].id, { payload: memory.map((text) => ({ text })) });
      else await base44.asServiceRole.entities.CompanyDataBlob.create({ companyId, category, payload: memory.map((text) => ({ text })) });
      return Response.json({ ok: true, memory });
    }

    if (action === 'updateEmailLanguage') {
      if (auth.role !== 'owner' && !auth.admin) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const supported = ['en', 'ar', 'de', 'fr', 'es', 'pt', 'ru', 'ja', 'ko'];
      if (!supported.includes(body.emailLanguage)) return Response.json({ error: 'Unsupported language' }, { status: 400 });
      const accounts = await base44.asServiceRole.entities.CompanyAccount.filter({ companyId });
      if (!accounts[0]) return Response.json({ error: 'Account not found' }, { status: 404 });
      await base44.asServiceRole.entities.CompanyAccount.update(accounts[0].id, { emailLanguage: body.emailLanguage });
      return Response.json({ ok: true, emailLanguage: body.emailLanguage });
    }

    // Server-side privilege of the acting user, derived from the server's own
    // Employee record (never from the request body):
    // - 'full': owner/admin sessions, managers and HR staff — may modify company data.
    // - 'self': regular employees — may only edit their own non-privileged fields.
    // - 'none': session user no longer exists in this company.
    let actorContextPromise = null;
    const getActorContext = async () => {
      if (actorContextPromise) return actorContextPromise;
      actorContextPromise = (async () => {
        if (auth.admin || auth.role === 'owner') return { actor: null, permissions: new Set(), scope: null, senior: true };
        const actors = await base44.asServiceRole.entities.Employee.filter({ companyId, employeeId: auth.userId });
        const actor = actors[0] || null;
        if (!actor) return { actor: null, permissions: new Set(), scope: [], senior: false };
        if (['director', 'ops_manager'].includes(actor.role)) return { actor, permissions: new Set(), scope: null, senior: true };
        const levelRows = actor.hrLevelId ? await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: 'hrLevels' }) : [];
        const level = (levelRows[0]?.payload || []).find((item) => item.id === actor.hrLevelId && item.active !== false) || null;
        const permissions = new Set(level?.permissions || []);
        let scope = [];
        if (actor.role === 'pgm') scope = actor.managedStations || [];
        else if (actor.role === 'station_manager') scope = (actor.managedStations?.length ? actor.managedStations : [actor.stationId]).filter(Boolean);
        else if (level?.stationIds?.length) scope = level.stationIds;
        else if (level?.scope === 'station') scope = actor.hrStationId ? [actor.hrStationId] : [];
        else if (level?.scope === 'cluster') {
          const clusterRows = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: 'hrClusters' });
          const cluster = (clusterRows[0]?.payload || []).find((item) => item.id === actor.hrClusterId);
          scope = cluster?.stationIds || [];
        } else if (level) scope = null;
        return { actor, permissions, scope, senior: false };
      })();
      return actorContextPromise;
    };
    const getActorPrivilege = async () => {
      const context = await getActorContext();
      if (context.senior) return 'full';
      if (!context.actor) return 'none';
      if (['pgm', 'station_manager'].includes(context.actor.role) || context.actor.hrLevelId) return 'full';
      return 'self';
    };

    if (action === 'registerAnonymousReceipt') {
      if (auth.role !== 'employee' || !auth.userId || !body.reportId) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const reportId = String(body.reportId).slice(0, 100);
      const existing = await base44.asServiceRole.entities.AnonymousReportReceipt.filter({ companyId, reportId });
      if (existing.length && existing[0].employeeId !== auth.userId) return Response.json({ error: 'Receipt already registered' }, { status: 409 });
      if (!existing.length) await base44.asServiceRole.entities.AnonymousReportReceipt.create({ companyId, reportId, employeeId: auth.userId });
      return Response.json({ ok: true });
    }

    if (action === 'getMyAnonymousReportIds') {
      if (auth.role !== 'employee' || !auth.userId) return Response.json({ reportIds: [] });
      const receipts = await base44.asServiceRole.entities.AnonymousReportReceipt.filter({ companyId, employeeId: auth.userId });
      return Response.json({ reportIds: receipts.map((receipt) => receipt.reportId) });
    }

    if (action === 'notifyAnonymousAuthor') {
      const privilege = await getActorPrivilege();
      if (privilege !== 'full' || !body.reportId || !String(body.text || '').trim()) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const receipts = await base44.asServiceRole.entities.AnonymousReportReceipt.filter({ companyId, reportId: String(body.reportId) });
      if (!receipts[0]) return Response.json({ ok: true });
      const notificationBlobs = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: 'notifications' });
      const notifications = Array.isArray(notificationBlobs[0]?.payload) ? [...notificationBlobs[0].payload] : [];
      notifications.unshift({ id: `ntf_${crypto.randomUUID()}`, userId: receipts[0].employeeId, text: String(body.text).slice(0, 500), read: false, createdAt: new Date().toISOString() });
      if (notificationBlobs[0]) await base44.asServiceRole.entities.CompanyDataBlob.update(notificationBlobs[0].id, { payload: notifications });
      else await base44.asServiceRole.entities.CompanyDataBlob.create({ companyId, category: 'notifications', payload: notifications });
      await bumpSignal(base44, companyId);
      return Response.json({ ok: true });
    }

    if (action === 'revokeSession') {
      const sessions = await base44.asServiceRole.entities.CompanySession.filter({ token: body.sessionToken, companyId });
      for (const session of sessions) await base44.asServiceRole.entities.CompanySession.delete(session.id);
      return Response.json({ ok: true });
    }

    // Offboarding keeps the employee record and history, but permanently revokes login credentials and active sessions.
    if (action === 'disableEmployeeAccess') {
      const { employeeId } = body;
      if (!employeeId || (auth.userId && auth.userId === employeeId)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const context = await getActorContext();
      if (!context.senior && !context.permissions.has('manage_employees')) return Response.json({ error: 'HR employee-management access required' }, { status: 403 });
      const targets = await base44.asServiceRole.entities.Employee.filter({ companyId, employeeId });
      if (!targets[0]) return Response.json({ error: 'Employee not found' }, { status: 404 });
      if (!context.senior && context.scope !== null && !context.scope.includes(targets[0].stationId)) return Response.json({ error: 'Employee is outside your station scope' }, { status: 403 });
      const meta = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: 'companyMeta' });
      if (meta[0]?.payload?.[0]?.ownerId === employeeId) return Response.json({ error: 'Company owner cannot be offboarded' }, { status: 403 });
      const credentials = await base44.asServiceRole.entities.EmployeeCredential.filter({ companyId, employeeId });
      const sessions = await base44.asServiceRole.entities.CompanySession.filter({ companyId, userId: employeeId });
      for (const credential of credentials) await base44.asServiceRole.entities.EmployeeCredential.delete(credential.id);
      for (const session of sessions) await base44.asServiceRole.entities.CompanySession.delete(session.id);
      await base44.asServiceRole.entities.AuditLog.create({ companyId, action: 'employee_offboarded', performedBy: context.actor?.name || 'Company owner', details: `Employee access disabled and profile retained: ${targets[0].name || employeeId}.` });
      await bumpSignal(base44, companyId);
      return Response.json({ ok: true });
    }

    // Employee account deletion is available to the company owner and assigned HR staff.
    // It also revokes credentials and active sessions so the removed employee cannot sign in again.
    if (action === 'deleteEmployeeAccount') {
      const { employeeId } = body;
      if (!employeeId || (auth.userId && auth.userId === employeeId)) return Response.json({ error: 'Forbidden' }, { status: 403 });
      let performedBy = 'Company owner';
      if (auth.role !== 'owner' && !auth.admin) {
        const context = await getActorContext();
        if (!context.actor || (!['director', 'ops_manager'].includes(context.actor.role) && !context.permissions.has('manage_employees'))) {
          return Response.json({ error: 'HR employee-management access required' }, { status: 403 });
        }
        performedBy = context.actor.name || 'HR';
      }
      const targets = await base44.asServiceRole.entities.Employee.filter({ companyId, employeeId });
      const actorContext = await getActorContext();
      if (!actorContext.senior && actorContext.scope !== null && !actorContext.scope.includes(targets[0]?.stationId)) {
        return Response.json({ error: 'Employee is outside your station scope' }, { status: 403 });
      }
      if (!targets.length) return Response.json({ error: 'Employee not found' }, { status: 404 });
      const meta = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: 'companyMeta' });
      if (meta[0]?.payload?.[0]?.ownerId === employeeId) return Response.json({ error: 'Company owner cannot be deleted' }, { status: 403 });
      const credentials = await base44.asServiceRole.entities.EmployeeCredential.filter({ companyId, employeeId });
      const sessions = await base44.asServiceRole.entities.CompanySession.filter({ companyId, userId: employeeId });
      for (const record of credentials) await base44.asServiceRole.entities.EmployeeCredential.delete(record.id);
      for (const session of sessions) await base44.asServiceRole.entities.CompanySession.delete(session.id);
      for (const target of targets) await base44.asServiceRole.entities.Employee.delete(target.id);
      await base44.asServiceRole.entities.AuditLog.create({ companyId, action: 'employee_account_deleted', performedBy, details: `Employee account deleted: ${targets[0].name || employeeId}.` });
      await bumpSignal(base44, companyId);
      return Response.json({ ok: true });
    }

    // Password changes are allowed for the owner, the employee themself, or a
    // company-wide director/operations manager creating access for their team.
    if (action === 'setEmployeePassword') {
      const { employeeId, email, password } = body;
      if (!employeeId || !email || !password) return Response.json({ error: 'Missing fields' }, { status: 400 });
      let canSetPassword = auth.role === 'owner' || auth.userId === employeeId;
      if (!canSetPassword && auth.userId) {
        const actors = await base44.asServiceRole.entities.Employee.filter({ companyId, employeeId: auth.userId });
        canSetPassword = ['director', 'ops_manager'].includes(actors[0]?.role);
      }
      if (!canSetPassword) return Response.json({ error: 'Forbidden' }, { status: 403 });

      const normalizedEmail = String(email).trim().toLowerCase();
      const stored = await pbkdf2Password(password);
      const fields = { companyId, employeeId, email: normalizedEmail, passwordHash: stored };
      const existing = await base44.asServiceRole.entities.EmployeeCredential.filter({ companyId, employeeId });
      if (existing.length) {
        await base44.asServiceRole.entities.EmployeeCredential.update(existing[0].id, fields);
      } else {
        await base44.asServiceRole.entities.EmployeeCredential.create(fields);
      }

      let emailSent = false;
      try {
        const [employees, accounts] = await Promise.all([
          base44.asServiceRole.entities.Employee.filter({ companyId, employeeId }),
          base44.asServiceRole.entities.CompanyAccount.filter({ companyId }),
        ]);
        const employeeName = employees[0]?.name || normalizedEmail;
        const companyName = accounts[0]?.name || 'PowerCare';
        const language = SYSTEM_MAIL_COPY[accounts[0]?.emailLanguage] ? accounts[0].emailLanguage : 'en';
        const copy = systemMailCopy(language);
        const readyLine = `${employeeName} — ${copy.employeeReady} ${companyName}`;
        await sendSystemEmail(base44, {
          to: normalizedEmail,
          subject: `PowerCare — ${copy.employeeTitle}`,
          body: `${readyLine}\n\n${copy.employeeAccess}`,
          html: emailHtml({ title: copy.employeeTitle, lines: [readyLine, copy.employeeAccess] }),
        });
        emailSent = true;
      } catch (emailError) {
        console.error('Employee welcome email failed:', emailError.message);
      }
      return Response.json({ ok: true, emailSent });
    }

    if (action === 'syncEmployees') {
      const { employees } = body;
      const incoming = (Array.isArray(employees) ? employees : []).map(({ id, ...rest }) => ({ ...rest, employeeId: id, companyId }));
      const current = await base44.asServiceRole.entities.Employee.filter({ companyId });
      if (current.length > 0 && incoming.length === 0) {
        return Response.json({ error: 'Safety guard: an empty sync cannot erase the employee roster' }, { status: 409 });
      }
      const privilege = await getActorPrivilege();
      if (privilege === 'none') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const context = await getActorContext();
      const canManageGrades = auth.admin || auth.role === 'owner' || context.actor?.role === 'director' || context.permissions.has('manage_employees');
      const currentByEmployeeId = new Map(current.map((record) => [record.employeeId, record]));
      for (const record of incoming) {
        const previous = currentByEmployeeId.get(record.employeeId);
        if (!previous) continue;
        const gradeChanged = record.profile?.gradeId !== previous.profile?.gradeId || record.profile?.maxStations !== previous.profile?.maxStations;
        if (!gradeChanged) continue;
        if (!canManageGrades) return Response.json({ error: 'Job grade changes require Owner, Director, or HR access' }, { status: 403 });
        if (!context.senior && context.scope !== null && !context.scope.includes(previous.stationId)) {
          return Response.json({ error: 'Employee is outside your HR station scope' }, { status: 403 });
        }
      }
      if (privilege === 'self') {
        // Anti-privilege-escalation: a regular employee may not add/remove
        // employees, change anyone's role/permissions/HR position, or touch
        // another employee's profile (salary etc.). Own record edits are allowed.
        const PROTECTED = ['role', 'canManageTeam', 'managedStations', 'hrLevelId', 'hrStationId', 'hrClusterId', 'points'];
        const curByKey = new Map(current.map((r) => [r.employeeId, r]));
        const same = (rec, cur, k) => JSON.stringify(rec[k] ?? null) === JSON.stringify(cur[k] ?? null);
        if (incoming.length !== current.length || incoming.some((r) => !curByKey.has(r.employeeId))) {
          return Response.json({ error: 'Forbidden: roster changes require a manager' }, { status: 403 });
        }
        for (const rec of incoming) {
          const cur = curByKey.get(rec.employeeId);
          if (PROTECTED.some((k) => !same(rec, cur, k))) {
            return Response.json({ error: 'Forbidden: privileged fields require a manager' }, { status: 403 });
          }
          if (rec.employeeId !== auth.userId && !same(rec, cur, 'profile')) {
            return Response.json({ error: 'Forbidden: cannot edit another employee\'s profile' }, { status: 403 });
          }
        }
      }
      await diffSync(base44.asServiceRole.entities.Employee, current, incoming, 'employeeId');
      await bumpSignal(base44, companyId);
      return Response.json({ ok: true });
    }

    if (action === 'getEmployees') {
      const records = await base44.asServiceRole.entities.Employee.filter({ companyId });
      const context = await getActorContext();
      // Deny by default: HR messages, leave, certificates and profile/salary data are
      // returned only for the caller themself, or to HR/managers inside their scope.
      // Station / leave managers still receive leaveRequests + otherRequests so إدارة
      // can decide a leave-balance top-up without opening salary fields.
      if (context.senior) return Response.json({ employees: records });
      const canSeeFull = context.permissions.has('manage_employees');
      const canSeeRequests = canSeeEmployeeRequests(context);
      const stations = context.scope === null ? null : new Set(context.scope || []);
      const employees = records.map((record) => {
        if (record.employeeId === auth.userId) return record;
        const inStation = stations === null || stations.has(record.stationId);
        if (canSeeFull && inStation) return record;
        if (canSeeRequests && inStation) return attachEmployeeRequestFields(record, redactEmployee(record));
        return redactEmployee(record);
      });
      return Response.json({ employees });
    }

    if (action === 'syncStations') {
      const { stations } = body;
      // Only the owner/director may add or remove station definitions. Empty snapshots
      // are rejected below so an unhydrated browser can never erase persisted stations.
      const context = await getActorContext();
      if (!context.senior) return Response.json({ ok: true, ignored: true });
      const incoming = (Array.isArray(stations) ? stations : []).map(({ id, isHQ: _legacyFlag, ...rest }) => ({ ...rest, stationId: id, companyId }));
      const current = await base44.asServiceRole.entities.Station.filter({ companyId });
      if (current.length > 0 && incoming.length === 0) {
        return Response.json({ error: 'Safety guard: an empty sync cannot erase all stations' }, { status: 409 });
      }
      const canChangeStructure = auth.admin || auth.role === 'owner' || context.actor?.role === 'director';
      const incomingIds = new Set(incoming.map((station) => station.stationId));
      const structureChanged = incoming.length !== current.length || current.some((station) => !incomingIds.has(station.stationId));
      if (structureChanged && !canChangeStructure) return Response.json({ error: 'Only the owner or director may add or remove stations' }, { status: 403 });
      await diffSync(base44.asServiceRole.entities.Station, current, incoming, 'stationId');
      await bumpSignal(base44, companyId);
      return Response.json({ ok: true });
    }

    // Lightweight change detection — returns a per-collection version stamp so clients
    // can skip downloading collections that haven't changed since their last pull.
    if (action === 'getVersions') {
      const [emp, st, blobs] = await Promise.all([
        base44.asServiceRole.entities.Employee.filter({ companyId }, '-updated_date', 1),
        base44.asServiceRole.entities.Station.filter({ companyId }, '-updated_date', 1),
        base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId }),
      ]);
      const versions = {
        employees: emp[0]?.updated_date || null,
        stations: st[0]?.updated_date || null,
      };
      for (const b of blobs) versions['blob:' + b.category] = b.updated_date || null;
      return Response.json({ versions });
    }

    if (action === 'getStations') {
      const records = await base44.asServiceRole.entities.Station.filter({ companyId });
      return Response.json({ stations: records });
    }

    if (action === 'syncBlob') {
      const { category, payload } = body;
      if (!category) return Response.json({ error: 'Missing category' }, { status: 400 });
      // Deny by default: every writable snapshot must be explicitly listed with
      // the server-derived role or permission required to replace it.
      const context = await getActorContext();
      const actorRole = context.actor?.role;
      const privilege = await getActorPrivilege();
      let allowed = false;
      if (['companyMeta', 'files', 'orgTree', 'smartPositions', 'complaintEscalationChain', 'branchEscalationChains', 'workProofs', 'disciplinaryCases'].includes(category)) allowed = context.senior;
      else if (['hrLevels', 'hrClusters', 'jobGrades'].includes(category)) allowed = context.senior && (!context.actor || context.actor.role === 'director');
      else if (category === 'payrollRuns') allowed = context.senior || context.permissions.has('manage_payroll');
      else if (category === 'schedules') allowed = context.senior || ['pgm', 'station_manager'].includes(actorRole) || context.permissions.has('manage_schedules');
      else if (category === 'safety') allowed = context.senior || ['pgm', 'station_manager'].includes(actorRole);
      else if (['plans', 'templates', 'targets'].includes(category)) allowed = context.senior || ['pgm', 'station_manager'].includes(actorRole);
      else if (category === 'tasks') {
        const taskManagers = ['owner', 'director', 'ops_manager', 'pgm', 'station_manager', 'admin'];
        allowed = privilege === 'full' || context.senior
          || taskManagers.includes(actorRole) || taskManagers.includes(auth.role);
      }
      else if (['reports', 'anonymousReports', 'publicReports', 'notifications', 'personalPlaces', 'personalAttendance', 'plannerItems', 'journalEntries'].includes(category)) allowed = privilege === 'full';
      else if (category === 'leaveRoster') {
        allowed = privilege === 'full' || context.senior || context.permissions.has('manage_employees');
      }
      // Regular employees may write their OWN records in these categories — their
      // reports, personal entries, and own leave row must never be silently dropped.
      const SELF_WRITABLE = ['anonymousReports', 'publicReports', 'notifications', 'personalPlaces', 'personalAttendance', 'plannerItems', 'journalEntries', 'leaveRoster'];
      const selfWrite = !allowed && privilege === 'self' && SELF_WRITABLE.includes(category);
      // Never fail silently: a rejected write returns 403 so the UI can tell the user.
      if (!allowed && !selfWrite) return Response.json({ error: 'Forbidden: this data cannot be written by your role' }, { status: 403 });
      const existing = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category });
      let data = Array.isArray(payload) ? payload : [];
      const ownerOf = (item) => item.userId || item.employeeId || item.ownerId || item.createdBy || null;
      if (selfWrite) {
        // Merge: the employee's own records come from the client, everyone else's stay untouched.
        const mine = data.filter((item) => ownerOf(item) === auth.userId || !ownerOf(item));
        const others = (existing[0]?.payload || []).filter((item) => ownerOf(item) !== auth.userId);
        data = [...mine, ...others];
      }
      if (APPEND_ONLY_CATEGORIES.includes(category)) {
        // Evidence is never deletable. Records may only be archived — with an
        // archiver and a reason — and every archival is written to the audit trail.
        const actorName = context.actor?.name || (auth.role === 'owner' ? 'Company owner' : 'User');
        const check = inspectAppendOnly(existing[0]?.payload || [], data);
        if (check.missing.length) {
          return Response.json({
            error: `Evidence cannot be deleted. ${check.missing.length} record(s) in "${category}" are missing from this update — archive them instead (status: "archived" with archivedBy and archivedReason).`,
          }, { status: 409 });
        }
        if (check.invalidArchive.length) {
          return Response.json({ error: `Archiving a record in "${category}" requires both archivedBy and archivedReason.` }, { status: 400 });
        }
        for (const record of check.archived) {
          await base44.asServiceRole.entities.AuditLog.create({
            companyId, action: `${category}_record_archived`, performedBy: actorName,
            reason: String(record.archivedReason).slice(0, 500),
            details: `Record ${record.id} in "${category}" archived by ${record.archivedBy}.`,
          });
        }
      }
      if (existing.length) {
        await base44.asServiceRole.entities.CompanyDataBlob.update(existing[0].id, { payload: data });
        for (const extra of existing.slice(1)) {
          await base44.asServiceRole.entities.CompanyDataBlob.delete(extra.id);
        }
      } else {
        await base44.asServiceRole.entities.CompanyDataBlob.create({ companyId, category, payload: data });
      }
      await bumpSignal(base44, companyId);
      return Response.json({ ok: true });
    }

    // Independent, append-only path for filing an anonymous report: any valid
    // employee session may add exactly ONE record — no full-array replacement, so a
    // report can never be lost to a stale client snapshot or a permission rejection.
    if (action === 'createAnonymousReport') {
      if (!auth.userId) return Response.json({ error: 'Employee session required' }, { status: 403 });
      const { report } = body;
      const message = String(report?.message || '').trim();
      if (!message) return Response.json({ error: 'Report message is required' }, { status: 400 });

      const [blobs, metaBlobs] = await Promise.all([
        base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: 'anonymousReports' }),
        base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category: 'companyMeta' }),
      ]);
      const rows = blobs[0]?.payload || [];
      const settings = metaBlobs[0]?.payload?.[0]?.settings || {};

      // Server-side rate limits — the client's counters are advisory only.
      const receipts = await base44.asServiceRole.entities.AnonymousReportReceipt.filter({ companyId, employeeId: auth.userId });
      const mine = new Set(receipts.map((receipt) => receipt.reportId));
      const now = Date.now();
      const filedWithin = (ms) => rows.filter((row) => mine.has(row.id) && now - new Date(row.createdAt).getTime() < ms).length;
      const limits = [
        [filedWithin(86400000), Number(settings.rateLimitDaily ?? 3)],
        [filedWithin(86400000 * 7), Number(settings.rateLimitWeekly ?? 10)],
        [filedWithin(86400000 * 30), Number(settings.rateLimitMonthly ?? 30)],
      ];
      if (limits.some(([used, limit]) => used >= limit)) {
        return Response.json({ error: 'RATE_LIMIT_REACHED' }, { status: 429 });
      }

      const reportId = 'anr_' + crypto.randomUUID().replace(/-/g, '').slice(0, 10);
      const record = {
        id: reportId,
        anonymousId: 'ANON-' + crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase(),
        stationId: report.stationId || null,
        type: report.type === 'suggestion' ? 'suggestion' : 'complaint',
        priority: ['high', 'medium', 'low'].includes(report.priority) ? report.priority : 'medium',
        message: message.slice(0, 5000),
        files: Array.isArray(report.files) ? report.files : [],
        status: 'open',
        escalationLevel: Number(report.escalationLevel) || 0,
        replies: [],
        createdAt: new Date().toISOString(),
      };
      const nextRows = [record, ...rows];
      if (blobs.length) await base44.asServiceRole.entities.CompanyDataBlob.update(blobs[0].id, { payload: nextRows });
      else await base44.asServiceRole.entities.CompanyDataBlob.create({ companyId, category: 'anonymousReports', payload: nextRows });
      // Private receipt: lets only the sender follow their own report later.
      await base44.asServiceRole.entities.AnonymousReportReceipt.create({ companyId, reportId, employeeId: auth.userId });
      await bumpSignal(base44, companyId);
      return Response.json({ ok: true, report: record });
    }

    if (action === 'getBlob') {
      const { category } = body;
      if (!category) return Response.json({ error: 'Missing category' }, { status: 400 });
      const context = await getActorContext();
      const existing = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId, category });
      if (context.senior || String(category).startsWith('niroMemory:')) {
        return Response.json({ payload: existing[0]?.payload || [] });
      }
      // Complaint handlers are the escalation chain; a reporter still sees their own reports.
      const receipts = await base44.asServiceRole.entities.AnonymousReportReceipt.filter({ companyId, employeeId: auth.userId || '__none__' });
      const visibilityContext = {
        ...context,
        userId: auth.userId,
        isComplaintHandler: ['pgm', 'station_manager'].includes(context.actor?.role),
        ownReportIds: new Set(receipts.map((receipt) => receipt.reportId)),
      };
      return Response.json({ payload: filterBlobPayload(category, existing[0]?.payload || [], visibilityContext) });
    }

    // Owner-only permanent purge: removes the company account and every related
    // record — employees, stations, data blobs, credentials, sessions and signal.
    if (action === 'deleteCompanyAccount') {
      if (auth.role !== 'owner') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const svc = base44.asServiceRole.entities;
      const wipe = async (entity) => {
        const records = await entity.filter({ companyId });
        for (const r of records) await entity.delete(r.id);
      };
      try {
        await wipe(svc.Employee);
        await wipe(svc.Station);
        await wipe(svc.CompanyDataBlob);
        await wipe(svc.EmployeeCredential);
        await wipe(svc.CompanySession);
        await wipe(svc.SyncSignal);
        await wipe(svc.AnonymousReportReceipt);
        await wipe(svc.CompanyAccount);
        await svc.AuditLog.create({
          companyId, action: 'company_deleted',
          performedBy: body.performedBy || 'owner',
          details: 'Company account permanently deleted by owner (all stations, employees and data blobs purged).',
        });
      } catch (e) {
        console.error('deleteCompanyAccount failed:', e.message);
        return Response.json({ error: e.message }, { status: 500 });
      }
      return Response.json({ ok: true });
    }

    if (action === 'logAudit') {
      const { auditAction, details } = body;
      const context = await getActorContext();
      const performedBy = body.performedBy || context.actor?.name || (auth.role === 'owner' || auth.admin ? 'Company owner' : 'User');
      await base44.asServiceRole.entities.AuditLog.create({
        companyId,
        action: String(auditAction || 'unknown').slice(0, 100),
        performedBy,
        details: String(details || '').slice(0, 2000),
        reason: body.reason != null && String(body.reason).trim() ? String(body.reason).slice(0, 500) : null,
        oldValue: body.oldValue != null ? String(body.oldValue).slice(0, 500) : null,
        newValue: body.newValue != null ? String(body.newValue).slice(0, 2000) : null,
      });
      return Response.json({ ok: true });
    }

    if (action === 'getAuditLog') {
      const context = await getActorContext();
      if (!context.senior) return Response.json({ error: 'Forbidden' }, { status: 403 });
      const records = await base44.asServiceRole.entities.AuditLog.filter({ companyId }, '-created_date', 100);
      return Response.json({ logs: records });
    }

    if (action === 'getAllAuditLog') {
      // platform-wide log — only the platform owner (admin role) may view every company's entries.
      const user = await base44.auth.me().catch(() => null);
      if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });
      const records = await base44.asServiceRole.entities.AuditLog.list('-created_date', 200);
      return Response.json({ logs: records });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    const status = error.message === 'OTP_RATE_LIMIT' ? 429 : 500;
    return Response.json({ error: error.message }, { status });
  }
});