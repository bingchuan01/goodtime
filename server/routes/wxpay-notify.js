const { db } = require('../db');
const wxpay = require('../lib/wxpay-v3');
const { applyMemberOrderPaid, amountMatchesOrder } = require('../lib/member-order-paid');

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
    const tradeState = plain.trade_state;
    // 部分报文无 trade_state；仅当明确存在且非 SUCCESS 时跳过，避免误伤不写库
    if (tradeState != null && tradeState !== '' && tradeState !== 'SUCCESS') {
      console.warn('[wxpay] trade_state not SUCCESS', tradeState);
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
    if (!amountMatchesOrder(order, plain)) {
      const expectFen = Math.round(Number(order.amount) * 100);
      console.error('[wxpay] amount mismatch order=', expectFen, 'plain=', plain.amount);
      return res.status(200).json({ code: 'FAIL', message: '金额不一致' });
    }
    applyMemberOrderPaid(order, plain);
    console.log('[wxpay] notify paid ok out_trade_no=', outTradeNo, 'user_id=', order.user_id);
    return res.status(200).json({ code: 'SUCCESS', message: '成功' });
  } catch (e) {
    console.error('[wxpay] notify error', e);
    return res.status(500).json({ code: 'FAIL', message: e.message || 'error' });
  }
}

module.exports = handleWxPayNotify;
