const { chromium } = require('playwright');
const fs = require('fs');
const EXT_DIR = '/Users/bytedance/Coze/Drive/TobyTranslateAssist/yt-bilingual-translator/public/extension';
const srt = fs.readFileSync('/tmp/pwtest/data/import-sample.srt', 'utf8');

const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`); };

(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-imp-' + Date.now(), {
    channel: 'chromium', headless: true, ignoreDefaultArgs: ['--disable-extensions'],
    viewport: { width: 1280, height: 800 }, acceptDownloads: true,
    args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`, '--no-first-run', '--mute-audio'],
  });
  const page = ctx.pages()[0] || (await ctx.newPage());
  const FIXTURE = fs.readFileSync('/Users/bytedance/Coze/Drive/TobyTranslateAssist/yt-bilingual-translator/tests/fixtures/youtube-fixture.html', 'utf8');
  await page.route('https://www.youtube.com/**', (route) => {
    if (route.request().url().includes('/watch')) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FIXTURE });
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto('https://www.youtube.com/watch?v=IMPTEST123', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ytbt-overlay', { timeout: 30000 });
  await page.waitForTimeout(1500);

  let sw = ctx.serviceWorkers()[0];
  if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
  const tabId = await sw.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    const hit = tabs.find((t) => t.url && t.url.includes('youtube.com/watch'));
    return hit && hit.id;
  });
  check('找到 YouTube 标签页', Boolean(tabId), String(tabId));

  const imported = await sw.evaluate(async ({ tabId, srt }) => {
    return await chrome.tabs.sendMessage(tabId, { type: 'IMPORT_SUBTITLES', payload: { name: 'import-sample.srt', content: srt } });
  }, { tabId, srt });
  check('导入 SRT 成功', imported && imported.ok && imported.data.cueCount === 4, JSON.stringify(imported && imported.data));

  let status = null;
  for (let i = 0; i < 30; i += 1) {
    status = await sw.evaluate(async (tabId) => (await chrome.tabs.sendMessage(tabId, { type: 'GET_STATUS' })).data, tabId);
    if (status.cueCount === 4 && status.translatedCount >= 4) break;
    await page.waitForTimeout(1000);
  }
  check('导入后字幕条数=4', status.cueCount === 4, String(status.cueCount));
  check('导入后全部翻译完成', status.translatedCount === 4, `${status.translatedCount}/4`);

  await page.evaluate(() => {
    const video = document.querySelector('video');
    if (video) { video.currentTime = 4; video.dispatchEvent(new Event('timeupdate')); }
  });
  await page.waitForTimeout(1200);
  const overlay = await page.evaluate(() => {
    const cap = document.querySelector('.ytbt-caption');
    return { visible: cap ? cap.classList.contains('ytbt-caption-visible') : false, text: cap ? cap.innerText.trim() : '' };
  });
  check('导入字幕后浮层渲染双语', overlay.visible && /\n/.test(overlay.text) && /[\u4e00-\u9fa5]/.test(overlay.text), overlay.text.replace(/\n/g, ' | '));

  const dlPromise = page.waitForEvent('download', { timeout: 20000 });
  const dlRes = await sw.evaluate(async (tabId) => await chrome.tabs.sendMessage(tabId, { type: 'DOWNLOAD_SUBTITLES', payload: { format: 'srt', mode: 'bilingual' } }), tabId);
  check('下载指令返回成功', Boolean(dlRes && dlRes.ok), JSON.stringify(dlRes && dlRes.data));
  const dl = await dlPromise;
  const out = '/tmp/import-bilingual.srt';
  await dl.saveAs(out);
  const body = fs.readFileSync(out, 'utf8');
  check('导出文件含 4 条时间轴', (body.match(/-->/g) || []).length === 4, String((body.match(/-->/g) || []).length));
  check('导出含译文与原文', /Attention is all you need/.test(body) && /注意力/.test(body), body.split('\n').slice(0, 4).join(' / '));

  console.log('\n==== 汇总 ====');
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} 通过`);
  await ctx.close();
  process.exit(failed.length ? 1 : 0);
})();
