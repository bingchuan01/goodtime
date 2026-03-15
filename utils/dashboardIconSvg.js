/**
 * 数据看板图标内联 SVG 内容（用于 data URI 或后续 rich-text）
 * 替换图标时替换对应 key 的字符串即可；未提供的 key 不传 iconSvg，组件会回退到 icon 路径。
 */
function toDataUri(svgString) {
  if (!svgString || typeof svgString !== 'string') return '';
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
}

// 与 pages/index 中 dashboardData 的 key 对应
const SVG_MAP = {
  marketSize: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <rect x="8" y="30" width="6" height="12" fill="#2196F3"/>
  <rect x="18" y="24" width="6" height="18" fill="#2196F3"/>
  <rect x="28" y="18" width="6" height="24" fill="#2196F3"/>
  <rect x="38" y="12" width="6" height="30" fill="#2196F3"/>
</svg>`,
  serviceMerchants: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <rect x="8" y="12" width="32" height="28" rx="2" fill="#FFC107" stroke="#FFC107" stroke-width="2"/>
  <path d="M12 20H36M12 26H36M12 32H28" stroke="white" stroke-width="2"/>
  <circle cx="18" cy="38" r="3" fill="#FFC107"/>
  <circle cx="30" cy="38" r="3" fill="#FFC107"/>
</svg>`,
  strategicPartners: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 81 81" width="81" height="81">
  <defs>
    <linearGradient id="wingsBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#F3E5F5;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#E1BEE7;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#CE93D8;stop-opacity:1" />
    </linearGradient>
    <filter id="paperShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="0.5" />
      <feOffset dx="0.5" dy="0.5" result="offsetblur" />
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.25" />
      </feComponentTransfer>
      <feMerge>
        <feMergeNode />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>
  <style>
    @keyframes breathe { 0%, 100% { opacity: 0.5; filter: blur(0.8px); } 50% { opacity: 1; filter: blur(0.3px); } }
    @keyframes pulse-ring { 0%, 100% { r: 40; opacity: 0.2; } 50% { r: 42.5; opacity: 0.5; } }
    @keyframes twinkle { 0%, 100% { opacity: 0.25; } 50% { opacity: 0.8; } }
    @keyframes wing-flutter { 0%, 100% { transform: scaleX(1); } 50% { transform: scaleX(0.95); } }
    .breath { animation: breathe 3s ease-in-out infinite; }
    .pulse { animation: pulse-ring 3s ease-in-out infinite; }
    .twinkle { animation: twinkle 2.4s ease-in-out infinite; }
    .twinkle-d1 { animation: twinkle 2.9s ease-in-out infinite; }
    .twinkle-d2 { animation: twinkle 3.3s ease-in-out infinite; }
    .flutter { animation: wing-flutter 2.5s ease-in-out infinite; transform-origin: center; }
  </style>
  <circle cx="40.5" cy="40.5" r="40.5" fill="url(#wingsBg)" />
  <circle cx="40.5" cy="40.5" r="40" fill="none" stroke="#BA68C8" stroke-width="0.7" class="pulse" />
  <circle cx="16" cy="20" r="1.8" fill="#FFFFFF" class="twinkle" />
  <circle cx="68" cy="16" r="1.5" fill="#FFFFFF" class="twinkle-d1" />
  <circle cx="14" cy="65" r="1.6" fill="#FFFFFF" class="twinkle-d2" />
  <circle cx="66" cy="68" r="2" fill="#FFFFFF" class="twinkle" />
  <circle cx="24" cy="76" r="1.3" fill="#FFFFFF" class="twinkle-d1" />
  <g filter="url(#paperShadow)">
    <g class="breath flutter">
      <polygon points="20,28 35,20 40,35 25,43" fill="#E1BEE7" stroke="#BA68C8" stroke-width="1" />
      <polygon points="20,28 33,22 35,20 40,35" fill="#F3E5F5" opacity="0.6" />
      <polygon points="15,40 32,35 38,50 20,55" fill="#CE93D8" stroke="#BA68C8" stroke-width="1" />
      <polygon points="15,40 30,37 35,48 20,52" fill="#E1BEE7" opacity="0.5" />
      <polygon points="18,56 35,52 42,62 28,68" fill="#BA68C8" stroke="#AB47BC" stroke-width="1" />
      <polygon points="18,56 32,54 38,62 26,65" fill="#CE93D8" opacity="0.4" />
      <polygon points="38,50 42,62 40,35" fill="#F3E5F5" opacity="0.3" />
    </g>
    <g class="breath flutter" style="animation-delay: 0.3s;">
      <polygon points="61,28 46,20 41,35 56,43" fill="#E1BEE7" stroke="#BA68C8" stroke-width="1" />
      <polygon points="61,28 48,22 46,20 41,35" fill="#F3E5F5" opacity="0.6" />
      <polygon points="66,40 49,35 43,50 61,55" fill="#CE93D8" stroke="#BA68C8" stroke-width="1" />
      <polygon points="66,40 51,37 46,48 61,52" fill="#E1BEE7" opacity="0.5" />
      <polygon points="63,56 46,52 39,62 53,68" fill="#BA68C8" stroke="#AB47BC" stroke-width="1" />
      <polygon points="63,56 49,54 43,62 55,65" fill="#CE93D8" opacity="0.4" />
      <polygon points="43,50 39,62 41,35" fill="#F3E5F5" opacity="0.3" />
    </g>
    <g class="breath">
      <polygon points="40.5,45 46,40 40.5,32 35,40" fill="#FFFFFF" opacity="0.95" stroke="#E1BEE7" stroke-width="0.8" />
      <polygon points="40.5,43 44,40 40.5,35 37,40" fill="#F3E5F5" opacity="0.7" />
      <polygon points="40.5,42 42,40 40.5,37 39,40" fill="#CE93D8" opacity="0.5" />
      <line x1="40.5" y1="32" x2="40.5" y2="28" stroke="#BA68C8" stroke-width="0.8" />
      <circle cx="40.5" cy="26" r="1.5" fill="#FFFFFF" />
    </g>
    <g fill="#FFFFFF" opacity="0.6" class="breath">
      <polygon points="22,30 28,28 27,32" /><polygon points="18,42 26,40 25,44" /><polygon points="20,58 28,56 27,60" />
      <polygon points="59,30 53,28 54,32" /><polygon points="63,42 55,40 56,44" /><polygon points="61,58 53,56 54,60" />
    </g>
  </g>
  <ellipse cx="32" cy="12" rx="8" ry="4" fill="#FFFFFF" opacity="0.4" transform="rotate(-10 32 12)" />
  <circle cx="55" cy="28" r="1.6" fill="#FFFFFF" class="twinkle-d2" />
  <circle cx="25" cy="50" r="1.4" fill="#FFFFFF" class="twinkle" />
  <circle cx="40.5" cy="72" r="1.2" fill="#FFFFFF" class="twinkle-d1" />
</svg>`,
  marketShare: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <circle cx="24" cy="24" r="20" fill="#E91E63" opacity="0.2"/>
  <path d="M24 4A20 20 0 0 1 24 44A20 20 0 0 0 24 4Z" fill="#E91E63"/>
  <path d="M24 4A20 20 0 0 1 40 24L24 24Z" fill="#E91E63" opacity="0.6"/>
</svg>`,
  registeredUsers: `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
  <circle cx="16" cy="14" r="6" fill="#FFC107"/>
  <path d="M8 38C8 32 12 28 18 28C24 28 28 32 28 38" stroke="#FFC107" stroke-width="3" fill="none" stroke-linecap="round"/>
  <circle cx="32" cy="14" r="6" fill="#FFC107"/>
  <path d="M24 38C24 32 28 28 34 28C40 28 44 32 44 38" stroke="#FFC107" stroke-width="3" fill="none" stroke-linecap="round"/>
</svg>`
};

/**
 * 为看板项补充内联图标（data URI），便于在 80rpx 圆内按比例显示；未在 SVG_MAP 中的 key 不补充。
 */
function applyInlineIcons(dashboardList) {
  if (!Array.isArray(dashboardList)) return dashboardList;
  return dashboardList.map(item => {
    const svg = SVG_MAP[item.key];
    const iconDataUri = svg ? toDataUri(svg) : '';
    return { ...item, iconDataUri };
  });
}

module.exports = {
  SVG_MAP,
  toDataUri,
  applyInlineIcons
};
