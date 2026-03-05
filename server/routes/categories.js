const express = require('express');
const router = express.Router();
const { db } = require('../db');

/** 分类列表（仅启用，供小程序） */
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT id, name, icon, sort FROM categories WHERE enabled = 1 ORDER BY sort ASC, id ASC').all();
    res.json({ code: 0, data: rows, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取分类失败' });
  }
});

module.exports = router;
