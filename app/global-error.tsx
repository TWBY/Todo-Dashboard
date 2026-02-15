'use client';

/**
 * Next.js Global Error Boundary — 捕捉整個 app layout 層級的 render 錯誤
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
            {error?.message || 'Unknown error'}
          </p>
          {error?.digest && (
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
        </div>
      </body>
    </html>
  );
}
