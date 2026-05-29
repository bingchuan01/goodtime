const express = require('express');
const router = express.Router();
const { db } = require('../db');

const ZONE_DISPLAY_NAMES = {
  hot: '热门赛道',
  trend: '前沿趋势',
  new: '品牌上新'
};

/** 分类列表（仅启用，供小程序） */
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT id, name, icon, sort FROM categories WHERE enabled = 1 ORDER BY sort ASC, id ASC').all();
    const list = rows.map((row) => {
      const id = String(row.id || '');
      const name = ZONE_DISPLAY_NAMES[id] || row.name || '';
      return { ...row, id, name };
    });
    res.json({ code: 0, data: list, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取分类失败' });
  }
});

module.exports = router;
