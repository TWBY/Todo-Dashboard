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

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedValue(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopiedValue(null), timeout);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      return false;
    }
  }, [timeout]);

  // 複製 rich text（同時寫入 text/html + text/plain），貼到 Gmail 等郵件客戶端會保留格式
  const copyRichText = useCallback(async (markdown: string) => {
    try {
      const html = markdownToHtml(markdown);
      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([markdown], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blobHtml,
          'text/plain': blobText,
        }),
      ]);
      // 補寫 writeText 確保 text/plain 層同步（修復 Dia/Chromium paste bug）
      await navigator.clipboard.writeText(markdown);
      setCopiedValue(markdown);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopiedValue(null), timeout);
      return true;
    } catch (err) {
      console.error('Failed to copy rich text:', err);
      // fallback to plain text
      return copy(markdown);
    }
  }, [timeout, copy]);

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
