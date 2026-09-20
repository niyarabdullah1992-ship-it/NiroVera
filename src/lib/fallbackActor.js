/**
 * Who is acting, as every local fallback must read it.
 *
 * The local ledgers stand in for cloud functions that authenticate a session before
 * they answer. A fallback that cannot recognise the session must therefore assume
 * less than the server would, never more: the same hole appeared on expenses, on
 * inventory, on assets and on the HR register, each time because an unknown userId
 * fell through to "owner". An unknown actor rises to full rights is the worst
 * possible default — the anonymous caller is promoted rather than demoted.
 *
 * One rule, one place, read by every fallback:
 * an unrecognised session falls to least privilege. Only a session carrying no user
 * at all — the company-owner token, which has no employee row by design — keeps the
 * owner path, along with a userId that is literally the company owner.
 */
import { getCompanyData, getSession } from "@/lib/store";

export function fallbackActor(companyId, session, data) {
  const user = (data?.employees || []).find((row) => row.id === session?.userId) || null;
  const ownerToken = !user && !session?.userId;
  const owner = ownerToken
    || user?.role === "owner"
    || user?.role === "director"
    || (!!data?.ownerId && (user?.id === data.ownerId || session?.userId === data.ownerId));
  return {
    companyId,
    userId: user?.id || session?.userId || "owner",
    // This name is signed onto Arabic records — notifications, custody rows, loss
    // cases, employment actions — so neither fallback may be a Latin word.
    name: user?.name || (ownerToken ? "مالك المنشأة" : "مستخدم غير معروف"),
    role: owner && user?.role !== "director" ? "owner" : (user?.role || (ownerToken ? "owner" : "employee")),
    owner,
    stationId: user?.stationId || null,
    managedStations: user?.managedStations || [],
    user,
  };
}

/** The stored session is the authority on who is acting, whatever the caller passes. */
export function storedFallbackActor(companyId, session) {
  const stored = getSession();
  const live = stored?.userId ? stored : (session || stored);
  return fallbackActor(companyId, live, getCompanyData(companyId));
}
