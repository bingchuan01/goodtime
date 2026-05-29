/**
 * 在服务器上执行：node scripts/verify-modules.js
 * 若缺依赖（如 jsonwebtoken），此处会立即报错，便于在 pm2 reload 前排查。
 */
const list = [
  '../routes/messages',
  '../routes/projects',
  '../routes/categories',
  '../routes/config',
  '../routes/user',
  '../routes/member',
  '../routes/leads',
  '../routes/search',
  '../routes/upload',
  '../routes/admin',
  '../routes/settlement-agreement',
  '../routes/wxpay-notify',
];

for (const rel of list) {
  require(rel);
}
console.log('verify-modules: 所有路由模块 require 成功');
