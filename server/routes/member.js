const express = require('express');
const router = express.Router();
const { db } = require('../db');

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

/** 会员等级列表 */
router.get('/levels', (req, res) => {
  res.json({
    code: 0,
    data: [
      { id: 'v6', name: 'V6', price: 598, days: 365 },
      { id: 'v8', name: 'V8', price: 21980, days: 365 }
    ],
    message: 'ok'
  });
});

/** 会员权益（静态） */
router.get('/benefits', (req, res) => {
  res.json({ code: 0, data: [], message: 'ok' });
});

/** 创建会员订单（V6，返回支付参数占位） */
router.post('/order', (req, res) => {
  try {
    const userId = req.userId;
    const { plan = 'v6' } = req.body || {};
    if (plan !== 'v6') {
      return res.status(400).json({ code: 400, message: 'V8 需联系平台开通' });
    }
    const amount = 598;
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
