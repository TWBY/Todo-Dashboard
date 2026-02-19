'use client';

import { useState } from 'react';
import { useDevServer } from '@/contexts/DevServerContext';

const LEVEL_COLORS = {
  normal: { dot: '#22c55e', bar: '#22c55e' },
  warning: { dot: '#facc15', bar: '#facc15' },
  critical: { dot: '#ef4444', bar: '#ef4444' },
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
  const { systemMemory } = useDevServer();

  if (!systemMemory) return null;

  const colors = LEVEL_COLORS[systemMemory.pressureLevel];

  return (
    <div className="space-y-1.5">
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
    </div>
  );
}

