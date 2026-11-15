/* LinguaLens · 整页双语翻译 —— 内容脚本（任意网页） */
(() => {
  if (window.__llPageLoaded) return;
  window.__llPageLoaded = true;

  const DEFAULT_SETTINGS = {
    backendUrl: 'http://localhost:5050',
    targetLang: 'zh-CN',
    pageTranslateEnabled: true,
  };

  const BLOCK_SELECTOR = [
    'p',
    'li',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'td',
    'th',
    'dd',
    'dt',
    'blockquote',
    'figcaption',
    'summary',
  ].join(',');

  const SKIP_CLOSEST = [
    'code',
    'pre',
    'script',
    'style',
    'noscript',
    'textarea',
    'input',
    'select',
    'option',
    'kbd',
    'samp',
    'svg',
    'math',
    'canvas',
    'video',
    '[contenteditable="true"]',
    '[translate="no"]',
    '.ll-tr',
    '.ll-page-ui',
    '#ll-page-ui',
  ].join(',');

  const INLINE_HOSTS = new Set(['li', 'td', 'th', 'dd', 'dt', 'summary', 'figcaption']);
  const BATCH_SIZE = 16;
  const MAX_BLOCKS = 900;
  const MIN_LENGTH = 2;
  const MAX_LENGTH = 4000;

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    enabled: false,
    translating: false,
    cancelled: false,
    total: 0,
    done: 0,
    error: '',
    ui: null,
    uiRoot: null,
    observer: null,
    timer: null,
  };

  /* --------------------------------- 工具 --------------------------------- */

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function normalizeText(value) {
    return (value || '').replace(/\s+/g, ' ').trim();
  }

  function isVisible(element) {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 4 && rect.height > 4;
  }

  function cjkRatio(text) {
    const cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    const letters = (text.match(/[A-Za-z\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length || 1;
    return cjk / letters;
  }

  /** 过滤掉没意义或不需要翻译的文本：纯数字、纯符号、已经是目标语言、链接堆等 */
  function shouldTranslate(text) {
    if (text.length < MIN_LENGTH || text.length > MAX_LENGTH) return false;
    if (!/[A-Za-z\u00c0-\u024f\u0400-\u04ff\u0600-\u06ff\u3040-\u30ff\uac00-\ud7af\u4e00-\u9fff]/.test(text)) {
      return false;
    }
    const target = state.settings.targetLang || 'zh-CN';
    if (target.startsWith('zh') && cjkRatio(text) > 0.7) return false;
    if (target === 'en' && cjkRatio(text) < 0.1) return false;
    if (/^(https?:\/\/|www\.)\S+$/.test(text)) return false;
    return true;
  }

  function send(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        if (!response) {
          reject(new Error('扩展后台无响应'));
          return;
        }
        if (response.ok === false) {
          reject(new Error(response.error || '请求失败'));
          return;
        }
        resolve(response.data);
      });
    });
  }

  /* ------------------------------- 采集与渲染 ------------------------------ */

  function collectBlocks() {
    const nodes = document.querySelectorAll(BLOCK_SELECTOR);
    const items = [];
    for (const element of nodes) {
      if (items.length >= MAX_BLOCKS) break;
      if (element.dataset.llDone === '1') continue;
      if (element.closest(SKIP_CLOSEST)) continue;
      if (!isVisible(element)) continue;
      const text = normalizeText(element.innerText || element.textContent);
      if (!shouldTranslate(text)) continue;
      items.push({ element, text });
    }
    return items;
  }

  function insertTranslation(element, translation) {
    const node = document.createElement('div');
    node.className = 'll-tr';
    node.setAttribute('data-ll', '1');
    node.setAttribute('lang', state.settings.targetLang || 'zh-CN');
    node.textContent = translation;

    const computed = window.getComputedStyle(element);
    node.style.fontSize = computed.fontSize;
    node.style.fontFamily = computed.fontFamily;
    node.style.lineHeight = computed.lineHeight === 'normal' ? '1.6' : computed.lineHeight;
    node.style.fontWeight = '400';

    const tag = element.tagName.toLowerCase();
    if (INLINE_HOSTS.has(tag)) {
      element.appendChild(node);
    } else {
      element.insertAdjacentElement('afterend', node);
    }
    element.dataset.llDone = '1';
  }

  function clearTranslations() {
    document.querySelectorAll('.ll-tr[data-ll="1"]').forEach((node) => node.remove());
    document.querySelectorAll('[data-ll-done="1"]').forEach((node) => {
      delete node.dataset.llDone;
    });
    document.querySelectorAll('[data-ll-done]').forEach((node) => {
      node.removeAttribute('data-ll-done');
    });
  }

  /* --------------------------------- 翻译 --------------------------------- */

  async function translateBatch(texts) {
    const data = await send({
      type: 'TRANSLATE',
      payload: { texts, targetLang: state.settings.targetLang || 'zh-CN' },
    });
    return Array.isArray(data && data.translations) ? data.translations : [];
  }

  async function runTranslation({ incremental = false } = {}) {
    if (state.translating) return;
    state.translating = true;
    state.cancelled = false;
    state.error = '';
    state.enabled = true;
    if (!incremental) {
      state.total = 0;
      state.done = 0;
    }
    renderUi();

    try {
      const blocks = collectBlocks();
      if (!blocks.length) {
        state.error = '这一页没找到需要翻译的正文';
        return;
      }

      // 相同文本只翻一次，页面上多处重复的导航/标签直接复用结果
      const unique = new Map();
      blocks.forEach((item) => {
        if (!unique.has(item.text)) unique.set(item.text, []);
        unique.get(item.text).push(item.element);
      });

      const texts = [...unique.keys()];
      state.total = texts.length;
      state.done = 0;
      renderUi();

      for (let start = 0; start < texts.length; start += BATCH_SIZE) {
        if (state.cancelled) break;
        const slice = texts.slice(start, start + BATCH_SIZE);
        let translations = [];
        try {
          translations = await translateBatch(slice);
        } catch (error) {
          state.error = error.message;
          break;
        }
        slice.forEach((text, index) => {
          const translation = translations[index];
          if (!translation || !translation.trim()) return;
          if (translation.trim() === text.trim()) return;
          const elements = unique.get(text) || [];
          elements.forEach((element) => {
            if (element.isConnected && element.dataset.llDone !== '1') {
              insertTranslation(element, translation);
            }
          });
        });
        state.done = Math.min(start + slice.length, texts.length);
        renderUi();
        await sleep(60);
      }
    } finally {
      state.translating = false;
      renderUi();
    }
  }

  function restorePage() {
    state.cancelled = true;
    state.enabled = false;
    state.total = 0;
    state.done = 0;
    state.error = '';
    clearTranslations();
    renderUi();
  }

  /* ---------------------------------- UI --------------------------------- */

  function ensureUi() {
    if (state.ui && state.ui.isConnected) return state.ui;
    const host = document.createElement('div');
    host.id = 'll-page-ui';
    host.className = 'll-page-ui';
    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host { all: initial; }
        .pill {
          position: fixed; right: 18px; bottom: 18px; z-index: 2147483000;
          display: flex; align-items: center; gap: 8px;
          padding: 8px 12px; border-radius: 999px;
          background: rgba(17, 20, 28, 0.92); color: #fff;
          font: 500 12px/1.4 -apple-system, "PingFang SC", system-ui, sans-serif;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
          cursor: pointer; user-select: none;
        }
        .pill:hover { background: rgba(30, 34, 44, 0.96); }
        .badge {
          display: grid; place-items: center; width: 20px; height: 20px;
          border-radius: 6px; background: #0a84ff; font-size: 11px; font-weight: 700;
        }
        .pill[data-busy="1"] .badge { background: #f59e0b; }
        .pill[data-error="1"] .badge { background: #ef4444; }
        .label { white-space: nowrap; }
        .stop { color: #93c5fd; text-decoration: underline; }
      </style>
      <div class="pill" data-role="pill">
        <span class="badge">译</span>
        <span class="label">整页翻译</span>
      </div>
    `;
    document.documentElement.appendChild(host);
    root.querySelector('[data-role="pill"]').addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggle();
    });
    state.ui = host;
    state.uiRoot = root;
    return host;
  }

  function renderUi() {
    const host = ensureUi();
    const pill = host.shadowRoot.querySelector('[data-role="pill"]');
    const label = host.shadowRoot.querySelector('.label');
    pill.dataset.busy = state.translating ? '1' : '0';
    pill.dataset.error = state.error ? '1' : '0';
    if (state.translating) {
      label.textContent = `翻译中 ${state.done}/${state.total || '…'} · 点此停止`;
    } else if (state.error) {
      label.textContent = state.error;
    } else if (state.enabled) {
      label.textContent = `已翻译 ${state.done} 段 · 点此还原`;
    } else {
      label.textContent = '整页翻译';
    }
  }

  function toggle() {
    if (state.translating) {
      state.cancelled = true;
      renderUi();
      return;
    }
    if (state.enabled) restorePage();
    else runTranslation();
  }

  /* -------------------------------- 生命周期 ------------------------------- */

  function watchDom() {
    if (state.observer) return;
    state.observer = new MutationObserver(() => {
      if (!state.enabled || state.translating) return;
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(() => {
        state.timer = null;
        if (state.enabled && !state.translating) runTranslation({ incremental: true });
      }, 1500);
    });
    state.observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function bindShortcut() {
    window.addEventListener(
      'keydown',
      (event) => {
        if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        const code = event.code || '';
        const key = (event.key || '').toLowerCase();
        if (code === 'KeyA' || key === 'a') {
          event.preventDefault();
          toggle();
        }
      },
      true,
    );
  }

  function applySettings(settings) {
    state.settings = { ...state.settings, ...settings };
  }

  chrome.storage.sync.get(DEFAULT_SETTINGS, (settings) => {
    applySettings(settings || {});
    bindShortcut();
    ensureUi();
    renderUi();
    if (state.settings.pageAutoTranslate) {
      // 用户显式开启过自动整页翻译时才自动执行
      setTimeout(() => runTranslation(), 1200);
    }
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    const next = {};
    Object.keys(changes).forEach((key) => {
      next[key] = changes[key].newValue;
    });
    applySettings(next);
    renderUi();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const type = message && message.type;
    if (!type || !type.startsWith('PAGE_')) return false;

    if (type === 'PAGE_STATUS') {
      sendResponse({
        ok: true,
        data: {
          enabled: state.enabled,
          translating: state.translating,
          total: state.total,
          done: state.done,
          error: state.error,
          translatedNodes: document.querySelectorAll('.ll-tr[data-ll="1"]').length,
        },
      });
      return false;
    }
    if (type === 'PAGE_TRANSLATE') {
      runTranslation();
      sendResponse({ ok: true, data: { started: true } });
      return false;
    }
    if (type === 'PAGE_RESTORE') {
      restorePage();
      sendResponse({ ok: true, data: { restored: true } });
      return false;
    }
    if (type === 'PAGE_TOGGLE') {
      toggle();
      sendResponse({ ok: true, data: { enabled: state.enabled } });
      return false;
    }
    return false;
  });

  watchDom();
})();
