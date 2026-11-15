import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'LinguaLens · 双语字幕与整页翻译',
    template: '%s',
  },
  description:
    'Chrome 扩展 + 云端翻译服务：自动翻译 YouTube 视频字幕、字幕框可拖动、一键下载双语 SRT / VTT，任意网页可整页翻成双语。安装即用。',
  keywords: [
    'YouTube 双语字幕',
    '双语字幕下载',
    '沉浸式翻译替代',
    '整页翻译',
    '网页翻译扩展',
    'Chrome 翻译插件',
    'LinguaLens',
  ],
  authors: [{ name: 'LinguaLens', url: 'https://lingualens.coze.site' }],
  // icons: {
  //   icon: '',
  // },
  openGraph: {
    title: 'LinguaLens · 双语字幕与整页翻译',
    description:
      '自动翻译 YouTube 字幕、字幕框可拖动、一键导出双语 SRT / VTT，任意网页整页双语翻译。',
    url: 'https://lingualens.coze.site',
    siteName: 'LinguaLens',
    locale: 'zh_CN',
    type: 'website',
    // images: [
    //   {
    //     url: '',
    //     width: 1200,
    //     height: 630,
    //     alt: '扣子编程 - 你的 AI 工程师',
    //   },
    // ],
  },
  // twitter: {
  //   card: 'summary_large_image',
  //   title: 'Coze Code | Your AI Engineer is Here',
  //   description:
  //     'Build and deploy full-stack applications through AI conversation. No env setup, just flow.',
  //   // images: [''],
  // },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {children}
      </body>
    </html>
  );
}
