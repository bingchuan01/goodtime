const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const router = express.Router();
const { db } = require('../db');
const { auth, optionalAuth } = require('../middleware/auth');
const { adminAuth } = require('../middleware/adminAuth');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const UPLOAD_BASE_URL = process.env.UPLOAD_BASE_URL || '';

try {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
} catch (e) {}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').toLowerCase() || '.pdf';
    const safeExt = /^\.(pdf|doc|docx|jpg|jpeg|png)$/i.test(ext) ? ext : '.pdf';
    cb(null, 'agreement_' + crypto.randomBytes(8).toString('hex') + safeExt);
  }
});
const uploadMw = multer({ storage });

/**
 * 管理员：上传协议模板
 * POST /api/settlement-agreement/template
 */
router.post('/template', adminAuth, uploadMw.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 400, message: '请选择文件' });
    }
    
    const { version = '', fileName = '' } = req.body || {};
  const host = req.get('host') || 'localhost:3000';
  const isProdHost = host.indexOf('api.goodtime.work') === 0;
  const scheme = isProdHost ? 'https://' : (req.protocol + '://');
  const base = UPLOAD_BASE_URL || (scheme + host);
  const fileUrl = base + '/uploads/' + req.file.filename;
    
    // 将之前的协议设为非激活状态
    db.prepare('UPDATE settlement_agreements SET is_active = 0, updated_at = datetime(\'now\', \'localtime\') WHERE is_active = 1').run();
    
    // 插入新协议
    const result = db.prepare(`
      INSERT INTO settlement_agreements (file_url, file_name, version, is_active, uploaded_by, created_at, updated_at)
      VALUES (?, ?, ?, 1, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `).run(
      fileUrl,
      fileName || req.file.originalname || req.file.filename,
      String(version).trim(),
      (req.admin && req.admin.username) || 'admin'
    );
    
    const id = result.lastInsertRowid;
    const row = db.prepare('SELECT * FROM settlement_agreements WHERE id = ?').get(id);
    
    res.status(201).json({
      code: 0,
      data: {
        id: row.id,
        fileUrl: row.file_url,
        fileName: row.file_name,
        version: row.version,
        isActive: !!row.is_active,
        uploadedBy: row.uploaded_by,
        createdAt: row.created_at
      },
      message: '协议模板上传成功'
    });
  } catch (e) {
    console.error('上传协议模板失败:', e);
    res.status(500).json({ code: 500, message: '上传失败：' + (e.message || '未知错误') });
  }
});

/**
 * 管理员：获取协议模板列表
 * GET /api/settlement-agreement/templates
 */
router.get('/templates', adminAuth, (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM settlement_agreements ORDER BY created_at DESC').all();
    res.json({
      code: 0,
      data: rows.map(r => ({
        id: r.id,
        fileUrl: r.file_url,
        fileName: r.file_name,
        version: r.version,
        isActive: !!r.is_active,
        uploadedBy: r.uploaded_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      })),
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取列表失败' });
  }
});

/**
 * 用户：获取当前激活的协议模板（用于下载）
 * GET /api/settlement-agreement/template/active
 * 公开接口，无需登录
 */
router.get('/template/active', optionalAuth, (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM settlement_agreements WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1').get();
    if (!row) {
      return res.status(404).json({ code: 404, message: '暂无可用协议模板' });
    }
    res.json({
      code: 0,
      data: {
        id: row.id,
        fileUrl: row.file_url,
        fileName: row.file_name,
        version: row.version,
        createdAt: row.created_at
      },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取协议模板失败' });
  }
});

/**
 * 用户：上传已签字盖章的协议
 * POST /api/settlement-agreement/upload-signed
 */
router.post('/upload-signed', auth, uploadMw.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ code: 400, message: '请选择文件' });
    }
    
    const userId = req.userId;
    const { projectId, agreementTemplateId } = req.body || {};
    
  const host = req.get('host') || 'localhost:3000';
  const isProdHost = host.indexOf('api.goodtime.work') === 0;
  const scheme = isProdHost ? 'https://' : (req.protocol + '://');
  const base = UPLOAD_BASE_URL || (scheme + host);
  const signedFileUrl = base + '/uploads/' + req.file.filename;
    
    // 获取当前激活的协议模板ID（如果未提供）
    let templateId = agreementTemplateId ? parseInt(agreementTemplateId, 10) : null;
    if (!templateId) {
      const activeTemplate = db.prepare('SELECT id FROM settlement_agreements WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1').get();
      if (activeTemplate) {
        templateId = activeTemplate.id;
      }
    }
    
    const result = db.prepare(`
      INSERT INTO user_settlement_agreements 
      (user_id, project_id, agreement_template_id, signed_file_url, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', datetime('now', 'localtime'), datetime('now', 'localtime'))
    `).run(
      userId,
      projectId ? parseInt(projectId, 10) : null,
      templateId,
      signedFileUrl
    );
    
    const id = result.lastInsertRowid;
    const row = db.prepare('SELECT * FROM user_settlement_agreements WHERE id = ?').get(id);
    
    res.status(201).json({
      code: 0,
      data: {
        id: row.id,
        signedFileUrl: row.signed_file_url,
        status: row.status,
        createdAt: row.created_at
      },
      message: '协议上传成功，等待审核'
    });
  } catch (e) {
    console.error('上传已签字协议失败:', e);
    res.status(500).json({ code: 500, message: '上传失败：' + (e.message || '未知错误') });
  }
});

/**
 * 用户：获取自己上传的协议列表
 * GET /api/settlement-agreement/my-agreements
 */
router.get('/my-agreements', auth, (req, res) => {
  try {
    const userId = req.userId;
    const rows = db.prepare(`
      SELECT usa.*, sa.file_name as template_name, sa.version as template_version
      FROM user_settlement_agreements usa
      LEFT JOIN settlement_agreements sa ON sa.id = usa.agreement_template_id
      WHERE usa.user_id = ?
      ORDER BY usa.created_at DESC
    `).all(userId);
    
    res.json({
      code: 0,
      data: rows.map(r => ({
        id: r.id,
        projectId: r.project_id,
        templateId: r.agreement_template_id,
        templateName: r.template_name || '',
        templateVersion: r.template_version || '',
        signedFileUrl: r.signed_file_url,
        status: r.status,
        rejectReason: r.reject_reason || '',
        reviewedBy: r.reviewed_by || '',
        reviewedAt: r.reviewed_at || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      })),
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取列表失败' });
  }
});

/**
 * 管理员：获取所有用户上传的协议列表（待审核/已审核）
 * GET /api/settlement-agreement/admin/list
 */
router.get('/admin/list', adminAuth, (req, res) => {
  try {
    const { status = '' } = req.query || {};
    let sql = `
      SELECT usa.*, 
        u.nickname as user_nickname, u.avatar as user_avatar,
        sa.file_name as template_name, sa.version as template_version,
        p.title as project_title
      FROM user_settlement_agreements usa
      LEFT JOIN users u ON u.id = usa.user_id
      LEFT JOIN settlement_agreements sa ON sa.id = usa.agreement_template_id
      LEFT JOIN projects p ON p.id = usa.project_id
    `;
    const params = [];
    if (status) {
      sql += ' WHERE usa.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY usa.created_at DESC';
    
    const rows = db.prepare(sql).all(...params);
    
    res.json({
      code: 0,
      data: rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        userNickname: r.user_nickname || '未知',
        userAvatar: r.user_avatar || '',
        projectId: r.project_id,
        projectTitle: r.project_title || '',
        templateId: r.agreement_template_id,
        templateName: r.template_name || '',
        templateVersion: r.template_version || '',
        signedFileUrl: r.signed_file_url,
        status: r.status,
        rejectReason: r.reject_reason || '',
        reviewedBy: r.reviewed_by || '',
        reviewedAt: r.reviewed_at || null,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      })),
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取列表失败' });
  }
});

/**
 * 管理员：审核用户上传的协议
 * PUT /api/settlement-agreement/admin/:id/audit
 */
router.put('/admin/:id/audit', adminAuth, (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, rejectReason } = req.body || {};
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ code: 400, message: 'status 必须为 approved 或 rejected' });
    }
    
    const row = db.prepare('SELECT * FROM user_settlement_agreements WHERE id = ?').get(id);
    if (!row) {
      return res.status(404).json({ code: 404, message: '协议不存在' });
    }
    
    const reason = status === 'rejected' ? String(rejectReason || '').trim() : '';
    
    db.prepare(`
      UPDATE user_settlement_agreements 
      SET status = ?, reject_reason = ?, reviewed_by = ?, reviewed_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `).run(status, reason, (req.admin && req.admin.username) || 'admin', id);
    
    const updated = db.prepare('SELECT * FROM user_settlement_agreements WHERE id = ?').get(id);
    
    res.json({
      code: 0,
      data: {
        id: updated.id,
        status: updated.status,
        rejectReason: updated.reject_reason || '',
        reviewedBy: updated.reviewed_by || '',
        reviewedAt: updated.reviewed_at
      },
      message: status === 'approved' ? '审核通过' : '已驳回'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '审核失败' });
  }
});

module.exports = router;
