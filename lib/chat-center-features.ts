// Chat Center — 功能目錄資料 & 移植清單生成

export type FeatureTier = 'core' | 'optional' | 'advanced'

export interface ChatFeature {
  id: string
  name: string
  label: string
  tier: FeatureTier
  icon: string
  description: string
  useCases: string[]
  dependencies: string[]
  files: string[]
  npmPackages?: string[]
  cssSnippets?: string[]
}

export const CHAT_FEATURES: ChatFeature[] = [
  {
    id: 'types',
    name: 'Type Definitions',
    label: '型別定義',
    tier: 'core',
    icon: 'fa-sharp fa-regular fa-code',
    description: '所有 Chat 系統的 TypeScript 型別定義，包含訊息、事件、Session、Todo、問答等資料結構。',
    useCases: ['任何使用 Chat 的專案都需要'],
    dependencies: [],
    files: ['lib/claude-chat-types.ts'],
  },
  {
    id: 'session-manager',
    name: 'Session Manager',
    label: 'SDK 會話管理',
    tier: 'core',
    icon: 'fa-sharp fa-regular fa-server',
    description: '與 Claude Agent SDK 的整合層，管理 query 實例、Plan 模式審核、AskUserQuestion 阻塞/放行。',
    useCases: ['Claude 對話的後端核心'],
    dependencies: ['types'],
    files: ['lib/claude-session-manager.ts'],
    npmPackages: ['@anthropic-ai/claude-agent-sdk'],
  },
  {
    id: 'streaming-api',
    name: 'Streaming API',
    label: '串流 API',
    tier: 'core',
    icon: 'fa-sharp fa-regular fa-bolt',
    description: '主要的 SSE 串流端點與 Plan/Question 回應端點，處理即時對話串流。',
    useCases: ['前後端即時通訊的基礎'],
    dependencies: ['session-manager'],
    files: [
      'app/api/claude-chat/route.ts',
      'app/api/claude-chat/answer/route.ts',
    ],
  },
  {
    id: 'chat-hook',
    name: 'Chat Hook',
    label: 'Chat Hook',
    tier: 'core',
    icon: 'fa-sharp fa-regular fa-link',
    description: '核心前端 Hook（~900 行），管理訊息狀態、SSE 串流解析、圖片上傳、Session 恢復、Plan 審核等。',
    useCases: ['前端對話邏輯的中樞'],
    dependencies: ['types', 'streaming-api'],
    files: ['hooks/useClaudeChat.ts'],
  },
  {
    id: 'chat-ui',
    name: 'Chat UI',
    label: '對話介面',
    tier: 'core',
    icon: 'fa-sharp fa-regular fa-message-lines',
    description: '完整的對話 UI（~1780 行），包含訊息渲染、輸入框、Slash 指令選單、模式/模型切換、Todo 進度、Plan 審核列。',
    useCases: ['視覺化對話體驗'],
    dependencies: ['chat-hook'],
    files: [
      'components/ChatContent.tsx',
      'components/ClaudeChatPanel.tsx',
    ],
    npmPackages: ['react-markdown', 'remark-gfm'],
    cssSnippets: [
      '.shimmer-text / .shimmer-dot（thinking 動畫）',
      '.streaming-word-reveal（FlowToken 淡入）',
      '.action-overlay-enter（Plan/Question 覆蓋層）',
      '.tool-crossfade / .streaming-status-text',
    ],
  },
  {
    id: 'panels-context',
    name: 'Multi-Panel Context',
    label: '多面板管理',
    tier: 'core',
    icon: 'fa-sharp fa-regular fa-columns-3',
    description: '全域 Context，管理多個 Chat 面板的開啟、關閉、複製，並持久化到 localStorage。',
    useCases: ['同時開多個對話面板', '面板狀態跨頁保持'],
    dependencies: ['types'],
    files: ['contexts/ChatPanelsContext.tsx'],
  },
  {
    id: 'streaming-reveal',
    name: 'FlowToken Animation',
    label: 'FlowToken 動畫',
    tier: 'optional',
    icon: 'fa-sharp fa-regular fa-wand-magic-sparkles',
    description: '逐字揭露的串流動畫，追蹤 text chunk diff 並賦予 CSS fade-in，串流結束後合併為單一 chunk。',
    useCases: ['提升串流回應的視覺質感', '類似 ChatGPT 的打字效果'],
    dependencies: ['chat-ui'],
    files: ['hooks/useStreamingReveal.ts'],
  },
  {
    id: 'chat-history',
    name: 'Session History',
    label: '歷史紀錄',
    tier: 'optional',
    icon: 'fa-sharp fa-regular fa-clock-rotate-left',
    description: '可折疊的歷史面板，按日期分群顯示過去的對話 Session，點擊即可恢復。含自動清理 30 天前紀錄。',
    useCases: ['回顧過去的對話', '接續之前的工作'],
    dependencies: ['chat-ui'],
    files: [
      'components/ChatHistory.tsx',
      'app/api/claude-chat/history/route.ts',
      'app/api/claude-chat/messages/route.ts',
    ],
  },
  {
    id: 'image-picker',
    name: 'Image Upload & Picker',
    label: '圖片上傳',
    tier: 'optional',
    icon: 'fa-sharp fa-regular fa-image',
    description: '從專案 public/ 資料夾選取或拖放上傳圖片到對話，支援多選與刪除。',
    useCases: ['需要讓 Claude 看截圖或設計稿', '視覺回饋迴路'],
    dependencies: ['chat-ui'],
    files: [
      'components/ProjectImagePicker.tsx',
      'app/api/claude-chat/upload/route.ts',
      'app/api/claude-chat/project-images/route.ts',
      'app/api/claude-chat/project-images/serve/route.ts',
    ],
  },
  {
    id: 'skills',
    name: 'Slash Commands',
    label: 'Slash 指令',
    tier: 'optional',
    icon: 'fa-sharp fa-regular fa-terminal',
    description: '讀取全域和專案級 SKILL.md 檔案，在輸入框提供 / 指令選單自動完成。',
    useCases: ['快速觸發預設工作流', '自訂指令擴展功能'],
    dependencies: ['chat-ui'],
    files: [
      'app/api/claude-chat/skills/route.ts',
      'app/api/claude-chat/skills/[name]/route.ts',
    ],
  },
  {
    id: 'team-monitor',
    name: 'Team Monitor',
    label: 'Team 監控面板',
    tier: 'advanced',
    icon: 'fa-sharp fa-regular fa-users-gear',
    description: '即時監控 Claude Agent SDK Team 的成員狀態、任務進度和訊息流，每 2 秒輪詢更新。',
    useCases: ['多 Agent 協作任務的監控', 'Team 工作流的可視化'],
    dependencies: ['panels-context'],
    files: [
      'components/TeamMonitorPanel.tsx',
      'hooks/useTeamMonitor.ts',
      'app/api/team-monitor/route.ts',
    ],
  },
]

// --- 移植清單生成 ---

export function generatePortingChecklist(selectedIds: Set<string>): string {
  const selected = CHAT_FEATURES.filter(f => selectedIds.has(f.id))
  const allFiles = selected.flatMap(f => f.files)
  const allPackages = [...new Set(selected.flatMap(f => f.npmPackages ?? []))]
  const allCss = selected.flatMap(f => f.cssSnippets ?? [])
  const now = new Date().toISOString().split('T')[0]

  const lines: string[] = []

  lines.push('# Chat System 移植清單')
  lines.push(`生成時間：${now}`)
  lines.push(`已選功能：${selected.map(f => f.label).join('、')}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  // npm install
  if (allPackages.length > 0) {
    lines.push('## 1. npm 安裝')
    lines.push('')
    lines.push('```bash')
    lines.push(`npm install ${allPackages.join(' ')}`)
    lines.push('```')
    lines.push('')
  }

  // 檔案清單（按功能分組）
  lines.push('## 2. 複製的檔案清單')
  lines.push('')
  for (const feature of selected) {
    lines.push(`### ${feature.label}（${feature.name}）`)
    for (const file of feature.files) {
      lines.push(`- \`${file}\``)
    }
    lines.push('')
  }

  // CSS
  if (allCss.length > 0) {
    lines.push('## 3. CSS 動畫（從 globals.css 複製）')
    lines.push('')
    for (const snippet of allCss) {
      lines.push(`- ${snippet}`)
    }
    lines.push('')
  }

  // Context Provider
  if (selectedIds.has('panels-context')) {
    lines.push('## 4. Layout 設定')
    lines.push('')
    lines.push('在你的 `Providers` 或 `app/layout.tsx` 中加入：')
    lines.push('')
    lines.push('```tsx')
    lines.push('<ChatPanelsProvider>')
    lines.push('  {children}')
    lines.push('</ChatPanelsProvider>')
    lines.push('```')
    lines.push('')
  }

  // 來源參考
  lines.push('## 來源專案')
  lines.push('')
  lines.push('```')
  lines.push('~/Documents/Brickverse/Todo-Dashboard')
  lines.push('```')
  lines.push('')
  lines.push(`共 ${allFiles.length} 個檔案，${allPackages.length} 個 npm 套件`)

  return lines.join('\n')
}
