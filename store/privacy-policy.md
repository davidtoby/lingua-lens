# LinguaLens 隐私政策 / Privacy Policy

生效日期：2026-11-15
线上地址（商店填写用）：**https://lingualens.coze.site/privacy**
联系方式：https://github.com/davidtoby/lingua-lens/issues

> 本文件是线上隐私政策的存档副本，如有不一致以线上页面为准。

## 中文

### 1. 我们处理哪些数据

- **待翻译文本**：当你在 YouTube 视频上开启双语字幕、或对某个网页点击「翻译本页」时，扩展会把需要翻译的字幕行 / 网页段落文本以及目标语言，通过 HTTPS 发送到翻译服务（https://lingualens.coze.site）。这是提供翻译功能所必需的唯一内容。
- **你的设置**：目标语言、字幕字号与位置、是否隐藏原生字幕、服务地址等，仅保存在浏览器本地（chrome.storage.sync），不上传到服务器。
- **生成的字幕文件**：导出的 SRT / VTT 由浏览器直接下载到你的设备，不经过我们的服务器存储。

### 2. 我们不收集什么

- 不收集账号、姓名、邮箱、手机号等身份信息；扩展无需注册或登录。
- 不收集浏览历史、书签、Cookie、密码、键盘输入或剪贴板内容。
- 不读取与正在翻译的内容无关的页面数据：整页翻译只处理页面上可见的正文段落。
- 不投放广告，不向任何第三方出售、出租或共享数据用于广告或画像。
- 不收集精确地理位置、设备标识符或崩溃以外的诊断信息。

### 3. 数据用途与处理方式

- 待翻译文本仅用于调用大模型生成译文，并把译文返回给你的浏览器。
- 为减少重复请求，翻译服务会在运行内存中短暂缓存「原文 → 译文」（最多约 2000 条，进程重启即清空），不写入磁盘、不写入数据库。
- 服务端不建立用户档案，也不把原文或译文与任何身份标识关联。
- 服务日志仅记录错误码、耗时和批次数量等运行信息，不记录待翻译文本内容。

### 4. 第三方处理者

- 翻译能力由部署在扣子编程（Coze Code）云端的服务调用大模型接口完成，模型服务提供方为字节跳动火山引擎（豆包系列模型）。文本仅用于本次推理，不用于模型训练。
- 除上述翻译推理与必要的基础设施托管外，我们不向其他第三方提供你的数据。

### 5. 扩展申请的权限及原因

- `storage`：保存你的翻译与显示设置。
- `downloads`：把生成的双语字幕文件保存到本地。
- 访问 youtube.com：读取视频字幕轨，并把译文叠加显示在播放器上。
- 访问所有网站（http/https）：仅为实现「整页双语翻译」。该脚本默认不翻译任何内容，只有你点击「翻译本页」或按下 Alt + A 时才工作。
- 访问 lingualens.coze.site（以及你自行填写的本地服务地址）：调用翻译接口。

### 6. 数据保留与删除

- 服务端不保存原文与译文，进程内存缓存随重启清空。
- 浏览器本地设置可随时在扩展「设置」页或卸载扩展时清除。
- 已下载的字幕文件保存在你本机，由你自行删除。

### 7. 儿童隐私

本扩展不面向 13 岁以下儿童，也不会主动收集其任何个人信息。

### 8. 政策变更与联系方式

- 若本政策发生实质性变更，我们会更新本页顶部的生效日期。
- 如有疑问、数据相关请求或投诉，请通过 https://github.com/davidtoby/lingua-lens/issues 联系我们。

---

## English (summary)

Effective date: 2026-11-15 · Canonical URL: https://lingualens.coze.site/privacy

1. **Data we process.** Only the text you ask to translate (caption lines or visible body paragraphs) plus the target language, sent over HTTPS to our translation service at https://lingualens.coze.site. Your settings live in `chrome.storage.sync` on your device and are never uploaded. Exported SRT/VTT files are written by your browser directly to your disk.
2. **What we do not collect.** No accounts, names, emails or phone numbers (no sign-in required). No browsing history, bookmarks, cookies, passwords, keystrokes or clipboard contents. No data unrelated to the text being translated. No ads, and we never sell, rent or share data for advertising or profiling. No precise location or device identifiers.
3. **How data is used.** Source text is used only to generate a translation and return it to your browser. A short-lived in-memory cache (about 2,000 entries, cleared on restart) reduces repeated requests; nothing is written to disk or to a database. No user profiles are built and text is never linked to an identity. Server logs keep error codes, latency and batch counts only — never the text itself.
4. **Sub-processors.** Translation runs on a service hosted on Coze Code cloud, calling a large-language-model API provided by ByteDance Volcano Engine (Doubao models). Text is used only for that inference and not for model training.
5. **Permissions.** `storage` (save your settings), `downloads` (save subtitle files), access to youtube.com (read caption tracks and render bilingual subtitles), access to http/https sites (full-page bilingual translation only, and only after you click "Translate this page" or press Alt + A), access to lingualens.coze.site and any local backend you configure (call the translation API).
6. **Retention and deletion.** The service does not store source text or translations. Local settings can be cleared in the options page or by uninstalling. Downloaded subtitle files are yours to keep or delete.
7. **Children.** The extension is not directed to children under 13 and does not knowingly collect their personal information.
8. **Changes and contact.** Material changes update the effective date on this page. Contact: https://github.com/davidtoby/lingua-lens/issues
