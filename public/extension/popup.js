const DEFAULT_SETTINGS = {
  enabled: true,
  autoTranslate: true,
  targetLang: 'zh-CN',
  backendUrl: 'https://5tjjyhbf89.coze.site',
  showOriginal: true,
  hideNativeCaptions: true,
  fontSize: 20,
  position: 12,
  sourcePreference: 'auto',
};

const LANG_LABELS = {
  'zh-CN': '简体中文',
  'zh-TW': '繁体中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ru: 'Русский',
  pt: 'Português',
  it: 'Italiano',
  ar: 'العربية',
  th: 'ไทย',
  vi: 'Tiếng Việt',
};

const el = {
  enabled: document.getElementById('enabledToggle'),
  targetLang: document.getElementById('targetLang'),
  videoTitle: document.getElementById('videoTitle'),
  statusDot: document.getElementById('statusDot'),
  statusText: document.getElementById('statusText'),
  progressWrap: document.getElementById('progressWrap'),
  progressBar: document.getElementById('progressBar'),
  progressText: document.getElementById('progressText'),
  videoMeta: document.getElementById('videoMeta'),
  downloadMode: document.getElementById('downloadMode'),
  downloadFormat: document.getElementById('downloadFormat'),
  downloadBtn: document.getElementById('downloadBtn'),
  downloadHint: document.getElementById('downloadHint'),
  serverDot: document.getElementById('serverDot'),
  serverText: document.getElementById('serverText'),
  serverUrl: document.getElementById('serverUrl'),
  checkServer: document.getElementById('checkServer'),
  importBtn: document.getElementById('importBtn'),
  importFile: document.getElementById('importFile'),
  pageDot: document.getElementById('pageDot'),
  pageStatus: document.getElementById('pageStatus'),
  pageTranslateBtn: document.getElementById('pageTranslateBtn'),
  pageRestoreBtn: document.getElementById('pageRestoreBtn'),
  openOptions: document.getElementById('openOptions'),
  updateDot: document.getElementById('updateDot'),
  updateText: document.getElementById('updateText'),
  updateHint: document.getElementById('updateHint'),
  checkUpdateBtn: document.getElementById('checkUpdateBtn'),
  openLatestBtn: document.getElementById('openLatestBtn'),
};

let activeTabId = null;
let latestDownloadUrl = '';
let activeIsYouTube = false;

function sendToTab(type, payload) {
  return new Promise((resolve, reject) => {
    if (!activeTabId) {
      reject(new Error('未找到当前标签页'));
      return;
    }
    chrome.tabs.sendMessage(activeTabId, { type, payload }, (response) => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      if (!response || !response.ok) {
        reject(new Error((response && response.error) || '页面无响应'));
        return;
      }
      resolve(response.data);
    });
  });
}

function setDot(node, state) {
  node.className = 'dot';
  if (state) node.classList.add(state);
}

function fillLanguages(selected) {
  el.targetLang.innerHTML = '';
  Object.entries(LANG_LABELS).forEach(([code, label]) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = label;
    if (code === selected) option.selected = true;
    el.targetLang.appendChild(option);
  });
}

function renderStatus(status) {
  if (!status) {
    el.videoTitle.textContent = activeIsYouTube ? '正在读取页面状态…' : '当前不是 YouTube 视频页';
    el.statusText.textContent = activeIsYouTube ? '请刷新视频页面后重试' : '打开任意 YouTube 视频即可使用';
    setDot(el.statusDot, 'warn');
    el.progressWrap.hidden = true;
    el.videoMeta.textContent = '';
    el.downloadBtn.disabled = true;
    return;
  }

  el.videoTitle.textContent = status.title || status.videoId || '未检测到视频';
  const statusMap = {
    idle: ['等待视频加载', 'warn'],
    loading: ['正在加载字幕…', 'warn'],
    translating: ['AI 翻译中', 'warn'],
    ready: ['双语字幕已就绪', 'ok'],
    error: [status.error || '翻译失败', 'err'],
    'no-captions': ['该视频没有可用字幕轨', 'err'],
  };
  const [text, dot] = statusMap[status.status] || ['未知状态', ''];
  el.statusText.textContent = text;
  setDot(el.statusDot, dot);
  el.statusText.classList.toggle('status-error', dot === 'err');

  const { done, total } = status.progress || { done: 0, total: 0 };
  if (status.status === 'translating' && total > 0) {
    el.progressWrap.hidden = false;
    el.progressBar.style.width = `${Math.round((done / total) * 100)}%`;
    el.progressText.textContent = `${done}/${total}`;
  } else {
    el.progressWrap.hidden = true;
  }

  const parts = [];
  if (status.cueCount) parts.push(`字幕 ${status.cueCount} 条`);
  if (status.translatedCount) parts.push(`已翻译 ${status.translatedCount} 条`);
  if (status.trackLanguage) parts.push(`源语言 ${status.trackLanguage}`);
  el.videoMeta.textContent = parts.join(' · ');
  el.downloadBtn.disabled = !status.hasCaptions || status.status === 'loading';
}

async function loadStatus() {
  if (!activeIsYouTube) {
    renderStatus(null);
    return;
  }
  try {
    const status = await sendToTab('GET_STATUS');
    renderStatus(status);
  } catch (error) {
    renderStatus(null);
    el.statusText.textContent = '请刷新 YouTube 页面后重试';
  }
}

async function checkServer() {
  el.serverText.textContent = '检测中…';
  setDot(el.serverDot, 'warn');
  try {
    const result = await chrome.runtime.sendMessage({ type: 'CHECK_BACKEND' });
    if (!result || !result.ok) throw new Error((result && result.error) || '检测失败');
    const data = result.data;
    el.serverUrl.textContent = data.backend;
    if (data.ok) {
      setDot(el.serverDot, 'ok');
      el.serverText.textContent = `服务正常 · ${(data.payload && data.payload.model) || '内置模型'}`;
    } else {
      setDot(el.serverDot, 'err');
      el.serverText.textContent = `无法连接：${data.message || '未知错误'}`;
    }
  } catch (error) {
    setDot(el.serverDot, 'err');
    el.serverText.textContent = `无法连接：${error.message}`;
  }
}

async function loadPageStatus() {
  if (!activeTabId) return;
  try {
    const result = await sendToTab('PAGE_STATUS');
    const data = (result && result.data) || {};
    if (data.translating) {
      setDot(el.pageDot, 'warn');
      el.pageStatus.textContent = `翻译中 ${data.done}/${data.total || '…'}`;
    } else if (data.enabled) {
      setDot(el.pageDot, 'ok');
      el.pageStatus.textContent = `已翻译 ${data.translatedNodes || data.done} 段，点「恢复原文」可还原`;
    } else if (data.error) {
      setDot(el.pageDot, 'err');
      el.pageStatus.textContent = data.error;
    } else {
      setDot(el.pageDot, 'warn');
      el.pageStatus.textContent = '可在任意网页把正文逐段翻成双语';
    }
    el.pageRestoreBtn.disabled = !data.enabled && !data.translating;
  } catch (error) {
    setDot(el.pageDot, 'err');
    el.pageStatus.textContent = '当前页面不支持整页翻译（如 chrome:// 页面）';
    el.pageRestoreBtn.disabled = true;
  }
}

async function checkUpdate() {
  const current = chrome.runtime.getManifest().version;
  el.updateText.textContent = `当前 v${current} · 检查中…`;
  setDot(el.updateDot, 'warn');
  try {
    const result = await chrome.runtime.sendMessage({ type: 'CHECK_UPDATE' });
    if (!result || !result.ok) throw new Error((result && result.error) || '检查失败');
    const data = result.data || {};
    if (data.hasUpdate) {
      setDot(el.updateDot, 'warn');
      el.updateText.textContent = `当前 v${data.current} · 线上 v${data.latest}`;
      el.updateHint.textContent = (data.notes && data.notes.length
        ? data.notes.slice(0, 2).join(' · ')
        : '线上已发布新版本，点「获取新版」下载最新安装包');
      latestDownloadUrl = data.crxUrl || data.zipUrl || '';
      el.openLatestBtn.hidden = !latestDownloadUrl;
    } else {
      setDot(el.updateDot, 'ok');
      el.updateText.textContent = `当前 v${data.current || current} · 已是最新`;
      el.updateHint.textContent = '扩展会跟随线上版本；有新功能时这里会提示更新入口。';
      el.openLatestBtn.hidden = true;
    }
  } catch (error) {
    setDot(el.updateDot, 'err');
    el.updateText.textContent = `当前 v${current} · 无法检查更新`;
    el.updateHint.textContent = `更新服务不可达：${error.message}`;
    el.openLatestBtn.hidden = true;
  }
}

async function init() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  fillLanguages(settings.targetLang || 'zh-CN');
  el.enabled.checked = Boolean(settings.enabled);
  el.serverUrl.textContent = settings.backendUrl;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab && tab.id;
  activeIsYouTube = Boolean(tab && tab.url && /^https:\/\/(www\.|m\.)?youtube\.com\//.test(tab.url));

  await loadStatus();
  loadPageStatus();
  checkServer();
  checkUpdate();
  setInterval(loadPageStatus, 2000);

  el.enabled.addEventListener('change', async () => {
    await chrome.storage.sync.set({ enabled: el.enabled.checked });
    if (activeIsYouTube) {
      sendToTab('SET_ENABLED', { enabled: el.enabled.checked }).catch(() => {});
    }
  });

  el.targetLang.addEventListener('change', async () => {
    await chrome.storage.sync.set({ targetLang: el.targetLang.value });
    if (activeIsYouTube) {
      sendToTab('SET_TARGET_LANG', { targetLang: el.targetLang.value }).catch(() => {});
      setTimeout(loadStatus, 1200);
    }
  });

  el.downloadBtn.addEventListener('click', async () => {
    el.downloadBtn.disabled = true;
    el.downloadHint.textContent = '正在准备字幕文件，必要时会补全翻译…';
    try {
      const result = await sendToTab('DOWNLOAD_SUBTITLES', {
        format: el.downloadFormat.value,
        mode: el.downloadMode.value,
      });
      el.downloadHint.textContent = `已开始下载：${result.filename}`;
    } catch (error) {
      el.downloadHint.textContent = `下载失败：${error.message}`;
    } finally {
      el.downloadBtn.disabled = false;
      loadStatus();
    }
  });

  el.checkServer.addEventListener('click', checkServer);

  el.checkUpdateBtn.addEventListener('click', checkUpdate);

  el.openLatestBtn.addEventListener('click', () => {
    if (latestDownloadUrl) chrome.tabs.create({ url: latestDownloadUrl });
  });

  el.pageTranslateBtn.addEventListener('click', async () => {
    el.pageTranslateBtn.disabled = true;
    try {
      await sendToTab('PAGE_TRANSLATE');
      el.pageStatus.textContent = '已开始翻译，译文会逐段出现…';
      setTimeout(loadPageStatus, 800);
    } catch (error) {
      setDot(el.pageDot, 'err');
      el.pageStatus.textContent = `无法翻译：${error.message}`;
    } finally {
      el.pageTranslateBtn.disabled = false;
    }
  });

  el.pageRestoreBtn.addEventListener('click', async () => {
    try {
      await sendToTab('PAGE_RESTORE');
      await loadPageStatus();
    } catch (error) {
      el.pageStatus.textContent = `还原失败：${error.message}`;
    }
  });

  el.importBtn.addEventListener('click', () => el.importFile.click());

  el.importFile.addEventListener('change', async () => {
    const file = el.importFile.files && el.importFile.files[0];
    if (!file) return;
    el.importBtn.disabled = true;
    el.importBtn.textContent = '导入中…';
    try {
      const content = await file.text();
      const result = await sendToTab('IMPORT_SUBTITLES', { name: file.name, content });
      const count = result && result.cueCount ? result.cueCount : 0;
      el.downloadHint.textContent = `已导入 ${count} 条字幕，正在翻译…`;
      await loadStatus();
    } catch (error) {
      el.downloadHint.textContent = `导入失败：${error.message}`;
    } finally {
      el.importBtn.disabled = false;
      el.importBtn.textContent = '导入本地字幕文件';
      el.importFile.value = '';
    }
  });

  el.openOptions.addEventListener('click', (event) => {
    event.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  if (activeIsYouTube) {
    setInterval(loadStatus, 1500);
  }
}

init();
