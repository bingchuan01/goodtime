const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const router = express.Router();
const { auth } = require('../middleware/auth');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
// 可通过环境变量 UPLOAD_BASE_URL 配置固定域名；未设置时按当前请求 host 生成 URL（本地开发可用）
const UPLOAD_BASE_URL = process.env.UPLOAD_BASE_URL || '';

// 阿里云 OSS 直传（未配置时 GET /oss-policy 返回 501，前端走原有 /upload）
const OSS_REGION = process.env.OSS_REGION || '';
const OSS_BUCKET = process.env.OSS_BUCKET || '';
const OSS_ACCESS_KEY_ID = process.env.OSS_ACCESS_KEY_ID || '';
const OSS_ACCESS_KEY_SECRET = process.env.OSS_ACCESS_KEY_SECRET || '';
const OSS_HOST = process.env.OSS_HOST || (OSS_BUCKET && OSS_REGION ? `https://${OSS_BUCKET}.oss-${OSS_REGION}.aliyuncs.com` : '');
const OSS_MAX_SIZE = Math.min(100 * 1024 * 1024, parseInt(process.env.OSS_MAX_SIZE, 10) || 10 * 1024 * 1024);

try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (e) {}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase() || '.bin';
    const safeExt = /^\.(jpg|jpeg|png|gif|webp|mp4|avi|svg)$/i.test(ext) ? ext : '.bin';
    cb(null, crypto.randomBytes(8).toString('hex') + safeExt);
  }
});
const uploadMw = multer({ storage });

/**
 * 获取 OSS 直传凭证（PostObject 用）。未配置 OSS 时返回 501，前端走 /upload。
 * GET /api/upload/oss-policy?ext=.jpg
 */
router.get('/oss-policy', auth, (req, res) => {
  if (!OSS_HOST || !OSS_ACCESS_KEY_ID || !OSS_ACCESS_KEY_SECRET) {
    return res.status(501).json({ code: 501, message: 'OSS 未配置' });
  }
  let ext = (req.query.ext || '.jpg').toString().toLowerCase().replace(/[^a-z0-9.]/g, '') || '.jpg';
  if (!ext.startsWith('.')) ext = '.' + ext;
  const key = 'uploads/' + crypto.randomBytes(8).toString('hex') + ext;
  const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const policyObj = {
    expiration,
    conditions: [
      ['content-length-range', 0, OSS_MAX_SIZE],
      ['starts-with', '$key', 'uploads/']
    ]
  };
  const policyBase64 = Buffer.from(JSON.stringify(policyObj), 'utf8').toString('base64');
  const signature = crypto.createHmac('sha1', OSS_ACCESS_KEY_SECRET).update(policyBase64, 'utf8').digest('base64');
  const url = OSS_HOST + '/' + key;
  res.json({
    code: 0,
    data: {
      host: OSS_HOST,
      key,
      policy: policyBase64,
      OSSAccessKeyId: OSS_ACCESS_KEY_ID,
      signature,
      url
    },
    message: 'ok'
  });
});

/**
 * 单文件上传（multipart/form-data, field name: file）
 * 小程序 wx.uploadFile 的 name 需为 'file'
 */
router.post('/', auth, uploadMw.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ code: 400, message: '请选择文件' });
  }
  const host = req.get('host') || 'localhost:3000';
  const isProdHost = host.indexOf('api.goodtime.work') === 0;
  const scheme = isProdHost ? 'https://' : (req.protocol + '://');
  const base = UPLOAD_BASE_URL || (scheme + host);
  const url = base + '/uploads/' + req.file.filename;
  res.json({ code: 0, data: { url }, message: 'ok' });
});

module.exports = router;
