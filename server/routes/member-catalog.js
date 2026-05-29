const express = require('express');
const router = express.Router();
const { getMemberCatalog } = require('../lib/member-catalog');

/** 会员套餐目录（公开，支付页未登录也可展示价格） */
router.get('/', (req, res) => {
  res.json({ code: 0, data: getMemberCatalog(), message: 'ok' });
});

module.exports = router;
