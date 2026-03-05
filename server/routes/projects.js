const express = require('express');
const router = express.Router();
const { db, ensureUser } = require('../db');

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
    clueCount: p.clue_count || 0,
    status: p.status,
    displayZone: p.display_zone || ''
  };
}

function projectToDetailRow(p) {
  const publisher = db.prepare('SELECT id, nickname, avatar, member_level FROM users WHERE id = ?').get(p.user_id);
  let carouselImages = [];
  try {
    carouselImages = JSON.parse(p.carousel_images || '[]');
  } catch (e) {}
  return {
    id: String(p.id),
    title: p.title,
    ipAddress: p.ip_address || '',
    storeCount: p.store_count || '',
    baseAmount: p.base_amount || '',
    maxAmount: p.max_amount || '',
    categoryTag: p.category_tag || p.category_id || '',
    categoryId: p.category_id || '',
    coverType: p.cover_type || 'carousel',
    carouselImages,
    videoUrl: p.video_url || '',
    videoPoster: p.video_poster || '',
    detailContent: p.detail_content || '',
    introduction: p.introduction || '',
    memberLevel: p.member_level || 'V6',
    isOfficial: !!p.is_official,
    viewCount: p.view_count || 0,
    clueCount: p.clue_count || 0,
    publisher: publisher ? {
      id: publisher.id,
      nickname: publisher.nickname || '未知',
      avatar: publisher.avatar || '',
      memberLevel: publisher.member_level || '',
      ip: p.ip_address || ''
    } : { id: p.user_id, nickname: '未知', avatar: '', memberLevel: '', ip: p.ip_address || '' },
    status: p.status,
    displayZone: p.display_zone || '',
    rejectReason: p.reject_reason || ''
  };
}

/** 项目列表（分页，仅已通过，支持分类/展区） */
router.get('/', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const categoryId = (req.query.categoryId || req.query.category || '').trim();
    const displayZone = (req.query.displayZone || req.query.zone || '').trim();
    const offset = (page - 1) * pageSize;

    let sql = 'SELECT * FROM projects WHERE status = ?';
    const params = ['approved'];

    if (categoryId) {
      sql += ' AND (category_id = ? OR category_tag = ?)';
      params.push(categoryId, categoryId);
    }
    if (displayZone) {
      sql += ' AND display_zone = ?';
      params.push(displayZone);
    }

    sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize + 1, offset);

    const rows = db.prepare(sql).all(...params);
    const hasMore = rows.length > pageSize;
    const list = rows.slice(0, pageSize).map(projectToListRow);

    res.json({ code: 0, data: { list, hasMore }, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取列表失败' });
  }
});

/** 项目详情 */
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ code: 400, message: '无效项目 id' });

    const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!p) return res.status(404).json({ code: 404, message: '项目不存在' });

    if (p.status !== 'approved') {
      const userId = req.userId;
      if (!userId || p.user_id !== userId) {
        return res.status(404).json({ code: 404, message: '项目不存在' });
      }
    }

    db.prepare('UPDATE projects SET view_count = view_count + 1 WHERE id = ?').run(id);
    const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.json({ code: 0, data: projectToDetailRow(updated), message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取详情失败' });
  }
});

/** 创建项目（待审核） */
router.post('/', (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ code: 401, message: '未登录' });
    const body = req.body || {};
    const title = String(body.title || '').trim();
    if (!title) return res.status(400).json({ code: 400, message: '请填写标题' });

    ensureUser(userId);
    const user = db.prepare('SELECT member_level FROM users WHERE id = ?').get(userId);
    const memberLevel = (user && user.member_level) || body.memberLevel || 'V6';
    const coverType = body.coverType || 'carousel';
    let carouselImages = body.carouselImages;
    if (Array.isArray(carouselImages)) {
      carouselImages = JSON.stringify(carouselImages);
    } else if (typeof carouselImages === 'string') {
      carouselImages = carouselImages;
    } else {
      carouselImages = '[]';
    }

    const runResult = db.prepare(`
      INSERT INTO projects (user_id, title, ip_address, store_count, base_amount, max_amount, category_id, category_tag, cover_type, carousel_images, video_url, video_poster, detail_content, introduction, member_level, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      userId,
      title,
      String(body.ipAddress || body.ip_address || '').trim(),
      String(body.storeCount || body.store_count || '').trim(),
      String(body.baseAmount || body.base_amount || '').trim(),
      String(body.maxAmount || body.max_amount || '').trim(),
      String(body.categoryId || body.category_id || '').trim(),
      String(body.categoryTag || body.category_tag || '').trim(),
      coverType,
      carouselImages,
      String(body.videoUrl || body.video_url || '').trim(),
      String(body.videoPoster || body.video_poster || '').trim(),
      String(body.detailContent || body.detail_content || '').trim(),
      String(body.introduction || '').trim(),
      memberLevel
    );
    let id = runResult && runResult.lastInsertRowid;
    if (!id) {
      const idRow = db.prepare('SELECT last_insert_rowid() as id').get();
      id = idRow && (idRow.id != null) ? idRow.id : null;
    }
    if (id == null) {
      throw new Error('无法获取新项目 id');
    }
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!row) {
      throw new Error('项目创建后查询失败，id=' + id);
    }
    res.status(201).json({ code: 0, data: projectToDetailRow(row), message: '提交成功，等待审核' });
  } catch (e) {
    console.error('POST /projects 错误:', e);
    const msg = (e && (e.message || (typeof e === 'string' ? e : (e.toString && e.toString())))) || '提交失败';
    res.status(500).json({ code: 500, message: String(msg) });
  }
});

/** 更新项目（仅作者，且状态为 rejected 时可编辑） */
router.put('/:id', (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ code: 401, message: '未登录' });
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ code: 400, message: '无效项目 id' });

    const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!p) return res.status(404).json({ code: 404, message: '项目不存在' });
    if (p.user_id !== userId) return res.status(403).json({ code: 403, message: '无权限修改' });
    if (p.status === 'approved') return res.status(400).json({ code: 400, message: '已通过的项目不可再编辑' });

    const body = req.body || {};
    const title = String(body.title || p.title).trim();
    const carouselImages = body.carouselImages != null
      ? (Array.isArray(body.carouselImages) ? JSON.stringify(body.carouselImages) : String(body.carouselImages))
      : p.carousel_images;

    db.prepare(`
      UPDATE projects SET title = ?, ip_address = ?, store_count = ?, base_amount = ?, max_amount = ?, category_id = ?, category_tag = ?, cover_type = ?, carousel_images = ?, video_url = ?, video_poster = ?, detail_content = ?, introduction = ?, status = 'pending', updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(
      title,
      String(body.ipAddress || body.ip_address || p.ip_address || '').trim(),
      String(body.storeCount || body.store_count || p.store_count || '').trim(),
      String(body.baseAmount || body.base_amount || p.base_amount || '').trim(),
      String(body.maxAmount || body.max_amount || p.max_amount || '').trim(),
      String(body.categoryId || body.category_id || p.category_id || '').trim(),
      String(body.categoryTag || body.category_tag || p.category_tag || '').trim(),
      body.coverType || p.cover_type,
      carouselImages,
      String(body.videoUrl || body.video_url || p.video_url || '').trim(),
      String(body.videoPoster || body.video_poster || p.video_poster || '').trim(),
      String(body.detailContent || body.detail_content || p.detail_content || '').trim(),
      String(body.introduction || p.introduction || '').trim(),
      id
    );
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.json({ code: 0, data: projectToDetailRow(row), message: '已提交修改，等待审核' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '更新失败' });
  }
});

/** 审核（需管理员，见 admin 路由） */
/** 删除（仅管理员，见 admin 路由） */

module.exports = router;
