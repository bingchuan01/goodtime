const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { isMemberActive } = require('../lib/member-active');
const { getLevelsConfig } = require('../lib/growth/sv-levels');
const {
  todayStr,
  yearMonthStr,
  applyExpGain,
  applyPointsGain,
  deductPoints,
  getGrowthSummary,
  DAILY_EXP_CAP,
  DAILY_POINTS_CAP
} = require('../lib/growth/grant-exp-points');
const { getPublishEligibility } = require('../lib/growth/publish-eligibility');

function getStreak(userId) {
  let row = db.prepare('SELECT * FROM growth_streaks WHERE user_id = ?').get(userId);
  if (!row) {
    db.prepare(
      'INSERT INTO growth_streaks (user_id, current_streak, longest_streak) VALUES (?, 0, 0)'
    ).run(userId);
    row = { current_streak: 0, longest_streak: 0, last_checkin_date: '' };
  }
  return row;
}

function updateStreak(userId, checkinDate) {
  const streak = getStreak(userId);
  const last = streak.last_checkin_date || '';
  let current = Number(streak.current_streak) || 0;
  if (last) {
    const lastD = new Date(last + 'T00:00:00');
    const curD = new Date(checkinDate + 'T00:00:00');
    const diffDays = Math.round((curD - lastD) / 86400000);
    if (diffDays === 1) {
      current += 1;
    } else if (diffDays > 1) {
      current = 1;
    } else {
      current = Math.max(1, current);
    }
  } else {
    current = 1;
  }
  const longest = Math.max(Number(streak.longest_streak) || 0, current);
  db.prepare(
    `UPDATE growth_streaks SET current_streak = ?, longest_streak = ?, last_checkin_date = ? WHERE user_id = ?`
  ).run(current, longest, checkinDate, userId);
  return current;
}

function performCheckin(userId, checkinDate, isMakeup, skipTransaction) {
  const existing = db.prepare(
    'SELECT id FROM checkin_records WHERE user_id = ? AND checkin_date = ?'
  ).get(userId, checkinDate);
  if (existing) {
    return { alreadyCheckedIn: true };
  }

  const run = () => {
    let expGained = 0;
    let pointsGained = 0;
    let bonusExp = 0;
    let bonusPoints = 0;
    const streakDays = updateStreak(userId, checkinDate);
    const expResult = applyExpGain(userId, 5, isMakeup ? 'makeup' : 'checkin', checkinDate, { date: checkinDate });
    expGained = expResult.granted || 0;
    const ptResult = applyPointsGain(userId, 3, 'checkin', checkinDate, isMakeup ? '补签' : '每日签到');
    pointsGained = ptResult.granted || 0;

    if (streakDays > 0 && streakDays % 7 === 0) {
      const bonusExpR = applyExpGain(userId, 20, 'streak_bonus', checkinDate, { streakDays });
      bonusExp = bonusExpR.granted || 0;
      const bonusPtR = applyPointsGain(userId, 15, 'streak_bonus', checkinDate, '连续签到7天奖励');
      bonusPoints = bonusPtR.granted || 0;
    }

    db.prepare(
      `INSERT INTO checkin_records (user_id, checkin_date, is_makeup, exp_granted, points_granted)
       VALUES (?, ?, ?, ?, ?)`
    ).run(userId, checkinDate, isMakeup ? 1 : 0, expGained + bonusExp, pointsGained + bonusPoints);

    return {
      alreadyCheckedIn: false,
      expGained,
      pointsGained,
      bonusExp: bonusExp || undefined,
      bonusPoints: bonusPoints || undefined,
      streakDays
    };
  };

  if (skipTransaction) return run();
  return db.withTransaction(run);
}

function getMakeupQuota(userId, ym) {
  let row = db.prepare(
    'SELECT * FROM makeup_quota_monthly WHERE user_id = ? AND year_month = ?'
  ).get(userId, ym);
  if (!row) {
    db.prepare(
      'INSERT INTO makeup_quota_monthly (user_id, year_month, free_used, points_purchased) VALUES (?, ?, 0, 0)'
    ).run(userId, ym);
    row = { free_used: 0, points_purchased: 0 };
  }
  return row;
}

router.get('/summary', (req, res) => {
  try {
    const summary = getGrowthSummary(req.userId);
    const streak = getStreak(req.userId);
    res.json({
      code: 0,
      data: {
        ...summary,
        streakDays: Number(streak.current_streak) || 0,
        badges: summary.badge ? [summary.badge] : []
      },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取成长概览失败' });
  }
});

router.get('/levels', (req, res) => {
  res.json({ code: 0, data: getLevelsConfig(), message: 'ok' });
});

router.post('/checkin', (req, res) => {
  try {
    const userId = req.userId;
    const today = todayStr();
    const result = performCheckin(userId, today, false);
    if (result.alreadyCheckedIn) {
      return res.status(400).json({ code: 400, message: '今日签到已完成', data: { alreadyCheckedIn: true } });
    }
    res.json({ code: 0, data: result, message: '签到成功' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '签到失败' });
  }
});

router.post('/checkin/makeup', (req, res) => {
  try {
    const userId = req.userId;
    const date = String((req.body && req.body.date) || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ code: 400, message: '请提供有效日期 YYYY-MM-DD' });
    }
    if (date >= todayStr()) {
      return res.status(400).json({ code: 400, message: '只能补签过去日期' });
    }

    const existing = db.prepare(
      'SELECT id FROM checkin_records WHERE user_id = ? AND checkin_date = ?'
    ).get(userId, date);
    if (existing) {
      return res.status(400).json({ code: 400, message: '该日期已签到' });
    }

    const ym = date.slice(0, 7);
    const quota = getMakeupQuota(userId, ym);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    const paidMember = isMemberActive(user);
    let usedFree = false;
    let usedPoints = false;
    let result;

    db.withTransaction(() => {
      if (paidMember && (Number(quota.free_used) || 0) < 1) {
        db.prepare(
          'UPDATE makeup_quota_monthly SET free_used = 1 WHERE user_id = ? AND year_month = ?'
        ).run(userId, ym);
        usedFree = true;
      } else {
        const purchased = Number(quota.points_purchased) || 0;
        if (purchased >= 3) {
          const err = new Error('本月补签卡购买已达上限');
          err.code = 422;
          throw err;
        }
        const deduct = deductPoints(userId, 50, 'makeup', date, '补签消耗');
        if (!deduct.ok) {
          const err = new Error(deduct.message || '积分不足');
          err.code = 422;
          throw err;
        }
        db.prepare(
          'UPDATE makeup_quota_monthly SET points_purchased = points_purchased + 1 WHERE user_id = ? AND year_month = ?'
        ).run(userId, ym);
        usedPoints = true;
      }
      result = performCheckin(userId, date, true, true);
      if (result.alreadyCheckedIn) {
        const err = new Error('该日期已签到');
        err.code = 400;
        throw err;
      }
    });
    res.json({
      code: 0,
      data: { ...result, usedFree, usedPoints, costPoints: usedPoints ? 50 : 0 },
      message: '补签成功'
    });
  } catch (e) {
    if (e.code === 422) {
      return res.status(422).json({ code: 422, message: e.message });
    }
    console.error(e);
    res.status(500).json({ code: 500, message: e.message || '补签失败' });
  }
});

router.get('/checkin/calendar', (req, res) => {
  try {
    const userId = req.userId;
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || (now.getMonth() + 1);
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    const rows = db.prepare(
      `SELECT checkin_date, is_makeup FROM checkin_records
       WHERE user_id = ? AND checkin_date LIKE ? ORDER BY checkin_date`
    ).all(userId, prefix + '-%');
    res.json({
      code: 0,
      data: {
        year,
        month,
        dates: rows.map((r) => ({
          date: r.checkin_date,
          checked: true,
          makeup: !!r.is_makeup
        }))
      },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取日历失败' });
  }
});

router.get('/exp/ledger', (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;
    const rows = db.prepare(
      'SELECT * FROM exp_ledger WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?'
    ).all(req.userId, pageSize + 1, offset);
    const hasMore = rows.length > pageSize;
    res.json({
      code: 0,
      data: {
        list: rows.slice(0, pageSize).map((r) => ({
          id: r.id,
          delta: r.delta,
          action: r.action,
          refId: r.ref_id,
          coefficient: r.coefficient,
          createdAt: r.created_at
        })),
        hasMore
      },
      message: 'ok'
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取经验流水失败' });
  }
});

router.get('/publish-eligibility', (req, res) => {
  try {
    res.json({ code: 0, data: getPublishEligibility(req.userId), message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取发布资格失败' });
  }
});

router.get('/content-edit/pool', (req, res) => {
  try {
    const { getContentEditPoolSummary } = require('../lib/growth/content-edit-pool');
    res.json({ code: 0, data: getContentEditPoolSummary(req.userId), message: 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '获取改稿池失败' });
  }
});

router.post('/share/report', (req, res) => {
  try {
    const { reportShareEvent } = require('../lib/growth/share-report');
    const body = req.body || {};
    const type = String(body.type || '').trim();
    let beneficiaryId = req.userId;
    const payload = {
      type,
      shareId: body.shareId,
      dwellSeconds: body.dwellSeconds
    };

    if (type === 'click') {
      const sharerId = String(body.refUserId || body.fromUid || '').trim();
      if (!sharerId) {
        return res.status(400).json({ code: 400, message: '缺少分享者' });
      }
      beneficiaryId = sharerId;
      payload.targetUserId = req.userId;
    } else if (type === 'register') {
      const sharerId = String(body.refUserId || body.fromUid || '').trim();
      if (!sharerId) {
        return res.status(400).json({ code: 400, message: '缺少分享者' });
      }
      beneficiaryId = sharerId;
      payload.targetUserId = body.targetUserId || req.userId;
    } else if (type === 'share') {
      payload.targetUserId = body.targetUserId;
    } else {
      return res.status(400).json({ code: 400, message: '未知上报类型' });
    }

    const result = reportShareEvent(beneficiaryId, payload);
    res.json({ code: 0, data: result, message: result.message || 'ok' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ code: 500, message: '上报失败' });
  }
});

module.exports = router;
