const { db } = require('../db');

const POOL_SIZE = 50;
const HOME_FEATURED_SIZE = 10;
/** 卡片/详情「热度飙升」标签仅 Top10（全站 10 席） */
const SURGE_TAG_SIZE = 10;

function currentPoolMonth(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function isManuallyPinned(project) {
  if (!project) return false;
  const until = project.pinned_until;
  if (!until || !String(until).trim()) return false;
  const row = db.prepare(
    "SELECT CASE WHEN ? > datetime('now', 'localtime') THEN 1 ELSE 0 END as ok"
  ).get(String(until).trim());
  return !!(row && row.ok);
}

function recomputeSurgePool(month = currentPoolMonth()) {
  const candidates = db.prepare(`
    SELECT id, published_at
    FROM projects
    WHERE status = 'approved'
      AND published_at IS NOT NULL AND trim(published_at) != ''
      AND NOT (
        pinned_until IS NOT NULL AND trim(pinned_until) != ''
        AND pinned_until > datetime('now', 'localtime')
      )
    ORDER BY published_at DESC, id DESC
    LIMIT ?
  `).all(POOL_SIZE);

  db.prepare('DELETE FROM surge_pool WHERE pool_month = ?').run(month);
  const insert = db.prepare(
    'INSERT INTO surge_pool (project_id, pool_month, pool_rank, is_home_featured) VALUES (?, ?, ?, ?)'
  );
  candidates.forEach((row, index) => {
    const rank = index + 1;
    insert.run(row.id, month, rank, rank <= HOME_FEATURED_SIZE ? 1 : 0);
  });

  db.prepare('DELETE FROM surge_pool_meta').run();
  db.prepare(
    "INSERT INTO surge_pool_meta (pool_month, computed_at) VALUES (?, datetime('now', 'localtime'))"
  ).run(month);

  return { month, count: candidates.length };
}

function ensureSurgePoolCurrent() {
  const month = currentPoolMonth();
  const meta = db.prepare('SELECT pool_month FROM surge_pool_meta LIMIT 1').get();
  if (!meta || meta.pool_month !== month) {
    return recomputeSurgePool(month);
  }
  return { month, count: getPoolProjectIds(month).length };
}

function getPoolProjectIds(month = currentPoolMonth()) {
  return db.prepare(
    'SELECT project_id FROM surge_pool WHERE pool_month = ? ORDER BY pool_rank ASC'
  ).all(month).map((r) => r.project_id);
}

function getSurgePoolMap(month = currentPoolMonth()) {
  const rows = db.prepare(
    'SELECT project_id, pool_rank, is_home_featured FROM surge_pool WHERE pool_month = ?'
  ).all(month);
  const map = new Map();
  rows.forEach((r) => {
    map.set(r.project_id, {
      poolRank: r.pool_rank,
      isHomeFeatured: !!r.is_home_featured,
      hasSurgeTag: r.pool_rank <= SURGE_TAG_SIZE
    });
  });
  return map;
}

function isInSurgePool(projectId, month = currentPoolMonth()) {
  const row = db.prepare(
    'SELECT 1 FROM surge_pool WHERE pool_month = ? AND project_id = ?'
  ).get(month, parseInt(projectId, 10));
  return !!row;
}

function hasSurgeTag(projectId, month = currentPoolMonth()) {
  const row = db.prepare(
    'SELECT pool_rank FROM surge_pool WHERE pool_month = ? AND project_id = ?'
  ).get(month, parseInt(projectId, 10));
  return !!(row && row.pool_rank <= SURGE_TAG_SIZE);
}

function getHomeFeaturedIds(month = currentPoolMonth()) {
  return db.prepare(`
    SELECT project_id FROM surge_pool
    WHERE pool_month = ? AND is_home_featured = 1
    ORDER BY pool_rank ASC
    LIMIT ?
  `).all(month, HOME_FEATURED_SIZE).map((r) => r.project_id);
}

module.exports = {
  POOL_SIZE,
  HOME_FEATURED_SIZE,
  SURGE_TAG_SIZE,
  currentPoolMonth,
  recomputeSurgePool,
  ensureSurgePoolCurrent,
  getPoolProjectIds,
  getSurgePoolMap,
  isInSurgePool,
  hasSurgeTag,
  getHomeFeaturedIds
};
