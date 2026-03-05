# Tabbar 图标调整说明

## 已完成
✅ 已统一 tabbar 名称风格：
- 首页
- 合作（原：咨询合作）
- 发布（原：闪电发布）
- 会员（原：会员权益）
- 我的（原：我）

## 需要调整的图标
需要将以下图标调整为 **81x81px**：
- `images/tabbar/handshake.png`
- `images/tabbar/handshake-active.png`
- `images/tabbar/member.png`
- `images/tabbar/member-active.png`

## 调整方法

### 方法一：使用 Python + Pillow（推荐）
1. 安装 Pillow：
   ```bash
   pip install Pillow
   ```

2. 运行调整脚本：
   ```bash
   python resize_tabbar_icons.py
   ```

### 方法二：使用在线工具
1. 访问在线图片调整工具（如：https://www.iloveimg.com/resize-image）
2. 上传需要调整的图标文件
3. 设置为 81x81px
4. 下载并替换原文件

### 方法三：使用图片编辑软件
使用 Photoshop、GIMP 或其他图片编辑软件：
1. 打开图标文件
2. 调整图像大小为 81x81px
3. 保持透明背景（如果原图有透明背景）
4. 保存为 PNG 格式

## 注意事项
- 确保调整后的图标保持清晰度
- 保持透明背景（如果原图有透明背景）
- 确保图标内容居中显示
- 建议使用高质量的重采样算法（如 LANCZOS）
