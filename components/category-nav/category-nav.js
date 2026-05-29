// category-nav.js
const ALL_ENTRY_ID = '__all__';

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
    currentIndex: 0,
    displayList: []
  },
  observers: {
    currentCategoryId(newVal) {
      const list = this.data.displayList || [];
      const index = list.findIndex((item) => item.id === newVal);
      if (index !== -1) {
        this.setData({ currentIndex: index });
      }
    },
    categoryList(newList) {
      const list = (newList || []).filter((item) => item && item.id !== ALL_ENTRY_ID);
      list.forEach((item) => {
        if (!Object.prototype.hasOwnProperty.call(item, 'iconError')) {
          item.iconError = false;
        }
      });
      this.setData({ displayList: list });
      const cid = this.properties.currentCategoryId;
      const index = list.findIndex((item) => item.id === cid);
      if (index !== -1) {
        this.setData({ currentIndex: index });
      }
    }
  },
  methods: {
    onCategoryTap(e) {
      const { index, id } = e.currentTarget.dataset;
      this.setData({ currentIndex: index });
      this.triggerEvent('change', {
        categoryId: id,
        category: this.data.displayList[index]
      });
    },
    onIconError(e) {
      const index = e.currentTarget.dataset.index;
      const displayList = [...(this.data.displayList || [])];
      if (displayList[index]) {
        displayList[index] = { ...displayList[index], iconError: true };
        this.setData({ displayList });
      }
    }
  }
});
