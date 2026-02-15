'use client';

import { useEffect, useState } from 'react';

interface EnvInfo {
  label: string;
  port: string;
  color: string;
}

export default function EnvironmentIndicator() {
  const [env, setEnv] = useState<EnvInfo | null>(null);

  useEffect(() => {
    const port = window.location.port || '80';
    const isDev = port === '3000';

    const info: EnvInfo = {
      label: isDev ? 'DEV' : 'PROD',
      port,
      color: isDev ? '#ef4444' : '#10b981',
    };

    setEnv(info);

    // 更新瀏覽器分頁標題（用 MutationObserver 確保 Next.js metadata 不會蓋掉）
    const prefix = isDev ? '[DEV] ' : '[PROD] ';
    const applyPrefix = () => {
      if (!document.title.startsWith('[')) {
        document.title = prefix + document.title;
      }
    };
    applyPrefix();

    const observer = new MutationObserver(() => applyPrefix());
    const titleEl = document.querySelector('title');
    if (titleEl) {
      observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    }
    return () => observer.disconnect();
  }, []);

  if (!env) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 h-[3px] z-[9999]"
      style={{ backgroundColor: env.color }}
    />
  );
}
