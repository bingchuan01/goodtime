/**
 * PM2 配置：在 server 目录执行
 *   pm2 start ecosystem.config.js
 *   pm2 save
 * 更新代码后：
 *   npm install && pm2 reload goodtime-api --update-env
 *
 * 生产环境密钥请在服务器上通过环境变量或本文件 apps[0].env 注入（勿提交真实密钥）。
 */
const path = require('path');

module.exports = {
  apps: [
    {
      name: 'goodtime-api',
      script: path.join(__dirname, 'index.js'),
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || '3000',
      },
    },
  ],
};
