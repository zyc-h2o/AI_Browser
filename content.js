class PageContentExtractor {
  constructor() {
    this.lastContent = '';
    this.observeChanges();
    this.sendInitialContent();
    this.setupMessageListener();
    this.initializeGlobalInputHelper();
  }

  // 提取页面主要内容
  extractPageContent() {
    try {
      // 移除不需要的元素
      const elementsToRemove = [
        'script', 'style', 'nav', 'header', 'footer', 
        '.advertisement', '.ads', '.popup', '.modal',
        '[role="banner"]', '[role="navigation"]', '[role="complementary"]'
      ];

      // 克隆文档以避免修改原页面
      const clonedDoc = document.cloneNode(true);
      
      elementsToRemove.forEach(selector => {
        const elements = clonedDoc.querySelectorAll(selector);
        elements.forEach(el => el.remove());
      });

      // 获取主要内容区域
      const mainContent = this.findMainContent(clonedDoc);
      let content = '';

      if (mainContent) {
        content = this.extractTextContent(mainContent);
      } else {
        // 如果没有找到主要内容区域，提取body内容
        content = this.extractTextContent(clonedDoc.body || clonedDoc);
      }

      // 清理和格式化内容
      content = this.cleanContent(content);
      
      // 添加页面基本信息
      const pageInfo = {
        title: document.title,
        url: window.location.href,
        domain: window.location.hostname
      };

      return {
        pageInfo,
        content: content.substring(0, 8000), // 限制内容长度
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Content extraction error:', error);
      return {
        pageInfo: {
          title: document.title,
          url: window.location.href,
          domain: window.location.hostname
        },
        content: '无法提取页面内容',
        timestamp: Date.now()
      };
    }
  }

  // 寻找主要内容区域
  findMainContent(doc) {
    // 常见的主要内容选择器
    const mainSelectors = [
      'main',
      '[role="main"]',
      '.main-content',
      '.content',
      '.post-content',
      '.article-content',
      '.entry-content',
      'article',
      '.container .content',
      '#content',
      '#main-content'
    ];

    for (const selector of mainSelectors) {
      const element = doc.querySelector(selector);
      if (element && this.hasSignificantContent(element)) {
        return element;
      }
    }

    // 如果没有找到明确的主要内容区域，寻找包含最多文本的元素
    const candidates = doc.querySelectorAll('div, section, article');
    let bestCandidate = null;
    let maxTextLength = 0;

    candidates.forEach(element => {
      const textLength = element.textContent?.trim().length || 0;
      if (textLength > maxTextLength && textLength > 200) {
        maxTextLength = textLength;
        bestCandidate = element;
      }
    });

    return bestCandidate;
  }

  // 检查元素是否包含有意义的内容
  hasSignificantContent(element) {
    const textContent = element.textContent?.trim() || '';
    return textContent.length > 100;
  }

  // 提取文本内容并保持结构
  extractTextContent(element) {
    if (!element) return '';

    let content = '';
    
    // 处理标题
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      const text = heading.textContent?.trim();
      if (text) {
        content += `\n## ${text}\n`;
      }
    });

    // 处理段落
    const paragraphs = element.querySelectorAll('p, div');
    paragraphs.forEach(p => {
      const text = p.textContent?.trim();
      if (text && text.length > 20) {
        // 避免重复内容
        if (!content.includes(text.substring(0, 50))) {
          content += `${text}\n\n`;
        }
      }
    });

    // 处理列表
    const lists = element.querySelectorAll('ul, ol');
    lists.forEach(list => {
      const items = list.querySelectorAll('li');
      if (items.length > 0) {
        content += '\n';
        items.forEach(item => {
          const text = item.textContent?.trim();
          if (text) {
            content += `• ${text}\n`;
          }
        });
        content += '\n';
      }
    });

    // 如果上述方法没有提取到足够内容，直接获取文本
    if (content.length < 100) {
      content = element.textContent?.trim() || '';
    }

    return content;
  }

  // 清理内容
  cleanContent(content) {
    return content
      // 移除多余的空白
      .replace(/\s+/g, ' ')
      // 移除多余的换行
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // 移除开头和结尾的空白
      .trim()
      // 移除常见的无用文本
      .replace(/^(Cookie|Cookies|Advertisement|广告|登录|注册|订阅|分享|Share).*$/gm, '')
      // 移除邮箱和电话号码（隐私保护）
      .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[邮箱]')
      .replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[电话]');
  }

  // 监听页面变化
  observeChanges() {
    let timeoutId;
    
    const observer = new MutationObserver(() => {
      // 防抖：避免频繁更新
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        this.sendContentUpdate();
      }, 1000);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });

    // 监听URL变化（SPA应用）
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(() => this.sendContentUpdate(), 2000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  // 发送初始内容
  sendInitialContent() {
    // 等待页面完全加载
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => this.sendContentUpdate(), 1000);
      });
    } else {
      setTimeout(() => this.sendContentUpdate(), 1000);
    }
  }

  // 发送内容更新
  sendContentUpdate() {
    try {
      const extractedData = this.extractPageContent();
      
      // 只有内容发生变化时才发送
      if (extractedData.content !== this.lastContent) {
        this.lastContent = extractedData.content;
        
        // 发送到sidepanel
        chrome.runtime.sendMessage({
          type: 'PAGE_CONTENT_UPDATED',
          ...extractedData
        });
      }
    } catch (error) {
      console.error('Failed to send content update:', error);
    }
  }

  // 设置消息监听器
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_PAGE_CONTENT') {
        const extractedData = this.extractPageContent();
        sendResponse({
          success: true,
          ...extractedData
        });
      } else if (message.type === 'AI_SETTINGS_UPDATED') {
        // 重新加载设置，便于立即启用/禁用全局助手
        if (this.globalInputHelper) {
          this.globalInputHelper.loadSettings();
        }
      }
    });
  }

  // 初始化全局输入框助手
  initializeGlobalInputHelper() {
    this.globalInputHelper = new GlobalInputHelper();
  }
}

// 全局输入框AI助手类
class GlobalInputHelper {
  constructor() {
    this.currentInput = null;
    this.helperWidget = null;
    this.isVisible = false;
    this.settings = null;
    
    this.loadSettings();
    this.createHelperWidget();
    this.bindEvents();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['aiSettings']);
      this.settings = result.aiSettings || null;
      // 如果用户关闭了全局助手，则禁用事件处理
      const hostname = location.hostname;
      const siteDisabled = (this.settings?.disabledSites || []).includes(hostname);
      this.enabled = (!this.settings || this.settings.enableGlobalHelper !== false) && !siteDisabled;
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  createHelperWidget() {
    // 创建AI助手工具框
    this.helperWidget = document.createElement('div');
    this.helperWidget.id = 'ai-input-helper';
    this.helperWidget.innerHTML = `
      <div class="ai-helper-container">
        <div class="ai-helper-header">
          <div class="ai-helper-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="currentColor"/>
            </svg>
            AI Assistant
          </div>
          <button class="ai-helper-close" id="aiHelperClose">×</button>
        </div>
        <div class="ai-helper-content">
          <div class="ai-helper-tabs">
            <button class="ai-tab active" data-tab="write">Write</button>
            <button class="ai-tab" data-tab="search">Search</button>
            <button class="ai-tab" data-tab="ocr">OCR</button>
          </div>
          
          <div class="ai-tab-content active" id="writeTab">
            <div class="ai-helper-buttons">
              <button class="ai-btn ai-btn-primary" id="aiImprove" title="Improve text">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L13.09 8.26L20 9L13.09 9.74L12 16L10.91 9.74L4 9L10.91 8.26L12 2Z" fill="currentColor"/>
                </svg>
                Improve
              </button>
              <button class="ai-btn ai-btn-secondary" id="aiShorten" title="Make shorter">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Shorter
              </button>
              <button class="ai-btn ai-btn-secondary" id="aiExpand" title="Make longer">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                Longer
              </button>
              <button class="ai-btn ai-btn-secondary" id="aiGrammar" title="Fix grammar">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                </svg>
                Grammar
              </button>
            </div>
            <div class="ai-helper-input-section">
              <textarea id="aiPrompt" placeholder="Describe what you want to write..." rows="2"></textarea>
              <button class="ai-btn ai-btn-generate" id="aiGenerate">Generate</button>
            </div>
          </div>
          
          <div class="ai-tab-content" id="searchTab">
            <div class="ai-search-section">
              <input type="text" id="searchQuery" placeholder="What do you want to search for?" />
              <div class="ai-search-buttons">
                <button class="ai-btn ai-btn-primary" id="aiSearch">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/>
                    <path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2"/>
                  </svg>
                  Search & Analyze
                </button>
              </div>
              <div class="ai-search-engines">
                <label>
                  <input type="radio" name="searchEngine" value="google" checked />
                  Google
                </label>
                <label>
                  <input type="radio" name="searchEngine" value="bing" />
                  Bing
                </label>
                <label>
                  <input type="radio" name="searchEngine" value="duckduckgo" />
                  DuckDuckGo
                </label>
              </div>
            </div>
          </div>
          
          <div class="ai-tab-content" id="ocrTab">
            <div class="ai-ocr-section">
              <div class="ai-ocr-buttons">
                <button class="ai-btn ai-btn-primary" id="aiOCRPage">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M14.828 14.828a4 4 0 0 1-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" stroke="currentColor" stroke-width="2"/>
                  </svg>
                  Scan Page
                </button>
                <button class="ai-btn ai-btn-secondary" id="aiOCRArea">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 9h6v6H9z" stroke="currentColor" stroke-width="2"/>
                    <path d="M21 15V9a2 2 0 0 0-2-2H9" stroke="currentColor" stroke-width="2"/>
                    <path d="M3 9v6a2 2 0 0 0 2 2h6" stroke="currentColor" stroke-width="2"/>
                  </svg>
                  Select Area
                </button>
              </div>
              <div class="ai-ocr-options">
                <label>
                  <input type="checkbox" id="includeImages" checked />
                  Include images with text
                </label>
                <label>
                  <input type="checkbox" id="translateText" />
                  Translate extracted text
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // 添加样式
    this.injectStyles();
    
    // 初始状态为隐藏
    this.helperWidget.style.display = 'none';
    document.body.appendChild(this.helperWidget);
  }

  injectStyles() {
    if (document.getElementById('ai-helper-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'ai-helper-styles';
    styles.textContent = `
      #ai-input-helper {
        position: fixed;
        z-index: 2147483647;
        background: rgba(255, 255, 255, 0.98);
        backdrop-filter: blur(20px) saturate(180%);
        -webkit-backdrop-filter: blur(20px) saturate(180%);
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 16px;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.12), 0 4px 16px rgba(0, 0, 0, 0.08);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', sans-serif;
        width: 340px;
        opacity: 0;
        transform: translateY(10px) scale(0.95);
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        pointer-events: none;
        font-size: 14px;
        line-height: 1.5;
      }

      #ai-input-helper.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
        pointer-events: all;
      }

      @media (prefers-color-scheme: dark) {
        #ai-input-helper {
          background: rgba(31, 41, 55, 0.95);
          border-color: rgba(255, 255, 255, 0.1);
        }
      }

      .ai-helper-container {
        padding: 0;
      }

      .ai-helper-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      }

      @media (prefers-color-scheme: dark) {
        .ai-helper-header {
          border-bottom-color: rgba(255, 255, 255, 0.1);
        }
      }

      .ai-helper-title {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        font-weight: 500;
        color: #374151;
      }

      @media (prefers-color-scheme: dark) {
        .ai-helper-title {
          color: #f3f4f6;
        }
      }

      .ai-helper-close {
        background: none;
        border: none;
        color: #6b7280;
        font-size: 16px;
        cursor: pointer;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: all 0.15s ease;
      }

      .ai-helper-close:hover {
        background: rgba(0, 0, 0, 0.05);
        color: #374151;
      }

      @media (prefers-color-scheme: dark) {
        .ai-helper-close {
          color: #9ca3af;
        }
        .ai-helper-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #f3f4f6;
        }
      }

      .ai-helper-content {
        padding: 0;
      }

      .ai-helper-tabs {
        display: flex;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      }

      @media (prefers-color-scheme: dark) {
        .ai-helper-tabs {
          border-bottom-color: rgba(255, 255, 255, 0.1);
        }
      }

      .ai-tab {
        flex: 1;
        padding: 12px 16px;
        background: none;
        border: none;
        font-size: 13px;
        font-weight: 500;
        color: #6b7280;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .ai-tab.active {
        color: #3b82f6;
        background: rgba(59, 130, 246, 0.1);
      }

      .ai-tab:hover:not(.active) {
        background: rgba(0, 0, 0, 0.05);
      }

      @media (prefers-color-scheme: dark) {
        .ai-tab {
          color: #9ca3af;
        }
        .ai-tab.active {
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.2);
        }
        .ai-tab:hover:not(.active) {
          background: rgba(255, 255, 255, 0.1);
        }
      }

      .ai-tab-content {
        display: none;
        padding: 16px;
      }

      .ai-tab-content.active {
        display: block;
      }

      .ai-helper-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin-bottom: 12px;
      }

      .ai-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 8px 12px;
        border: none;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        background: transparent;
      }

      .ai-btn-primary {
        background: #3b82f6;
        color: white;
      }

      .ai-btn-primary:hover {
        background: #2563eb;
        transform: translateY(-1px);
      }

      .ai-btn-secondary {
        background: rgba(0, 0, 0, 0.05);
        color: #374151;
        border: 1px solid rgba(0, 0, 0, 0.1);
      }

      .ai-btn-secondary:hover {
        background: rgba(0, 0, 0, 0.1);
        transform: translateY(-1px);
      }

      @media (prefers-color-scheme: dark) {
        .ai-btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: #f3f4f6;
          border-color: rgba(255, 255, 255, 0.1);
        }
        .ai-btn-secondary:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      }

      .ai-helper-input-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      #aiPrompt {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        font-size: 13px;
        font-family: inherit;
        resize: none;
        background: rgba(255, 255, 255, 0.5);
        color: #374151;
        transition: all 0.15s ease;
      }

      #aiPrompt:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      @media (prefers-color-scheme: dark) {
        #aiPrompt {
          background: rgba(0, 0, 0, 0.2);
          border-color: rgba(255, 255, 255, 0.2);
          color: #f3f4f6;
        }
        #aiPrompt::placeholder {
          color: #9ca3af;
        }
      }

      .ai-btn-generate {
        background: #10b981;
        color: white;
        align-self: flex-end;
        padding: 6px 16px;
      }

      .ai-btn-generate:hover {
        background: #059669;
        transform: translateY(-1px);
      }

      .ai-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        transform: none !important;
      }

      /* Search Section */
      .ai-search-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      #searchQuery {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        font-size: 14px;
        font-family: inherit;
        background: rgba(255, 255, 255, 0.5);
        color: #374151;
        transition: all 0.15s ease;
      }

      #searchQuery:focus {
        outline: none;
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      @media (prefers-color-scheme: dark) {
        #searchQuery {
          background: rgba(0, 0, 0, 0.2);
          border-color: rgba(255, 255, 255, 0.2);
          color: #f3f4f6;
        }
        #searchQuery::placeholder {
          color: #9ca3af;
        }
      }

      .ai-search-buttons {
        display: flex;
        justify-content: center;
      }

      .ai-search-engines {
        display: flex;
        gap: 16px;
        justify-content: center;
      }

      .ai-search-engines label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #6b7280;
        cursor: pointer;
      }

      @media (prefers-color-scheme: dark) {
        .ai-search-engines label {
          color: #9ca3af;
        }
      }

      .ai-search-engines input[type="radio"] {
        accent-color: #3b82f6;
      }

      /* OCR Section */
      .ai-ocr-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .ai-ocr-buttons {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
      }

      .ai-ocr-options {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .ai-ocr-options label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #6b7280;
        cursor: pointer;
      }

      @media (prefers-color-scheme: dark) {
        .ai-ocr-options label {
          color: #9ca3af;
        }
      }

      .ai-ocr-options input[type="checkbox"] {
        accent-color: #3b82f6;
      }
    `;

    document.head.appendChild(styles);
  }

  bindEvents() {
    // 改用 focus + selectionchange，减少 hover 干扰
    document.addEventListener('focus', (e) => this.handleInputFocus(e), true);
    document.addEventListener('blur', (e) => this.handleInputBlur(e), true);
    document.addEventListener('selectionchange', () => this.handleSelectionChange(), true);

    // 延迟绑定按钮事件，确保DOM已创建
    setTimeout(() => {
      this.bindButtonEvents();
    }, 100);
  }

  bindButtonEvents() {
    // 基础按钮
    const closeBtn = document.getElementById('aiHelperClose');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hideHelper());

    // 标签页切换
    const tabs = document.querySelectorAll('.ai-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // 写作功能
    const improveBtn = document.getElementById('aiImprove');
    const shortenBtn = document.getElementById('aiShorten');
    const expandBtn = document.getElementById('aiExpand');
    const grammarBtn = document.getElementById('aiGrammar');
    const generateBtn = document.getElementById('aiGenerate');

    if (improveBtn) improveBtn.addEventListener('click', () => this.improveText());
    if (shortenBtn) shortenBtn.addEventListener('click', () => this.shortenText());
    if (expandBtn) expandBtn.addEventListener('click', () => this.expandText());
    if (grammarBtn) grammarBtn.addEventListener('click', () => this.checkGrammar());
    if (generateBtn) generateBtn.addEventListener('click', () => this.generateText());

    // 搜索功能
    const searchBtn = document.getElementById('aiSearch');
    const searchInput = document.getElementById('searchQuery');
    if (searchBtn) searchBtn.addEventListener('click', () => this.performSearch());
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.performSearch();
      });
    }

    // OCR功能
    const ocrPageBtn = document.getElementById('aiOCRPage');
    const ocrAreaBtn = document.getElementById('aiOCRArea');
    if (ocrPageBtn) ocrPageBtn.addEventListener('click', () => this.performOCR('page'));
    if (ocrAreaBtn) ocrAreaBtn.addEventListener('click', () => this.performOCR('area'));
  }

  switchTab(tabName) {
    // 切换标签页
    document.querySelectorAll('.ai-tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelectorAll('.ai-tab-content').forEach(content => {
      content.classList.remove('active');
    });

    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}Tab`).classList.add('active');
  }

  isInputElement(element) {
    if (!element) return false;
    
    const tagName = element.tagName.toLowerCase();
    const type = element.type?.toLowerCase();
    const role = element.getAttribute('role');
    const contentEditable = element.contentEditable;
    
    // 基本输入框
    if (tagName === 'textarea') return true;
    
    // 各种类型的input
    if (tagName === 'input') {
      const validTypes = [
        'text', 'email', 'password', 'search', 'url', 'tel', 
        'number', 'date', 'datetime-local', 'month', 'week', 'time'
      ];
      return !type || validTypes.includes(type);
    }
    
    // 可编辑元素
    if (contentEditable === 'true' || contentEditable === '') return true;
    
    // ARIA角色
    if (role && ['textbox', 'searchbox', 'combobox'].includes(role)) return true;
    
    // 常见的富文本编辑器
    if (element.classList.contains('ql-editor')) return true; // Quill
    if (element.classList.contains('fr-element')) return true; // Froala
    if (element.classList.contains('cke_editable')) return true; // CKEditor
    if (element.classList.contains('tox-edit-area')) return true; // TinyMCE
    if (element.classList.contains('DraftEditor-editorContainer')) return true; // Draft.js
    if (element.classList.contains('notranslate')) return true; // Google Docs
    if (element.classList.contains('ace_text-input')) return true; // Ace Editor
    if (element.classList.contains('CodeMirror-code')) return true; // CodeMirror
    
    // 特殊网站适配
    if (element.closest('[data-testid*="input"]')) return true; // React测试ID
    if (element.closest('[data-cy*="input"]')) return true; // Cypress测试ID
    if (element.closest('.input-group')) return true; // Bootstrap
    if (element.closest('.form-control')) return true; // Bootstrap
    if (element.closest('.ant-input')) return true; // Ant Design
    if (element.closest('.el-input')) return true; // Element UI
    if (element.closest('[class*="input"]') && element.getAttribute('placeholder')) return true;
    
    // 检查是否在表单中且有占位符
    if (element.closest('form') && element.getAttribute('placeholder')) return true;
    
    return false;
  }

  isExtensionElement(element) {
    if (!element) return false;
    
    // 检查是否是我们自己创建的AI助手元素
    if (element.closest('#ai-input-helper')) return true;
    
    // 检查是否在Chrome扩展的侧边面板中
    if (element.closest('[data-extension-id]')) return true;
    
    // 特殊检查：如果页面只有一个主要的侧边栏容器，很可能是扩展的侧边面板
    const possibleSidePanels = document.querySelectorAll('body > div');
    for (const panel of possibleSidePanels) {
      const style = window.getComputedStyle(panel);
      const rect = panel.getBoundingClientRect();
      
      // 判断是否为侧边面板的特征
      if (style.position === 'fixed' && 
          parseInt(style.zIndex) > 100 &&
          (rect.left === 0 || rect.right === window.innerWidth) && // 贴边
          rect.height > window.innerHeight * 0.5 && // 高度超过一半
          rect.width < window.innerWidth * 0.5 && // 宽度小于一半
          panel.contains(element)) {
        return true;
      }
    }
    
    // 检查常见的扩展容器类名
    const extensionSelectors = [
      // Chrome扩展相关
      '[data-chrome-extension]',
      '[data-extension]',
      '.chrome-extension',
      '.extension-panel',
      '.side-panel',
      
      // 常见的扩展UI类名
      '.extension-ui',
      '.extension-content',
      '.extension-widget',
      '.browser-extension',
      
      // 侧边栏相关
      '.sidebar',
      '.sidepanel',
      '.side-bar',
      '.panel',
      
      // 特定的扩展识别
      '[role="complementary"]',
      '[aria-label*="extension"]',
      '[aria-label*="sidebar"]',
      '[aria-label*="panel"]'
    ];
    
    for (const selector of extensionSelectors) {
      if (element.closest(selector)) return true;
    }
    
    // 检查是否在固定定位且z-index很高的容器中（通常是扩展UI）
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      const style = window.getComputedStyle(parent);
      if (style.position === 'fixed' && parseInt(style.zIndex) > 1000) {
        // 进一步检查是否可能是扩展元素
        const rect = parent.getBoundingClientRect();
        if (rect.width < window.innerWidth * 0.7) { // 侧边栏通常不会占满整个宽度
          return true;
        }
      }
      parent = parent.parentElement;
    }
    
    // 检查URL是否为扩展页面
    if (window.location.protocol === 'chrome-extension:' || 
        window.location.protocol === 'moz-extension:' ||
        window.location.protocol === 'edge-extension:') {
      return true;
    }
    
    // 检查元素是否包含扩展相关的ID或类名
    const elementClasses = element.className || '';
    const elementId = element.id || '';
    
    if (elementClasses.includes('extension') || 
        elementClasses.includes('sidebar') || 
        elementClasses.includes('panel') ||
        elementId.includes('extension') ||
        elementId.includes('sidebar') ||
        elementId.includes('panel')) {
      return true;
    }
    
    // 最后的检查：看是否在document.body的直接子元素中，且该元素看起来像侧边栏
    let topLevelParent = element;
    while (topLevelParent.parentElement && topLevelParent.parentElement !== document.body) {
      topLevelParent = topLevelParent.parentElement;
    }
    
    if (topLevelParent.parentElement === document.body) {
      const style = window.getComputedStyle(topLevelParent);
      const rect = topLevelParent.getBoundingClientRect();
      
      // 如果是固定定位，贴左边或右边，且宽度相对较小的元素，很可能是侧边栏
      if (style.position === 'fixed' && 
          (rect.left <= 10 || rect.right >= window.innerWidth - 10) &&
          rect.width > 200 && rect.width < window.innerWidth * 0.6 &&
          rect.height > window.innerHeight * 0.7) {
        return true;
      }
    }
    
    return false;
  }

  // 移除 hover 触发，避免误触

  handleInputLeave(e) {
    if (!this.isInputElement(e.target)) return;
    
    clearTimeout(this.showTimeout);
    
    // 延迟隐藏，给用户时间移动到助手工具上
    this.hideTimeout = setTimeout(() => {
      if (!this.helperWidget.matches(':hover')) {
        this.hideHelper();
      }
    }, 200);
  }

  handleInputFocus(e) {
    if (this.enabled === false) return;
    if (!this.isInputElement(e.target)) return;
    if (!this.settings?.baseUrl || !this.settings?.apiKey) return;
    
    // 排除扩展内部的元素
    if (this.isExtensionElement(e.target)) return;
    
    this.currentInput = e.target;
    clearTimeout(this.hideTimeout);
    this.showHelper(e);
  }

  handleInputBlur(e) {
    // 不立即隐藏，让用户可以使用助手工具
  }

  handleSelectionChange() {
    if (!this.currentInput || !this.isVisible) return;
    const selection = document.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      const left = Math.min(
        Math.max(rect.left + rect.width / 2 - 170 + window.scrollX, 10),
        window.scrollX + window.innerWidth - 340 - 10
      );
      const top = Math.min(
        rect.bottom + 8 + window.scrollY,
        window.scrollY + window.innerHeight - 260
      );
      this.helperWidget.style.left = `${left}px`;
      this.helperWidget.style.top = `${top}px`;
    }
  }

  showHelper(e) {
    if (!this.currentInput || this.isVisible) return;

    const rect = this.currentInput.getBoundingClientRect();
    // 在不同缩放/滚动下更稳健的定位
    
    // 计算最佳位置
    let left = rect.right + 12 + window.scrollX;
    let top = rect.top + window.scrollY;

    // 边界检查
    const helperWidth = 340;
    const helperHeight = 260; // 预估高度
    if (left + helperWidth > window.scrollX + window.innerWidth) {
      left = rect.left + window.scrollX - (helperWidth + 12);
    }
    if (top + helperHeight > window.scrollY + window.innerHeight) {
      top = rect.bottom + window.scrollY - helperHeight;
    }
    if (left < 10) left = 10;
    if (top < 10) top = 10;

    this.helperWidget.style.left = `${left}px`;
    this.helperWidget.style.top = `${top}px`;
    this.helperWidget.style.display = 'block';
    
    // 触发动画
    requestAnimationFrame(() => {
      this.helperWidget.classList.add('visible');
    });
    
    this.isVisible = true;

    // 鼠标离开助手工具时隐藏
    this.helperWidget.addEventListener('mouseleave', () => {
      this.hideHelper();
    });
  }

  hideHelper() {
    if (!this.isVisible) return;
    
    this.helperWidget.classList.remove('visible');
    setTimeout(() => {
      this.helperWidget.style.display = 'none';
    }, 200);
    
    this.isVisible = false;
    this.currentInput = null;
  }

  async improveText() {
    if (!this.currentInput) return;
    await this.processText('Improve this text to make it clearer, more engaging, and better written');
  }

  async shortenText() {
    if (!this.currentInput) return;
    await this.processText('Make this text shorter and more concise while keeping the main meaning');
  }

  async expandText() {
    if (!this.currentInput) return;
    await this.processText('Expand this text with more details, examples, and elaboration');
  }

  async checkGrammar() {
    if (!this.currentInput) return;
    await this.processText('Check and correct any grammar, spelling, or punctuation errors in this text');
  }

  async generateText() {
    const prompt = document.getElementById('aiPrompt')?.value?.trim();
    if (!prompt || !this.currentInput) return;

    await this.processText(`Write content based on this request: ${prompt}. Make it clear, engaging, and well-structured.`);
  }

  async processText(instruction) {
    if (!this.currentInput || !this.settings) return;

    const originalText = this.currentInput.value || this.currentInput.textContent || '';
    const promptText = instruction.includes('Write content') ? instruction : `${instruction}: "${originalText}"`;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'WRITING_REQUEST',
        prompt: promptText,
        settings: this.settings
      });

      if (response.success) {
        // 设置新文本
        if (this.currentInput.tagName.toLowerCase() === 'textarea' || this.currentInput.tagName.toLowerCase() === 'input') {
          this.currentInput.value = response.content;
        } else {
          this.currentInput.textContent = response.content;
        }
        
        // 触发input事件
        this.currentInput.dispatchEvent(new Event('input', { bubbles: true }));
        
        this.hideHelper();
        this.showNotification('Text processed successfully!', 'success');
      } else {
        this.showNotification('Failed to process text: ' + response.error, 'error');
      }
    } catch (error) {
      this.showNotification('Processing failed', 'error');
    }
  }

  async performSearch() {
    const query = document.getElementById('searchQuery')?.value?.trim();
    if (!query) return;

    const selectedEngine = document.querySelector('input[name="searchEngine"]:checked')?.value || 'google';
    
    let searchUrl;
    switch (selectedEngine) {
      case 'google':
        searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
        break;
      case 'bing':
        searchUrl = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
        break;
      case 'duckduckgo':
        searchUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
        break;
    }

    try {
      // 打开新标签页进行搜索
      const newTab = await chrome.runtime.sendMessage({
        type: 'OPEN_SEARCH_TAB',
        url: searchUrl,
        query: query
      });

      this.hideHelper();
      this.showNotification(`Searching for "${query}" in ${selectedEngine}...`, 'success');
    } catch (error) {
      this.showNotification('Failed to open search tab', 'error');
    }
  }

  async performOCR(mode) {
    const includeImages = document.getElementById('includeImages')?.checked;
    const translateText = document.getElementById('translateText')?.checked;

    try {
      let ocrResult;
      
      if (mode === 'page') {
        // 全页面OCR
        ocrResult = await this.extractPageText(includeImages);
      } else {
        // 区域选择OCR
        ocrResult = await this.selectAreaForOCR(includeImages);
      }

      if (ocrResult) {
        let finalText = ocrResult;
        
        if (translateText) {
          finalText = await this.translateText(ocrResult);
        }

        // 将识别的文本插入到当前输入框
        if (this.currentInput) {
          if (this.currentInput.tagName.toLowerCase() === 'textarea' || this.currentInput.tagName.toLowerCase() === 'input') {
            this.currentInput.value = finalText;
          } else {
            this.currentInput.textContent = finalText;
          }
          
          this.currentInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        this.hideHelper();
        this.showNotification('Text extracted successfully!', 'success');
      }
    } catch (error) {
      this.showNotification('OCR extraction failed', 'error');
    }
  }

  async extractPageText(includeImages) {
    // 提取页面所有文本
    let allText = document.body.innerText || document.body.textContent || '';
    
    if (includeImages) {
      // 提取图片中的文本（使用Tesseract.js或类似库）
      const images = document.querySelectorAll('img[src]');
      for (const img of images) {
        try {
          const imageText = await this.extractTextFromImage(img.src);
          if (imageText) {
            allText += '\n\n[Image Text]: ' + imageText;
          }
        } catch (e) {
          console.log('Failed to extract text from image:', e);
        }
      }
    }

    return allText.trim();
  }

  async selectAreaForOCR(includeImages) {
    return new Promise((resolve) => {
      // 创建选择覆盖层
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.3);
        z-index: 2147483646;
        cursor: crosshair;
      `;

      let isSelecting = false;
      let startX, startY, endX, endY;
      const selectionBox = document.createElement('div');
      selectionBox.style.cssText = `
        position: fixed;
        border: 2px dashed #3b82f6;
        background: rgba(59, 130, 246, 0.1);
        z-index: 2147483647;
        pointer-events: none;
      `;

      overlay.addEventListener('mousedown', (e) => {
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;
        document.body.appendChild(selectionBox);
      });

      overlay.addEventListener('mousemove', (e) => {
        if (!isSelecting) return;
        
        endX = e.clientX;
        endY = e.clientY;
        
        const left = Math.min(startX, endX);
        const top = Math.min(startY, endY);
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);
        
        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
      });

      overlay.addEventListener('mouseup', async (e) => {
        if (!isSelecting) return;
        
        isSelecting = false;
        document.body.removeChild(overlay);
        document.body.removeChild(selectionBox);
        
        const left = Math.min(startX, endX);
        const top = Math.min(startY, endY);
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);
        
        // 提取选定区域的文本
        const selectedText = await this.extractTextFromArea(left, top, width, height, includeImages);
        resolve(selectedText);
      });

      document.body.appendChild(overlay);
    });
  }

  async extractTextFromArea(left, top, width, height, includeImages) {
    // 获取指定区域内的所有元素
    const elements = document.elementsFromPoint(left + width/2, top + height/2);
    let areaText = '';
    
    elements.forEach(element => {
      const rect = element.getBoundingClientRect();
      if (rect.left >= left && rect.top >= top && 
          rect.right <= left + width && rect.bottom <= top + height) {
        areaText += element.innerText || element.textContent || '';
      }
    });

    if (includeImages) {
      // 处理区域内的图片
      const images = document.querySelectorAll('img[src]');
      for (const img of images) {
        const rect = img.getBoundingClientRect();
        if (rect.left >= left && rect.top >= top && 
            rect.right <= left + width && rect.bottom <= top + height) {
          try {
            const imageText = await this.extractTextFromImage(img.src);
            if (imageText) {
              areaText += '\n[Image Text]: ' + imageText;
            }
          } catch (e) {
            console.log('Failed to extract text from image:', e);
          }
        }
      }
    }

    return areaText.trim();
  }

  async extractTextFromImage(imageSrc) {
    // 这里可以集成Tesseract.js或调用OCR API
    // 为了演示，返回一个模拟结果
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'OCR_REQUEST',
        imageSrc: imageSrc,
        settings: this.settings
      });
      
      if (response.success) {
        return response.text;
      }
    } catch (error) {
      console.log('OCR API failed, using fallback method');
    }
    
    return `[Text from image: ${imageSrc.split('/').pop()}]`;
  }

  async translateText(text) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'TRANSLATE_REQUEST',
        text: text,
        settings: this.settings
      });
      
      if (response.success) {
        return response.translatedText;
      }
    } catch (error) {
      console.log('Translation failed');
    }
    
    return text;
  }

  showNotification(message, type) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#10b981' : '#ef4444'};
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 2147483648;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    requestAnimationFrame(() => {
      notification.style.transform = 'translateX(0)';
    });
    
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (document.body.contains(notification)) {
          document.body.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
}

// 等待页面加载后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new PageContentExtractor();
  });
} else {
  new PageContentExtractor();
}
