/** Sv1～Sv13 阈值与展示期（v1.1 · 满级 26000） */

const SV_THRESHOLDS = [0, 50, 150, 350, 600, 1000, 1600, 2400, 4200, 6800, 10000, 16800, 26000];

const SV_NAMES = [
  'Sv1', 'Sv2', 'Sv3', 'Sv4', 'Sv5', 'Sv6', 'Sv7', 'Sv8', 'Sv9', 'Sv10', 'Sv11', 'Sv12', 'Sv13'
];

const SV_BADGES = [
  '', '', '', '', '', '铜质·启程者', '银质·分享家', '金质·引领者', '铂金·催化师',
  '钻石·破局者', '星耀·生态官', '王者·共建者', '传奇·缔造者'
];

/** 累计展示天数（发布后达到该 Sv 时的总展示期，cap 365） */
const DISPLAY_DAYS_BY_SV = {
  1: 0, 2: 0, 3: 0, 4: 30, 5: 45, 6: 75, 7: 105, 8: 135, 9: 165,
  10: 195, 11: 255, 12: 315, 13: 365
};

const SV_POINTS_BONUS = [
  0, 0, 0.05, 0.05, 0.05, 0.10, 0.10, 0.10, 0.15, 0.15, 0.15, 0.20, 0.20
];

function expToSvLevel(totalExp) {
  const exp = Math.max(0, Number(totalExp) || 0);
  let level = 1;
  for (let i = SV_THRESHOLDS.length - 1; i >= 0; i--) {
    if (exp >= SV_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return level;
}

function getSvInfo(totalExp) {
  const level = expToSvLevel(totalExp);
  const idx = level - 1;
  const requiredExp = SV_THRESHOLDS[idx];
  const nextLevelExp = level < SV_THRESHOLDS.length ? SV_THRESHOLDS[level] : null;
  const expToNext = nextLevelExp != null ? Math.max(0, nextLevelExp - totalExp) : 0;
  return {
    svLevel: level,
    svName: SV_NAMES[idx] || 'Sv1',
    badge: SV_BADGES[idx] || '',
    requiredExp,
    nextLevelExp,
    expToNext,
    isMaxLevel: level >= SV_THRESHOLDS.length
  };
}

function getDisplayDaysForSv(svLevel) {
  const lv = Math.max(1, Math.min(13, Number(svLevel) || 1));
  return DISPLAY_DAYS_BY_SV[lv] || 30;
}

function getSvPointsBonusRate(svLevel) {
  const idx = Math.max(0, Math.min(SV_POINTS_BONUS.length - 1, (Number(svLevel) || 1) - 1));
  return SV_POINTS_BONUS[idx] || 0;
}

function getLevelsConfig() {
  return SV_THRESHOLDS.map((requiredExp, i) => ({
    level: i + 1,
    name: SV_NAMES[i],
    requiredExp,
    badge: SV_BADGES[i] || '',
    displayDays: DISPLAY_DAYS_BY_SV[i + 1] || 0
  }));
}

module.exports = {
  SV_THRESHOLDS,
  expToSvLevel,
  getSvInfo,
  getDisplayDaysForSv,
  getSvPointsBonusRate,
  getLevelsConfig
};
