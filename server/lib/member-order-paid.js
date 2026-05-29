/**
 * 会员订单支付成功后写库（支付回调与主动对账共用）
 */
const { db } = require('../db');
const { findPlanById } = require('./member-catalog');

function planToMemberLevel(plan) {
  const p = String(plan || '').toLowerCase();
  if (p === 'v6') return 'V6';
  if (p === 'trial') return '体验者';
  if (p === 'v8') return 'V8';
  return plan ? String(plan).toUpperCase() : '';
}

function computeNewExpire(currentExpireIso, days) {
  const now = new Date();
  let base = now;
  if (currentExpireIso) {
    const raw = String(currentExpireIso).trim();
    const t = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
    if (!isNaN(t.getTime()) && t.getTime() > now.getTime()) base = t;
  }
  const end = new Date(base);
  end.setDate(end.getDate() + Number(days || 365));
  const yyyy = end.getFullYear();
  const mm = String(end.getMonth() + 1).padStart(2, '0');
  const dd = String(end.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} 23:59:59`;
}

/**
 * @param {object} order orders 表一行（须含 id, user_id, plan, amount）
 * @param {object} plain 微信订单明文：transaction_id、amount 等
 */
function applyMemberOrderPaid(order, plain) {
  const transactionId = (plain && plain.transaction_id) || '';
  const userId = order.user_id;
  const plan = order.plan;
  const memberLevel = planToMemberLevel(plan);
  const planObj = findPlanById(plan);
  const days = (planObj && planObj.days) || 365;
  const user = db.prepare('SELECT member_expire_time FROM users WHERE id = ?').get(userId);
  const previousExpire = user && user.member_expire_time;
  const newExp = computeNewExpire(previousExpire, days);
  db.prepare(
    "UPDATE orders SET status = 'paid', payment_type = 'wechat', paid_at = datetime('now', 'localtime'), transaction_id = ? WHERE id = ?"
  ).run(transactionId, order.id);
  db.prepare('UPDATE users SET member_level = ?, member_expire_time = ? WHERE id = ?').run(memberLevel, newExp, userId);

  try {
    const { grantContentEditPoolOnPayment } = require('./growth/content-edit-pool');
    grantContentEditPoolOnPayment(userId, order.id, days, newExp, previousExpire, plan);
  } catch (e) {
    console.error('[member-order-paid] content edit pool', e.message);
  }
}

/** 与订单金额（元）对比；微信可能给 payer_total 或 total（分）；缺字段时不校验 */
function amountMatchesOrder(order, plain) {
  const expectFen = Math.round(Number(order.amount) * 100);
  const amt = (plain && plain.amount) || {};
  let fen = null;
  if (typeof amt.payer_total === 'number') fen = amt.payer_total;
  else if (typeof amt.payer_total === 'string' && /^\d+$/.test(String(amt.payer_total).trim())) {
    fen = parseInt(String(amt.payer_total).trim(), 10);
  }
  if (fen == null && typeof amt.total === 'number') fen = amt.total;
  if (fen == null && typeof amt.total === 'string' && /^\d+$/.test(String(amt.total).trim())) {
    fen = parseInt(String(amt.total).trim(), 10);
  }
  if (fen == null) return true;
  return fen === expectFen;
}

module.exports = { applyMemberOrderPaid, planToMemberLevel, computeNewExpire, amountMatchesOrder };
