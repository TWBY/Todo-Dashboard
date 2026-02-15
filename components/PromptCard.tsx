'use client';

import { useState } from 'react';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';

interface PromptCardProps {
  title: string;
  description: string;
  prompt: string;
}

export default function PromptCard({ title, description, prompt }: PromptCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { copy, isCopied } = useCopyToClipboard(1000);
  const copied = isCopied(prompt);

  return (
    <div
      className=""
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 hover:shadow-md hover:scale-[1.02]"
            style={{
              backgroundColor: 'var(--background-tertiary)',
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-light)',
              border: '1px solid var(--border-color)',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.3s ease',
              }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          <button
            onClick={() => copy(prompt)}
            className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 hover:shadow-md hover:scale-[1.02]"
            style={{
              backgroundColor: copied ? '#15332a' : 'var(--background-tertiary)',
              color: copied ? '#10b981' : 'var(--text-primary)',
              boxShadow: 'var(--shadow-light)',
              border: copied ? '1px solid #1a4a3a' : '1px solid var(--border-color)',
            }}
          >
            {copied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
          </button>
        </div>
      </div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
        {description}
      </p>
      {isExpanded && (
        <div
          className="rounded-[var(--radius-medium)] p-4 text-xs font-mono leading-relaxed overflow-auto max-h-[280px]"
          style={{
            backgroundColor: 'var(--background-secondary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-color)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          {prompt}
        </div>
      )}
    </div>
  );
}
