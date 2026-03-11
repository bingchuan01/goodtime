const express = require('express');
const router = express.Router();
const { db } = require('../db');

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

/** 创建会员订单（V6，返回支付参数占位；金额从配置读取） */
router.post('/order', (req, res) => {
  try {
    const userId = req.userId;
    const { plan = 'v6' } = req.body || {};
    if (plan !== 'v6') {
      return res.status(400).json({ code: 400, message: 'V8 需联系平台开通' });
    }
    const plans = getMemberPlans();
    const planObj = plans.find(p => p.id === plan);
    const amount = (planObj && typeof planObj.price === 'number') ? planObj.price : 598;
    const run = db.prepare('INSERT INTO orders (user_id, plan, amount, status) VALUES (?, ?, ?, ?)').run(userId, plan, amount, 'pending');
    const orderId = run.lastInsertRowid;
    res.status(201).json({
      code: 0,
      data: {
        orderId,
        amount,
        payment: {} // TODO: 调微信支付统一下单，返回 payment 给前端 wx.requestPayment
      },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '创建订单失败' });
  }
});

module.exports = router;
