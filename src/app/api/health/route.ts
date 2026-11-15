import { jsonWithCors, preflight } from '@/lib/cors';
import { SUPPORTED_LANGUAGES, TRANSLATE_MODEL } from '@/lib/translate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const startedAt = Date.now();

export async function OPTIONS() {
  return preflight();
}

export async function GET() {
  return jsonWithCors({
    ok: true,
    service: 'youtube-bilingual-subtitle-translator',
    version: '2.1.2',
    model: TRANSLATE_MODEL,
    languages: SUPPORTED_LANGUAGES,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    time: new Date().toISOString(),
  });
}
