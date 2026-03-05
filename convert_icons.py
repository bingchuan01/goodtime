#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将SVG图标转换为PNG格式
需要安装: pip install cairosvg pillow
"""

import os
import sys

try:
    from cairosvg import svg2png
except ImportError:
    print("请先安装依赖: pip install cairosvg")
    sys.exit(1)

def convert_svg_to_png(svg_path, png_path, width=81, height=81):
    """将SVG转换为PNG"""
    try:
        svg2png(url=svg_path, write_to=png_path, output_width=width, output_height=height)
        print(f"✓ 已转换: {svg_path} -> {png_path}")
        return True
    except Exception as e:
        print(f"✗ 转换失败 {svg_path}: {e}")
        return False

def main():
    # tabBar图标转换 (81x81)
    tabbar_dir = "images/tabbar"
    tabbar_icons = [
        "home.svg", "home-active.svg",
        "handshake.svg", "handshake-active.svg",
        "publish.svg", "publish-active.svg",
        "member.svg", "member-active.svg",
        "user.svg", "user-active.svg"
    ]
    
    print("开始转换tabBar图标...")
    for icon in tabbar_icons:
        svg_path = os.path.join(tabbar_dir, icon)
        png_path = os.path.join(tabbar_dir, icon.replace(".svg", ".png"))
        if os.path.exists(svg_path):
            convert_svg_to_png(svg_path, png_path, 81, 81)
    
    # 其他图标转换 (48x48)
    icons_dir = "images/icons"
    icons = [
        "chart.svg", "shop.svg", "handshake.svg", "pie-chart.svg", "users.svg",
        "search.svg", "fire.svg", "trend.svg", "new.svg", "education.svg",
        "beauty.svg", "food.svg", "lightning.svg"
    ]
    
    print("\n开始转换其他图标...")
    for icon in icons:
        svg_path = os.path.join(icons_dir, icon)
        png_path = os.path.join(icons_dir, icon.replace(".svg", ".png"))
        if os.path.exists(svg_path):
            convert_svg_to_png(svg_path, png_path, 48, 48)
    
    # LOGO转换 (200x80)
    logo_svg = "images/logo.svg"
    logo_png = "images/logo.png"
    if os.path.exists(logo_svg):
        print("\n开始转换LOGO...")
        convert_svg_to_png(logo_svg, logo_png, 200, 80)
    
    print("\n所有图标转换完成！")

if __name__ == "__main__":
    main()
