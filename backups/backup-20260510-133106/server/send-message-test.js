/**
 * 站内信发送测试
 * 用另一个试机号（13800138000）给 13638112727 用户发送一封站内信
 * 用法：先启动服务 npm start，再在另一终端运行 node send-message-test.js
 */
const http = require('http');

const PORT = process.env.PORT || 3000;
const BASE = `http://127.0.0.1:${PORT}/api`;

// 发送方：另一个试机号（与 13638112727 不同）
const SENDER_ID = 'user_13800138000';
// 收件方：13638112727 对应用户 id
const RECIPIENT_ID = 'user_13638112727';

function request(method, pathname, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + pathname);
    const opts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': SENDER_ID,
        ...headers,
      },
    };
    if (body != null && typeof body === 'object' && !Buffer.isBuffer(body)) {
      opts.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ statusCode: res.statusCode, data: json });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (body != null && typeof body === 'object' && !Buffer.isBuffer(body)) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function main() {
  console.log('=== 站内信发送测试 ===\n');
  console.log('  发送方: 试机号 13800138000 (user_13800138000)');
  console.log('  收件方: 13638112727 (user_13638112727)\n');

  const body = {
    recipientId: RECIPIENT_ID,
    subject: '【测试】来自试机号 13800138000 的站内信',
    body: '这是一封测试站内信，由试机号 13800138000 发送给用户 13638112727。请在小程序「消息」列表查看。',
  };

  try {
    const res = await request('POST', '/messages', body);
    if (res.statusCode === 201 && (res.data.code === 0 || res.data.data)) {
      console.log('  结果: 发送成功');
      console.log('  消息 id:', res.data.data && res.data.data.id ? res.data.data.id : '-');
      console.log('\n  请使用 13638112727 账号登录小程序，在消息列表查看该站内信。');
    } else {
      console.log('  结果: 失败');
      console.log('  状态码:', res.statusCode);
      console.log('  响应:', JSON.stringify(res.data, null, 2));
    }
  } catch (e) {
    console.error('  请求异常:', e.message);
    console.log('\n  请确认服务已启动: 在 server 目录执行 npm start');
  }
}

main();
