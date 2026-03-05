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
