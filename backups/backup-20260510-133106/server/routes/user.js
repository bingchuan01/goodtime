const express = require('express');
const crypto = require('crypto');
const https = require('https');
const jwt = require('jsonwebtoken');
const RPCClient = require('@alicloud/pop-core');
const router = express.Router();
const { db } = require('../db');
const { auth } = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'goodtime-dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const WX_APPID = process.env.WX_APPID || '';
const WX_SECRET = process.env.WX_SECRET || '';
const LOGIN_CODE_EXPIRES_MS = 5 * 60 * 1000;
const LOGIN_CODE_COOLDOWN_MS = 60 * 1000;
const loginCodeStore = new Map();
const SMS_REGION_ID = process.env.SMS_REGION_ID || 'cn-hangzhou';
const SMS_ACCESS_KEY_ID = process.env.SMS_ACCESS_KEY_ID || '';
const SMS_ACCESS_KEY_SECRET = process.env.SMS_ACCESS_KEY_SECRET || '';
const SMS_SIGN_NAME = process.env.SMS_SIGN_NAME || '';
const SMS_TEMPLATE_CODE = process.env.SMS_TEMPLATE_CODE || '';
const SMS_TEMPLATE_PARAM_KEY = process.env.SMS_TEMPLATE_PARAM_KEY || 'code';

function hasSmsConfig() {
  return !!(SMS_ACCESS_KEY_ID && SMS_ACCESS_KEY_SECRET && SMS_SIGN_NAME && SMS_TEMPLATE_CODE);
}

let smsClient = null;
function getSmsClient() {
  if (!smsClient) {
    smsClient = new RPCClient({
      accessKeyId: SMS_ACCESS_KEY_ID,
      accessKeySecret: SMS_ACCESS_KEY_SECRET,
      endpoint: `https://dysmsapi.aliyuncs.com`,
      apiVersion: '2017-05-25'
    });
  }
  return smsClient;
}

async function sendSmsCode(phone, code) {
  if (!hasSmsConfig()) {
    // 未配置短信平台时保留本地联调能力
    console.warn('[sms] 阿里云短信未配置，使用本地调试模式（不真实下发）');
    return { mocked: true };
  }
  const client = getSmsClient();
  const params = {
    RegionId: SMS_REGION_ID,
    PhoneNumbers: phone,
    SignName: SMS_SIGN_NAME,
    TemplateCode: SMS_TEMPLATE_CODE,
    TemplateParam: JSON.stringify({ [SMS_TEMPLATE_PARAM_KEY]: code })
  };
  const requestOption = { method: 'POST' };
  const result = await client.request('SendSms', params, requestOption);
  if (!result || String(result.Code || '') !== 'OK') {
    const msg = result && result.Message ? result.Message : '短信发送失败';
    const err = new Error(msg);
    err.result = result;
    throw err;
  }
  return result;
}

function normalizeUser(user) {
  return {
    id: user.id,
    nickname: user.nickname || '微信用户',
    avatarUrl: user.avatar || '',
    avatar_url: user.avatar || '',
    phone: user.phone || '',
    email: user.email || '',
    member_level: user.member_level || '',
    memberLevel: user.member_level || '',
    member_expire_time: user.member_expire_time || null
  };
}

function signUserToken(userId) {
  return jwt.sign({ uid: String(userId) }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function randomUserId(prefix) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

function validatePhone(phone) {
  return /^1[3-9]\d{9}$/.test(String(phone || '').trim());
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password || '')).digest('hex');
}

function getOrCreateUserByOpenid(openid) {
  const existed = db.prepare('SELECT id, nickname, avatar, phone, email, member_level, member_expire_time FROM users WHERE openid = ?').get(openid);
  if (existed) return existed;
  const id = randomUserId('wx');
  db.prepare('INSERT INTO users (id, nickname, avatar, openid) VALUES (?, ?, ?, ?)').run(id, '微信用户', '', openid);
  return db.prepare('SELECT id, nickname, avatar, phone, email, member_level, member_expire_time FROM users WHERE id = ?').get(id);
}

function getOrCreateUserByPhone(phone) {
  const existed = db.prepare('SELECT id, nickname, avatar, phone, email, member_level, member_expire_time FROM users WHERE phone = ?').get(phone);
  if (existed) return existed;
  const id = randomUserId('phone');
  db.prepare('INSERT INTO users (id, nickname, avatar, phone) VALUES (?, ?, ?, ?)').run(id, `用户${phone.slice(-4)}`, '', phone);
  return db.prepare('SELECT id, nickname, avatar, phone, email, member_level, member_expire_time FROM users WHERE id = ?').get(id);
}

function getOrCreateUserByEmail(email) {
  const existed = db.prepare('SELECT id, nickname, avatar, phone, email, member_level, member_expire_time FROM users WHERE email = ?').get(email);
  if (existed) return existed;
  const id = randomUserId('email');
  db.prepare('INSERT INTO users (id, nickname, avatar, email) VALUES (?, ?, ?, ?)').run(id, '邮箱用户', '', email);
  return db.prepare('SELECT id, nickname, avatar, phone, email, member_level, member_expire_time FROM users WHERE id = ?').get(id);
}

function exchangeCode2Session(code) {
  return new Promise((resolve, reject) => {
    if (!WX_APPID || !WX_SECRET) {
      reject(new Error('未配置 WX_APPID/WX_SECRET'));
      return;
    }
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(WX_APPID)}&secret=${encodeURIComponent(WX_SECRET)}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`;
    https.get(url, (resp) => {
      let body = '';
      resp.on('data', (chunk) => { body += chunk; });
      resp.on('end', () => {
        try {
          const data = JSON.parse(body || '{}');
          if (data.errcode) {
            reject(new Error(data.errmsg || `微信登录失败(${data.errcode})`));
            return;
          }
          resolve(data);
        } catch (e) {
          reject(new Error('微信登录响应解析失败'));
        }
      });
    }).on('error', (err) => reject(err));
  });
}

/** 微信登录（code 换 token） */
router.post('/login', (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code) {
      return res.status(400).json({ code: 400, message: '缺少 code' });
    }
    const codeStr = String(code).trim();
    const done = (user) => {
      const token = signUserToken(user.id);
      res.json({
        code: 0,
        data: {
          token,
          userInfo: normalizeUser(user)
        },
        message: 'ok'
      });
    };
    exchangeCode2Session(codeStr)
      .then((wxData) => {
        const user = getOrCreateUserByOpenid(wxData.openid);
        done(user);
      })
      .catch((err) => {
        if (WX_APPID && WX_SECRET) {
          res.status(401).json({ code: 401, message: err.message || '微信登录失败' });
          return;
        }
        const openid = `dev_openid_${codeStr.slice(0, 16)}`;
        const user = getOrCreateUserByOpenid(openid);
        done(user);
      });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '登录失败' });
  }
});

/** 发送短信验证码（优先阿里云短信，未配置时回退本地调试） */
router.post('/login/sms/send', (req, res) => {
  try {
    const phone = String((req.body || {}).phone || '').trim();
    if (!validatePhone(phone)) {
      return res.status(400).json({ code: 400, message: '手机号格式不正确' });
    }
    const now = Date.now();
    const old = loginCodeStore.get(phone);
    if (old && old.sentAt && now - old.sentAt < LOGIN_CODE_COOLDOWN_MS) {
      const remainSeconds = Math.ceil((LOGIN_CODE_COOLDOWN_MS - (now - old.sentAt)) / 1000);
      return res.status(429).json({ code: 429, message: `发送过于频繁，请${remainSeconds}s后重试` });
    }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    loginCodeStore.set(phone, {
      code,
      sentAt: now,
      expireAt: now + LOGIN_CODE_EXPIRES_MS
    });
    sendSmsCode(phone, code)
      .then(() => {
        const maskedPhone = `${phone.slice(0, 3)}****${phone.slice(-4)}`;
        console.log(`[login-code] phone=${maskedPhone} expireAt=${new Date(now + LOGIN_CODE_EXPIRES_MS).toISOString()}`);
        res.json({ code: 0, message: '验证码已发送', data: { ttl: LOGIN_CODE_EXPIRES_MS / 1000 } });
      })
      .catch((err) => {
        loginCodeStore.delete(phone);
        console.error('[sms] send fail:', err && err.message ? err.message : err);
        res.status(500).json({ code: 500, message: '验证码发送失败，请稍后重试' });
      });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '发送验证码失败' });
  }
});

/** 手机号验证码登录（不存在则自动注册） */
router.post('/login/sms', (req, res) => {
  try {
    const phone = String((req.body || {}).phone || '').trim();
    const code = String((req.body || {}).code || '').trim();
    if (!validatePhone(phone)) {
      return res.status(400).json({ code: 400, message: '手机号格式不正确' });
    }
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ code: 400, message: '验证码格式不正确' });
    }
    const record = loginCodeStore.get(phone);
    if (!record) {
      return res.status(400).json({ code: 400, message: '请先获取验证码' });
    }
    if (Date.now() > record.expireAt) {
      loginCodeStore.delete(phone);
      return res.status(400).json({ code: 400, message: '验证码已过期，请重新获取' });
    }
    if (record.code !== code) {
      return res.status(400).json({ code: 400, message: '验证码错误' });
    }
    loginCodeStore.delete(phone);
    const user = getOrCreateUserByPhone(phone);
    const token = signUserToken(user.id);
    res.json({
      code: 0,
      data: {
        token,
        userInfo: normalizeUser(user)
      },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '登录失败' });
  }
});

/** 账号密码登录（account 可为手机号或邮箱） */
router.post('/login/password', (req, res) => {
  try {
    const account = String((req.body || {}).account || '').trim();
    const password = String((req.body || {}).password || '');
    if (!account || !password) {
      return res.status(400).json({ code: 400, message: '账号或密码不能为空' });
    }
    if (password.length < 6) {
      return res.status(400).json({ code: 400, message: '密码至少6位' });
    }
    let user;
    if (validatePhone(account)) {
      user = db.prepare('SELECT id, nickname, avatar, phone, email, password_hash, member_level, member_expire_time FROM users WHERE phone = ?').get(account);
      if (!user) {
        return res.status(404).json({ code: 404, message: '账号不存在，请先用验证码登录注册' });
      }
    } else if (validateEmail(account)) {
      user = db.prepare('SELECT id, nickname, avatar, phone, email, password_hash, member_level, member_expire_time FROM users WHERE email = ?').get(account);
      if (!user) {
        user = getOrCreateUserByEmail(account);
      }
    } else {
      return res.status(400).json({ code: 400, message: '请输入正确的手机号或邮箱' });
    }

    const currentHash = hashPassword(password);
    if (!user.password_hash) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(currentHash, user.id);
    } else if (user.password_hash !== currentHash) {
      return res.status(401).json({ code: 401, message: '账号或密码错误' });
    }

    const freshUser = db.prepare('SELECT id, nickname, avatar, phone, email, member_level, member_expire_time FROM users WHERE id = ?').get(user.id);
    const token = signUserToken(freshUser.id);
    res.json({ code: 0, data: { token, userInfo: normalizeUser(freshUser) }, message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '登录失败' });
  }
});

/** 获取当前用户信息（需鉴权） */
router.get('/info', auth, (req, res) => {
  try {
    const userId = req.userId;
    const user = db.prepare('SELECT id, nickname, avatar, phone, email, member_level, member_expire_time FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ code: 404, message: '用户不存在' });
    }
    res.json({ code: 0, data: normalizeUser(user), message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取用户信息失败' });
  }
});

/** 更新用户信息 */
router.put('/info', auth, (req, res) => {
  try {
    const userId = req.userId;
    const { nickname, avatarUrl, avatar_url, email } = req.body || {};
    const avatar = avatarUrl || avatar_url || '';
    const nick = (nickname != null && nickname !== '') ? String(nickname).trim() : null;
    const emailValue = (email != null && email !== '') ? String(email).trim() : null;
    if (nick !== null) {
      db.prepare('UPDATE users SET nickname = ? WHERE id = ?').run(nick, userId);
    }
    if (avatar !== '') {
      db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar, userId);
    }
    if (emailValue !== null) {
      if (!validateEmail(emailValue)) {
        return res.status(400).json({ code: 400, message: '邮箱格式不正确' });
      }
      db.prepare('UPDATE users SET email = ? WHERE id = ?').run(emailValue, userId);
    }
    const user = db.prepare('SELECT id, nickname, avatar, phone, email, member_level, member_expire_time FROM users WHERE id = ?').get(userId);
    res.json({ code: 0, data: normalizeUser(user), message: 'ok' });
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
