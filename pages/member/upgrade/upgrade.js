// 支付页：V6/V8（划线原价）+ 优惠体验卡（已优惠价+倒计时，开通为「体验者」）
const api = require('../../../utils/api');
const auth = require('../../../utils/auth');

const DEFAULT_PLANS = [
  { id: 'v6', name: 'V6', price: 598, originalPrice: 998, days: 365 },
  { id: 'v8', name: 'V8', price: 21980, originalPrice: 29980, days: 365 }
];

const DEFAULT_TRIAL = {
  enabled: true,
  name: '优惠体验',
  badgeText: '限时体验',
  subtitle: '体验期内可发布项目',
  price: 99,
  originalPrice: 598,
  days: 30,
  promoEndAt: '',
  backgroundImage: '',
  illustrationImage: ''
};

function normalizePlans(list) {
  return (list || []).map((p) => ({
    id: p.id,
    name: p.name || p.id,
    price: typeof p.price === 'number' ? p.price : Number(p.price) || 0,
    originalPrice:
      typeof p.originalPrice === 'number'
        ? p.originalPrice
        : Number(p.originalPrice != null ? p.originalPrice : p.original_price) || 0,
    days: typeof p.days === 'number' ? p.days : Number(p.days) || 365
  }));
}

function normalizeTrial(t) {
  const src = t && typeof t === 'object' ? t : DEFAULT_TRIAL;
  const enabled = src.enabled !== false && src.enabled !== 0 && src.enabled !== '0';
  const price = typeof src.price === 'number' ? src.price : Number(src.price) || DEFAULT_TRIAL.price;
  const originalPrice =
    typeof src.originalPrice === 'number'
      ? src.originalPrice
      : Number(src.originalPrice != null ? src.originalPrice : src.original_price) ||
        DEFAULT_TRIAL.originalPrice;
  const days = typeof src.days === 'number' ? src.days : Number(src.days) || DEFAULT_TRIAL.days;
  const savedAmount = Math.max(0, Math.round(originalPrice - price));
  return {
    enabled,
    name: src.name || DEFAULT_TRIAL.name,
    badgeText: src.badgeText || src.badge_text || DEFAULT_TRIAL.badgeText,
    subtitle: src.subtitle || DEFAULT_TRIAL.subtitle,
    price,
    originalPrice,
    savedAmount,
    days,
    promoEndAt: src.promoEndAt || src.promo_end_at || '',
    backgroundImage: src.backgroundImage || src.background_image || '',
    illustrationImage:
      src.illustrationImage || src.illustration_image || src.backgroundImage || src.background_image || ''
  };
}

function isPromoActive(promoEndAt) {
  if (!promoEndAt || !String(promoEndAt).trim()) return true;
  const raw = String(promoEndAt).trim();
  const t = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
  if (isNaN(t.getTime())) return true;
  return t.getTime() >= Date.now();
}

/** 解析活动结束时间 */
function parsePromoEnd(promoEndAt) {
  if (!promoEndAt || !String(promoEndAt).trim()) return null;
  const raw = String(promoEndAt).trim();
  const end = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T'));
  return isNaN(end.getTime()) ? null : end;
}

/** 优惠倒计时：统一为「仅剩X天X时」 */
function formatPromoCountdown(promoEndAt) {
  const end = parsePromoEnd(promoEndAt);
  if (!end) return { ended: false, text: '' };
  const diff = end.getTime() - Date.now();
  if (diff <= 0) return { ended: true, text: '' };
  const dayMs = 24 * 60 * 60 * 1000;
  const hourMs = 60 * 60 * 1000;
  const d = Math.floor(diff / dayMs);
  const h = Math.floor((diff % dayMs) / hourMs);
  return { ended: false, text: `仅剩${d}天${h}时` };
}

Page({
  data: {
    plans: DEFAULT_PLANS,
    trial: null,
    trialVisible: false,
    trialCountdownText: '',
    trialShowCountdown: false,
    selectedPlan: 'v6',
    payAmount: 598,
    selectedDays: 365,
    paymentType: 'wechat',
    agreed: false,
    purchaseNotice:
      '<p>1. 会员有效期为自开通之日起计算。</p><p>2. 体验卡开通为「体验者」，体验期内可发布项目。</p><p>3. 如有疑问请联系客服。</p>'
  },

  onLoad() {
    api
      .getConfig('purchase_notice')
      .then((content) => {
        if (typeof content === 'string' && content) {
          this.setData({ purchaseNotice: content });
        }
      })
      .catch(() => {});

    this._loadCatalog();
  },

  onUnload() {
    if (this._trialTimer) {
      clearInterval(this._trialTimer);
      this._trialTimer = null;
    }
  },

  async _loadCatalog() {
    let plans = DEFAULT_PLANS;
    let trialRaw = DEFAULT_TRIAL;

    try {
      const res = await api.getMemberCatalog(true);
      if (res) {
        if (Array.isArray(res.plans)) plans = res.plans;
        else if (Array.isArray(res)) plans = res;
        if (res.trial) trialRaw = res.trial;
      }
    } catch (e) {
      /* 线上未部署 catalog 时走 config 兜底 */
    }

    if (!trialRaw || trialRaw === DEFAULT_TRIAL) {
      try {
        const [pCfg, tCfg] = await Promise.all([
          api.getConfig('member_plans').catch(() => null),
          api.getConfig('member_trial').catch(() => null)
        ]);
        if (Array.isArray(pCfg) && pCfg.length) plans = pCfg;
        if (tCfg && typeof tCfg === 'object') trialRaw = tCfg;
      } catch (e2) {
        /* ignore */
      }
    }

    const list = normalizePlans(plans);
    const trial = normalizeTrial(trialRaw);
    const trialVisible = trial.enabled && isPromoActive(trial.promoEndAt);
    const finalPlans = list.length > 0 ? list : DEFAULT_PLANS;

    let selectedPlan = 'v6';
    let payAmount = finalPlans[0].price;
    let selectedDays = finalPlans[0].days;
    if (trialVisible) {
      selectedPlan = 'trial';
      payAmount = trial.price;
      selectedDays = trial.days;
    }

    this.setData({
      plans: finalPlans,
      trial,
      trialVisible,
      trialCountdownText: trialVisible ? formatPromoCountdown(trial.promoEndAt).text : '',
      trialShowCountdown: trialVisible && !!parsePromoEnd(trial.promoEndAt),
      selectedPlan,
      payAmount,
      selectedDays
    });

    if (trialVisible && parsePromoEnd(trial.promoEndAt)) {
      this._startTrialCountdown();
    }
  },

  _startTrialCountdown() {
    if (this._trialTimer) clearInterval(this._trialTimer);
    const tick = () => {
      const trial = this.data.trial;
      if (!trial || !trial.promoEndAt) return;
      const { ended, text } = formatPromoCountdown(trial.promoEndAt);
      if (ended) {
        this.setData({ trialVisible: false, trialCountdownText: '', trialShowCountdown: false });
        clearInterval(this._trialTimer);
        if (this.data.selectedPlan === 'trial') {
          const first = (this.data.plans || [])[0];
          if (first) {
            this.setData({
              selectedPlan: first.id,
              payAmount: first.price,
              selectedDays: first.days
            });
          }
        }
        return;
      }
      this.setData({ trialCountdownText: text, trialShowCountdown: !!text });
    };
    tick();
    // 按天+小时展示，每分钟刷新即可
    this._trialTimer = setInterval(tick, 60000);
  },

  onSelectPlan(e) {
    const planId = e.currentTarget.dataset.plan;
    if (planId === 'trial') {
      const trial = this.data.trial;
      if (!trial || !trial.enabled || !isPromoActive(trial.promoEndAt)) {
        wx.showToast({ title: '体验活动已结束', icon: 'none' });
        return;
      }
      this.setData({
        selectedPlan: 'trial',
        payAmount: trial.price,
        selectedDays: trial.days
      });
      return;
    }
    const plan = (this.data.plans || []).find((p) => p.id === planId);
    if (!plan) return;
    this.setData({
      selectedPlan: planId,
      payAmount: plan.price,
      selectedDays: plan.days
    });
  },

  onSelectPayment(e) {
    this.setData({ paymentType: e.currentTarget.dataset.type });
  },

  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed });
  },

  goBenefitsDoc() {
    wx.navigateTo({ url: '/pages/member/benefits-doc/benefits-doc' });
  },

  goAgreement() {
    wx.navigateTo({ url: '/pages/member/agreement/agreement' });
  },

  onConfirmPay() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意会员服务协议', icon: 'none' });
      return;
    }
    if (!auth.checkLogin()) {
      auth.requireLogin();
      return;
    }
    const { selectedPlan, payAmount, selectedDays } = this.data;
    if (selectedPlan === 'v8') {
      wx.showToast({ title: '需联系平台开通', icon: 'none' });
      return;
    }
    if (selectedPlan === 'trial') {
      const trial = this.data.trial;
      if (!trial || !trial.enabled || !isPromoActive(trial.promoEndAt)) {
        wx.showToast({ title: '体验活动已结束', icon: 'none' });
        return;
      }
    }
    const plans = this.data.plans || [];
    const planInfo =
      selectedPlan === 'trial'
        ? this.data.trial || { name: '优惠体验', days: selectedDays }
        : plans.find((p) => p.id === selectedPlan) || { name: selectedPlan, days: selectedDays };
    const that = this;
    wx.showModal({
      title: '确认支付',
      content: `确认支付 ¥${payAmount} 开通${planInfo.name}（${selectedDays}天）？`,
      success(res) {
        if (res.confirm && that && typeof that.doPay === 'function') {
          that.doPay();
        }
      }
    });
  },

  async doPay() {
    const { paymentType, selectedPlan } = this.data;
    if (paymentType !== 'wechat') {
      wx.showToast({ title: '请使用微信支付', icon: 'none' });
      return;
    }
    try {
      wx.showLoading({ title: '创建订单...' });
      const res = await api.createMemberOrder(selectedPlan);
      wx.hideLoading();
      const payment = res && res.payment;
      if (payment && payment.timeStamp && payment.nonceStr && payment.package && payment.signType && payment.paySign) {
        wx.requestPayment({
          ...payment,
          success: () => {
            void (async () => {
              const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
              for (let i = 0; i < 6; i++) {
                try {
                  const u = await api.getUserInfo();
                  const lvl = (u && (u.member_level || u.memberLevel)) || '';
                  if (lvl === 'V6' || lvl === 'V8' || lvl === '体验者') {
                    const prev = wx.getStorageSync('userInfo') || {};
                    wx.setStorageSync('userInfo', { ...prev, ...u });
                    break;
                  }
                } catch (e) {
                  /* ignore */
                }
                await sleep(500);
              }
              try {
                await api.reconcileMemberOrder();
              } catch (e) {
                /* ignore */
              }
              try {
                await auth.refreshUserInfo();
              } catch (e) {
                /* ignore */
              }
              wx.showToast({ title: '支付成功', icon: 'success' });
              setTimeout(() => wx.navigateBack(), 1200);
            })();
          },
          fail: (err) => {
            if (err.errMsg && !err.errMsg.includes('cancel')) {
              wx.showToast({ title: '支付失败', icon: 'none' });
            }
          }
        });
      } else {
        wx.showToast({
          title: '订单已创建，支付需配置微信支付',
          icon: 'none'
        });
      }
    } catch (e) {
      wx.hideLoading();
    }
  }
});
