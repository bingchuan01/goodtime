const { db } = require('../../db');
const { isMemberActive, isTrialMemberActive, isPaidMemberLevel, isTrialMemberLevel } = require('../member-active');
const { expToSvLevel } = require('./sv-levels');
const { parseDate, formatDateTime, addDays } = require('./compute-project-expire-at');

function formatDateShort(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getApprovedPublishCount(userId) {
  const row = db.prepare(
    `SELECT COUNT(*) as c FROM projects
     WHERE user_id = ? AND status = 'approved'
       AND published_at IS NOT NULL AND trim(published_at) != ''`
  ).get(userId);
  return Number(row && row.c) || 0;
}

function getPendingPublishCount(userId) {
  const row = db.prepare(
    `SELECT COUNT(*) as c FROM projects WHERE user_id = ? AND status = 'pending'`
  ).get(userId);
  return Number(row && row.c) || 0;
}

function getLastPublishedAt(userId) {
  const row = db.prepare(
    `SELECT published_at FROM projects
     WHERE user_id = ? AND status = 'approved' AND published_at IS NOT NULL AND trim(published_at) != ''
     ORDER BY published_at DESC LIMIT 1`
  ).get(userId);
  return row && row.published_at ? String(row.published_at).trim() : null;
}

function getUserSvLevel(userId) {
  const row = db.prepare('SELECT total_exp FROM user_growth WHERE user_id = ?').get(userId);
  return expToSvLevel(row ? row.total_exp : 0);
}

/**
 * 发布次数/间隔/Sv 校验（会员门槛由 member-active 单独校验）
 * @returns {string|null} 拦截文案
 */
function getPublishCountBlockMessage(user) {
  if (!user || !user.id) return '未登录';

  const userId = user.id;
  const approved = getApprovedPublishCount(userId);
  const pending = getPendingPublishCount(userId);

  if (approved + pending >= 2) {
    return '每个用户最多发布 2 个项目';
  }

  if (approved >= 1) {
    const lastAt = getLastPublishedAt(userId);
    if (lastAt) {
      const lastDate = parseDate(lastAt);
      if (lastDate) {
        const nextDate = addDays(lastDate, 365);
        if (Date.now() < nextDate.getTime()) {
          return `1 年内已发布过项目，下一次发布需等到 ${formatDateShort(nextDate)}`;
        }
      }
    }

    const sv = getUserSvLevel(userId);
    const paidActive = isMemberActive(user);
    if (paidActive && sv < 6) {
      return '第 2 次发布需达到 Sv6 等级（经验路径发布）';
    }
    if (!paidActive && !isTrialMemberActive(user) && sv < 6) {
      return '第 2 次发布需达到 Sv6 等级';
    }
  }

  if (approved === 0) {
    const phone = String(user.phone || '').trim();
    if (!phone) {
      return '首次发布需绑定手机号（实名认证）';
    }
    const sv = getUserSvLevel(userId);
    const paidActive = isMemberActive(user);
    const trialActive = isTrialMemberActive(user);
    if (!paidActive && !trialActive && sv < 4) {
      return '第 1 次发布需达到 Sv4 等级并完成实名认证';
    }
  }

  return null;
}

function getPublishEligibility(userId) {
  const user = db.prepare(
    'SELECT id, member_level, member_expire_time, phone FROM users WHERE id = ?'
  ).get(userId);
  if (!user) {
    return { canPublish: false, reason: '用户不存在', publishCountUsed: 0, nextAvailableAt: null, svRequired: null };
  }

  const approved = getApprovedPublishCount(userId);
  const pending = getPendingPublishCount(userId);
  const sv = getUserSvLevel(userId);
  const block = getPublishCountBlockMessage(user);

  let nextAvailableAt = null;
  if (approved >= 1) {
    const lastAt = getLastPublishedAt(userId);
    const lastDate = lastAt ? parseDate(lastAt) : null;
    if (lastDate) {
      nextAvailableAt = formatDateTime(addDays(lastDate, 365));
    }
  }

  return {
    canPublish: !block,
    reason: block || '',
    publishCountUsed: approved,
    pendingCount: pending,
    svLevel: sv,
    svRequired: approved === 0 ? 4 : (approved >= 1 ? 6 : null),
    nextAvailableAt,
    lifetimeLimit: 2
  };
}

function recordPublishApproved(userId, publishedAt) {
  const stats = db.prepare('SELECT * FROM user_publish_stats WHERE user_id = ?').get(userId);
  if (!stats) {
    db.prepare(
      'INSERT INTO user_publish_stats (user_id, lifetime_count, last_published_at) VALUES (?, 1, ?)'
    ).run(userId, publishedAt);
  } else {
    db.prepare(
      'UPDATE user_publish_stats SET lifetime_count = lifetime_count + 1, last_published_at = ? WHERE user_id = ?'
    ).run(publishedAt, userId);
  }
}

module.exports = {
  getPublishCountBlockMessage,
  getPublishEligibility,
  recordPublishApproved,
  getApprovedPublishCount
};
