'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

// ─── 類型定義 ───
interface TooltipInfo {
  name: string;
  x: number;
  y: number;
}

// ─── 工具函式：取得元素名稱 ───
function getElementLabel(el: Element): string {
  const dataComponent = el.getAttribute('data-component');
  if (dataComponent) return dataComponent;

  const tag = el.tagName.toLowerCase();
  const classes = Array.from(el.classList)
    .filter(c =>
      !c.match(/^(flex|grid|p|m|w|h|text|bg|border|rounded|items|justify|gap|space|overflow|z|fixed|absolute|relative|hidden|block|inline|opacity|cursor|transition|duration|ease|hover|focus|group|min|max|col|row|top|right|bottom|left|translate|scale|rotate|shadow|font|leading|tracking|truncate|whitespace|pointer|select|ring|outline|divide|sr|animate|fill|stroke)[:-]/)
    )
    .slice(0, 2)
    .join('.');

  return classes ? `${tag}.${classes}` : tag;
}

// ─── 工具函式：取得完整 DOM 路徑 ───
function getElementPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;
  let depth = 0;

  while (current && depth < 6) {
    const label = getElementLabel(current);
    parts.unshift(label);
    current = current.parentElement;
    depth++;
  }

  return parts.join(' > ');
}

// ─── 工具函式：從 DOM 反查最近的 React 元件名 ───
function getReactComponentName(el: Element): string | null {
  const fiberKey = Object.keys(el).find(k =>
    k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
  );
  if (!fiberKey) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current = (el as any)[fiberKey];
  while (current) {
    const type = current.elementType || current.type;
    if (typeof type === 'function' && type.name) return type.name;
    if (type?.displayName) return type.displayName;
    current = current.return;
  }
  return null;
}

// ─── 工具函式：取得完整 React 元件層級鏈（所有元件，直到主要頁面元件） ───
function getFullReactComponentChain(el: Element): { chain: string; allNames: string[] } {
  const fiberKey = Object.keys(el).find(k =>
    k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')
  );
  if (!fiberKey) return { chain: '', allNames: [] };

  const names: string[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current = (el as any)[fiberKey];
  while (current && names.length < 20) {
    const type = current.elementType || current.type;
    if (typeof type === 'function' && type.name) {
      const name = type.name;
      // 過濾掉 Next.js 內部和無意義的元件
      if (!name.startsWith('__') &&
          !['InnerLayoutRouter', 'OuterLayoutRouter', 'Router', 'Render', 'Fragment'].includes(name)) {
        names.push(name);
      }
    } else if (type?.displayName) {
      names.push(type.displayName);
    }
    current = current.return;
  }

  return { chain: names.reverse().join(' > '), allNames: names.reverse() };
}

// ─── 工具函式：取得完整的 Debug 資訊 ───
function getDebugInfo(el: Element): { component: string; info: string } {
  const componentName = getReactComponentName(el) || '(unknown)';
  const { chain: fullChain, allNames } = getFullReactComponentChain(el);

  // 取得 element 及其祖先的語意 classes
  const getSemanticClasses = (element: Element): string => {
    return Array.from(element.classList)
      .filter(c =>
        !c.match(/^(flex|grid|p|m|w|h|text|bg|border|rounded|items|justify|gap|space|overflow|z|fixed|absolute|relative|hidden|block|inline|opacity|cursor|transition|duration|ease|hover|focus|group|min|max|col|row|top|right|bottom|left|translate|scale|rotate|shadow|font|leading|tracking|truncate|whitespace|pointer|select|ring|outline|divide|sr|animate|fill|stroke)[:-]/)
      )
      .join(' ');
  };

  // 收集直接 element 和祖先的語意 classes
  const directClasses = getSemanticClasses(el);
  const parentClasses: string[] = [];
  let current: Element | null = el.parentElement;
  let parentDepth = 0;
  while (current && parentDepth < 3) {
    const classes = getSemanticClasses(current);
    if (classes) parentClasses.push(`  L${parentDepth + 1}: ${current.tagName.toLowerCase()}.${classes}`);
    current = current.parentElement;
    parentDepth++;
  }

  const path = getElementPath(el);
  const text = (el as HTMLElement).innerText?.trim().replace(/\n/g, ' ').slice(0, 120) || '';

  const parts = [
    `COMPONENT: ${componentName}`,
    fullChain ? `CHAIN: ${fullChain}` : '',
    `PATH: ${path}`,
    `TAG: ${el.tagName.toLowerCase()}`,
    directClasses ? `CLASSES: ${directClasses}` : '(no semantic classes)',
    parentClasses.length > 0 ? `PARENTS:\n${parentClasses.join('\n')}` : '',
    text ? `TEXT: ${text}` : '',
  ].filter(Boolean);

  return { component: componentName, info: parts.join('\n') };
}

// ─── 主 Hook ───
function useComponentDebug() {
  const [isDev, setIsDev] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [tooltipInfo, setTooltipInfo] = useState<TooltipInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredElRef = useRef<Element | null>(null);
  const lockedElRef = useRef<Element | null>(null);

  // 偵測是否為 Dev（port 3000）
  useEffect(() => {
    const port = parseInt(window.location.port) || 80;
    setIsDev(port === 3000);
  }, []);

  // 清除 outline
  const clearOutline = useCallback((el: Element | null) => {
    if (!el) return;
    (el as HTMLElement).style.outline = '';
    (el as HTMLElement).style.outlineOffset = '';
  }, []);

  // 設定 hover outline（藍色）
  const setHoverOutline = useCallback((el: Element) => {
    (el as HTMLElement).style.outline = '2px solid #58a6ff';
    (el as HTMLElement).style.outlineOffset = '-2px';
  }, []);

  // 設定 locked outline（橙色）
  const setLockedOutline = useCallback((el: Element) => {
    (el as HTMLElement).style.outline = '2px solid #f97316';
    (el as HTMLElement).style.outlineOffset = '-2px';
  }, []);

  // 綁定 mousemove
  useEffect(() => {
    if (!isActive) {
      setTooltipInfo(null);
      clearOutline(hoveredElRef.current);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target || target === document.body || target === document.documentElement) {
        setTooltipInfo(null);
        clearOutline(hoveredElRef.current);
        hoveredElRef.current = null;
        return;
      }

      // 跳過 Debug Overlay 自身的元素
      if (target.closest('[data-debug-overlay]')) {
        setTooltipInfo(null);
        clearOutline(hoveredElRef.current);
        hoveredElRef.current = null;
        return;
      }

      // 如果不同於前一個 hover，清除前一個的藍框
      if (hoveredElRef.current && hoveredElRef.current !== target && hoveredElRef.current !== lockedElRef.current) {
        clearOutline(hoveredElRef.current);
      }

      // 設定新的 hover outline（除非是 locked）
      if (target !== lockedElRef.current) {
        setHoverOutline(target);
      }
      hoveredElRef.current = target;

      const { component } = getDebugInfo(target);
      setTooltipInfo({ name: component, x: e.clientX, y: e.clientY });
    };

    const handleMouseLeave = () => {
      setTooltipInfo(null);
      if (hoveredElRef.current && hoveredElRef.current !== lockedElRef.current) {
        clearOutline(hoveredElRef.current);
      }
      hoveredElRef.current = null;
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [isActive, clearOutline, setHoverOutline]);

  // 綁定 click（capture 模式，攔截所有點擊）
  useEffect(() => {
    if (!isActive) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target || target.closest('[data-debug-overlay]')) return;

      // 攔截原本的點擊事件
      e.preventDefault();
      e.stopPropagation();

      // 清除前一個 locked element 的 outline
      if (lockedElRef.current && lockedElRef.current !== target) {
        clearOutline(lockedElRef.current);
      }

      // 設定新的 locked element
      lockedElRef.current = target;
      setLockedOutline(target);

      // 複製完整 Debug 資訊
      const { info } = getDebugInfo(target);
      copyInfo(info);
    };

    // capture: true 確保在任何 React onClick 之前攔截
    document.addEventListener('click', handleClick, { capture: true });
    return () => {
      document.removeEventListener('click', handleClick, { capture: true });
    };
  }, [isActive, clearOutline, setLockedOutline]);

  // 複製到剪貼簿
  const copyInfo = useCallback((info: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = info;
      textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);

      setCopied(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }, []);

  // 關閉 debug 時清除所有 outline
  useEffect(() => {
    if (isActive) return;

    clearOutline(hoveredElRef.current);
    clearOutline(lockedElRef.current);
    hoveredElRef.current = null;
    lockedElRef.current = null;
  }, [isActive, clearOutline]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  return { isDev, isActive, setIsActive, tooltipInfo, copied };
}

// ─── Tooltip 子元件 ───
function DebugTooltip({
  info,
  copied,
}: {
  info: TooltipInfo;
  copied: boolean;
}) {
  const OFFSET = 16; // px，距離滑鼠的距離

  // 防止 tooltip 超出視窗右邊緣
  const tooltipWidth = 280;
  const x = Math.min(info.x + OFFSET, window.innerWidth - tooltipWidth - 8);
  const y = info.y + OFFSET;

  return (
    <div
      data-debug-overlay
      className="fixed pointer-events-auto select-none"
      style={{
        left: x,
        top: y,
        zIndex: 9999,
        maxWidth: tooltipWidth,
      }}
    >
      <div
        style={{
          backgroundColor: '#0d1117',
          border: '1px solid #1f3a5f',
          borderRadius: 8,
          boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
          padding: '6px 10px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        }}
      >
        {/* 元件名稱 */}
        <div
          style={{
            fontSize: '0.8rem',
            color: '#58a6ff',
            fontWeight: 600,
            lineHeight: 1.4,
            wordBreak: 'break-all',
          }}
        >
          {info.name}
        </div>

        {/* 點擊複製提示 */}
        <div
          style={{
            fontSize: '0.65rem',
            color: copied ? '#22c55e' : '#4a6580',
            marginTop: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {copied ? (
            <>
              <i className="fa-solid fa-check" />
              Copied!
            </>
          ) : (
            <>
              <i className="fa-regular fa-copy" />
              Click to copy
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Toggle 按鈕 ───
function ToggleButton({
  isActive,
  onToggle,
}: {
  isActive: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      data-debug-overlay
      onClick={onToggle}
      className="fixed bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
      style={{
        zIndex: 9998,
        backgroundColor: isActive ? '#1f3a5f' : '#0d1117',
        border: `1px solid ${isActive ? '#58a6ff' : '#2a3f5a'}`,
        color: isActive ? '#58a6ff' : '#4a6580',
        fontSize: '0.75rem',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontWeight: 600,
        boxShadow: isActive
          ? '0 0 12px rgba(88,166,255,0.25), 0 4px 12px rgba(0,0,0,0.6)'
          : '0 4px 12px rgba(0,0,0,0.6)',
        cursor: 'pointer',
        letterSpacing: '0.04em',
      }}
      title={isActive ? '關閉元件偵測' : '開啟元件偵測 (Hover 任意元素)'}
    >
      <i
        className="fa-solid fa-crosshairs"
        style={{ fontSize: '0.7rem' }}
      />
      <span>
        {isActive ? 'Debug ON' : 'Debug'}
      </span>
      {isActive && (
        <span
          className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
          style={{ backgroundColor: '#58a6ff' }}
        />
      )}
    </button>
  );
}

// ─── 主元件 ───
export default function ComponentDebugOverlay() {
  const { isDev, isActive, setIsActive, tooltipInfo, copied } = useComponentDebug();
  const [mounted, setMounted] = useState(false);

  // 等 client-side mount 後才渲染（避免 SSR mismatch）
  useEffect(() => {
    setMounted(true);
  }, []);

  // 非 Dev 環境、或尚未 mount 則不渲染任何東西
  if (!isDev || !mounted) return null;

  return createPortal(
    <>
      {/* Toggle 按鈕 */}
      <ToggleButton isActive={isActive} onToggle={() => setIsActive(v => !v)} />

      {/* Tooltip：isActive 且有 hover 目標才顯示 */}
      {isActive && tooltipInfo && (
        <div
          data-debug-overlay
          className="fixed inset-0 pointer-events-none"
          style={{ zIndex: 9997 }}
        >
          <DebugTooltip
            info={tooltipInfo}
            copied={copied}
          />
        </div>
      )}
    </>,
    document.body
  );
}
