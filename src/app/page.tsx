import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Captions,
  CheckCircle2,
  Download,
  Gauge,
  Languages,
  Layers,
  Play,
  Sparkles,
  Terminal,
} from 'lucide-react';
import ServicePanel from '@/components/landing/service-panel';

export const metadata: Metadata = {
  title: 'LinguaLens · 双语字幕与整页翻译插件',
  description:
    'Chrome 扩展 + 云端翻译服务：自动翻译 YouTube 视频字幕、字幕框可拖动、一键下载双语 SRT / VTT，还能把任意网页整页翻成双语。安装即用，无需本地部署。',
};

type ExtensionMeta = {
  name: string;
  version: string;
  file: string;
  sizeLabel: string;
  crxFile?: string | null;
  notes?: string[];
};

const SERVICE_BASE = 'https://lingualens.coze.site';

function readMeta(): ExtensionMeta {
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'public/extension-meta.json'), 'utf8');
    return JSON.parse(raw) as ExtensionMeta;
  } catch {
    return {
      name: 'LinguaLens · 双语字幕与整页翻译',
      version: '2.1.1',
      file: 'lingualens-v2.1.1.zip',
      sizeLabel: '43 KB',
    };
  }
}

const features = [
  {
    icon: Languages,
    title: '自动翻译字幕',
    desc: '进入视频自动抓取字幕轨，分批送翻译服务，边看边出译文，无需手动上传字幕文件。',
  },
  {
    icon: Captions,
    title: '双语对照显示',
    desc: '译文在上、原文在下，字号与位置可调，自动隐藏 YouTube 原生字幕，避免字幕叠字。',
  },
  {
    icon: Download,
    title: '双语字幕下载',
    desc: '一键导出 SRT / VTT，支持双语对照、仅译文、仅原文三种模式，方便做笔记和二次剪辑。',
  },
  {
    icon: Layers,
    title: '字幕框自由拖动',
    desc: '按住字幕工具栏最左侧的抓手，就能把字幕框拖到画面上任意位置，双击复位，位置自动记住。',
  },
  {
    icon: Sparkles,
    title: '整页双语翻译',
    desc: '任意网页按 Alt + A，正文逐段翻成双语，译文以浅色块插在原文下方，一键还原原文。',
  },
  {
    icon: Gauge,
    title: '内置模型 + 缓存',
    desc: '服务端使用内置大模型 Token，批量翻译并缓存结果，重复观看同一视频秒出字幕。',
  },
];

const steps = [
  {
    title: '下载并解压',
    desc: '下载下方扩展压缩包，解压到本地任意目录，得到一个包含 manifest.json 的文件夹。',
  },
  {
    title: '打开扩展管理页',
    desc: 'Chrome 地址栏输入 chrome://extensions ，右上角打开「开发者模式」。',
  },
  {
    title: '加载已解压的扩展',
    desc: '点击「加载已解压的扩展程序」，选择刚才解压出的文件夹，插件图标会出现在工具栏。',
  },
  {
    title: '装好即用',
    desc: `扩展默认连接线上翻译服务（${SERVICE_BASE}），不需要在本地启动任何服务；设置页可查看连接状态。`,
  },
];

const faqs = [
  {
    q: '提示「该视频没有可用字幕」怎么办？',
    a: '先确认视频本身有 CC 字幕。如果视频有字幕却仍然抓不到，通常是 YouTube 对当前网络做了字幕风控（返回空内容）。这时点扩展弹窗里的「导入本地字幕文件」，把已有的 SRT / VTT 拖进来，插件照样逐句翻译、双语显示并导出双语字幕。',
  },
  {
    q: '翻译速度取决于什么？',
    a: '翻译按每批 24 条字幕顺序请求服务端，一个 10 分钟视频大约 200 条字幕，通常几十秒内完成；已翻译过的视频会命中本地缓存，再次打开几乎零等待。',
  },
  {
    q: '需要自己准备 API Key 吗？',
    a: '不需要。翻译请求全部走本地服务端，模型 Token 由服务端内置，扩展本身不接触任何密钥。',
  },
  {
    q: '整页翻译要授权「读取所有网站」吗？',
    a: '需要。整页翻译要在任意网页注入脚本并读取正文，Chrome 会提示「读取和更改您在所有网站上的数据」。所有译文都由你本地的服务端生成，扩展不会把页面内容发往第三方。',
  },
  {
    q: '还要自己在本地启动服务吗？',
    a: `不用。翻译服务已经部署到公网 ${SERVICE_BASE}，扩展装好默认就连接它，换网络、换设备都能直接用；只有想接自己的服务时，才在设置页把地址改成自建服务。`,
  },
  {
    q: '以后怎么升级插件？',
    a: '插件里有「检查更新」：弹窗和设置页都会显示当前版本与线上版本，发现新版直接给出下载入口，不用再回来看这个页面。用 .crx 安装（或在企业策略下分发）的扩展，还会按 updates.xml 自动静默升级。',
  },
  {
    q: '可以在 Edge / Brave 上用吗？',
    a: '可以。只要内核是 Chromium 且支持 Manifest V3，安装步骤与 Chrome 一致。',
  },
];

export default function Home() {
  const meta = readMeta();
  const downloadHref = `/${meta.file}`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#0a84ff] to-[#5b5bd6] text-sm font-bold text-white">
              译
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold">LinguaLens</div>
              <div className="text-[11px] text-muted-foreground">双语字幕 · 整页翻译</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground sm:inline">
              v{meta.version}
            </span>
            <a
              href={downloadHref}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
            >
              <Download className="h-3.5 w-3.5" />
              下载扩展
            </a>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/60">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(10,132,255,0.16),transparent_70%)]" />
          <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" />
                Chrome 扩展 + 云端翻译服务 · v{meta.version} 已上线
              </div>
              <h1 className="mt-5 text-3xl font-bold leading-[1.25] tracking-tight sm:text-4xl lg:text-[42px]">
                YouTube 双语字幕
                <br />
                与<span className="bg-gradient-to-r from-[#0a84ff] to-[#5b5bd6] bg-clip-text text-transparent">整页双语翻译</span>
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-[15px]">
                自动抓取视频字幕轨，调用内置大模型逐句翻译，译文与原文同屏对照，字幕框可以拖到画面任意位置；
                看完一键导出双语 SRT / VTT；任意网页还能整页翻成双语。翻译服务已部署到公网，装好插件直接可用，
                不需要本地启动服务，也不需要第三方 API Key。
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-3">
                <a
                  href={downloadHref}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:opacity-90"
                >
                  <Download className="h-4 w-4" />
                  下载扩展（{meta.sizeLabel}）
                </a>
                <a
                  href="#install"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-medium transition hover:bg-muted"
                >
                  查看安装步骤
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                {['Manifest V3', '字幕可拖动', '整页翻译', '公网服务免部署', '在线更新'].map((item) => (
                  <span key={item} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            {/* 播放器预览 */}
            <div className="relative">
              <div className="overflow-hidden rounded-2xl border border-border bg-[#0b0d12] shadow-xl">
                <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-400/80" />
                    <span className="h-2 w-2 rounded-full bg-amber-300/80" />
                    <span className="h-2 w-2 rounded-full bg-emerald-400/80" />
                  </div>
                  <span className="text-[10px] text-white/50">youtube.com/watch</span>
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/70">双语字幕</span>
                </div>
                <div className="relative aspect-video bg-[linear-gradient(140deg,#1b2233,#0b0d12_60%)]">
                  <div className="absolute inset-0 grid place-items-center">
                    <span className="grid h-14 w-14 place-items-center rounded-full bg-white/10 backdrop-blur">
                      <Play className="h-6 w-6 translate-x-[1px] text-white/80" />
                    </span>
                  </div>
                  <div className="absolute right-2 top-2 flex gap-1 rounded-lg bg-black/55 p-1 backdrop-blur">
                    <span className="rounded bg-[#0a84ff] px-2 py-1 text-[10px] font-bold text-white">译</span>
                    <span className="rounded bg-white/15 px-2 py-1 text-[10px] text-white/85">下载双语字幕</span>
                  </div>
                  <div className="absolute inset-x-0 bottom-8 px-4 text-center">
                    <div className="mx-auto max-w-[92%] rounded-lg bg-black/60 px-3 py-2 backdrop-blur-sm">
                      <p className="text-[15px] font-semibold leading-snug text-white">
                        这一节讲的是注意力机制如何让模型关注到关键信息
                      </p>
                      <p className="mt-1 text-[11px] leading-snug text-white/70">
                        This section explains how attention lets the model focus on the key information.
                      </p>
                    </div>
                    <div className="mx-auto mt-2 w-fit rounded-full bg-[#0a84ff]/90 px-2.5 py-0.5 text-[10px] text-white">
                      AI 翻译中 128/214
                    </div>
                  </div>
                  <div className="absolute inset-x-3 bottom-3">
                    <div className="h-1 rounded-full bg-white/20">
                      <div className="h-1 w-2/3 rounded-full bg-[#ff4d4d]" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[
                  { label: '字幕条数', value: '214' },
                  { label: '翻译批次', value: '9' },
                  { label: '导出格式', value: 'SRT / VTT' },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-border bg-card px-2 py-2.5">
                    <div className="text-sm font-semibold">{item.value}</div>
                    <div className="text-[11px] text-muted-foreground">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 功能 */}
        <section className="mx-auto w-full max-w-6xl px-5 py-14">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">对标 Pro / Max 的字幕能力</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                自动翻译、双语对照、双语字幕导出，三个高频场景全部打通。
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/40 hover:shadow-sm"
                >
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-sm font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-xs leading-6 text-muted-foreground">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 安装 */}
        <section id="install" className="border-y border-border/60 bg-muted/30">
          <div className="mx-auto w-full max-w-6xl px-5 py-14">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
              <div>
                <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">四步装到本地 Chrome</h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  扩展是纯前端产物，解压后直接「加载已解压的扩展程序」即可，不需要上架商店；服务端在本机运行，翻译请求不出内网。
                </p>
                <div className="mt-6 rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{meta.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        v{meta.version} · {meta.sizeLabel} · Manifest V3
                      </div>
                    </div>
                    <a
                      href={downloadHref}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
                    >
                      <Download className="h-3.5 w-3.5" />
                      下载
                    </a>
                  </div>
                  <div className="mt-4 rounded-lg bg-muted/60 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                    {meta.file}
                  </div>
                </div>
              </div>
              <ol className="space-y-3">
                {steps.map((step, index) => (
                  <li key={step.title} className="flex gap-3 rounded-2xl border border-border bg-card p-4">
                    <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {index + 1}
                    </span>
                    <div>
                      <div className="text-sm font-semibold">{step.title}</div>
                      <p className="mt-1 text-xs leading-6 text-muted-foreground">{step.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 服务端联调 */}
        <section className="mx-auto w-full max-w-6xl px-5 py-14">
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">线上服务</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              翻译服务已部署在 <code className="rounded bg-muted px-1.5 py-0.5">{SERVICE_BASE}</code>，扩展在任意网络下都能直接调用；
              下面两块是真实请求，不是示意数据。
            </p>
          </div>
          <ServicePanel />

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {[
              {
                method: 'POST',
                path: '/api/translate',
                desc: '批量翻译字幕：{ texts: string[], targetLang, sourceLang, context }',
              },
              {
                method: 'GET',
                path: '/api/health',
                desc: '服务健康检查，返回当前使用的内置模型与支持语言。',
              },
              {
                method: 'GET',
                path: '/api/youtube/timedtext',
                desc: '字幕代理兜底：浏览器侧拉不到 timedtext 时由服务端代取。',
              },
              {
                method: 'GET',
                path: '/api/extension/latest',
                desc: '版本发现：返回线上最新版本、下载地址与更新说明，供插件检查更新。',
              },
              {
                method: 'GET',
                path: '/updates.xml',
                desc: 'Chrome 扩展更新清单，配合 .crx 实现安装后静默升级。',
              },
            ].map((api) => (
              <div key={api.path} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-primary">
                    {api.method}
                  </span>
                  <code className="text-xs font-medium">{api.path}</code>
                </div>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">{api.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 使用说明 */}
        <section className="border-y border-border/60 bg-muted/30">
          <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-14 lg:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Layers className="h-4 w-4 text-primary" />
                观看时怎么用
              </div>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                <li>· 打开任意带字幕的 YouTube 视频，插件自动开始翻译，播放器右下角显示翻译进度。</li>
                <li>· 鼠标移到播放器右上角，可切换开关或直接下载双语字幕。</li>
                <li>· 快捷键：Alt + T 开关双语字幕，Alt + D 下载双语 SRT。</li>
                <li>· 点击工具栏插件图标，可以切换目标语言、查看字幕条数、选择导出格式、检查更新。</li>
                <li>· 任意网页按 Alt + A 整页双语翻译，再按一次还原原文。</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Terminal className="h-4 w-4 text-primary" />
                服务地址与在线更新
              </div>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-[#0b0d12] px-4 py-3 text-[11px] leading-6 text-white/80">
{`# 线上服务（扩展默认连接）
https://lingualens.coze.site

# 健康检查
curl -s https://lingualens.coze.site/api/health

# 版本发现 / 更新清单
curl -s https://lingualens.coze.site/api/extension/latest
curl -s https://lingualens.coze.site/updates.xml`}
              </pre>
              <p className="mt-3 text-xs leading-6 text-muted-foreground">
                线上发布新版本后，插件弹窗「版本与更新」会提示并给出一键获取入口；用 <code className="rounded bg-muted px-1">.crx</code> 安装的扩展还会按
                <code className="rounded bg-muted px-1">updates.xml</code> 自动升级。翻译模型仍由服务端内置 Token 提供。
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto w-full max-w-6xl px-5 py-14">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">常见问题</h2>
          <div className="mt-6 grid gap-3 lg:grid-cols-2">
            {faqs.map((faq) => (
              <div key={faq.q} className="rounded-2xl border border-border bg-card p-5">
                <div className="text-sm font-semibold">{faq.q}</div>
                <p className="mt-2 text-xs leading-6 text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-5 text-xs text-muted-foreground sm:flex-row">
          <span>LinguaLens · 双语字幕与整页翻译 · v{meta.version}</span>
          <span className="flex items-center gap-4">
            <Link className="hover:text-foreground" href="/privacy">
              隐私政策
            </Link>
            <a className="hover:text-foreground" href="https://github.com/davidtoby/lingua-lens">
              GitHub
            </a>
            <span>翻译服务由云端后端提供</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
