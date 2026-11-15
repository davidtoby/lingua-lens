/* TobyTranslate · YouTube 双语字幕 —— 内容脚本 */
(() => {
  if (window.__ytbtLoaded) return;
  window.__ytbtLoaded = true;

  const DEFAULT_SETTINGS = {
    enabled: true,
    autoTranslate: true,
    targetLang: 'zh-CN',
    backendUrl: 'http://localhost:5050',
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

  const state = {
    settings: { ...DEFAULT_SETTINGS },
    videoId: null,
    title: '',
    tracks: [],
    track: null,
    cues: [],
    translations: [],
    status: 'idle',
    error: '',
    progress: { done: 0, total: 0 },
    enabled: false,
    overlay: null,
    captionEl: null,
    translatedEl: null,
    originalEl: null,
    statusEl: null,
    toolbarEl: null,
    currentIndex: -1,
    generation: 0,
    rafId: 0,
    injected: false,
    lastStatusText: '',
  };

  /* ------------------------------- 基础工具 ------------------------------- */

  function send(type, payload) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type, payload }, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        if (!response) {
          reject(new Error('后台无响应'));
          return;
        }
        if (!response.ok) {
          reject(new Error(response.error || '请求失败'));
          return;
        }
        resolve(response.data);
      });
    });
  }

  function log(...args) {
    console.log('[TobyTranslate]', ...args);
  }

  function getVideoId() {
    const url = new URL(location.href);
    if (url.hostname.endsWith('youtube.com')) {
      if (url.pathname === '/watch') return url.searchParams.get('v');
      const match = url.pathname.match(/^\/(shorts|embed|live)\/([\w-]{6,})/);
      if (match) return match[2];
    }
    if (url.hostname === 'youtu.be') return url.pathname.slice(1) || null;
    return null;
  }

  function getPlayer() {
    return (
      document.querySelector('#movie_player') ||
      document.querySelector('.html5-video-player') ||
      document.querySelector('ytd-player')
    );
  }

  function getVideo() {
    return document.querySelector('video.html5-main-video') || document.querySelector('video');
  }

  function formatTime(seconds, comma) {
    const total = Math.max(0, seconds || 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = Math.floor(total % 60);
    const ms = Math.round((total - Math.floor(total)) * 1000);
    const pad = (value, size = 2) => String(value).padStart(size, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}${comma ? ',' : '.'}${pad(ms, 3)}`;
  }

  /* ------------------------------ 页面桥接 ------------------------------- */

  function injectPageScript() {
    if (state.injected) return;
    state.injected = true;
    try {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('injected.js');
      script.id = 'ytbt-injected-script';
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    } catch (error) {
      log('注入页面脚本失败', error);
    }
  }

  function requestTracksFromPage() {
    injectPageScript();
    return new Promise((resolve) => {
      const id = `ytbt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let settled = false;

      const onMessage = (event) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.source !== 'ytbt-page' || data.type !== 'TRACKS_RESULT' || data.id !== id) return;
        settled = true;
        window.removeEventListener('message', onMessage);
        resolve({ tracks: data.tracks || [], title: data.title || '' });
      };

      window.addEventListener('message', onMessage);
      window.postMessage({ source: 'ytbt-content', type: 'GET_TRACKS', id }, '*');

      setTimeout(() => {
        if (settled) return;
        window.postMessage({ source: 'ytbt-content', type: 'GET_TRACKS_RETRY', id }, '*');
      }, 400);

      setTimeout(() => {
        if (settled) return;
        window.removeEventListener('message', onMessage);
        resolve({ tracks: [], title: '' });
      }, 4000);
    });
  }

  function requestFromPage(type, payload, resultType, timeout) {
    injectPageScript();
    return new Promise((resolve) => {
      const id = `ytbt-${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      let settled = false;

      const onMessage = (event) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.source !== 'ytbt-page' || data.type !== resultType || data.id !== id) return;
        settled = true;
        window.removeEventListener('message', onMessage);
        resolve(data);
      };

      window.addEventListener('message', onMessage);
      window.postMessage({ source: 'ytbt-content', type, id, ...(payload || {}) }, '*');

      setTimeout(() => {
        if (settled) return;
        window.removeEventListener('message', onMessage);
        resolve(null);
      }, timeout || 10000);
    });
  }

  /**
   * 字幕正文有三条获取路径，依次降级：
   * 1. 后台直接拉 timedtext（带 Cookie，速度最快）
   * 2. 页面世界拉 timedtext（部分视频需要页面 Referer / pot 上下文）
   * 3. YouTube 官方 transcript 面板接口（不依赖 timedtext 权限）
   */
  async function fetchCuesForTrack(track) {
    if (!track || !track.baseUrl) return { cues: [], via: 'none' };

    try {
      const data = await send('FETCH_SUBTITLE', { baseUrl: track.baseUrl });
      const cues = parseSubtitles(data.text || '');
      if (cues.length) return { cues, via: data.via || 'direct' };
    } catch (error) {
      log('后台获取字幕正文失败，尝试页面内获取', error);
    }

    const pageResult = await requestFromPage(
      'GET_TIMEDTEXT',
      { baseUrl: track.baseUrl },
      'TIMEDTEXT_RESULT',
      12000,
    );
    if (pageResult && pageResult.text) {
      const cues = parseSubtitles(pageResult.text);
      if (cues.length) return { cues, via: 'page' };
    }

    const potResult = await requestFromPage(
      'GET_POT_TIMEDTEXT',
      { languageCode: track.languageCode },
      'POT_TIMEDTEXT_RESULT',
      10000,
    );
    if (potResult && potResult.text) {
      const cues = parseSubtitles(potResult.text);
      if (cues.length) return { cues, via: 'player-pot' };
    }

    const transcript = await requestFromPage('GET_TRANSCRIPT', {}, 'TRANSCRIPT_RESULT', 15000);
    if (transcript && Array.isArray(transcript.cues) && transcript.cues.length) {
      return { cues: dedupeCues(transcript.cues), via: 'transcript' };
    }

    return { cues: [], via: 'none' };
  }

  /* ------------------------------ 字幕解析 ------------------------------- */

  function dedupeCues(cues) {
    const output = [];
    for (const cue of cues) {
      const text = cue.text.replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const previous = output[output.length - 1];
      if (previous && previous.text === text) {
        previous.end = Math.max(previous.end, cue.end);
        continue;
      }
      if (previous && cue.start < previous.start) continue;
      output.push({ start: cue.start, end: Math.max(cue.end, cue.start + 0.4), text });
    }
    return output;
  }

  function parseJson3(raw) {
    const data = JSON.parse(raw);
    const events = Array.isArray(data.events) ? data.events : [];
    const cues = [];
    for (const event of events) {
      if (!event || !Array.isArray(event.segs)) continue;
      const start = (event.tStartMs || 0) / 1000;
      const duration = (event.dDurationMs || 0) / 1000;
      const text = event.segs.map((seg) => seg.utf8 || '').join('').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      cues.push({ start, end: start + (duration || 2), text });
    }
    return dedupeCues(cues);
  }

  function parseXml(raw) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(raw, 'text/xml');
    const nodes = Array.from(doc.getElementsByTagName('text'));
    const cues = nodes.map((node) => {
      const start = Number(node.getAttribute('start') || 0);
      const duration = Number(node.getAttribute('dur') || 0);
      const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
      return { start, end: start + (duration || 2), text };
    });
    return dedupeCues(cues.filter((cue) => cue.text));
  }

  function parseSubtitles(raw) {
    const text = (raw || '').trim();
    if (!text) return [];
    if (text.startsWith('{')) {
      try {
        return parseJson3(text);
      } catch (error) {
        log('json3 解析失败', error);
        return [];
      }
    }
    try {
      return parseXml(text);
    } catch (error) {
      log('XML 解析失败', error);
      return [];
    }
  }

  /** 解析标准 SRT 文本 */
  function parseSrt(raw) {
    const blocks = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split(/\n{2,}/);
    const toSeconds = (stamp) => {
      const match = stamp.trim().match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/);
      if (!match) return null;
      const [, h, m, s, ms] = match;
      return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms.padEnd(3, '0')) / 1000;
    };
    const cues = [];
    blocks.forEach((block) => {
      const lines = block.split('\n').filter((line) => line.trim() !== '');
      if (!lines.length) return;
      const timeLineIndex = lines.findIndex((line) => line.includes('-->'));
      if (timeLineIndex < 0) return;
      const [startRaw, endRaw] = lines[timeLineIndex].split('-->');
      const start = toSeconds(startRaw || '');
      const end = toSeconds(endRaw || '');
      const text = lines
        .slice(timeLineIndex + 1)
        .join(' ')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (start === null || end === null || !text) return;
      cues.push({ start, end: Math.max(end, start + 0.4), text });
    });
    return dedupeCues(cues);
  }

  /** 解析 VTT 文本（结构与 SRT 接近，去掉 WEBVTT 头即可复用） */
  function parseVtt(raw) {
    const body = raw.replace(/^\uFEFF/, '').replace(/^WEBVTT[^\n]*\n/, '');
    return parseSrt(body);
  }

  /** 从用户手动导入的字幕文件里取出 cues */
  function parseSubtitleFile(text) {
    const raw = (text || '').replace(/^\uFEFF/, '').trim();
    if (!raw) return [];
    if (raw.startsWith('{')) return parseSubtitles(raw);
    if (/^WEBVTT/i.test(raw)) return parseVtt(raw);
    if (raw.includes('-->')) return parseSrt(raw);
    return [];
  }

  /** 手动导入字幕：自动翻译流程与视频字幕一致，导出也复用同一套逻辑 */
  async function importSubtitleFile({ name, content }) {
    const cues = parseSubtitleFile(content);
    if (!cues.length) throw new Error('没能从文件里解析出字幕，请确认是 SRT / VTT 格式');
    state.generation += 1;
    const generation = state.generation;
    state.videoId = state.videoId || getVideoId() || 'imported';
    state.title = (name || '').replace(/\.(srt|vtt|json)$/i, '') || state.title;
    state.cues = cues;
    state.translations = new Array(cues.length).fill('');
    state.status = 'ready';
    state.error = '';
    state.source = 'import';
    state.progress = { done: 0, total: cues.length };
    ensureOverlay();
    renderStatus();
    startLoop();
    if (state.enabled && state.settings.autoTranslate) {
      translateCues(generation).catch((error) => log('导入字幕翻译失败', error));
    }
    return { cueCount: cues.length, title: state.title };
  }

  /* ------------------------------ 字幕轨选择 ------------------------------ */

  function scoreTrack(track) {
    let score = 0;
    if (track.kind !== 'asr') score += 100;
    if (track.languageCode === 'en' || track.languageCode?.startsWith('en')) score += 40;
    if (state.settings.targetLang && track.languageCode === state.settings.targetLang) score -= 30;
    if (track.languageCode && track.languageCode.startsWith('zh')) score += 5;
    return score;
  }

  function pickTrack(tracks) {
    if (!tracks.length) return null;
    const preference = state.settings.sourcePreference;
    if (preference && preference !== 'auto') {
      const matched = tracks.find((track) => track.languageCode === preference);
      if (matched) return matched;
    }
    return [...tracks].sort((a, b) => scoreTrack(b) - scoreTrack(a))[0];
  }

  /* ------------------------------- 翻译流程 ------------------------------- */

  function cacheKey(videoId, sourceLang, targetLang) {
    return `ytbt:cache:${videoId}:${sourceLang || 'auto'}:${targetLang}`;
  }

  async function loadCachedTranslations(cueCount) {
    try {
      const key = cacheKey(state.videoId, state.track?.languageCode, state.settings.targetLang);
      const stored = await chrome.storage.local.get(key);
      const value = stored[key];
      if (value && value.cueCount === cueCount && Array.isArray(value.translations)) {
        const filled = value.translations.filter((line) => line && line.trim()).length;
        if (filled >= cueCount * 0.9) return value.translations;
      }
    } catch (error) {
      log('读取缓存失败', error);
    }
    return null;
  }

  async function saveCachedTranslations(translations) {
    try {
      const key = cacheKey(state.videoId, state.track?.languageCode, state.settings.targetLang);
      await chrome.storage.local.set({
        [key]: {
          cueCount: state.cues.length,
          translations,
          updatedAt: Date.now(),
        },
      });
    } catch (error) {
      log('写入缓存失败', error);
    }
  }

  async function translateCues(generation, options = {}) {
    const chunkSize = options.chunkSize || 24;
    const total = state.cues.length;
    state.progress = { done: 0, total };
    state.status = 'translating';
    renderStatus();

    const results = new Array(total).fill('');
    for (let offset = 0; offset < total; offset += chunkSize) {
      if (generation !== state.generation) return results;
      const slice = state.cues.slice(offset, offset + chunkSize);
      try {
        const data = await send('TRANSLATE', {
          texts: slice.map((cue) => cue.text),
          targetLang: state.settings.targetLang,
          sourceLang: state.track?.languageCode || undefined,
          context: state.title.slice(0, 200),
        });
        data.translations.forEach((line, index) => {
          results[offset + index] = line || '';
        });
      } catch (error) {
        state.error = `翻译失败：${error.message}`;
        state.status = 'error';
        state.translations = results;
        renderStatus();
        renderCaption();
        log('翻译失败', error);
        return results;
      }
      if (generation !== state.generation) return results;
      state.translations = results.slice();
      state.progress = { done: Math.min(total, offset + slice.length), total };
      renderStatus();
      renderCaption();
    }

    state.status = 'ready';
    renderStatus();
    await saveCachedTranslations(results);
    return results;
  }

  /* ------------------------------- 浮层渲染 ------------------------------- */

  function ensureOverlay() {
    const player = getPlayer();
    if (!player) return null;
    if (state.overlay && state.overlay.isConnected && state.overlay.parentElement === player) {
      return state.overlay;
    }

    const overlay = document.createElement('div');
    overlay.className = 'ytbt-overlay';

    const toolbar = document.createElement('div');
    toolbar.className = 'ytbt-toolbar';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'ytbt-btn ytbt-btn-toggle';
    toggleBtn.textContent = '译';
    toggleBtn.title = '开启 / 关闭双语字幕（Alt+T）';
    toggleBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      setEnabled(!state.enabled);
    });

    const downloadBtn = document.createElement('button');
    downloadBtn.type = 'button';
    downloadBtn.className = 'ytbt-btn';
    downloadBtn.textContent = '下载双语字幕';
    downloadBtn.title = '下载双语 SRT 字幕（Alt+D）';
    downloadBtn.addEventListener('click', async (event) => {
      event.stopPropagation();
      downloadBtn.disabled = true;
      downloadBtn.textContent = '准备中…';
      try {
        await handleDownload('srt', 'bilingual');
        downloadBtn.textContent = '已开始下载';
      } catch (error) {
        downloadBtn.textContent = '下载失败';
        showToast(`下载失败：${error.message}`);
      }
      setTimeout(() => {
        downloadBtn.disabled = false;
        downloadBtn.textContent = '下载双语字幕';
      }, 2200);
    });

    toolbar.appendChild(toggleBtn);
    toolbar.appendChild(downloadBtn);

    const caption = document.createElement('div');
    caption.className = 'ytbt-caption';
    const translated = document.createElement('div');
    translated.className = 'ytbt-translated';
    const original = document.createElement('div');
    original.className = 'ytbt-original';
    caption.appendChild(translated);
    caption.appendChild(original);

    const status = document.createElement('div');
    status.className = 'ytbt-status';

    overlay.appendChild(toolbar);
    overlay.appendChild(caption);
    overlay.appendChild(status);
    player.appendChild(overlay);

    state.overlay = overlay;
    state.toolbarEl = toolbar;
    state.captionEl = caption;
    state.translatedEl = translated;
    state.originalEl = original;
    state.statusEl = status;

    applyStyleSettings();
    renderStatus();
    return overlay;
  }

  function applyStyleSettings() {
    if (!state.overlay) return;
    state.overlay.style.setProperty('--ytbt-font-size', `${state.settings.fontSize || 20}px`);
    state.overlay.style.bottom = `${state.settings.position ?? 12}%`;
    state.overlay.classList.toggle('ytbt-hide-original', !state.settings.showOriginal);
    state.overlay.classList.toggle('ytbt-enabled', state.enabled);
    const toggle = state.overlay.querySelector('.ytbt-btn-toggle');
    if (toggle) toggle.classList.toggle('ytbt-active', state.enabled);
  }

  function renderStatus() {
    if (!state.statusEl) return;
    let text = '';
    if (!state.enabled) text = '';
    else if (state.status === 'loading') text = '正在加载字幕…';
    else if (state.status === 'translating') {
      text = `AI 翻译中 ${state.progress.done}/${state.progress.total}`;
    } else if (state.status === 'error') text = state.error || '出错了，请稍后重试';
    else if (state.status === 'no-captions') text = '该视频没有可翻译的字幕轨';
    else if (state.status === 'ready' && state.cues.length) {
      text = `双语字幕已就绪 · ${state.cues.length} 条 · ${LANG_LABELS[state.settings.targetLang] || state.settings.targetLang}`;
      setTimeout(() => {
        if (state.status === 'ready' && state.statusEl) state.statusEl.textContent = '';
      }, 2600);
    }
    if (state.lastStatusText !== text) {
      state.statusEl.textContent = text;
      state.lastStatusText = text;
    }
    state.statusEl.classList.toggle('ytbt-status-visible', Boolean(text));
  }

  function renderCaption() {
    if (!state.overlay) return;
    const video = getVideo();
    if (!video || !state.cues.length || !state.enabled) {
      if (state.captionEl) state.captionEl.classList.remove('ytbt-caption-visible');
      state.currentIndex = -1;
      toggleNativeCaptions(false);
      return;
    }

    const index = findCueIndex(video.currentTime);
    const nextTranslated = index >= 0 ? state.translations[index] || '' : '';
    if (index === state.currentIndex && nextTranslated === state.renderedTranslation) {
      state.captionEl.classList.toggle('ytbt-caption-visible', index >= 0);
      return;
    }
    state.currentIndex = index;
    state.renderedTranslation = nextTranslated;

    if (index < 0) {
      state.captionEl.classList.remove('ytbt-caption-visible');
      toggleNativeCaptions(false);
      return;
    }

    const cue = state.cues[index];
    const translated = state.translations[index] || '';
    state.translatedEl.textContent = translated || cue.text;
    state.originalEl.textContent = cue.text;
    state.captionEl.classList.toggle('ytbt-no-translation', !translated);
    state.captionEl.classList.add('ytbt-caption-visible');
    toggleNativeCaptions(Boolean(state.settings.hideNativeCaptions));
  }

  function findCueIndex(time) {
    const cues = state.cues;
    let low = 0;
    let high = cues.length - 1;
    let result = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (cues[mid].start <= time) {
        result = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    if (result >= 0 && time <= cues[result].end + 0.25) return result;
    return -1;
  }

  function toggleNativeCaptions(hide) {
    const player = getPlayer();
    if (!player) return;
    player.classList.toggle('ytbt-hide-native', Boolean(hide));
  }

  function showToast(message) {
    ensureOverlay();
    if (!state.overlay) return;
    let toast = state.overlay.querySelector('.ytbt-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'ytbt-toast';
      state.overlay.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('ytbt-toast-visible');
    clearTimeout(toast.__timer);
    toast.__timer = setTimeout(() => toast.classList.remove('ytbt-toast-visible'), 4000);
  }

  function startLoop() {
    if (state.rafId) return;
    const tick = () => {
      state.rafId = requestAnimationFrame(tick);
      renderCaption();
    };
    state.rafId = requestAnimationFrame(tick);
  }

  /* -------------------------------- 主流程 -------------------------------- */

  async function loadSettings() {
    try {
      const settings = await send('GET_SETTINGS');
      state.settings = { ...DEFAULT_SETTINGS, ...settings };
    } catch (error) {
      log('读取设置失败，使用默认值', error);
      state.settings = { ...DEFAULT_SETTINGS };
    }
    state.enabled = Boolean(state.settings.enabled);
    applyStyleSettings();
  }

  async function resolveTracks() {
    const fromPage = await requestTracksFromPage();
    if (fromPage.tracks.length) {
      state.tracks = fromPage.tracks;
      state.title = fromPage.title || state.title;
      return;
    }
    if (!state.videoId) return;
    try {
      const data = await send('FETCH_TRACKS', { videoId: state.videoId });
      state.tracks = data.tracks || [];
      state.title = data.title || state.title;
    } catch (error) {
      log('后台获取字幕轨失败', error);
      state.tracks = [];
    }
  }

  async function setup(videoId) {
    state.generation += 1;
    const generation = state.generation;

    state.videoId = videoId;
    state.tracks = [];
    state.track = null;
    state.cues = [];
    state.translations = [];
    state.error = '';
    state.progress = { done: 0, total: 0 };
    state.status = 'loading';
    state.currentIndex = -1;

    ensureOverlay();
    renderStatus();
    if (state.translatedEl) state.translatedEl.textContent = '';
    if (state.originalEl) state.originalEl.textContent = '';

    if (!videoId) {
      state.status = 'idle';
      renderStatus();
      return;
    }

    await resolveTracks();
    if (generation !== state.generation) return;

    if (!state.tracks.length) {
      state.status = 'no-captions';
      renderStatus();
      return;
    }

    const track = pickTrack(state.tracks);
    state.track = track;
    if (!track) {
      state.status = 'no-captions';
      renderStatus();
      return;
    }

    state.status = 'loading';
    renderStatus();

    let fetched = { cues: [], via: 'none' };
    try {
      fetched = await fetchCuesForTrack(track);
    } catch (error) {
      state.status = 'error';
      state.error = error.message;
      renderStatus();
      return;
    }
    if (generation !== state.generation) return;

    state.cues = fetched.cues;
    state.source = fetched.via;
    if (!state.cues.length) {
      state.status = 'error';
      state.error = '该视频没有可用字幕（YouTube 未返回字幕内容），可在插件里手动导入字幕文件';
      renderStatus();
      return;
    }

    state.translations = new Array(state.cues.length).fill('');
    state.status = 'ready';
    renderStatus();
    startLoop();

    const cached = await loadCachedTranslations(state.cues.length);
    if (generation !== state.generation) return;
    if (cached) {
      state.translations = cached;
      state.progress = { done: state.cues.length, total: state.cues.length };
      state.status = 'ready';
      renderStatus();
      renderCaption();
      return;
    }

    if (state.enabled && state.settings.autoTranslate) {
      translateCues(generation);
    }
  }

  function setEnabled(enabled) {
    state.enabled = Boolean(enabled);
    state.settings.enabled = state.enabled;
    applyStyleSettings();
    send('SET_SETTINGS', { enabled: state.enabled }).catch(() => {});
    if (state.enabled) {
      if (state.cues.length && state.settings.autoTranslate) {
        const hasTranslation = state.translations.some((line) => line && line.trim());
        if (!hasTranslation) translateCues(state.generation);
      }
      if (state.videoId) startLoop();
    } else {
      state.captionEl?.classList.remove('ytbt-caption-visible');
      toggleNativeCaptions(false);
    }
    renderStatus();
    renderCaption();
  }

  /* ------------------------------ 字幕文件生成 ----------------------------- */

  function sanitizeFilename(name) {
    return (name || 'youtube-subtitle')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90);
  }

  function buildSrt(mode) {
    const lines = [];
    state.cues.forEach((cue, index) => {
      const original = cue.text;
      const translated = (state.translations[index] || '').trim();
      const body =
        mode === 'target'
          ? translated || original
          : mode === 'source'
            ? original
            : [translated, original].filter(Boolean).join('\n');
      lines.push(
        `${index + 1}\n${formatTime(cue.start, true)} --> ${formatTime(cue.end, true)}\n${body}\n`,
      );
    });
    return lines.join('\n');
  }

  function buildVtt(mode) {
    const lines = ['WEBVTT', ''];
    state.cues.forEach((cue, index) => {
      const original = cue.text;
      const translated = (state.translations[index] || '').trim();
      const body =
        mode === 'target'
          ? translated || original
          : mode === 'source'
            ? original
            : [translated, original].filter(Boolean).join('\n');
      lines.push(`${index + 1}`);
      lines.push(`${formatTime(cue.start, false)} --> ${formatTime(cue.end, false)}`);
      lines.push(body);
      lines.push('');
    });
    return lines.join('\n');
  }

  /** 用 Blob + <a download> 触发下载：比 data URL 可靠，文件名由浏览器直接采用 */
  function downloadTextFile(filename, content, mime) {
    const blob = new Blob([content], { type: `${mime || 'text/plain'};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      link.remove();
    }, 15000);
  }

  async function ensureTranslations() {
    if (!state.cues.length) throw new Error('当前视频还没有可用字幕');
    const missing = state.cues.some((_, index) => !(state.translations[index] || '').trim());
    if (!missing) return;
    showToast('正在补全翻译，完成后自动下载…');
    await translateCues(state.generation, { chunkSize: 24 });
    if (state.status === 'error') throw new Error(state.error || '翻译失败');
  }

  async function handleDownload(format, mode) {
    if (!state.videoId) throw new Error('当前页面不是 YouTube 视频');
    if (!state.cues.length) {
      if (state.status === 'loading') throw new Error('字幕还在加载，请稍后再试');
      throw new Error('该视频没有可下载的字幕');
    }
    await ensureTranslations();
    const content = format === 'vtt' ? buildVtt(mode) : buildSrt(mode);
    const suffix =
      mode === 'target' ? '译文' : mode === 'source' ? '原文' : '双语';
    const filename = `${sanitizeFilename(state.title || state.videoId)}.${suffix}.${format}`;
    downloadTextFile(filename, content, format === 'vtt' ? 'text/vtt' : 'text/plain');
    showToast(`已开始下载：${filename}`);
    return filename;
  }

  /* -------------------------------- 状态同步 ------------------------------- */

  function getStatus() {
    return {
      videoId: state.videoId,
      title: state.title,
      status: state.status,
      error: state.error,
      cueCount: state.cues.length,
      translatedCount: state.translations.filter((line) => line && line.trim()).length,
      progress: state.progress,
      enabled: state.enabled,
      hasCaptions: state.cues.length > 0,
      trackLanguage: state.track?.languageCode || '',
      trackName: state.track?.name || '',
      targetLang: state.settings.targetLang,
      backendUrl: state.settings.backendUrl,
      tracks: state.tracks.map((track) => ({
        languageCode: track.languageCode,
        name: track.name,
        kind: track.kind,
      })),
    };
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const type = message && message.type;
    if (!type) return false;

    if (type === 'GET_STATUS') {
      sendResponse({ ok: true, data: getStatus() });
      return false;
    }
    if (type === 'TOGGLE') {
      setEnabled(!state.enabled);
      sendResponse({ ok: true, data: getStatus() });
      return false;
    }
    if (type === 'SET_ENABLED') {
      setEnabled(Boolean(message.payload?.enabled));
      sendResponse({ ok: true, data: getStatus() });
      return false;
    }
    if (type === 'SET_TARGET_LANG') {
      const lang = message.payload?.targetLang;
      if (lang && lang !== state.settings.targetLang) {
        state.settings.targetLang = lang;
        send('SET_SETTINGS', { targetLang: lang }).catch(() => {});
        state.translations = new Array(state.cues.length).fill('');
        state.status = 'ready';
        if (state.videoId) setup(state.videoId);
      }
      sendResponse({ ok: true, data: getStatus() });
      return false;
    }
    if (type === 'REFRESH') {
      state.generation += 1;
      setup(getVideoId());
      sendResponse({ ok: true, data: getStatus() });
      return false;
    }
    if (type === 'DOWNLOAD_SUBTITLES') {
      const format = message.payload?.format === 'vtt' ? 'vtt' : 'srt';
      const mode = message.payload?.mode || 'bilingual';
      handleDownload(format, mode)
        .then((filename) => sendResponse({ ok: true, data: { filename } }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (type === 'IMPORT_SUBTITLES') {
      importSubtitleFile(message.payload || {})
        .then((data) => sendResponse({ ok: true, data }))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }
    if (type === 'SETTINGS_UPDATED') {
      loadSettings().then(() => {
        applyStyleSettings();
        renderStatus();
        renderCaption();
        sendResponse({ ok: true, data: getStatus() });
      });
      return true;
    }
    return false;
  });

  /* -------------------------------- 生命周期 ------------------------------- */

  function watchNavigation() {
    let lastHref = location.href;
    setInterval(() => {
      if (location.href === lastHref) return;
      lastHref = location.href;
      const videoId = getVideoId();
      if (videoId && videoId !== state.videoId) {
        setTimeout(() => setup(videoId), 900);
      }
    }, 1000);

    document.addEventListener('yt-navigate-finish', () => {
      const videoId = getVideoId();
      if (videoId && videoId !== state.videoId) {
        setTimeout(() => setup(videoId), 700);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      // 用 code 判断，避免 macOS 下 Option 组合键产生特殊字符
      const code = event.code || '';
      const key = (event.key || '').toLowerCase();
      if (code === 'KeyT' || key === 't') {
        event.preventDefault();
        setEnabled(!state.enabled);
      }
      if ((code === 'KeyD' || key === 'd') && state.cues.length) {
        event.preventDefault();
        handleDownload('srt', 'bilingual').catch((error) => showToast(`下载失败：${error.message}`));
      }
    });
  }

  async function bootstrap() {
    await loadSettings();
    watchNavigation();
    const videoId = getVideoId();
    if (videoId) {
      ensureOverlay();
      setup(videoId);
    }
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    let touched = false;
    for (const [key, change] of Object.entries(changes)) {
      if (key in DEFAULT_SETTINGS) {
        state.settings[key] = change.newValue;
        touched = true;
      }
    }
    if (!touched) return;
    if ('enabled' in changes) state.enabled = Boolean(state.settings.enabled);
    applyStyleSettings();
    renderStatus();
    renderCaption();
  });

  bootstrap();
})();
