const { db } = require('../../db');
const { isMemberActive, isTrialMemberLevel, parseExpireTime } = require('../member-active');
const { expToSvLevel } = require('./sv-levels');
const { formatDateTime, parseDate } = require('./compute-project-expire-at');

const POOL_TYPE = 'homepage_brand';

function memberYearsFromDays(days) {
  return Math.max(1, Math.ceil(Number(days || 365) / 365));
}

function computePeriodStart(currentExpireIso, newExpireIso, days) {
  const now = Date.now();
  const oldExp = parseExpireTime(currentExpireIso);
  if (oldExp && oldExp.getTime() > now) {
    return formatDateTime(oldExp);
  }
  const newExp = parseExpireTime(newExpireIso);
  if (!newExp) return formatDateTime(new Date());
  const start = new Date(newExp.getTime());
  start.setDate(start.getDate() - Number(days || 365));
  return formatDateTime(start);
}

/**
 * 会员支付成功开池（体验者不开池）
 */
function grantContentEditPoolOnPayment(userId, orderId, days, newMemberExpire, previousExpire, plan) {
  const planKey = String(plan || '').toLowerCase();
  if (planKey === 'trial') return { granted: false, reason: 'trial' };

  const user = db.prepare('SELECT member_level FROM users WHERE id = ?').get(userId);
  if (!user || isTrialMemberLevel(user.member_level)) {
    return { granted: false, reason: 'not_paid_member' };
  }

  const years = memberYearsFromDays(days);
  const quotaTotal = 2 * years;
  const isRenewal = !!(previousExpire && parseExpireTime(previousExpire) && parseExpireTime(previousExpire).getTime() > Date.now());
  const periodStart = computePeriodStart(previousExpire, newMemberExpire, days);
  const periodEnd = newMemberExpire;
  const source = isRenewal ? 'renewal_grant' : 'membership_grant';

  db.prepare(
    `INSERT INTO content_edit_pool
     (user_id, pool_type, quota_total, quota_used, period_start, period_end, source, order_id)
     VALUES (?, ?, ?, 0, ?, ?, ?, ?)`
  ).run(userId, POOL_TYPE, quotaTotal, periodStart, periodEnd, source, orderId || null);

  return { granted: true, quotaTotal, periodStart, periodEnd, source };
}

function getActivePools(userId) {
  const nowStr = formatDateTime(new Date()).slice(0, 19);
  return db.prepare(
    `SELECT * FROM content_edit_pool
     WHERE user_id = ? AND pool_type = ?
       AND quota_used < quota_total
       AND period_end >= ? AND period_start <= ?
     ORDER BY period_start DESC`
  ).all(userId, POOL_TYPE, nowStr, nowStr);
}

function getContentEditPoolSummary(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const sv = expToSvLevel(
    (db.prepare('SELECT total_exp FROM user_growth WHERE user_id = ?').get(userId) || {}).total_exp || 0
  );
  const paidActive = isMemberActive(user);
  const pools = getActivePools(userId);
  const quotaTotal = pools.reduce((s, p) => s + (Number(p.quota_total) || 0), 0);
  const quotaUsed = pools.reduce((s, p) => s + (Number(p.quota_used) || 0), 0);
  return {
    poolType: POOL_TYPE,
    quotaTotal,
    quotaRemain: Math.max(0, quotaTotal - quotaUsed),
    quotaUsed,
    svLevel: sv,
    canApply: paidActive && sv >= 5 && quotaTotal > quotaUsed,
    isPaidMember: paidActive,
    pools: pools.map((p) => ({
      id: p.id,
      quotaTotal: p.quota_total,
      quotaUsed: p.quota_used,
      quotaRemain: Math.max(0, (Number(p.quota_total) || 0) - (Number(p.quota_used) || 0)),
      periodStart: p.period_start,
      periodEnd: p.period_end,
      source: p.source
    }))
  };
}

function canContentEdit(userId) {
  const summary = getContentEditPoolSummary(userId);
  if (!summary.isPaidMember) return { ok: false, message: '改稿需有效付费会员' };
  if (summary.svLevel < 5) return { ok: false, message: '改稿需达到 Sv5' };
  if (summary.quotaRemain <= 0) return { ok: false, message: '本周期改稿额度已用完' };
  return { ok: true, summary };
}

function consumeContentEdit(userId, projectId, source) {
  const check = canContentEdit(userId);
  if (!check.ok) return check;

  const pools = getActivePools(userId);
  const pool = pools[0];
  if (!pool) return { ok: false, message: '改稿额度不足' };

  db.prepare('UPDATE content_edit_pool SET quota_used = quota_used + 1 WHERE id = ?').run(pool.id);
  db.prepare(
    `INSERT INTO content_edit_usage (pool_id, user_id, project_id, source)
     VALUES (?, ?, ?, ?)`
  ).run(pool.id, userId, projectId, source || pool.source || 'membership_grant');

  return { ok: true, poolId: pool.id };
}

module.exports = {
  POOL_TYPE,
  grantContentEditPoolOnPayment,
  getContentEditPoolSummary,
  canContentEdit,
  consumeContentEdit
};
