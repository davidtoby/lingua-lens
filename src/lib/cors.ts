import { NextResponse } from 'next/server';

/**
 * 浏览器扩展（chrome-extension://）与本地页面都会直接访问翻译服务，
 * 因此所有 API 统一返回宽松的 CORS 头，并处理预检请求。
 */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

export function jsonWithCors(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> },
) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: { ...CORS_HEADERS, ...(init?.headers ?? {}) },
  });
}

export function preflight() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}
