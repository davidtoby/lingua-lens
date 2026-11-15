import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FALLBACK_ORIGIN = 'https://5tjjyhbf89.coze.site';

/** 由 .keys/lingualens.pem 公钥推导，固定不变；换私钥才会变。 */
const EXTENSION_ID = 'megljaakikpaegbfnfdkphmpkapdonec';

function resolveOrigin(request: Request) {
  const headers = request.headers;
  const host = headers.get('x-forwarded-host') || headers.get('host');
  if (!host) return FALLBACK_ORIGIN;
  const proto = headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

function currentVersion() {
  try {
    const file = path.join(process.cwd(), 'public/extension/manifest.json');
    const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as { version?: string };
    return manifest.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
}

/**
 * Chrome 扩展更新清单（manifest.json 里的 update_url 指向这里）。
 * 通过 .crx 安装或由策略分发的扩展会按此清单静默升级。
 */
export async function GET(request: Request) {
  const origin = resolveOrigin(request);
  const version = currentVersion();

  const xml = `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${EXTENSION_ID}'>
    <updatecheck codebase='${origin}/lingualens.crx' version='${version}'/>
  </app>
</gupdate>
`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
