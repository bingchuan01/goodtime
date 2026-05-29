/**
 * 从线上 api.goodtime.work 同步 MVP「参考模板」到本地 goodtime.db
 * 用法（先停 node）：node scripts/sync-prod-mvp-to-local.js
 */
const https = require('https');
const { init, db, ensureUser } = require('../db');

const PROD = 'https://api.goodtime.work/api';

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let raw = '';
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(raw));
        } catch (e) {
          reject(new Error('JSON parse: ' + url));
        }
      });
    }).on('error', reject);
  });
}

function publishedAtForIndex(i, total) {
  const day = i < Math.ceil(total / 2) ? '2026-04-20' : '2026-04-21';
  const hour = 10 + (i % 10);
  const min = (i * 7) % 60;
  return `${day} ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00`;
}

async function fetchProdProjects() {
  const listRes = await getJson(`${PROD}/projects?page=1&pageSize=50&displayZone=hot`);
  const list = (listRes.data && listRes.data.list) || [];
  const details = [];
  for (const item of list) {
    const d = await getJson(`${PROD}/projects/${item.id}`);
    if (d.code === 0 && d.data) details.push(d.data);
  }
  return details;
}

async function main() {
  console.log('正在从线上拉取项目…');
  const projects = await fetchProdProjects();
  if (!projects.length) {
    console.error('线上未返回项目');
    process.exit(1);
  }
  console.log(`线上 approved 热门区: ${projects.length} 条`);

  await init();

  // 隐藏本地早期试机数据（id 1-8），避免与 MVP 混在一起
  db.prepare(
    `UPDATE projects SET status = 'rejected', display_zone = '', reject_reason = '本地试机数据已归档' WHERE id <= 8`
  ).run();

  const userId = projects[0].publisher && projects[0].publisher.id
    ? projects[0].publisher.id
    : 'user_13638112727';
  ensureUser(userId);
  db.prepare(
    `UPDATE users SET member_level = 'V8' WHERE id = ?`
  ).run(userId);

  const upsert = db.prepare(`
    INSERT INTO projects (
      id, user_id, title, ip_address, store_count, base_amount, max_amount,
      category_id, category_tag, cover_type, carousel_images, video_url, video_poster,
      detail_content, introduction, member_level, status, reject_reason, display_zone,
      is_official, view_count, clue_count, published_at, expire_at, updated_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, 'approved', '', ?,
      ?, ?, ?, ?, ?, datetime('now', 'localtime')
    )
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      title = excluded.title,
      ip_address = excluded.ip_address,
      store_count = excluded.store_count,
      base_amount = excluded.base_amount,
      max_amount = excluded.max_amount,
      category_id = excluded.category_id,
      category_tag = excluded.category_tag,
      cover_type = excluded.cover_type,
      carousel_images = excluded.carousel_images,
      video_url = excluded.video_url,
      video_poster = excluded.video_poster,
      detail_content = excluded.detail_content,
      introduction = excluded.introduction,
      member_level = excluded.member_level,
      status = 'approved',
      reject_reason = '',
      display_zone = excluded.display_zone,
      is_official = excluded.is_official,
      view_count = excluded.view_count,
      clue_count = excluded.clue_count,
      published_at = excluded.published_at,
      expire_at = excluded.expire_at,
      updated_at = datetime('now', 'localtime')
  `);

  projects.forEach((p, i) => {
    const id = parseInt(p.id, 10);
    const carousel = JSON.stringify(p.carouselImages || (p.coverUrl ? [p.coverUrl] : []));
    const pubAt = publishedAtForIndex(i, projects.length);
    const expAt = '2027-04-21 23:59:59';
    upsert.run(
      id,
      (p.publisher && p.publisher.id) || userId,
      p.title || '参考模板',
      p.ipAddress || p.ip || '',
      String(p.storeCount || ''),
      String(p.baseAmount || '0'),
      String(p.maxAmount || '0'),
      p.categoryId || p.category || 'hot',
      p.categoryTag || p.category || '热门',
      p.coverType || 'carousel',
      carousel,
      p.videoUrl || '',
      p.videoPoster || '',
      p.detailContent || '',
      p.introduction || '',
      p.memberLevel || 'V8',
      p.displayZone || 'hot',
      p.isOfficial ? 1 : 0,
      Number(p.viewCount) || 0,
      Number(p.clueCount) || 0,
      pubAt,
      expAt
    );
    console.log(`  #${id} ${p.title} | ${pubAt}`);
  });

  try {
    db.prepare(
      `UPDATE sqlite_sequence SET seq = (SELECT MAX(id) FROM projects) WHERE name = 'projects'`
    ).run();
  } catch (e) {
    /* ignore */
  }

  const hot = db.prepare(
    `SELECT COUNT(*) as c FROM projects WHERE status = 'approved' AND display_zone = 'hot'`
  ).get();
  console.log(`\n完成。本地热门 approved: ${hot.c} 条（试机 #1-8 已归档为 rejected）`);
  console.log('请重启 node index.js，小程序 ENV=local 后下拉刷新首页。');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
