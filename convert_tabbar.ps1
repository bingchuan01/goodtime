# TabBar图标转换脚本
# 需要安装 ImageMagick 或使用在线工具

Write-Host "TabBar图标转换工具" -ForegroundColor Green
Write-Host "====================" -ForegroundColor Green
Write-Host ""

$tabbarDir = "images\tabbar"
$icons = @(
    "home.svg", "home-active.svg",
    "handshake.svg", "handshake-active.svg",
    "publish.svg", "publish-active.svg",
    "member.svg", "member-active.svg",
    "user.svg", "user-active.svg"
)

# 检查ImageMagick是否安装
$magickPath = Get-Command magick -ErrorAction SilentlyContinue

if ($magickPath) {
    Write-Host "检测到ImageMagick，开始转换..." -ForegroundColor Yellow
    foreach ($icon in $icons) {
        $svgPath = Join-Path $tabbarDir $icon
        $pngPath = Join-Path $tabbarDir ($icon -replace "\.svg$", ".png")
        
        if (Test-Path $svgPath) {
            try {
                & magick convert -resize 81x81 -background none $svgPath $pngPath
                Write-Host "✓ 已转换: $icon -> $($icon -replace '\.svg$', '.png')" -ForegroundColor Green
            } catch {
                Write-Host "✗ 转换失败: $icon" -ForegroundColor Red
            }
        }
    }
    Write-Host ""
    Write-Host "转换完成！" -ForegroundColor Green
} else {
    Write-Host "未检测到ImageMagick" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "请选择以下方式之一：" -ForegroundColor Cyan
    Write-Host "1. 安装ImageMagick: https://imagemagick.org/script/download.php" -ForegroundColor White
    Write-Host "2. 使用在线工具: https://convertio.co/zh/svg-png/" -ForegroundColor White
    Write-Host "3. 使用HTML工具: 在浏览器中打开 convert_tabbar_icons.html" -ForegroundColor White
    Write-Host ""
    Write-Host "HTML工具已创建: convert_tabbar_icons.html" -ForegroundColor Green
    Write-Host "请在浏览器中打开该文件，点击'一键转换所有图标'按钮" -ForegroundColor Yellow
}
