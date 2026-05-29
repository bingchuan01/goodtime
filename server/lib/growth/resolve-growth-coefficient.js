const { isMemberActive, isTrialMemberLevel } = require('../member-active');

/** 标签 → 经验系数（P1 扩展；P0 仅会员 1.2 / 默认 1.0） */
const TAG_COEFFICIENTS = {
  SP: 1.3,
  OP: 1.3,
  服务商: 1.3,
  机构服务商: 1.3,
  OPC: 1.3,
  品牌方: 1.2,
  V6: 1.2,
  V8: 1.2
};

function resolveGrowthCoefficient(user) {
  if (!user) return { coefficient: 1.0, key: 'default' };

  const level = String(user.member_level || '').trim();
  if (isTrialMemberLevel(level)) {
    return { coefficient: 1.0, key: 'trial' };
  }

  let coef = 1.0;
  let key = 'default';

  if (isMemberActive(user)) {
    coef = 1.2;
    key = 'member';
  }

  const tag = String(user.identity_tag || '').trim();
  if (tag && TAG_COEFFICIENTS[tag] != null) {
    const tagCoef = TAG_COEFFICIENTS[tag];
    if (tagCoef > coef) {
      coef = tagCoef;
      key = 'tag_' + tag;
    }
  }

  return { coefficient: coef, key };
}

module.exports = { resolveGrowthCoefficient, TAG_COEFFICIENTS };
