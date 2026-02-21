'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useChatPanels } from '@/contexts/ChatPanelsContext';
import { useTodoPanel } from '@/contexts/TodoPanelContext';
import type { ScratchItem } from '@/lib/types';

const CATEGORY_CONFIG = {
  bug:      { label: 'Bug',      color: '#ef4444', icon: 'fa-bug' },
  task:     { label: 'Task',     color: '#3b82f6', icon: 'fa-circle-check' },
  note:     { label: 'Note',     color: '#a78bfa', icon: 'fa-note-sticky' },
  decision: { label: 'Decision', color: '#fbbf24', icon: 'fa-gavel' },
} as const;

const CATEGORY_ORDER: Array<ScratchItem['category']> = ['bug', 'task', 'decision', 'note'];

const FALLBACK_PROJECT_ID = 'dashboard';
const FALLBACK_PROJECT_NAME = 'Todo-Dashboard';

function buildInitialMessage(item: ScratchItem): string {
  const parts: string[] = [];
  const titleLine = item.title || item.content.slice(0, 60);
  parts.push(`以下是一個開發中遇到的待辦問題，請幫我研究並解決：\n\n**${titleLine}**`);
  if (item.content) parts.push(item.content);
  if (item.plan) parts.push(`---\n**先前的調查筆記：**\n${item.plan}`);
  return parts.join('\n\n');
}

function TodoItem({
  item,
  onDone,
  onStartAI,
}: {
  item: ScratchItem;
  onDone: (id: string) => void;
  onStartAI: (item: ScratchItem, mode: 'plan' | 'edit') => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const cat = item.category ? CATEGORY_CONFIG[item.category] : null;

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <div className="px-3 py-3 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}>
      {/* Meta row: category, title, project, date */}
      <div className="flex items-center gap-3 flex-wrap mb-2">
        {cat ? (
          <span
            className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded flex-shrink-0"
            style={{
              backgroundColor: `${cat.color}18`,
              color: cat.color,
              border: `1px solid ${cat.color}28`,
              minWidth: '52px',
              justifyContent: 'center',
            }}
          >
            <i className={`fa-solid ${cat.icon}`} style={{ fontSize: '9px' }} />
            {cat.label}
          </span>
        ) : null}
        {item.title ? (
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {item.title}
          </span>
        ) : null}
        {item.projectName && (
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-tertiary)' }}>
            {item.projectName}
          </span>
        )}
        <span
          className="text-xs flex-shrink-0 ml-auto"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {new Date(item.createdAt).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
        </span>
      </div>

      {/* Full content — always visible */}
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

      {/* Plan / investigation notes — always visible if present */}
      {item.plan && (
        <div
          className="mt-3 px-3 py-2.5 rounded-lg text-sm"
          style={{
            backgroundColor: 'rgba(168,85,247,0.06)',
            border: '1px solid rgba(168,85,247,0.15)',
            color: 'var(--text-tertiary)',
            lineHeight: 'var(--leading-body)',
            whiteSpace: 'pre-wrap',
          }}
        >
          <div className="flex items-center gap-1.5 mb-1.5" style={{ color: '#a78bfa' }}>
            <i className="fa-solid fa-note-sticky" style={{ fontSize: '10px' }} />
            <span className="text-xs font-medium">調查筆記</span>
          </div>
          {item.plan}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 mt-3">
        <button
          onClick={() => onDone(item.id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors duration-150"
          style={{
            backgroundColor: 'rgba(255,255,255,0.06)',
            color: 'var(--text-tertiary)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(74,222,128,0.15)';
            e.currentTarget.style.color = '#4ade80';
            e.currentTarget.style.borderColor = 'rgba(74,222,128,0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
            e.currentTarget.style.color = 'var(--text-tertiary)';
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
          }}
        >
          <i className="fa-solid fa-check" style={{ fontSize: '10px' }} />
          完成
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer transition-colors duration-150"
            style={{
              backgroundColor: 'rgba(59,130,246,0.12)',
              color: '#60a5fa',
              border: '1px solid rgba(59,130,246,0.25)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(59,130,246,0.12)'; }}
          >
            AI 開工
            <i className="fa-solid fa-caret-up" style={{ fontSize: '9px', marginLeft: '2px' }} />
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 bottom-full mb-1 rounded-lg overflow-hidden z-10"
              style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid var(--border-color)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                minWidth: '140px',
              }}
            >
              <button
                onClick={() => { setMenuOpen(false); onStartAI(item, 'plan'); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs cursor-pointer transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <i className="fa-solid fa-compass" style={{ fontSize: '10px', color: '#a78bfa', width: '14px', textAlign: 'center' }} />
                Plan 模式
              </button>
              <button
                onClick={() => { setMenuOpen(false); onStartAI(item, 'edit'); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs cursor-pointer transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <i className="fa-solid fa-pen" style={{ fontSize: '10px', color: '#34d399', width: '14px', textAlign: 'center' }} />
                Edit 模式
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TodoPanel() {
  const { addPanel } = useChatPanels();
  const { open, close } = useTodoPanel();
  const [items, setItems] = useState<ScratchItem[]>([]);

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

  const activeItems = items.filter(i => !i.done);

  const filteredItems = activeItems;

  // Group by category, in priority order; uncategorised at end
  const grouped = CATEGORY_ORDER.reduce<Array<{ key: string; label: string; color: string; items: ScratchItem[] }>>((acc, cat) => {
    const catItems = filteredItems.filter(i => i.category === cat);
    if (catItems.length === 0) return acc;
    const cfg = CATEGORY_CONFIG[cat!];
    acc.push({ key: cat!, label: cfg.label, color: cfg.color, items: catItems });
    return acc;
  }, []);
  const uncategorised = filteredItems.filter(i => !i.category);
  if (uncategorised.length > 0) {
    grouped.push({ key: 'none', label: '其他', color: 'var(--text-tertiary)', items: uncategorised });
  }

  const handleDone = useCallback(async (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, done: true } : i));
    try {
      await fetch('/api/scratch-pad', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, done: true }),
      });
    } catch { /* ignore */ }
  }, []);

  const handleStartAI = useCallback((item: ScratchItem, mode: 'plan' | 'edit') => {
    addPanel(item.projectId || FALLBACK_PROJECT_ID, item.projectName || FALLBACK_PROJECT_NAME, {
      scratchItemId: item.id,
      initialMessage: buildInitialMessage(item),
      initialMode: mode,
    });
    close();
  }, [addPanel, close]);

  return (
    <div
      className="h-full flex flex-col min-w-0"
      style={{ padding: '8px 24px' }}
    >
      <div className="flex-1 overflow-y-auto py-4" style={{ minHeight: 0 }}>
        {filteredItems.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-24 gap-3"
            style={{ color: 'var(--text-tertiary)' }}
          >
            <i className="fa-solid fa-inbox" style={{ fontSize: '32px', opacity: 0.4 }} />
            <span className="text-base">
              {activeItems.length === 0 ? '目前沒有待辦項目' : '此專案沒有待辦項目'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col" style={{ maxWidth: '720px' }}>
            {grouped.map((group, gi) => (
              <div key={group.key} className={gi > 0 ? 'mt-5' : ''}>
                {/* Category group header */}
                <div
                  className="flex items-center gap-2 mb-1 px-1"
                >
                  <span
                    className="text-xs font-medium uppercase tracking-wide"
                    style={{ color: group.color, opacity: 0.7 }}
                  >
                    {group.label}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    {group.items.length}
                  </span>
                </div>

                {/* Rows */}
                <div className="flex flex-col gap-3">
                  {group.items.map(item => (
                    <TodoItem
                      key={item.id}
                      item={item}
                      onDone={handleDone}
                      onStartAI={handleStartAI}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
