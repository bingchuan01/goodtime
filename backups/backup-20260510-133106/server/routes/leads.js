const express = require('express');
const router = express.Router();
const { db } = require('../db');

/** 提交线索（免费获取品牌资料） */
router.post('/', (req, res) => {
  try {
    const { projectId, name, phone, address } = req.body || {};
    const pid = parseInt(projectId, 10);
    if (!pid) return res.status(400).json({ code: 400, message: '请指定项目' });
    const n = String(name || '').trim();
    const p = String(phone || '').trim();
    if (!n || !p) return res.status(400).json({ code: 400, message: '请填写姓名和手机' });

    db.prepare('INSERT INTO leads (project_id, name, phone, address) VALUES (?, ?, ?, ?)').run(
      pid,
      n,
      p,
      String(address || '').trim()
    );
    res.status(201).json({ code: 0, data: null, message: '提交成功' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '提交失败' });
  }
});

module.exports = router;
