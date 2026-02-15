'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { ScratchItem } from '@/lib/types';

export default function QuickTodoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [items, setItems] = useState<ScratchItem[]>([]);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
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
    if (open) {
      fetchItems();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, fetchItems]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const addItem = async () => {
    const text = inputValue.trim();
    if (!text) return;
    setInputValue('');
    try {
      const res = await fetch('/api/scratch-pad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const json = await res.json();
        setItems(prev => [json.data, ...prev]);
      }
    } catch { /* ignore */ }
    inputRef.current?.focus();
  };

  const deleteItem = async (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    try {
      await fetch('/api/scratch-pad', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch {
      fetchItems();
    }
  };

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
        className="quick-todo-modal w-full flex flex-col"
        style={{
          maxWidth: 560,
          maxHeight: 'min(640px, 80vh)',
          backgroundColor: '#0a0a0a',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-large)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.8)',
        }}
      >
        {/* Input */}
        <div className="px-4 py-3 flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) addItem();
            }}
            placeholder="輸入待辦事項，按 Enter 新增…"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: 'var(--background-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid transparent',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
          />
        </div>

        {/* Items list */}
        {activeItems.length > 0 && (
          <div
            className="flex-1 overflow-y-auto px-4 pb-3"
            style={{ minHeight: 0 }}
          >
            <ul className="space-y-1">
              {activeItems.map((item) => (
                <li
                  key={item.id}
                  className="group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors duration-150"
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: 'var(--text-tertiary)' }}
                  />
                  <p
                    className="flex-1 min-w-0 text-sm"
                    style={{ color: 'var(--text-primary)', lineHeight: 'var(--leading-body)' }}
                  >
                    {item.content}
                  </p>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-6 h-6 flex items-center justify-center rounded transition-all duration-150 cursor-pointer"
                    style={{ color: 'var(--text-tertiary)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <line x1="4" y1="4" x2="12" y2="12" />
                      <line x1="12" y1="4" x2="4" y2="12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
