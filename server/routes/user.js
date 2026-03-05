const express = require('express');
const router = express.Router();
const { db, ensureUser } = require('../db');
const { auth } = require('../middleware/auth');

/** 微信登录（code 换 token，开发期 token 即 userId） */
router.post('/login', (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) {
      return res.status(400).json({ code: 400, message: '缺少 code' });
    }
    // TODO: 生产环境调微信接口 wx.login code2Session 换 openid/session_key，再生成 JWT
    // 开发期：用 code 当作临时 userId 或生成一个固定测试 userId
    const userId = 'user_' + String(code).slice(0, 12) || 'user_1';
    ensureUser(userId);
    const user = db.prepare('SELECT id, nickname, avatar, member_level, member_expire_time FROM users WHERE id = ?').get(userId);
    const token = userId;
    res.json({
      code: 0,
      data: {
        token,
        userInfo: {
          id: user.id,
          nickname: user.nickname || '微信用户',
          avatarUrl: user.avatar || '',
          avatar_url: user.avatar || '',
          member_level: user.member_level || '',
          memberLevel: user.member_level || '',
          member_expire_time: user.member_expire_time || null
        }
      },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '登录失败' });
  }
});

/** 获取当前用户信息（需鉴权） */
router.get('/info', auth, (req, res) => {
  try {
    const userId = req.userId;
    const user = db.prepare('SELECT id, nickname, avatar, member_level, member_expire_time FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    res.json({
      code: 0,
      data: {
        id: user.id,
        nickname: user.nickname || '微信用户',
        avatarUrl: user.avatar || '',
        avatar_url: user.avatar || '',
        member_level: user.member_level || '',
        memberLevel: user.member_level || '',
        member_expire_time: user.member_expire_time || null
      },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取用户信息失败' });
  }
});

/** 更新用户信息 */
router.put('/info', auth, (req, res) => {
  try {
    const userId = req.userId;
    const { nickname, avatarUrl, avatar_url } = req.body || {};
    const avatar = avatarUrl || avatar_url || '';
    const nick = (nickname != null && nickname !== '') ? String(nickname).trim() : null;
    if (nick !== null) {
      db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(nick, userId);
    }
    if (avatar !== '') {
      db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, userId);
    }
    const user = db.prepare('SELECT id, nickname, avatar, member_level, member_expire_time FROM users WHERE id = ?').get(userId);
    res.json({
      code: 0,
      data: {
        id: user.id,
        nickname: user.nickname || '微信用户',
        avatarUrl: user.avatar || '',
        avatar_url: user.avatar || '',
        member_level: user.member_level || '',
        memberLevel: user.member_level || '',
        member_expire_time: user.member_expire_time || null
      },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '更新失败' });
  }
});

/** 当前用户的项目列表（我的发布，含状态）
 *  query: page, pageSize, status = '' | 'approved' | 'rejected' | 'pending'
 */
router.get('/videos', auth, (req, res) => {
  try {
    const userId = req.userId;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const status = (req.query.status || '').trim().toLowerCase();
    const offset = (page - 1) * pageSize;

    let sql = 'SELECT * FROM projects WHERE user_id = ?';
    const params = [userId];
    if (status && ['approved', 'rejected', 'pending'].includes(status)) {
      sql += " AND LOWER(TRIM(status)) = LOWER(TRIM(?))";
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
      return {
        id: String(p.id),
        title: p.title,
        coverUrl: carouselImages[0] || p.video_poster || '',
        videoUrl: p.video_url || '',
        status: p.status,
        rejectReason: p.reject_reason || '',
        displayZone: p.display_zone || '',
        createdAt: p.created_at,
        updatedAt: p.updated_at
      };
    });

    res.json({ code: 0, data: { list, hasMore }, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取列表失败' });
  }
});

module.exports = router;
