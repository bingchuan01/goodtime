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
