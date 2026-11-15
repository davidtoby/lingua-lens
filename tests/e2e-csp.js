/**
 * 回归测试：页面 CSP 严格时，页面世界桥接脚本仍然可用。
 *
 * 背景：旧实现用 <script src="chrome-extension://<id>/injected.js"> 注入页面主世界，
 * YouTube 这类 CSP 严格的页面会拦下并报：
 *   Unsafe attempt to load URL chrome-extension://.../injected.js from frame with URL
 *   https://www.youtube.com/watch?... Domains, protocols and ports must match.
 * 现在 injected.js 通过 manifest 的 content_scripts + world: "MAIN" 运行，不受页面 CSP 限制。
 *
 * 断言：
 *   1. 页面控制台没有 "Unsafe attempt to load URL" / injected.js 相关 CSP 报错
 *   2. 在 CSP 严格的页面上依然能拿到字幕并渲染双语
 */
const { chromium } = require('playwright');
const fs = require('fs');

const ROOT = '/Users/bytedance/Coze/Drive/TobyTranslateAssist/yt-bilingual-translator';
const EXT_DIR = `${ROOT}/public/extension`;
const FIXTURE = fs.readFileSync(`${ROOT}/tests/fixtures/youtube-fixture.html`, 'utf8');

const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${extra}`);
}

(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-csp-' + Date.now(), {
    channel: 'chromium', headless: true, ignoreDefaultArgs: ['--disable-extensions'],
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`, '--no-first-run'],
  });

  // 固定连本地后端
  {
    const anySw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 20000 }));
    const extId = anySw.url().split('/')[2];
    const setup = await ctx.newPage();
    await setup.goto(`chrome-extension://${extId}/options.html`);
    const applied = await setup.evaluate(async () => {
      await chrome.storage.sync.set({ backendUrl: 'http://localhost:5050' });
      const all = await chrome.storage.sync.get({ backendUrl: '' });
      return all.backendUrl;
    });
    await setup.close();
    if (applied !== 'http://localhost:5050') throw new Error('无法写入测试后端地址：' + applied);
  }

  const page = ctx.pages()[0] || (await ctx.newPage());
  const consoleLines = [];
  const pageErrors = [];
  page.on('console', (msg) => consoleLines.push(msg.text()));
  page.on('pageerror', (err) => pageErrors.push(err.message));

  // 模拟 YouTube 的严格 CSP：只允许同源脚本
  const CSP = "script-src 'self' 'unsafe-inline'; object-src 'self'";
  await page.route('https://www.youtube.com/**', (route) => {
    if (route.request().url().includes('/watch')) {
      return route.fulfill({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        headers: { 'content-security-policy': CSP },
        body: FIXTURE,
      });
    }
    return route.fulfill({ status: 204, body: '' });
  });

  await page.goto('https://www.youtube.com/watch?v=CSPTEST123', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.ytbt-overlay', { timeout: 30000 });

  let snapshot = { translated: '', original: '' };
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    snapshot = await page.evaluate(() => ({
      translated: document.querySelector('.ytbt-translated')?.textContent || '',
      original: document.querySelector('.ytbt-original')?.textContent || '',
    }));
    if (/[\u4e00-\u9fa5]/.test(snapshot.translated)) break;
    await page.waitForTimeout(800);
  }

  const cspErrors = consoleLines.filter(
    (line) => /Unsafe attempt to load URL/i.test(line) || /injected\.js/i.test(line),
  );

  check('CSP 页面无 injected.js 加载报错', cspErrors.length === 0, cspErrors.slice(0, 2).join(' | '));
  check('CSP 页面无未捕获异常', pageErrors.length === 0, pageErrors.slice(0, 2).join(' | '));
  check(
    'CSP 页面仍能渲染双语字幕',
    /[\u4e00-\u9fa5]/.test(snapshot.translated),
    JSON.stringify(snapshot).slice(0, 120),
  );

  // manifest 结构断言：桥接脚本走 MAIN world，且不再暴露 web_accessible_resources
  const manifest = JSON.parse(fs.readFileSync(`${EXT_DIR}/manifest.json`, 'utf8'));
  const mainWorld = (manifest.content_scripts || []).find((c) => (c.js || []).includes('injected.js'));
  check('injected.js 声明为 MAIN world 内容脚本', Boolean(mainWorld) && mainWorld.world === 'MAIN', JSON.stringify(mainWorld || {}).slice(0, 120));
  check('不再声明 web_accessible_resources', !manifest.web_accessible_resources);

  await ctx.close();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} 通过`);
  process.exit(failed.length ? 1 : 0);
})().catch((error) => {
  console.error('E2E 执行失败', error);
  process.exit(1);
});
