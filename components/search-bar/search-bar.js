// search-bar.js
const locationUtil = require('../../utils/location');

Component({
  properties: {
    placeholder: {
      type: String,
      value: '种草品牌从此刻开始'
    },
    showLocation: {
      type: Boolean,
      value: true
    }
  },

  data: {
    showIcon: true,
    locationLabel: '选城市',
    regionModalVisible: false
  },

  lifetimes: {
    attached() {
      this._loadLocationDisplay();
    }
  },

  pageLifetimes: {
    show() {
      this._loadLocationDisplay();
    }
  },

  methods: {
    _loadLocationDisplay() {
      const cached = locationUtil.getCached();
      if (cached) {
        this.setData({
          locationLabel: locationUtil.formatLabel(cached)
        });
      }
    },

    onOpenLocationSheet() {
      wx.showActionSheet({
        itemList: ['选择城市', '地图选点', '自动定位'],
        success: (res) => {
          const idx = res.tapIndex;
          if (idx === 0) {
            this.setData({ regionModalVisible: true });
          } else if (idx === 1) {
            this.onMapLocationPick();
          } else if (idx === 2) {
            this.onAutoLocatePick();
          }
        }
      });
    },

    onCloseRegionModal() {
      this.setData({ regionModalVisible: false });
    },

    async _applyLocation(loc, showToast) {
      locationUtil.saveLocal(loc);
      this.setData({
        locationLabel: locationUtil.formatLabel(loc),
        regionModalVisible: false
      });
      await locationUtil.syncToServer(loc);
      this.triggerEvent('locationchange', { location: loc });
      if (showToast) {
        let tip = '城市已更新';
        if (loc.source === 'picker') tip = '位置已更新';
        if (loc.source === 'gps') tip = '定位成功';
        wx.showToast({ title: tip, icon: 'success', duration: 1200 });
      }
    },

    onRegionPick(e) {
      const detail = e.detail || {};
      const loc = locationUtil.regionFromPickerDetail(detail);
      if (!loc.city && !loc.province) {
        wx.showToast({ title: '请选择城市', icon: 'none' });
        return;
      }
      this._applyLocation(loc, true);
    },

    onMapLocationPick() {
      locationUtil
        .chooseLocation()
        .then((loc) => this._applyLocation(loc, true))
        .catch((err) => {
          const msg = String((err && err.errMsg) || '');
          if (msg.indexOf('cancel') !== -1) return;
          if (msg.indexOf('not authorized') !== -1 || msg.indexOf('auth') !== -1) {
            wx.showModal({
              title: '地图选点未开通',
              content: '请在微信公众平台开通「选择位置」接口。您也可选「选择城市」手动选省市区。',
              showCancel: false
            });
            return;
          }
          wx.showToast({ title: '无法打开地图选点', icon: 'none' });
        });
    },

    onAutoLocatePick() {
      wx.showLoading({ title: '定位中...', mask: true });
      locationUtil
        .locateByAuto()
        .then((loc) => {
          wx.hideLoading();
          return this._applyLocation(loc, true);
        })
        .catch((err) => {
          wx.hideLoading();
          const msg = String((err && err.errMsg) || '');
          if (msg.indexOf('cancel') !== -1) return;
          if (locationUtil.isAutoLocateAuthError(err)) {
            wx.showModal({
              title: '自动定位未开通',
              content: '请在公众平台开通「模糊位置」。当前请用「选择城市」或「地图选点」。',
              showCancel: false
            });
            return;
          }
          if (msg.indexOf('locate:empty') !== -1) {
            wx.showToast({ title: '未能识别城市，请手动选择', icon: 'none' });
            return;
          }
          wx.showToast({ title: '定位失败，请手动选择', icon: 'none' });
        });
    },

    onSearchTap() {
      this.triggerEvent('search', {});
      wx.navigateTo({
        url: '/pages/search/search'
      });
    },

    onIconError() {
      this.setData({
        showIcon: false
      });
    }
  }
});
