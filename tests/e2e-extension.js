const { chromium } = require('playwright');
const fs = require('fs');
const EXT_DIR = '/Users/bytedance/Coze/Drive/TobyTranslateAssist/yt-bilingual-translator/public/extension';
const FIXTURE = fs.readFileSync('/Users/bytedance/Coze/Drive/TobyTranslateAssist/yt-bilingual-translator/tests/fixtures/youtube-fixture.html', 'utf8');
const EXT_ID = 'pacplakdhminbijedcdadnjeekclkgkn';

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`);
}

(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-e2e-' + Date.now(), {
    channel: 'chromium', headless: true, ignoreDefaultArgs: ['--disable-extensions'], acceptDownloads: true,
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`, '--no-first-run'],
  });
  // 测试固定连本地后端（通过扩展页写入 storage，SW 内的 chrome.* 在自动化环境下不可靠）
  {
    const anySw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 20000 }));
    const extId = anySw.url().split('/')[2];
    const setupPage = await ctx.newPage();
    await setupPage.goto(`chrome-extension://${extId}/options.html`);
    const applied = await setupPage.evaluate(async () => {
      await chrome.storage.sync.set({ backendUrl: 'http://localhost:5050' });
      const all = await chrome.storage.sync.get({ backendUrl: '' });
      return all.backendUrl;
    });
    await setupPage.close();
    if (applied !== 'http://localhost:5050') throw new Error('无法写入测试后端地址：' + applied);
  }
  const page = ctx.pages()[0] || (await ctx.newPage());
  const downloads = [];
  page.on('download', async (d) => {
    const file = `/tmp/ytbt-${downloads.length + 1}-${d.suggestedFilename()}`;
    await d.saveAs(file);
    downloads.push({ name: d.suggestedFilename(), file });
  });
  await page.route('https://www.youtube.com/**', (route) => {
    if (route.request().url().includes('/watch')) return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: FIXTURE });
    return route.fulfill({ status: 204, body: '' });
  });
  await page.goto('https://www.youtube.com/watch?v=TESTVID123', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ytbt-overlay', { timeout: 30000 });

  // 等翻译完成
  let snapshot = null;
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    snapshot = await page.evaluate(() => ({
      translated: document.querySelector('.ytbt-translated')?.textContent || '',
      original: document.querySelector('.ytbt-original')?.textContent || '',
      cls: document.querySelector('.ytbt-caption')?.className || '',
    }));
    if (/[\u4e00-\u9fa5]/.test(snapshot.translated)) break;
    await page.waitForTimeout(800);
  }
  check('双语字幕渲染', /[\u4e00-\u9fa5]/.test(snapshot.translated), JSON.stringify(snapshot).slice(0, 120));
  check('原文同时显示', snapshot.original.includes('Hello everyone'));

  // 关闭再打开（Alt+T）
  await page.keyboard.press('Alt+t');
  await page.waitForTimeout(600);
  const afterToggleOff = await page.evaluate(() => document.querySelector('.ytbt-caption')?.className || '');
  await page.keyboard.press('Alt+t');
  await page.waitForTimeout(1200);
  const afterToggleOn = await page.evaluate(() => document.querySelector('.ytbt-caption')?.className || '');
  check('Alt+T 关闭字幕', !afterToggleOff.includes('ytbt-caption-visible'), afterToggleOff);
  check('Alt+T 恢复字幕', afterToggleOn.includes('ytbt-caption-visible'), afterToggleOn);

  await page.screenshot({ path: '/tmp/shot-overlay.png' });

  // Alt+D 下载双语 SRT
  await page.keyboard.press('Alt+d');
  await page.waitForTimeout(6000);
  check('Alt+D 下载双语 SRT', downloads.length === 1, downloads.map((d) => d.name).join(','));
  if (downloads[0]) {
    const content = fs.readFileSync(downloads[0].file, 'utf8');
    check('SRT 含译文行', /[\u4e00-\u9fa5]/.test(content));
    check('SRT 含原文行', content.includes('Hello everyone, welcome back to the channel.'));
    check('SRT 时间轴正确', content.includes('00:00:00,000 --> 00:00:03,000'));
  }

  // 通过 popup 的消息通道请求 VTT / 仅译文
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${EXT_ID}/popup.html`);
  const vttResp = await popup.evaluate(async () => {
    const tabs = await chrome.tabs.query({ url: '*://www.youtube.com/*' });
    if (!tabs.length) return { error: 'no youtube tab' };
    return await chrome.tabs.sendMessage(tabs[0].id, { type: 'DOWNLOAD_SUBTITLES', payload: { format: 'vtt', mode: 'target' } });
  });
  await popup.waitForTimeout(5000);
  check('popup 通道请求 VTT', Boolean(vttResp && vttResp.ok), JSON.stringify(vttResp));
  const vtt = downloads.find((d) => d.name.endsWith('.vtt'));
  check('VTT 文件已下载', Boolean(vtt), downloads.map((d) => d.name).join(','));
  if (vtt) {
    const content = fs.readFileSync(vtt.file, 'utf8');
    check('VTT 头部正确', content.startsWith('WEBVTT'));
    check('VTT 仅译文模式', /[\u4e00-\u9fa5]/.test(content) && !content.includes('Hello everyone, welcome back to the channel.'));
  }

  // popup / options 截图
  await popup.setViewportSize({ width: 380, height: 720 });
  await popup.reload();
  await popup.waitForTimeout(1500);
  await popup.screenshot({ path: '/tmp/shot-popup.png', fullPage: true });
  const updateInfo = await popup.evaluate(async () => {
    const res = await chrome.runtime.sendMessage({ type: 'CHECK_UPDATE' });
    return res && res.ok ? res.data : { error: res && res.error };
  });
  check('弹窗可检查更新', Boolean(updateInfo && updateInfo.current), JSON.stringify(updateInfo).slice(0, 160));
  check('更新信息与线上版本一致', Boolean(updateInfo && updateInfo.latest), String(updateInfo && updateInfo.latest));

  const options = await ctx.newPage();
  await options.goto(`chrome-extension://${EXT_ID}/options.html`);
  await options.waitForTimeout(1200);
  await options.screenshot({ path: '/tmp/shot-options.png', fullPage: true });

  // 落地页
  const site = await ctx.newPage();
  await site.goto('http://localhost:5050/', { waitUntil: 'networkidle' });
  await site.screenshot({ path: '/tmp/shot-site.png', fullPage: false });
  await site.screenshot({ path: '/tmp/shot-site-full.png', fullPage: true });

  console.log('\n=== SUMMARY ===');
  results.forEach((r) => console.log(`${r.ok ? '✅' : '❌'} ${r.name}`));
  await ctx.close();
  if (results.some((r) => !r.ok)) process.exit(1);
})().catch((e) => { console.error('E2E ERROR', e); process.exit(1); });
