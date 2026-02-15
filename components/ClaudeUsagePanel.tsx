'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ClaudeUsageLimits, UsageBucket } from '@/lib/types';
import PulsingDots from '@/components/PulsingDots';

function formatResetTime(resetsAt: string | null): string {
  if (!resetsAt) return '';
  const reset = new Date(resetsAt);
  const now = new Date();
  const diffMs = reset.getTime() - now.getTime();

  if (diffMs <= 0) return 'Resetting...';

  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `Resets in ${diffMin} min`;
  const diffHr = Math.floor(diffMin / 60);
  const remainMin = diffMin % 60;
  if (diffHr < 24) return `Resets in ${diffHr} hr ${remainMin} min`;

  // Show day + time
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = reset.getHours();
  const minutes = reset.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 || 12;
  return `Resets ${dayNames[reset.getDay()]} ${h12}:${minutes.toString().padStart(2, '0')} ${ampm}`;
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function getBarColor(utilization: number): string {
  if (utilization >= 90) return '#ef4444'; // red
  if (utilization >= 70) return '#f59e0b'; // amber
  return '#60a5fa'; // blue
}

function UsageBar({ label, bucket }: { label: string; bucket: UsageBucket }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-base font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
          {bucket.utilization}% used
        </span>
      </div>
      <div
        className="w-full h-2.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--background-tertiary)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${Math.min(bucket.utilization, 100)}%`,
            backgroundColor: getBarColor(bucket.utilization),
          }}
        />
      </div>
      <div className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {formatResetTime(bucket.resets_at)}
      </div>
    </div>
  );
}

export default function ClaudeUsagePanel() {
  const [data, setData] = useState<ClaudeUsageLimits | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [, setTick] = useState(0);

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/claude-usage', { signal });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      setData(json.data);
      setError(null);
      setLastFetched(new Date());
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(controller.signal);
    // Refresh every 60 seconds
    const interval = setInterval(() => fetchData(controller.signal), 60000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchData]);

  // Update countdown display every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className=""
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">Claude Usage</h2>
        <div className="flex items-center gap-3">
          {lastFetched && (
            <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
              {timeAgo(lastFetched)}
            </span>
          )}
          <button
          onClick={() => { setIsLoading(true); fetchData(); }}
          className="px-3 py-1.5 rounded-lg transition-all duration-200 hover:shadow-md"
          style={{
            backgroundColor: 'var(--background-tertiary)',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--font-weight-medium)',
            lineHeight: 'var(--leading-compact)',
            letterSpacing: 'var(--tracking-ui)',
            boxShadow: 'var(--shadow-light)',
          }}
        >
          Refresh
        </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <span className="text-base">載入中</span>
            <PulsingDots color="var(--text-secondary)" />
          </div>
        </div>
      ) : data ? (
        <div className="space-y-4">
          {/* Current Session (5-hour) */}
          <div
            className="p-3 rounded-[var(--radius-medium)]"
            style={{ backgroundColor: 'var(--background-secondary)' }}
          >
            <UsageBar label="Current session" bucket={data.five_hour} />
          </div>

          {/* Weekly Limits */}
          <div
            className="p-3 rounded-[var(--radius-medium)] space-y-4"
            style={{ backgroundColor: 'var(--background-secondary)' }}
          >
            <div className="text-sm font-medium mb-1" style={{ color: 'var(--text-tertiary)' }}>
              Weekly limits
            </div>
            <UsageBar label="All models" bucket={data.seven_day} />

            {data.seven_day_sonnet && data.seven_day_sonnet.utilization !== null && (
              <UsageBar label="Sonnet only" bucket={data.seven_day_sonnet} />
            )}

            {data.seven_day_opus && data.seven_day_opus.utilization !== null && (
              <UsageBar label="Opus only" bucket={data.seven_day_opus} />
            )}
          </div>

        </div>
      ) : error ? (
        <div className="py-4 px-3 rounded-[var(--radius-medium)]" style={{ backgroundColor: 'var(--background-secondary)' }}>
          <p className="text-sm text-center" style={{ color: '#ef4444' }}>
            {error}
          </p>
        </div>
      ) : (
        <p className="text-base text-center py-4" style={{ color: 'var(--text-tertiary)' }}>
          No usage data available
        </p>
      )}
    </div>
  );
}
