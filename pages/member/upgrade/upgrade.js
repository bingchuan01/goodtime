// 支付页：开通会员（选择支付方式、确认协议并支付）；价格从接口获取，支持后台自由调整
const api = require('../../../utils/api');

const DEFAULT_PLANS = [
  { id: 'v6', name: 'V6', price: 598, days: 365 },
  { id: 'v8', name: 'V8', price: 21980, days: 365 }
];

Page({
  data: {
    plans: DEFAULT_PLANS,
    selectedPlan: 'v6',
    payAmount: 598,
    paymentType: 'wechat',
    agreed: false,
    purchaseNotice: '<p>1. 会员有效期为自开通之日起365天。</p><p>2. 会员权益具体以平台公示为准。</p><p>3. 如有疑问请联系客服。</p>'
  },

  onLoad() {
    api.getConfig('purchase_notice').then(content => {
      if (typeof content === 'string' && content) {
        this.setData({ purchaseNotice: content });
      }
    }).catch(() => {});

    api.getMemberLevels().then(res => {
      const list = (res && res.data && Array.isArray(res.data)) ? res.data : DEFAULT_PLANS;
      if (list.length === 0) return;
      const plans = list.map(p => ({
        id: p.id,
        name: p.name || p.id,
        price: typeof p.price === 'number' ? p.price : Number(p.price) || 0,
        days: typeof p.days === 'number' ? p.days : Number(p.days) || 365
      }));
      const first = plans[0];
      this.setData({
        plans,
        selectedPlan: first.id,
        payAmount: first.price
      });
    }).catch(() => {});
  },

  onSelectPlan(e) {
    const planId = e.currentTarget.dataset.plan;
    const plans = this.data.plans || [];
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;
    this.setData({
      selectedPlan: planId,
      payAmount: plan.price
    });
  },

  onSelectPayment(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ paymentType: type });
  },

  toggleAgreement() {
    this.setData({ agreed: !this.data.agreed });
  },

  goBenefitsDoc() {
    wx.navigateTo({
      url: '/pages/member/benefits-doc/benefits-doc'
    });
  },

  goAgreement() {
    wx.navigateTo({
      url: '/pages/member/agreement/agreement'
    });
  },

  onConfirmPay() {
    if (!this.data.agreed) {
      wx.showToast({ title: '请先阅读并同意会员服务协议', icon: 'none' });
      return;
    }
    const { selectedPlan } = this.data;
    // V8 需联系平台开通，不进入支付流程
    if (selectedPlan === 'v8') {
      wx.showToast({ title: '需联系平台开通', icon: 'none' });
      return;
    }
    const { payAmount, paymentType, plans } = this.data;
    const planInfo = (plans || []).find(p => p.id === selectedPlan) || { name: selectedPlan, days: 365 };
    const that = this;
    wx.showModal({
      title: '确认支付',
      content: `确认支付 ¥${payAmount} 开通${planInfo.name}会员（365天）？`,
      success(res) {
        if (res.confirm && that && typeof that.doPay === 'function') {
          that.doPay();
        }
      }
    });
  },

  async doPay() {
    const { paymentType, selectedPlan, payAmount } = this.data;
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
            wx.showToast({ title: '支付成功', icon: 'success' });
            setTimeout(() => wx.navigateBack(), 1500);
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
