'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ClaudeUsageLimits, UsageBucket } from '@/lib/types';
import PulsingDots from '@/components/PulsingDots';

// ── Utilities ──────────────────────────────────────────────

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
  if (utilization >= 90) return '#ef4444';
  if (utilization >= 70) return '#f59e0b';
  return '#60a5fa';
}

function formatCountdown(resetsAt: string | null): string {
  if (!resetsAt) return '';
  const diffMs = new Date(resetsAt).getTime() - Date.now();
  if (diffMs <= 0) return 'Resetting...';

  const totalMin = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMin / 60);
  const min = totalMin % 60;

  if (hours < 24) return `${hours}h ${min}m`;

  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return `${days}d ${remainHours}h`;
}

// ── Pacing Logic ───────────────────────────────────────────

interface PacingResult {
  expectedPosition: number;
  projectedAtEnd: number;
  pacingDelta: number;
  hasSufficientData: boolean;
}

function calculatePacing(bucket: UsageBucket): PacingResult | null {
  if (!bucket.resets_at) return null;

  const now = Date.now();
  const resetTime = new Date(bucket.resets_at).getTime();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const cycleStart = resetTime - SEVEN_DAYS_MS;
  const elapsed = Math.max(0, Math.min(1, (now - cycleStart) / SEVEN_DAYS_MS));

  const expectedPosition = elapsed * 100;
  const daysElapsed = elapsed * 7;
  const dailyAvgRate = daysElapsed > 0 ? bucket.utilization / daysElapsed : 0;
  const projectedAtEnd = dailyAvgRate * 7;
  const pacingDelta = bucket.utilization - expectedPosition;
  const hasSufficientData = daysElapsed > 2 / 24;

  return { expectedPosition, projectedAtEnd, pacingDelta, hasSufficientData };
}

function getPacingColor(delta: number): string {
  if (delta <= -10) return '#22c55e';
  if (delta <= -3) return '#4ade80';
  if (delta <= 3) return '#94a3b8';
  if (delta <= 15) return '#f59e0b';
  return '#ef4444';
}

function getPacingIcon(delta: number): string {
  if (delta <= -3) return '▼';
  if (delta <= 3) return '▶';
  return '▲';
}

function getPacingLabel(delta: number): string {
  if (delta <= -10) return 'Well under pace';
  if (delta <= -3) return 'Under pace';
  if (delta <= 3) return 'On pace';
  if (delta <= 15) return 'Ahead of pace';
  return 'Way ahead of pace';
}

// ── Components ─────────────────────────────────────────────

function CompactUsageRow({ label, bucket }: { label: string; bucket: UsageBucket }) {
  const color = getBarColor(bucket.utilization);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            {label}
          </span>
        </div>
        <span className="text-sm font-mono" style={{ color: 'var(--text-tertiary)' }}>
          {bucket.utilization}% · {formatCountdown(bucket.resets_at)}
        </span>
      </div>
      <div
        className="w-full h-1 rounded-full overflow-hidden"
        style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(bucket.utilization, 100)}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

function WeeklyPacingRow({ bucket }: { bucket: UsageBucket }) {
  const color = getBarColor(bucket.utilization);
  const pacing = calculatePacing(bucket);

  return (
    <div className="space-y-1.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            Weekly
          </span>
        </div>
        <span className="text-sm font-mono" style={{ color: 'var(--text-tertiary)' }}>
          {bucket.utilization}% · {formatCountdown(bucket.resets_at)}
        </span>
      </div>

      {/* Bar with reference lines */}
      <div
        className="relative w-full h-1 rounded-full"
        style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
      >
        {/* Fill */}
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all duration-500"
          style={{
            width: `${Math.min(bucket.utilization, 100)}%`,
            backgroundColor: color,
          }}
        />

        {pacing && pacing.hasSufficientData && (
          <>
            {/* Line A: Expected even-pace position */}
            <div
              className="absolute w-[2px] rounded-full"
              style={{
                left: `${Math.min(pacing.expectedPosition, 100)}%`,
                top: '-3px',
                height: 'calc(100% + 6px)',
                backgroundColor: 'rgba(255,255,255,0.35)',
              }}
              title={`Expected: ${pacing.expectedPosition.toFixed(0)}%`}
            />

            {/* Line B: Projected end-of-week at current daily rate */}
            {pacing.projectedAtEnd <= 120 && (
              <div
                className="absolute w-[2px] rounded-full"
                style={{
                  left: `${Math.min(pacing.projectedAtEnd, 100)}%`,
                  top: '-3px',
                  height: 'calc(100% + 6px)',
                  backgroundColor: pacing.projectedAtEnd > 95 ? '#ef4444' : 'rgba(250,215,90,0.5)',
                }}
                title={`Projected: ${pacing.projectedAtEnd.toFixed(0)}%`}
              />
            )}
          </>
        )}
      </div>

      {/* Pacing verdict */}
      {pacing && pacing.hasSufficientData && (
        <div className="flex items-center gap-1.5 text-xs">
          <span style={{ color: getPacingColor(pacing.pacingDelta) }}>
            {getPacingIcon(pacing.pacingDelta)} {getPacingLabel(pacing.pacingDelta)}
          </span>
          <span style={{ color: 'var(--text-tertiary)' }}>
            — {Math.abs(pacing.pacingDelta).toFixed(0)}% {pacing.pacingDelta <= 0 ? 'under' : 'over'} expected
          </span>
        </div>
      )}
    </div>
  );
}

// ── Main Panel ─────────────────────────────────────────────

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
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
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
        <div className="grid grid-cols-2 gap-4">
          <CompactUsageRow label="Session" bucket={data.five_hour} />
          <WeeklyPacingRow bucket={data.seven_day} />
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
