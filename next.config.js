const { PHASE_PRODUCTION_BUILD } = require('next/constants');

/** @type {(phase: string) => import('next').NextConfig} */
module.exports = (phase) => {
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    // Production build 使用獨立目錄，避免與 dev server 的 .next/ 衝突
    // （dev server 監聽 .next/ 變更，build 寫入會觸發 full reload 導致 SSE 斷線）
    distDir: phase === PHASE_PRODUCTION_BUILD ? '.next-prod' : '.next',
  };

  return nextConfig;
};
