'use client';

import { useDevServer } from '@/contexts/DevServerContext';

export default function ProductionMonitor() {
  const { systemCpu } = useDevServer();

  if (systemCpu === null) return null;

  const cpuPercent = systemCpu;

  const barColor = cpuPercent >= 80 ? '#ef4444' : cpuPercent >= 50 ? '#fb923c' : '#818cf8';
  const dotColor = cpuPercent >= 50 ? '#fb923c' : '#818cf8';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: dotColor }}
          />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>
            CPU
          </span>
        </div>
        <span className="text-sm font-mono" style={{ color: 'var(--text-tertiary)' }}>
          {cpuPercent.toFixed(1)}%
        </span>
      </div>
      <div
        className="w-full h-1 rounded-full overflow-hidden"
        style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${Math.min(cpuPercent, 100)}%`,
            backgroundColor: barColor,
          }}
        />
      </div>
    </div>
  );
}
