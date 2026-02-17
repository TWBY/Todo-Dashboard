'use client';

import { useEffect, useState, useCallback } from 'react';
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

/** 計算建議平均使用進度 % */
function computeExpectedPct(resetsAt: string | null, totalDays: number): number | null {
  if (!resetsAt) return null;
  const now = Date.now();
  const resetMs = new Date(resetsAt).getTime();
  const remainMs = resetMs - now;
  if (remainMs <= 0) return null;
  const totalMs = totalDays * 24 * 60 * 60 * 1000;
  const elapsedMs = totalMs - remainMs;
  if (elapsedMs <= 0) return null;
  return Math.min(Math.round((elapsedMs / totalMs) * 100), 100);
}

/** 用量條（上或下） */
function UsageBar({
  position,
  pct,
  countdown,
  color,
  expectedPct,
}: {
  position: 'top' | 'bottom';
  pct: number;
  countdown: string;
  color: string;
  expectedPct?: number | null;
}) {
  const posClass = position === 'top' ? 'top-0' : 'bottom-0';

  return (
    <div
      className={`fixed ${posClass} left-0 right-0 h-[14px] z-[9999] overflow-hidden`}
      style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
    >
      {/* 填充進度 */}
      <div
        className="absolute inset-y-0 left-0 transition-all duration-1000 ease-out"
        style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.25 }}
      />

      {/* 文字在進度尾巴（絕對定位，基於進度%） */}
      <div
        className="absolute top-1/2 -translate-y-1/2 flex items-center gap-1 whitespace-nowrap transition-all duration-1000 ease-out"
        style={{
          left: `calc(${pct}% - 50px)`,
          pointerEvents: 'none',
        }}
      >
        <span className="text-[9px] font-mono font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {pct}%
        </span>
        {countdown && (
          <span className="text-[9px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
            {countdown}
          </span>
        )}
      </div>

      {/* Weekly 建議平均進度虛線標記 */}
      {expectedPct != null && (
        <div
          className="absolute inset-y-0 w-px transition-all duration-1000 ease-out"
          style={{
            left: `${expectedPct}%`,
            borderLeft: `2px dotted ${color}`,
            opacity: 0.6,
          }}
        />
      )}
    </div>
  );
}

export default function EnvironmentIndicator() {
  const [port, setPort] = useState<number>(0);
  const [data, setData] = useState<ClaudeUsageLimits | null>(null);

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
    const portNum = parseInt(window.location.port) || 80;
    setPort(portNum);

    const isDev = portNum === 3000;
    const prefix = isDev ? '[DEV] ' : '[PROD] ';
    const applyPrefix = () => {
      if (!document.title.startsWith('[')) {
        document.title = prefix + document.title;
      }
    };
    applyPrefix();

    const observer = new MutationObserver(() => applyPrefix());
    const titleEl = document.querySelector('title');
    if (titleEl) {
      observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    const interval = setInterval(() => fetchData(controller.signal), 60000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [fetchData]);

  if (!port) return null;

  const color = port === 3000 ? '#ef4444' : '#10b981';
  const sessionPct = data ? Math.min(data.five_hour.utilization, 100) : 0;
  const weeklyPct = data ? Math.min(data.seven_day.utilization, 100) : 0;
  const sessionCountdown = data ? formatCountdown(data.five_hour.resets_at) : '';
  const weeklyCountdown = data ? formatCountdown(data.seven_day.resets_at) : '';
  const weeklyExpected = data ? computeExpectedPct(data.seven_day.resets_at, 7) : null;

  return (
    <>
      <UsageBar
        position="top"
        pct={sessionPct}
        countdown={sessionCountdown}
        color={color}
      />
      <UsageBar
        position="bottom"
        pct={weeklyPct}
        countdown={weeklyCountdown}
        color={color}
        expectedPct={weeklyExpected}
      />
    </>
  );
}
