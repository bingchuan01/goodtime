const express = require('express');
const router = express.Router();
const { db, ensureUser } = require('../db');

const PREVIEW_LEN = 40;

function toListRow(m, sender, ums) {
  const row = {
    id: String(m.id),
    sender: {
      id: m.sender_id,
      nickname: sender ? sender.nickname : '未知',
      avatar: sender ? sender.avatar || '' : ''
    },
    subject: m.subject,
    bodyPreview: m.body.length > PREVIEW_LEN ? m.body.slice(0, PREVIEW_LEN) + '…' : m.body,
    sentAt: m.created_at,
    isRead: ums ? !!ums.is_read : false
  };
  if (m.contact != null) row.contact = m.contact;
  return row;
}

function toDetailRow(m, sender, ums) {
  const row = {
    id: String(m.id),
    sender: {
      id: m.sender_id,
      nickname: sender ? sender.nickname : '未知',
      avatar: sender ? sender.avatar || '' : ''
    },
    subject: m.subject,
    body: m.body,
    sentAt: m.created_at,
    isRead: ums ? !!ums.is_read : false
  };
  if (m.contact != null) row.contact = m.contact;
  return row;
}

/** 发站内信 */
router.post('/', (req, res) => {
  try {
    const userId = req.userId;
    let { recipientId, recipientName, subject, body, contact } = req.body || {};
    subject = String(subject || '').trim();
    body = String(body || '').trim();
    contact = contact != null ? String(contact).trim() : '';
    if (!subject || !body) {
      return res.status(400).json({ code: 400, message: '缺少主题或正文' });
    }
    if (recipientId === 'official' && !contact) {
      return res.status(400).json({ code: 400, message: '咨询合作需填写联系方式' });
    }
    if (!recipientId && recipientName) {
      const u = db.prepare('SELECT id FROM users WHERE nickname = ?').get(String(recipientName).trim());
      if (u) recipientId = u.id;
    }
    if (!recipientId) {
      return res.status(400).json({ code: 400, message: '请指定收件人（recipientId 或 recipientName）' });
    }
    recipientId = String(recipientId).trim();
    if (recipientId === userId) {
      return res.status(400).json({ code: 400, message: '不能给自己发站内信' });
    }
    ensureUser(recipientId);
    const insert = db.prepare(
      'INSERT INTO messages (sender_id, receiver_id, subject, body, contact) VALUES (?, ?, ?, ?, ?)'
    );
    const run = insert.run(userId, recipientId, subject, body, contact || null);
    const id = run.lastInsertRowid;
    db.prepare(
      'INSERT INTO user_message_status (message_id, user_id) VALUES (?, ?)'
    ).run(id, String(recipientId).trim());
    const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    const sender = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const ums = db.prepare('SELECT * FROM user_message_status WHERE message_id = ? AND user_id = ?').get(id, recipientId);
    res.status(201).json({
      code: 0,
      data: toDetailRow(row, sender, ums),
      message: '发送成功'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '发送失败' });
  }
});

/** 站内信列表（收件箱，分页） */
router.get('/', (req, res) => {
  try {
    const userId = req.userId;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 10));
    const type = (req.query.type || 'inbox').toLowerCase();
    const offset = (page - 1) * pageSize;

    if (type !== 'inbox') {
      return res.json({ code: 0, data: { list: [], hasMore: false } });
    }

    const msgs = db.prepare(
      `SELECT m.* FROM messages m
       INNER JOIN user_message_status ums ON ums.message_id = m.id AND ums.user_id = ?
       WHERE m.receiver_id = ? AND ums.deleted = 0
       ORDER BY m.created_at DESC
       LIMIT ? OFFSET ?`
    ).all(userId, userId, pageSize + 1, offset);

    const hasMore = msgs.length > pageSize;
    const list = msgs.slice(0, pageSize).map((m) => {
      const sender = db.prepare('SELECT * FROM users WHERE id = ?').get(m.sender_id);
      const ums = db.prepare('SELECT * FROM user_message_status WHERE message_id = ? AND user_id = ?').get(m.id, userId);
      return toListRow(m, sender, ums);
    });

    res.json({ code: 0, data: { list, hasMore }, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取列表失败' });
  }
});

/** 站内信详情 */
router.get('/:id', (req, res) => {
  try {
    const userId = req.userId;
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ code: 400, message: '无效消息 id' });

    const m = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    if (!m) return res.status(404).json({ code: 404, message: '消息不存在' });
    if (m.receiver_id !== userId && m.sender_id !== userId) {
      return res.status(403).json({ code: 403, message: '无权限查看' });
    }

    const sender = db.prepare('SELECT * FROM users WHERE id = ?').get(m.sender_id);
    const ums = db.prepare('SELECT * FROM user_message_status WHERE message_id = ? AND user_id = ?').get(id, userId);
    res.json({ code: 0, data: toDetailRow(m, sender, ums), message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取详情失败' });
  }
});

/** 标记已读（仅收件人） */
router.post('/:id/read', (req, res) => {
  try {
    const userId = req.userId;
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ code: 400, message: '无效消息 id' });

    const m = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    if (!m) return res.status(404).json({ code: 404, message: '消息不存在' });
    if (m.receiver_id !== userId) {
      return res.json({ code: 0, data: null, message: 'ok' });
    }

    db.prepare(
      'UPDATE user_message_status SET is_read = 1, read_at = datetime(\'now\', \'localtime\') WHERE message_id = ? AND user_id = ?'
    ).run(id, userId);
    res.json({ code: 0, data: null, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '标记已读失败' });
  }
});

/** 删除（软删，当前用户维度） */
router.delete('/:id', (req, res) => {
  try {
    const userId = req.userId;
    const id = parseInt(req.params.id, 10);
    if (!id) return res.status(400).json({ code: 400, message: '无效消息 id' });

    const m = db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    if (!m) return res.status(404).json({ code: 404, message: '消息不存在' });
    if (m.receiver_id !== userId && m.sender_id !== userId) {
      return res.status(403).json({ code: 403, message: '无权限删除' });
    }

    const ums = db.prepare('SELECT * FROM user_message_status WHERE message_id = ? AND user_id = ?').get(id, userId);
    if (ums) {
      db.prepare('UPDATE user_message_status SET deleted = 1 WHERE message_id = ? AND user_id = ?').run(id, userId);
    } else {
      db.prepare('INSERT INTO user_message_status (message_id, user_id, deleted) VALUES (?, ?, 1)').run(id, userId);
    }
    res.json({ code: 0, data: null, message: '已删除' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '删除失败' });
  }
});

module.exports = router;
