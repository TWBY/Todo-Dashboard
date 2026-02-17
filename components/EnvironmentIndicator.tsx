'use client';

import { useEffect } from 'react';

export default function EnvironmentIndicator() {
  useEffect(() => {
    const portNum = parseInt(window.location.port) || 80;
    const isDev = portNum === 3000;
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

  // 不渲染任何視覺元素，只處理 title
  return null;
}
