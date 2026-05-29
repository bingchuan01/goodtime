/**

 * 会员等级与有效期（小程序端）

 */

const auth = require('./auth');



const TRIAL_LEVEL = '体验者';



function getMemberLevel(userInfo) {

  const u = userInfo || auth.getUserInfo() || {};

  return u.member_level || u.memberLevel || '';

}



function parseExpireTime(userInfo) {

  const u = userInfo || auth.getUserInfo() || {};

  const raw = u.member_expire_time || u.memberExpireTime;

  if (!raw) return null;

  const str = String(raw).trim();

  const t = new Date(str.includes('T') ? str : str.replace(' ', 'T'));

  return isNaN(t.getTime()) ? null : t;

}



function isPaidMemberLevel(level) {

  return level === 'V6' || level === 'V8';

}



function isTrialMemberLevel(level) {

  return level === TRIAL_LEVEL;

}



function isExpireTimePast(userInfo) {

  const u = userInfo || auth.getUserInfo() || {};

  const exp = parseExpireTime(u);

  if (!exp) return false;

  return exp.getTime() < Date.now();

}



function isMemberExpired(userInfo) {

  const level = getMemberLevel(userInfo);

  if (!isPaidMemberLevel(level) && !isTrialMemberLevel(level)) return false;

  return isExpireTimePast(userInfo);

}



/** 在有效期内且等级为 V6/V8 */

function isActivePaidMember(userInfo) {

  const level = getMemberLevel(userInfo);

  if (!isPaidMemberLevel(level)) return false;

  return !isExpireTimePast(userInfo);

}



/** 体验者在有效期内（仅发布，非 V6 会员） */

function isActiveTrialMember(userInfo) {

  const level = getMemberLevel(userInfo);

  if (!isTrialMemberLevel(level)) return false;

  return !isExpireTimePast(userInfo);

}



function formatExpireDate(userInfo) {

  const exp = parseExpireTime(userInfo);

  if (!exp) return '';

  return `${exp.getFullYear()}-${String(exp.getMonth() + 1).padStart(2, '0')}-${String(exp.getDate()).padStart(2, '0')}`;

}



function checkPublishAccess(userInfo) {

  const u = userInfo || auth.getUserInfo() || {};

  const level = getMemberLevel(u);

  if (isActivePaidMember(u)) {

    return { ok: true, reason: 'ok', memberLevel: level };

  }

  if (isActiveTrialMember(u)) {

    return { ok: true, reason: 'ok', memberLevel: TRIAL_LEVEL };

  }

  if (isExpireTimePast(u) && (isPaidMemberLevel(level) || isTrialMemberLevel(level))) {

    return { ok: false, reason: 'expired', memberLevel: level };

  }

  return { ok: false, reason: 'no_member', memberLevel: level };

}



function showPublishBlockedModal(reason, onDone) {

  const done =

    typeof onDone === 'function'

      ? onDone

      : () => {

          wx.switchTab({ url: '/pages/index/index' });

        };

  if (reason === 'expired') {

    wx.showModal({

      title: '资格已到期',

      content: '您的会员或体验资格已到期，续费后可继续发布项目。',

      confirmText: '去开通',

      cancelText: '返回',

      success: (res) => {

        if (res.confirm) {

          wx.navigateTo({ url: '/pages/member/upgrade/upgrade' });

        } else {

          done();

        }

      }

    });

    return;

  }

  wx.showModal({

    title: '提示',

    content: '发布项目需先登录，并开通会员或购买优惠体验卡。',

    confirmText: '去开通',

    cancelText: '返回',

    success: (res) => {

      if (res.confirm) {

        wx.navigateTo({ url: '/pages/member/upgrade/upgrade' });

      } else {

        done();

      }

    }

  });

}



/** WXSS 类名仅支持 ASCII，「体验者」映射为 trial */
function getMemberBadgeClass(level) {
  const l = String(level || '').trim();
  if (l === TRIAL_LEVEL) return 'trial';
  return l;
}

module.exports = {

  TRIAL_LEVEL,

  getMemberBadgeClass,

  getMemberLevel,

  parseExpireTime,

  isPaidMemberLevel,

  isTrialMemberLevel,

  isExpireTimePast,

  isMemberExpired,

  isActivePaidMember,

  isActiveTrialMember,

  formatExpireDate,

  checkPublishAccess,

  showPublishBlockedModal

};

