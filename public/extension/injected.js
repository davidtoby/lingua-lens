/**
 * 运行在 YouTube 页面主世界（page world）的桥接脚本。
 * 内容脚本无法直接读取页面上的 ytInitialPlayerResponse / ytcfg，
 * 这里把字幕轨、字幕正文、官方字幕文稿（transcript）取出来，通过 postMessage 交给内容脚本。
 */
(function () {
  const SOURCE_PAGE = 'ytbt-page';
  const SOURCE_CONTENT = 'ytbt-content';

  function readPlayerResponse() {
    try {
      const player = document.getElementById('movie_player');
      if (player && typeof player.getPlayerResponse === 'function') {
        const response = player.getPlayerResponse();
        if (response && response.captions) return response;
      }
    } catch (error) {
      /* ignore */
    }
    return window.ytInitialPlayerResponse || null;
  }

  function readTitle(response) {
    try {
      if (response && response.videoDetails && response.videoDetails.title) {
        return response.videoDetails.title;
      }
    } catch (error) {
      /* ignore */
    }
    return document.title.replace(/\s*-\s*YouTube\s*$/, '');
  }

  function collectTracks(response) {
    const tracklist =
      response &&
      response.captions &&
      response.captions.playerCaptionsTracklistRenderer &&
      response.captions.playerCaptionsTracklistRenderer.captionTracks;
    if (!Array.isArray(tracklist)) return [];

    return tracklist
      .filter((track) => track && track.baseUrl)
      .map((track) => {
        let name = '';
        if (track.name) {
          if (typeof track.name.simpleText === 'string') name = track.name.simpleText;
          else if (Array.isArray(track.name.runs)) name = track.name.runs.map((run) => run.text).join('');
        }
        let displayName = '';
        if (track.vssId) displayName = track.vssId.replace(/^\./, '').split('.')[0];
        return {
          baseUrl: track.baseUrl,
          languageCode: track.languageCode || displayName || 'unknown',
          kind: track.kind || '',
          name: name || displayName || track.languageCode || '未知语言',
          isTranslatable: Boolean(track.isTranslatable),
        };
      });
  }

  function respondTracks(id) {
    const response = readPlayerResponse();
    window.postMessage(
      {
        source: SOURCE_PAGE,
        type: 'TRACKS_RESULT',
        id,
        title: readTitle(response),
        tracks: collectTracks(response),
      },
      '*',
    );
  }

  /* ------------------------------- 字幕正文 ------------------------------- */

  async function respondTimedtext(id, baseUrl) {
    try {
      const url = new URL(baseUrl, 'https://www.youtube.com');
      url.searchParams.set('fmt', 'json3');
      const response = await fetch(url.toString(), { credentials: 'include' });
      const text = response.ok ? await response.text() : '';
      window.postMessage({ source: SOURCE_PAGE, type: 'TIMEDTEXT_RESULT', id, text, status: response.status }, '*');
    } catch (error) {
      window.postMessage(
        { source: SOURCE_PAGE, type: 'TIMEDTEXT_RESULT', id, text: '', error: String(error) },
        '*',
      );
    }
  }

  /**
   * 兜底：YouTube 现在会给字幕请求附加 pot 校验参数。
   * 打开原生字幕，让播放器自己去请求一次 timedtext，再从 performance 里复用那条带 pot 的地址。
   */
  async function respondPotTimedtext(id, languageCode) {
    try {
      const player = document.getElementById('movie_player');
      if (player && typeof player.setOption === 'function') {
        player.setOption('captions', 'track', { languageCode: languageCode || 'en' });
        if (typeof player.setOption === 'function') player.setOption('captions', 'reload', true);
      }
    } catch (error) {
      /* ignore */
    }

    const deadline = Date.now() + 6000;
    let entry = null;
    while (Date.now() < deadline) {
      const list = performance.getEntriesByType('resource').filter((item) => item.name.includes('/api/timedtext'));
      entry = list.reverse().find((item) => item.name.includes('pot=')) || null;
      if (entry) break;
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    if (!entry) {
      window.postMessage({ source: SOURCE_PAGE, type: 'POT_TIMEDTEXT_RESULT', id, text: '' }, '*');
      return;
    }

    try {
      const url = new URL(entry.name);
      url.searchParams.set('fmt', 'json3');
      const response = await fetch(url.toString(), { credentials: 'include' });
      const text = response.ok ? await response.text() : '';
      window.postMessage({ source: SOURCE_PAGE, type: 'POT_TIMEDTEXT_RESULT', id, text }, '*');
    } catch (error) {
      window.postMessage({ source: SOURCE_PAGE, type: 'POT_TIMEDTEXT_RESULT', id, text: '' }, '*');
    }
  }

  /* --------------------------- 官方 transcript 面板 -------------------------- */

  function findKey(node, key, depth) {
    if (!node || depth > 12 || typeof node !== 'object') return null;
    if (Object.prototype.hasOwnProperty.call(node, key)) return node[key];
    const values = Array.isArray(node) ? node : Object.values(node);
    for (const value of values) {
      const found = findKey(value, key, depth + 1);
      if (found) return found;
    }
    return null;
  }

  function readTranscriptParams() {
    try {
      if (window.ytInitialData) {
        const endpoint = findKey(window.ytInitialData, 'getTranscriptEndpoint', 0);
        if (endpoint && endpoint.params) return endpoint.params;
      }
    } catch (error) {
      /* ignore */
    }
    return null;
  }

  function readInnertubeContext() {
    try {
      if (window.ytcfg && typeof window.ytcfg.get === 'function') {
        const context = window.ytcfg.get('INNERTUBE_CONTEXT');
        if (context) return context;
      }
    } catch (error) {
      /* ignore */
    }
    return {
      client: { clientName: 'WEB', clientVersion: '2.20250101.00.00', hl: 'en', gl: 'US' },
    };
  }

  function parseRuns(node) {
    if (!node) return '';
    if (typeof node.simpleText === 'string') return node.simpleText;
    if (Array.isArray(node.runs)) return node.runs.map((run) => run.text || '').join('');
    if (typeof node.content === 'string') return node.content;
    return '';
  }

  function collectCues(data) {
    const cues = [];
    const push = (startMs, endMs, text) => {
      const clean = String(text || '')
        .replace(/\s+/g, ' ')
        .trim();
      if (!clean) return;
      const start = Number(startMs || 0) / 1000;
      const end = Number(endMs || 0) / 1000;
      cues.push({ start, end: end > start ? end : start + 2.5, text: clean });
    };

    // 旧版 transcriptRenderer：cueGroups[].cues[]
    (function walkLegacy(node, depth) {
      if (!node || depth > 10 || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach((item) => walkLegacy(item, depth + 1));
        return;
      }
      if (node.transcriptCueRenderer) {
        const renderer = node.transcriptCueRenderer;
        const cue = renderer.cue || {};
        push(renderer.startOffsetMs, Number(renderer.startOffsetMs || 0) + Number(renderer.durationMs || 0), parseRuns(cue));
      }
      Object.values(node).forEach((value) => walkLegacy(value, depth + 1));
    })(data, 0);

    if (cues.length) return cues;

    // 新版 transcriptSegmentRenderer：initialSegments[].transcriptSegmentRenderer
    (function walkSegments(node, depth) {
      if (!node || depth > 10 || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach((item) => walkSegments(item, depth + 1));
        return;
      }
      if (node.transcriptSegmentRenderer) {
        const renderer = node.transcriptSegmentRenderer;
        push(renderer.startMs, renderer.endMs, parseRuns(renderer.snippet));
      }
      Object.values(node).forEach((value) => walkSegments(value, depth + 1));
    })(data, 0);

    return cues;
  }

  async function respondTranscript(id) {
    const params = readTranscriptParams();
    if (!params) {
      window.postMessage({ source: SOURCE_PAGE, type: 'TRANSCRIPT_RESULT', id, cues: [], error: 'NO_PARAMS' }, '*');
      return;
    }

    try {
      const key =
        (window.ytcfg && typeof window.ytcfg.get === 'function' && window.ytcfg.get('INNERTUBE_API_KEY')) || '';
      const clientName =
        (window.ytcfg && typeof window.ytcfg.get === 'function' && window.ytcfg.get('INNERTUBE_CONTEXT_CLIENT_NAME')) ||
        1;
      const clientVersion =
        (window.ytcfg && typeof window.ytcfg.get === 'function' && window.ytcfg.get('INNERTUBE_CLIENT_VERSION')) || '';
      const url = `https://www.youtube.com/youtubei/v1/get_transcript?prettyPrint=false${key ? `&key=${key}` : ''}`;

      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Youtube-Client-Name': String(clientName),
          'X-Youtube-Client-Version': clientVersion,
        },
        body: JSON.stringify({ context: readInnertubeContext(), params }),
      });

      const text = await response.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (error) {
        data = null;
      }
      const cues = data ? collectCues(data) : [];
      window.postMessage(
        {
          source: SOURCE_PAGE,
          type: 'TRANSCRIPT_RESULT',
          id,
          cues,
          status: response.status,
          error: cues.length ? '' : `HTTP ${response.status}`,
        },
        '*',
      );
    } catch (error) {
      window.postMessage(
        { source: SOURCE_PAGE, type: 'TRANSCRIPT_RESULT', id, cues: [], error: String(error) },
        '*',
      );
    }
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== SOURCE_CONTENT) return;

    if (data.type === 'GET_TRACKS') respondTracks(data.id);
    if (data.type === 'GET_TIMEDTEXT') respondTimedtext(data.id, data.baseUrl);
    if (data.type === 'GET_TRANSCRIPT') respondTranscript(data.id);
    if (data.type === 'GET_POT_TIMEDTEXT') respondPotTimedtext(data.id, data.languageCode);
  });

  // 页面本身有时还没初始化完，收到请求后短暂重试，避免首屏拿不到字幕轨
  window.addEventListener('message', (event) => {
    const data = event.data;
    if (!data || data.source !== SOURCE_CONTENT || data.type !== 'GET_TRACKS_RETRY') return;
    setTimeout(() => respondTracks(data.id), 600);
    setTimeout(() => respondTracks(data.id), 1800);
  });
})();
