const { db } = require('../../db');
const { isMemberActive, isTrialMemberActive } = require('../member-active');
const { expToSvLevel, getDisplayDaysForSv } = require('./sv-levels');

function parseDate(str) {
  if (!str) return null;
  const raw = String(str).trim();
  if (!raw) return null;
  const t = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
  return isNaN(t.getTime()) ? null : t;
}

function formatDateTime(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} 23:59:59`;
}

function addDays(date, days) {
  const d = new Date(date.getTime());
  d.setDate(d.getDate() + Number(days || 0));
  return d;
}

function getUserSvLevel(userId) {
  const row = db.prepare('SELECT total_exp FROM user_growth WHERE user_id = ?').get(userId);
  if (!row) return 1;
  return expToSvLevel(row.total_exp);
}

/**
 * 统一计算项目 expire_at
 * @param {object} opts - { project, user, couponExtraDays?: 0 }
 */
function computeProjectExpireAt(opts) {
  const project = opts.project || {};
  const user = opts.user || {};
  const couponExtraDays = Number(opts.couponExtraDays) || 0;

  const publishedAt = project.published_at || formatDateTime(new Date());
  const pubDate = parseDate(publishedAt) || new Date();

  const capDate = addDays(pubDate, 365);

  let baseExpire;
  if (isMemberActive(user)) {
    baseExpire = capDate;
  } else if (isTrialMemberActive(user)) {
    baseExpire = addDays(pubDate, 30);
  } else {
    const sv = getUserSvLevel(user.id || project.user_id);
    const days = getDisplayDaysForSv(sv);
    baseExpire = addDays(pubDate, days || 30);
  }

  if (baseExpire.getTime() > capDate.getTime()) {
    baseExpire = capDate;
  }

  if (couponExtraDays > 0 && project.expire_at) {
    const current = parseDate(project.expire_at) || baseExpire;
    const extended = addDays(current, 30);
    baseExpire = extended.getTime() > capDate.getTime() ? capDate : extended;
  }

  return formatDateTime(baseExpire);
}

module.exports = {
  parseDate,
  formatDateTime,
  addDays,
  computeProjectExpireAt
};
