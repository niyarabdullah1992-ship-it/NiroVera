import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// Security: these backend functions authorize every call server-side using the
// per-company session token issued at login. Attach it automatically so no page
// has to (and no page can forge a role — the server derives it from the session).
const SESSION_SECURED_FUNCTIONS = new Set([
  'supabaseAttendance',
  'compliance',
  'supabaseTargets',
  'operations',
  'workforce',
  'scores',
  'workproof',
  'hiring',
  'org',
  'hcm',
  'payroll',
  'signing',
  'stock',
  'budget',
  'offboarding',
  'complaints',
  'files',
  'settings',
  'reports',
  'assistant',
  'chat',
  'multiSign',
  'calendarSync',
  'inventory',
  'expenses',
  'clientProof',
  'assets',
]);
const LOCAL_PREVIEW_COMPANY_ID = "local-preview-nirovera";

function isLocalPreviewWorkspace(payload) {
  try {
    if (typeof localStorage === "undefined") return false;
    if (localStorage.getItem("powercare_local_preview") === "1") return true;
    const session = JSON.parse(localStorage.getItem("powercare_session") || "null");
    const companyId = payload?.companyId || session?.companyId;
    return companyId === LOCAL_PREVIEW_COMPANY_ID;
  } catch {
    return false;
  }
}

const powercareFunctions = base44.functions;
const rawInvoke = powercareFunctions.invoke.bind(powercareFunctions);
powercareFunctions.invoke = (name, payload, ...rest) => {
  const onApp = typeof location !== "undefined" && String(location.pathname || "").startsWith("/app");
  if (onApp && isLocalPreviewWorkspace(payload) && (SESSION_SECURED_FUNCTIONS.has(name) || name === "companyDirectory")) {
    return Promise.resolve({ data: { ok: true, localPreview: true } });
  }
  if (SESSION_SECURED_FUNCTIONS.has(name)) {
    try {
      const session = JSON.parse(localStorage.getItem('powercare_session') || 'null');
      const tokens = JSON.parse(localStorage.getItem('powercare_tokens') || '{}');
      const companyId = (payload && payload.companyId) || session?.companyId;
      if (companyId) {
        payload = { ...(payload || {}), companyId, sessionToken: payload?.sessionToken || tokens[companyId] || null };
      }
    } catch {
      // no session yet — the backend rejects unauthorized calls
    }
  }
  return rawInvoke(name, payload, ...rest);
};