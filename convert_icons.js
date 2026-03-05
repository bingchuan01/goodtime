/**
 * 将SVG图标转换为PNG格式
 * 需要安装: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// 检查是否安装了sharp
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('请先安装依赖: npm install sharp');
  console.log('或者使用在线工具转换SVG到PNG: https://convertio.co/zh/svg-png/');
  process.exit(1);
}

async function convertSvgToPng(svgPath, pngPath, width, height) {
  try {
    await sharp(svgPath)
      .resize(width, height)
      .png()
      .toFile(pngPath);
    console.log(`✓ 已转换: ${svgPath} -> ${pngPath}`);
    return true;
  } catch (error) {
    console.log(`✗ 转换失败 ${svgPath}: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('开始转换图标...\n');

  // tabBar图标转换 (81x81)
  const tabbarDir = 'images/tabbar';
  const tabbarIcons = [
    { svg: 'home.svg', png: 'home.png' },
    { svg: 'home-active.svg', png: 'home-active.png' },
    { svg: 'handshake.svg', png: 'handshake.png' },
    { svg: 'handshake-active.svg', png: 'handshake-active.png' },
    { svg: 'publish.svg', png: 'publish.png' },
    { svg: 'publish-active.svg', png: 'publish-active.png' },
    { svg: 'member.svg', png: 'member.png' },
    { svg: 'member-active.svg', png: 'member-active.png' },
    { svg: 'user.svg', png: 'user.png' },
    { svg: 'user-active.svg', png: 'user-active.png' }
  ];

  console.log('转换tabBar图标 (81x81)...');
  for (const icon of tabbarIcons) {
    const svgPath = path.join(tabbarDir, icon.svg);
    const pngPath = path.join(tabbarDir, icon.png);
    if (fs.existsSync(svgPath)) {
      await convertSvgToPng(svgPath, pngPath, 81, 81);
    }
  }

  console.log('\n所有图标转换完成！');
  console.log('如果转换失败，请使用在线工具: https://convertio.co/zh/svg-png/');
}

main().catch(console.error);
