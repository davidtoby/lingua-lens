'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowRight, Check, Copy, Loader2 } from 'lucide-react';

type Health = {
  ok: boolean;
  model?: string;
  version?: string;
  languages?: Record<string, string>;
  uptimeSeconds?: number;
};

type Status = 'idle' | 'loading' | 'ok' | 'error';

export default function ServicePanel() {
  const [origin, setOrigin] = useState('http://localhost:5050');
  const [status, setStatus] = useState<Status>('idle');
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState('');
  const [text, setText] = useState('This video explains how transformers work.');
  const [result, setResult] = useState('');
  const [translating, setTranslating] = useState(false);
  const [copied, setCopied] = useState(false);

  const check = useCallback(async () => {
    setStatus('loading');
    setError('');
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json()) as Health;
      setHealth(payload);
      setStatus('ok');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    setOrigin(window.location.origin);
    check();
  }, [check]);

  const translate = async () => {
    if (!text.trim()) return;
    setTranslating(true);
    setResult('');
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: [text.trim()], targetLang: 'zh-CN' }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || `HTTP ${response.status}`);
      setResult(payload.translations?.[0] || '（空结果）');
    } catch (err) {
      setResult(`翻译失败：${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setTranslating(false);
    }
  };

  const copyOrigin = async () => {
    try {
      await navigator.clipboard.writeText(origin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const dotClass =
    status === 'ok'
      ? 'bg-emerald-500'
      : status === 'loading'
        ? 'bg-amber-400'
        : status === 'error'
          ? 'bg-rose-500'
          : 'bg-muted-foreground/40';

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4 text-primary" />
          服务端状态
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`h-2 w-2 rounded-full ${dotClass}`} />
          {status === 'loading' && <span className="text-muted-foreground">正在检测…</span>}
          {status === 'ok' && (
            <span className="text-emerald-600 dark:text-emerald-400">
              服务正常 · 模型 {health?.model || '内置'}
            </span>
          )}
          {status === 'error' && <span className="text-rose-600">无法连接：{error}</span>}
          {status === 'idle' && <span className="text-muted-foreground">尚未检测</span>}
        </div>

        <div className="mt-5 space-y-2">
          <div className="text-xs text-muted-foreground">扩展里要填写的服务端地址</div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <code className="flex-1 truncate text-xs">{origin}</code>
            <button
              type="button"
              onClick={copyOrigin}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:bg-background hover:text-foreground"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? '已复制' : '复制'}
            </button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            在扩展设置页把「服务端地址」改成上面的地址即可联调；本地开发默认端口为 5000。
          </p>
        </div>

        <button
          type="button"
          onClick={check}
          className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
        >
          重新检测
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 text-sm font-semibold">试译一句</div>
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
            placeholder="输入英文句子试试"
          />
          <button
            type="button"
            onClick={translate}
            disabled={translating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {translating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            翻译
          </button>
        </div>
        <div className="mt-4 min-h-[52px] rounded-xl border border-dashed border-border bg-muted/30 px-3 py-3 text-sm leading-relaxed">
          {result || <span className="text-muted-foreground">翻译结果会显示在这里。</span>}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          这个接口就是扩展实际调用的 <code className="rounded bg-muted px-1">POST /api/translate</code>，
          能返回译文说明前后端已经联通。
        </p>
      </div>
    </div>
  );
}
