import type { NextRequest } from 'next/server';
import { CORS_HEADERS, jsonWithCors, preflight } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * YouTube timedtext 代理。
 * 扩展优先在浏览器上下文里直接拉字幕（带用户 Cookie，成功率最高），
 * 当浏览器侧被 CORS / 空响应卡住时，回退到本地服务端代理。
 */
export async function OPTIONS() {
  return preflight();
}

function buildTarget(request: NextRequest): string | null {
  const params = request.nextUrl.searchParams;
  const rawUrl = params.get('url');
  if (rawUrl) {
    const decoded = decodeURIComponent(rawUrl);
    if (!/^https:\/\/(www\.)?youtube\.com\/api\/timedtext\?/.test(decoded)) return null;
    const url = new URL(decoded);
    if (!url.searchParams.get('fmt')) url.searchParams.set('fmt', 'json3');
    return url.toString();
  }

  const videoId = params.get('v');
  const lang = params.get('lang');
  if (!videoId || !lang) return null;

  const url = new URL('https://www.youtube.com/api/timedtext');
  url.searchParams.set('v', videoId);
  url.searchParams.set('lang', lang);
  url.searchParams.set('fmt', params.get('fmt') || 'json3');
  const kind = params.get('kind');
  if (kind) url.searchParams.set('kind', kind);
  const name = params.get('name');
  if (name) url.searchParams.set('name', name);
  return url.toString();
}

export async function GET(request: NextRequest) {
  const target = buildTarget(request);
  if (!target) {
    return jsonWithCors(
      { error: 'INVALID_TARGET', message: '需要 url 参数，或 v + lang 参数' },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(target, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8',
        Referer: 'https://www.youtube.com/',
      },
      cache: 'no-store',
    });

    const text = await response.text();
    return new Response(text, {
      status: response.ok ? 200 : response.status,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Upstream-Status': String(response.status),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonWithCors(
      { error: 'PROXY_FAILED', message: `字幕代理失败：${message}` },
      { status: 502 },
    );
  }
}
