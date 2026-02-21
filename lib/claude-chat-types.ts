// Claude CLI stream-json 輸出事件型別

export interface ClaudeStreamInit {
  type: 'system'
  subtype: 'init'
  session_id: string
  model: string
  tools: string[]
  cwd: string
}

export interface ClaudeStreamAssistant {
  type: 'assistant'
  message: {
    role: 'assistant'
    content: Array<
      | { type: 'text'; text: string }
      | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
    >
    usage: { input_tokens: number; output_tokens: number }
  }
  session_id: string
}

export interface ClaudeStreamResult {
  type: 'result'
  subtype: 'success' | 'error' | 'error_during_execution'
  is_error: boolean
  result: string
  duration_ms: number
  total_cost_usd: number
  session_id: string
  errors?: string[]
}

export type ClaudeStreamEvent = ClaudeStreamInit | ClaudeStreamAssistant | ClaudeStreamResult

// Todo 型別
export interface TodoItem {
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  activeForm: string
}

// AskUserQuestion 型別
export interface QuestionOption {
  label: string
  description: string
}

export interface UserQuestion {
  question: string
  header: string
  options: QuestionOption[]
  multiSelect: boolean
}

// Chat mode 型別
export type ChatMode = 'plan' | 'edit' | 'auto'

// Chat UI 訊息型別

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'tool'
  content: string
  toolName?: string
  toolDescription?: string // Short description extracted from tool input
  images?: string[] // Object URLs for preview (user messages)
  todos?: TodoItem[] // TodoWrite tool data
  questions?: UserQuestion[] // AskUserQuestion tool data
  planApproval?: { pending: boolean; approved?: boolean } // ExitPlanMode tool data
  teamEvent?: { type: 'create' | 'delete'; teamName: string; description?: string } // TeamCreate/TeamDelete tool data
  isError?: boolean // Error message from backend
  timestamp: number
  // Budget tracking fields (stored on the final result message)
  costUsd?: number
  durationMs?: number
  model?: string
  inputTokens?: number
  outputTokens?: number
}

// Chat history record
export interface ChatSessionRecord {
  sessionId: string
  projectId: string
  title: string
  messageCount: number
  createdAt: number
  lastActiveAt: number
  // Budget tracking (populated after session ends)
  totalCostUsd?: number
  totalDurationMs?: number
  model?: string
  totalInputTokens?: number
  totalOutputTokens?: number
}

// Streaming 即時活動狀態
export interface StreamingActivity {
  status: 'connecting' | 'thinking' | 'replying' | 'tool'
  toolName?: string
  toolDetail?: string
}

// Team Monitor 型別
export interface TeamMember {
  name: string
  agentId: string
  agentType: string
  color?: string
  status: 'working' | 'idle' | 'shutdown'
}

export interface TeamTask {
  id: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'blocked'
  owner?: string
}

export interface TeamMessage {
  from: string
  to?: string
  summary: string
  text?: string
  timestamp: string
  color?: string
  type?: 'message' | 'broadcast' | 'idle' | 'shutdown'
}

export interface TeamSystemEvent {
  type: string
  from: string
  summary: string
  timestamp: string
}

export interface TeamMonitorState {
  teamName: string
  description?: string
  members: TeamMember[]
  tasks: TeamTask[]
  messages: TeamMessage[]
  systemEvents: TeamSystemEvent[]
  isActive: boolean
  startTime: number
}

// Session metadata for status bar
export interface SessionMeta {
  model: string | null
  permissionMode: string | null
  totalInputTokens: number
  totalOutputTokens: number
  lastDurationMs?: number
  toolStats?: Record<string, { count: number }>
}
