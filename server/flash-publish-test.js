/**
 * 闪电发布端到端测试（账号 13638112727）
 * 1. 以 user_13638112727 上传一张轮播图
 * 2. 提交项目（闪电发布）
 * 3. 管理后台登录并拉取项目列表，校验新项目存在
 * 用法：先启动服务 npm start，再在另一终端运行 node flash-publish-test.js
 * 若提交报 500，请先重启服务端后再运行本测试。
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE = `http://127.0.0.1:${PORT}/api`;
const USER_ID = 'user_13638112727';
const TEST_TITLE = '【闪电发布测试】13638112727 账号发布';

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

function uploadFile() {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(testFilePath)) {
      reject(new Error('测试文件不存在: ' + testFilePath));
      return;
    }
    const fileContent = fs.readFileSync(testFilePath);
    const fileName = path.basename(testFilePath);
    const boundary = '----FormBoundary' + Math.random().toString(36).slice(2, 14);
    const crlf = '\r\n';
    const bodyStart = ''
      + '--' + boundary + crlf
      + 'Content-Disposition: form-data; name="file"; filename="' + fileName + '"' + crlf
      + 'Content-Type: text/plain' + crlf
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
            const url = (json.data && json.data.url) || '';
            resolve(url);
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
  console.log('=== 闪电发布测试（账号 13638112727）===\n');

  // 1. 上传轮播图
  console.log('1. 上传轮播图...');
  let carouselUrl;
  try {
    carouselUrl = await uploadFile();
    console.log('   轮播图 URL:', carouselUrl);
  } catch (e) {
    console.error('   失败:', e.message);
    process.exit(1);
  }

  // 2. 提交项目（闪电发布）
  console.log('\n2. 提交项目（闪电发布）...');
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
    detailContent: '<p>闪电发布测试详情</p>',
    memberLevel: 'V6',
  };
  const authHeaders = { 'X-User-Id': USER_ID, 'Authorization': 'Bearer ' + USER_ID };
  const createRes = await request('POST', '/projects', projectBody, authHeaders);
  if (createRes.statusCode !== 200 && createRes.statusCode !== 201) {
    console.error('   提交失败:', createRes.statusCode, createRes.data);
    process.exit(1);
  }
  if (createRes.data.code !== 0 && !createRes.data.success) {
    console.error('   提交失败:', createRes.data.message || createRes.data);
    process.exit(1);
  }
  const created = createRes.data.data || {};
  const projectId = created.id || '(无 id)';
  console.log('   项目已创建, id:', projectId, '标题:', created.title || TEST_TITLE);

  // 3. 管理后台登录
  console.log('\n3. 管理后台登录...');
  const loginRes = await request('POST', '/admin/login', { username: 'admin', password: 'admin123' });
  if (loginRes.data.code !== 0 || !loginRes.data.data || !loginRes.data.data.token) {
    console.error('   管理员登录失败:', loginRes.data.message || loginRes.data);
    process.exit(1);
  }
  const adminToken = loginRes.data.data.token;
  console.log('   已登录');

  // 4. 拉取项目管理列表并校验
  console.log('\n4. 拉取项目管理列表...');
  const listRes = await request('GET', '/admin/projects', null, {
    'Authorization': 'Bearer ' + adminToken,
    'Content-Type': undefined,
  });
  if (listRes.data.code !== 0 || !listRes.data.data || !listRes.data.data.list) {
    console.error('   获取列表失败:', listRes.data.message || listRes.data);
    process.exit(1);
  }
  const list = listRes.data.data.list;
  const found = list.find((p) => p.title === TEST_TITLE || String(p.id) === String(projectId));
  if (!found) {
    console.error('   项目管理中未找到刚发布的内容。当前列表条数:', list.length);
    if (list.length > 0) {
      console.log('   前几条:', list.slice(0, 3).map((p) => ({ id: p.id, title: p.title })));
    }
    process.exit(1);
  }
  console.log('   在项目管理中已找到发布内容: id=', found.id, ', title=', found.title, ', status=', found.status);

  console.log('\n=== 闪电发布测试通过，项目管理中可见发布内容 ===');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
