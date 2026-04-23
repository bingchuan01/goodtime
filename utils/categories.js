/**
 * 项目分类：默认数据与图标映射
 * 官方后台可添加/删除分类，前端从接口拉取，失败时使用此默认列表
 */

const ICON_MAP = {
  hot: '/images/icons/fire.svg',
  trend: '/images/icons/trend.svg',
  new: '/images/icons/new.svg',
  education: '/images/icons/education.svg',
  beauty: '/images/icons/beauty.svg',
  food: '/images/icons/food.svg',
  retail: '/images/icons/shop.svg',
  service: '/images/icons/service.svg',
  beverage: '/images/icons/beverage.svg',
  medical: '/images/icons/beauty.svg',
  entertainment: '/images/icons/entertainment.svg',
  health: '/images/icons/service.svg',
  hotel: '/images/icons/service.svg',
  motherBaby: '/images/icons/service.svg',
  auto: '/images/icons/shop.svg',
  fashion: '/images/icons/shop.svg',
  buildingDecor: '/images/icons/service.svg',
  homeFurniture: '/images/icons/service.svg',
  homeTextile: '/images/icons/service.svg',
  game: '/images/icons/entertainment.svg'
};

// 默认分类（接口不可用时的回退）
// 前6项用于导航栏，其余用于发布选择
const DEFAULT_CATEGORIES = [
  { id: 'hot', name: '热门', icon: '/images/icons/fire.svg' },
  { id: 'trend', name: '趋势', icon: '/images/icons/trend.svg' },
  { id: 'new', name: '上新', icon: '/images/icons/new.svg' },
  { id: 'education', name: '教育培训', icon: '/images/icons/education.svg' },
  { id: 'beauty', name: '医美护肤', icon: '/images/icons/beauty.svg' },
  { id: 'food', name: '餐饮美食', icon: '/images/icons/food.svg' },
  { id: 'retail', name: '零售连锁', icon: '/images/icons/shop.svg' },
  { id: 'service', name: '生活服务', icon: '/images/icons/service.svg' },
  { id: 'beverage', name: '食品酒水', icon: '/images/icons/beverage.svg' },
  { id: 'medical', name: '医美护肤', icon: '/images/icons/beauty.svg' },
  { id: 'entertainment', name: '休闲娱乐', icon: '/images/icons/entertainment.svg' },
  { id: 'health', name: '保健养身', icon: '/images/icons/service.svg' },
  { id: 'hotel', name: '酒店服务', icon: '/images/icons/service.svg' },
  { id: 'motherBaby', name: '母婴儿童', icon: '/images/icons/service.svg' },
  { id: 'auto', name: '汽车项目', icon: '/images/icons/shop.svg' },
  { id: 'fashion', name: '服饰箱包', icon: '/images/icons/shop.svg' },
  { id: 'buildingDecor', name: '建材装饰', icon: '/images/icons/service.svg' },
  { id: 'homeFurniture', name: '家居家具', icon: '/images/icons/service.svg' },
  { id: 'homeTextile', name: '品牌家纺', icon: '/images/icons/service.svg' },
  { id: 'game', name: '娱乐游戏', icon: '/images/icons/entertainment.svg' }
];

/**
 * 规范化分类项：确保 icon 为有效路径
 * 后端可返回 icon 为：完整 URL、相对路径、或图标 key（如 fire）
 */
function normalizeCategory(item) {
  if (!item || !item.id) return null;
  let icon = item.icon || '';
  if (!icon || icon.indexOf('/') === -1) {
    icon = ICON_MAP[item.id] || ICON_MAP[item.icon] || '/images/icons/fire.svg';
  }
  // 后台无图标编辑时：按 id 强制用前端配置图标，与后台旧数据区分
  if (ICON_MAP[item.id]) {
    icon = ICON_MAP[item.id];
  }
  return {
    id: String(item.id),
    name: item.name || item.label || '',
    icon: icon
  };
}

/**
 * 规范化分类列表
 */
function normalizeList(list) {
  if (!Array.isArray(list)) return DEFAULT_CATEGORIES;
  const normalized = list.map(normalizeCategory).filter(Boolean);
  return normalized.length > 0 ? normalized : DEFAULT_CATEGORIES;
}

module.exports = {
  DEFAULT_CATEGORIES,
  ICON_MAP,
  normalizeCategory,
  normalizeList
};
