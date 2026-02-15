/**
 * Next.js Instrumentation — 暫時停用
 * 原因: crash-report.ts 使用 Node.js APIs 導致 Edge Runtime 編譯錯誤
 * TODO: 改用 Next.js runtime-specific imports 或移除 fs 依賴
 */
export async function register() {
  console.warn('⚠️ Crash report instrumentation disabled (Edge Runtime compatibility)');
}
