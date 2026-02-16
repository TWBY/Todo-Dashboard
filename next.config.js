const { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } = require('next/constants');

/** @type {(phase: string) => import('next').NextConfig} */
module.exports = (phase) => {
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    // Production build & start 使用獨立目錄，避免與 dev server 的 .next/ 衝突
    // （dev server 監聯 .next/ 變更，build 寫入會觸發 full reload 導致 SSE 斷線）
    distDir: (phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER) ? '.next-prod' : '.next',
    outputFileTracingExcludes: {
      '*': ['./data/crash-reports/**'],
    },
    typescript: {
      tsconfigPath: './tsconfig.json',
    },
  };

  return nextConfig;
};
