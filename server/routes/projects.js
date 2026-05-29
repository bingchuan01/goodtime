const express = require('express');
const router = express.Router();
const { db, ensureUser } = require('../db');
const { getPublishBlockMessage } = require('../lib/member-active');
const { canContentEdit, consumeContentEdit } = require('../lib/growth/content-edit-pool');
const {
  applyExtendDisplayCoupon,
  applyPinCoupon,
  getProjectDisplayInfo
} = require('../lib/growth/coupon-use');
const { getProjectStats, recordShare, recountFavoriteUv } = require('../lib/project-stats');
const { pickCardAlgoTag, buildDetailAlgoTags } = require('../lib/algo-tag');
const { LIST_ORDER, normalizeCoverUrl, enrichListRow } = require('../lib/project-list');
const {
  ensureSurgePoolCurrent,
  getSurgePoolMap,
  getHomeFeaturedIds,
  getPoolProjectIds,
  currentPoolMonth,
  hasSurgeTag
} = require('../lib/surge-pool');
const { GROUPS, PRICE_RANGES } = require('../lib/category-nav-data');

function parseAmount(val) {
  const n = parseFloat(String(val || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function projectMatchesPrice(p, priceMin, priceMax) {
  const base = parseAmount(p.base_amount);
  const max = parseAmount(p.max_amount) ?? base;
  if (base == null && max == null) return false;
  const low = base != null ? base : max;
  const high = max != null ? max : base;
  const min = priceMin != null ? Number(priceMin) : null;
  const maxCap = priceMax != null ? Number(priceMax) : null;
  if (min != null && high < min) return false;
  if (maxCap != null && low > maxCap) return false;
  return true;
}

function normalizeDetailContent(html) {
  if (!html || typeof html !== 'string') return '';
  const prodBase = process.env.UPLOAD_BASE_URL || 'https://api.goodtime.work';
  let s = html
    .replace(/http:\/\/api\.goodtime\.work/g, 'https://api.goodtime.work')
    .replace(/http:\/\/localhost(:\d+)?/g, prodBase)
    .replace(/http:\/\/127\.0\.0\.1(:\d+)?/g, prodBase)
    .replace(/http:\/\/192\.168\.\d+\.\d+(:\d+)?/g, prodBase);
  s = s.replace(/<img(\s[^>]*?)style="([^"]*)"([^>]*)>/gi, (match, before, style, after) => {
    const center = 'display:block;margin-left:auto;margin-right:auto;';
    if (/display\s*:\s*block/i.test(style) && /margin-left\s*:\s*auto/i.test(style)) return match;
    const newStyle = style.trim() ? style + ';' + center : center;
    return `<img${before}style="${newStyle}"${after}>`;
  });
  s = s.replace(/<img(?=\s)(?![^>]*style=)/gi, (m) => m + ' style="max-width:100%;display:block;margin-left:auto;margin-right:auto;"');
  return s;
}

function projectToDetailRow(p, userId) {
  const publisher = db.prepare('SELECT id, nickname, avatar, member_level FROM users WHERE id = ?').get(p.user_id);
  let carouselImages = [];
  try {
    carouselImages = JSON.parse(p.carousel_images || '[]');
  } catch (e) {}
  const normalizedCarousel = Array.isArray(carouselImages)
    ? carouselImages.map((url) => normalizeCoverUrl(url)).filter(Boolean)
    : [];
  const isInSurgePool50 = !!db.prepare(
    'SELECT 1 FROM surge_pool WHERE pool_month = ? AND project_id = ?'
  ).get(currentPoolMonth(), p.id);
  const showSurgeTag = hasSurgeTag(p.id);
  const stats = getProjectStats(p.id);
  let isFavorited = false;
  if (userId) {
    isFavorited = !!db.prepare(
      'SELECT 1 FROM user_favorites WHERE user_id = ? AND project_id = ?'
    ).get(userId, p.id);
  }
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
    carouselImages: normalizedCarousel,
    videoUrl: normalizeCoverUrl(p.video_url || ''),
    videoPoster: normalizeCoverUrl(p.video_poster || ''),
    detailContent: normalizeDetailContent(p.detail_content || ''),
    introduction: p.introduction || '',
    memberLevel: p.member_level || 'V6',
    isOfficial: !!p.is_official,
    viewCount: stats.view,
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
    rejectReason: p.reject_reason || '',
    publishedAt: p.published_at || '',
    hasSurgeTag: showSurgeTag,
    isInSurgePool: isInSurgePool50,
    isFavorited,
    stats,
    algoTags: buildDetailAlgoTags(showSurgeTag, stats)
  };
}

function fetchProjectsByIds(ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM projects WHERE id IN (${placeholders}) AND status = 'approved'`).all(...ids);
  const map = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => map.get(id)).filter(Boolean);
}

/** 分类导航结构 */
router.get('/nav', (req, res) => {
  res.json({ code: 0, data: { groups: GROUPS, priceRanges: PRICE_RANGES }, message: 'ok' });
});

/** 当月飙升池（Top50） */
router.get('/surge-pool', (req, res) => {
  try {
    ensureSurgePoolCurrent();
    const month = currentPoolMonth();
    const ids = getPoolProjectIds(month);
    const surgeMap = getSurgePoolMap(month);
    const list = fetchProjectsByIds(ids).map((p) => enrichListRow(p, surgeMap));
    res.json({ code: 0, data: { list, month, total: list.length }, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取飙升池失败' });
  }
});

/** 项目列表 */
router.get('/', (req, res) => {
  try {
    ensureSurgePoolCurrent();
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const categoryId = (req.query.categoryId || req.query.category || '').trim();
    const categoryTag = (req.query.categoryTag || req.query.tag || '').trim();
    const displayZone = (req.query.displayZone || req.query.zone || '').trim();
    const region = (req.query.region || req.query.address || '').trim();
    const inSurgePool = req.query.inSurgePool === '1' || req.query.top50 === '1';
    const featuredSurge = req.query.featuredSurge === '1';
    const priceRangeId = (req.query.priceRange || '').trim();
    const offset = (page - 1) * pageSize;
    const month = currentPoolMonth();
    const surgeMap = getSurgePoolMap(month);

    if (featuredSurge) {
      const limit = Math.min(10, parseInt(req.query.limit, 10) || 10);
      const ids = getHomeFeaturedIds(month).slice(0, limit);
      const list = fetchProjectsByIds(ids).map((p) => enrichListRow(p, surgeMap));
      return res.json({ code: 0, data: { list, hasMore: false }, message: 'ok' });
    }

    let priceMin = req.query.priceMin != null ? parseFloat(req.query.priceMin) : null;
    let priceMax = req.query.priceMax != null ? parseFloat(req.query.priceMax) : null;
    if (priceRangeId) {
      const pr = PRICE_RANGES.find((r) => r.id === priceRangeId);
      if (pr) {
        priceMin = pr.min;
        priceMax = pr.max;
      }
    }

    let sql = 'SELECT p.* FROM projects p';
    const params = [];
    const where = ['p.status = ?'];
    params.push('approved');

    if (inSurgePool) {
      sql += ' INNER JOIN surge_pool sp ON sp.project_id = p.id AND sp.pool_month = ?';
      params.push(month);
    }

    if (categoryId) {
      where.push('(p.category_id = ? OR p.category_tag = ?)');
      params.push(categoryId, categoryId);
    }
    if (categoryTag) {
      where.push('p.category_tag = ?');
      params.push(categoryTag);
    }
    if (displayZone) {
      where.push('p.display_zone = ?');
      params.push(displayZone);
    }
    if (region) {
      where.push('p.ip_address LIKE ?');
      params.push(`%${region}%`);
    }

    sql += ` WHERE ${where.join(' AND ')} ORDER BY ${LIST_ORDER}`;

    let rows = db.prepare(sql).all(...params);

    if (priceMin != null || priceMax != null) {
      rows = rows.filter((p) => projectMatchesPrice(p, priceMin, priceMax));
    }

    const hasMore = rows.length > offset + pageSize;
    const slice = rows.slice(offset, offset + pageSize);
    const list = slice.map((p) => enrichListRow(p, surgeMap));

    res.json({ code: 0, data: { list, hasMore }, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取列表失败' });
  }
});

/** 记录分享 */
router.post('/:id/share', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ code: 400, message: '无效项目 id' });
    const p = db.prepare('SELECT id FROM projects WHERE id = ? AND status = ?').get(id, 'approved');
    if (!p) return res.status(404).json({ code: 404, message: '项目不存在' });
    recordShare(id);
    res.json({ code: 0, data: getProjectStats(id), message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '记录分享失败' });
  }
});

/** 收藏 toggle */
router.post('/:id/favorite', (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ code: 401, message: '未登录' });
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ code: 400, message: '无效项目 id' });
    const p = db.prepare('SELECT id FROM projects WHERE id = ? AND status = ?').get(id, 'approved');
    if (!p) return res.status(404).json({ code: 404, message: '项目不存在' });

    const existing = db.prepare(
      'SELECT id FROM user_favorites WHERE user_id = ? AND project_id = ?'
    ).get(userId, id);
    let favorited;
    if (existing) {
      db.prepare('DELETE FROM user_favorites WHERE user_id = ? AND project_id = ?').run(userId, id);
      favorited = false;
    } else {
      db.prepare('INSERT INTO user_favorites (user_id, project_id) VALUES (?, ?)').run(userId, id);
      favorited = true;
    }
    recountFavoriteUv(id);
    res.json({
      code: 0,
      data: { favorited, stats: getProjectStats(id) },
      message: favorited ? '已收藏' : '已取消收藏'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '操作失败' });
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
    res.json({ code: 0, data: projectToDetailRow(updated, req.userId || null), message: 'ok' });
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
    const publishBlock = getPublishBlockMessage(userId);
    if (publishBlock) {
      return res.status(403).json({ code: 403, message: publishBlock });
    }
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
    res.status(201).json({ code: 0, data: projectToDetailRow(row, userId), message: '提交成功，等待审核' });
  } catch (e) {
    console.error('POST /projects 错误:', e);
    const msg = (e && (e.message || (typeof e === 'string' ? e : (e.toString && e.toString())))) || '提交失败';
    res.status(500).json({ code: 500, message: String(msg) });
  }
});

/** 更新项目 */
router.put('/:id', (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ code: 401, message: '未登录' });
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ code: 400, message: '无效项目 id' });

    const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!p) return res.status(404).json({ code: 404, message: '项目不存在' });
    if (p.user_id !== userId) return res.status(403).json({ code: 403, message: '无权限修改' });

    const body = req.body || {};
    const isContentEdit = body.contentEdit === true || body.contentEdit === 1 || body.contentEdit === '1';

    if (p.status === 'approved') {
      if (!isContentEdit) {
        return res.status(400).json({ code: 400, message: '已发布项目请使用内容改稿' });
      }
      const check = canContentEdit(userId);
      if (!check.ok) {
        return res.status(403).json({ code: 403, message: check.message });
      }
    } else if (p.status !== 'rejected') {
      return res.status(400).json({ code: 400, message: '当前状态不可编辑' });
    }

    const publishBlock = getPublishBlockMessage(userId);
    if (publishBlock) {
      return res.status(403).json({ code: 403, message: publishBlock });
    }

    const title = String(body.title || p.title).trim();
    const carouselImages = body.carouselImages != null
      ? (Array.isArray(body.carouselImages) ? JSON.stringify(body.carouselImages) : String(body.carouselImages))
      : p.carousel_images;

    if (p.status === 'approved' && isContentEdit) {
      const consumed = consumeContentEdit(userId, id, 'membership_grant');
      if (!consumed.ok) {
        return res.status(403).json({ code: 403, message: consumed.message });
      }
    }

    db.prepare(`
      UPDATE projects SET title = ?, ip_address = ?, store_count = ?, base_amount = ?, max_amount = ?, category_id = ?, category_tag = ?, cover_type = ?, carousel_images = ?, video_url = ?, video_poster = ?, detail_content = ?, introduction = ?, status = 'pending', reject_reason = '', updated_at = datetime('now', 'localtime')
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
    res.json({
      code: 0,
      data: projectToDetailRow(row, userId),
      message: isContentEdit ? '改稿已提交，等待审核' : '已提交修改，等待审核'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '更新失败' });
  }
});

router.get('/:id/display', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const info = getProjectDisplayInfo(id, req.userId || null);
    if (!info) return res.status(404).json({ code: 404, message: '项目不存在' });
    res.json({ code: 0, data: info, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取展示期失败' });
  }
});

router.post('/:id/extend-display', (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ code: 401, message: '未登录' });
    const id = parseInt(req.params.id, 10);
    const couponId = parseInt(req.body && req.body.couponId, 10);
    if (!couponId) return res.status(400).json({ code: 400, message: '请选择延长券' });
    const result = applyExtendDisplayCoupon(userId, id, couponId);
    if (!result.ok) return res.status(422).json({ code: 422, message: result.message });
    res.json({ code: 0, data: result, message: '展示期已延长' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '操作失败' });
  }
});

router.post('/:id/pin', (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ code: 401, message: '未登录' });
    const id = parseInt(req.params.id, 10);
    const couponId = parseInt(req.body && req.body.couponId, 10);
    if (!couponId) return res.status(422).json({ code: 422, message: '请选择置顶卡' });
    const result = applyPinCoupon(userId, id, couponId);
    if (!result.ok) return res.status(422).json({ code: 422, message: result.message });
    res.json({ code: 0, data: result, message: '置顶已生效' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '操作失败' });
  }
});

module.exports = router;
