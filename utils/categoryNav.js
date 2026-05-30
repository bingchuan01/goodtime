/**
 * 分类导航前端工具（与 server/lib/category-nav-data.js 对齐）
 */
const { ICON_MAP } = require('./categories');

const L1_META = [
  { id: 'hot', name: '热门赛道', type: 'zone', zoneId: 'hot', iconKey: 'hot' },
  { id: 'trend', name: '趋势前沿', type: 'zone', zoneId: 'trend', iconKey: 'trend' },
  { id: 'new', name: '品牌上新', type: 'zone', zoneId: 'new', iconKey: 'new', noL2: true },
  { id: 'food', name: '餐饮美食', type: 'industry', iconKey: 'food' },
  { id: 'education', name: '教育培训', type: 'industry', iconKey: 'education' },
  { id: 'beauty', name: '医美护肤', type: 'industry', iconKey: 'beauty' },
  { id: 'retail', name: '零售连锁', type: 'industry', iconKey: 'retail' },
  { id: 'service', name: '生活服务', type: 'industry', iconKey: 'service' },
  { id: 'health', name: '保健养生', type: 'industry', iconKey: 'health' },
  { id: 'hotel', name: '酒店服务', type: 'industry', iconKey: 'hotel' },
  { id: 'motherBaby', name: '母婴儿童', type: 'industry', iconKey: 'motherBaby' },
  { id: 'auto', name: '汽车项目', type: 'industry', iconKey: 'auto' },
  { id: 'fashion', name: '服饰箱包', type: 'industry', iconKey: 'fashion' },
  { id: 'buildingDecor', name: '建材装饰', type: 'industry', iconKey: 'buildingDecor' },
  { id: 'homeFurniture', name: '家居家具', type: 'industry', iconKey: 'homeFurniture' },
  { id: 'homeTextile', name: '品牌家纺', type: 'industry', iconKey: 'homeTextile' },
  { id: 'game', name: '娱乐游戏', type: 'industry', iconKey: 'game' }
];

function l2Zone(name, categoryId, zoneId, iconKey) {
  return { name, categoryId, displayZone: zoneId, categoryTag: '', iconKey: iconKey || categoryId };
}

function l2Industry(name, categoryId, categoryTag, iconKey) {
  return { name, categoryId, displayZone: '', categoryTag: categoryTag || name, iconKey: iconKey || categoryId };
}

const INDUSTRY_L2 = {
  food: [
    '中式快餐', '火锅/串串', '茶饮/甜品', '小吃/快餐（鸡排、煎饼等）', '面食/米粉', '烧烤/夜宵',
    '预制菜/卤味', '咖啡/轻食', '烘焙', '儿童餐食'
  ],
  education: [
    'K12辅导', '语言培训', '素质教育（美术/音乐/编程）', '职业教育/技能认证', '早教/幼教', '留学中介',
    'IT/考证培训', '语言启蒙', '艺术考级', '自习室/空间运营'
  ],
  beauty: [
    '轻医美诊所（水光针、射频等）', '皮肤管理中心', '痤痘/抗衰专营店', '中医美容', '植发/毛发管理',
    '家用美容仪器代理', '医美耗材分销', '术后修复中心', '跨境护肤品代理', '美容仪器加盟'
  ],
  retail: [
    '便利店', '零食量贩店', '进口食品店', '母婴用品店', '宠物用品店', '药店/健康产品',
    '文创杂货', '智能硬件零售', '鲜花绿植', '折扣店（如10元店）'
  ],
  service: [
    '洗衣店（智能/自助）', '家政保洁', '上门维修（家电/水电）', '美甲美睫', '理发/造型沙龙',
    '摄影写真', '婚庆策划', '宠物寄养/美容', '洗车/汽车美容', '上门按摩'
  ],
  health: [
    '中医理疗馆', '艾灸/拔罐中心', '足疗/SPA', '健康检测站', '营养补剂零售', '睡眠调理',
    '慢性病管理（非医疗）', '康养驿站', '智能穿戴健康设备', '老年照护服务'
  ],
  hotel: [
    '经济型连锁酒店', '民宿/短租公寓', '主题客栈', '商务酒店', '酒店管理软件加盟', '自助入住终端',
    '酒店用品集采', '酒店清洁外包', '酒店代运营'
  ],
  motherBaby: [
    '母婴店（奶粉/用品）', '儿童摄影', '早教中心', '婴儿游泳馆', '玩具租赁', '产后修复中心',
    '儿童游乐场（室内）', '辅食/健康食品', '儿童服饰', '孕产护理'
  ],
  auto: [
    '汽车美容（镀膜/贴膜）', '快修快保', '充电桩加盟', '二手车经纪', '汽车用品零售', '洗车加盟',
    '车载智能设备', '轮胎服务', '汽车租赁（短租）', '新能源车后服务'
  ],
  fashion: [
    '快时尚女装/男装', '定制服饰（工服/校服）', '运动户外品牌', '箱包皮具', '鞋履', '内衣家纺',
    '潮牌代理', '二手服饰', '跨境电商服饰', '婚庆礼服租赁'
  ],
  buildingDecor: [
    '瓷砖/石材代理', '定制橱柜/衣柜', '防水工程', '智能门窗', '吊顶/照明', '环保涂料',
    '地暖/中央空调代理', '集成墙面', '卫浴洁具', '工程总包服务'
  ],
  homeFurniture: [
    '软体家具（床/沙发）', '板式/实木家具', '定制整装', '户外家具', '智能家居系统', '家居饰品',
    '折叠/收纳家具', '网红设计款代理', '家居电商仓配', '家居软装搭配'
  ],
  homeTextile: [
    '床品四件套', '毛巾浴巾', '窗帘布艺', '冬季保暖用品（羽绒被/暖毯）', '抗菌抑菌系列', '酒店专用家纺',
    '儿童家纺', '竹纤维/蚕丝产品', '家纺OEM贴牌', '线上+线下融合门店'
  ],
  game: [
    '桌游吧/剧本杀馆', '电竞馆', 'VR体验馆', '儿童益智游乐', '密室逃脱', '街机/抓娃娃机代理',
    '线上游戏代运营', '游戏周边零售', '棋牌室（合规）', '亲子互动体验中心'
  ]
};

const L2_BY_L1 = {
  hot: [
    l2Zone('餐饮美食', 'food', 'hot', 'food'),
    l2Zone('教育培训', 'education', 'hot', 'education'),
    l2Zone('医美护肤', 'beauty', 'hot', 'beauty'),
    l2Zone('零售连锁', 'retail', 'hot', 'retail'),
    l2Zone('生活服务', 'service', 'hot', 'service'),
    l2Zone('托管中心', 'childcare', 'hot', 'service')
  ],
  trend: [
    l2Zone('AI人工智能', 'trend_ai', 'trend', 'trend'),
    l2Zone('AI算力租赁', 'trend_compute', 'trend', 'trend'),
    l2Zone('海外市场', 'trend_overseas', 'trend', 'trend'),
    l2Zone('物理AI', 'trend_physics_ai', 'trend', 'trend'),
    l2Zone('健康产业', 'trend_health', 'trend', 'health'),
    l2Zone('颜值管理', 'trend_beauty', 'trend', 'beauty'),
    l2Zone('自营外卖', 'trend_delivery', 'trend', 'food')
  ],
  new: []
};

Object.keys(INDUSTRY_L2).forEach((id) => {
  L2_BY_L1[id] = INDUSTRY_L2[id].map((tag) => l2Industry(tag, id, tag, id));
});

/** L1 名称前两字 + 「类其它」 */
function otherCategoryLabel(l1Name) {
  const prefix = String(l1Name || '').slice(0, 2);
  return prefix ? `${prefix}类其它` : '类其它';
}

function buildOtherL2Entry(l1Id) {
  const meta = L1_META.find((item) => item.id === l1Id);
  if (!meta || meta.noL2) return null;
  const label = otherCategoryLabel(meta.name);
  if (meta.type === 'zone') {
    return {
      name: label,
      categoryId: meta.zoneId,
      displayZone: meta.zoneId,
      categoryTag: label,
      iconKey: meta.iconKey || meta.id,
      isOther: true
    };
  }
  return l2Industry(label, meta.id, label, meta.iconKey || meta.id);
}

function appendOtherL2ToAllGroups() {
  L1_META.forEach((meta) => {
    if (meta.noL2) return;
    const list = L2_BY_L1[meta.id];
    if (!Array.isArray(list) || !list.length) return;
    const other = buildOtherL2Entry(meta.id);
    if (other && !list.some((item) => item.name === other.name)) {
      list.push(other);
    }
  });
}

appendOtherL2ToAllGroups();

const PRICE_RANGES = [
  { id: '1-5', label: '1～5万' },
  { id: '6-10', label: '6～10万' },
  { id: '11-20', label: '11～20万' },
  { id: '21-50', label: '21～50万' },
  { id: '50+', label: '50万以上' }
];

function resolveIcon(iconKey) {
  return ICON_MAP[iconKey] || '/images/icons/fire.svg';
}

function attachIcons(list) {
  return (list || []).map((item) => ({
    ...item,
    icon: resolveIcon(item.iconKey || item.categoryId || 'hot')
  }));
}

function getL2ByL1(l1Id) {
  return attachIcons(L2_BY_L1[l1Id] || []);
}

function getL1Meta(l1Id) {
  return L1_META.find((item) => item.id === l1Id) || null;
}

function getFilterTypeOptions() {
  return L1_META.map((l1) => ({
    key: `l1_${l1.id}`,
    l1Id: l1.id,
    label: l1.name,
    categoryId: l1.type === 'industry' ? l1.id : '',
    categoryTag: '',
    displayZone: l1.type === 'zone' || l1.noL2 ? l1.zoneId : ''
  }));
}

function matchProjectToL2(project, l2, l1Meta) {
  if (!project || !l2 || !l1Meta) return false;
  const tag = project.categoryTag || project.category || '';
  if (l1Meta.type === 'zone') {
    if ((project.displayZone || '') !== l1Meta.zoneId) return false;
    if (l2.categoryTag) return tag === l2.categoryTag;
    if (l2.categoryId && (project.categoryId || '') === l2.categoryId) return true;
    return false;
  }
  const pid = project.categoryId || '';
  if (pid !== l1Meta.id && project.category !== l1Meta.id) return false;
  if (l2.categoryTag) return tag === l2.categoryTag;
  return tag === l2.name;
}

function groupProjectsByL2(projects, l1Id) {
  const meta = getL1Meta(l1Id);
  const l2List = L2_BY_L1[l1Id] || [];
  if (!meta || !l2List.length) return [];
  return l2List
    .map((l2) => ({
      name: l2.name,
      projects: (projects || []).filter((p) => matchProjectToL2(p, l2, meta))
    }))
    .filter((section) => section.projects.length > 0);
}

function mergeNavFromApi(data) {
  if (!data) return { l2ByL1: L2_BY_L1, filterTypes: getFilterTypeOptions(), priceRanges: PRICE_RANGES };
  return {
    l2ByL1: data.l2ByL1 || L2_BY_L1,
    filterTypes: data.filterTypes || getFilterTypeOptions(),
    priceRanges: data.priceRanges || PRICE_RANGES
  };
}

function buildListQueryFromL2(l2) {
  const qs = [];
  if (l2.categoryId) qs.push(`categoryId=${encodeURIComponent(l2.categoryId)}`);
  if (l2.categoryTag) qs.push(`categoryTag=${encodeURIComponent(l2.categoryTag)}`);
  if (l2.displayZone) qs.push(`displayZone=${encodeURIComponent(l2.displayZone)}`);
  qs.push(`title=${encodeURIComponent(l2.name)}`);
  return qs.join('&');
}

function buildPublishPayloadFromL2(l1Id, l2) {
  const meta = getL1Meta(l1Id);
  if (!meta) return null;
  if (meta.noL2) {
    return {
      categoryId: meta.zoneId,
      categoryTag: meta.name,
      displayZone: meta.zoneId,
      label: meta.name
    };
  }
  if (!l2) return null;
  return {
    categoryId: l2.categoryId || meta.id,
    categoryTag: l2.categoryTag || '',
    displayZone: l2.displayZone || '',
    label: l2.name
  };
}

function buildListQueryFromFilter(filter) {
  const qs = [];
  if (filter.categoryId) qs.push(`categoryId=${encodeURIComponent(filter.categoryId)}`);
  if (filter.categoryTag) qs.push(`categoryTag=${encodeURIComponent(filter.categoryTag)}`);
  if (filter.displayZone) qs.push(`displayZone=${encodeURIComponent(filter.displayZone)}`);
  if (filter.priceRange) qs.push(`priceRange=${encodeURIComponent(filter.priceRange)}`);
  if (filter.region) qs.push(`region=${encodeURIComponent(filter.region)}`);
  if (filter.l1Id) qs.push(`l1Id=${encodeURIComponent(filter.l1Id)}`);
  if (filter.typeLabel) qs.push(`typeLabel=${encodeURIComponent(filter.typeLabel)}`);
  if (filter.priceLabel) qs.push(`priceLabel=${encodeURIComponent(filter.priceLabel)}`);
  qs.push('fromFilter=1');
  const titleParts = [];
  if (filter.typeLabel) titleParts.push(filter.typeLabel);
  if (filter.priceLabel) titleParts.push(filter.priceLabel);
  if (filter.region) titleParts.push(filter.region);
  qs.push(`title=${encodeURIComponent(titleParts.length ? titleParts.join(' · ') : '筛选结果')}`);
  return qs.join('&');
}

module.exports = {
  L1_META,
  L2_BY_L1,
  PRICE_RANGES,
  getL2ByL1,
  getL1Meta,
  getFilterTypeOptions,
  groupProjectsByL2,
  mergeNavFromApi,
  buildListQueryFromL2,
  buildPublishPayloadFromL2,
  buildListQueryFromFilter,
  resolveIcon
};

