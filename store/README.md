# LinguaLens · Chrome 应用商店上架材料

面向「普通用户免下载、自动更新」的分发通道：**Chrome 应用商店**。本目录是提交所需的全部材料与操作步骤。

上架包：`store/lingualens-v2.1.2-store.zip`（由 `node scripts/build-store-package.cjs` 生成，已移除 `update_url`，商店渠道由 Chrome 托管更新）。

---

## 1. 素材清单

| 文件 | 规格 | 用途 | 状态 |
| --- | --- | --- | --- |
| `store/lingualens-v2.1.2-store.zip` | 43.1 KB，manifest v3，无 `update_url` | 上传到商店的扩展包 | ✅ 已生成 |
| `public/extension/icons/icon128.png` | 128×128 PNG | 商店图标（搜索结果、安装按钮） | ✅ 已在包内 |
| `public/extension/icons/icon48.png` | 48×48 PNG | 扩展管理页图标 | ✅ 已在包内 |
| `store/screenshots/01-youtube-bilingual.png` | 1280×800 | 截图 1：YouTube 双语字幕（真实渲染） | ✅ |
| `store/screenshots/02-page-translate.png` | 1280×800 | 截图 2：任意网页整页双语翻译 | ✅ |
| `store/screenshots/03-popup.png` | 1280×800 | 截图 3：弹窗功能面板 | ✅ |
| `store/screenshots/04-options.png` | 1280×800 | 截图 4：设置页 | ✅ |
| `store/screenshots/05-download.png` | 1280×800 | 截图 5：双语字幕导出 | ✅ |
| `store/promo/small-tile-440x280.png` | 440×280 | 小号宣传图（分类/推荐位） | ✅ |
| `store/promo/marquee-1400x560.png` | 1400×560 | 首页横幅（争取编辑推荐用） | ✅ |

> 截图 1、2、4 是对扩展真实运行的整屏抓取（YouTube 页面为本地还原的版式，字幕与译文由线上服务真实生成）；截图 3、5 为产品图，UI 元素来自扩展真实界面。

文案文件：

- `store/listing-zh.md` —— 中文商店页文案（名称 / 简短说明 / 详细说明 / 分类 / 关键词）
- `store/listing-en.md` —— 英文商店页文案
- `store/permissions-justification.md` —— 权限理由与「单一用途」声明，提交时按此填写
- `store/privacy-policy.md` —— 隐私政策全文（线上地址：https://lingualens.coze.site/privacy ）

---

## 2. 提交前需要准备的账号

1. 用 Google 账号登录 <https://chrome.google.com/webstore/devconsole>。
2. 注册开发者账号：一次性 **5 美元** 注册费，需要能付款的信用卡。
3. 完成邮箱验证，并在账号设置里填好发布者名称（建议用 `LinguaLens`，会显示在商店页）。
4. 建议同时开启两步验证（Google 对扩展开发者账号有强制要求趋势）。

---

## 3. 提交流程（约 20 分钟）

1. 开发者信息中心 → **新增项目** → 上传 `store/lingualens-v2.1.2-store.zip`。
2. **商店信息（Store listing）** 标签页，按 `listing-zh.md` / `listing-en.md` 填写：
   - 名称、简短说明（≤132 字符）、详细说明（≤16000 字符）
   - 分类：`Productivity`（生产力工具）
   - 语言：中文（简体）为主语言，可再添加 English
   - 商店图标：包内 `icon128.png` 会自动带出，可覆盖上传
   - 截图：按顺序上传 `01`→`05`（第一张最重要）
   - 宣传图：小号 440×280，横幅 1400×560
   - 主页网址：`https://lingualens.coze.site`
   - 支持网址：`https://github.com/davidtoby/lingua-lens/issues`
   - 隐私政策网址：`https://lingualens.coze.site/privacy`
3. **隐私权（Privacy practices）** 标签页：
   - 单一用途说明、权限理由：直接复制 `permissions-justification.md`
   - 数据用途勾选：**网站内容（Website content）** → 用途勾「应用功能（App functionality）」
   - 三项承诺全部勾选：不出售给第三方、不用于与核心功能无关的目的、不用于判断信用度/放贷
   - 远程代码：选择「**否，我没有使用远程代码**」（本扩展所有 JS 都在包内，服务端只返回译文文本）
4. **分发（Distribution）** 标签页：
   - 可见性：`Public`（公开）
   - 地区：全部地区
   - 定价：免费
5. 点击 **提交审核（Submit for review）**。
6. 审核通常 **1–3 个工作日**（首次上架或权限较宽时可能更久）。被驳回会给出具体条款，按提示修改后重新提交即可。

---

## 4. 审核风险点（提前准备，避免驳回）

| 风险点 | 说明 | 我们的应对 |
| --- | --- | --- |
| `<all_urls>` 主机权限 | 商店对「访问所有网站」审查最严 | 已在权限理由里写明：仅用于用户主动触发的整页翻译，默认不翻译任何页面；脚本无用户操作时不发起任何请求 |
| 单一用途 | 一个扩展只能有一个明确用途 | 统一表述为「把网页与视频内容翻成双语对照」，字幕与整页翻译是同一用途的两个入口 |
| 远程代码 | 禁止从服务器加载并执行 JS | 扩展内无 `eval` / 远程 script；服务端只返回 JSON 译文 |
| 隐私披露不一致 | 声明与行为不符是常见驳回原因 | 隐私政策已如实写明「待翻译文本会发到云端服务」及内存缓存策略 |
| 权限与功能不匹配 | 声明了 `downloads` 却无下载行为会被质疑 | 字幕导出就是下载行为，理由中已说明 |

如果首次提交因为「主机权限过宽」被要求收窄，备选方案（需要改代码，约半天）：

- 把 `host_permissions` 中的 `http://*/*`、`https://*/*` 改为 `optional_host_permissions`；
- 用户第一次点「翻译本页」时用 `chrome.permissions.request` 申请当前站点权限；
- 用 `chrome.scripting.registerContentScripts` 在授权后动态注入整页翻译脚本。

---

## 5. 发布后：普通用户的「免下载自动更新」怎么走

上架成功后，这条路就通了：

1. 用户从商店点「添加至 Chrome」安装，无需下载 zip、无需解压、无需开发者模式。
2. 以后每次发版：
   ```bash
   # 1) 改版本号
   #    public/extension/manifest.json → "version": "2.1.2"
   #    extension-notes.json 里补上 2.1.2 的更新说明
   node scripts/build-extension.cjs        # 重新生成下载页用的 zip + meta
   bash scripts/pack-crx.sh                # 自托管 crx（可选）
   node scripts/build-store-package.cjs    # 生成商店用 zip（自动去掉 update_url）
   ```
3. 在开发者信息中心「软件包」上传新 zip → 提交审核 → 通过后，Chrome 会在几小时到一天内**自动把已安装用户升级到新版**，用户无感知。
4. 客户端里已有的「检查更新」仍然保留：它读的是我们自己的 `/api/extension/latest`，方便自托管 crx / 解压用户，也方便你在商店审核期间先告知用户新版内容。

### 三条分发通道对比

| 通道 | 安装方式 | 更新方式 | 适合谁 |
| --- | --- | --- | --- |
| Chrome 应用商店 | 商店一键安装 | **Chrome 静默自动更新** | 普通用户（目标路径） |
| 自托管 `.crx` | 下载 crx 后拖入扩展页（需允许） | `updates.xml` + crx 签名，可静默升级（受策略/企业分发影响） | 内部试用、企业批量分发 |
| 解压加载（unpacked） | 下载 zip 解压后「加载已解压的扩展程序」 | Chrome 不自动更新，需手动替换 | 开发调试、自建后端用户 |

---

## 6. 提交后自检清单

- [ ] 商店页名称、图标、5 张截图、2 张宣传图已上传
- [ ] 简短说明 ≤132 字符（见 `listing-zh.md` 末尾的字符数标注）
- [ ] 隐私政策链接可打开（https://lingualens.coze.site/privacy ）
- [ ] 权限理由与 `permissions-justification.md` 一致
- [ ] 数据用途勾选包含「网站内容 → 应用功能」
- [ ] 远程代码声明为「否」
- [ ] 上传的 zip 是 `lingualens-v2.1.2-store.zip`（**不是** `public/` 里带 `update_url` 的那个）
- [ ] 用干净浏览器实测：安装 → 打开 YouTube 视频出双语字幕 → 按 Alt+A 整页翻译 → 下载字幕
