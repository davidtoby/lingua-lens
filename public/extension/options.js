const DEFAULT_SETTINGS = {
  enabled: true,
  autoTranslate: true,
  pageAutoTranslate: false,
  targetLang: 'zh-CN',
  backendUrl: 'https://lingualens.coze.site',
  showOriginal: true,
  hideNativeCaptions: true,
  fontSize: 20,
  position: 12,
  overlayPos: null,
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

let latestDownloadUrl = '';

function compareVersions(a, b) {
  const pa = String(a || '0').split('.').map((n) => Number(n) || 0);
  const pb = String(b || '0').split('.').map((n) => Number(n) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i += 1) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
}

const el = {
  backendUrl: document.getElementById('backendUrl'),
  testBackend: document.getElementById('testBackend'),
  serverDot: document.getElementById('serverDot'),
  serverText: document.getElementById('serverText'),
  testText: document.getElementById('testText'),
  testTranslate: document.getElementById('testTranslate'),
  updateDot: document.getElementById('updateDot'),
  updateText: document.getElementById('updateText'),
  updateHint: document.getElementById('updateHint'),
  checkUpdateBtn: document.getElementById('checkUpdateBtn'),
  openLatestBtn: document.getElementById('openLatestBtn'),
  testResult: document.getElementById('testResult'),
  targetLang: document.getElementById('targetLang'),
  fontSize: document.getElementById('fontSize'),
  position: document.getElementById('position'),
  sourcePreference: document.getElementById('sourcePreference'),
  showOriginal: document.getElementById('showOriginal'),
  hideNativeCaptions: document.getElementById('hideNativeCaptions'),
  autoTranslate: document.getElementById('autoTranslate'),
  pageAutoTranslate: document.getElementById('pageAutoTranslate'),
  resetPosBtn: document.getElementById('resetPosBtn'),
  enabled: document.getElementById('enabled'),
  saveBtn: document.getElementById('saveBtn'),
  resetBtn: document.getElementById('resetBtn'),
  saveTip: document.getElementById('saveTip'),
  welcome: document.getElementById('welcome'),
};

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

function setDot(state) {
  el.serverDot.className = 'dot';
  if (state) el.serverDot.classList.add(state);
}

function applySettings(settings) {
  fillLanguages(settings.targetLang);
  el.backendUrl.value = settings.backendUrl;
  el.fontSize.value = settings.fontSize;
  el.position.value = settings.position;
  el.sourcePreference.value = settings.sourcePreference;
  el.showOriginal.checked = Boolean(settings.showOriginal);
  el.hideNativeCaptions.checked = Boolean(settings.hideNativeCaptions);
  el.autoTranslate.checked = Boolean(settings.autoTranslate);
  el.pageAutoTranslate.checked = Boolean(settings.pageAutoTranslate);
  el.enabled.checked = Boolean(settings.enabled);
}

async function load() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  applySettings({ ...DEFAULT_SETTINGS, ...settings });
  if (new URLSearchParams(location.search).get('welcome') === '1') {
    el.welcome.hidden = false;
  }
  checkBackend();
}

function currentSettings() {
  return {
    backendUrl: el.backendUrl.value.trim() || DEFAULT_SETTINGS.backendUrl,
    targetLang: el.targetLang.value,
    fontSize: Number(el.fontSize.value) || DEFAULT_SETTINGS.fontSize,
    position: Number(el.position.value) || DEFAULT_SETTINGS.position,
    sourcePreference: el.sourcePreference.value,
    showOriginal: el.showOriginal.checked,
    hideNativeCaptions: el.hideNativeCaptions.checked,
    autoTranslate: el.autoTranslate.checked,
    pageAutoTranslate: el.pageAutoTranslate.checked,
    enabled: el.enabled.checked,
  };
}

async function checkUpdate() {
  const current = chrome.runtime.getManifest().version;
  const backend = el.backendUrl.value.trim().replace(/\/+$/, '') || DEFAULT_SETTINGS.backendUrl;
  el.updateText.textContent = `当前 v${current} · 检查中…`;
  try {
    const response = await fetch(`${backend}/api/extension/latest`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const latest = payload.version || current;
    const hasUpdate = compareVersions(latest, current) > 0;
    if (hasUpdate) {
      el.updateDot.className = 'dot warn';
      el.updateText.textContent = `当前 v${current} · 线上 v${latest}`;
      el.updateHint.textContent = (payload.notes && payload.notes.length
        ? payload.notes.slice(0, 2).join(' · ')
        : '线上已发布新版本，点「获取新版」下载');
      latestDownloadUrl = payload.crxUrl || payload.zipUrl || '';
      el.openLatestBtn.hidden = !latestDownloadUrl;
    } else {
      el.updateDot.className = 'dot ok';
      el.updateText.textContent = `当前 v${current} · 已是最新`;
      el.updateHint.textContent = '扩展会跟随线上版本；有新功能时会在这里提示。';
      el.openLatestBtn.hidden = true;
    }
  } catch (error) {
    el.updateDot.className = 'dot err';
    el.updateText.textContent = `当前 v${current} · 无法检查更新`;
    el.updateHint.textContent = `更新服务不可达：${error.message}`;
    el.openLatestBtn.hidden = true;
  }
}

async function checkBackend() {
  setDot('warn');
  el.serverText.textContent = '检测中…';
  try {
    const backend = el.backendUrl.value.trim().replace(/\/+$/, '') || DEFAULT_SETTINGS.backendUrl;
    const response = await fetch(`${backend}/api/health`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    setDot('ok');
    el.serverText.textContent = `服务正常 · 模型 ${payload.model || '内置'} · ${backend}`;
  } catch (error) {
    setDot('err');
    el.serverText.textContent = `连接失败：${error.message}（请确认服务端已启动）`;
  }
}

async function testTranslate() {
  const text = el.testText.value.trim();
  if (!text) return;
  el.testTranslate.disabled = true;
  el.testResult.textContent = '翻译中…';
  try {
    const backend = el.backendUrl.value.trim().replace(/\/+$/, '') || DEFAULT_SETTINGS.backendUrl;
    const response = await fetch(`${backend}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts: [text], targetLang: el.targetLang.value }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message || `HTTP ${response.status}`);
    el.testResult.textContent = payload.translations[0] || '（空结果）';
  } catch (error) {
    el.testResult.textContent = `翻译失败：${error.message}`;
  } finally {
    el.testTranslate.disabled = false;
  }
}

async function save() {
  const settings = currentSettings();
  await chrome.storage.sync.set(settings);
  el.saveTip.textContent = '已保存 ✓';
  setTimeout(() => {
    el.saveTip.textContent = '';
  }, 2200);
  checkBackend();
}

async function reset() {
  await chrome.storage.sync.set(DEFAULT_SETTINGS);
  applySettings(DEFAULT_SETTINGS);
  el.saveTip.textContent = '已恢复默认';
  setTimeout(() => {
    el.saveTip.textContent = '';
  }, 2200);
  checkBackend();
}

el.resetPosBtn.addEventListener('click', async () => {
  await chrome.storage.sync.set({ overlayPos: null });
  el.saveTip.textContent = '字幕位置已复位';
  setTimeout(() => {
    el.saveTip.textContent = '';
  }, 2200);
});

el.saveBtn.addEventListener('click', save);
el.resetBtn.addEventListener('click', reset);
el.testBackend.addEventListener('click', checkBackend);
el.checkUpdateBtn.addEventListener('click', checkUpdate);
el.openLatestBtn.addEventListener('click', () => {
  if (latestDownloadUrl) chrome.tabs.create({ url: latestDownloadUrl });
});
el.testTranslate.addEventListener('click', testTranslate);

load();
checkUpdate();
