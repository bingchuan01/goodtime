const express = require('express');
const router = express.Router();
const { db } = require('../db');

function projectToListRow(p) {
  const publisher = db.prepare('SELECT id, nickname, avatar, member_level FROM users WHERE id = ?').get(p.user_id);
  let carouselImages = [];
  try {
    carouselImages = JSON.parse(p.carousel_images || '[]');
  } catch (e) {}
  return {
    id: String(p.id),
    title: p.title,
    ip: p.ip_address || '',
    category: p.category_tag || p.category_id || '',
    storeCount: p.store_count || '',
    viewCount: p.view_count || 0,
    investmentAmount: p.base_amount && p.max_amount ? `¥${p.base_amount}-${p.max_amount}万` : (p.base_amount ? `¥${p.base_amount}万` : ''),
    isOfficial: !!p.is_official,
    memberLevel: p.member_level || '',
    coverType: p.cover_type || 'image',
    coverUrl: carouselImages[0] || p.video_poster || '',
    videoUrl: p.video_url || '',
    videoPoster: p.video_poster || '',
    publisher: publisher ? {
      id: publisher.id,
      nickname: publisher.nickname || '未知',
      avatar: publisher.avatar || '',
      memberLevel: publisher.member_level || '',
      ip: p.ip_address || ''
    } : { id: p.user_id, nickname: '未知', avatar: '', memberLevel: '', ip: p.ip_address || '' },
    categoryTag: p.category_tag || '',
    clueCount: p.clue_count || 0
  };
}

/** 搜索项目（关键词、分类） */
router.get('/projects', (req, res) => {
  try {
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
      sql += ` AND (category_id IN (${placeholders}) OR category_tag IN (${placeholders}))`;
      params.push(...categoryIds, ...categoryIds);
    }

    sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize + 1, offset);

    const rows = db.prepare(sql).all(...params);
    const hasMore = rows.length > pageSize;
    const list = rows.slice(0, pageSize).map(projectToListRow);

    res.json({ code: 0, data: { list, hasMore }, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '搜索失败' });
  }
});

module.exports = router;
