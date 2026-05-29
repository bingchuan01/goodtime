// header-logo.js
Component({
  properties: {
    logoUrl: {
      type: String,
      value: ''
    },
    inNav: {
      type: Boolean,
      value: false
    },
    /** default 常规 | home 首页顶栏（更大、无底部分隔线） */
    variant: {
      type: String,
      value: 'default'
    }
  },
  data: {
    imageError: false
  },
  methods: {
    onImageError(e) {
      console.error('LOGO图片加载失败:', e)
      this.setData({
        imageError: true
      })
    }
  }
})
