const THRESHOLD = 15;

function formatCount(n) {
  const v = Number(n) || 0;
  if (v >= 10000) {
    const wan = v / 10000;
    return (wan >= 10 ? Math.round(wan) : wan.toFixed(1).replace(/\.0$/, '')) + '万';
  }
  if (v >= 1000) {
    const qian = v / 1000;
    return (qian >= 10 ? Math.round(qian) : qian.toFixed(1).replace(/\.0$/, '')) + '千';
  }
  return String(v);
}

const LABELS = {
  consult: (n) => `${formatCount(n)}人咨询`,
  favorite: (n) => `${formatCount(n)}收藏`,
  share: (n) => `${formatCount(n)}分享`,
  view: (n) => `${formatCount(n)}观看`
};

const PRIORITY = { share: 4, favorite: 3, consult: 2, view: 1 };

function pickCardAlgoTag(isInSurgePool, stats) {
  if (isInSurgePool) {
    return { type: 'surge', label: '热度飙升' };
  }
  const s = stats || {};
  const candidates = ['share', 'favorite', 'consult', 'view']
    .map((type) => ({ type, value: Number(s[type]) || 0 }))
    .filter((c) => c.value >= THRESHOLD)
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return (PRIORITY[b.type] || 0) - (PRIORITY[a.type] || 0);
    });
  if (!candidates.length) return null;
  const top = candidates[0];
  return { type: top.type, label: LABELS[top.type](top.value), value: top.value };
}

function buildDetailAlgoTags(isInSurgePool, stats) {
  const tags = [];
  if (isInSurgePool) {
    tags.push({ type: 'surge', label: '热度飙升' });
  }
  const s = stats || {};
  ['consult', 'favorite', 'share', 'view'].forEach((type) => {
    const value = Number(s[type]) || 0;
    if (value >= THRESHOLD) {
      tags.push({ type, label: LABELS[type](value), value });
    }
  });
  return tags;
}

module.exports = {
  THRESHOLD,
  formatCount,
  pickCardAlgoTag,
  buildDetailAlgoTags
};
