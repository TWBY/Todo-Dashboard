'use client';

import PromptCard from './PromptCard';

const BLOG_CMS_PROMPT = `請參照 Brickverse Blog CMS（BlogBackend）作為此專案的部落格後台參照。

【專案路徑】/Users/ruanbaiye/Documents/Brickverse/BlogBackend

【使用方式】
1. 先讀取 CLAUDE.md（在專案根目錄），了解架構、資料模型與 API 規則
2. 根據需求進入對應檔案：
   - API 操作（CRUD、圖片上傳）→ lib/api.ts
   - 資料型別 → lib/types.ts
   - 分類與狀態常數 → lib/constants.ts
   - 元件寫法參考 → components/
   - 設計規範（顏色、字級、Hover）→ Rule/
3. 特別注意 Insforge API 路徑格式（不是 Supabase），詳見 CLAUDE.md 中的「Insforge API 規則」

【核心原則】
- 後端：Insforge（非 Supabase），API 路徑為 /api/database/records/{table}
- 內容格式：Markdown（用 marked.js 渲染）
- 語系：繁體中文（zh-TW）
- 技術棧：Next.js 16 + Tailwind CSS v4 + TypeScript

以上檔案是 Single Source of Truth，請直接從檔案中讀取最新值，不要依賴記憶中的舊版數值。`;

export default function BlogCmsPrompt() {
  return (
    <PromptCard
      title="Blog CMS Prompt"
      description="在其他 AI 對話中貼上此 Prompt，即可讓 AI 了解 BlogBackend 的架構與 API 規則。"
      prompt={BLOG_CMS_PROMPT}
    />
  );
}
