const { db } = require('../db');
const wxpay = require('../lib/wxpay-v3');

function planToMemberLevel(plan) {
  const p = String(plan || '').toLowerCase();
  if (p === 'v6') return 'V6';
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
 * 微信支付 v3 结果通知（需使用 express.raw 挂载以保证验签字节一致）
 */
async function handleWxPayNotify(req, res) {
  try {
    const cfg = wxpay.getConfig();
    if (!cfg) {
      return res.status(500).json({ code: 'FAIL', message: '未配置支付' });
    }
    const buf = req.body;
    if (!Buffer.isBuffer(buf)) {
      return res.status(400).send('invalid body');
    }
    const rawUtf8 = buf.toString('utf8');
    const ok = await wxpay.verifyNotifySignature(req.headers, rawUtf8);
    if (!ok) {
      console.warn('[wxpay] notify signature verify failed');
      return res.status(401).end();
    }
    let payload;
    try {
      payload = JSON.parse(rawUtf8);
    } catch (e) {
      return res.status(400).send('bad json');
    }
    if (payload.event_type !== 'TRANSACTION.SUCCESS') {
      return res.status(200).json({ code: 'SUCCESS', message: '成功' });
    }
    const resource = payload.resource;
    if (!resource) {
      return res.status(200).json({ code: 'FAIL', message: '无 resource' });
    }
    let plain;
    try {
      plain = wxpay.decryptNotifyResource(resource, cfg.apiV3Key);
    } catch (e) {
      console.error('[wxpay] decrypt fail', e.message);
      return res.status(500).json({ code: 'FAIL', message: '解密失败' });
    }
    const outTradeNo = plain.out_trade_no;
    const transactionId = plain.transaction_id;
    const tradeState = plain.trade_state;
    if (tradeState !== 'SUCCESS') {
      return res.status(200).json({ code: 'SUCCESS', message: '成功' });
    }
    if (plain.mchid && plain.mchid !== cfg.mchid) {
      console.warn('[wxpay] mchid mismatch', plain.mchid);
      return res.status(200).json({ code: 'FAIL', message: '商户号不一致' });
    }
    const order = db.prepare('SELECT * FROM orders WHERE out_trade_no = ?').get(outTradeNo);
    if (!order) {
      console.warn('[wxpay] order not found for out_trade_no=', outTradeNo);
      return res.status(200).json({ code: 'FAIL', message: '订单不存在' });
    }
    if (order.status === 'paid') {
      return res.status(200).json({ code: 'SUCCESS', message: '成功' });
    }
    const expectFen = Math.round(Number(order.amount) * 100);
    const payerTotal = plain.amount && typeof plain.amount.payer_total === 'number' ? plain.amount.payer_total : null;
    if (payerTotal != null && payerTotal !== expectFen) {
      console.error('[wxpay] amount mismatch order=', expectFen, 'notify=', payerTotal);
      return res.status(200).json({ code: 'FAIL', message: '金额不一致' });
    }
    const userId = order.user_id;
    const plan = order.plan;
    const memberLevel = planToMemberLevel(plan);
    const plansRow = db.prepare('SELECT value FROM config WHERE key = ?').get('member_plans');
    let days = 365;
    if (plansRow && plansRow.value) {
      try {
        const arr = JSON.parse(plansRow.value);
        const po = Array.isArray(arr) && arr.find((x) => x.id === plan);
        if (po && typeof po.days === 'number') days = po.days;
      } catch (e) {
        /* ignore */
      }
    }
    const user = db.prepare('SELECT member_expire_time FROM users WHERE id = ?').get(userId);
    const newExp = computeNewExpire(user && user.member_expire_time, days);
    db.prepare(
      "UPDATE orders SET status = 'paid', payment_type = 'wechat', paid_at = datetime('now', 'localtime'), transaction_id = ? WHERE id = ?"
    ).run(transactionId || '', order.id);
    db.prepare('UPDATE users SET member_level = ?, member_expire_time = ? WHERE id = ?').run(
      memberLevel,
      newExp,
      userId
    );
    return res.status(200).json({ code: 'SUCCESS', message: '成功' });
  } catch (e) {
    console.error('[wxpay] notify error', e);
    return res.status(500).json({ code: 'FAIL', message: e.message || 'error' });
  }
}

module.exports = handleWxPayNotify;
