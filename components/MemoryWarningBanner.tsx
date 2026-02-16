'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
interface ExternalProcess {
  name: string;
  memoryMB: number;
}

interface SystemMemory {
  pressureLevel: 'normal' | 'warning' | 'critical';
  usedGB: number;
  totalGB: number;
  usedPercent: number;
  suggestedStops: string[];
  topProcesses: ExternalProcess[];
}

// 每個 pressureLevel 對應的色調（低調小色塊）
const LEVEL_COLORS = {
  normal: {
    dot: '#22c55e',
    bar: '#22c55e',
  },
  warning: {
    dot: '#facc15',
    bar: '#facc15',
  },
  critical: {
    dot: '#ef4444',
    bar: '#ef4444',
  },
} as const;

const LEVEL_LABELS = {
  normal: 'Memory',
  warning: 'Memory Warning',
  critical: 'Memory Critical!',
} as const;

function formatMB(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${mb}MB`;
}

export default function MemoryWarningBanner() {
  const [systemMemory, setSystemMemory] = useState<SystemMemory | null>(null);
  const [killingApps, setKillingApps] = useState<Set<string>>(new Set());
  const failCountRef = useRef(0);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/dev-server', { signal });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSystemMemory(data.systemMemory || null);
      failCountRef.current = 0;
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        failCountRef.current++;
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    const interval = setInterval(() => fetchData(controller.signal), 15000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchData]);

  const handleKillApp = async (appName: string) => {
    setKillingApps(prev => new Set(prev).add(appName));
    try {
      await fetch('/api/dev-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kill-app', appName }),
      });
      // 等待一下讓系統回收記憶體
      await new Promise(resolve => setTimeout(resolve, 1000));
      await fetchData();
    } catch { /* ignore */ }
    setKillingApps(prev => {
      const next = new Set(prev);
      next.delete(appName);
      return next;
    });
  };

  if (!systemMemory) return null;

  const colors = LEVEL_COLORS[systemMemory.pressureLevel];
  const hasTopProcesses = systemMemory.topProcesses?.length > 0;

  return (
    <div className="space-y-2.5">
      {/* Header: dot + label + usage */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: colors.dot }}
          />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {LEVEL_LABELS[systemMemory.pressureLevel]}
          </span>
        </div>
        <span className="text-sm font-mono" style={{ color: 'var(--text-tertiary)' }}>
          {systemMemory.usedGB} / {systemMemory.totalGB} GB ({systemMemory.usedPercent}%)
        </span>
      </div>
      {/* Memory bar */}
      <div
        className="w-full h-1 rounded-full overflow-hidden"
        style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(systemMemory.usedPercent, 100)}%`,
            backgroundColor: colors.bar,
          }}
        />
      </div>

      {/* 外部軟體按鈕卡片 */}
      {hasTopProcesses && (
        <div className="flex flex-wrap gap-1.5">
          {systemMemory.topProcesses.map(proc => (
            <button
              key={proc.name}
              onClick={() => handleKillApp(proc.name)}
              disabled={killingApps.has(proc.name)}
              className="flex flex-col items-start px-2.5 py-1.5 rounded-md text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 cursor-pointer min-w-[90px]"
              style={{
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
              title={`點擊關閉 ${proc.name}`}
            >
              <span
                className="font-medium truncate max-w-full text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                {killingApps.has(proc.name) ? 'Closing...' : proc.name}
              </span>
              <span
                className="font-mono text-xs mt-0.5"
                style={{ color: 'var(--text-tertiary)' }}
              >
                {formatMB(proc.memoryMB)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
