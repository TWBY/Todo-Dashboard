import { NextRequest, NextResponse } from 'next/server';
import { writeCrashReport, readCrashReports } from '@/lib/crash-report';

// 強制使用 Node.js runtime（crash-report 使用 fs 模組）
export const runtime = 'nodejs';

/**
 * POST: 前端錯誤回報 → 寫入驗屍報告
 * GET:  讀取最近的驗屍報告列表
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const filepath = writeCrashReport({
      timestamp: new Date().toISOString(),
      type: body.type || 'frontend-error',
      message: body.message || 'Unknown error',
      stack: body.stack,
      url: body.url,
      componentStack: body.componentStack,
      extra: {
        digest: body.digest,
        userAgent: req.headers.get('user-agent'),
      },
    });

    return NextResponse.json({ ok: true, filepath });
  } catch (error) {
    console.error('Failed to write crash report:', error);
    return NextResponse.json({ error: 'Failed to write report' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get('limit') || '20');
    const reports = readCrashReports(limit);
    return NextResponse.json({ reports });
  } catch (error) {
    console.error('Failed to read crash reports:', error);
    return NextResponse.json({ error: 'Failed to read reports' }, { status: 500 });
  }
}
