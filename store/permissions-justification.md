# 权限理由与单一用途声明（Chrome Web Store · Privacy practices）

> 直接复制到开发者后台「隐私权 / Privacy practices」页的对应输入框。

---

## 一、单一用途说明（Single purpose）

```
LinguaLens 的单一用途是：把网页与视频中的外语内容翻译成「译文 + 原文」的双语对照形式。

视频场景：在 YouTube 播放页抓取字幕轨，逐句翻译并以双语字幕显示，可导出 SRT / VTT。
网页场景：在用户主动触发时，把当前页面的正文段落翻译成双语对照，并可一键还原。

两个场景共用同一套翻译服务与同一套双语展示逻辑，属于同一个用途下的两个入口，不包含任何与翻译无关的功能（无广告、无联盟链接改写、无浏览数据采集）。
```

## 二、权限理由（Permission justification）

### 1. `storage`

```
保存用户的偏好设置：目标语言、是否自动翻译、字幕字号与垂直位置、字幕框拖动后的坐标、整页翻译的站点开关、自定义服务地址。设置通过 chrome.storage.sync 保存在用户自己的 Chrome 账号中，不上传到我们的服务器。
```

### 2. `downloads`

```
用于把翻译好的字幕写成文件保存到用户本机：用户点击「下载双语字幕」或按 Alt + D 时，扩展生成 SRT / VTT 内容并调用 chrome.downloads.download 保存到默认下载目录。除字幕文件外不下载任何其他内容。
```

### 3. 主机权限 `https://www.youtube.com/*`、`https://m.youtube.com/*`、`https://youtube.com/*`、`https://youtu.be/*`

```
核心功能需要读取 YouTube 播放页的字幕轨信息（window.ytInitialPlayerResponse.captions）并在播放器内注入双语字幕层。这些站点是功能的主要运行位置，权限范围精确限定在 YouTube 域内。
```

### 4. 主机权限 `http://*/*`、`https://*/*`

```
用于「整页双语翻译」：用户在任何网站上主动点击弹窗的「翻译本页」或按 Alt + A 时，扩展需要读取该页面的正文段落文本，并把译文插回原段落下方。

补充说明（供审核参考）：
· 内容脚本 page.js 注入到页面后处于完全静默状态，不读取 DOM、不发任何网络请求，直到用户显式触发；
· 用户没有触发时，扩展不会向服务器发送该页面的任何内容；
· 页面文本只发送给本扩展配置的翻译服务地址，不发送给任何第三方或广告网络；
· 用户可随时在设置页关闭整页翻译入口。
如果审核要求收窄，可改为 optional_host_permissions，在用户首次使用时按站点申请权限（见 store/README.md 第 4 节备选方案）。
```

### 5. 主机权限 `http://localhost/*`、`http://127.0.0.1/*`、`https://*.coze.site/*`

```
翻译服务的地址。默认指向 https://lingualens.coze.site；localhost / 127.0.0.1 用于开发者自建服务端联调，coze.site 是默认托管服务的域名。扩展只向该地址 POST 待翻译文本并读取 JSON 译文。
```

### 6. 内容脚本与 `web_accessible_resources`（`injected.js`）

```
injected.js 运行在 YouTube 页面的主世界（MAIN world），因为读取播放器对象（ytInitialPlayerResponse、video 元素的 currentTime）必须与页面同上下文；它只做读取字幕轨与跟随播放进度，不修改页面数据、不发起网络请求。
```

## 三、远程代码声明（Remote code）

```
否，本扩展未使用远程代码。

所有可执行 JavaScript 都打包在扩展内（content.js、page.js、injected.js、popup.js、options.js、background.js），不加载远程脚本、不使用 eval / new Function、不通过 CDN 注入任何代码。云端服务只返回 JSON 格式的译文文本，返回内容仅作为字符串渲染，不会被当作代码执行。
```

## 四、数据使用声明（Data usage）

勾选与承诺：

- 收集的数据类型：**网站内容（Website content）** —— 仅限用户要求翻译的文本（字幕行、正文段落）
- 收集目的：**应用功能（App functionality）** —— 返回译文
- 三项强制承诺：全部勾选
  - 不会将数据出售或转让给第三方（除经批准的用例）
  - 不会将数据用于与单一用途无关的目的
  - 不会用于判断信用度或用于放贷
- 是否收集个人身份信息：**否**
- 是否收集健康、财务、认证信息、个人通信、位置：**否**
- 是否收集网络历史（web history）：**否**
- 数据留存：服务端不落库、不写日志正文；仅在进程内存中做短期缓存（容量有限、重启即清空）

## 五、隐私政策链接

```
https://lingualens.coze.site/privacy
```
