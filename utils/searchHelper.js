/**
 * 搜索辅助：联想词、错别字/同音词容错
 * 实际生产建议由后端提供联想与容错接口
 */

// 智能联想：输入关键词 -> 联想词列表（如 奶茶->茶饮）
const SUGGESTION_MAP = {
  奶茶: ['茶饮', '饮品', '甜品'],
  茶饮: ['奶茶', '咖啡', '果汁'],
  咖啡: ['茶饮', '饮品'],
  火锅: ['餐饮', '美食'],
  餐饮: ['美食', '火锅', '快餐'],
  美食: ['餐饮', '火锅'],
  美甲: ['美容', '护肤'],
  护肤: ['医美', '美容'],
  医美: ['护肤', '美容'],
  教育: ['培训', '学习'],
  培训: ['教育', '学习']
};

// 错别字/同音词容错：错误写法 -> 正确关键词
const TYPO_MAP = {
  内茶: '奶茶',
  茶饮: '茶饮',
  火锅: '火锅',
  火鍋: '火锅',
  美答: '美甲',
  教育: '教育',
  教肓: '教育'
};

const STORAGE_KEY = 'search_history';
const MAX_HISTORY = 20;

/**
 * 获取联想词
 * @param {string} keyword 当前输入
 * @returns {string[]}
 */
function getSuggestions(keyword) {
  if (!keyword || !keyword.trim()) return [];
  const k = keyword.trim();
  const list = [];
  for (const [key, vals] of Object.entries(SUGGESTION_MAP)) {
    if (key.includes(k) || k.includes(key)) {
      list.push(...vals.filter(v => v !== k));
    }
  }
  return [...new Set(list)].slice(0, 8);
}

/**
 * 容错：将输入转为可用于搜索的关键词（展开同义词/修正错别字）
 * @param {string} keyword
 * @returns {string[]} 用于模糊匹配的关键词列表
 */
function normalizeKeyword(keyword) {
  if (!keyword || !keyword.trim()) return [];
  const k = keyword.trim();
  const terms = [k];
  if (TYPO_MAP[k]) terms.push(TYPO_MAP[k]);
  if (SUGGESTION_MAP[k]) terms.push(...SUGGESTION_MAP[k]);
  return [...new Set(terms)];
}

/**
 * 判断项目是否匹配关键词（标题、品牌、行业模糊匹配）
 * @param {object} item 项目 { title, category, ... }
 * @param {string[]} terms 关键词列表（已容错展开）
 */
function matchProject(item, terms) {
  if (!terms || terms.length === 0) return true;
  const title = (item.title || '').toLowerCase();
  const category = (item.category || '').toLowerCase();
  const brand = (item.brand || item.title || '').toLowerCase();
  const text = `${title} ${category} ${brand}`;
  return terms.some(t => text.includes((t || '').toLowerCase()));
}

/**
 * 获取搜索历史
 */
function getHistory() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY);
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

/**
 * 保存搜索关键词到历史
 */
function saveToHistory(keyword) {
  if (!keyword || !keyword.trim()) return;
  const k = keyword.trim();
  let list = getHistory();
  list = list.filter(x => x !== k);
  list.unshift(k);
  list = list.slice(0, MAX_HISTORY);
  wx.setStorageSync(STORAGE_KEY, list);
}

/**
 * 删除单条历史
 */
function removeHistoryItem(keyword) {
  let list = getHistory();
  list = list.filter(x => x !== keyword);
  wx.setStorageSync(STORAGE_KEY, list);
}

/**
 * 清空搜索历史
 */
function clearHistory() {
  wx.setStorageSync(STORAGE_KEY, []);
}

module.exports = {
  getSuggestions,
  normalizeKeyword,
  matchProject,
  getHistory,
  saveToHistory,
  removeHistoryItem,
  clearHistory
};
