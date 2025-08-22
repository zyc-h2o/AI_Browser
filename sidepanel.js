class AIBrowserAssistant {
  constructor() {
    this.settings = {
      baseUrl: '',
      apiKey: '',
      model: 'gpt-4o'
    };
    this.currentPageContent = '';
    this.conversationHistory = [];
    this.selectedText = '';
    
    this.initializeElements();
    this.bindEvents();
    this.loadSettings();
    this.updatePageInfo();
    this.initializeWritingAssistant();
  }

  initializeElements() {
    // 设置相关元素
    this.settingsBtn = document.getElementById('settingsBtn');
    this.settingsPanel = document.getElementById('settingsPanel');
    this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
    this.saveSettingsBtn = document.getElementById('saveSettings');
    this.baseUrlInput = document.getElementById('baseUrl');
    this.apiKeyInput = document.getElementById('apiKey');
    this.modelInput = document.getElementById('model');
    this.enableGlobalHelperSelect = document.getElementById('enableGlobalHelper');
    this.disableOnThisSiteCheckbox = document.getElementById('disableOnThisSite');

    // 聊天相关元素
    this.chatMessages = document.getElementById('chatMessages');
    this.chatInput = document.getElementById('chatInput');
    this.sendBtn = document.getElementById('sendBtn');
    // Research bar
    this.researchQuery = document.getElementById('researchQuery');
    this.pageTitle = document.getElementById('pageTitle');
    this.statusIndicator = document.getElementById('statusIndicator');
    this.statusText = document.getElementById('statusText');

    // AI写作助手元素
    this.writingAssistant = document.getElementById('writingAssistant');
    this.closeWritingBtn = document.getElementById('closeWritingBtn');
    this.writingPrompt = document.getElementById('writingPrompt');
    this.generateBtn = document.getElementById('generateBtn');
    this.selectionToolbar = document.getElementById('selectionToolbar');
    this.improveBtn = document.getElementById('improveBtn');
    this.shortenBtn = document.getElementById('shortenBtn');
    this.expandBtn = document.getElementById('expandBtn');
    this.grammarBtn = document.getElementById('grammarBtn');
  }

  bindEvents() {
    // 设置面板事件
    this.settingsBtn.addEventListener('click', () => this.showSettings());
    this.closeSettingsBtn.addEventListener('click', () => this.hideSettings());
    this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());

    // 聊天事件
    this.sendBtn.addEventListener('click', () => this.sendMessage());
    this.chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.chatInput.addEventListener('input', () => this.adjustTextareaHeight());
    this.chatInput.addEventListener('input', () => this.updateSendButton());
    // 在扩展内部不显示写作助手，避免遮挡内容
    // this.chatInput.addEventListener('focus', () => this.showWritingAssistant());

    // Research events
    if (this.researchQuery) {
      this.researchQuery.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.handleResearch();
      });
    }

    // AI写作助手事件
    this.closeWritingBtn.addEventListener('click', () => this.hideWritingAssistant());
    this.generateBtn.addEventListener('click', () => this.generateWriting());
    this.improveBtn.addEventListener('click', () => this.improveText());
    this.shortenBtn.addEventListener('click', () => this.shortenText());
    this.expandBtn.addEventListener('click', () => this.expandText());
    this.grammarBtn.addEventListener('click', () => this.checkGrammar());

    // 监听来自content script的消息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'PAGE_CONTENT_UPDATED') {
        this.currentPageContent = message.content;
        this.updatePageInfo();
        // 更新页面标题显示
        if (message.pageInfo && message.pageInfo.title) {
          this.pageTitle.textContent = message.pageInfo.title;
        }
      }
    });
  }

  async handleResearch() {
    const query = this.researchQuery?.value.trim();
    if (!query) return;
    if (!this.settings.baseUrl || !this.settings.apiKey) {
      this.showToast('Please configure API settings first', 'error');
      return;
    }

    this.addMessage(`🔍 ${query}`, 'user');
    this.researchQuery.value = '';
    this.showTypingIndicator();

    try {
      // 首先尝试Google搜索
      let response = await this.sendToBackground({
        type: 'SEARCH_AND_READ',
        query,
        engine: 'google',
        settings: this.settings,
        maxResults: 4
      });
      
      // 如果Google搜索失败，尝试DuckDuckGo作为备用
      if (!response?.success) {
        console.warn('Google search failed, trying DuckDuckGo as fallback');
        this.addMessage('🔄 Google搜索受限，尝试备用搜索引擎...', 'bot');
        response = await this.sendToBackground({
          type: 'SEARCH_AND_READ',
          query,
          engine: 'duckduckgo',
          settings: this.settings,
          maxResults: 4
        });
      }
      
      this.hideTypingIndicator();
      
      if (response?.success) {
        let message = response.answer;
        if (response.sources?.length > 0) {
          message += '\n\n📚 **Sources:**\n';
          response.sources.forEach(s => {
            const domain = new URL(s.url).hostname;
            message += `• [${s.id}] ${domain}\n`;
          });
        }
        this.addMessage(message, 'bot');
      } else {
        // 搜索失败时自动降级到普通聊天模式
        console.warn('Search failed, falling back to normal chat:', response?.error);
        this.addMessage('🔍 搜索遇到限制，我将基于现有知识回答你的问题：', 'bot');
        await this.handleNormalChat(query);
      }
    } catch (e) {
      this.hideTypingIndicator();
      console.error('Research error:', e);
      this.addMessage('❌ 搜索遇到问题，可能是网络连接或搜索引擎限制。请稍后重试或直接在聊天中提问。', 'bot');
    }
  }

  showSettings() {
    this.settingsPanel.classList.add('active');
  }

  hideSettings() {
    this.settingsPanel.classList.remove('active');
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['aiSettings']);
      if (result.aiSettings) {
        this.settings = { ...this.settings, ...result.aiSettings };
        this.baseUrlInput.value = this.settings.baseUrl;
        this.apiKeyInput.value = this.settings.apiKey;
        this.modelInput.value = this.settings.model;
        if (this.enableGlobalHelperSelect) {
          this.enableGlobalHelperSelect.value = this.settings.enableGlobalHelper === false ? 'off' : 'on';
        }
        // 当前站点禁用
        if (this.disableOnThisSiteCheckbox) {
          const hostname = new URL(location.href).hostname;
          const disabledSites = this.settings.disabledSites || [];
          this.disableOnThisSiteCheckbox.checked = disabledSites.includes(hostname);
        }
        this.updateConnectionStatus();
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async saveSettings() {
    const newSettings = {
      baseUrl: this.baseUrlInput.value.trim(),
      apiKey: this.apiKeyInput.value.trim(),
      model: this.modelInput.value.trim() || 'gpt-3.5-turbo',
      enableGlobalHelper: this.enableGlobalHelperSelect ? this.enableGlobalHelperSelect.value === 'on' : true
    };

    // 合并站点禁用列表
    const currentHostname = new URL(location.href).hostname;
    const prev = (await chrome.storage.local.get(['aiSettings'])).aiSettings || {};
    const disabledSites = new Set(prev.disabledSites || []);
    if (this.disableOnThisSiteCheckbox?.checked) disabledSites.add(currentHostname);
    else disabledSites.delete(currentHostname);
    newSettings.disabledSites = Array.from(disabledSites);

    // 基本验证
    if (!newSettings.baseUrl) {
      this.showToast('请输入Base URL', 'error');
      return;
    }

    if (!newSettings.apiKey) {
      this.showToast('请输入API Key', 'error');
      return;
    }

    // 验证URL格式
    try {
      new URL(newSettings.baseUrl);
    } catch {
      this.showToast('Base URL格式不正确', 'error');
      return;
    }

    try {
      await chrome.storage.local.set({ aiSettings: newSettings });
      this.settings = newSettings;
      // 通知所有tab设置已更新（用于content脚本热更新行为）
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: 'AI_SETTINGS_UPDATED' });
          }
        });
      });
      this.hideSettings();
      this.showToast('设置已保存', 'success');
      this.updateConnectionStatus();
    } catch (error) {
      console.error('Failed to save settings:', error);
      this.showToast('保存设置失败', 'error');
    }
  }

  updateConnectionStatus() {
    const isConfigured = this.settings.baseUrl && this.settings.apiKey;
    
    if (isConfigured) {
      this.statusIndicator.className = 'status-indicator connected';
      this.statusText.textContent = 'Connected';
      this.updateSendButton();
    } else {
      this.statusIndicator.className = 'status-indicator';
      this.statusText.textContent = 'Not configured';
      this.sendBtn.disabled = true;
    }
  }

  updateSendButton() {
    const hasText = this.chatInput.value.trim().length > 0;
    const isConfigured = this.settings.baseUrl && this.settings.apiKey;
    this.sendBtn.disabled = !hasText || !isConfigured;
  }

  adjustTextareaHeight() {
    this.chatInput.style.height = 'auto';
    this.chatInput.style.height = Math.min(this.chatInput.scrollHeight, 120) + 'px';
  }

  async updatePageInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        this.pageTitle.textContent = tab.title || '当前页面';
        
        // 请求页面内容
        chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' }, (response) => {
          if (response && response.content) {
            this.currentPageContent = response.content;
          }
        });
      }
    } catch (error) {
      console.error('Failed to update page info:', error);
    }
  }

  async sendMessage() {
    const message = this.chatInput.value.trim();
    if (!message || !this.settings.baseUrl || !this.settings.apiKey) return;

    // 添加用户消息到界面
    this.addMessage(message, 'user');
    this.chatInput.value = '';
    this.adjustTextareaHeight();
    this.updateSendButton();

    // 显示typing指示器
    this.showTypingIndicator();

    try {
      // 首先判断是否需要搜索和访问网页
      const needsWebSearch = await this.analyzeIfNeedsWebSearch(message);
      
      if (needsWebSearch.needsSearch) {
        await this.handleIntelligentWebSearch(message, needsWebSearch);
      } else {
        // 普通聊天处理
        await this.handleNormalChat(message);
      }
    } catch (error) {
      this.hideTypingIndicator();
      this.addMessage('连接失败，请检查网络或API设置', 'bot');
      console.error('Chat error:', error);
    }
  }

  async analyzeIfNeedsWebSearch(message) {
    try {
      // 使用AI分析是否需要搜索
      const analysisPrompt = `请分析以下用户消息是否需要进行网络搜索来获取最新信息。

用户消息："${message}"

请判断是否需要搜索，并按以下JSON格式回复：
{
  "needsSearch": true/false,
  "searchQuery": "如果需要搜索，提供搜索关键词",
  "reason": "判断理由"
}

需要搜索的情况包括：
- 询问最新新闻、时事
- 查询实时数据（股价、天气等）
- 需要访问特定网站
- 询问当前时间相关信息
- 明确要求搜索或查找信息

不需要搜索的情况：
- 一般知识问答
- 代码编程问题
- 理论概念解释
- 基于当前页面内容的问题`;

      const response = await this.sendToBackground({
        type: 'CHAT_REQUEST',
        message: analysisPrompt,
        settings: this.settings
      });

      if (response.success) {
        // 尝试解析JSON响应，增加健壮性
        let analysis = {};
        try {
          analysis = JSON.parse(response.content);
        } catch (parseError) {
          console.warn('AI analysis parsing failed, attempting regex extraction:', parseError);
          // Fallback to regex if JSON parsing fails
          const needsSearchMatch = response.content.match(/"needsSearch":\s*(true|false)/);
          const searchQueryMatch = response.content.match(/"searchQuery":\s*"(.*?)"/);
          const reasonMatch = response.content.match(/"reason":\s*"(.*?)"/);

          if (needsSearchMatch) analysis.needsSearch = needsSearchMatch[1] === 'true';
          if (searchQueryMatch) analysis.searchQuery = searchQueryMatch[1];
          if (reasonMatch) analysis.reason = reasonMatch[1];
        }
        
        return {
          needsSearch: analysis.needsSearch || false,
          searchQuery: analysis.searchQuery || message,
          reason: analysis.reason || '基于AI分析'
        };
      } else {
        // API调用失败，使用关键词匹配
        console.warn('AI analysis failed (API call unsuccessful), using keyword fallback');
        const searchKeywords = [
          '今天', '今日', '最新', '新闻', '股价', '天气', '实时', '当前', 
          '搜索', '查找', '访问', '打开', '网站', '最近', '现在', '目前',
          'today', 'latest', 'news', 'current', 'search', 'find', 'visit'
        ];
        
        const needsSearch = searchKeywords.some(keyword => 
          message.toLowerCase().includes(keyword.toLowerCase())
        );
        
        return {
          needsSearch: needsSearch,
          searchQuery: message,
          reason: '关键词匹配（API调用失败后备方案）'
        };
      }
    } catch (error) {
      console.error('Analysis error:', error);
      // 出错时使用关键词匹配作为后备
      const searchKeywords = [
        '今天', '今日', '最新', '新闻', '股价', '天气', '实时', '当前', 
        '搜索', '查找', '访问', '打开', '网站', '最近', '现在', '目前',
        'today', 'latest', 'news', 'current', 'search', 'find', 'visit'
      ];
      
      const needsSearch = searchKeywords.some(keyword => 
        message.toLowerCase().includes(keyword.toLowerCase())
      );
      
      return {
        needsSearch: needsSearch,
        searchQuery: message,
        reason: '关键词匹配（错误处理后备方案）'
      };
    }
  }

  async handleIntelligentWebSearch(originalMessage, analysis) {
    this.addMessage(`🔍 正在搜索：${analysis.searchQuery || originalMessage}`, 'bot');

    try {
      let searchResults;
      
      // 如果有特定URL，直接访问
      if (analysis.specificUrl) {
        searchResults = await this.visitSpecificUrl(analysis.specificUrl);
      } else {
        // 否则进行搜索
        searchResults = await this.performWebSearch(analysis.searchQuery || originalMessage);
      }

      if (searchResults && searchResults.length > 0) {
        // 自动访问最相关的页面
        const pageContent = await this.autoVisitPages(searchResults.slice(0, 3));
        
        // 基于搜索结果和页面内容回答用户问题
        await this.answerWithWebContent(originalMessage, pageContent, searchResults);
      } else {
        this.addMessage('❌ 未找到相关信息，将基于现有知识回答', 'bot');
        await this.handleNormalChat(originalMessage);
      }
    } catch (error) {
      console.error('Web search error:', error);
      this.addMessage('🔍 搜索过程中出现错误，将基于现有知识回答', 'bot');
      await this.handleNormalChat(originalMessage);
    }
  }

  async performWebSearch(query) {
    try {
      const response = await this.sendToBackground({
        type: 'WEB_SEARCH',
        query: query,
        maxResults: 5
      });

      if (response.success) {
        this.addMessage(`📋 找到 ${response.results.length} 个相关结果`, 'bot');
        return response.results;
      }
      return [];
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  async visitSpecificUrl(url) {
    try {
      this.addMessage(`🌐 正在访问：${url}`, 'bot');
      
      const response = await this.sendToBackground({
        type: 'VISIT_URL',
        url: url
      });

      if (response.success) {
        this.addMessage(`✅ 成功读取页面内容`, 'bot');
        return [{ url: url, content: response.content, title: response.title }];
      }
      return [];
    } catch (error) {
      console.error('URL visit error:', error);
      return [];
    }
  }

  async autoVisitPages(searchResults) {
    const pageContents = [];
    
    for (let i = 0; i < Math.min(searchResults.length, 3); i++) {
      const result = searchResults[i];
      try {
        this.addMessage(`📖 正在读取：${result.title}`, 'bot');
        
        const response = await this.sendToBackground({
          type: 'VISIT_URL',
          url: result.url
        });

        if (response.success) {
          pageContents.push({
            url: result.url,
            title: result.title,
            content: response.content,
            snippet: result.snippet
          });
          this.addMessage(`✅ 已读取：${result.title}`, 'bot');
        }
      } catch (error) {
        console.error(`Error visiting ${result.url}:`, error);
      }
    }
    
    return pageContents;
  }

  async answerWithWebContent(originalMessage, pageContents, searchResults) {
    let contextPrompt = `基于以下搜索结果和网页内容，回答用户问题：

用户问题：${originalMessage}

搜索结果：
${searchResults.map((r, i) => `${i + 1}. ${r.title}\n   ${r.snippet}\n   ${r.url}`).join('\n\n')}

网页内容：
${pageContents.map((p, i) => `
=== 页面 ${i + 1}: ${p.title} ===
URL: ${p.url}
内容摘要: ${p.content.substring(0, 1000)}...
`).join('\n')}

请基于这些信息提供准确、详细的回答。如果信息不足，请说明。同时在回答末尾列出参考来源。`;

    const response = await this.sendToBackground({
      type: 'CHAT_REQUEST',
      message: contextPrompt,
      settings: this.settings
    });

    this.hideTypingIndicator();

    if (response.success) {
      this.addMessage(response.content, 'bot');
      this.conversationHistory.push(
        { role: 'user', content: originalMessage },
        { role: 'assistant', content: response.content }
      );
    } else {
      this.addMessage('抱歉，处理搜索结果时发生错误：' + response.error, 'bot');
    }
  }

  async handleNormalChat(message) {
    try {
      // 构建上下文信息
      const contextPrompt = this.buildContextPrompt(message);
      
      // 发送到后台脚本处理API调用
      const response = await this.sendToBackground({
        type: 'CHAT_REQUEST',
        message: contextPrompt,
        settings: this.settings
      });

      this.hideTypingIndicator();

      if (response.success) {
        this.addMessage(response.content, 'bot');
        this.conversationHistory.push(
          { role: 'user', content: message },
          { role: 'assistant', content: response.content }
        );
      } else {
        this.addMessage('抱歉，发生了错误：' + response.error, 'bot');
      }
    } catch (error) {
      this.hideTypingIndicator();
      this.addMessage('连接失败，请检查网络或API设置', 'bot');
      console.error('Chat error:', error);
    }
  }

  buildContextPrompt(userMessage) {
    let prompt = '';
    
    if (this.currentPageContent) {
      prompt += `当前网页内容：\n${this.currentPageContent}\n\n`;
    }
    
    prompt += `用户问题：${userMessage}`;
    
    if (this.conversationHistory.length > 0) {
      prompt += '\n\n之前的对话历史：\n';
      this.conversationHistory.slice(-6).forEach(msg => {
        prompt += `${msg.role === 'user' ? '用户' : 'AI'}：${msg.content}\n`;
      });
    }
    
    return prompt;
  }

  sendToBackground(message) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(message, resolve);
    });
  }

  addMessage(content, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.innerHTML = this.formatMessage(content);
    
    messageDiv.appendChild(contentDiv);
    
    // 移除欢迎消息
    const welcomeMessage = this.chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
      welcomeMessage.remove();
    }
    
    this.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
  }

  formatMessage(content) {
    // 简单的markdown样式处理
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>')
      .replace(/\n/g, '<br>');
  }

  showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message typing-indicator';
    typingDiv.innerHTML = `
      <div class="message-content">
        AI正在思考中
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    `;
    
    this.chatMessages.appendChild(typingDiv);
    this.scrollToBottom();
  }

  hideTypingIndicator() {
    const typingIndicator = this.chatMessages.querySelector('.typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }

  scrollToBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // 触发动画
    setTimeout(() => toast.classList.add('show'), 100);
    
    // 自动隐藏
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 3000);
  }

  // AI写作助手功能
  initializeWritingAssistant() {
    // 监听文本选择
    document.addEventListener('mouseup', () => this.handleTextSelection());
    document.addEventListener('keyup', () => this.handleTextSelection());
  }

  showWritingAssistant() {
    if (!this.settings.baseUrl || !this.settings.apiKey) return;
    this.writingAssistant.classList.add('active');
  }

  hideWritingAssistant() {
    this.writingAssistant.classList.remove('active');
  }

  handleTextSelection() {
    // 在扩展内部不处理文本选择，避免遮挡内容
    return;
    
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();
    
    if (selectedText.length > 0) {
      this.selectedText = selectedText;
      this.showSelectionToolbar(selection);
    } else {
      this.hideSelectionToolbar();
    }
  }

  showSelectionToolbar(selection) {
    if (!this.settings.baseUrl || !this.settings.apiKey) return;
    
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    
    this.selectionToolbar.style.left = `${rect.left + (rect.width / 2) - 70}px`;
    this.selectionToolbar.style.top = `${rect.top - 45}px`;
    this.selectionToolbar.classList.add('active');
  }

  hideSelectionToolbar() {
    this.selectionToolbar.classList.remove('active');
  }

  async generateWriting() {
    const prompt = this.writingPrompt.value.trim();
    if (!prompt) return;

    this.generateBtn.disabled = true;
    this.generateBtn.textContent = 'Generating...';

    try {
      const response = await this.sendToBackground({
        type: 'WRITING_REQUEST',
        prompt: `Write content based on this request: ${prompt}. Make it clear, engaging, and well-structured.`,
        settings: this.settings
      });

      if (response.success) {
        // 将生成的内容插入到输入框
        this.chatInput.value = response.content;
        this.adjustTextareaHeight();
        this.updateSendButton();
        this.hideWritingAssistant();
        this.showToast('Content generated successfully!', 'success');
      } else {
        this.showToast('Failed to generate content: ' + response.error, 'error');
      }
    } catch (error) {
      this.showToast('Generation failed', 'error');
    } finally {
      this.generateBtn.disabled = false;
      this.generateBtn.textContent = 'Generate';
    }
  }

  async improveText() {
    if (!this.selectedText) return;
    await this.processSelectedText('Improve this text to make it clearer, more engaging, and better written');
  }

  async shortenText() {
    if (!this.selectedText) return;
    await this.processSelectedText('Make this text shorter and more concise while keeping the main meaning');
  }

  async expandText() {
    if (!this.selectedText) return;
    await this.processSelectedText('Expand this text with more details, examples, and elaboration');
  }

  async checkGrammar() {
    if (!this.selectedText) return;
    await this.processSelectedText('Check and correct any grammar, spelling, or punctuation errors in this text');
  }

  async processSelectedText(instruction) {
    this.hideSelectionToolbar();
    
    try {
      const response = await this.sendToBackground({
        type: 'WRITING_REQUEST',
        prompt: `${instruction}: "${this.selectedText}"`,
        settings: this.settings
      });

      if (response.success) {
        // 替换选中的文本
        this.replaceSelectedText(response.content);
        this.showToast('Text processed successfully!', 'success');
      } else {
        this.showToast('Failed to process text: ' + response.error, 'error');
      }
    } catch (error) {
      this.showToast('Processing failed', 'error');
    }
  }

  replaceSelectedText(newText) {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.deleteContents();
      range.insertNode(document.createTextNode(newText));
      selection.removeAllRanges();
    }
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  new AIBrowserAssistant();
});
