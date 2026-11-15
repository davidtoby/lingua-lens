/**
 * Service Worker：负责跨域请求（YouTube 页面、翻译后端）与文件下载。
 * 内容脚本在页面世界里受 CORS 限制，统一走这里转发。
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  autoTranslate: true,
  targetLang: 'zh-CN',
  backendUrl: 'https://5tjjyhbf89.coze.site',
  showOriginal: true,
  hideNativeCaptions: true,
  fontSize: 20,
  position: 12,
  overlayPos: null,
  pageAutoTranslate: false,
  sourcePreference: 'auto',
};

async function getSettings() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  return { ...DEFAULT_SETTINGS, ...stored };
}

async function setSettings(patch) {
  await chrome.storage.sync.set(patch);
  return getSettings();
}

function normalizeBackendUrl(url) {
  const fallback = DEFAULT_SETTINGS.backendUrl;
  if (!url || typeof url !== 'string') return fallback;
  return url.trim().replace(/\/+$/, '') || fallback;
}

/* ---------------------------------- 字幕轨 --------------------------------- */

function extractBalancedJson(html, key) {
  const marker = html.indexOf(key);
  if (marker < 0) return null;
  const start = html.indexOf('{', marker);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i += 1) {
    const char = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      continue;
    }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch (error) {
          return null;
        }
      }
    }
  }
  return null;
}

async function fetchTracksFromWatchPage(videoId) {
  const response = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`, {
    credentials: 'include',
    headers: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  if (!response.ok) throw new Error(`打开视频页失败（HTTP ${response.status}）`);
  const html = await response.text();

  const playerResponse =
    extractBalancedJson(html, 'ytInitialPlayerResponse') || extractBalancedJson(html, '"playerResponse":');
  if (!playerResponse) throw new Error('未能解析播放器信息');

  const tracklist =
    playerResponse.captions &&
    playerResponse.captions.playerCaptionsTracklistRenderer &&
    playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;

  const tracks = Array.isArray(tracklist)
    ? tracklist
        .filter((track) => track && track.baseUrl)
        .map((track) => ({
          baseUrl: track.baseUrl,
          languageCode: track.languageCode || '',
          kind: track.kind || '',
          name:
            (track.name && (track.name.simpleText || (track.name.runs || []).map((r) => r.text).join(''))) ||
            track.languageCode ||
            '未知语言',
          isTranslatable: Boolean(track.isTranslatable),
        }))
    : [];

  return {
    tracks,
    title:
      (playerResponse.videoDetails && playerResponse.videoDetails.title) ||
      (html.match(/<title>([^<]*)<\/title>/) || [, ''])[1].replace(/\s*-\s*YouTube\s*$/, ''),
  };
}

/* --------------------------------- 字幕内容 -------------------------------- */

async function fetchSubtitleText(baseUrl) {
  const url = new URL(baseUrl, 'https://www.youtube.com');
  url.searchParams.set('fmt', 'json3');

  try {
    const response = await fetch(url.toString(), { credentials: 'include' });
    if (response.ok) {
      const text = await response.text();
      if (text && text.trim()) return { text, via: 'direct' };
    }
  } catch (error) {
    /* 继续尝试服务端代理 */
  }

  const settings = await getSettings();
  const backend = normalizeBackendUrl(settings.backendUrl);
  const proxyUrl = `${backend}/api/youtube/timedtext?url=${encodeURIComponent(url.toString())}`;
  const proxyResponse = await fetch(proxyUrl);
  if (!proxyResponse.ok) {
    throw new Error(`字幕下载失败（HTTP ${proxyResponse.status}）`);
  }
  const proxied = await proxyResponse.text();
  if (!proxied || !proxied.trim()) {
    throw new Error('该视频没有可用的字幕轨道，或 YouTube 拒绝了字幕请求');
  }
  return { text: proxied, via: 'proxy' };
}

/* ---------------------------------- 翻译 ---------------------------------- */

async function translateWithBackend({ texts, targetLang, sourceLang, context }) {
  const settings = await getSettings();
  const backend = normalizeBackendUrl(settings.backendUrl);
  const response = await fetch(`${backend}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts, targetLang, sourceLang, context }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || !Array.isArray(payload.translations)) {
    const message = (payload && payload.message) || `翻译服务返回 HTTP ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

async function checkBackend() {
  const settings = await getSettings();
  const backend = normalizeBackendUrl(settings.backendUrl);
  try {
    const response = await fetch(`${backend}/api/health`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return { ok: true, backend, payload };
  } catch (error) {
    return { ok: false, backend, message: error instanceof Error ? error.message : String(error) };
  }
}

/* -------------------------------- 版本更新 -------------------------------- */

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

async function checkUpdate() {
  const settings = await getSettings();
  const backend = normalizeBackendUrl(settings.backendUrl);
  const current = chrome.runtime.getManifest().version;
  const response = await fetch(`${backend}/api/extension/latest`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`更新服务返回 HTTP ${response.status}`);
  const payload = await response.json();
  const latest = payload.version || current;
  return {
    current,
    latest,
    hasUpdate: compareVersions(latest, current) > 0,
    zipUrl: payload.zipUrl || `${backend}/lingualens-v${latest}.zip`,
    crxUrl: payload.crxUrl || `${backend}/lingualens.crx`,
    notes: Array.isArray(payload.notes) ? payload.notes : [],
    releasedAt: payload.releasedAt || '',
  };
}

/* ---------------------------------- 下载 ---------------------------------- */

function toDataUrl(content, mime) {
  return `data:${mime};charset=utf-8,${encodeURIComponent(content)}`;
}

async function downloadFile({ filename, content, mime }) {
  const url = toDataUrl(content, mime || 'text/plain');
  const id = await chrome.downloads.download({ url, filename, saveAs: false });
  return { ok: true, downloadId: id, filename };
}

/* --------------------------------- 消息路由 -------------------------------- */

const handlers = {
  GET_SETTINGS: () => getSettings(),
  SET_SETTINGS: (payload) => setSettings(payload),
  CHECK_BACKEND: () => checkBackend(),
  CHECK_UPDATE: () => checkUpdate(),
  FETCH_TRACKS: async ({ videoId }) => {
    if (!videoId) throw new Error('缺少 videoId');
    return fetchTracksFromWatchPage(videoId);
  },
  FETCH_SUBTITLE: async ({ baseUrl }) => {
    if (!baseUrl) throw new Error('缺少字幕地址');
    return fetchSubtitleText(baseUrl);
  },
  TRANSLATE: async (payload) => translateWithBackend(payload),
  DOWNLOAD_FILE: async (payload) => downloadFile(payload),
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = handlers[message && message.type];
  if (!handler) {
    sendResponse({ ok: false, error: 'UNKNOWN_MESSAGE' });
    return false;
  }

  Promise.resolve(handler(message.payload || {}))
    .then((data) => sendResponse({ ok: true, data }))
    .catch((error) =>
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    );
  return true;
});

chrome.runtime.onInstalled.addListener(async (details) => {
  const current = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  await chrome.storage.sync.set({ ...DEFAULT_SETTINGS, ...current });
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'options.html?welcome=1' });
  }
});
