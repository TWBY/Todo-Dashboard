'use client';

import { useEffect } from 'react';

/**
 * Next.js Global Error Boundary — 捕捉整個 app layout 層級的 render 錯誤
 * 當前端 crash 時會顯示這個頁面，並回報錯誤到 server
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 回報前端錯誤到 server 端寫入驗屍報告
    fetch('/api/crash-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'frontend-error',
        message: error.message,
        stack: error.stack,
        digest: error.digest,
      }),
    }).catch(() => {
      // 如果 server 也掛了就算了
    });
  }, [error]);

  return (
    <html suppressHydrationWarning>
      <body suppressHydrationWarning>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'system-ui, sans-serif',
          background: '#0a0a0a',
          color: '#e5e5e5',
          padding: '2rem',
        }}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>
            Dashboard Crashed
          </h1>
          <p style={{ color: '#a3a3a3', marginBottom: '0.5rem' }}>
            {error.message}
          </p>
          {error.digest && (
            <p style={{ color: '#737373', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: '0.75rem 1.5rem',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Try Again
          </button>
          <p style={{
            color: '#737373',
            fontSize: '0.75rem',
            marginTop: '2rem',
          }}>
            Crash report saved to data/crash-reports/
          </p>
        </div>
      </body>
    </html>
  );
}
