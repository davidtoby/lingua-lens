import { LLMClient, Config } from 'coze-coding-dev-sdk';

export const SUPPORTED_LANGUAGES: Record<string, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁体中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ru: 'Русский',
  pt: 'Português',
  it: 'Italiano',
  ar: 'العربية',
  th: 'ไทย',
  vi: 'Tiếng Việt',
};

export type TranslateInput = {
  texts: string[];
  targetLang: string;
  sourceLang?: string;
  context?: string;
};

export type TranslateResult = {
  translations: string[];
  model: string;
  cacheHits: number;
  batches: number;
};

/** 翻译使用的内置模型（可通过 TRANSLATE_MODEL 环境变量覆盖） */
export const TRANSLATE_MODEL = process.env.TRANSLATE_MODEL || 'doubao-seed-2-0-lite-260215';

const MAX_TEXTS_PER_BATCH = 32;
const MAX_CHARS_PER_BATCH = 2200;
const MAX_CONCURRENCY = 2;
const CACHE_LIMIT = 8000;

/** 进程内 LRU 缓存：同一条字幕在多个视频/多次请求间复用，避免重复消耗 token */
const cache = new Map<string, string>();

function cacheKey(lang: string, text: string) {
  return `${lang}\u0000${text}`;
}

function cacheGet(lang: string, text: string) {
  const key = cacheKey(lang, text);
  const hit = cache.get(key);
  if (hit !== undefined) {
    // 命中后移到队尾，保持 LRU 顺序
    cache.delete(key);
    cache.set(key, hit);
  }
  return hit;
}

function cacheSet(lang: string, text: string, value: string) {
  const key = cacheKey(lang, text);
  cache.set(key, value);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function normalizeLine(line: string) {
  return line.replace(/\s+/g, ' ').trim();
}

function buildSystemPrompt(targetLang: string, sourceLang?: string) {
  const target = SUPPORTED_LANGUAGES[targetLang] ?? targetLang;
  const source = sourceLang ? `源语言是 ${sourceLang}。` : '源语言请自动识别。';
  return [
    '你是专业的视频字幕翻译引擎，服务于双语字幕阅读场景。',
    `请把用户给出的 JSON 字符串数组中的每一条字幕翻译成 ${target}。${source}`,
    '硬性要求：',
    '1. 输入是 JSON 数组，输出也必须是 JSON 数组，数组长度必须与输入完全一致，一条对一条，不得合并、拆分、省略或补充条目。',
    '2. 输出只包含 JSON 数组本身，不要 Markdown 代码块，不要解释、编号或任何前后缀文字。',
    '3. 每条译文要口语化、简洁自然，符合字幕阅读节奏，不要添加原文没有的信息。',
    '4. 人名、品牌、专有名词使用通用译法；代码、URL、数字保持原样。',
    '5. 如果某条内容为空字符串或只有语气词，输出空字符串。',
  ].join('\n');
}

function extractJsonArray(raw: string): unknown {
  const text = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function toStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.map(item => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object') {
      const record = item as Record<string, unknown>;
      const candidate = record.translation ?? record.text ?? record.zh ?? record.value;
      if (typeof candidate === 'string') return candidate;
    }
    return '';
  });
}

/** 按原始下标分批，保证批次里的下标始终指向 texts 的真实位置（未命中缓存的才进批次） */
function splitIntoBatches(indexes: number[], texts: string[]) {
  const batches: number[][] = [];
  let current: number[] = [];
  let chars = 0;
  indexes.forEach((index) => {
    const length = texts[index].length;
    if (
      current.length > 0 &&
      (current.length >= MAX_TEXTS_PER_BATCH || chars + length > MAX_CHARS_PER_BATCH)
    ) {
      batches.push(current);
      current = [];
      chars = 0;
    }
    current.push(index);
    chars += length;
  });
  if (current.length > 0) batches.push(current);
  return batches;
}

async function translateBatch(
  client: LLMClient,
  batch: string[],
  targetLang: string,
  sourceLang: string | undefined,
  context: string | undefined,
  attempt = 0,
): Promise<string[]> {
  const userContent = [
    context ? `视频上下文（仅用于理解，不要翻译这段）：${context}` : '',
    '待翻译字幕 JSON 数组：',
    JSON.stringify(batch, null, 0),
  ]
    .filter(Boolean)
    .join('\n');

  const response = await client.invoke(
    [
      { role: 'system', content: buildSystemPrompt(targetLang, sourceLang) },
      { role: 'user', content: userContent },
    ],
    { model: TRANSLATE_MODEL, temperature: 0.2 },
  );

  const parsed = toStringArray(extractJsonArray(response.content ?? ''));

  if (parsed && parsed.length === batch.length) {
    return parsed.map((line, index) => (line && line.trim() ? line.trim() : batch[index]));
  }

  if (attempt === 0) {
    // 数量不一致或解析失败时重试一次，用更强的约束提示
    return translateBatch(client, batch, targetLang, sourceLang, context, 1);
  }

  if (parsed && parsed.length > 0) {
    // 长度对不上时按位置尽力对齐，缺失部分保留原文
    return batch.map((original, index) => {
      const line = parsed[index];
      return line && line.trim() ? line.trim() : original;
    });
  }

  // 完全无法解析时，退化为逐行纯文本翻译（不带 JSON 约束）
  const fallback = await client.invoke(
    [
      {
        role: 'system',
        content: `你是字幕翻译引擎，把用户给的每行文本翻译成 ${
          SUPPORTED_LANGUAGES[targetLang] ?? targetLang
        }，一行对一行输出译文，不要输出原文、编号或解释。`,
      },
      { role: 'user', content: batch.join('\n') },
    ],
    { model: TRANSLATE_MODEL, temperature: 0.2 },
  );

  const lines = (fallback.content ?? '')
    .split('\n')
    .map(line => line.replace(/^\s*\d+[.、)]\s*/, '').trim())
    .filter((line, index, arr) => !(line === '' && arr.length - 1 === index));

  return batch.map((original, index) => lines[index]?.trim() || original);
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, limit: number) {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;
  const workers = new Array(Math.min(limit, tasks.length)).fill(0).map(async () => {
    while (cursor < tasks.length) {
      const index = cursor++;
      results[index] = await tasks[index]();
    }
  });
  await Promise.all(workers);
  return results;
}

export async function translateTexts(
  input: TranslateInput,
  forwardHeaders?: Record<string, string>,
): Promise<TranslateResult> {
  const targetLang = input.targetLang || 'zh-CN';
  const texts = input.texts.map(text => normalizeLine(text ?? ''));

  const results = new Array<string>(texts.length).fill('');
  const pending: number[] = [];
  let cacheHits = 0;

  texts.forEach((text, index) => {
    if (!text) {
      results[index] = '';
      return;
    }
    const cached = cacheGet(targetLang, text);
    if (cached !== undefined && cached.trim()) {
      results[index] = cached;
      cacheHits += 1;
      return;
    }
    pending.push(index);
  });

  const config = new Config();
  const client = new LLMClient(config, forwardHeaders);
  const batches = splitIntoBatches(pending, texts);

  const tasks = batches.map(batchIndexes => async () => {
    const batchTexts = batchIndexes.map(index => texts[index]);
    const translated = await translateBatch(
      client,
      batchTexts,
      targetLang,
      input.sourceLang,
      input.context,
    );
    batchIndexes.forEach((textIndex, position) => {
      const value = translated[position] || texts[textIndex];
      results[textIndex] = value;
      // 只有真正拿到译文才写缓存，避免把空串或原文污染进缓存
      if (value && value !== texts[textIndex]) cacheSet(targetLang, texts[textIndex], value);
    });
  });

  await runWithConcurrency(tasks, MAX_CONCURRENCY);

  return {
    translations: results,
    model: TRANSLATE_MODEL,
    cacheHits,
    batches: batches.length,
  };
}
