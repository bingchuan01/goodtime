const { db } = require('../../db');
const { resolveGrowthCoefficient } = require('./resolve-growth-coefficient');
const { expToSvLevel, getSvPointsBonusRate } = require('./sv-levels');
const { addPointsBatch, consumePointsBatches, getPointsBalanceInfo } = require('./points-expiry');

const DAILY_EXP_CAP = 130;
const DAILY_POINTS_CAP = 300;

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yearMonthStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function ensureUserGrowth(userId) {
  let row = db.prepare('SELECT * FROM user_growth WHERE user_id = ?').get(userId);
  if (!row) {
    db.prepare('INSERT INTO user_growth (user_id, total_exp, sv_level) VALUES (?, 0, 1)').run(userId);
    row = db.prepare('SELECT * FROM user_growth WHERE user_id = ?').get(userId);
  }
  return row;
}

function ensureUserPoints(userId) {
  let row = db.prepare('SELECT * FROM user_points WHERE user_id = ?').get(userId);
  if (!row) {
    db.prepare('INSERT INTO user_points (user_id, balance) VALUES (?, 0)').run(userId);
    row = db.prepare('SELECT * FROM user_points WHERE user_id = ?').get(userId);
  }
  return row;
}

function getDailyStats(userId, statDate) {
  let row = db.prepare('SELECT * FROM growth_daily_stats WHERE user_id = ? AND stat_date = ?').get(userId, statDate);
  if (!row) {
    db.prepare(
      'INSERT INTO growth_daily_stats (user_id, stat_date) VALUES (?, ?)'
    ).run(userId, statDate);
    row = { user_id: userId, stat_date: statDate, exp_earned: 0, points_earned: 0 };
  }
  return row;
}

function applyExpGain(userId, baseExp, action, refId, meta, options) {
  const opts = options || {};
  const excludeFromDailyCap = !!opts.excludeFromDailyCap;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const { coefficient } = resolveGrowthCoefficient(user);
  let delta = Math.floor(Math.max(0, baseExp) * coefficient);
  if (delta <= 0) return { granted: 0, capped: false };

  const statDate = todayStr();
  const stats = getDailyStats(userId, statDate);
  if (!excludeFromDailyCap) {
    const remaining = DAILY_EXP_CAP - (Number(stats.exp_earned) || 0);
    if (remaining <= 0) return { granted: 0, capped: true };
    if (delta > remaining) delta = remaining;
  }

  const growth = ensureUserGrowth(userId);
  const newTotal = (Number(growth.total_exp) || 0) + delta;
  const newSv = expToSvLevel(newTotal);
  db.prepare(
    'UPDATE user_growth SET total_exp = ?, sv_level = ?, updated_at = datetime(\'now\', \'localtime\') WHERE user_id = ?'
  ).run(newTotal, newSv, userId);
  db.prepare(
    `INSERT INTO exp_ledger (user_id, delta, action, ref_id, meta, coefficient)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, delta, action, refId || '', meta ? JSON.stringify(meta) : '', coefficient);
  if (!excludeFromDailyCap) {
    db.prepare(
      'UPDATE growth_daily_stats SET exp_earned = exp_earned + ? WHERE user_id = ? AND stat_date = ?'
    ).run(delta, userId, statDate);
  }
  return { granted: delta, capped: false, totalExp: newTotal, svLevel: newSv };
}

/** 运营人工加经验（只增不减，不计日 cap，不乘系数） */
function adminAdjustExp(userId, delta, remark) {
  const add = Math.floor(Number(delta) || 0);
  if (add <= 0) return { ok: false, message: '经验调整须为正整数' };
  const growth = ensureUserGrowth(userId);
  const newTotal = (Number(growth.total_exp) || 0) + add;
  const newSv = expToSvLevel(newTotal);
  db.prepare(
    'UPDATE user_growth SET total_exp = ?, sv_level = ?, updated_at = datetime(\'now\', \'localtime\') WHERE user_id = ?'
  ).run(newTotal, newSv, userId);
  db.prepare(
    `INSERT INTO exp_ledger (user_id, delta, action, ref_id, meta, coefficient)
     VALUES (?, ?, 'admin_adjust', '', ?, 1)`
  ).run(userId, add, JSON.stringify({ remark: remark || '' }));
  return { ok: true, totalExp: newTotal, svLevel: newSv };
}

/** 运营人工调积分（可正可负） */
function adminAdjustPoints(userId, delta, remark) {
  const change = Math.floor(Number(delta) || 0);
  if (!change) return { ok: false, message: '调整值不能为 0' };
  ensureUserPoints(userId);
  if (change > 0) {
    const acct = db.prepare('SELECT balance FROM user_points WHERE user_id = ?').get(userId);
    const newBalance = (Number(acct.balance) || 0) + change;
    db.prepare('UPDATE user_points SET balance = ?, updated_at = datetime(\'now\', \'localtime\') WHERE user_id = ?').run(newBalance, userId);
    db.prepare(
      `INSERT INTO point_ledger (user_id, delta, type, balance_after, remark) VALUES (?, ?, 'admin', ?, ?)`
    ).run(userId, change, newBalance, remark || '运营调整');
    addPointsBatch(userId, change);
    return { ok: true, balance: newBalance };
  }
  const deduct = deductPoints(userId, Math.abs(change), 'admin', '', remark || '运营调整');
  return deduct.ok ? { ok: true, balance: deduct.balance } : deduct;
}

function applyPointsGain(userId, basePoints, type, refId, remark) {
  let delta = Math.max(0, Math.floor(Number(basePoints) || 0));
  if (delta <= 0) return { granted: 0, capped: false };

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const growth = ensureUserGrowth(userId);
  const sv = expToSvLevel(growth.total_exp);
  const { coefficient } = resolveGrowthCoefficient(user);
  const svBonus = getSvPointsBonusRate(sv);
  delta = Math.floor(delta * coefficient * (1 + svBonus));
  if (delta <= 0) return { granted: 0, capped: false };

  const statDate = todayStr();
  const stats = getDailyStats(userId, statDate);
  const remaining = DAILY_POINTS_CAP - (Number(stats.points_earned) || 0);
  if (remaining <= 0) return { granted: 0, capped: true };
  if (delta > remaining) delta = remaining;

  const acct = ensureUserPoints(userId);
  const newBalance = (Number(acct.balance) || 0) + delta;
  db.prepare(
    'UPDATE user_points SET balance = ?, updated_at = datetime(\'now\', \'localtime\') WHERE user_id = ?'
  ).run(newBalance, userId);
  db.prepare(
    `INSERT INTO point_ledger (user_id, delta, type, balance_after, ref_id, remark)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, delta, type || 'earn', newBalance, refId || '', remark || '');
  addPointsBatch(userId, delta);
  db.prepare(
    'UPDATE growth_daily_stats SET points_earned = points_earned + ? WHERE user_id = ? AND stat_date = ?'
  ).run(delta, userId, statDate);
  return { granted: delta, capped: false, balance: newBalance };
}

function deductPoints(userId, amount, type, refId, remark) {
  const delta = Math.floor(Number(amount) || 0);
  if (delta <= 0) return { ok: false, message: '无效扣减' };
  const acct = ensureUserPoints(userId);
  const balance = Number(acct.balance) || 0;
  if (balance < delta) return { ok: false, message: '积分不足' };
  const newBalance = balance - delta;
  db.prepare(
    'UPDATE user_points SET balance = ?, updated_at = datetime(\'now\', \'localtime\') WHERE user_id = ?'
  ).run(newBalance, userId);
  db.prepare(
    `INSERT INTO point_ledger (user_id, delta, type, balance_after, ref_id, remark)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, -delta, type || 'redeem', newBalance, refId || '', remark || '');
  consumePointsBatches(userId, delta);
  return { ok: true, balance: newBalance };
}

function getPointBalance(userId) {
  return getPointsBalanceInfo(userId).balance;
}

function getPointBalanceDetail(userId) {
  return getPointsBalanceInfo(userId);
}

function getGrowthSummary(userId) {
  const growth = ensureUserGrowth(userId);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  const { coefficient, key } = resolveGrowthCoefficient(user);
  const totalExp = Number(growth.total_exp) || 0;
  const svInfo = require('./sv-levels').getSvInfo(totalExp);
  return {
    totalExp,
    svLevel: svInfo.svLevel,
    svName: svInfo.svName,
    badge: svInfo.badge,
    requiredExp: svInfo.requiredExp,
    nextLevelExp: svInfo.nextLevelExp,
    expToNext: svInfo.expToNext,
    roleCoefficient: coefficient,
    roleCoefficientKey: key,
    pointBalance: getPointBalance(userId)
  };
}

module.exports = {
  DAILY_EXP_CAP,
  DAILY_POINTS_CAP,
  todayStr,
  yearMonthStr,
  ensureUserGrowth,
  ensureUserPoints,
  applyExpGain,
  adminAdjustExp,
  adminAdjustPoints,
  applyPointsGain,
  deductPoints,
  getPointBalance,
  getPointBalanceDetail,
  getGrowthSummary
};
