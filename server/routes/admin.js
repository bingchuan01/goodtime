const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { db } = require('../db');
const { adminAuth } = require('../middleware/adminAuth');

/** 管理员登录 */
router.post('/login', (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ code: 400, message: '请输入用户名和密码' });
    }
    const admin = db.prepare('SELECT id, username, password_hash, role FROM admin_users WHERE username = ?').get(String(username).trim());
    if (!admin) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    if (hash !== admin.password_hash) {
      return res.status(401).json({ code: 401, message: '用户名或密码错误' });
    }
    const sign = crypto.createHmac('sha256', admin.password_hash).update(admin.username).digest('hex').slice(0, 16);
    const token = Buffer.from(admin.username + ':' + sign, 'utf8').toString('base64');
    res.json({
      code: 0,
      data: { token, username: admin.username, role: admin.role },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '登录失败' });
  }
});

function addOneYearDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(String(dateStr).replace('T', ' ').trim());
  if (isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** 项目列表（全部状态，分页） */
router.get('/projects', adminAuth, (req, res) => {
  try {
    // 根据发布时间自动分配到期时间：有发布时间但未设置到期时间的，用 JS 计算并写入 发布时间+1年
    try {
      const needExpire = db.prepare(
        "SELECT id, published_at FROM projects WHERE (published_at IS NOT NULL AND published_at != '') AND (expire_at IS NULL OR expire_at = '')"
      ).all();
      const updateStmt = db.prepare('UPDATE projects SET expire_at = ? WHERE id = ?');
      for (const row of needExpire) {
        const exp = addOneYearDate(row.published_at);
        if (exp) updateStmt.run(exp, row.id);
      }
    } catch (e) {}

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const status = (req.query.status || '').trim();
    const offset = (page - 1) * pageSize;

    let sql = 'SELECT * FROM projects WHERE 1=1';
    const params = [];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
    params.push(pageSize + 1, offset);

    const rows = db.prepare(sql).all(...params);
    const hasMore = rows.length > pageSize;
    const list = rows.slice(0, pageSize).map(p => {
      let carouselImages = [];
      try {
        carouselImages = JSON.parse(p.carousel_images || '[]');
      } catch (e) {}
      const publisher = db.prepare('SELECT id, nickname, avatar FROM users WHERE id = ?').get(p.user_id);
      const publishedAt = p.published_at || null;
      const rawExpire = (p.expire_at != null && String(p.expire_at).trim() !== '') ? String(p.expire_at).trim() : null;
      const expireAt = rawExpire || (publishedAt ? addOneYearDate(publishedAt) : null);
      const publishType = (p.member_level === 'V8') ? 'V8发布' : ((p.member_level === 'V6') ? '闪电发布' : (p.member_level || '-'));
      return {
        id: String(p.id),
        title: p.title,
        user_id: p.user_id,
        publisher: publisher ? publisher.nickname : '未知',
        publish_type: publishType,
        status: p.status,
        reject_reason: p.reject_reason,
        display_zone: p.display_zone,
        is_official: !!p.is_official,
        member_level: p.member_level,
        cover_type: p.cover_type,
        carousel_images: carouselImages,
        video_url: p.video_url,
        created_at: p.created_at,
        updated_at: p.updated_at,
        published_at: publishedAt,
        expire_at: expireAt
      };
    });

    res.json({ code: 0, data: { list, hasMore }, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取列表失败' });
  }
});

/** 项目详情（管理用） */
router.get('/projects/:id', adminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!p) return res.status(404).json({ code: 404, message: '项目不存在' });
    let carouselImages = [];
    try {
      carouselImages = JSON.parse(p.carousel_images || '[]');
    } catch (e) {}
    
    // 提取 detail_content 中的图片URL（用于管理员审核）
    const detailContent = p.detail_content || '';
    const imageUrls = [];
    // 匹配 HTML img 标签中的 src
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = imgRegex.exec(detailContent)) !== null) {
      if (match[1]) imageUrls.push(match[1]);
    }
    // 匹配 markdown 格式的图片 ![alt](url)
    const mdImgRegex = /!\[[^\]]*\]\(([^)]+)\)/gi;
    while ((match = mdImgRegex.exec(detailContent)) !== null) {
      if (match[1] && !imageUrls.includes(match[1])) imageUrls.push(match[1]);
    }
    
    const publisher = db.prepare('SELECT id, nickname, avatar, identity_tag FROM users WHERE id = ?').get(p.user_id);
    const rawExpire = (p.expire_at != null && String(p.expire_at).trim() !== '') ? String(p.expire_at).trim() : null;
    const expireAt = rawExpire || (p.published_at ? addOneYearDate(p.published_at) : null);
    
    // 查询关联的协议图片信息
    const agreementRow = db.prepare(`
      SELECT usa.id, usa.signed_file_url, usa.status, usa.reject_reason, usa.created_at,
             sa.file_name as template_name, sa.version as template_version
      FROM user_settlement_agreements usa
      LEFT JOIN settlement_agreements sa ON sa.id = usa.agreement_template_id
      WHERE usa.project_id = ?
      ORDER BY usa.created_at DESC
      LIMIT 1
    `).get(id);
    
    const agreementInfo = agreementRow ? {
      id: agreementRow.id,
      signedFileUrl: agreementRow.signed_file_url,
      status: agreementRow.status,
      rejectReason: agreementRow.reject_reason || '',
      createdAt: agreementRow.created_at,
      templateName: agreementRow.template_name || '',
      templateVersion: agreementRow.template_version || ''
    } : null;
    
    res.json({
      code: 0,
      data: {
        ...p,
        id: String(p.id),
        expire_at: expireAt,
        carousel_images: carouselImages,
        video_poster: p.video_poster || '',
        detail_content: p.detail_content || '',
        detail_content_images: imageUrls, // 详情内容中的所有图片URL
        agreement: agreementInfo, // 关联的协议图片信息
        publisher: publisher ? { id: publisher.id, nickname: publisher.nickname, avatar: publisher.avatar, identity_tag: publisher.identity_tag || '' } : { id: p.user_id, nickname: '未知', avatar: '', identity_tag: '' }
      },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取详情失败' });
  }
});

/** 用户列表（用于身份标签管理） */
router.get('/users', adminAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT id, nickname, avatar, member_level, identity_tag FROM users ORDER BY id').all();
    res.json({ code: 0, data: rows.map(u => ({
      id: u.id,
      nickname: u.nickname || '未知',
      avatar: u.avatar || '',
      member_level: u.member_level || '',
      identity_tag: u.identity_tag || ''
    })), message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取用户列表失败' });
  }
});

/** 设置用户身份标签 */
router.put('/users/:id/identity-tag', adminAuth, (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ code: 400, message: '无效用户 id' });
    const { identity_tag: identityTag } = req.body || {};
    const value = identityTag != null ? String(identityTag).trim() : '';
    db.prepare('UPDATE users SET identity_tag = ? WHERE id = ?').run(value, id);
    const user = db.prepare('SELECT id, nickname, member_level, identity_tag FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ code: 404, message: '用户不存在' });
    res.json({ code: 0, data: user, message: '身份标签已更新' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '操作失败' });
  }
});

/** 审核：通过 / 退回 */
router.put('/projects/:id/audit', adminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, rejectReason, displayZone } = req.body || {};
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ code: 400, message: 'status 为 approved 或 rejected' });
    }
    const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!p) return res.status(404).json({ code: 404, message: '项目不存在' });

    const zone = (displayZone || '').trim();
    const reason = status === 'rejected' ? String(rejectReason || '').trim() : '';

    // 项目到期时间统一为一年（自发布时间起）
    if (status === 'approved' && !p.published_at) {
      db.prepare(
        'UPDATE projects SET status = ?, reject_reason = ?, display_zone = ?, published_at = datetime(\'now\', \'localtime\'), expire_at = date(datetime(\'now\', \'localtime\'), \'+1 year\'), updated_at = datetime(\'now\', \'localtime\') WHERE id = ?'
      ).run(status, reason, zone, id);
    } else {
      db.prepare(
        'UPDATE projects SET status = ?, reject_reason = ?, display_zone = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?'
      ).run(status, reason, zone, id);
    }
    let row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (status === 'approved' && row && !row.expire_at && row.published_at) {
      db.prepare('UPDATE projects SET expire_at = date(?, \'+1 year\'), updated_at = datetime(\'now\', \'localtime\') WHERE id = ?').run(row.published_at, id);
      row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    }
    res.json({ code: 0, data: row, message: status === 'approved' ? '已通过' : '已退回' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '操作失败' });
  }
});

/** 金盾认证 / 展区 */
router.put('/projects/:id/official', adminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { isOfficial, displayZone } = req.body || {};
    const p = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!p) return res.status(404).json({ code: 404, message: '项目不存在' });

    const is_official = isOfficial === true || isOfficial === 1 ? 1 : (isOfficial === false || isOfficial === 0 ? 0 : p.is_official);
    const zone = displayZone !== undefined ? String(displayZone).trim() : p.display_zone;

    db.prepare('UPDATE projects SET is_official = ?, display_zone = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?').run(is_official, zone, id);
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.json({ code: 0, data: row, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '操作失败' });
  }
});

/** 设置项目发布时间 */
router.put('/projects/:id/publish-time', adminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { published_at: publishedAt } = req.body || {};
    const p = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!p) return res.status(404).json({ code: 404, message: '项目不存在' });
    const value = publishedAt != null ? String(publishedAt).trim() : null;
    db.prepare('UPDATE projects SET published_at = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?').run(value || null, id);
    const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    res.json({ code: 0, data: row, message: '发布时间已更新' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '操作失败' });
  }
});

/** 删除项目 */
router.delete('/projects/:id', adminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const p = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
    if (!p) return res.status(404).json({ code: 404, message: '项目不存在' });
    db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    res.json({ code: 0, data: null, message: '已删除' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '删除失败' });
  }
});

/** 分类列表（全部，管理用） */
router.get('/categories', adminAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM categories ORDER BY sort ASC, id ASC').all();
    res.json({ code: 0, data: rows, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取分类失败' });
  }
});

/** 分类新增/更新 */
router.post('/categories', adminAuth, (req, res) => {
  try {
    const { id, name, icon, sort } = req.body || {};
    const sid = String(id || '').trim();
    const sname = String(name || '').trim();
    if (!sid || !sname) return res.status(400).json({ code: 400, message: 'id 和 name 必填' });
    const ssort = parseInt(sort, 10) || 0;
    const sicon = String(icon || '').trim();
    db.prepare('INSERT OR REPLACE INTO categories (id, name, icon, sort, enabled) VALUES (?, ?, ?, ?, 1)').run(sid, sname, sicon, ssort);
    const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(sid);
    res.status(201).json({ code: 0, data: row, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '操作失败' });
  }
});

/** 分类删除/禁用 */
router.delete('/categories/:id', adminAuth, (req, res) => {
  try {
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ code: 400, message: '无效 id' });
    db.prepare('UPDATE categories SET enabled = 0 WHERE id = ?').run(id);
    res.json({ code: 0, data: null, message: '已禁用' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '操作失败' });
  }
});

/** 配置获取（按 key） */
router.get('/config/:key', adminAuth, (req, res) => {
  try {
    const key = String(req.params.key || '').trim();
    const row = db.prepare('SELECT value FROM config WHERE key = ?').get(key);
    let value = row ? row.value : null;
    if (value && (key === 'dashboard' || key === 'benefits_carousel')) {
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

/** 配置更新（body 可为字符串或 JSON 对象） */
router.put('/config/:key', adminAuth, (req, res) => {
  try {
    const key = String(req.params.key || '').trim();
    if (!key) return res.status(400).json({ code: 400, message: '无效 key' });
    let value = req.body;
    if (value === undefined || value === null) {
      value = '';
    } else if (typeof value === 'object' && !Buffer.isBuffer(value)) {
      value = JSON.stringify(value);
    } else {
      value = String(value);
    }
    db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run(key, value);
    res.json({ code: 0, data: null, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '更新配置失败' });
  }
});

/** 线索列表 */
router.get('/leads', adminAuth, (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;
    const rows = db.prepare('SELECT l.*, p.title as project_title FROM leads l LEFT JOIN projects p ON p.id = l.project_id ORDER BY l.created_at DESC LIMIT ? OFFSET ?').all(pageSize + 1, offset);
    const hasMore = rows.length > pageSize;
    res.json({ code: 0, data: { list: rows.slice(0, pageSize), hasMore }, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取列表失败' });
  }
});

/** 咨询合作站内信列表（发给官方的站内信） */
router.get('/messages', adminAuth, (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;
    const rows = db.prepare(
      `SELECT m.id, m.sender_id, m.receiver_id, m.subject, m.body, m.contact, m.created_at,
        u.nickname as sender_nickname
       FROM messages m
       LEFT JOIN users u ON u.id = m.sender_id
       WHERE m.receiver_id = 'official'
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(pageSize + 1, offset);
    const hasMore = rows.length > pageSize;
    const list = rows.slice(0, pageSize);
    res.json({ code: 0, data: { list, hasMore }, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取列表失败' });
  }
});

module.exports = router;
