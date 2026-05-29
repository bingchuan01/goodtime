/**
 * 微信支付 APIv3（小程序 JSAPI）
 *
 * 环境变量（全部配置齐全才会启用下单）：
 * - WX_PAY_MCH_ID          商户号
 * - WX_PAY_APPID           小程序 AppID（与登录用 WX_APPID 一致即可）
 * - WX_PAY_API_V3_KEY      APIv3 密钥（32 字节）
 * - WX_PAY_CERT_SERIAL_NO  商户 API 证书序列号
 * - WX_PAY_PRIVATE_KEY     商户私钥 PEM 全文（换行可用 \n），或与二选一：
 * - WX_PAY_PRIVATE_KEY_PATH 商户 apiclient_key.pem 路径
 * - WX_PAY_NOTIFY_URL      支付结果通知完整 HTTPS URL，如 https://api.xxx.com/api/pay/wechat/notify
 */

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');

const HOST = 'api.mch.weixin.qq.com';

let privateKeyCache = null;
let platformCertsCache = { serialToPem: new Map(), fetchedAt: 0 };

function getConfig() {
  const mchid = process.env.WX_PAY_MCH_ID || '';
  const appid = process.env.WX_PAY_APPID || process.env.WX_APPID || '';
  const apiV3Key = process.env.WX_PAY_API_V3_KEY || '';
  const serialNo = process.env.WX_PAY_CERT_SERIAL_NO || '';
  const notifyUrl = process.env.WX_PAY_NOTIFY_URL || '';
  if (!mchid || !appid || !apiV3Key || !serialNo || !notifyUrl) return null;
  if (!loadPrivateKeyPem()) return null;
  return { mchid, appid, apiV3Key, serialNo, notifyUrl };
}

function isWxPayEnabled() {
  return !!getConfig();
}

function loadPrivateKeyPem() {
  if (privateKeyCache) return privateKeyCache;
  const inline = process.env.WX_PAY_PRIVATE_KEY;
  if (inline) {
    privateKeyCache = inline.replace(/\\n/g, '\n');
    return privateKeyCache;
  }
  const p = process.env.WX_PAY_PRIVATE_KEY_PATH;
  if (p && fs.existsSync(p)) {
    privateKeyCache = fs.readFileSync(p, 'utf8');
    return privateKeyCache;
  }
  return null;
}

function randomNonce(len = 32) {
  return crypto.randomBytes(len / 2).toString('hex');
}

function buildAuthSignMessage(method, urlPath, timestamp, nonce, body) {
  const b = body || '';
  return `${method.toUpperCase()}\n${urlPath}\n${timestamp}\n${nonce}\n${b}\n`;
}

function signWithMerchantKey(message) {
  const pem = loadPrivateKeyPem();
  if (!pem) throw new Error('缺少商户私钥');
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(message);
  sign.end();
  return sign.sign(pem, 'base64');
}

function authHeader(method, urlPath, bodyStr) {
  const cfg = getConfig();
  if (!cfg) throw new Error('微信支付未配置');
  const ts = String(Math.floor(Date.now() / 1000));
  const nonce = randomNonce();
  const msg = buildAuthSignMessage(method, urlPath, ts, nonce, bodyStr);
  const signature = signWithMerchantKey(msg);
  const token = [
    `mchid="${cfg.mchid}"`,
    `nonce_str="${nonce}"`,
    `timestamp="${ts}"`,
    `serial_no="${cfg.serialNo}"`,
    `signature="${signature}"`
  ].join(',');
  return `WECHATPAY2-SHA256-RSA2048 ${token}`;
}

function httpsJson(method, urlPath, bodyObj) {
  const bodyStr = bodyObj != null ? JSON.stringify(bodyObj) : '';
  const cfg = getConfig();
  const auth = authHeader(method, urlPath, bodyStr);
  const options = {
    hostname: HOST,
    port: 443,
    path: urlPath,
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: auth,
      'User-Agent': 'goodtime-api'
    }
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (resp) => {
      let raw = '';
      resp.on('data', (c) => { raw += c; });
      resp.on('end', () => {
        let json = null;
        try {
          json = raw ? JSON.parse(raw) : null;
        } catch (e) {
          json = { parseError: raw };
        }
        resolve({ status: resp.statusCode, body: json, raw });
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function aesGcmDecrypt(apiV3Key, associatedData, nonceStr, ciphertextB64) {
  const key = Buffer.from(apiV3Key, 'utf8');
  if (key.length !== 32) throw new Error('APIv3 密钥须为 32 字节');
  const buf = Buffer.from(ciphertextB64, 'base64');
  const authTag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);
  const nonce = Buffer.from(nonceStr, 'utf8');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(associatedData, 'utf8'));
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}

function decryptCertsFromResponse(respBody, apiV3Key) {
  const map = new Map();
  const list = (respBody && respBody.data) || [];
  for (const item of list) {
    const enc = item.encrypt_certificate;
    if (!enc) continue;
    const pem = aesGcmDecrypt(
      apiV3Key,
      enc.associated_data,
      enc.nonce,
      enc.ciphertext
    );
    map.set(item.serial_no, pem);
  }
  return map;
}

async function refreshPlatformCerts() {
  const cfg = getConfig();
  if (!cfg) throw new Error('微信支付未配置');
  const path = '/v3/certificates';
  const { status, body } = await httpsJson('GET', path, null);
  if (status !== 200 || !body || !body.data) {
    const msg = (body && (body.message || body.code)) || `HTTP ${status}`;
    throw new Error(`拉取平台证书失败: ${msg}`);
  }
  platformCertsCache.serialToPem = decryptCertsFromResponse(body, cfg.apiV3Key);
  platformCertsCache.fetchedAt = Date.now();
}

async function getPlatformPemForSerial(serial) {
  if (!serial) return null;
  let pem = platformCertsCache.serialToPem.get(serial);
  if (pem) return pem;
  await refreshPlatformCerts();
  return platformCertsCache.serialToPem.get(serial) || null;
}

/**
 * 小程序调起支付参数（signType RSA）
 */
function buildMiniProgramPayParams(prepayId, appId) {
  const pem = loadPrivateKeyPem();
  if (!pem) throw new Error('缺少商户私钥');
  const timeStamp = String(Math.floor(Date.now() / 1000));
  const nonceStr = randomNonce();
  const pkg = `prepay_id=${prepayId}`;
  const signStr = `${appId}\n${timeStamp}\n${nonceStr}\n${pkg}\n`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signStr);
  sign.end();
  const paySign = sign.sign(pem, 'base64');
  return {
    timeStamp,
    nonceStr,
    package: pkg,
    signType: 'RSA',
    paySign
  };
}

/**
 * JSAPI 下单并返回前端 wx.requestPayment 所需字段（含 appId 方便核对；小程序主要用后面五项）
 */
async function jsapiPrepay({ description, outTradeNo, amountFen, openid }) {
  const cfg = getConfig();
  if (!cfg) throw new Error('微信支付未配置');
  const path = '/v3/pay/transactions/jsapi';
  const payload = {
    appid: cfg.appid,
    mchid: cfg.mchid,
    description: description || '会员服务',
    out_trade_no: outTradeNo,
    notify_url: cfg.notifyUrl,
    amount: { total: amountFen, currency: 'CNY' },
    payer: { openid }
  };
  const { status, body } = await httpsJson('POST', path, payload);
  if (status !== 200 || !body || !body.prepay_id) {
    const msg = (body && (body.message || body.detail)) || JSON.stringify(body);
    const err = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    err.wxStatus = status;
    err.wxBody = body;
    throw err;
  }
  const payment = buildMiniProgramPayParams(body.prepay_id, cfg.appid);
  return { appId: cfg.appid, ...payment };
}

async function verifyNotifySignature(headers, rawBodyUtf8) {
  const ts = headers['wechatpay-timestamp'];
  const nonce = headers['wechatpay-nonce'];
  const sigB64 = headers['wechatpay-signature'];
  const serial = headers['wechatpay-serial'];
  if (!ts || !nonce || !sigB64 || !serial) return false;
  const msg = `${ts}\n${nonce}\n${rawBodyUtf8}\n`;
  const pem = await getPlatformPemForSerial(serial);
  if (!pem) return false;
  const verify = crypto.createVerify('RSA-SHA256');
  verify.update(msg);
  verify.end();
  return verify.verify(pem, sigB64, 'base64');
}

function decryptNotifyResource(resource, apiV3Key) {
  if (!resource || resource.algorithm !== 'AEAD_AES_256_GCM') {
    throw new Error('不支持的 resource 加密算法');
  }
  const json = aesGcmDecrypt(
    apiV3Key,
    resource.associated_data,
    resource.nonce,
    resource.ciphertext
  );
  return JSON.parse(json);
}

module.exports = {
  isWxPayEnabled,
  getConfig,
  jsapiPrepay,
  verifyNotifySignature,
  decryptNotifyResource,
  refreshPlatformCerts
};
