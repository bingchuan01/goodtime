/**
 * 会员套餐与体验优惠卡配置（member_plans / member_trial）
 */
const { db } = require('../db');

const DEFAULT_PLANS = [
  { id: 'v6', name: 'V6', price: 598, originalPrice: 998, days: 365 },
  { id: 'v8', name: 'V8', price: 21980, originalPrice: 29980, days: 365 }
];

const DEFAULT_TRIAL = {
  enabled: true,
  name: '优惠体验',
  badgeText: '限时体验',
  subtitle: '体验期内可发布项目',
  price: 99,
  originalPrice: 598,
  days: 30,
  promoEndAt: '',
  backgroundImage: '',
  illustrationImage: ''
};

function parseJson(raw, fallback) {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw);
    return v == null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function parseExpireTime(iso) {
  if (!iso) return null;
  const raw = String(iso).trim();
  if (!raw) return null;
  const t = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
  return isNaN(t.getTime()) ? null : t;
}

function normalizePlan(p) {
  if (!p || !p.id) return null;
  const price = Number(p.price);
  const originalPrice = Number(p.originalPrice != null ? p.originalPrice : p.original_price);
  const days = Number(p.days);
  return {
    id: String(p.id).toLowerCase(),
    name: p.name || String(p.id).toUpperCase(),
    price: isNaN(price) ? 0 : Math.max(0, price),
    originalPrice: isNaN(originalPrice) ? 0 : Math.max(0, originalPrice),
    days: isNaN(days) ? 365 : Math.max(1, days)
  };
}

function getMemberPlans() {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('member_plans');
  const parsed = parseJson(row && row.value, DEFAULT_PLANS);
  const list = Array.isArray(parsed) ? parsed : DEFAULT_PLANS;
  return list.map(normalizePlan).filter(Boolean);
}

function getMemberTrial() {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('member_trial');
  const parsed = parseJson(row && row.value, DEFAULT_TRIAL);
  const t = parsed && typeof parsed === 'object' ? parsed : DEFAULT_TRIAL;
  const price = Number(t.price);
  const originalPrice = Number(t.originalPrice != null ? t.originalPrice : t.original_price);
  const days = Number(t.days);
  const bg = t.backgroundImage || t.background_image || '';
  const illus = t.illustrationImage || t.illustration_image || bg;
  return {
    enabled: t.enabled !== false && t.enabled !== 0 && t.enabled !== '0',
    name: t.name || DEFAULT_TRIAL.name,
    badgeText: t.badgeText || t.badge_text || DEFAULT_TRIAL.badgeText,
    subtitle: t.subtitle || DEFAULT_TRIAL.subtitle,
    price: isNaN(price) ? DEFAULT_TRIAL.price : Math.max(0, price),
    originalPrice: isNaN(originalPrice) ? DEFAULT_TRIAL.originalPrice : Math.max(0, originalPrice),
    days: isNaN(days) ? DEFAULT_TRIAL.days : Math.max(1, days),
    promoEndAt: t.promoEndAt || t.promo_end_at || '',
    backgroundImage: bg,
    illustrationImage: illus
  };
}

function getMemberCatalog() {
  return { plans: getMemberPlans(), trial: getMemberTrial() };
}

function findPlanById(planId) {
  const id = String(planId || '').toLowerCase();
  if (id === 'trial') {
    const trial = getMemberTrial();
    if (!trial.enabled || !isTrialPromoActive(trial)) return null;
    return {
      id: 'trial',
      name: trial.name,
      price: trial.price,
      originalPrice: trial.originalPrice,
      days: trial.days
    };
  }
  return getMemberPlans().find((p) => p.id === id) || null;
}

/** 体验优惠是否在活动期内（未配置结束时间则视为长期有效） */
function isTrialPromoActive(trial) {
  if (!trial || !trial.enabled) return false;
  const end = parseExpireTime(trial.promoEndAt);
  if (!end) return true;
  return end.getTime() >= Date.now();
}

function getTrialUnavailableMessage(trial) {
  if (!trial || !trial.enabled) return '体验优惠暂未开放';
  if (!isTrialPromoActive(trial)) return '体验活动已结束';
  return '';
}

module.exports = {
  DEFAULT_PLANS,
  DEFAULT_TRIAL,
  getMemberPlans,
  getMemberTrial,
  getMemberCatalog,
  findPlanById,
  isTrialPromoActive,
  getTrialUnavailableMessage
};
