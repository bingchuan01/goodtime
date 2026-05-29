// 通用工具函数

/**
 * 格式化时间
 */
function formatTime(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`;
}

/**
 * 格式化日期
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return `${[year, month, day].map(formatNumber).join('-')}`;
}

/**
 * 格式化数字（补零）
 */
function formatNumber(n) {
  n = n.toString();
  return n[1] ? n : `0${n}`;
}

/**
 * 格式化相对时间（如：刚刚、5分钟前、2小时前）
 */
/**
 * 将后端时间字符串格式化为 YYYY-MM-DD HH:mm（与后台管理展示一致）
 */
function formatDateTimeStr(input) {
  if (input == null || input === '') return '';
  if (typeof input === 'number' && Number.isFinite(input)) {
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return '';
    return `${formatDate(d)} ${[d.getHours(), d.getMinutes()].map(formatNumber).join(':')}`;
  }
  const s = String(input).trim().replace('T', ' ');
  if (!s) return '';
  const withMinutes = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (withMinutes) return `${withMinutes[1]} ${withMinutes[2]}`;
  const dateOnly = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnly) return dateOnly[1];
  const t = Date.parse(s.replace(/-/g, '/'));
  if (!Number.isNaN(t)) {
    const d = new Date(t);
    return `${formatDate(d)} ${[d.getHours(), d.getMinutes()].map(formatNumber).join(':')}`;
  }
  return s.length > 16 ? s.slice(0, 16) : s;
}

/** 我的发布：按状态展示与后台一致的时间标签 */
function getProjectTimeMeta(project) {
  const status = String((project && project.status) || '')
    .trim()
    .toLowerCase();
  const published = (project && (project.publishedAt || project.published_at)) || '';
  const created = (project && (project.createdAt || project.created_at)) || '';
  const updated = (project && (project.updatedAt || project.updated_at)) || '';

  if (status === 'approved') {
    const timeDisplay =
      formatDateTimeStr(published) || formatDateTimeStr(updated) || formatDateTimeStr(created) || '—';
    return { timeLabel: '发布时间', timeDisplay };
  }
  if (status === 'pending') {
    return {
      timeLabel: '提交时间',
      timeDisplay: formatDateTimeStr(created) || formatDateTimeStr(updated) || '—'
    };
  }
  if (status === 'rejected') {
    return {
      timeLabel: '退回时间',
      timeDisplay: formatDateTimeStr(updated) || formatDateTimeStr(created) || '—'
    };
  }
  return {
    timeLabel: '更新时间',
    timeDisplay: formatDateTimeStr(updated) || formatDateTimeStr(created) || '—'
  };
}

function formatRelativeTime(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;
  
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const week = 7 * day;
  const month = 30 * day;
  const year = 365 * day;
  
  if (diff < minute) {
    return '刚刚';
  } else if (diff < hour) {
    return `${Math.floor(diff / minute)}分钟前`;
  } else if (diff < day) {
    return `${Math.floor(diff / hour)}小时前`;
  } else if (diff < week) {
    return `${Math.floor(diff / day)}天前`;
  } else if (diff < month) {
    return `${Math.floor(diff / week)}周前`;
  } else if (diff < year) {
    return `${Math.floor(diff / month)}个月前`;
  } else {
    return `${Math.floor(diff / year)}年前`;
  }
}

/**
 * 格式化视频时长（秒转 mm:ss）
 */
function formatDuration(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${formatNumber(mins)}:${formatNumber(secs)}`;
}

/**
 * 格式化数字（如：1.2万、3.5k）
 */
function formatNumberShort(num) {
  if (num < 1000) {
    return num.toString();
  } else if (num < 10000) {
    return (num / 1000).toFixed(1) + 'k';
  } else {
    return (num / 10000).toFixed(1) + '万';
  }
}

/**
 * 防抖函数
 */
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(context, args);
    }, wait);
  };
}

/**
 * 节流函数
 */
function throttle(func, wait) {
  let timeout;
  let previous = 0;
  return function(...args) {
    const context = this;
    const now = Date.now();
    const remaining = wait - (now - previous);
    
    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func.apply(context, args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        previous = Date.now();
        timeout = null;
        func.apply(context, args);
      }, remaining);
    }
  };
}

/**
 * 深拷贝
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  
  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item));
  }
  
  if (typeof obj === 'object') {
    const clonedObj = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        clonedObj[key] = deepClone(obj[key]);
      }
    }
    return clonedObj;
  }
}

module.exports = {
  formatTime,
  formatDate,
  formatDateTimeStr,
  getProjectTimeMeta,
  formatNumber,
  formatRelativeTime,
  formatDuration,
  formatNumberShort,
  debounce,
  throttle,
  deepClone
};






