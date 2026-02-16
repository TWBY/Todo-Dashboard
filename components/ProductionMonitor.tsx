'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface ProductionStatus {
  isRunning: boolean;
  pid?: number;
  cpuPercent?: number;
  memoryMB?: number;
}

export default function ProductionMonitor() {
  const [status, setStatus] = useState<ProductionStatus | null>(null);
  const failCountRef = useRef(0);

  const fetchStatus = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/dev-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: 'dashboard', action: 'check-production' }),
        signal,
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        failCountRef.current = 0;
      } else {
        failCountRef.current++;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      failCountRef.current++;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchStatus(controller.signal);
    // Refresh every 15 seconds (same as DevServerPanel)
    const interval = setInterval(() => fetchStatus(controller.signal), 15000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchStatus]);

  // 只有 Production 正在運行時才顯示
  if (!status?.isRunning) return null;

  const showWarning = (status.cpuPercent !== undefined && status.cpuPercent >= 50) ||
    (status.memoryMB !== undefined && status.memoryMB >= 512);

  const dotColor = showWarning ? '#fb923c' : '#818cf8';
  const barColor = status.cpuPercent !== undefined
    ? (status.cpuPercent >= 80 ? '#ef4444' : status.cpuPercent >= 50 ? '#fb923c' : '#818cf8')
    : '#818cf8';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: dotColor }}
          />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {showWarning ? 'Production Warning' : 'Production (Port 4000)'}
          </span>
        </div>
        <span className="text-sm font-mono" style={{ color: 'var(--text-tertiary)' }}>
          {status.cpuPercent !== undefined && status.memoryMB !== undefined
            ? `CPU ${status.cpuPercent.toFixed(1)}% · ${status.memoryMB >= 1024 ? `${(status.memoryMB / 1024).toFixed(1)}G` : `${status.memoryMB}M`}`
            : 'Running'}
        </span>
      </div>

      {/* CPU Progress Bar */}
      {status.cpuPercent !== undefined && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              CPU Usage
            </span>
            <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
              {status.cpuPercent.toFixed(1)}%
            </span>
          </div>
          <div
            className="w-full h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
          >
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{
                width: `${Math.min(status.cpuPercent, 100)}%`,
                backgroundColor: barColor,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
