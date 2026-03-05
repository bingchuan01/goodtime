/**
 * 模拟手机操作发布一次项目
 * 流程与小程序「闪电发布」一致：登录用户 → 选轮播图上传 → 选详情图上传 → 填表单 → 点击提交审核
 * 用法：先启动服务 npm start，在另一终端执行 node simulate-mobile-publish.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE = `http://127.0.0.1:${PORT}/api`;
const USER_ID = 'user_13638112727';
const TEST_TITLE = '【模拟手机发布】' + new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });

const testFilePath = path.join(__dirname, 'test-upload-file.txt');

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
        ...headers,
      },
    };
    if (body != null && typeof body === 'object' && !Buffer.isBuffer(body)) {
      opts.headers['Content-Length'] = Buffer.byteLength(JSON.stringify(body));
    } else if (body == null) {
      delete opts.headers['Content-Type'];
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

function uploadFile(filePath, label) {
  return new Promise((resolve, reject) => {
    const p = filePath || testFilePath;
    if (!fs.existsSync(p)) {
      reject(new Error('文件不存在: ' + p));
      return;
    }
    const fileContent = fs.readFileSync(p);
    const fileName = path.basename(p);
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2, 14);
    const crlf = '\r\n';
    const bodyStart = ''
      + '--' + boundary + crlf
      + 'Content-Disposition: form-data; name="file"; filename="' + fileName + '"' + crlf
      + 'Content-Type: ' + (path.extname(p).toLowerCase() === '.txt' ? 'text/plain' : 'application/octet-stream') + crlf
      + crlf;
    const bodyEnd = crlf + '--' + boundary + '--' + crlf;
    const body = Buffer.concat([
      Buffer.from(bodyStart, 'utf8'),
      fileContent,
      Buffer.from(bodyEnd, 'utf8'),
    ]);
    const url = new URL(BASE + '/upload');
    const opts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'X-User-Id': USER_ID,
        'Authorization': 'Bearer ' + USER_ID,
      },
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode === 200 && (json.code === 0 || json.success)) {
            resolve((json.data && json.data.url) || '');
          } else {
            reject(new Error('上传失败: ' + (json.message || data)));
          }
        } catch (e) {
          reject(new Error('上传响应非 JSON: ' + data));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  console.log('========================================');
  console.log('  模拟手机操作发布一次项目');
  console.log('  用户: 13638112727 (V6 闪电发布)');
  console.log('========================================\n');

  // 模拟：用户已登录（小程序端 13638112727 登录后 userInfo.id = user_13638112727）
  console.log('[模拟] 用户已登录，进入闪电发布页');
  const authHeaders = { 'X-User-Id': USER_ID, 'Authorization': 'Bearer ' + USER_ID };

  // 模拟：选择轮播图并上传（最多 3 张，这里传 1 张）
  console.log('[模拟] 选择轮播图 → 上传...');
  let carouselUrl;
  try {
    carouselUrl = await uploadFile(testFilePath, '轮播图');
    console.log('       轮播图 URL:', carouselUrl);
  } catch (e) {
    console.error('       失败:', e.message);
    process.exit(1);
  }

  // 模拟：选择详情页图片并上传（最多 9 张，这里传 1 张）
  console.log('[模拟] 选择详情页图片 → 上传...');
  let detailUrl;
  try {
    detailUrl = await uploadFile(testFilePath, '详情图');
    console.log('       详情图 URL:', detailUrl);
  } catch (e) {
    console.error('       失败:', e.message);
    process.exit(1);
  }
  const detailContent = `<p><img src="${detailUrl}" style="max-width:100%;" /></p>`;

  // 模拟：填写标题、分类、门店数、IP、合作金额等
  console.log('[模拟] 填写表单：标题、分类、门店数、IP、合作金额...');

  // 模拟：点击「提交审核」（支付并提交）
  console.log('[模拟] 点击「提交审核」→ 支付并提交...');
  const projectBody = {
    title: TEST_TITLE,
    ipAddress: '重庆市',
    storeCount: '10',
    baseAmount: '5',
    maxAmount: '20',
    categoryId: 'food',
    categoryTag: '餐饮',
    coverType: 'carousel',
    carouselImages: [carouselUrl],
    videoUrl: '',
    videoPoster: '',
    detailContent,
    memberLevel: 'V6',
  };
  const createRes = await request('POST', '/projects', projectBody, authHeaders);
  if (createRes.statusCode !== 200 && createRes.statusCode !== 201) {
    console.error('       提交失败:', createRes.statusCode, createRes.data);
    process.exit(1);
  }
  if (createRes.data.code !== 0 && !createRes.data.success) {
    console.error('       提交失败:', createRes.data.message || createRes.data);
    process.exit(1);
  }
  const created = createRes.data.data || {};
  const projectId = created.id;
  console.log('       提交成功，等待审核');
  console.log('       项目 id:', projectId, '标题:', created.title || TEST_TITLE);

  // 校验：管理后台项目管理中可见
  console.log('\n[校验] 管理后台 → 项目管理...');
  const loginRes = await request('POST', '/admin/login', { username: 'admin', password: 'admin123' });
  if (loginRes.data.code !== 0 || !loginRes.data.data || !loginRes.data.data.token) {
    console.error('       管理员登录失败');
    process.exit(1);
  }
  const listRes = await request('GET', '/admin/projects', null, {
    'Authorization': 'Bearer ' + loginRes.data.data.token,
    'Content-Type': undefined,
  });
  if (listRes.data.code === 0 && listRes.data.data && listRes.data.data.list) {
    const found = listRes.data.data.list.find((p) => String(p.id) === String(projectId));
    if (found) {
      console.log('       已在该列表中看到本次发布: id=', found.id, ', status=', found.status);
    }
  }

  console.log('\n========================================');
  console.log('  模拟手机发布完成，项目已进入待审核');
  console.log('========================================');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
