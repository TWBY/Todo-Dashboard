'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDevServer } from '@/contexts/DevServerContext';
import type { ClaudeUsageLimits } from '@/lib/types';

function formatCountdown(resetsAt: string | null): string {
  if (!resetsAt) return '';
  const diffMs = new Date(resetsAt).getTime() - Date.now();
  if (diffMs <= 0) return 'resetting';
  const totalMin = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (hours < 24) return `${hours}h${min}m`;
  const days = Math.floor(hours / 24);
  return `${days}d${hours % 24}h`;
}

function MiniBar({ percent, color }: { percent: number; color: string }) {
  return (
    <div
      className="flex-1 h-2 rounded-full overflow-hidden"
      style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
    >
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

function SkeletonBar() {
  return (
    <div className="h-7 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
  );
}

function SkeletonIndicator() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }} />
      <span className="w-6 h-3 rounded animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
      <div className="w-12 h-1 rounded-full animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
    </div>
  );
}

/** 計算平均使用量分析（僅 Weekly 使用） */
function computePace(utilization: number, resetsAt: string | null, totalDays: number): { expectedPct: number; diffPct: number; label: string } | null {
  if (!resetsAt) return null;
  const now = Date.now();
  const resetMs = new Date(resetsAt).getTime();
  const remainMs = resetMs - now;
  if (remainMs <= 0) return null;

  const totalMs = totalDays * 24 * 60 * 60 * 1000;
  const elapsedMs = totalMs - remainMs;
  if (elapsedMs <= 0) return null;

  const elapsedPct = (elapsedMs / totalMs) * 100;
  const expectedPct = Math.round(elapsedPct);
  const diffPct = Math.round(utilization - expectedPct);

  if (diffPct > 5) {
    return { expectedPct, diffPct, label: `+${diffPct}% over` };
  } else if (diffPct < -5) {
    return { expectedPct, diffPct, label: `${Math.abs(diffPct)}% under` };
  }
  return { expectedPct, diffPct, label: 'on pace' };
}

/** 單行用量條 */
function UsageRow({ label, utilization, resetsAt, totalDays, showPace }: {
  label: string;
  utilization: number;
  resetsAt: string | null;
  totalDays: number;
  showPace?: boolean;
}) {
  const isOver = utilization >= 80;
  const bgColor = isOver ? 'rgba(239,68,68,0.15)' : 'rgba(96,165,250,0.1)';
  const accentColor = isOver ? '#ef4444' : '#60a5fa';
  const countdown = formatCountdown(resetsAt);
  const pace = showPace ? computePace(utilization, resetsAt, totalDays) : null;

  return (
    <div
      className="flex items-center gap-3 px-3 py-1.5 rounded-lg"
      style={{ backgroundColor: bgColor }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
      <span className="text-xs font-semibold" style={{ color: accentColor }}>{label}</span>
      <span className="text-xs font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
        {utilization}%
      </span>
      {countdown && (
        <span className="text-xs font-mono" style={{ color: 'var(--text-tertiary)' }}>
          {countdown}
        </span>
      )}
      {pace && (
        <span
          className="text-xs flex items-center gap-1"
          style={{ color: pace.diffPct > 5 ? '#f59e0b' : pace.diffPct < -5 ? '#22c55e' : 'var(--text-tertiary)' }}
        >
          {pace.diffPct > 5 && <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '0.6rem' }} />}
          {pace.label}
        </span>
      )}
    </div>
  );
}

/**
 * Session（上）+ Weekly（下）雙層用量指標
 * 顏色邏輯：port 判斷（3002=紅色系，3001=綠色系）
 * 內容：實時 Claude 用量
 */
export function ClaudeUsageBar({ layout = 'both' }: { layout?: 'both' | 'session-only' | 'weekly-only' } = {}) {
  const [port, setPort] = useState<number>(0);
  const [data, setData] = useState<ClaudeUsageLimits | null>(null);

  // 讀取 port
  useEffect(() => {
    setPort(parseInt(window.location.port) || 80);
  }, []);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/claude-usage', { signal });
      if (!res.ok) return;
      const json = await res.json();
      setData(json.data);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    const interval = setInterval(() => fetchData(controller.signal), 60000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [fetchData]);

  // 根據 port 判斷顏色（3002=紅，3001=綠）
  const isDevPort = port === 3002;
  const bgColor = isDevPort ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.1)';
  const accentColor = isDevPort ? '#ef4444' : '#10b981';

  if (!data) return (
    <div>
      {(layout === 'both' || layout === 'session-only') && <SkeletonBar />}
      {(layout === 'both' || layout === 'weekly-only') && <SkeletonBar />}
    </div>
  );

  return (
    <div>
      {/* Session */}
      {(layout === 'both' || layout === 'session-only') && (
        <div className="flex items-center gap-2 py-1.5">
          <span className="text-sm font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {data.five_hour.utilization}%
          </span>
          {formatCountdown(data.five_hour.resets_at) && (
            <span className="text-sm font-mono" style={{ color: 'var(--text-tertiary)' }}>
              {formatCountdown(data.five_hour.resets_at)}
            </span>
          )}
        </div>
      )}

      {/* Weekly */}
      {(layout === 'both' || layout === 'weekly-only') && (
        <div className="flex items-center gap-2 py-1.5">
          <span className="text-sm font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {data.seven_day.utilization}%
          </span>
          {formatCountdown(data.seven_day.resets_at) && (
            <span className="text-sm font-mono" style={{ color: 'var(--text-tertiary)' }}>
              {formatCountdown(data.seven_day.resets_at)}
            </span>
          )}
          {(() => {
            const pace = computePace(data.seven_day.utilization, data.seven_day.resets_at, 7);
            return pace ? (
              <span
                className="text-sm"
                style={{ color: pace.diffPct > 5 ? '#f59e0b' : pace.diffPct < -5 ? '#22c55e' : 'var(--text-tertiary)' }}
              >
                {pace.diffPct > 0 ? '+' : ''}{pace.diffPct}%
              </span>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
}

/** 底部 Memory + CPU 指標條 */
export function MemoryCpuBar({ layout = 'both' }: { layout?: 'both' | 'memory-only' | 'cpu-only' } = {}) {
  const { systemMemory, systemCpu } = useDevServer();

  const memoryColor = !systemMemory ? 'rgba(255,255,255,0.15)'
    : systemMemory.pressureLevel === 'critical' ? '#ef4444'
    : systemMemory.pressureLevel === 'warning' ? '#facc15' : '#22c55e';

  const cpuColor = systemCpu === null ? 'rgba(255,255,255,0.15)'
    : systemCpu >= 80 ? '#ef4444' : systemCpu >= 50 ? '#fb923c' : '#818cf8';

  return (
    <div className="flex items-center gap-2">
      {/* Memory */}
      {(layout === 'both' || layout === 'memory-only') && (
        systemMemory ? (
          <>
            <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
              {systemMemory.usedPercent}%
            </span>
            <MiniBar percent={systemMemory.usedPercent} color={memoryColor} />
          </>
        ) : (
          <SkeletonIndicator />
        )
      )}

      {/* Spacer (only show when both) */}
      {layout === 'both' && <div style={{ width: '16px' }} />}

      {/* CPU */}
      {(layout === 'both' || layout === 'cpu-only') && (
        systemCpu !== null ? (
          <>
            <span className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
              {systemCpu.toFixed(0)}%
            </span>
            <MiniBar percent={systemCpu} color={cpuColor} />
          </>
        ) : (
          <SkeletonIndicator />
        )
      )}
    </div>
  );
}
