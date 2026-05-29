const { ensureSurgePoolCurrent, currentPoolMonth } = require('./surge-pool');

let lastCheckDay = '';

function runSurgePoolDailyCheck() {
  const now = new Date();
  const dayKey = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  if (dayKey === lastCheckDay) return;
  lastCheckDay = dayKey;
  try {
    if (now.getDate() === 1) {
      ensureSurgePoolCurrent();
      console.log('[surge-pool] monthly recompute on day 1:', currentPoolMonth());
    }
  } catch (e) {
    console.warn('[surge-pool] daily check failed:', e.message);
  }
}

function startSurgePoolScheduler() {
  runSurgePoolDailyCheck();
  setInterval(runSurgePoolDailyCheck, 60 * 60 * 1000);
}

module.exports = { startSurgePoolScheduler, runSurgePoolDailyCheck };
