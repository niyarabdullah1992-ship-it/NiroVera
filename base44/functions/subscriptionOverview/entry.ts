import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Maps Stripe price ids back to plan names (must mirror stripeCheckout).
const MANUAL_PLAN_MONTHLY_PRICE = { Starter: 49, Professional: 149, Enterprise: 249 };

const PRICE_TO_PLAN = {
  'price_1Tro3sAz7ujPvPWo7k0AlkdX': { plan: 'Starter', billing: 'monthly' },
  'price_1Tro3sAz7ujPvPWoIBbqHn9U': { plan: 'Professional', billing: 'monthly' },
  'price_1Tro3sAz7ujPvPWotQRKoAwm': { plan: 'Enterprise', billing: 'monthly' },
  'price_1TsHYVAz7ujPvPWoBYJSnewC': { plan: 'Starter', billing: 'yearly' },
  'price_1TsHYVAz7ujPvPWoDT5T2QpW': { plan: 'Professional', billing: 'yearly' },
  'price_1TsHYVAz7ujPvPWofmRS51uY': { plan: 'Enterprise', billing: 'yearly' },
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Optional admin actions (POST body with { action, ... }); no action → overview.
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { /* empty body → overview */ }

    const action = String(body.action || '');
    const auditAction = async (account, key, oldValue, newValue, reason = '') => {
      await base44.asServiceRole.entities.AuditLog.create({
        companyId: account?.companyId || 'platform', action: key, performedBy: user.email || user.full_name || 'Platform owner',
        details: `${account?.name || 'Company'}: ${oldValue || '—'} → ${newValue || '—'}`,
        reason: String(reason || '').slice(0, 1000) || null, oldValue: String(oldValue ?? ''), newValue: String(newValue ?? ''),
      });
    };
    const getAccount = async () => body.accountId ? await base44.asServiceRole.entities.CompanyAccount.get(String(body.accountId)).catch(() => null) : null;

    if (action === 'recordInvoiceAudit') {
      const allowed = new Set(['viewed', 'exported_pdf', 'exported_excel', 'hosted_opened']);
      const event = String(body.event || '');
      if (!allowed.has(event)) return Response.json({ error: 'Invalid invoice audit event' }, { status: 400 });
      await base44.asServiceRole.entities.AuditLog.create({
        companyId: String(body.companyId || 'platform'), action: `invoice_${event}`,
        performedBy: user.email || user.full_name || 'Platform owner',
        details: `Invoice ${String(body.invoiceNumber || body.invoiceId || '—')} ${event.replaceAll('_', ' ')}`,
        oldValue: null, newValue: String(body.invoiceId || ''), reason: null,
      });
      return Response.json({ ok: true });
    }

    if (action === 'invoices') {
      const payments = await base44.asServiceRole.entities.SubscriptionPayment.list('-createdAt', 500);
      return Response.json({ invoices: payments });
    }
    
    if (['freeze', 'unfreeze', 'extend', 'changePlan', 'updateAccount', 'activate', 'deactivate', 'addDays', 'exempt', 'removeExemption'].includes(action)) {
      const account = await getAccount();
      if (!account) return Response.json({ error: 'Company account not found' }, { status: 404 });
      if (action === 'freeze') {
        const reason = String(body.reason || '').trim();
        if (!reason) return Response.json({ error: 'Freeze reason is required' }, { status: 400 });
        await base44.asServiceRole.entities.CompanyAccount.update(account.id, { frozen: true, frozenAt: new Date().toISOString(), frozenReason: reason });
        await auditAction(account, 'subscription_frozen', account.frozen ? 'frozen' : 'active', 'frozen', reason);
      } else if (action === 'unfreeze') {
        await base44.asServiceRole.entities.CompanyAccount.update(account.id, { frozen: false, frozenAt: null, frozenReason: null });
        await auditAction(account, 'subscription_unfrozen', 'frozen', 'active', body.reason);
      } else if (action === 'activate') {
        const start = new Date();
        const end = new Date(Math.max(Date.now(), Date.parse(account.subscriptionEnd || '') || 0) + 30 * 86400000);
        await base44.asServiceRole.entities.CompanyAccount.update(account.id, { plan: !account.plan || account.plan === 'Free' ? 'Starter' : account.plan, subscriptionStart: start.toISOString().slice(0, 10), subscriptionEnd: end.toISOString().slice(0, 10), subscriptionExempt: false, exemptReason: null, exemptedAt: null, frozen: false, frozenAt: null, frozenReason: null });
        await auditAction(account, 'subscription_activated', account.subscriptionEnd || 'inactive', end.toISOString().slice(0, 10), body.reason);
      } else if (action === 'deactivate') {
        const end = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        await base44.asServiceRole.entities.CompanyAccount.update(account.id, { subscriptionEnd: end, subscriptionExempt: false, exemptReason: null, exemptedAt: null });
        await auditAction(account, 'subscription_deactivated', account.subscriptionEnd || 'active', end, body.reason);
      } else if (action === 'addDays') {
        const days = Math.min(3650, Math.max(1, Number(body.days) || 0));
        const base = Math.max(Date.now(), Date.parse(account.subscriptionEnd || '') || 0);
        const end = new Date(base + days * 86400000).toISOString().slice(0, 10);
        await base44.asServiceRole.entities.CompanyAccount.update(account.id, { subscriptionStart: account.subscriptionStart || new Date().toISOString().slice(0, 10), subscriptionEnd: end, frozen: false, frozenAt: null, frozenReason: null });
        await auditAction(account, 'subscription_days_added', account.subscriptionEnd || '—', end, `${days} days`);
      } else if (action === 'exempt') {
        const reason = String(body.reason || '').trim();
        if (!reason) return Response.json({ error: 'Exemption reason is required' }, { status: 400 });
        await base44.asServiceRole.entities.CompanyAccount.update(account.id, { subscriptionExempt: true, exemptReason: reason, exemptedAt: new Date().toISOString(), frozen: false, frozenAt: null, frozenReason: null });
        await auditAction(account, 'subscription_exempted', 'billable', 'exempt', reason);
      } else if (action === 'removeExemption') {
        await base44.asServiceRole.entities.CompanyAccount.update(account.id, { subscriptionExempt: false, exemptReason: null, exemptedAt: null });
        await auditAction(account, 'subscription_exemption_removed', 'exempt', 'billable', body.reason);
      } else {
        const validPlans = new Set(['Starter', 'Professional', 'Enterprise', 'Custom']);
        if ((action === 'changePlan' || action === 'updateAccount') && body.plan !== undefined) {
          if (!validPlans.has(String(body.plan))) return Response.json({ error: 'Invalid plan' }, { status: 400 });
          const freePlan = body.freePlan === true;
          const customPrice = body.plan === 'Custom' && !freePlan ? Math.max(0, Number(body.customPrice) || 0) : null;
          await base44.asServiceRole.entities.CompanyAccount.update(account.id, { plan: body.plan, customPrice, subscriptionExempt: freePlan, exemptReason: freePlan ? 'Plan made free by platform owner' : null, exemptedAt: freePlan ? new Date().toISOString() : null });
          const metaRows = await base44.asServiceRole.entities.CompanyDataBlob.filter({ companyId: account.companyId, category: 'companyMeta' });
          if (metaRows[0]?.payload?.[0]) {
            const payload = [...metaRows[0].payload];
            payload[0] = { ...payload[0], plan: body.plan };
            await base44.asServiceRole.entities.CompanyDataBlob.update(metaRows[0].id, { payload });
          }
          const signals = await base44.asServiceRole.entities.SyncSignal.filter({ companyId: account.companyId });
          if (signals[0]) await base44.asServiceRole.entities.SyncSignal.update(signals[0].id, { version: Number(signals[0].version || 0) + 1 });
          else await base44.asServiceRole.entities.SyncSignal.create({ companyId: account.companyId, version: 1 });
          if (account.plan !== body.plan || account.customPrice !== customPrice || account.subscriptionExempt !== freePlan) await auditAction(account, 'subscription_plan_changed', `${account.plan || '—'}${account.subscriptionExempt ? ' (free)' : account.customPrice != null ? ` ($${account.customPrice})` : ''}`, `${body.plan}${freePlan ? ' (free)' : customPrice != null ? ` ($${customPrice})` : ''}`, body.reason);
        }
        if ((action === 'extend' || action === 'updateAccount') && body.subscriptionEnd !== undefined) {
          const nextEnd = body.subscriptionEnd || null;
          await base44.asServiceRole.entities.CompanyAccount.update(account.id, { subscriptionStart: body.subscriptionStart || account.subscriptionStart || null, subscriptionEnd: nextEnd });
          if (account.subscriptionEnd !== nextEnd) await auditAction(account, 'subscription_extended', account.subscriptionEnd || '—', nextEnd || '—', body.reason);
        }
      }
      return Response.json({ ok: true });
    }

    if (['cancelAtPeriodEnd', 'reactivate', 'cancelNow'].includes(action)) {
      const account = await getAccount();
      if (!account) return Response.json({ error: 'Company account not found' }, { status: 404 });
      const end = action === 'reactivate' ? account.subscriptionEnd : new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      await base44.asServiceRole.entities.CompanyAccount.update(account.id, { subscriptionEnd: end });
      await auditAction(account, action === 'reactivate' ? 'subscription_reactivated' : 'subscription_canceled', account.subscriptionEnd || 'active', end || 'active', body.reason);
      return Response.json({ ok: true });
    }

    if (action === 'platformReport') {
      const monthStart = new Date(); monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
      const cutoff30 = Date.now() - 30 * 86400000;
      const [accountRows, employees, blobs, sessions, signatures, feedback] = await Promise.all([
        base44.asServiceRole.entities.CompanyAccount.list('-created_date', 500),
        base44.asServiceRole.entities.Employee.list('-created_date', 500),
        base44.asServiceRole.entities.CompanyDataBlob.list('-updated_date', 500),
        base44.asServiceRole.entities.CompanySession.list('-created_date', 500),
        base44.asServiceRole.entities.SignatureRequest.list('-created_date', 500),
        base44.asServiceRole.entities.ProductFeedback.list('-created_date', 500),
      ]);
      const valueDate = (item) => new Date(item.completedAt || item.completed_date || item.updatedAt || item.updated_date || item.createdAt || item.created_date || 0).getTime();
      const companies = accountRows.filter((account) => !(account.ownerEmail || '').endsWith('@powercare-demo.com')).map((account) => {
        const companyBlobs = blobs.filter((blob) => blob.companyId === account.companyId);
        const tasks = companyBlobs.find((blob) => blob.category === 'tasks')?.payload || [];
        const attendance = companyBlobs.find((blob) => blob.category === 'personalAttendance')?.payload || [];
        const present = attendance.filter((record) => record.checkIn || record.status === 'present' || record.status === 'checked_in' || record.status === 'completed').length;
        const companyFeedback = feedback.filter((item) => item.companyId === account.companyId);
        return {
          companyId: account.companyId, companyName: account.name || account.ownerEmail, plan: account.plan || '—',
          employees: employees.filter((item) => item.companyId === account.companyId).length,
          completedTasks: tasks.filter((task) => ['done', 'completed', 'approved'].includes(String(task.status || '').toLowerCase()) && valueDate(task) >= monthStart.getTime()).length,
          attendanceRate: attendance.length ? Math.round((present / attendance.length) * 100) : 0,
          loginSessions: sessions.filter((item) => item.companyId === account.companyId && new Date(item.created_date || 0).getTime() >= cutoff30).length,
          signedDocuments: signatures.filter((item) => item.companyId === account.companyId && item.status === 'completed').length,
          feedbackCount: companyFeedback.length,
          averageRating: companyFeedback.length ? Math.round(companyFeedback.reduce((sum, item) => sum + Number(item.rating || 0), 0) / companyFeedback.length * 10) / 10 : null,
        };
      });
      return Response.json({ companies });
    }

    const allAccounts = await base44.asServiceRole.entities.CompanyAccount.list('-created_date', 500);
    const accounts = allAccounts.filter((account) => !(account.ownerEmail || '').endsWith('@powercare-demo.com'));
    const [payments, planCatalog] = await Promise.all([base44.asServiceRole.entities.SubscriptionPayment.list('-createdAt', 500), base44.asServiceRole.entities.SubscriptionPlan.list('sortOrder', 50)]);
    const promotionalFreePlans = new Set(planCatalog.filter((plan) => plan.freeNow === true).map((plan) => plan.nameEn));
    const now = Date.now();
    const latestByEmail = {};
    for (const payment of payments) { const key = String(payment.email || '').toLowerCase(); if (key && !latestByEmail[key]) latestByEmail[key] = payment; }
    const rows = accounts.map((account) => {
      const payment = latestByEmail[String(account.ownerEmail || '').toLowerCase()];
      const endTs = account.subscriptionEnd ? Date.parse(account.subscriptionEnd) : null;
      const promotionalFree = promotionalFreePlans.has(account.plan || 'Free');
      const active = promotionalFree || account.subscriptionExempt === true || (!!endTs && endTs > now && account.plan !== 'Free');
      return { accountId: account.id, companyName: account.name || '', email: account.ownerEmail, plan: account.plan || 'Free', billing: payment?.billing || 'monthly', status: account.subscriptionExempt ? 'exempt' : active ? 'manual_active' : 'no_subscription', startedAt: account.subscriptionStart ? Date.parse(account.subscriptionStart) : null, endsAt: promotionalFree || account.subscriptionExempt ? null : endTs, daysLeft: promotionalFree || account.subscriptionExempt || !endTs ? null : Math.ceil((endTs - now) / 86400000), amount: promotionalFree || account.subscriptionExempt ? 0 : payment ? payment.subtotal / 100 : Math.max(0, Number(account.customPrice) || 0), customPrice: account.customPrice ?? null, currency: payment?.currency || 'SAR', exempt: account.subscriptionExempt === true, isFree: promotionalFree || account.subscriptionExempt === true || (!payment && !(Number(account.customPrice) > 0)), exemptReason: account.exemptReason || null, frozen: account.frozen === true, frozenAt: account.frozenAt || null, frozenReason: account.frozenReason || null };
    });
    const active = rows.filter((row) => ['manual_active', 'exempt'].includes(row.status));
    const summary = { totalCompanies: accounts.length, activeSubscriptions: active.length, trialing: 0, pastDue: rows.filter((row) => row.status === 'no_subscription' && row.endsAt && row.endsAt < now).length, canceled: rows.filter((row) => row.status === 'no_subscription').length, frozen: accounts.filter((account) => account.frozen === true).length, expired: rows.filter((row) => row.endsAt && row.endsAt < now).length, endingSoon: active.filter((row) => row.daysLeft != null && row.daysLeft <= 14).length, byPlan: { Free: rows.filter((row) => row.plan === 'Free').length, Starter: active.filter((row) => row.plan === 'Starter').length, Professional: active.filter((row) => row.plan === 'Professional').length, Enterprise: active.filter((row) => row.plan === 'Enterprise').length, Custom: active.filter((row) => row.plan === 'Custom').length } };
    summary.mrr = Math.round(active.reduce((sum, row) => sum + (row.amount ? (row.billing === 'yearly' ? row.amount / 12 : row.amount) : 0), 0) * 100) / 100;
    summary.arr = Math.round(summary.mrr * 12 * 100) / 100;
    summary.manualActive = active.length;
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const [todaySessions, latestFeedback] = await Promise.all([base44.asServiceRole.entities.CompanySession.list('-lastSeenAt', 500), base44.asServiceRole.entities.ProductFeedback.list('-created_date', 5)]);
    summary.activeUsersToday = new Set(todaySessions.filter((session) => new Date(session.lastSeenAt || 0).getTime() >= todayStart.getTime()).map((session) => `${session.companyId}:${session.userId || 'owner'}`)).size;
    const growthMap = {};
    for (const account of accounts) { const month = (account.created_date || '').slice(0, 7); if (month) growthMap[month] = (growthMap[month] || 0) + 1; }
    const growth = Object.entries(growthMap).sort(([left], [right]) => left.localeCompare(right)).map(([month, count]) => ({ month, count }));
    rows.sort((left, right) => (left.daysLeft ?? 99999) - (right.daysLeft ?? 99999));
    return Response.json({ summary, subscriptions: [], companiesWithoutSubscription: rows, growth, latestFeedback });
  } catch (error) {
    console.error('subscriptionOverview error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});