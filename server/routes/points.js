const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { isMemberActive } = require('../lib/member-active');
const {
  yearMonthStr,
  deductPoints,
  getPointBalanceDetail,
  ensureUserPoints,
  DAILY_POINTS_CAP
} = require('../lib/growth/grant-exp-points');
const { expToSvLevel } = require('../lib/growth/sv-levels');

function getMonthlyRedeemCount(userId, productId, ym) {
  const row = db.prepare(
    `SELECT COALESCE(SUM(quantity), 0) as c FROM point_orders
     WHERE user_id = ? AND product_id = ? AND created_at LIKE ?`
  ).get(userId, productId, ym + '%');
  return Number(row && row.c) || 0;
}

function getMakeupQuota(userId, ym) {
  let row = db.prepare(
    'SELECT * FROM makeup_quota_monthly WHERE user_id = ? AND year_month = ?'
  ).get(userId, ym);
  if (!row) {
    db.prepare(
      'INSERT INTO makeup_quota_monthly (user_id, year_month) VALUES (?, ?)'
    ).run(userId, ym);
    row = { free_used: 0, points_purchased: 0 };
  }
  return row;
}

router.get('/balance', (req, res) => {
  try {
    const info = getPointBalanceDetail(req.userId);
    res.json({
      code: 0,
      data: {
        balance: info.balance,
        frozen: 0,
        expiringSoon: info.expiringSoon,
        expireAt: info.expireAt
      },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取余额失败' });
  }
});

router.get('/ledger', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;
    const type = req.query.type ? String(req.query.type).trim() : '';
    let sql = 'SELECT * FROM point_ledger WHERE user_id = ?';
    const params = [req.userId];
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    params.push(pageSize + 1, offset);
    const rows = db.prepare(sql).all(...params);
    const hasMore = rows.length > pageSize;
    res.json({
      code: 0,
      data: {
        list: rows.slice(0, pageSize).map((r) => ({
          id: r.id,
          delta: r.delta,
          type: r.type,
          remark: r.remark,
          balanceAfter: r.balance_after,
          createdAt: r.created_at
        })),
        hasMore
      },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取流水失败' });
  }
});

router.get('/limits', (req, res) => {
  try {
    const userId = req.userId;
    const today = require('../lib/growth/grant-exp-points').todayStr();
    const stats = db.prepare(
      'SELECT points_earned FROM growth_daily_stats WHERE user_id = ? AND stat_date = ?'
    ).get(userId, today);
    const ym = yearMonthStr();
    const quota = getMakeupQuota(userId, ym);
    res.json({
      code: 0,
      data: {
        dailyEarned: Number(stats && stats.points_earned) || 0,
        dailyCap: DAILY_POINTS_CAP,
        monthlyMakeupPurchased: Number(quota.points_purchased) || 0,
        monthlyMakeupFreeUsed: Number(quota.free_used) || 0
      },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取限额失败' });
  }
});

router.get('/mall/categories', (req, res) => {
  res.json({
    code: 0,
    data: [
      { id: 'growth', name: '成长辅助', sort: 1 },
      { id: 'display', name: '发布/展示', sort: 2 },
      { id: 'member', name: '会员专享', sort: 3 },
      { id: 'gift', name: '小礼品', sort: 4 }
    ],
    message: 'ok'
  });
});

function productVisibleForUser(product, user, svLevel) {
  if (product.status !== 'active') return false;
  if (product.coupon_type === 'content_edit') return false;
  if ((Number(product.sv_min) || 1) > svLevel) return false;
  if (product.member_only && !isMemberActive(user)) return false;
  return true;
}

function mapProductRow(p, userId, svLevel) {
  const ym = yearMonthStr();
  const used = getMonthlyRedeemCount(userId, p.id, ym);
  const limit = Number(p.monthly_limit) || 0;
  return {
    id: p.id,
    category: p.category,
    name: p.name,
    description: p.description,
    price: p.price,
    stock: p.stock,
    monthlyLimit: limit,
    userMonthlyRemain: limit > 0 ? Math.max(0, limit - used) : null,
    memberOnly: !!p.member_only,
    couponType: p.coupon_type,
    svMin: p.sv_min
  };
}

router.get('/mall/products', (req, res) => {
  try {
    const userId = req.userId;
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const growth = db.prepare('SELECT total_exp FROM user_growth WHERE user_id = ?').get(userId);
    const svLevel = expToSvLevel(growth ? growth.total_exp : 0);
    const categoryId = req.query.categoryId ? String(req.query.categoryId).trim() : '';
    let rows = db.prepare(
      `SELECT * FROM point_products WHERE status = 'active' ORDER BY sort ASC, id ASC`
    ).all();
    rows = rows.filter((p) => productVisibleForUser(p, user, svLevel));
    if (categoryId) rows = rows.filter((p) => p.category === categoryId);
    res.json({
      code: 0,
      data: { list: rows.map((p) => mapProductRow(p, userId, svLevel)) },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取商品失败' });
  }
});

router.get('/mall/products/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const p = db.prepare('SELECT * FROM point_products WHERE id = ?').get(id);
    if (!p || p.status !== 'active') {
      return res.status(404).json({ code: 404, message: '商品不存在' });
    }
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    const growth = db.prepare('SELECT total_exp FROM user_growth WHERE user_id = ?').get(req.userId);
    const svLevel = expToSvLevel(growth ? growth.total_exp : 0);
    if (!productVisibleForUser(p, user, svLevel)) {
      return res.status(403).json({ code: 403, message: '当前不可兑换该商品' });
    }
    res.json({ code: 0, data: mapProductRow(p, req.userId, svLevel), message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取详情失败' });
  }
});

router.post('/mall/redeem', (req, res) => {
  try {
    const userId = req.userId;
    const productId = parseInt(req.body && req.body.productId, 10);
    const quantity = Math.max(1, parseInt(req.body && req.body.quantity, 10) || 1);
    if (!productId) return res.status(400).json({ code: 400, message: '请选择商品' });

    const product = db.prepare('SELECT * FROM point_products WHERE id = ?').get(productId);
    if (!product || product.status !== 'active') {
      return res.status(404).json({ code: 404, message: '商品不存在或已下架' });
    }
    if (product.coupon_type === 'content_edit') {
      return res.status(403).json({ code: 403, message: '该商品暂未开放' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const growth = db.prepare('SELECT total_exp FROM user_growth WHERE user_id = ?').get(userId);
    const svLevel = expToSvLevel(growth ? growth.total_exp : 0);
    if (!productVisibleForUser(product, user, svLevel)) {
      return res.status(403).json({ code: 403, message: '不满足兑换条件' });
    }

    const ym = yearMonthStr();
    const monthlyLimit = Number(product.monthly_limit) || 0;
    if (monthlyLimit > 0) {
      const used = getMonthlyRedeemCount(userId, productId, ym);
      if (used + quantity > monthlyLimit) {
        return res.status(422).json({ code: 422, message: '本月兑换已达上限' });
      }
    }

    const totalCost = (Number(product.price) || 0) * quantity;
    if (totalCost > 0) {
      ensureUserPoints(userId);
      const info = getPointBalanceDetail(userId);
      if (info.balance < totalCost) {
        return res.status(422).json({ code: 422, message: '积分不足' });
      }
    }

    const couponIds = [];
    let orderId = null;

    db.withTransaction(() => {
      if (product.coupon_type === 'makeup_free') {
        const quota = getMakeupQuota(userId, ym);
        if ((Number(quota.free_used) || 0) >= 1) {
          const err = new Error('本月免费补签额度已用完');
          err.code = 422;
          throw err;
        }
        db.prepare(
          'UPDATE makeup_quota_monthly SET free_used = 1 WHERE user_id = ? AND year_month = ?'
        ).run(userId, ym);
      } else if (totalCost > 0) {
        const d = deductPoints(userId, totalCost, 'redeem', String(productId), '兑换：' + product.name);
        if (!d.ok) {
          const err = new Error(d.message || '积分不足');
          err.code = 422;
          throw err;
        }
      }

      const orderResult = db.prepare(
        `INSERT INTO point_orders (user_id, product_id, quantity, points_cost, status)
         VALUES (?, ?, ?, ?, 'completed')`
      ).run(userId, productId, quantity, totalCost);
      orderId = orderResult.lastInsertRowid;

      if (product.coupon_type && product.coupon_type !== 'makeup_free' && product.coupon_type !== 'badge') {
        for (let i = 0; i < quantity; i++) {
          const expires = new Date();
          expires.setDate(expires.getDate() + 30);
          const expStr = expires.toISOString().slice(0, 10) + ' 23:59:59';
          const cr = db.prepare(
            `INSERT INTO user_coupons (user_id, type, status, expires_at, order_id)
             VALUES (?, ?, 'unused', ?, ?)`
          ).run(userId, product.coupon_type, expStr, orderId);
          couponIds.push(cr.lastInsertRowid);
        }
      }
    });

    res.json({ code: 0, data: { orderId, couponIds }, message: '兑换成功' });
  } catch (e) {
    if (e.code === 422) return res.status(422).json({ code: 422, message: e.message });
    console.error(e);
    res.status(500).json({ code: 500, message: e.message || '兑换失败' });
  }
});

router.get('/orders', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;
    const rows = db.prepare(
      `SELECT o.*, p.name as product_name FROM point_orders o
       LEFT JOIN point_products p ON p.id = o.product_id
       WHERE o.user_id = ? ORDER BY o.id DESC LIMIT ? OFFSET ?`
    ).all(req.userId, pageSize + 1, offset);
    const hasMore = rows.length > pageSize;
    res.json({
      code: 0,
      data: {
        list: rows.slice(0, pageSize).map((r) => ({
          id: r.id,
          productId: r.product_id,
          productName: r.product_name,
          quantity: r.quantity,
          pointsCost: r.points_cost,
          status: r.status,
          createdAt: r.created_at
        })),
        hasMore
      },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取订单失败' });
  }
});

router.post('/coupons/:id/use', (req, res) => {
  try {
    const userId = req.userId;
    const couponId = parseInt(req.params.id, 10);
    const projectId = parseInt(req.body && req.body.projectId, 10);
    if (!couponId) return res.status(400).json({ code: 400, message: '无效券 id' });

    const coupon = db.prepare('SELECT * FROM user_coupons WHERE id = ? AND user_id = ?').get(couponId, userId);
    if (!coupon || coupon.status !== 'unused') {
      return res.status(404).json({ code: 404, message: '券不存在或已使用' });
    }

    const { applyExtendDisplayCoupon, applyPinCoupon } = require('../lib/growth/coupon-use');

    if (coupon.type === 'extend_display' || coupon.type === 'pin') {
      if (!projectId) return res.status(400).json({ code: 400, message: '请指定项目' });
      const result = coupon.type === 'extend_display'
        ? applyExtendDisplayCoupon(userId, projectId, couponId)
        : applyPinCoupon(userId, projectId, couponId);
      if (!result.ok) return res.status(422).json({ code: 422, message: result.message });
      return res.json({ code: 0, data: result, message: 'ok' });
    }

    if (coupon.type === 'makeup') {
      return res.status(400).json({ code: 400, message: '补签卡请在成长中心使用' });
    }

    return res.json({
      code: 0,
      data: { couponId, type: coupon.type, status: 'ready' },
      message: '卡券已激活，请在对应功能中使用'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '使用失败' });
  }
});

router.get('/orders/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const row = db.prepare(
      `SELECT o.*, p.name as product_name, p.description as product_description
       FROM point_orders o LEFT JOIN point_products p ON p.id = o.product_id
       WHERE o.id = ? AND o.user_id = ?`
    ).get(id, req.userId);
    if (!row) return res.status(404).json({ code: 404, message: '订单不存在' });
    res.json({
      code: 0,
      data: {
        id: row.id,
        productId: row.product_id,
        productName: row.product_name,
        productDescription: row.product_description,
        quantity: row.quantity,
        pointsCost: row.points_cost,
        status: row.status,
        createdAt: row.created_at
      },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取订单详情失败' });
  }
});

router.get('/coupons', (req, res) => {
  try {
    const userId = req.userId;
    const type = req.query.type ? String(req.query.type).trim() : '';
    const status = req.query.status ? String(req.query.status).trim() : 'unused';
    let sql = 'SELECT * FROM user_coupons WHERE user_id = ?';
    const params = [userId];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    sql += ' ORDER BY id DESC LIMIT 100';
    const rows = db.prepare(sql).all(...params);
    const typeNames = {
      makeup: '补签卡',
      exp_boost: '经验加速卡',
      share_boost: '分享加成卡',
      extend_display: '展示期延长券',
      pin: '置顶卡'
    };
    res.json({
      code: 0,
      data: {
        list: rows.map((c) => ({
          id: c.id,
          type: c.type,
          typeName: typeNames[c.type] || c.type,
          status: c.status,
          expiresAt: c.expires_at,
          usedAt: c.used_at,
          createdAt: c.created_at
        }))
      },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取券包失败' });
  }
});

module.exports = router;
