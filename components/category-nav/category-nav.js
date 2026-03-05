// category-nav.js
Component({
  properties: {
    categoryList: {
      type: Array,
      value: []
    },
    currentCategoryId: {
      type: String,
      value: ''
    }
  },
  data: {
    currentIndex: 0
  },
  observers: {
    'currentCategoryId': function(newVal) {
      const index = this.data.categoryList.findIndex(item => item.id === newVal)
      if (index !== -1) {
        this.setData({
          currentIndex: index
        })
      }
    },
    'categoryList': function(newList) {
      // 初始化图标错误状态
      if (newList && newList.length > 0) {
        newList.forEach(item => {
          if (!item.hasOwnProperty('iconError')) {
            item.iconError = false
          }
        })
      }
    }
  },
  methods: {
    onCategoryTap(e) {
      const { index, id } = e.currentTarget.dataset
      this.setData({
        currentIndex: index
      })
      this.triggerEvent('change', {
        categoryId: id,
        category: this.data.categoryList[index]
      })
    },
    onIconError(e) {
      const index = e.currentTarget.dataset.index
      const categoryList = this.data.categoryList
      if (categoryList && categoryList[index]) {
        categoryList[index].iconError = true
        this.setData({
          categoryList: categoryList
        })
      }
    }
  }
})
