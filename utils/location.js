// 用户位置/城市（本地缓存 + 可选同步服务端画像）

const STORAGE_KEY = 'userLocation';

function getCached() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY);
    return raw && typeof raw === 'object' ? raw : null;
  } catch (e) {
    return null;
  }
}

function saveLocal(loc) {
  if (!loc || typeof loc !== 'object') return;
  try {
    wx.setStorageSync(STORAGE_KEY, {
      ...loc,
      updatedAt: Date.now()
    });
  } catch (e) {
    /* ignore */
  }
}

function formatLabel(loc) {
  if (!loc) return '选城市';
  const city = (loc.city || '').trim();
  if (city) {
    return city.length > 5 ? `${city.slice(0, 4)}…` : city;
  }
  if (Array.isArray(loc.region) && loc.region.length) {
    const name = loc.region[1] || loc.region[0] || '';
    return name.length > 5 ? `${name.slice(0, 4)}…` : name || '选城市';
  }
  const addr = (loc.address || loc.name || '').trim();
  if (addr) {
    return addr.length > 6 ? `${addr.slice(0, 5)}…` : addr;
  }
  return '选城市';
}

function syncToServer(loc) {
  const token = wx.getStorageSync('token');
  if (!token) return Promise.resolve();
  const api = require('./api');
  return api
    .updateUserLocation({
      city: loc.city || '',
      region: loc.region || [],
      province: loc.province || (loc.region && loc.region[0]) || '',
      district: loc.district || (loc.region && loc.region[2]) || '',
      latitude: loc.latitude,
      longitude: loc.longitude,
      address: loc.address || loc.name || ''
    })
    .catch(() => null);
}

function regionFromPickerDetail(detail) {
  const names = (detail && detail.value) || [];
  const codes = (detail && detail.code) || [];
  const province = names[0] || '';
  const city = names[1] || '';
  const district = names[2] || '';
  return {
    province,
    city,
    district,
    region: [province, city, district].filter(Boolean),
    regionCode: codes,
    source: 'region'
  };
}

function chooseLocation() {
  return new Promise((resolve, reject) => {
    wx.chooseLocation({
      success: (res) => {
        resolve({
          city: guessCityFromAddress(res.address) || res.name || '',
          address: res.address || res.name || '',
          name: res.name || '',
          latitude: res.latitude,
          longitude: res.longitude,
          source: 'picker'
        });
      },
      fail: reject
    });
  });
}

function guessCityFromAddress(address) {
  const s = String(address || '');
  const m = s.match(/([\u4e00-\u9fa5]{2,12}(?:市|州|盟|地区))/);
  return m ? m[1] : '';
}

function isAutoLocateAuthError(err) {
  const msg = String((err && err.errMsg) || err || '');
  const errno = err && (err.errno || err.errCode);
  return msg.indexOf('not authorized') !== -1 || msg.indexOf('auth') !== -1 || errno === -80424;
}

/** 自动定位（仅用户主动点击时调用；未开通模糊定位接口时会失败） */
function locateByAuto() {
  return new Promise((resolve, reject) => {
    wx.getFuzzyLocation({
      type: 'gcj02',
      success: async (pos) => {
        let geo = {};
        try {
          const api = require('./api');
          geo = (await api.reverseGeocode(pos.latitude, pos.longitude)) || {};
        } catch (e) {
          geo = {};
        }
        const loc = {
          province: geo.province || '',
          city: geo.city || '',
          district: geo.district || '',
          region: geo.region || [],
          address: geo.address || '',
          latitude: pos.latitude,
          longitude: pos.longitude,
          source: 'gps'
        };
        if (!loc.city && !loc.address) {
          reject({ errMsg: 'locate:empty', message: '未能识别城市' });
          return;
        }
        resolve(loc);
      },
      fail: reject
    });
  });
}

function applyFromUserInfo(userInfo) {
  if (!userInfo) return null;
  const city = userInfo.locationCity || userInfo.location_city || '';
  if (!city && !userInfo.locationAddress) return null;
  const loc = {
    city,
    region: userInfo.locationRegion || userInfo.location_region || [],
    address: userInfo.locationAddress || userInfo.location_address || '',
    latitude: userInfo.locationLat ?? userInfo.location_lat,
    longitude: userInfo.locationLng ?? userInfo.location_lng,
    source: 'server'
  };
  saveLocal(loc);
  return loc;
}

module.exports = {
  STORAGE_KEY,
  getCached,
  saveLocal,
  formatLabel,
  syncToServer,
  regionFromPickerDetail,
  chooseLocation,
  locateByAuto,
  isAutoLocateAuthError,
  applyFromUserInfo
};
