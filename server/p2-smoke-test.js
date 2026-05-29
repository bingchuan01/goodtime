/**
 * P2 本地冒烟测试（需 ALLOW_X_USER_ID=1，服务运行在 3000）
 * 用法：node p2-smoke-test.js
 */
const http = require('http');
const { init, db } = require('./db');

const BASE = 'http://127.0.0.1:3000/api';

function req(method, path, userId, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const url = new URL(BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-User-Id': userId || ''
      }
    };
    if (data) options.headers['Content-Length'] = Buffer.byteLength(data);
    const r = http.request(options, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(raw); } catch (e) { json = { raw }; }
        resolve({ status: res.statusCode, json });
      });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function ok(label, cond, detail) {
  const pass = !!cond;
  console.log(`${pass ? '✓' : '✗'} ${label}${detail ? ' — ' + detail : ''}`);
  return pass;
}

async function main() {
  await init();

  // 健康检查
  const health = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:3000/api/health', (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: raw }));
    }).on('error', reject);
  });
  if (health.status !== 200) {
    console.error('服务未启动，请先: ALLOW_X_USER_ID=1 node index.js');
    process.exit(1);
  }

  const users = db.prepare('SELECT id, member_level, member_expire_time FROM users LIMIT 10').all();
  if (!users.length) {
    console.error('数据库无用户');
    process.exit(1);
  }

  let memberUser = users.find((u) => u.member_level && u.member_level !== 'trial' && u.member_expire_time);
  if (!memberUser) memberUser = users[0];
  const userA = memberUser.id;
  const userB = users.find((u) => u.id !== userA)?.id || userA;

  console.log('\n=== P2 冒烟测试 ===');
  console.log('会员用户 A:', userA, '| 点击用户 B:', userB);

  let passed = 0;
  let total = 0;
  const check = (label, cond, detail) => { total++; if (ok(label, cond, detail)) passed++; };

  // 1. 改稿池
  const pool = await req('GET', '/growth/content-edit/pool', userA);
  check('GET content-edit/pool', pool.status === 200 && pool.json.code === 0,
    JSON.stringify(pool.json.data && { quotaRemain: pool.json.data.quotaRemain, canApply: pool.json.data.canApply }));

  // 2. 分享上报 share
  const shareId = `smoke_${Date.now()}`;
  const share = await req('POST', '/growth/share/report', userA, { type: 'share', shareId });
  check('POST share/report share', share.status === 200 && share.json.code === 0,
    `exp=${share.json.data && share.json.data.grantedExp} pts=${share.json.data && share.json.data.grantedPoints}`);

  // 3. 点击上报（B 点击 A 的分享）
  const click = await req('POST', '/growth/share/report', userB, {
    type: 'click',
    refUserId: userA,
    shareId,
    dwellSeconds: 8
  });
  check('POST share/report click', click.status === 200 && click.json.code === 0,
    click.json.data && click.json.data.message);

  // 4. 重复 click 同好友本周应 capped
  const click2 = await req('POST', '/growth/share/report', userB, {
    type: 'click',
    refUserId: userA,
    shareId: shareId + '_2',
    dwellSeconds: 10
  });
  check('POST share/report click 重复 capped', click2.status === 200 && click2.json.data && click2.json.data.capped === true,
    click2.json.data && click2.json.data.message);

  // 5. 券包
  const coupons = await req('GET', '/points/coupons?status=unused', userA);
  const couponList = (coupons.json.data && coupons.json.data.list) || [];
  check('GET points/coupons', coupons.status === 200 && coupons.json.code === 0,
    `count=${couponList.length}`);

  // 6. 已发布项目展示期
  const project = db.prepare(
    `SELECT id, user_id FROM projects WHERE status = 'approved' AND user_id = ? LIMIT 1`
  ).get(userA) || db.prepare(`SELECT id, user_id FROM projects WHERE status = 'approved' LIMIT 1`).get();

  if (project) {
    const display = await req('GET', `/projects/${project.id}/display`, project.user_id);
    check('GET projects/:id/display', display.status === 200 && display.json.code === 0,
      `expireAt=${display.json.data && display.json.data.expireAt}`);

    // 延长券
    const extendCoupon = couponList.find((c) => c.type === 'extend_display');
    if (extendCoupon && project.user_id === userA) {
      const ext = db.prepare(
        `SELECT id FROM project_display_extensions WHERE project_id = ? AND source = 'coupon' LIMIT 1`
      ).get(project.id);
      if (!ext) {
        const useExt = await req('POST', `/points/coupons/${extendCoupon.id}/use`, userA, { projectId: project.id });
        check('POST coupons extend_display', useExt.status === 200 && useExt.json.code === 0,
          useExt.json.message || (useExt.json.data && useExt.json.data.expireAt));
      } else {
        check('POST coupons extend_display', true, '跳过：该项目已用过延长券');
      }
    } else {
      check('POST coupons extend_display', true, '跳过：无延长券或非本人项目');
    }

    // 置顶券
    const pinCoupon = couponList.find((c) => c.type === 'pin');
    if (pinCoupon && project.user_id === userA) {
      const usePin = await req('POST', `/points/coupons/${pinCoupon.id}/use`, userA, { projectId: project.id });
      check('POST coupons pin', usePin.status === 200 && usePin.json.code === 0,
        usePin.json.message || (usePin.json.data && usePin.json.data.pinnedUntil));
    } else {
      check('POST coupons pin', true, '跳过：无置顶券或非本人项目');
    }
  } else {
    check('GET projects/:id/display', true, '跳过：无已发布项目');
    check('POST coupons extend_display', true, '跳过');
    check('POST coupons pin', true, '跳过');
  }

  // 7. 改稿提交（仅当有额度且有 approved 项目）
  const poolData = pool.json.data || {};
  const editProject = db.prepare(
    `SELECT id FROM projects WHERE user_id = ? AND status = 'approved' LIMIT 1`
  ).get(userA);
  if (poolData.canApply && editProject) {
    const beforeUsed = poolData.quotaUsed || 0;
    const edit = await req('PUT', `/projects/${editProject.id}`, userA, {
      contentEdit: true,
      title: db.prepare('SELECT title FROM projects WHERE id = ?').get(editProject.id).title + ' ',
      introduction: 'smoke test edit'
    });
    const poolAfter = await req('GET', '/growth/content-edit/pool', userA);
    const usedAfter = poolAfter.json.data && poolAfter.json.data.quotaUsed;
    check('PUT projects contentEdit', edit.status === 200 && edit.json.code === 0,
      `status=${edit.json.data && edit.json.data.status} quotaUsed ${beforeUsed}->${usedAfter}`);
  } else {
    check('PUT projects contentEdit', true, `跳过：canApply=${poolData.canApply} project=${!!editProject}`);
  }

  // 8. 首页列表含置顶排序（能返回即可）
  const list = await req('GET', '/projects?page=1&pageSize=5', userA);
  check('GET projects list (pinned sort)', list.status === 200 && list.json.code === 0,
    `count=${(list.json.data && list.json.data.list && list.json.data.list.length) || 0}`);

  // 9. 注册拉新（模拟新 openid 用户 + refUserId）
  const newId = `smoke_reg_${Date.now()}`;
  db.prepare('INSERT INTO users (id, nickname, avatar, openid) VALUES (?, ?, ?, ?)').run(newId, '冒烟新用户', '', `openid_${newId}`);
  const { reportShareEvent } = require('./lib/growth/share-report');
  const regResult = reportShareEvent(userA, { type: 'register', targetUserId: newId, shareId: 'smoke_reg' });
  check('register 拉新奖励', regResult.grantedExp > 0 || regResult.message.includes('已计'),
    `exp=${regResult.grantedExp} msg=${regResult.message}`);

  console.log(`\n结果: ${passed}/${total} 通过\n`);
  process.exit(passed === total ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
