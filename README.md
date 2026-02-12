# QuickMark - 快速书签管理器

<p align="center">
  <img src="icon128.png" alt="QuickMark Logo" width="128" height="128">
</p>

<p align="center">
  <strong>一键收藏，智能分组，让新标签页成为你的书签仪表盘</strong>
</p>

<p align="center">
  <a href="https://chromewebstore.google.com/detail/quickmark/gaeeamadlnkenibiggoamillnanhldde">Chrome Web Store</a>
</p>

## ✨ 功能特性

- ⭐ **一键收藏** - 点击扩展图标即可快速保存或移除当前页面
- 📇 **多种视图** - 卡片、列表、标题三种视图自由切换
- 🏷️ **智能分组** - 自动按域名分组，支持自定义分组和标签
- 🔍 **即时搜索** - 实时搜索，快速定位任意书签
- 🎨 **精美设计** - 简洁现代界面，支持浅色/深色/跟随系统主题
- ☁️ **云端同步** - 使用 Google 账号登录，跨设备自动同步书签数据
- 🌐 **跨浏览器** - 支持 Chrome 和 Microsoft Edge 浏览器
- 🌍 **多语言** - 支持中文和英文界面
- 🔒 **隐私优先** - 数据本地存储优先，云端同步可选
- ⌨️ **快捷键** - `Ctrl+Shift+S` (Mac: `Cmd+Shift+S`) 快速收藏

## 📦 安装方式

### Chrome / Edge 浏览器

👉 [Chrome Web Store 安装](https://chromewebstore.google.com/detail/quickmark/gaeeamadlnkenibiggoamillnanhldde)

> Edge 浏览器也可以从 Chrome Web Store 安装扩展

## 🚀 使用指南

### 收藏网页
- **方式一**：点击浏览器工具栏的 QuickMark 图标
- **方式二**：使用快捷键 `Ctrl+Shift+S` (Mac: `Cmd+Shift+S`)

### 管理书签
- 打开新标签页即可查看所有书签
- 点击书签卡片可直接访问网页
- 右键或悬停显示编辑/删除选项
- 拖拽书签可调整顺序或移动分组

### 批量操作
- 点击右上角「☑」进入批量模式
- 选择多个书签后可批量删除、移动分组、添加标签

### 云端同步
- 点击右上角「⚙」进入设置页面
- 在「云端同步」部分点击「登录」使用 Google 账号登录
- 登录后可开启自动同步，或手动点击「立即同步」
- 支持跨设备同步书签数据
- 自动同步每 12 小时执行一次

### 设置选项
- 点击右上角「⚙」进入设置页面
- 可调整主题（浅色/深色/跟随系统）、默认视图、排序方式、语言等
- 支持导入/导出书签数据

## 🛠️ 技术实现

- **前端**：原生 JavaScript + HTML + CSS（零依赖）
- **布局**：CSS Grid + 瀑布流自适应
- **存储**：Chrome Storage API（本地存储）
- **云同步**：Firebase + Google OAuth 2.0
- **定时任务**：Chrome Alarms API（后台自动同步）
- **国际化**：Chrome i18n API

## 📁 项目结构

```
extension_quickmark/
├── _locales/           # 国际化文件
│   ├── en/
│   └── zh_CN/
├── scripts/            # 构建脚本
│   └── svg2png.js      # 图标转换
├── manifest.json       # 扩展配置
├── newtab.html/js      # 新标签页
├── options.html/js/css # 设置页面
├── popup.html/js       # 弹出窗口
├── background.js       # 后台服务
├── firebase.js         # Firebase 云同步
├── style.css           # 主样式
└── icon*.png           # 图标文件
```

## 📝 更新日志

### v2.0.3
- 修复退出登录后重新登录时自动使用上次账号的问题
- 现在会显示账号选择界面

### v2.0.2
- 新增 Microsoft Edge 浏览器支持
- 优化 Token 自动刷新，保持登录状态稳定
- 使用 Chrome Alarms API 实现每 12 小时后台自动同步
- 修复未登录时清除数据报错的问题

### v2.0.0
- 新增 Google 账号云端同步功能
- 支持自动同步和手动同步
- 支持跨设备书签数据同步
- 主题新增「跟随系统」选项

### v1.3.1
- 修复导入书签支持直接数组格式
- 优化 popup 多语言支持
- 精简右上角工具栏

### v1.3.0
- 新增标签管理功能
- 新增批量操作（删除、移动分组、添加标签）
- 优化分组瀑布流布局
- 新增多种视图模式

### v1.2.0
- 新增浅色/深色主题
- 新增设置页面
- 支持导入/导出数据

### v1.1.0
- 新增拖拽排序
- 新增分组编辑
- 优化搜索功能

### v1.0.0
- 初始版本发布
- 一键收藏功能
- 新标签页展示
- 自动分组

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
