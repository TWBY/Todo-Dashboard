'use client';

import { useState, useEffect, useCallback } from 'react';
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

function SkeletonBar() {
  return (
    <div className="h-7 rounded-lg animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
  );
}

/**
 * Session（上）+ Weekly（下）雙層用量指標
 * 顏色邏輯：port 判斷（3002=紅色系，3001=綠色系）
 * 內容：實時 Claude 用量
 */
export function ClaudeUsageBar({ layout = 'both' }: { layout?: 'both' | 'session-only' | 'weekly-only' } = {}) {
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
    const controller = new AbortController();
    fetchData(controller.signal);
    const interval = setInterval(() => fetchData(controller.signal), 60000);
    return () => { controller.abort(); clearInterval(interval); };
  }, [fetchData]);

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
        </div>
      )}
    </div>
  );
}

