// Chat Center — 功能目錄資料 & 移植清單生成

export type FeatureTier = 'core' | 'standard' | 'optional' | 'advanced'

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
  // ─── Core（底盤）── 6 項 ───
  {
    id: 'types',
    name: 'Type Definitions',
    label: '型別定義',
    tier: 'core',
    icon: 'fa-regular fa-code',
    description: '所有 Chat 系統的 TypeScript 介面定義，包含 ChatMessage、ClaudeStreamEvent、TodoItem、UserQuestion、ChatMode、SessionMeta 等資料結構。',
    useCases: ['任何使用 Chat 的專案都需要'],
    dependencies: [],
    files: ['lib/claude-chat-types.ts'],
  },
  {
    id: 'session-manager',
    name: 'Session Manager',
    label: '會話管理器',
    tier: 'core',
    icon: 'fa-regular fa-server',
    description: 'Claude Agent SDK 整合層：query 工廠、canUseTool 阻塞機制（Plan 審批 + Question 放行）、toolStats 累計、Query Options 建構（model / effort / mode / resume）。',
    useCases: ['所有 Claude 對話的後端核心'],
    dependencies: ['types'],
    files: ['lib/claude-session-manager.ts'],
    npmPackages: ['@anthropic-ai/claude-agent-sdk'],
  },
  {
    id: 'streaming-api',
    name: 'Streaming API',
    label: '串流 API',
    tier: 'core',
    icon: 'fa-regular fa-bolt',
    description: '主要的 SSE 串流端點，處理 projectId 路徑解析、SDK message 轉發（system / assistant / result / stream_event）、client 斷線偵測。',
    useCases: ['前後端即時通訊的基礎'],
    dependencies: ['session-manager'],
    files: ['app/api/claude-chat/route.ts'],
  },
  {
    id: 'streaming-engine',
    name: 'Streaming Engine',
    label: '串流引擎',
    tier: 'core',
    icon: 'fa-regular fa-gauge-high',
    description: 'SSE 解析器與事件處理器：processStreamEvent（路由所有事件到 state 更新）、readSSEStream（逐行解析 + carry-over buffer）、extractToolDescription（per-tool 描述擷取）。',
    useCases: ['將原始 SSE 事件轉換為 React 狀態'],
    dependencies: ['types'],
    files: ['hooks/useClaudeChat.ts'],
  },
  {
    id: 'chat-hook',
    name: 'Chat Hook',
    label: 'Chat Hook 核心',
    tier: 'core',
    icon: 'fa-regular fa-link',
    description: '核心 React Hook：訊息狀態管理、sendMessage 編排器（圖片上傳 → SSE fetch → retry → 持久化）、stopStreaming、clearChat、錯誤處理與自動重試。',
    useCases: ['前端對話邏輯的中樞'],
    dependencies: ['types', 'streaming-engine', 'streaming-api'],
    files: ['hooks/useClaudeChat.ts'],
  },
  {
    id: 'chat-ui-core',
    name: 'Chat UI Core',
    label: '聊天介面核心',
    tier: 'core',
    icon: 'fa-regular fa-message-lines',
    description: '最小可執行的對話 UI 殼：訊息列表、textarea 輸入框、送出按鈕、自動捲動、串流計時器、錯誤顯示、FlowToken 逐字動畫、完成音效。',
    useCases: ['視覺化對話體驗的基底'],
    dependencies: ['chat-hook'],
    files: [
      'components/ChatContent.tsx',
      'components/ClaudeChatPanel.tsx',
      'hooks/useStreamingReveal.ts',
      'hooks/useCopyToClipboard.ts',
    ],
    cssSnippets: [
      '.shimmer-text / .shimmer-dot（thinking 動畫）',
      '.streaming-word-reveal（FlowToken 淡入）',
      '.streaming-status-text（串流狀態文字）',
      '.chat-clearing（清除對話過渡）',
    ],
  },

  // ─── Standard（標準配備）── 4 項 ───
  {
    id: 'interactive-decisions',
    name: 'Plan Approval & Questions',
    label: '互動決策',
    tier: 'standard',
    icon: 'fa-regular fa-check-double',
    description: 'Plan 審批列（Execute / Reject）+ Question 多選對話框 + answer API 端點 + hook 內 approvePlan / answerQuestion callbacks。跨 4 層的完整互動流程（session-manager canUseTool → answer API → hook → UI）。',
    useCases: ['Plan 模式的審批工作流', 'Claude 主動提問時的互動回應'],
    dependencies: ['session-manager', 'chat-hook', 'chat-ui-core'],
    files: ['app/api/claude-chat/answer/route.ts'],
    cssSnippets: ['.action-overlay-enter（Plan/Question 覆蓋層動畫）'],
  },
  {
    id: 'markdown-renderer',
    name: 'Markdown Renderer',
    label: 'Markdown 渲染',
    tier: 'standard',
    icon: 'fa-regular fa-file-lines',
    description: 'ReactMarkdown + remarkGfm 整合、自訂排版系統（MARKDOWN_PROSE）、程式碼區塊語言標籤 + 複製按鈕（CodeBlockWithCopy）、訊息複製按鈕（AssistantCopyButton）。',
    useCases: ['助理回覆的富文本渲染', '程式碼區塊的語法高亮與複製'],
    dependencies: ['chat-ui-core'],
    files: [],
    npmPackages: ['react-markdown', 'remark-gfm'],
  },
  {
    id: 'tool-display',
    name: 'Tool Display',
    label: '工具操作顯示',
    tier: 'standard',
    icon: 'fa-regular fa-screwdriver-wrench',
    description: 'ToolGroup（連續低階工具折疊為即時 log）、TodoList 進度（含 shimmer 動畫）、ToolMessageRenderer（Task / TeamCreate / TodoWrite / ExitPlanMode / Plan Write / 通用 JSON 的渲染分派）。',
    useCases: ['開發者信任：看到 Claude 在做什麼', 'TodoWrite 任務追蹤的視覺化'],
    dependencies: ['streaming-engine', 'chat-ui-core'],
    files: [],
    cssSnippets: ['.tool-crossfade（工具狀態文字切換）'],
  },
  {
    id: 'mode-model-switching',
    name: 'Mode & Model Switching',
    label: '模式與模型切換',
    tier: 'standard',
    icon: 'fa-regular fa-sliders',
    description: 'Plan / Edit 模式切換（P / E 按鈕）+ Haiku / Sonnet / Opus 模型切換（H / S / O）+ Effort 等級切換（L / M / H，僅 Opus）。',
    useCases: ['控制 Claude 的操作權限', '依任務切換模型與思考深度'],
    dependencies: ['chat-ui-core', 'session-manager'],
    files: [],
  },

  // ─── Optional（選配）── 3 項 ───
  {
    id: 'image-attachment',
    name: 'Image Attachment',
    label: '圖片附加',
    tier: 'optional',
    icon: 'fa-regular fa-image',
    description: '圖片拖放 + 剪貼簿貼上 + 預覽格線（最多 5 張）+ ProjectImagePicker（從專案 public/ 瀏覽選取）+ upload API + project-images API。',
    useCases: ['讓 Claude 看截圖或設計稿', '視覺回饋迴路'],
    dependencies: ['chat-hook', 'chat-ui-core'],
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
    label: '技能指令',
    tier: 'optional',
    icon: 'fa-regular fa-terminal',
    description: '/ 斜線指令選單：讀取全域和專案級 SKILL.md，在輸入框提供自動完成、鍵盤導航（Arrow / Enter / Escape）、自動解析 model 欄位。',
    useCases: ['快速觸發預設工作流', '自訂指令擴展功能'],
    dependencies: ['chat-ui-core', 'chat-hook'],
    files: [
      'app/api/claude-chat/skills/route.ts',
      'app/api/claude-chat/skills/[name]/route.ts',
    ],
  },
  {
    id: 'session-persistence',
    name: 'Session Persistence',
    label: '對話持久化',
    tier: 'optional',
    icon: 'fa-regular fa-clock-rotate-left',
    description: 'ChatHistory 折疊面板（按日期分群、點擊恢復）+ history / messages API（30 天自動清理）。已內建 ephemeral flag 控制：設為 true 則跳過所有持久化。',
    useCases: ['回顧過去的對話', '接續之前的工作'],
    dependencies: ['chat-hook', 'streaming-engine'],
    files: [
      'components/ChatHistory.tsx',
      'app/api/claude-chat/history/route.ts',
      'app/api/claude-chat/messages/route.ts',
    ],
  },

  // ─── Advanced（性能套件）── 2 項 ───
  {
    id: 'team-monitor',
    name: 'Team Monitor',
    label: 'Team 監控',
    tier: 'advanced',
    icon: 'fa-regular fa-users-gear',
    description: 'Agent Team 即時監控面板：成員狀態、任務進度、訊息流（每 2 秒輪詢）+ TeamCreate / TeamDelete 事件解析 + TeamMonitorBanner。',
    useCases: ['多 Agent 協作任務的監控', 'Team 工作流的可視化'],
    dependencies: ['streaming-engine', 'chat-ui-core'],
    files: [
      'components/TeamMonitorPanel.tsx',
      'hooks/useTeamMonitor.ts',
      'app/api/team-monitor/route.ts',
    ],
  },
  {
    id: 'email-mode',
    name: 'Email Mode',
    label: 'Email 回覆模式',
    tier: 'advanced',
    icon: 'fa-regular fa-envelope',
    description: '完整的垂直業務功能：Email 系統提示注入、專用歡迎訊息、EmailCopyButton 富文本複製（Markdown → HTML for Gmail）、使用者訊息前綴過濾。',
    useCases: ['Email 回覆草稿生成', '富文本複製貼到 Gmail'],
    dependencies: ['chat-ui-core'],
    files: [],
  },
]

// --- 移植清單生成 ---

const TIER_ORDER: FeatureTier[] = ['core', 'standard', 'optional', 'advanced']
const TIER_LABELS: Record<FeatureTier, string> = {
  core: '基本配備 (Core)',
  standard: '標準配備 (Standard)',
  optional: '選配 (Optional)',
  advanced: '進階 (Advanced)',
}

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

  // 檔案清單（按 tier 分組）
  lines.push('## 2. 複製的檔案清單')
  lines.push('')

  for (const tier of TIER_ORDER) {
    const tierFeatures = selected.filter(f => f.tier === tier && f.files.length > 0)
    if (tierFeatures.length === 0) continue

    lines.push(`### ${TIER_LABELS[tier]}`)
    lines.push('')
    for (const feature of tierFeatures) {
      lines.push(`**${feature.label}**（${feature.name}）`)
      for (const file of feature.files) {
        lines.push(`- \`${file}\``)
      }
      lines.push('')
    }
  }

  // 內嵌在主檔案中的功能提示
  const inlineFeatures = selected.filter(f => f.files.length === 0 && f.tier !== 'core')
  if (inlineFeatures.length > 0) {
    lines.push('### 內嵌功能（在主檔案中，移植時按需保留或移除）')
    lines.push('')
    for (const feature of inlineFeatures) {
      lines.push(`- **${feature.label}**：${feature.description.split('。')[0]}`)
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

  // 來源參考
  lines.push('## 來源專案')
  lines.push('')
  lines.push('```')
  lines.push('~/Documents/Brickverse/Todo-Dashboard')
  lines.push('```')
  lines.push('')
  lines.push(`共 ${allFiles.length} 個檔案，${allPackages.length} 個 npm 套件，${selected.length} 項功能`)

  return lines.join('\n')
}
