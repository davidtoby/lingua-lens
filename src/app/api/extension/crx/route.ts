import fs from 'node:fs';
import path from 'node:path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 直接以二进制方式返回 .crx。
 * 静态目录里的 .crx 在线上网关会被拦截（500），所以更新链路统一走这个接口。
 */
export async function GET() {
  const file = path.join(process.cwd(), 'public/lingualens.crx');
  if (!fs.existsSync(file)) {
    return new Response('crx not built', { status: 404 });
  }
  const data = fs.readFileSync(file);
  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': 'application/x-chrome-extension',
      'Content-Length': String(data.byteLength),
      'Content-Disposition': 'attachment; filename="lingualens.crx"',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
