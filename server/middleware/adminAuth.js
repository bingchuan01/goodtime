const crypto = require('crypto');
const { db } = require('../db');

/**
 * 管理员鉴权：Authorization: Bearer <adminToken>
 * adminToken 为登录后返回的 token（当前为 username:sign 的 base64）
 */
function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ code: 401, message: '请先登录管理后台' });
  }
  const token = authHeader.slice(7).trim();
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [username, sign] = decoded.split(':');
    if (!username || !sign) {
      return res.status(401).json({ code: 401, message: '无效凭证' });
    }
    const admin = db.prepare('SELECT id, username, password_hash, role FROM admin_users WHERE username = ?').get(username);
    if (!admin) {
      return res.status(401).json({ code: 401, message: '无效凭证' });
    }
    const expected = crypto.createHmac('sha256', admin.password_hash).update(username).digest('hex').slice(0, 16);
    if (sign !== expected) {
      return res.status(401).json({ code: 401, message: '无效凭证' });
    }
    req.admin = { id: admin.id, username: admin.username, role: admin.role };
    next();
  } catch (e) {
    return res.status(401).json({ code: 401, message: '无效凭证' });
  }
}

module.exports = { adminAuth };
