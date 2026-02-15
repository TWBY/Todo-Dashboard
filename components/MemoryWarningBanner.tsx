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

// 每個 pressureLevel 對應的色調
const LEVEL_COLORS = {
  normal: {
    border: 'rgba(34, 197, 94, 0.15)',
    bg: 'rgba(22, 101, 52, 0.08)',
    text: '#86efac',
    bar: '#22c55e',
    btnBg: '#14532d',
    btnText: '#86efac',
    btnBorder: '#166534',
  },
  warning: {
    border: 'rgba(202, 138, 4, 0.15)',
    bg: 'rgba(113, 63, 18, 0.10)',
    text: '#b8a472',
    bar: '#facc15',
    btnBg: '#5c4a20',
    btnText: '#fde68a',
    btnBorder: '#78350f',
  },
  critical: {
    border: 'rgba(239, 68, 68, 0.2)',
    bg: 'rgba(127, 29, 29, 0.12)',
    text: '#d4a0a0',
    bar: '#ef4444',
    btnBg: '#5c2020',
    btnText: '#fca5a5',
    btnBorder: '#7f1d1d',
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
    <div
      className={`p-3 rounded-lg border transition-all ${
        systemMemory.pressureLevel === 'critical' ? 'animate-memory-warning' : ''
      }`}
      style={{
        borderColor: colors.border,
        backgroundColor: colors.bg,
      }}
    >
      {/* Header: label + usage */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold" style={{ color: colors.text }}>
          {LEVEL_LABELS[systemMemory.pressureLevel]}
        </span>
        <span className="text-sm font-mono" style={{ color: colors.text }}>
          {systemMemory.usedGB} / {systemMemory.totalGB} GB ({systemMemory.usedPercent}%)
        </span>
      </div>
      {/* Memory bar */}
      <div
        className="w-full h-1.5 rounded-full overflow-hidden mb-2"
        style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
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
        <div className="flex flex-wrap gap-2">
          {systemMemory.topProcesses.map(proc => (
            <button
              key={proc.name}
              onClick={() => handleKillApp(proc.name)}
              disabled={killingApps.has(proc.name)}
              className="flex flex-col items-start px-3 py-2 rounded-lg text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 cursor-pointer min-w-[100px]"
              style={{
                backgroundColor: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              title={`點擊關閉 ${proc.name}`}
            >
              <span
                className="font-medium truncate max-w-full"
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
