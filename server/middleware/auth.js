/**
 * 鉴权中间件（开发用）
 * - 优先从 Header X-User-Id 取当前用户（便于联调）
 * - 否则从 Authorization Bearer 取，将 token 当作 userId 使用（与小程序存 token 一致时需传 userId 形态）
 * 生产环境应改为校验 JWT 等真实鉴权
 */
function auth(req, res, next) {
  const xUserId = req.headers['x-user-id'];
  if (xUserId) {
    req.userId = String(xUserId).trim();
    return next();
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    req.userId = token || null;
  } else {
    req.userId = null;
  }
  if (!req.userId) {
    return res.status(401).json({ code: 401, message: '未登录' });
  }
  next();
}

/** 可选鉴权：有 token 则设置 req.userId，无则不 401 */
function optionalAuth(req, res, next) {
  const xUserId = req.headers['x-user-id'];
  if (xUserId) {
    req.userId = String(xUserId).trim();
    return next();
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    req.userId = token || null;
  } else {
    req.userId = null;
  }
  next();
}

module.exports = { auth, optionalAuth };
