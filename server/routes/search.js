const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { ensureSurgePoolCurrent, getSurgePoolMap } = require('../lib/surge-pool');
const { enrichListRow } = require('../lib/project-list');

/** 搜索项目（关键词、分类） */
router.get('/projects', (req, res) => {
  try {
    ensureSurgePoolCurrent();
    const keyword = String(req.query.keyword || '').trim();
    const categoryIds = req.query.categoryIds ? String(req.query.categoryIds).split(',').map(s => s.trim()).filter(Boolean) : [];
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;

    let sql = 'SELECT p.* FROM projects p LEFT JOIN users u ON p.user_id = u.id WHERE p.status = ?';
    const params = ['approved'];

    if (keyword) {
      sql += ' AND (p.title LIKE ? OR p.category_tag LIKE ? OR p.ip_address LIKE ? OR u.nickname LIKE ?)';
      const kw = '%' + keyword + '%';
      params.push(kw, kw, kw, kw);
    }
    if (categoryIds.length > 0) {
      const placeholders = categoryIds.map(() => '?').join(',');
      sql += ` AND (p.category_id IN (${placeholders}) OR p.category_tag IN (${placeholders}))`;
      params.push(...categoryIds, ...categoryIds);
    }

    const listOrderSql = `CASE WHEN p.pinned_until IS NOT NULL AND p.pinned_until != '' AND p.pinned_until > datetime('now', 'localtime') THEN 0 ELSE 1 END,
  COALESCE(NULLIF(TRIM(p.published_at), ''), p.updated_at) DESC, p.id DESC`;
    sql += ` ORDER BY ${listOrderSql} LIMIT ? OFFSET ?`;
    params.push(pageSize + 1, offset);

    const surgeMap = getSurgePoolMap();
    const rows = db.prepare(sql).all(...params);
    const hasMore = rows.length > pageSize;
    const list = rows.slice(0, pageSize).map((p) => enrichListRow(p, surgeMap));

    res.json({ code: 0, data: { list, hasMore }, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '搜索失败' });
  }
});

module.exports = router;
