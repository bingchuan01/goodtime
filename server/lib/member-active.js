/**

 * 会员与体验者：V6/V8 为付费会员；「体验者」为优惠体验卡身份，仅含发布能力。

 * 到期后自动清空 member_level，保留 member_expire_time 供展示与续费叠加。

 */

const { db } = require('../db');



const CLEARED_MEMBER_LEVEL = '';

const TRIAL_MEMBER_LEVEL = '体验者';



function parseExpireTime(iso) {

  if (!iso) return null;

  const raw = String(iso).trim();

  if (!raw) return null;

  const t = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));

  return isNaN(t.getTime()) ? null : t;

}



function isPaidMemberLevel(level) {

  const lvl = String(level || '').trim();

  return lvl === 'V6' || lvl === 'V8';

}



function isTrialMemberLevel(level) {

  return String(level || '').trim() === TRIAL_MEMBER_LEVEL;

}



function isKnownMemberLevel(level) {

  return isPaidMemberLevel(level) || isTrialMemberLevel(level);

}



function isExpireTimePast(expireIso) {

  const exp = parseExpireTime(expireIso);

  if (!exp) return false;

  return exp.getTime() < Date.now();

}



function isMemberActive(user) {

  if (!user) return false;

  const level = user.member_level || '';

  if (!isPaidMemberLevel(level)) return false;

  const exp = parseExpireTime(user.member_expire_time);

  if (!exp) return true;

  return exp.getTime() >= Date.now();

}



function isTrialMemberActive(user) {

  if (!user) return false;

  if (!isTrialMemberLevel(user.member_level)) return false;

  const exp = parseExpireTime(user.member_expire_time);

  if (!exp) return true;

  return exp.getTime() >= Date.now();

}



/** 是否可发布项目（V6/V8 有效期内，或体验者在有效期内） */

function canPublish(user) {

  if (!user) return false;

  if (isPaidMemberLevel(user.member_level) && isMemberActive(user)) return true;

  if (isTrialMemberLevel(user.member_level) && isTrialMemberActive(user)) return true;

  return false;

}



function shouldClearExpiredLevel(user) {

  if (!user || !isKnownMemberLevel(user.member_level)) return false;

  return isExpireTimePast(user.member_expire_time);

}



function reconcileExpiredMembership(userId) {

  if (!userId) return { cleared: false };

  const user = db.prepare('SELECT id, member_level, member_expire_time FROM users WHERE id = ?').get(userId);

  if (!shouldClearExpiredLevel(user)) return { cleared: false };

  db.prepare('UPDATE users SET member_level = ? WHERE id = ?').run(CLEARED_MEMBER_LEVEL, userId);

  return { cleared: true };

}



function reconcileAllExpiredMemberships() {

  const rows = db

    .prepare(

      `SELECT id FROM users

       WHERE member_level IN ('V6', 'V8', ?)

         AND member_expire_time IS NOT NULL

         AND trim(member_expire_time) != ''`

    )

    .all(TRIAL_MEMBER_LEVEL);

  let cleared = 0;

  for (const row of rows) {

    const r = reconcileExpiredMembership(row.id);

    if (r.cleared) cleared += 1;

  }

  if (cleared > 0) {

    console.log(`[member] 已自动降级到期会员/体验者 ${cleared} 人`);

  }

  return cleared;

}



function getPublishBlockMessage(userId) {

  reconcileExpiredMembership(userId);

  const user = db.prepare('SELECT id, member_level, member_expire_time, phone FROM users WHERE id = ?').get(userId);

  if (!user || !isKnownMemberLevel(user.member_level)) {

    return '发布项目需开通会员或购买优惠体验卡';

  }

  if (!canPublish(user)) {

    if (isTrialMemberLevel(user.member_level)) {

      return '体验资格已到期，可续费体验或开通正式会员';

    }

    return '会员已到期，续费后可继续发布项目';

  }

  const { getPublishCountBlockMessage } = require('./growth/publish-eligibility');

  const countBlock = getPublishCountBlockMessage(user);

  if (countBlock) return countBlock;

  return null;

}



module.exports = {

  CLEARED_MEMBER_LEVEL,

  TRIAL_MEMBER_LEVEL,

  parseExpireTime,

  isPaidMemberLevel,

  isTrialMemberLevel,

  isKnownMemberLevel,

  isExpireTimePast,

  shouldClearExpiredLevel,

  isMemberActive,

  isTrialMemberActive,

  canPublish,

  reconcileExpiredMembership,

  reconcileAllExpiredMemberships,

  getPublishBlockMessage

};

