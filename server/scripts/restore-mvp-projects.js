/**
 * 恢复 MVP 打底项目（通过 db.js 写入，避免与运行中服务冲突）
 * 用法：先停 node，再 node scripts/restore-mvp-projects.js
 */
const path = require('path');
const { init, db } = require('../db');

const UPLOAD_BASE = process.env.UPLOAD_BASE_URL || 'https://api.goodtime.work';

const IMAGE_FALLBACKS = [
  `${UPLOAD_BASE}/uploads/e64dbf28f2b65e1e.jpg`,
  `${UPLOAD_BASE}/uploads/33d078510991f6c0.jpg`,
  `${UPLOAD_BASE}/uploads/a3867b77e898cc29.png`,
  `${UPLOAD_BASE}/uploads/a29b57fc2327f09c.jpg`,
  `${UPLOAD_BASE}/uploads/a4e195959987d9cc.jpg`,
  `${UPLOAD_BASE}/uploads/fb0cc9089e1c55e4.jpg`,
  `${UPLOAD_BASE}/uploads/fc523dab5c1acd1d.png`,
  `${UPLOAD_BASE}/uploads/91a40650d2cc1f06.png`
];

const ZONES = ['hot', 'trend', 'new', 'hot', 'trend', 'new', 'hot', 'trend'];

function nowLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function main() {
  await init();
  const rows = db.prepare('SELECT id, title, status, carousel_images, display_zone, published_at, expire_at FROM projects ORDER BY id').all();
  if (!rows.length) {
    console.log('无项目');
    process.exit(0);
  }

  const ts = nowLocal();
  rows.forEach((p, i) => {
    const cover = IMAGE_FALLBACKS[i % IMAGE_FALLBACKS.length];
    const carousel = JSON.stringify([cover]);
    const zone = ZONES[i % ZONES.length];
    const publishedAt = p.published_at || ts;
    const expireAt = p.expire_at || '2027-12-31 23:59:59';

    db.prepare(`
      UPDATE projects SET
        status = 'approved',
        reject_reason = '',
        carousel_images = ?,
        display_zone = ?,
        published_at = ?,
        expire_at = ?,
        updated_at = ?
      WHERE id = ?
    `).run(carousel, zone, publishedAt, expireAt, ts, p.id);

    console.log(`#${p.id} ${p.status} -> approved | zone=${zone} | ${cover}`);
  });

  console.log(`\n已恢复 ${rows.length} 个项目。请启动服务后下拉刷新首页。`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
