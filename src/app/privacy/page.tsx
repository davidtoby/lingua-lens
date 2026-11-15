import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'LinguaLens 隐私政策 · Privacy Policy',
  description:
    'LinguaLens 扩展与云端翻译服务的隐私政策：只把需要翻译的文本发送到翻译服务，不收集账号、浏览历史，不出售数据。',
};

const UPDATED_AT = '2026-11-15';
const SUPPORT_URL = 'https://github.com/davidtoby/lingua-lens/issues';

const zhSections: { title: string; items: string[] }[] = [
  {
    title: '1. 我们处理哪些数据',
    items: [
      '待翻译文本：当你在 YouTube 视频上开启双语字幕、或对某个网页点击「翻译本页」时，扩展会把需要翻译的字幕行 / 网页段落文本以及目标语言，通过 HTTPS 发送到翻译服务（https://lingualens.coze.site）。这是提供翻译功能所必需的唯一内容。',
      '你的设置：目标语言、字幕字号与位置、是否隐藏原生字幕、服务地址等，仅保存在浏览器本地（chrome.storage.sync）。这些设置不会上传到我们的服务器。',
      '生成的字幕文件：导出的 SRT / VTT 由浏览器直接下载到你的设备，不经过我们的服务器存储。',
    ],
  },
  {
    title: '2. 我们不收集什么',
    items: [
      '不收集账号、姓名、邮箱、手机号等身份信息；扩展无需注册或登录。',
      '不收集浏览历史、书签、Cookie、密码、键盘输入或剪贴板内容。',
      '不读取与你正在翻译的内容无关的页面数据：整页翻译只处理页面上可见的正文段落。',
      '不投放广告，不向任何第三方出售、出租或共享数据用于广告或画像。',
      '不收集精确地理位置、设备标识符或崩溃以外的诊断信息。',
    ],
  },
  {
    title: '3. 数据用途与处理方式',
    items: [
      '待翻译文本仅用于调用大模型生成译文，并把译文返回给你的浏览器。',
      '为了减少重复请求，翻译服务会在运行内存中短暂缓存「原文 → 译文」的对应关系（最多约 2000 条，进程重启即清空），不写入磁盘、不写入数据库。',
      '服务端不建立用户档案，也不把原文或译文与任何身份标识关联。',
      '服务日志仅记录错误码、耗时和批次数量等运行信息，不记录待翻译文本内容。',
    ],
  },
  {
    title: '4. 第三方处理者',
    items: [
      '翻译能力由部署在扣子编程（Coze Code）云端的服务调用大模型接口完成，模型服务提供方为字节跳动火山引擎（豆包系列模型）。文本仅用于本次推理，不用于模型训练。',
      '除上述翻译推理与必要的基础设施托管外，我们不向其他第三方提供你的数据。',
    ],
  },
  {
    title: '5. 扩展申请的权限及原因',
    items: [
      'storage：保存你的翻译与显示设置。',
      'downloads：把你生成的双语字幕文件保存到本地。',
      '访问 youtube.com：读取视频字幕轨，并把译文叠加显示在播放器上。',
      '访问所有网站（http/https）：仅为实现「整页双语翻译」。该脚本默认不翻译任何内容，只有你点击「翻译本页」或按下 Alt+A 时才工作。',
      '访问 lingualens.coze.site（以及你自行填写的本地服务地址）：调用翻译接口。',
    ],
  },
  {
    title: '6. 数据保留与删除',
    items: [
      '服务端不保存原文与译文，进程内存缓存随重启清空。',
      '浏览器本地设置可随时在扩展的「设置」页或卸载扩展时清除。',
      '已下载的字幕文件保存在你本机，由你自行删除。',
    ],
  },
  {
    title: '7. 儿童隐私',
    items: ['本扩展不面向 13 岁以下儿童，也不会主动收集其任何个人信息。'],
  },
  {
    title: '8. 政策变更与联系方式',
    items: [
      '若本政策发生实质性变更，我们会更新本页顶部的生效日期。',
      `如有疑问、数据相关请求或投诉，请通过 ${SUPPORT_URL} 联系我们。`,
    ],
  },
];

const enSections: { title: string; items: string[] }[] = [
  {
    title: '1. Data we process',
    items: [
      'Text to translate: when you enable bilingual subtitles on a YouTube video, or press "Translate this page" on a web page, the extension sends the subtitle lines / page paragraphs that need translation, plus your target language, over HTTPS to the translation service at https://lingualens.coze.site. This is the only content required to provide the feature.',
      'Your settings: target language, subtitle size and position, whether native captions are hidden, and the backend URL are stored locally in your browser (chrome.storage.sync). They are never uploaded to our servers.',
      'Exported subtitle files: generated SRT / VTT files are downloaded directly by your browser and are not stored on our servers.',
    ],
  },
  {
    title: '2. Data we never collect',
    items: [
      'No accounts, names, email addresses or phone numbers. The extension requires no sign-up or login.',
      'No browsing history, bookmarks, cookies, passwords, keystrokes or clipboard contents.',
      'No page data unrelated to what you are translating: full-page translation only processes visible body paragraphs.',
      'No advertising, and no sale, rental or sharing of data with third parties for advertising or profiling.',
      'No precise location, device identifiers or diagnostics beyond error reporting.',
    ],
  },
  {
    title: '3. Purpose and handling',
    items: [
      'Text is used solely to generate a translation with a large language model and return it to your browser.',
      'To avoid duplicate requests, the service keeps a short-lived in-memory cache of source → translation pairs (about 2,000 entries, cleared when the process restarts). Nothing is written to disk or to a database.',
      'The service builds no user profiles and does not link source text or translations to any identity.',
      'Server logs record error codes, latency and batch counts only — never the text being translated.',
    ],
  },
  {
    title: '4. Sub-processors',
    items: [
      'Translation is performed by the service deployed on Coze Code cloud, which calls a large language model API provided by ByteDance Volcano Engine (Doubao models). Text is used only for that inference and is not used for model training.',
      'Apart from that inference and the necessary hosting infrastructure, we share your data with no one.',
    ],
  },
  {
    title: '5. Permissions and why they are needed',
    items: [
      'storage: keep your translation and display settings.',
      'downloads: save generated bilingual subtitle files to your device.',
      'Access to youtube.com: read the caption track and overlay the translation on the player.',
      'Access to all websites (http/https): required only for full-page bilingual translation. Nothing is translated until you click "Translate this page" or press Alt+A.',
      'Access to lingualens.coze.site (and any self-hosted backend you enter): call the translation API.',
    ],
  },
  {
    title: '6. Retention and deletion',
    items: [
      'Source text and translations are not retained; the in-memory cache is cleared on restart.',
      'Local settings can be removed at any time from the extension options page, or by uninstalling the extension.',
      'Downloaded subtitle files live on your device and are yours to delete.',
    ],
  },
  {
    title: '7. Children',
    items: ['This extension is not directed to children under 13 and does not knowingly collect their personal data.'],
  },
  {
    title: '8. Changes and contact',
    items: [
      'If this policy changes materially, the effective date at the top of this page will be updated.',
      `For questions, data requests or complaints, contact us at ${SUPPORT_URL}.`,
    ],
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <p className="text-sm font-medium text-blue-600">LinguaLens</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">隐私政策 · Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-500">
          生效日期 Effective date：{UPDATED_AT} · 适用于 Chrome 扩展 LinguaLens 及云端翻译服务
        </p>
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
          一句话概括：扩展只把「你要求翻译的那段文字」发到翻译服务，服务端不保存原文与译文，不收集账号与浏览历史，不出售任何数据。
        </p>
      </header>

      <section className="space-y-8">
        <h2 className="text-xl font-semibold text-slate-900">中文</h2>
        {zhSections.map((section) => (
          <div key={section.title}>
            <h3 className="text-base font-semibold text-slate-900">{section.title}</h3>
            <ul className="mt-2 space-y-2">
              {section.items.map((item) => (
                <li key={item} className="text-sm leading-6 text-slate-600">
                  · {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <hr className="my-12 border-slate-200" />

      <section className="space-y-8">
        <h2 className="text-xl font-semibold text-slate-900">English</h2>
        {enSections.map((section) => (
          <div key={section.title}>
            <h3 className="text-base font-semibold text-slate-900">{section.title}</h3>
            <ul className="mt-2 space-y-2">
              {section.items.map((item) => (
                <li key={item} className="text-sm leading-6 text-slate-600">
                  · {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <footer className="mt-12 border-t border-slate-200 pt-6 text-sm text-slate-500">
        <a className="text-blue-600 hover:underline" href={SUPPORT_URL}>
          {SUPPORT_URL}
        </a>
        <span className="mx-2">·</span>
        <Link className="text-blue-600 hover:underline" href="/">
          返回首页
        </Link>
      </footer>
    </main>
  );
}
