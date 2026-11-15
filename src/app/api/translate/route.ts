import { HeaderUtils } from 'coze-coding-dev-sdk';
import type { NextRequest } from 'next/server';
import { preflight, jsonWithCors } from '@/lib/cors';
import { SUPPORTED_LANGUAGES, translateTexts } from '@/lib/translate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function OPTIONS() {
  return preflight();
}

export async function GET() {
  return jsonWithCors({
    ok: true,
    service: 'youtube-bilingual-subtitle-translator',
    languages: SUPPORTED_LANGUAGES,
    usage: 'POST { texts: string[], targetLang: "zh-CN", sourceLang?: string, context?: string }',
  });
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonWithCors({ error: 'INVALID_JSON', message: '请求体必须是合法 JSON' }, { status: 400 });
  }

  const body = (payload ?? {}) as Record<string, unknown>;
  const rawTexts = body.texts;

  if (!Array.isArray(rawTexts) || rawTexts.length === 0) {
    return jsonWithCors(
      { error: 'INVALID_TEXTS', message: 'texts 必须是非空字符串数组' },
      { status: 400 },
    );
  }
  if (rawTexts.length > 400) {
    return jsonWithCors(
      { error: 'TOO_MANY_TEXTS', message: '单次最多翻译 400 条字幕，请分批提交' },
      { status: 413 },
    );
  }

  const texts = rawTexts.map(item => (typeof item === 'string' ? item : String(item ?? '')));
  const targetLang = typeof body.targetLang === 'string' && body.targetLang ? body.targetLang : 'zh-CN';
  const sourceLang = typeof body.sourceLang === 'string' ? body.sourceLang : undefined;
  const context = typeof body.context === 'string' ? body.context.slice(0, 600) : undefined;

  if (!SUPPORTED_LANGUAGES[targetLang]) {
    return jsonWithCors(
      {
        error: 'UNSUPPORTED_LANGUAGE',
        message: `暂不支持目标语言 ${targetLang}`,
        languages: SUPPORTED_LANGUAGES,
      },
      { status: 400 },
    );
  }

  try {
    const forwardHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const result = await translateTexts({ texts, targetLang, sourceLang, context }, forwardHeaders);

    return jsonWithCors({
      ok: true,
      targetLang,
      translations: result.translations,
      count: result.translations.length,
      cacheHits: result.cacheHits,
      batches: result.batches,
      tookMs: Date.now() - startedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[translate] failed:', message);
    return jsonWithCors(
      {
        error: 'TRANSLATE_FAILED',
        message: `翻译服务调用失败：${message}`,
        tookMs: Date.now() - startedAt,
      },
      { status: 502 },
    );
  }
}
