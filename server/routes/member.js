const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const wxpay = require('../lib/wxpay-v3');
const { applyMemberOrderPaid, amountMatchesOrder } = require('../lib/member-order-paid');
const { isMemberActive, reconcileExpiredMembership } = require('../lib/member-active');
const {
  getMemberPlans,
  findPlanById,
  getMemberTrial,
  isTrialPromoActive,
  getTrialUnavailableMessage
} = require('../lib/member-catalog');

function makeOutTradeNo(orderId) {
  const rnd = crypto.randomBytes(5).toString('hex');
  const base = `M${orderId}R${rnd}`;
  return base.length <= 32 ? base : crypto.createHash('sha256').update(`${orderId}:${Date.now()}:${rnd}`).digest('hex').slice(0, 32);
}

/** 会员信息 */
router.get('/info', (req, res) => {
  try {
    const userId = req.userId;
    reconcileExpiredMembership(userId);
    const user = db.prepare('SELECT member_level, member_expire_time FROM users WHERE id = ?').get(userId);
    res.json({
      code: 0,
      data: {
        memberLevel: (user && user.member_level) || '',
        memberExpireTime: (user && user.member_expire_time) || null,
        memberActive: !!(user && isMemberActive(user))
      },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取会员信息失败' });
  }
});

/** 会员等级列表（价格从后台配置读取） */
router.get('/levels', (req, res) => {
  res.json({
    code: 0,
    data: getMemberPlans(),
    message: 'ok'
  });
});

/** 会员权益（静态） */
router.get('/benefits', (req, res) => {
  res.json({ code: 0, data: [], message: 'ok' });
});

/**
 * 支付成功但本地未同步会员时：按商户订单号向微信查单并补写 orders/users。
 */
router.post('/reconcile', async (req, res) => {
  try {
    const userId = req.userId;
    if (!wxpay.isWxPayEnabled()) {
      return res.json({ code: 0, data: { applied: false, reason: 'pay_disabled' }, message: 'ok' });
    }
    reconcileExpiredMembership(userId);
    const userRow = db.prepare('SELECT member_level, member_expire_time FROM users WHERE id = ?').get(userId);
    if (userRow && isMemberActive(userRow)) {
      return res.json({ code: 0, data: { applied: false, reason: 'already_member' }, message: 'ok' });
    }
    const order = db
      .prepare(
        `SELECT * FROM orders WHERE user_id = ?
         AND out_trade_no IS NOT NULL AND trim(out_trade_no) != ''
         ORDER BY id DESC LIMIT 1`
      )
      .get(userId);
    if (!order) {
      return res.json({ code: 0, data: { applied: false, reason: 'no_order' }, message: 'ok' });
    }
    const { status, body } = await wxpay.queryOrderByOutTradeNo(order.out_trade_no);
    if (status !== 200 || !body) {
      return res.json({
        code: 0,
        data: { applied: false, reason: 'query_fail', httpStatus: status },
        message: 'ok'
      });
    }
    if (body.trade_state !== 'SUCCESS') {
      return res.json({
        code: 0,
        data: { applied: false, reason: 'not_paid', trade_state: body.trade_state },
        message: 'ok'
      });
    }
    const cfg = wxpay.getConfig();
    if (body.mchid && cfg && body.mchid !== cfg.mchid) {
      return res.json({ code: 0, data: { applied: false, reason: 'mchid_mismatch' }, message: 'ok' });
    }
    const fresh = db.prepare('SELECT * FROM orders WHERE id = ?').get(order.id);
    if (!fresh) {
      return res.json({ code: 0, data: { applied: false, reason: 'order_missing' }, message: 'ok' });
    }
    if (!amountMatchesOrder(fresh, body)) {
      console.error('[member/reconcile] amount mismatch order=', fresh.amount, 'wx=', body.amount);
      return res.json({ code: 0, data: { applied: false, reason: 'amount_mismatch' }, message: 'ok' });
    }
    applyMemberOrderPaid(fresh, body);
    console.log('[member/reconcile] applied order id=', fresh.id, 'user=', userId, 'order_status_was=', fresh.status);
    return res.json({ code: 0, data: { applied: true, orderId: fresh.id }, message: 'ok' });
  } catch (e) {
    console.error('[member/reconcile]', e);
    return res.status(500).json({ code: 500, message: e.message || '对账失败' });
  }
});

/** 创建会员订单（V6 / 体验会员）；若已配置微信支付则返回 wx.requestPayment 参数 */
router.post('/order', async (req, res) => {
  let orderId = null;
  let amount = 598;
  try {
    const userId = req.userId;
    const { plan = 'v6' } = req.body || {};
    const planKey = String(plan).toLowerCase();

    if (planKey === 'v8') {
      return res.status(400).json({ code: 400, message: 'V8 需联系平台开通' });
    }

    if (planKey === 'trial') {
      const trial = getMemberTrial();
      const msg = getTrialUnavailableMessage(trial);
      if (msg) {
        return res.status(400).json({ code: 400, message: msg });
      }
      if (!isTrialPromoActive(trial)) {
        return res.status(400).json({ code: 400, message: '体验活动已结束' });
      }
    }

    const planObj = findPlanById(planKey);
    if (!planObj) {
      return res.status(400).json({ code: 400, message: '无效的会员套餐' });
    }
    amount = planObj.price;

    const run = db.prepare('INSERT INTO orders (user_id, plan, amount, status) VALUES (?, ?, ?, ?)').run(
      userId,
      planKey,
      amount,
      'pending'
    );
    orderId = run.lastInsertRowid;
    const outTradeNo = makeOutTradeNo(orderId);
    db.prepare('UPDATE orders SET out_trade_no = ? WHERE id = ?').run(outTradeNo, orderId);

    const baseData = { orderId, amount, payment: {} };

    if (!wxpay.isWxPayEnabled()) {
      return res.status(201).json({
        code: 0,
        data: baseData,
        message: 'ok'
      });
    }

    const u = db.prepare('SELECT openid FROM users WHERE id = ?').get(userId);
    const openid = u && u.openid ? String(u.openid).trim() : '';
    if (!openid) {
      return res.status(200).json({
        code: 400,
        message: '请先使用微信登录后再购买会员',
        data: baseData
      });
    }

    const amountFen = Math.round(Number(amount) * 100);
    const desc = planObj.name ? `好时机会员-${planObj.name}` : '好时机会员';
    const payment = await wxpay.jsapiPrepay({
      description: desc,
      outTradeNo,
      amountFen,
      openid
    });

    return res.status(201).json({
      code: 0,
      data: { orderId, amount, payment },
      message: 'ok'
    });
  } catch (e) {
    console.error('[member/order]', e);
    const msg = (e && e.message) || '创建订单失败';
    return res.status(200).json({
      code: 502,
      message: /支付|微信|商户|openid|证书|密钥/i.test(msg) ? msg : `微信支付下单失败：${msg}`,
      data: { orderId, amount, payment: {} }
    });
  }
});

module.exports = router;
