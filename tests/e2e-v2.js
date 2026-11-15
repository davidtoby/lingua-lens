/**
 * v2 端到端验证：字幕框拖动 + 整页翻译
 * 用法：先启动 dev server（5050），再 node tests/e2e-v2.js
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const EXT_DIR = path.resolve(__dirname, '../public/extension');
const FIXTURES = path.resolve(__dirname, 'fixtures');
const ytFixture = fs.readFileSync(path.join(FIXTURES, 'youtube-fixture.html'), 'utf8');
const articleFixture = fs.readFileSync(path.join(FIXTURES, 'article-fixture.html'), 'utf8');

const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' :: ' + extra : ''}`);
};

(async () => {
  const ctx = await chromium.launchPersistentContext('/tmp/pw-v2-' + Date.now(), {
    channel: 'chromium',
    headless: true,
    ignoreDefaultArgs: ['--disable-extensions'],
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${EXT_DIR}`, `--load-extension=${EXT_DIR}`, '--no-first-run', '--mute-audio'],
  });
  const sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker', { timeout: 15000 }));
  const tabIdOf = (fragment) =>
    sw.evaluate(async (frag) => {
      const tabs = await chrome.tabs.query({});
      const hit = tabs.find((t) => t.url && t.url.includes(frag));
      return hit && hit.id;
    }, fragment);

  /* ---------------------------- 1. 字幕框拖动 ---------------------------- */
  const ytPage = await ctx.newPage();
  await ytPage.route('https://www.youtube.com/**', (route) => {
    if (route.request().url().includes('/watch')) {
      return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: ytFixture });
    }
    return route.fulfill({ status: 204, body: '' });
  });
  await ytPage.goto('https://www.youtube.com/watch?v=DRAGTEST1', { waitUntil: 'domcontentloaded' });
  await ytPage.waitForSelector('.ytbt-overlay', { timeout: 30000 });
  await ytPage.waitForTimeout(1500);

  const before = await ytPage.evaluate(() => {
    const o = document.querySelector('.ytbt-overlay');
    return { top: o.style.top, left: o.style.left, bottom: o.style.bottom, transform: o.style.transform };
  });
  check('默认位置固定在底部', !before.top && Boolean(before.bottom), JSON.stringify(before));

  // 悬停播放器让工具栏出现，再拖动抓手
  const box = await ytPage.locator('#movie_player').boundingBox();
  await ytPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await ytPage.waitForTimeout(400);
  const handle = await ytPage.locator('.ytbt-btn-drag').boundingBox();
  check('工具栏出现拖动抓手', Boolean(handle), JSON.stringify(handle));

  await ytPage.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await ytPage.mouse.down();
  await ytPage.mouse.move(handle.x + handle.width / 2 - 120, handle.y + handle.height / 2 + 220, { steps: 12 });
  await ytPage.mouse.up();
  await ytPage.waitForTimeout(600);

  const after = await ytPage.evaluate(() => {
    const o = document.querySelector('.ytbt-overlay');
    return { top: o.style.top, left: o.style.left, bottom: o.style.bottom, transform: o.style.transform };
  });
  check('拖动后改为坐标定位', Boolean(after.top) && after.bottom === 'auto', JSON.stringify(after));
  check('拖动后位置发生位移', after.top && Number.parseFloat(after.top) > 20, after.top);

  const saved = await sw.evaluate(async () => (await chrome.storage.sync.get({ overlayPos: null })).overlayPos);
  check('位置写入 storage', Boolean(saved && typeof saved.yPct === 'number'), JSON.stringify(saved));

  // 刷新后仍保留
  await ytPage.reload({ waitUntil: 'domcontentloaded' });
  await ytPage.waitForSelector('.ytbt-overlay', { timeout: 30000 });
  await ytPage.waitForTimeout(1200);
  const restored = await ytPage.evaluate(() => {
    const o = document.querySelector('.ytbt-overlay');
    return { top: o.style.top, transform: o.style.transform };
  });
  check('刷新后位置保持', Boolean(restored.top), JSON.stringify(restored));

  // 双击抓手复位
  const box2 = await ytPage.locator('#movie_player').boundingBox();
  await ytPage.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await ytPage.waitForTimeout(300);
  const handle2 = await ytPage.locator('.ytbt-btn-drag').boundingBox();
  await ytPage.mouse.dblclick(handle2.x + handle2.width / 2, handle2.y + handle2.height / 2);
  await ytPage.waitForTimeout(500);
  const reset = await ytPage.evaluate(() => {
    const o = document.querySelector('.ytbt-overlay');
    return { top: o.style.top, bottom: o.style.bottom };
  });
  check('双击抓手复位到底部', !reset.top && Boolean(reset.bottom), JSON.stringify(reset));

  await ytPage.screenshot({ path: '/tmp/shot-drag.png' });

  /* ---------------------------- 2. 整页翻译 ---------------------------- */
  const article = await ctx.newPage();
  await article.route('https://example.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: articleFixture }),
  );
  await article.goto('https://example.com/article', { waitUntil: 'domcontentloaded' });
  await article.waitForTimeout(1800);
  const articleTabId = await tabIdOf('example.com/article');
  check('整页翻译脚本已注入', Boolean(articleTabId), String(articleTabId));

  const pillExists = await article.evaluate(() => Boolean(document.querySelector('#ll-page-ui')));
  check('页面右下角出现翻译胶囊', pillExists);

  await sw.evaluate(async (tabId) => chrome.tabs.sendMessage(tabId, { type: 'PAGE_TRANSLATE' }), articleTabId);

  let pageStatus = null;
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    pageStatus = await sw.evaluate(
      async (tabId) => (await chrome.tabs.sendMessage(tabId, { type: 'PAGE_STATUS' })).data,
      articleTabId,
    );
    if (!pageStatus.translating && pageStatus.translatedNodes > 0) break;
    await article.waitForTimeout(1000);
  }
  check('整页翻译完成', !pageStatus.translating && pageStatus.done > 0, JSON.stringify(pageStatus));
  check('译文节点已插入', pageStatus.translatedNodes >= 8, String(pageStatus.translatedNodes));

  const inserted = await article.evaluate(() => {
    const nodes = [...document.querySelectorAll('.ll-tr[data-ll="1"]')];
    return {
      count: nodes.length,
      sample: nodes.slice(0, 2).map((n) => n.textContent),
      hasChinese: nodes.some((n) => /[\u4e00-\u9fa5]/.test(n.textContent)),
      afterParagraph: Boolean(document.querySelector('p + .ll-tr')),
      insideListItem: Boolean(document.querySelector('li > .ll-tr')),
    };
  });
  check('译文是中文', inserted.hasChinese, inserted.sample.join(' | ').slice(0, 80));
  check('段落译文插在原文之后', inserted.afterParagraph);
  check('列表译文插入 li 内', inserted.insideListItem);

  await article.screenshot({ path: '/tmp/shot-page-translate.png', fullPage: true });

  // 还原
  await sw.evaluate(async (tabId) => chrome.tabs.sendMessage(tabId, { type: 'PAGE_RESTORE' }), articleTabId);
  await article.waitForTimeout(800);
  const afterRestore = await article.evaluate(() => ({
    nodes: document.querySelectorAll('.ll-tr').length,
    originalText: document.body.innerText.includes('The transformer architecture replaced recurrence'),
  }));
  check('恢复原文后译文全部移除', afterRestore.nodes === 0, String(afterRestore.nodes));
  check('原文未被破坏', afterRestore.originalText);

  console.log('\n==== 汇总 ====');
  const failed = results.filter((r) => !r.ok);
  console.log(`${results.length - failed.length}/${results.length} 通过`);
  await ctx.close();
  process.exit(failed.length ? 1 : 0);
})();
