'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

export function useCopyToClipboard(timeout = 2000) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const markCopied = useCallback((text: string) => {
    setCopiedValue(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setCopiedValue(null), timeout);
  }, [timeout]);

  // 同步複製：使用 execCommand('copy') 確保剪貼簿立即寫入
  // （navigator.clipboard.write 是 async，OS 剪貼簿可能尚未同步就被使用者貼上）
  const copy = useCallback((text: string) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.left = '-9999px';
      textarea.style.top = '-9999px';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      markCopied(text);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      return false;
    }
  }, [markCopied]);

  // 複製 rich text（同時寫入 text/html + text/plain），貼到 Gmail 等郵件客戶端會保留格式
  const copyRichText = useCallback((markdown: string) => {
    try {
      const html = markdownToHtml(markdown);

      // 建立隱藏容器，放入 HTML 內容
      const container = document.createElement('div');
      container.innerHTML = html;
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '-9999px';
      container.style.opacity = '0';
      document.body.appendChild(container);

      // 選取容器內容
      const range = document.createRange();
      range.selectNodeContents(container);
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
        selection.addRange(range);
      }

      // 同步複製（包含 text/html + text/plain）
      document.execCommand('copy');

      // 清理
      if (selection) selection.removeAllRanges();
      document.body.removeChild(container);

      markCopied(markdown);
      return true;
    } catch (err) {
      console.error('Failed to copy rich text:', err);
      // fallback to plain text
      return copy(markdown);
    }
  }, [markCopied, copy]);

  const isCopied = useCallback((value: string) => copiedValue === value, [copiedValue]);

  return { copy, copyRichText, copiedValue, isCopied };
}

// 輕量 Markdown → HTML 轉換（支援 Email 常用格式）
function markdownToHtml(md: string): string {
  let html = md
    // 水平線
    .replace(/^---$/gm, '<hr>')
    // 標題 h4 → h3 → h2 → h1（先匹配多 # 的）
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // 粗體
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // 連結
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  // 列點：連續的 * 或 - 開頭行轉成 <ul><li>
  html = html.replace(/(?:^[*\-] .+$\n?)+/gm, (block) => {
    const items = block.trim().split('\n').map(line =>
      `<li>${line.replace(/^[*\-] /, '')}</li>`
    ).join('')
    return `<ul>${items}</ul>`
  })

  // 段落：非標籤行用 <p> 包裝
  html = html.split('\n').map(line => {
    const trimmed = line.trim()
    if (!trimmed) return ''
    if (/^<(h[1-4]|ul|li|hr|p|div|ol|blockquote)/.test(trimmed)) return trimmed
    return `<p>${trimmed}</p>`
  }).join('\n')

  return html
}
