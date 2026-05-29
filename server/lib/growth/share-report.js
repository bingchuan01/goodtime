const { db } = require('../../db');
const { applyExpGain, applyPointsGain, todayStr, yearMonthStr } = require('./grant-exp-points');
const { resolveGrowthCoefficient } = require('./resolve-growth-coefficient');

const SHARE_EXP = 10;
const SHARE_PTS = 5;
const SHARE_DAILY_MAX = 3;
const CLICK_EXP = 15;
const CLICK_PTS = 8;
const CLICK_DAILY_MAX = 5;
const REGISTER_EXP = 50;
const REGISTER_PTS = 30;

function weekKey(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function ensureShareTables() {
  db.exec(`CREATE TABLE IF NOT EXISTS share_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    share_id TEXT DEFAULT '',
    actor_user_id TEXT DEFAULT '',
    ref_user_id TEXT DEFAULT '',
    meta TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_share_events_user ON share_events(user_id)');
}

function countTodayEvents(userId, eventType) {
  const today = todayStr();
  const row = db.prepare(
    `SELECT COUNT(*) as c FROM share_events
     WHERE user_id = ? AND event_type = ? AND created_at LIKE ?`
  ).get(userId, eventType, today + '%');
  return Number(row && row.c) || 0;
}

function countWeeklyClickPair(sharerId, clickerId) {
  const wk = weekKey(todayStr());
  const row = db.prepare(
    `SELECT COUNT(*) as c FROM share_events
     WHERE user_id = ? AND event_type = 'click' AND actor_user_id = ?
       AND created_at >= ?`
  ).get(sharerId, clickerId, wk);
  return Number(row && row.c) || 0;
}

function brandClickMultiplier(user) {
  const tag = String(user && user.identity_tag || '').trim();
  if (tag === '品牌方') return 1.5;
  return 1.0;
}

function brandRegisterMultiplier(user) {
  const tag = String(user && user.identity_tag || '').trim();
  if (tag === '品牌方') return 1.8;
  return 1.0;
}

/**
 * @param {string} userId - 获益用户（分享者）
 * @param {object} payload - { type, shareId?, targetUserId?, dwellSeconds? }
 */
function reportShareEvent(userId, payload) {
  const type = String(payload.type || '').trim();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return { grantedExp: 0, grantedPoints: 0, capped: true, message: '用户不存在' };

  let grantedExp = 0;
  let grantedPoints = 0;
  let capped = false;
  let message = 'ok';

  if (type === 'share') {
    if (countTodayEvents(userId, 'share') >= SHARE_DAILY_MAX) {
      return { grantedExp: 0, grantedPoints: 0, capped: true, message: '今日分享奖励已达上限' };
    }
    const expR = applyExpGain(userId, SHARE_EXP, 'share', payload.shareId || '', { type });
    const ptR = applyPointsGain(userId, SHARE_PTS, 'share', payload.shareId || '', '分享小程序');
    grantedExp = expR.granted || 0;
    grantedPoints = ptR.granted || 0;
    capped = !!(expR.capped || ptR.capped);
    db.prepare(
      `INSERT INTO share_events (user_id, event_type, share_id, meta) VALUES (?, 'share', ?, ?)`
    ).run(userId, payload.shareId || '', JSON.stringify(payload));
  } else if (type === 'click') {
    const clickerId = String(payload.targetUserId || '').trim();
    if (!clickerId || clickerId === userId) {
      return { grantedExp: 0, grantedPoints: 0, capped: true, message: '无效点击' };
    }
    const dwell = Number(payload.dwellSeconds) || 0;
    if (dwell > 0 && dwell < 5) {
      return { grantedExp: 0, grantedPoints: 0, capped: true, message: '停留时长不足' };
    }
    if (countTodayEvents(userId, 'click') >= CLICK_DAILY_MAX) {
      return { grantedExp: 0, grantedPoints: 0, capped: true, message: '今日点击奖励已达上限' };
    }
    if (countWeeklyClickPair(userId, clickerId) >= 1) {
      return { grantedExp: 0, grantedPoints: 0, capped: true, message: '同好友本周已计奖励' };
    }
    const mult = brandClickMultiplier(user);
    const baseExp = Math.floor(CLICK_EXP * mult);
    const basePts = Math.floor(CLICK_PTS * mult);
    const expR = applyExpGain(userId, baseExp, 'share_click', clickerId, { type, mult });
    const ptR = applyPointsGain(userId, basePts, 'share_click', clickerId, '好友点击分享');
    grantedExp = expR.granted || 0;
    grantedPoints = ptR.granted || 0;
    capped = !!(expR.capped || ptR.capped);
    db.prepare(
      `INSERT INTO share_events (user_id, event_type, share_id, actor_user_id, meta)
       VALUES (?, 'click', ?, ?, ?)`
    ).run(userId, payload.shareId || '', clickerId, JSON.stringify(payload));
  } else if (type === 'register') {
    const newUserId = String(payload.targetUserId || '').trim();
    if (!newUserId) {
      return { grantedExp: 0, grantedPoints: 0, capped: true, message: '无效拉新' };
    }
    const exists = db.prepare(
      `SELECT id FROM share_events WHERE event_type = 'register' AND actor_user_id = ? LIMIT 1`
    ).get(newUserId);
    if (exists) {
      return { grantedExp: 0, grantedPoints: 0, capped: true, message: '该用户拉新已计奖' };
    }
    const mult = brandRegisterMultiplier(user);
    const baseExp = Math.floor(REGISTER_EXP * mult);
    const basePts = Math.floor(REGISTER_PTS * mult);
    const expR = applyExpGain(userId, baseExp, 'register', newUserId, { type, mult }, { excludeFromDailyCap: true });
    const ptR = applyPointsGain(userId, basePts, 'register', newUserId, '分享带来新注册');
    grantedExp = expR.granted || 0;
    grantedPoints = ptR.granted || 0;
    db.prepare(
      `INSERT INTO share_events (user_id, event_type, actor_user_id, ref_user_id, meta)
       VALUES (?, 'register', ?, ?, ?)`
    ).run(userId, newUserId, payload.shareId || '', JSON.stringify(payload));
  } else {
    return { grantedExp: 0, grantedPoints: 0, capped: true, message: '未知类型' };
  }

  return { grantedExp, grantedPoints, capped, message, coefficient: resolveGrowthCoefficient(user).coefficient };
}

module.exports = { reportShareEvent, ensureShareTables };
