const express = require('express');
const path = require('path');
const cors = require('cors');
const { init } = require('./db');
const { auth, optionalAuth } = require('./middleware/auth');
const messagesRouter = require('./routes/messages');
const projectsRouter = require('./routes/projects');
const categoriesRouter = require('./routes/categories');
const configRouter = require('./routes/config');
const userRouter = require('./routes/user');
const memberRouter = require('./routes/member');
const leadsRouter = require('./routes/leads');
const searchRouter = require('./routes/search');
const uploadRouter = require('./routes/upload');
const adminRouter = require('./routes/admin');
const settlementAgreementRouter = require('./routes/settlement-agreement');

const app = express();
app.use(cors());
// 微信支付通知验签依赖原始 body，须先于 express.json 注册
const handleWxPayNotify = require('./routes/wxpay-notify');
app.post('/api/pay/wechat/notify', express.raw({ type: 'application/json' }), handleWxPayNotify);
// strict: false 允许顶层 JSON 字符串，兼容后台 PUT 配置时 body 为 JSON.stringify(纯文本/HTML)
app.use(express.json({ strict: false }));

const UPLOAD_DIR = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.use('/api/user', userRouter);
app.use('/api/projects', optionalAuth, projectsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/config', configRouter);
app.use('/api/messages', auth, messagesRouter);
app.use('/api/member', auth, memberRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/search', searchRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/admin', adminRouter);
app.use('/api/settlement-agreement', settlementAgreementRouter);

const PORT = process.env.PORT || 3000;
init()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`好时机 API 已启动: http://localhost:${PORT}/api`);
      console.log(`上传文件目录: ${UPLOAD_DIR}`);
    });
  })
  .catch((err) => {
    console.error('数据库初始化失败:', err);
    process.exit(1);
  });
