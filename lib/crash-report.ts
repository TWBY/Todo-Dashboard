import fs from 'fs';
import path from 'path';

const CRASH_DIR = path.join(process.cwd(), 'data', 'crash-reports');

function ensureDir() {
  if (!fs.existsSync(CRASH_DIR)) {
    fs.mkdirSync(CRASH_DIR, { recursive: true });
  }
}

export interface CrashReport {
  timestamp: string;
  type: 'uncaughtException' | 'unhandledRejection' | 'frontend-error' | 'api-error';
  message: string;
  stack?: string;
  url?: string;
  componentStack?: string;
  extra?: Record<string, unknown>;
}

/**
 * 寫入一份驗屍報告到 data/crash-reports/
 * 檔名格式: crash-2026-02-11T14-30-00-000Z.json
 */
export function writeCrashReport(report: CrashReport): string {
  ensureDir();

  const filename = `crash-${report.timestamp.replace(/:/g, '-')}.json`;
  const filepath = path.join(CRASH_DIR, filename);

  const content = JSON.stringify(report, null, 2);
  fs.writeFileSync(filepath, content, 'utf-8');

  // 同時 append 到 summary log 方便快速瀏覽
  const summaryPath = path.join(CRASH_DIR, 'crash-summary.log');
  const summaryLine = `[${report.timestamp}] [${report.type}] ${report.message}\n`;
  fs.appendFileSync(summaryPath, summaryLine, 'utf-8');

  return filepath;
}

/**
 * 讀取所有驗屍報告（最新的在前面）
 */
export function readCrashReports(limit = 20): CrashReport[] {
  ensureDir();

  const files = fs.readdirSync(CRASH_DIR)
    .filter(f => f.startsWith('crash-') && f.endsWith('.json'))
    .sort()
    .reverse()
    .slice(0, limit);

  return files.map(f => {
    const content = fs.readFileSync(path.join(CRASH_DIR, f), 'utf-8');
    return JSON.parse(content) as CrashReport;
  });
}
