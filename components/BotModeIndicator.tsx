'use client';

import { useEffect, useState } from 'react';

/**
 * BotModeIndicator — 機器分頁識別元件
 *
 * 當 URL 包含 ?bot=1 時，此元件會：
 * 1. 將 document.title 設為 [BOT] 前綴（覆蓋 EnvironmentIndicator 的設定）
 * 2. 顯示灰色頂部色條（取代紅/藍色條）
 *
 * 目的：讓 AI（Claude）可透過 browser_tabs list 掃描 titles，
 * 找到 [BOT] 分頁並重用，避免重複開分頁。
 * 也讓用戶視覺上區分「機器操控的分頁」與「自己的分頁」。
 */
export default function BotModeIndicator() {
  const [isBotMode, setIsBotMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const isBot = params.get('bot') === '1' || params.get('bot') === 'true';
    setIsBotMode(isBot);

    if (!isBot) return;

    // 設定 [BOT] title
    const applyBotTitle = () => {
      // 移除既有的 [DEV] / [PROD] 前綴，再加上 [BOT]
      const currentTitle = document.title
        .replace(/^\[(DEV|PROD|BOT)\] /, '');
      document.title = '[BOT] ' + currentTitle;
    };

    applyBotTitle();

    // 監聽 title 變化，確保 [BOT] 前綴持續存在
    const observer = new MutationObserver(() => applyBotTitle());
    observer.observe(document.head, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!isBotMode) return null;

  return (
    <>
      {/* 灰色頂部色條（覆蓋 EnvironmentIndicator 的紅/藍色條） */}
      <div
        className="fixed top-0 left-0 right-0 h-2 z-[60]"
        style={{
          backgroundColor: '#6b7280',
          boxShadow: '0 4px 12px rgba(107,114,128,0.4)',
        }}
      />
      {/* 機器運作提示條 */}
      <div
        className="fixed top-2 left-0 right-0 z-[59] flex items-center justify-center"
        style={{
          backgroundColor: 'rgba(107,114,128,0.12)',
          borderBottom: '1px solid rgba(107,114,128,0.2)',
          height: '22px',
          fontSize: '11px',
          color: '#9ca3af',
          fontFamily: 'monospace',
          letterSpacing: '0.05em',
        }}
      >
        <i className="fa-solid fa-robot mr-1.5" style={{ fontSize: '10px' }} />
        BOT — 機器運作中，請勿操控此分頁
      </div>
    </>
  );
}
