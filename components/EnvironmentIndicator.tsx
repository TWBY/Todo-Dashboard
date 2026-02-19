'use client';

import { useEffect, useState } from 'react';

export default function EnvironmentIndicator() {
  const [isDev, setIsDev] = useState<boolean | null>(null);
  const [version, setVersion] = useState<string>('1.18.0');

  useEffect(() => {
    // ?bot=1 時由 BotModeIndicator 負責設定 title，此元件跳過
    const params = new URLSearchParams(window.location.search);
    if (params.get('bot') === '1' || params.get('bot') === 'true') {
      setIsDev(parseInt(window.location.port) === 3002);
      return;
    }

    const portNum = parseInt(window.location.port) || 80;
    const isDevEnv = portNum === 3002;
    setIsDev(isDevEnv);

    const prefix = isDevEnv ? '[DEV] ' : '[PROD] ';

    const applyPrefix = () => {
      if (!document.title.startsWith('[')) {
        document.title = prefix + document.title;
      }
    };
    applyPrefix();

    const observer = new MutationObserver(() => applyPrefix());
    observer.observe(document.head, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // 讀取版本號
  useEffect(() => {
    fetch('/api/version')
      .then(res => res.json())
      .then(data => {
        const ver = isDev ? data.development : data.production;
        if (ver) setVersion(ver);
      })
      .catch(() => {
        // 如果 API 失敗，使用 package.json 的預設版本
        setVersion('1.18.0');
      });
  }, [isDev]);

  if (isDev === null) return null;

  // bot 模式下由 BotModeIndicator 渲染色條，此元件不渲染
  const isBot = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('bot') === '1'
    : false;
  if (isBot) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-2 z-50"
      style={{
        backgroundColor: isDev ? '#ef4444' : '#3b82f6',
        boxShadow: isDev
          ? '0 4px 12px rgba(239,68,68,0.4)'
          : '0 4px 12px rgba(59,130,246,0.4)',
      }}
    />
  );
}
