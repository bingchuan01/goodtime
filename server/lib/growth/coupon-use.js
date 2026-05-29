const { db } = require('../../db');
const { parseDate, formatDateTime, addDays, computeProjectExpireAt } = require('./compute-project-expire-at');
const { yearMonthStr } = require('./grant-exp-points');

function getCoupon(userId, couponId) {
  return db.prepare(
    `SELECT * FROM user_coupons WHERE id = ? AND user_id = ? AND status = 'unused'`
  ).get(couponId, userId);
}

function markCouponUsed(couponId, projectId) {
  db.prepare(
    `UPDATE user_coupons SET status = 'used', used_at = datetime('now', 'localtime'), project_id = ? WHERE id = ?`
  ).run(projectId || null, couponId);
}

function countMonthlyPinUsage(userId) {
  const ym = yearMonthStr();
  const row = db.prepare(
    `SELECT COUNT(*) as c FROM user_coupons
     WHERE user_id = ? AND type = 'pin' AND status = 'used' AND used_at LIKE ?`
  ).get(userId, ym + '%');
  return Number(row && row.c) || 0;
}

function hasProjectExtension(projectId) {
  const row = db.prepare(
    `SELECT id FROM project_display_extensions WHERE project_id = ? AND source = 'coupon' LIMIT 1`
  ).get(projectId);
  return !!row;
}

function applyExtendDisplayCoupon(userId, projectId, couponId) {
  const coupon = getCoupon(userId, couponId);
  if (!coupon || coupon.type !== 'extend_display') {
    return { ok: false, message: '无效的展示期延长券' };
  }
  const p = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
  if (!p || p.status !== 'approved') return { ok: false, message: '仅已发布项目可使用' };
  if (!p.published_at) return { ok: false, message: '项目未发布' };
  if (hasProjectExtension(projectId)) {
    return { ok: false, message: '该项目已使用过展示期延长券' };
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const pubDate = parseDate(p.published_at);
  const capDate = addDays(pubDate, 365);
  const current = parseDate(p.expire_at) || new Date();
  const extended = addDays(current, 30);
  const newExpire = extended.getTime() > capDate.getTime() ? capDate : extended;

  if (parseDate(p.expire_at) && parseDate(p.expire_at).getTime() >= capDate.getTime()) {
    return { ok: false, message: '该项目展示期已达最长 365 天' };
  }

  const expireAt = formatDateTime(newExpire);
  db.prepare('UPDATE projects SET expire_at = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?').run(expireAt, projectId);
  db.prepare(
    `INSERT INTO project_display_extensions (project_id, source, days_added, expire_at_after)
     VALUES (?, 'coupon', 30, ?)`
  ).run(projectId, expireAt);
  markCouponUsed(couponId, projectId);

  return { ok: true, expireAt, displayDays: Math.ceil((newExpire - pubDate) / 86400000) };
}

function applyPinCoupon(userId, projectId, couponId) {
  const coupon = getCoupon(userId, couponId);
  if (!coupon || coupon.type !== 'pin') {
    return { ok: false, message: '无效的置顶卡' };
  }
  if (countMonthlyPinUsage(userId) >= 1) {
    return { ok: false, message: '本月置顶次数已用完' };
  }
  const p = db.prepare('SELECT * FROM projects WHERE id = ? AND user_id = ?').get(projectId, userId);
  if (!p || p.status !== 'approved') return { ok: false, message: '仅已发布项目可置顶' };

  const until = addDays(new Date(), 1);
  const pinnedUntil = formatDateTime(until);
  db.prepare(
    `UPDATE projects SET pinned_until = ?, updated_at = datetime('now', 'localtime') WHERE id = ?`
  ).run(pinnedUntil, projectId);
  markCouponUsed(couponId, projectId);

  return { ok: true, pinnedUntil };
}

function getProjectDisplayInfo(projectId, userId) {
  const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!p) return null;
  if (userId && p.user_id !== userId) {
    const isPublic = p.status === 'approved';
    if (!isPublic) return null;
  }
  const pub = parseDate(p.published_at);
  const exp = parseDate(p.expire_at);
  let displayDays = null;
  if (pub && exp) displayDays = Math.max(0, Math.ceil((exp - pub) / 86400000));
  const extensions = db.prepare(
    'SELECT * FROM project_display_extensions WHERE project_id = ? ORDER BY id ASC'
  ).all(projectId);
  return {
    projectId: p.id,
    publishedAt: p.published_at,
    expireAt: p.expire_at,
    pinnedUntil: p.pinned_until || null,
    displayDays,
    hasExtendCouponUsed: extensions.some((e) => e.source === 'coupon'),
    extensions
  };
}

module.exports = {
  applyExtendDisplayCoupon,
  applyPinCoupon,
  getProjectDisplayInfo
};
