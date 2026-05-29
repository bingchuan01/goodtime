const { db } = require('../../db');

function yearEndExpireAt(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  return `${y}-12-31 23:59:59`;
}

function parseTime(str) {
  if (!str) return null;
  const t = new Date(String(str).replace(' ', 'T'));
  return isNaN(t.getTime()) ? null : t;
}

/** 自然年：当年获得的积分在当年 12-31 23:59:59 过期 */
function addPointsBatch(userId, amount) {
  const delta = Math.floor(Number(amount) || 0);
  if (delta <= 0) return;
  const expireAt = yearEndExpireAt(new Date());
  db.prepare(
    `INSERT INTO point_expiry_batches (user_id, amount, remaining, expire_at)
     VALUES (?, ?, ?, ?)`
  ).run(userId, delta, delta, expireAt);
}

/** 扣减时优先消耗最早到期的批次 */
function consumePointsBatches(userId, amount) {
  let left = Math.floor(Number(amount) || 0);
  if (left <= 0) return;
  const batches = db.prepare(
    `SELECT id, remaining FROM point_expiry_batches
     WHERE user_id = ? AND remaining > 0
     ORDER BY expire_at ASC, id ASC`
  ).all(userId);
  for (const b of batches) {
    if (left <= 0) break;
    const rem = Number(b.remaining) || 0;
    if (rem <= 0) continue;
    const use = Math.min(rem, left);
    db.prepare('UPDATE point_expiry_batches SET remaining = remaining - ? WHERE id = ?').run(use, b.id);
    left -= use;
  }
}

function expirePointsForUser(userId) {
  const now = Date.now();
  const batches = db.prepare(
    `SELECT id, remaining, expire_at FROM point_expiry_batches
     WHERE user_id = ? AND remaining > 0`
  ).all(userId);
  let totalExpired = 0;
  for (const b of batches) {
    const exp = parseTime(b.expire_at);
    if (!exp || exp.getTime() >= now) continue;
    const rem = Number(b.remaining) || 0;
    if (rem <= 0) continue;
    totalExpired += rem;
    db.prepare('UPDATE point_expiry_batches SET remaining = 0 WHERE id = ?').run(b.id);
  }
  if (totalExpired <= 0) return 0;

  const acct = db.prepare('SELECT balance FROM user_points WHERE user_id = ?').get(userId);
  const balance = Math.max(0, (Number(acct && acct.balance) || 0) - totalExpired);
  db.prepare(
    'UPDATE user_points SET balance = ?, updated_at = datetime(\'now\', \'localtime\') WHERE user_id = ?'
  ).run(balance, userId);
  db.prepare(
    `INSERT INTO point_ledger (user_id, delta, type, balance_after, remark)
     VALUES (?, ?, 'expire', ?, ?)`
  ).run(userId, -totalExpired, balance, '积分自然年过期');
  return totalExpired;
}

function getPointsBalanceInfo(userId) {
  expirePointsForUser(userId);
  const acct = db.prepare('SELECT balance FROM user_points WHERE user_id = ?').get(userId);
  const balance = Number(acct && acct.balance) || 0;

  const soonDate = new Date();
  soonDate.setDate(soonDate.getDate() + 30);
  const soonTs = soonDate.getTime();
  const batches = db.prepare(
    `SELECT remaining, expire_at FROM point_expiry_batches
     WHERE user_id = ? AND remaining > 0`
  ).all(userId);

  let expiringSoon = 0;
  let nearestExpire = null;
  for (const b of batches) {
    const rem = Number(b.remaining) || 0;
    const exp = parseTime(b.expire_at);
    if (!exp) continue;
    if (!nearestExpire || exp.getTime() < nearestExpire.getTime()) nearestExpire = exp;
    if (exp.getTime() <= soonTs) expiringSoon += rem;
  }

  return {
    balance,
    expiringSoon,
    expireAt: nearestExpire ? nearestExpire.toISOString().slice(0, 10) : null
  };
}

module.exports = {
  yearEndExpireAt,
  addPointsBatch,
  consumePointsBatches,
  expirePointsForUser,
  getPointsBalanceInfo
};
