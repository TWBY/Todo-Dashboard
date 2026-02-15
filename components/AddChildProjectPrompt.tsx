'use client';

import PromptCard from './PromptCard';

const ADD_CHILD_PROJECT_PROMPT = `我需要在 Brickverse Todo-Dashboard 中的某個現有專案底下新增一個子資料夾（child project）。

請依照以下步驟操作：

【步驟一：建立實體資料夾】
在父專案的 path 底下用 mkdir 建立新的子資料夾。

範例：如果父專案 path 是 /Users/ruanbaiye/Documents/Brickverse/CourseFiles/AICode101，
要新增名為 MyNewProject 的子資料夾：
  mkdir /Users/ruanbaiye/Documents/Brickverse/CourseFiles/AICode101/MyNewProject

【步驟二：更新 Dashboard JSON 資料】
Todo-Dashboard 專案位於 /Users/ruanbaiye/Documents/Brickverse/Todo-Dashboard，
專案資料分散在三個 JSON 檔中，根據父專案所在的分類編輯對應檔案：

  - Brickverse 產品 → data/projects.json
  - 課程教材 → data/coursefiles.json
  - 工具類 → data/utility-tools.json

在該父專案的 children 陣列中新增一筆：
{
  "name": "資料夾名稱（需與步驟一建立的資料夾名稱完全一致）",
  "description": "簡短描述這個子專案的用途"
}

如果父專案還沒有 children 欄位，就新增一個 children 陣列。

同時更新父專案的 updatedAt 為當前 ISO 時間戳。

【完整範例】
假設要在 AICode101（coursefiles.json）底下新增 HomeworkSystem：

1. mkdir /Users/ruanbaiye/Documents/Brickverse/CourseFiles/AICode101/HomeworkSystem

2. 編輯 /Users/ruanbaiye/Documents/Brickverse/Todo-Dashboard/data/coursefiles.json，
   找到 id 為 "aicode101" 的物件，在 children 陣列中加入：
   {
     "name": "HomeworkSystem",
     "description": "作業繳交與批改系統"
   }

【注意事項】
- name 必須與實際資料夾名稱完全一致（大小寫敏感）
- 不需要設定 devPort，之後可以透過 Dashboard UI 的 "+" 按鈕加入 Dev Server
- 如果子專案需要特殊的 devCommand 或 devBasePath，可以一併加入
- JSON 編輯後請確認格式正確（有效的 JSON）`;

export default function AddChildProjectPrompt() {
  return (
    <PromptCard
      title="新增子專案 Prompt"
      description="在其他 AI 對話中貼上此 Prompt，即可讓 AI 幫你在現有專案底下新增子資料夾並更新 Dashboard 資料。"
      prompt={ADD_CHILD_PROJECT_PROMPT}
    />
  );
}
