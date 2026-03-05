// data-dashboard.js
Component({
  properties: {
    dataList: {
      type: Array,
      value: []
    }
  },
  data: {
    
  },
  observers: {
    'dataList': function(newList) {
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
    onIconError(e) {
      const index = e.currentTarget.dataset.index
      const dataList = this.data.dataList
      if (dataList && dataList[index]) {
        dataList[index].iconError = true
        this.setData({
          dataList: dataList
        })
      }
    }
  }
})
