/**
 * 上传接口本地测试脚本
 * 用法：先启动服务 npm start，再在另一个终端运行 node upload-test.js
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const BASE = `http://127.0.0.1:${PORT}`;
const UPLOAD_URL = `${BASE}/api/upload`;

// 测试用户（与鉴权中间件一致：X-User-Id 或 Bearer token）
const TEST_USER_ID = 'user_upload_test';

const testFilePath = path.join(__dirname, 'test-upload-file.txt');

function runUploadTest() {
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
    const url = new URL(UPLOAD_URL);
    const opts = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'X-User-Id': TEST_USER_ID,
        'Authorization': `Bearer ${TEST_USER_ID}`,
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
            resolve({ statusCode: res.statusCode, body: json });
          } else {
            reject(new Error(`上传失败: ${res.statusCode} ${data}`));
          }
        } catch (e) {
          reject(new Error(`响应非 JSON: ${res.statusCode} ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

runUploadTest()
  .then((result) => {
    console.log('上传测试通过');
    console.log('状态码:', result.statusCode);
    console.log('响应:', JSON.stringify(result.body, null, 2));
    if (result.body && result.body.data && result.body.data.url) {
      console.log('文件 URL:', result.body.data.url);
    }
  })
  .catch((err) => {
    console.error('上传测试失败:', err.message);
    process.exit(1);
  });
