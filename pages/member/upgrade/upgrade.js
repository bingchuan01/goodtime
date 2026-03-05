// 支付页：开通会员（选择支付方式、确认协议并支付）
const api = require('../../../utils/api');

const PLANS = {
  v6: { price: 598, name: 'V6', days: 365 },
  v8: { price: 21980, name: 'V8', days: 365 }
};

Page({
  data: {
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
  },

  onSelectPlan(e) {
    const plan = e.currentTarget.dataset.plan;
    if (!plan || !PLANS[plan]) return;
    this.setData({
      selectedPlan: plan,
      payAmount: PLANS[plan].price
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
    const { payAmount, paymentType } = this.data;
    const planInfo = PLANS[selectedPlan];
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
