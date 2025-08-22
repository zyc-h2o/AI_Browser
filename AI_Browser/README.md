# AI Browser Assistant

A modern, beautifully designed Chrome extension that provides AI-powered assistance for webpage analysis and intelligent writing support.

## Key Features

✨ **Smart Conversations**: Chat with AI based on current webpage content
🔧 **Custom API**: Support for custom Base URL and API Key configuration  
📱 **Modern Interface**: Beautiful sidebar design with dark mode support
🔄 **Real-time Updates**: Automatic webpage content change detection
💬 **Conversation History**: Continuous contextual dialogue
⚙️ **Easy Configuration**: Intuitive settings panel
✍️ **AI Writing Assistant**: Intelligent writing help and text improvement
🎯 **Text Selection Tools**: Grammar check, expand, shorten, and improve selected text
🌙 **Dark Mode**: Automatic dark/light mode adaptation
🎨 **OpenAI-style Design**: Modern, minimalist interface with advanced animations

## Installation

### Developer Mode Installation

1. Open Chrome browser
2. Navigate to Extensions page (`chrome://extensions/`)
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked"
5. Select this project folder
6. Extension installed successfully

## How to Use

### 1. Configure API

First-time setup requires API configuration:

1. Click the extension icon in the browser toolbar
2. Click the settings button in the top right of the sidebar
3. Fill in the following information:
   - **Base URL**: API server address (e.g., `https://api.openai.com/v1`)
   - **API Key**: Your API key
   - **Model**: AI model to use (e.g., `gpt-4o`)
4. Click "Save Settings"

### 2. Start Chatting

1. After configuration, the sidebar will show "Connected" status
2. Type questions about the current webpage in the input box
3. AI will provide answers based on webpage content
4. Supports continuous conversation with context memory

### 3. AI Writing Assistant

#### Global Input Field Helper:
- **Universal Coverage**: Works on ANY input field across ALL websites
- **Smart Detection**: Automatically detects text inputs, textareas, and contentEditable elements
- **Hover & Focus Triggers**: Shows helper when hovering over or focusing on input fields
- **Intelligent Positioning**: Helper appears next to the cursor with smart boundary detection

#### Quick Action Buttons:
- **Improve**: Make text clearer, more engaging, and better written
- **Shorter**: Condense text while preserving the main meaning  
- **Longer**: Expand with more details, examples, and elaboration
- **Grammar**: Fix grammar, spelling, and punctuation errors
- **Generate**: Create new content based on your description

#### Smart Features:
- **Context Awareness**: Uses existing text in the field as context
- **Real-time Processing**: Instant text replacement with AI suggestions
- **Dark Mode Support**: Automatically adapts to system theme
- **Non-intrusive**: Only appears when needed, hides automatically

### 4. Webpage Content Analysis

The extension automatically:
- Extracts main content from current webpage
- Filters out ads and irrelevant information
- Monitors page changes and updates content
- Provides accurate page context to AI

## API兼容性

本扩展兼容OpenAI API格式的服务，包括但不限于：

- OpenAI官方API
- Azure OpenAI Service
- 本地部署的兼容API
- 第三方OpenAI兼容服务

## 技术特性

- **Chrome Extension Manifest V3**: 使用最新的扩展标准
- **Side Panel API**: 现代化的侧边栏体验
- **Content Script**: 智能网页内容提取
- **Service Worker**: 高效的后台API处理
- **Local Storage**: 安全的配置信息存储

## 文件结构

```
AI_Browser/
├── manifest.json          # 扩展清单文件
├── sidepanel.html         # 侧边栏HTML
├── sidepanel.css          # 侧边栏样式
├── sidepanel.js           # 侧边栏逻辑
├── content.js             # 内容脚本
├── background.js          # 后台脚本
└── README.md             # 说明文档
```

## 隐私保护

- 配置信息仅存储在本地
- 不收集用户个人信息
- 网页内容仅在用户主动提问时发送至API
- 支持自定义API服务器，数据安全可控

## 故障排除

### 扩展无法加载
- 确保Chrome版本支持Manifest V3
- 检查文件完整性
- 重新加载扩展

### 无法连接API
- 验证Base URL格式正确
- 确认API Key有效
- 检查网络连接
- 查看浏览器开发者工具的错误信息

### 侧边栏不显示
- 确保已点击扩展图标
- 检查是否有其他扩展冲突
- 尝试刷新页面

## 开发说明

如需修改或扩展功能：

1. 修改相应的源文件
2. 在扩展程序页面重新加载扩展
3. 使用浏览器开发者工具调试

## 版本历史

### v1.0.0
- 初始版本发布
- 基础AI对话功能
- 网页内容提取
- 现代化UI界面
- API配置管理

## 许可证

本项目使用 MIT 许可证开源。

## 支持

如遇问题或有建议，欢迎通过以下方式联系：
- 提交GitHub Issue
- 发送邮件反馈

---

享受与AI的智能对话体验！🚀