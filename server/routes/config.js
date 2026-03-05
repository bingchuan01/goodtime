const express = require('express');
const router = express.Router();
const { db } = require('../db');

/** 获取配置项（公开，按 key） */
router.get('/:key', (req, res) => {
  try {
    const key = String(req.params.key || '').trim();
    if (!key) return res.status(400).json({ code: 400, message: '缺少 key' });
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
    if (!row) return res.json({ code: 0, data: null, message: 'ok' });
    let value = row.value;
    if (key === 'dashboard' || key === 'benefits_carousel') {
      try {
        value = JSON.parse(value);
      } catch (e) {}
    }
    res.json({ code: 0, data: value, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取配置失败' });
  }
});

module.exports = router;
