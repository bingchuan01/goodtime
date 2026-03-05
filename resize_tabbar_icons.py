#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
调整 tabbar 图标尺寸为 81x81px
需要安装: pip install pillow
"""

import os
from PIL import Image

def resize_icon(input_path, output_path, size=(81, 81)):
    """调整图标尺寸"""
    try:
        # 打开图片
        img = Image.open(input_path)
        
        # 转换为 RGBA 模式（支持透明背景）
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
        
        # 使用高质量重采样算法调整尺寸
        resized_img = img.resize(size, Image.Resampling.LANCZOS)
        
        # 保存图片
        resized_img.save(output_path, 'PNG', optimize=True)
        print(f"✓ 已调整: {input_path} -> {output_path} ({size[0]}x{size[1]}px)")
        return True
    except Exception as e:
        print(f"✗ 调整失败 {input_path}: {e}")
        return False

def main():
    """主函数"""
    tabbar_dir = "images/tabbar"
    
    # 需要调整的图标（handshake 和 member）
    icons_to_resize = [
        "handshake.png",
        "handshake-active.png",
        "member.png",
        "member-active.png"
    ]
    
    print("开始调整 tabbar 图标尺寸为 81x81px...\n")
    
    for icon_name in icons_to_resize:
        icon_path = os.path.join(tabbar_dir, icon_name)
        if os.path.exists(icon_path):
            # 直接覆盖原文件
            resize_icon(icon_path, icon_path, (81, 81))
        else:
            print(f"⚠ 文件不存在: {icon_path}")
    
    print("\n图标调整完成！")

if __name__ == "__main__":
    main()
