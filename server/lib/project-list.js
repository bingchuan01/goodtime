const { db } = require('../db');
const { getProjectStats } = require('./project-stats');
const { pickCardAlgoTag, formatCount } = require('./algo-tag');
const { getSurgePoolMap, currentPoolMonth } = require('./surge-pool');

const LIST_ORDER = `CASE WHEN pinned_until IS NOT NULL AND pinned_until != '' AND pinned_until > datetime('now', 'localtime') THEN 0 ELSE 1 END,
  COALESCE(NULLIF(TRIM(published_at), ''), updated_at) DESC, id DESC`;

function normalizeCoverUrl(url) {
  if (!url) return '';
  let out = String(url).trim();
  if (!out) return '';
  if (out.indexOf('https://') === 0) return out;
  if (out.indexOf('//') === 0) return 'https:' + out;
  if (out.indexOf('http://api.goodtime.work') === 0) return out.replace('http://', 'https://');
  const prodBase = process.env.UPLOAD_BASE_URL || 'https://api.goodtime.work';
  if (out.indexOf('http://localhost') === 0 || out.indexOf('http://127.0.0.1') === 0 || out.indexOf('http://192.168.') === 0) {
    try {
      const u = new URL(out);
      const path = u.pathname || '';
      if (path.indexOf('/uploads/') === 0) return prodBase + path;
    } catch (e) {}
  }
  if (out.indexOf('http://') === 0) {
    try {
      const u = new URL(out);
      const path = u.pathname || '';
      if (path.indexOf('/uploads/') === 0) return prodBase + path;
    } catch (e) {}
    return '';
  }
  return out;
}

function enrichListRow(p, surgeMap) {
  const map = surgeMap || getSurgePoolMap(currentPoolMonth());
  const publisher = db.prepare('SELECT id, nickname, avatar, member_level FROM users WHERE id = ?').get(p.user_id);
  let carouselImages = [];
  try {
    carouselImages = JSON.parse(p.carousel_images || '[]');
  } catch (e) {}
  const rawCoverUrl = (Array.isArray(carouselImages) && carouselImages.length > 0)
    ? carouselImages[0]
    : (p.video_poster || '');
  const coverUrl = normalizeCoverUrl(rawCoverUrl);
  const surgeInfo = map.get(p.id);
  const hasSurgeTag = !!(surgeInfo && surgeInfo.hasSurgeTag);
  const isInSurgePool50 = !!surgeInfo;
  const stats = getProjectStats(p.id);
  const algoTag = pickCardAlgoTag(hasSurgeTag, stats);
  return {
    id: String(p.id),
    title: p.title,
    ip: p.ip_address || '',
    category: p.category_tag || p.category_id || '',
    storeCount: p.store_count || '',
    viewCount: stats.view,
    viewLabel: `${formatCount(stats.view)}观看`,
    investmentAmount: p.base_amount && p.max_amount ? `¥${p.base_amount}-${p.max_amount}万` : (p.base_amount ? `¥${p.base_amount}万` : ''),
    isOfficial: !!p.is_official,
    memberLevel: p.member_level || '',
    coverType: p.cover_type || 'image',
    coverUrl,
    videoUrl: p.video_url || '',
    videoPoster: normalizeCoverUrl(p.video_poster || ''),
    publisher: publisher ? {
      id: publisher.id,
      nickname: publisher.nickname || '未知',
      avatar: publisher.avatar || '',
      memberLevel: publisher.member_level || '',
      ip: p.ip_address || ''
    } : { id: p.user_id, nickname: '未知', avatar: '', memberLevel: '', ip: p.ip_address || '' },
    categoryTag: p.category_tag || '',
    clueCount: p.clue_count || 0,
    status: p.status,
    displayZone: p.display_zone || '',
    publishedAt: p.published_at || '',
    hasSurgeTag,
    isInSurgePool: isInSurgePool50,
    isHomeSurgeFeatured: !!(surgeInfo && surgeInfo.isHomeFeatured),
    stats,
    algoTag
  };
}

module.exports = {
  LIST_ORDER,
  normalizeCoverUrl,
  enrichListRow
};
