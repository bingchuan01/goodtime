const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { db } = require('../db');
const wxpay = require('../lib/wxpay-v3');

const DEFAULT_PLANS = [
  { id: 'v6', name: 'V6', price: 598, days: 365 },
  { id: 'v8', name: 'V8', price: 21980, days: 365 }
];

function getMemberPlans() {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('member_plans');
  if (!row || !row.value) return DEFAULT_PLANS;
  try {
    const plans = JSON.parse(row.value);
    return Array.isArray(plans) && plans.length > 0 ? plans : DEFAULT_PLANS;
  } catch (e) {
    return DEFAULT_PLANS;
  }
}

function makeOutTradeNo(orderId) {
  const rnd = crypto.randomBytes(5).toString('hex');
  const base = `M${orderId}R${rnd}`;
  return base.length <= 32 ? base : crypto.createHash('sha256').update(`${orderId}:${Date.now()}:${rnd}`).digest('hex').slice(0, 32);
}

/** 会员信息 */
router.get('/info', (req, res) => {
  try {
    const userId = req.userId;
    const user = db.prepare('SELECT member_level, member_expire_time FROM users WHERE id = ?').get(userId);
    res.json({
      code: 0,
      data: {
        memberLevel: (user && user.member_level) || '',
        memberExpireTime: (user && user.member_expire_time) || null
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

/** 创建会员订单（V6）；若已配置微信支付则返回 wx.requestPayment 参数 */
router.post('/order', async (req, res) => {
  let orderId = null;
  let amount = 598;
  try {
    const userId = req.userId;
    const { plan = 'v6' } = req.body || {};
    if (plan !== 'v6') {
      return res.status(400).json({ code: 400, message: 'V8 需联系平台开通' });
    }
    const plans = getMemberPlans();
    const planObj = plans.find((p) => p.id === plan);
    amount = (planObj && typeof planObj.price === 'number') ? planObj.price : 598;
    const run = db.prepare('INSERT INTO orders (user_id, plan, amount, status) VALUES (?, ?, ?, ?)').run(
      userId,
      plan,
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
    const desc = planObj && planObj.name ? `好时机会员-${planObj.name}` : '好时机会员-V6';
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
