const jwt = require('jsonwebtoken');
const { reconcileExpiredMembership } = require('../lib/member-active');

const JWT_SECRET = process.env.JWT_SECRET || 'goodtime-dev-secret-change-me';
const ALLOW_X_USER_ID = process.env.ALLOW_X_USER_ID === '1';

function decodeUserIdFromHeader(req) {
  const xUserId = req.headers['x-user-id'];
  if (ALLOW_X_USER_ID && xUserId) {
    return String(xUserId).trim() || null;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload && payload.uid ? String(payload.uid) : null;
  } catch (e) {
    return null;
  }
}

function auth(req, res, next) {
  req.userId = decodeUserIdFromHeader(req);
  if (!req.userId) {
    return res.status(401).json({ code: 401, message: '未登录或登录已过期' });
  }
  try {
    reconcileExpiredMembership(req.userId);
  } catch (e) {
    console.error('[auth] reconcileExpiredMembership', e);
  }
  next();
}

/** 可选鉴权：有 token 则设置 req.userId，无则不 401 */
function optionalAuth(req, res, next) {
  req.userId = decodeUserIdFromHeader(req);
  next();
}

module.exports = { auth, optionalAuth };
