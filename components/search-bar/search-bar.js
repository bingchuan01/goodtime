// search-bar.js
Component({
  properties: {
    placeholder: {
      type: String,
      value: '种草品牌从此刻开始'
    }
  },
  data: {
    showIcon: true
  },
  methods: {
    onSearchTap() {
      this.triggerEvent('search', {})
      // 跳转到搜索页面
      wx.navigateTo({
        url: '/pages/search/search'
      })
    },
    onIconError() {
      this.setData({
        showIcon: false
      })
    }
  }
})
