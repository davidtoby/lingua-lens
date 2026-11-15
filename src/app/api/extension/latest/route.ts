import fs from 'node:fs';
import path from 'node:path';

import { jsonWithCors, preflight } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FALLBACK_ORIGIN = 'https://5tjjyhbf89.coze.site';

function resolveOrigin(request: Request) {
  const headers = request.headers;
  const host = headers.get('x-forwarded-host') || headers.get('host');
  if (!host) return FALLBACK_ORIGIN;
  // 线上网关会把 x-forwarded-proto 报成 http，只有本机开发才需要跟随它
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = isLocal ? headers.get('x-forwarded-proto') || 'http' : 'https';
  return `${proto}://${host}`;
}

function readJson(file: string) {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), file), 'utf8')) as Record<
      string,
      unknown
    >;
  } catch {
    return null;
  }
}

export async function OPTIONS() {
  return preflight();
}

/**
 * 扩展的版本发现接口：扩展在弹窗 / 设置页调用它判断是否需要更新。
 * 元数据由 scripts/build-extension.cjs 在打包时写入 public/extension-meta.json。
 */
export async function GET(request: Request) {
  const origin = resolveOrigin(request);
  const manifest = readJson('public/extension/manifest.json');
  const meta = readJson('public/extension-meta.json');

  const version = (meta?.version as string) || (manifest?.version as string) || '0.0.0';
  const zipFile = (meta?.file as string) || `lingualens-v${version}.zip`;
  const crxFile = (meta?.crxFile as string) || 'lingualens.crx';
  const crxUrl = crxFile ? `${origin}/api/extension/crx` : '';

  return jsonWithCors({
    name: (manifest?.name as string) || 'LinguaLens',
    version,
    minChrome: (manifest?.minimum_chrome_version as string) || '116',
    zipUrl: `${origin}/${zipFile}`,
    crxUrl,
    updateManifestUrl: `${origin}/updates.xml`,
    notes: Array.isArray(meta?.notes) ? meta?.notes : [],
    builtAt: (meta?.builtAt as string) || null,
    releasedAt: (meta?.builtAt as string) || null,
  });
}
