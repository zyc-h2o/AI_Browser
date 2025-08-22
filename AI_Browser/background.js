class AIBackgroundService {
  constructor() {
    this.setupMessageListener();
    this.setupSidePanel();
  }

  // 设置侧边面板
  setupSidePanel() {
    chrome.action.onClicked.addListener(async (tab) => {
      await chrome.sidePanel.open({ tabId: tab.id });
    });

    // 确保侧边面板可用
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  }

  // 设置消息监听
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'CHAT_REQUEST') {
        this.handleChatRequest(message, sendResponse);
        return true; // 异步响应
      } else if (message.type === 'WRITING_REQUEST') {
        this.handleWritingRequest(message, sendResponse);
        return true; // 异步响应
      } else if (message.type === 'SEARCH_AND_READ') {
        this.handleSearchAndRead(message, sendResponse);
        return true; // 异步响应
      } else if (message.type === 'WEB_SEARCH') {
        this.handleWebSearch(message, sendResponse);
        return true; // 异步响应
      } else if (message.type === 'VISIT_URL') {
        this.handleVisitUrl(message, sendResponse);
        return true; // 异步响应
      } else if (message.type === 'OPEN_SEARCH_TAB') {
        this.handleOpenSearchTab(message, sendResponse);
        return true; // 异步响应
      } else if (message.type === 'OCR_REQUEST') {
        this.handleOCRRequest(message, sendResponse);
        return true; // 异步响应
      } else if (message.type === 'TRANSLATE_REQUEST') {
        this.handleTranslateRequest(message, sendResponse);
        return true; // 异步响应
      }
    });
  }

  // 处理聊天请求
  async handleChatRequest(message, sendResponse) {
    try {
      const { message: userMessage, settings } = message;
      
      if (!settings.baseUrl || !settings.apiKey) {
        sendResponse({
          success: false,
          error: 'API配置不完整'
        });
        return;
      }

      const response = await this.callAIAPI(userMessage, settings);
      
      sendResponse({
        success: true,
        content: response
      });
      
    } catch (error) {
      console.error('Chat request error:', error);
      sendResponse({
        success: false,
        error: error.message || 'Request failed'
      });
    }
  }

  // 处理写作请求
  async handleWritingRequest(message, sendResponse) {
    try {
      const { prompt, settings } = message;
      
      if (!settings.baseUrl || !settings.apiKey) {
        sendResponse({
          success: false,
          error: 'API configuration incomplete'
        });
        return;
      }

      const response = await this.callAIAPI(prompt, settings, true);
      
      sendResponse({
        success: true,
        content: response
      });
      
    } catch (error) {
      console.error('Writing request error:', error);
      sendResponse({
        success: false,
        error: error.message || 'Writing request failed'
      });
    }
  }

  // 调用AI API
  async callAIAPI(message, settings, isWriting = false) {
    const { baseUrl, apiKey, model } = settings;
    
    // 构建API URL
    let apiUrl = baseUrl;
    // OpenRouter API typically uses /api/v1/chat/completions
    // Ensure the URL is correctly formed for OpenRouter
    if (!apiUrl.endsWith('/')) {
      apiUrl += '/';
    }
    if (!apiUrl.includes('chat/completions')) { // Check if chat/completions is already part of the base URL
      apiUrl += 'chat/completions';
    }

    console.log(`Calling AI API at: ${apiUrl}`);
    console.log(`Using model: ${model}`);
    console.log(`Requesting message: ${message.substring(0, 200)}...`);

    const systemPrompt = isWriting ? 
      'You are a professional writing assistant. Help users create, improve, and refine their text. Provide clear, engaging, and well-structured content. Focus on clarity, coherence, and style.' :
      'You are a professional AI assistant specialized in analyzing webpage content and answering user questions. Base your answers on the provided webpage content. If the content is insufficient, explain this and provide general advice. Be concise, accurate, and helpful.';

    const requestBody = {
      model: model || 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: message
        }
      ],
      max_tokens: isWriting ? 1500 : 1000,
      temperature: isWriting ? 0.8 : 0.7,
      stream: false
    };

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    // Add OpenRouter specific headers if needed
    // For example, if a specific model is required by OpenRouter that's not in the body
    // Or if they require a specific HTTP header for routing/tracking
    // For now, assuming standard OpenAI-compatible API.

    console.log('Request Headers:', headers);
    console.log('Request Body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API request failed: Status ${response.status}, Response: ${errorText}`);
      let errorMessage = `API请求失败: ${response.status}`;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
      } catch (e) {
        // Not a JSON error, use raw text
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('API Response Data:', data);
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('API响应格式错误或无有效内容');
    }

    return data.choices[0].message.content;
  }

  // 处理搜索标签页请求
  async handleOpenSearchTab(message, sendResponse) {
    try {
      const { url, query } = message;
      
      const tab = await chrome.tabs.create({
        url: url,
        active: true
      });

      // 等待标签页加载完成后分析内容
      chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
        if (tabId === tab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          
          // 向新标签页注入内容分析脚本
          chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
              // 分析搜索结果页面
              setTimeout(() => {
                chrome.runtime.sendMessage({
                  type: 'SEARCH_RESULTS_READY',
                  query: query
                });
              }, 2000);
            }
          });
        }
      });

      sendResponse({
        success: true,
        tabId: tab.id
      });
      
    } catch (error) {
      console.error('Failed to open search tab:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  // 聚合检索与阅读：搜索→抓取→抽取→总结
  async handleSearchAndRead(message, sendResponse) {
    const { query, settings, engine = 'google', maxResults = 5 } = message;
    console.log(`Starting search and read for query: "${query}" using engine: ${engine}`);
    try {
      if (!settings?.baseUrl || !settings?.apiKey) {
        console.error('API configuration incomplete');
        sendResponse({ success: false, error: 'API configuration incomplete' });
        return;
      }

      const searchUrl = this.buildSearchUrl(query, engine);
      console.log(`Built search URL: ${searchUrl}`);
      
      const serpHtml = await this.fetchText(searchUrl);
      console.log(`Fetched SERP HTML, length: ${serpHtml.length}`);
      
      const links = this.extractTopLinksFromSerp(serpHtml, engine).slice(0, maxResults);
      console.log(`Extracted ${links.length} links:`, links);

      // 并发抓取网页
      const pages = await Promise.all(links.map(async (url) => {
        try {
          const html = await this.fetchText(url);
          const text = this.extractReadableText(html);
          return { url, text };
        } catch (e) {
          return { url, text: '' };
        }
      }));

      const corpus = pages
        .filter(p => p.text && p.text.length > 200)
        .map((p, i) => `Source ${i+1}: ${p.url}\n${p.text.substring(0, 4000)}`)
        .join('\n\n');

      const prompt = `You are a research assistant. Read the sources below and answer the user query. 
Rules: cite sources as [S1], [S2]... using the numbering in the sources. Be concise, prioritized, and avoid speculation. Provide bullet points and a short summary. If insufficient info, say so.

User query: ${query}

Sources:\n${corpus}`;

      const summary = await this.callAIAPI(prompt, settings, false);

      sendResponse({
        success: true,
        answer: summary,
        sources: pages.map((p, i) => ({ id: `S${i+1}`, url: p.url }))
      });
    } catch (error) {
      console.error('SEARCH_AND_READ error:', error);
      sendResponse({ success: false, error: error.message || 'Search and read failed' });
    }
  }

  buildSearchUrl(query, engine) {
    const q = encodeURIComponent(query);
    if (engine === 'bing') return `https://www.bing.com/search?q=${q}`;
    if (engine === 'duckduckgo') return `https://duckduckgo.com/?q=${q}`;
    return `https://www.google.com/search?q=${q}`;
  }

  async fetchText(url) {
    console.log(`Attempting to fetch URL: ${url}`);
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'DNT': '1',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      };

      const res = await fetch(url, { 
        method: 'GET',
        headers: headers,
        mode: 'cors'
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Fetch failed for ${url}: Status ${res.status}, Response: ${errorText}`);
        throw new Error(`Fetch failed: ${res.status} - ${errorText.substring(0, 100)}`);
      }
      const text = await res.text();
      console.log(`Successfully fetched ${url}. Content length: ${text.length}`);
      // console.log('Fetched content (first 500 chars):', text.substring(0, 500)); // Log a snippet
      return text;
    } catch (error) {
      console.error(`Error in fetchText for ${url}:`, error);
      throw error;
    }
  }

  extractTopLinksFromSerp(html, engine) {
    try {
      const urls = new Set();
      let linkPatterns = [];

      if (engine === 'bing') {
        linkPatterns = [
          /<li class="b_algo"[\s\S]*?<a href="(https?:\/\/[^"#]+)"/g,
          /<h2><a href="(https?:\/\/[^"#]+)"/g
        ];
      } else if (engine === 'duckduckgo') {
        linkPatterns = [
          /<a class="result__url" href="(https?:\/\/[^"#]+)"/g,
          /<a href="(https?:\/\/[^"#]+)"[^>]*class="[^"]*result[^"]*"/g
        ];
      } else { // Default to Google
        linkPatterns = [
          // Multiple patterns for Google's changing structure
          /<div[^>]*class="[^"]*(?:g|tF2CMy)[^"]*"[^>]*>[\s\S]*?<a href="(https?:\/\/[^"#]+)"/g,
          /<h3[^>]*>[\s\S]*?<a href="(https?:\/\/[^"#]+)"/g,
          /<a href="(https?:\/\/[^"#]+)"[^>]*><h3/g,
          /<a href="\/url\?q=(https?:\/\/[^&"#]+)/g // Handle Google redirect URLs
        ];
      }
      
      // Try multiple patterns
      for (const linkRegex of linkPatterns) {
        let m;
        while ((m = linkRegex.exec(html)) && urls.size < 15) {
          try {
            let urlStr = m[1];
            // Handle URL-encoded URLs
            if (urlStr.includes('%')) {
              urlStr = decodeURIComponent(urlStr);
            }
            
            const url = new URL(urlStr).href;
            
            // More comprehensive exclusion list
            const excludePatterns = [
              /(google|bing|duckduckgo)\.(com|cn)\/search/,
              /accounts\.google\.com/,
              /google\.com\/(images|news|maps|shopping|travel|finance)/,
              /youtube\.com\/watch/,
              /support\.google\.com/,
              /policies\.google\.com/,
              /translate\.google\.com/,
              /webcache\.googleusercontent\.com/,
              /google\.com\/imgres/,
              /google\.com\/finance/,
              /bing\.com\/(images|news|maps)/,
              /microsoft\.com/,
              /facebook\.com\/tr/,
              /googletagmanager\.com/,
              /doubleclick\.net/
            ];
            
            const shouldExclude = excludePatterns.some(pattern => pattern.test(url));
            
            if (!shouldExclude && url.startsWith('http')) {
              urls.add(url);
            }
          } catch (e) {
            console.warn('Invalid URL found in SERP:', m[1], e);
          }
        }
      }
      
      console.log(`Extracted ${urls.size} links for engine ${engine}.`);
      if (urls.size === 0) {
        console.warn('No links extracted. SERP HTML sample:', html.substring(0, 1000));
      }
      return Array.from(urls);
    } catch (error) {
      console.error('Error extracting top links from SERP:', error);
      return [];
    }
  }

  extractReadableText(html) {
    // 粗略提取可读文本，避免引入额外依赖
    try {
      let text = html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<header[\s\S]*?<\/header>/gi, ' ')
        .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return text.substring(0, 5000);
    } catch {
      return '';
    }
  }

  // 处理OCR请求
  async handleOCRRequest(message, sendResponse) {
    try {
      const { imageSrc, settings } = message;
      
      // 使用AI模型进行图片文字识别
      const ocrPrompt = `Please extract and transcribe all text content from this image. Return only the text content without any additional commentary or formatting. Image URL: ${imageSrc}`;
      
      const response = await this.callAIAPI(ocrPrompt, settings, true);
      
      sendResponse({
        success: true,
        text: response
      });
      
    } catch (error) {
      console.error('OCR request error:', error);
      sendResponse({
        success: false,
        error: error.message || 'OCR processing failed'
      });
    }
  }

  // 处理翻译请求
  async handleTranslateRequest(message, sendResponse) {
    try {
      const { text, settings } = message;
      
      const translatePrompt = `Please translate the following text to English. If it's already in English, keep it as is. Only return the translated text without any additional commentary:\n\n${text}`;
      
      const response = await this.callAIAPI(translatePrompt, settings, true);
      
      sendResponse({
        success: true,
        translatedText: response
      });
      
    } catch (error) {
      console.error('Translation request error:', error);
      sendResponse({
        success: false,
        error: error.message || 'Translation failed'
      });
    }
  }

  // 处理网页搜索请求
  async handleWebSearch(message, sendResponse) {
    try {
      const { query, maxResults = 5 } = message;
      
      const searchUrl = this.buildSearchUrl(query, 'google');
      console.log(`Search URL: ${searchUrl}`);
      const serpHtml = await this.fetchText(searchUrl);
      console.log(`SERP HTML fetched. Length: ${serpHtml.length}`);
      const links = this.extractTopLinksFromSerp(serpHtml, 'google').slice(0, maxResults);
      console.log(`Extracted links:`, links);
      
      // 提取搜索结果的标题和摘要
      const results = await this.extractSearchResults(serpHtml, links);
      console.log(`Extracted search results:`, results);
      
      sendResponse({
        success: true,
        results: results
      });
      
    } catch (error) {
      console.error('Web search error in handleWebSearch:', error);
      sendResponse({
        success: false,
        error: error.message || 'Web search failed'
      });
    }
  }

  // 处理访问URL请求
  async handleVisitUrl(message, sendResponse) {
    try {
      const { url } = message;
      
      // 获取网页内容
      const html = await this.fetchText(url);
      const content = this.extractReadableText(html);
      const title = this.extractTitle(html);
      
      sendResponse({
        success: true,
        content: content,
        title: title,
        url: url
      });
      
    } catch (error) {
      console.error('Visit URL error:', error);
      sendResponse({
        success: false,
        error: error.message || 'Failed to visit URL'
      });
    }
  }

  // 提取搜索结果
  async extractSearchResults(html, links) {
    const results = [];
    try {
      // More robust Google search results extraction
      // This regex attempts to capture the main title and snippet for each search result block.
      // It looks for common patterns like <h3> for titles and <span> or <div> for snippets.
      const resultBlockRegex = /<div[^>]*class="[^"]*(?:g|tF2CMy)[^"]*"[^>]*>[\s\S]*?(?:<h3[^>]*>([\s\S]*?)<\/h3>)?[\s\S]*?(?:<span[^>]*class="[^"]*(?:aCOpRe|lEBKkf)[^"]*"[^>]*>([\s\S]*?)<\/span>|<div[^>]*class="[^"]*(?:VwiC3b|lEBKkf)[^"]*"[^>]*>([\s\S]*?)<\/div>)?[\s\S]*?<a href="(https?:\/\/[^"#]+)"/g;
      let match;
      let linkIndex = 0;

      while ((match = resultBlockRegex.exec(html)) && linkIndex < links.length) {
        const title = match[1] ? this.cleanText(match[1]) : `搜索结果 ${linkIndex + 1}`;
        const snippet = match[2] || match[3] ? this.cleanText(match[2] || match[3]) : `来自 ${new URL(links[linkIndex]).hostname} 的内容`;
        const url = match[4] || links[linkIndex]; // Use URL from regex if available, otherwise from passed links

        results.push({
          title: title,
          snippet: snippet,
          url: url
        });
        linkIndex++;
      }

      // Fallback if regex fails to find anything, or if there are more links than extracted results
      if (results.length === 0 || results.length < links.length) {
        links.slice(results.length).forEach((url, i) => {
          results.push({
            title: `搜索结果 ${results.length + i + 1}`,
            snippet: `来自 ${new URL(url).hostname} 的内容`,
            url: url
          });
        });
      }
      
      console.log(`Extracted ${results.length} search results.`);
      return results;
    } catch (error) {
      console.error('Extract search results error:', error);
      // Ensure we always return results based on links, even if parsing fails
      return links.map((url, i) => ({
        title: `搜索结果 ${i + 1}`,
        snippet: `来自 ${new URL(url).hostname} 的内容`,
        url: url
      }));
    }
  }

  // 提取网页标题
  extractTitle(html) {
    try {
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      return titleMatch ? this.cleanText(titleMatch[1]) : '未知标题';
    } catch {
      return '未知标题';
    }
  }

  // 清理文本
  cleanText(text) {
    return text
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 200);
  }

  // 验证API配置
  async validateAPIConfig(settings) {
    try {
      const testMessage = 'Please reply "Configuration correct" to confirm the connection';
      await this.callAIAPI(testMessage, settings);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
}

// 扩展安装时的处理
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('AI Browser Assistant installed');
    
    // 设置默认配置
    chrome.storage.local.set({
      aiSettings: {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4o'
      }
    });
  }
});

// 扩展启动时的处理
chrome.runtime.onStartup.addListener(() => {
  console.log('AI Browser Assistant started');
});

// 标签页更新时的处理
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // 可以在这里添加页面加载完成后的处理逻辑
    console.log('Page loaded:', tab.url);
  }
});

// 初始化后台服务
new AIBackgroundService();
