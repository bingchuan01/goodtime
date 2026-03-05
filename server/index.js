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
app.use(express.json());

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
