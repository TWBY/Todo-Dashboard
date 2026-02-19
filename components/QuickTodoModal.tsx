'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ScratchItem } from '@/lib/types';

const CATEGORY_CONFIG = {
  bug:      { label: 'Bug',      color: '#ef4444', icon: 'fa-bug' },
  task:     { label: 'Task',     color: '#3b82f6', icon: 'fa-circle-check' },
  note:     { label: 'Note',     color: '#a78bfa', icon: 'fa-note-sticky' },
  decision: { label: 'Decision', color: '#fbbf24', icon: 'fa-gavel' },
} as const;

export default function QuickTodoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ScratchItem[]>([]);
  const backdropRef = useRef<HTMLDivElement>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch('/api/scratch-pad');
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (open) fetchItems();
  }, [open, fetchItems]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const activeItems = items.filter(i => !i.done);

  if (!open) return null;

  return createPortal(
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => {
        if (e.target === backdropRef.current) onClose();
      }}
    >
      <div
        className="w-full flex flex-col"
        style={{
          maxWidth: 600,
          maxHeight: 'min(720px, 85vh)',
          backgroundColor: '#0a0a0a',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-large)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-list-check" style={{ color: 'var(--text-tertiary)', fontSize: '14px' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>待辦清單</span>
            {activeItems.length > 0 && (
              <span
                className="text-xs px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)' }}
              >
                {activeItems.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 flex items-center justify-center rounded cursor-pointer"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: '14px' }} />
          </button>
        </div>

        {/* Cards */}
        <div className="flex-1 overflow-y-auto p-4" style={{ minHeight: 0 }}>
          {activeItems.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 gap-3"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <i className="fa-solid fa-inbox" style={{ fontSize: '28px', opacity: 0.4 }} />
              <span className="text-sm">目前沒有待辦項目</span>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {activeItems.map((item) => {
                const cat = item.category ? CATEGORY_CONFIG[item.category] : null;
                return (
                  <div
                    key={item.id}
                    className="rounded-xl p-4"
                    style={{
                      backgroundColor: 'var(--background-secondary)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {cat && (
                          <span
                            className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: `${cat.color}18`,
                              color: cat.color,
                              border: `1px solid ${cat.color}33`,
                            }}
                          >
                            <i className={`fa-solid ${cat.icon}`} style={{ fontSize: '10px' }} />
                            {cat.label}
                          </span>
                        )}
                        {item.title && (
                          <span
                            className="text-sm font-medium truncate"
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {item.title}
                          </span>
                        )}
                      </div>
                      <span
                        className="text-xs flex-shrink-0"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {new Date(item.createdAt).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>

                    {/* Card content */}
                    <p
                      className="text-sm"
                      style={{
                        color: 'var(--text-secondary)',
                        lineHeight: 'var(--leading-body)',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {item.content}
                    </p>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
