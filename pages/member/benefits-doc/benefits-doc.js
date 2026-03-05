// 权益说明页（从后台配置拉取）
const api = require('../../../utils/api');

Page({
  data: {
    content: ''
  },

  onLoad() {
    api.getConfig('benefits_doc').then(content => {
      this.setData({
        content: (typeof content === 'string' && content) ? content : '<p>会员权益说明由官方后台编辑维护。</p>'
      });
    }).catch(() => {
      this.setData({ content: '<p>会员权益说明由官方后台编辑维护。</p>' });
    });
  }
});
