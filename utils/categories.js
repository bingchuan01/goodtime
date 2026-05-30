/**
 * 项目分类：默认数据与图标映射
 * 官方后台可添加/删除分类，前端从接口拉取，失败时使用此默认列表
 */

/** 首页展区展示名（与 id 绑定，接口仍返回旧名时也强制覆盖） */
const ZONE_DISPLAY_NAMES = {
  hot: '热门赛道',
  trend: '趋势前沿',
  new: '品牌上新'
};

const ICON_MAP = {
  hot: '/images/icons/fire.svg',
  trend: '/images/icons/trend.svg',
  new: '/images/icons/new.svg',
  education: '/images/icons/education.svg',
  beauty: '/images/icons/beauty.svg',
  food: '/images/icons/food.svg',
  retail: '/images/icons/shop.svg',
  service: '/images/icons/service.svg',
  health: '/images/icons/health.svg',
  hotel: '/images/icons/hotel.svg',
  motherBaby: '/images/icons/mother-baby.svg',
  auto: '/images/icons/auto.svg',
  fashion: '/images/icons/fashion.svg',
  buildingDecor: '/images/icons/building-decor.svg',
  homeFurniture: '/images/icons/home-furniture.svg',
  homeTextile: '/images/icons/home-textile.svg',
  game: '/images/icons/game.svg',
  childcare: '/images/icons/service.svg',
  trend_ai: '/images/icons/trend.svg',
  trend_compute: '/images/icons/trend.svg',
  trend_overseas: '/images/icons/trend.svg',
  trend_physics_ai: '/images/icons/trend.svg',
  trend_health: '/images/icons/health.svg',
  trend_beauty: '/images/icons/beauty.svg',
  trend_delivery: '/images/icons/food.svg'
};

// 默认分类（与 好时机分类导航二类分类参照文档 L1 完全一致）
const DEFAULT_CATEGORIES = [
  { id: 'hot', name: '热门赛道', icon: '/images/icons/fire.svg' },
  { id: 'trend', name: '趋势前沿', icon: '/images/icons/trend.svg' },
  { id: 'new', name: '品牌上新', icon: '/images/icons/new.svg' },
  { id: 'food', name: '餐饮美食', icon: '/images/icons/food.svg' },
  { id: 'education', name: '教育培训', icon: '/images/icons/education.svg' },
  { id: 'beauty', name: '医美护肤', icon: '/images/icons/beauty.svg' },
  { id: 'retail', name: '零售连锁', icon: '/images/icons/shop.svg' },
  { id: 'service', name: '生活服务', icon: '/images/icons/service.svg' },
  { id: 'health', name: '保健养生', icon: '/images/icons/health.svg' },
  { id: 'hotel', name: '酒店服务', icon: '/images/icons/hotel.svg' },
  { id: 'motherBaby', name: '母婴儿童', icon: '/images/icons/mother-baby.svg' },
  { id: 'auto', name: '汽车项目', icon: '/images/icons/auto.svg' },
  { id: 'fashion', name: '服饰箱包', icon: '/images/icons/fashion.svg' },
  { id: 'buildingDecor', name: '建材装饰', icon: '/images/icons/building-decor.svg' },
  { id: 'homeFurniture', name: '家居家具', icon: '/images/icons/home-furniture.svg' },
  { id: 'homeTextile', name: '品牌家纺', icon: '/images/icons/home-textile.svg' },
  { id: 'game', name: '娱乐游戏', icon: '/images/icons/game.svg' }
];

const DEFAULT_CATEGORY_ORDER = DEFAULT_CATEGORIES.map((c) => c.id);

function normalizeCategory(item) {
  if (!item || !item.id) return null;
  let icon = item.icon || '';
  if (!icon || icon.indexOf('/') === -1) {
    icon = ICON_MAP[item.id] || ICON_MAP[item.icon] || '/images/icons/fire.svg';
  }
  if (ICON_MAP[item.id]) {
    icon = ICON_MAP[item.id];
  }
  const id = String(item.id);
  let name = item.name || item.label || '';
  if (ZONE_DISPLAY_NAMES[id]) {
    name = ZONE_DISPLAY_NAMES[id];
  }
  return { id, name, icon };
}

function normalizeList(list) {
  if (!Array.isArray(list)) return DEFAULT_CATEGORIES;
  const map = new Map();
  list.map(normalizeCategory).filter(Boolean).forEach((item) => map.set(item.id, item));
  DEFAULT_CATEGORIES.forEach((def) => {
    if (!map.has(def.id)) map.set(def.id, def);
    else {
      const cur = map.get(def.id);
      map.set(def.id, { ...cur, name: ZONE_DISPLAY_NAMES[def.id] || def.name, icon: ICON_MAP[def.id] || cur.icon });
    }
  });
  return DEFAULT_CATEGORY_ORDER.map((id) => map.get(id)).filter(Boolean);
}

module.exports = {
  DEFAULT_CATEGORIES,
  DEFAULT_CATEGORY_ORDER,
  ZONE_DISPLAY_NAMES,
  ICON_MAP,
  normalizeCategory,
  normalizeList
};
