'use client';

import PromptCard from './PromptCard';

const DESIGN_SYSTEM_PROMPT = `請參照 Brickverse Design System 作為此專案的設計規範基底。

【設計系統路徑】/Users/ruanbaiye/Documents/Brickverse/brickverse-design

【使用方式】
1. 先讀取 CLAUDE.md（在設計系統根目錄），了解整體規範概覽
2. 根據你目前的開發需求，進入對應的 Token 檔案讀取詳細定義：
   - 字型相關（字級、行高、字距、字重、組合樣式）→ src/tokens/typography.ts
   - 顏色 → src/tokens/colors.ts
   - 間距 → src/tokens/spacing.ts
   - 陰影 → src/tokens/shadows.ts
   - 動畫 → src/tokens/animation.ts
3. 如需了解 CSS 變數定義與 Tailwind v4 的 @theme 設定 → src/app/globals.css
4. 如需參考元件的實際寫法 → src/components/ui/

【核心原則】
- 語系：繁體中文（zh-TW）為主，所有 Token 針對 CJK 排版優化
- 平台：Web（含 RWD），非原生 App
- 字型：Noto Sans TC
- 技術棧：Next.js + Tailwind CSS v4 + TypeScript

以上檔案是 Single Source of Truth，請直接從檔案中讀取最新的數值與規則，不要依賴記憶中的舊版數值。`;

export default function DesignSystemPrompt() {
  return (
    <PromptCard
      title="Design System Prompt"
      description="在其他 AI 對話中貼上此 Prompt，即可讓 AI 遵循 Brickverse Design System 規範。"
      prompt={DESIGN_SYSTEM_PROMPT}
    />
  );
}
