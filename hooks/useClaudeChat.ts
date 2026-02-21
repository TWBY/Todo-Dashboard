'use client'

import { useState, useRef, useCallback } from 'react'
import type { ChatMessage, ChatMode, ClaudeStreamEvent, TodoItem, UserQuestion, SessionMeta, StreamingActivity } from '@/lib/claude-chat-types'

// 從工具 input 擷取簡短描述
function extractToolDescription(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case 'Bash': {
      const cmd = String(input.command || input.description || '').trim()
      return cmd.length > 40 ? cmd.slice(0, 40) + '…' : cmd || ''
    }
    case 'Read':
    case 'Write':
    case 'NotebookEdit': {
      const fp = String(input.file_path || input.notebook_path || '')
      return fp.split('/').pop() || fp
    }
    case 'Edit':
    case 'MultiEdit': {
      const fp = String(input.file_path || '')
      return fp.split('/').pop() || fp
    }
    case 'Grep': {
      const pat = String(input.pattern || '')
      return pat.length > 30 ? pat.slice(0, 30) + '…' : pat
    }
    case 'Glob': {
      const pat = String(input.pattern || '')
      return pat.length > 30 ? pat.slice(0, 30) + '…' : pat
    }
    case 'Task': {
      return String(input.description || '').trim()
    }
    case 'WebSearch': {
      return String(input.query || '').trim()
    }
    case 'WebFetch': {
      try {
        const url = new URL(String(input.url || ''))
        return url.hostname
      } catch { return '' }
    }
    case 'Diff': return String(input.file_path || '').split('/').pop() || ''
    case 'TeamCreate': return `Team: ${String(input.team_name || '')}`
    case 'TeamDelete': return 'Team dissolved'
    case 'SendMessage': {
      const summary = String(input.summary || '').trim()
      const msgType = String(input.type || 'message')
      return summary ? `${msgType}: ${summary}` : msgType
    }
    default: return ''
  }
}

export type StreamStatus = 'idle' | 'streaming' | 'completed' | 'error'

interface UseClaudeChatReturn {
  messages: ChatMessage[]
  todos: TodoItem[]
  isStreaming: boolean
  streamStatus: StreamStatus
  streamingActivity: StreamingActivity | null
  streamingAssistantId: string | null
  sessionId: string | null
  sessionMeta: SessionMeta
  pendingQuestions: PendingQuestionsState | null
  pendingPlanApproval: PendingPlanApprovalState | null
  sendMessage: (message: string, mode?: ChatMode, images?: File[], modelOverride?: 'haiku' | 'sonnet' | 'opus', effortOverride?: 'low' | 'medium' | 'high') => Promise<void>
  answerQuestion: (answers: Record<string, string>) => void
  approvePlan: (approved: boolean, feedback?: string) => void
  stopStreaming: () => void
  resetStreamStatus: () => void
  clearChat: () => void
  resumeSession: (sessionId: string) => Promise<void>
  isLoadingHistory: boolean
  error: string | null
  clearError: () => void
  lastFailedMessage: { message: string; mode?: ChatMode } | null
  streamStartTime: number | null
}

interface UseClaudeChatConfig {
  model?: string
  ephemeral?: boolean
  systemPromptAppend?: string
}

// --- 串流事件處理器（主迴圈 & 重試共用） ---

interface StreamContext {
  currentAssistantId: string | null
  exitPlanModeHandled: boolean
  resultSuccess: boolean
  hasPendingApproval: boolean
  hasPendingQuestions: boolean
  retryWithFreshSession: boolean
  newSessionIdForHistory: string | null
  handledToolUseIDs: Set<string> // 已處理的 tool_use block ID（防重複）
}

// canUseTool 的 toolUseID（從 tool_use block 的 id 取得）
interface PendingQuestionsState {
  id: string
  toolUseID: string
  questions: UserQuestion[]
}

interface PendingPlanApprovalState {
  id: string
  toolUseID: string
}

interface StreamActions {
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  setTodos: React.Dispatch<React.SetStateAction<TodoItem[]>>
  setSessionId: (id: string | null) => void
  setSessionMeta: React.Dispatch<React.SetStateAction<SessionMeta>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setPendingQuestions: React.Dispatch<React.SetStateAction<PendingQuestionsState | null>>
  setPendingPlanApproval: React.Dispatch<React.SetStateAction<PendingPlanApprovalState | null>>
  setStreamingActivity: React.Dispatch<React.SetStateAction<StreamingActivity | null>>
  setStreamingAssistantId: React.Dispatch<React.SetStateAction<string | null>>
  projectId: string
  message: string
  currentSessionId: string | null
  ephemeral: boolean
}

function processStreamEvent(
  event: Record<string, unknown>,
  ctx: StreamContext,
  actions: StreamActions,
): void {
  // session 事件
  if (event.type === 'session') {
    console.debug('[chat] event: session', event.session_id)
    actions.setSessionId(event.session_id as string)
    actions.setStreamingActivity({ status: 'thinking' })
    ctx.newSessionIdForHistory = event.session_id as string
    if (!actions.currentSessionId && !actions.ephemeral) {
      fetch('/api/claude-chat/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: actions.projectId,
          sessionId: event.session_id,
          title: actions.message.substring(0, 60),
          messageCount: 1,
        }),
      }).catch(() => {})
    }
    return
  }

  // 錯誤事件（CLI 異常退出、spawn 失敗等）
  if (event.type === 'error') {
    console.error('[chat] error event:', event.message)
    actions.setError(event.message as string)
    actions.setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: String(event.message),
      timestamp: Date.now(),
      isError: true,
    }])
    return
  }

  // 逐字串流事件（SDK includePartialMessages: true）
  if (event.type === 'stream') {
    const streamData = (event as { event: Record<string, unknown> }).event
    const eventType = streamData.type as string

    if (eventType === 'content_block_delta') {
      const delta = streamData.delta as { type: string; text?: string } | undefined
      if (delta?.type === 'text_delta' && delta.text) {
        actions.setStreamingActivity({ status: 'replying' })
        if (!ctx.currentAssistantId) {
          ctx.currentAssistantId = crypto.randomUUID()
          actions.setStreamingAssistantId(ctx.currentAssistantId)
          const aid = ctx.currentAssistantId
          actions.setMessages(prev => [...prev, {
            id: aid,
            role: 'assistant',
            content: delta.text!,
            timestamp: Date.now(),
          }])
        } else {
          const aid = ctx.currentAssistantId
          actions.setMessages(prev => prev.map(m =>
            m.id === aid ? { ...m, content: m.content + delta.text! } : m
          ))
        }
      }
    } else if (eventType === 'content_block_start') {
      const contentBlock = streamData.content_block as { type: string; name?: string; id?: string } | undefined
      if (contentBlock?.type === 'tool_use' && contentBlock.name) {
        // 工具開始 — 提早顯示工具名稱
        console.debug('[chat] stream content_block_start tool_use', { name: contentBlock.name, id: contentBlock.id })
        actions.setStreamingActivity({ status: 'tool', toolName: contentBlock.name })
        ctx.currentAssistantId = null // 結束文字累積
        actions.setStreamingAssistantId(null)

        // ExitPlanMode — 從 stream event 提早建立 pending 狀態
        // （不等 assistant 完整訊息，避免 canUseTool 阻塞後 assistant 訊息延遲到達）
        // 注意：AskUserQuestion 需要完整 input（questions），只能從 assistant 事件處理
        if (contentBlock.name === 'ExitPlanMode' && contentBlock.id) {
          if (!ctx.handledToolUseIDs.has(contentBlock.id)) {
            ctx.handledToolUseIDs.add(contentBlock.id)
            ctx.exitPlanModeHandled = true
            ctx.hasPendingApproval = true
            const pId = crypto.randomUUID()
            actions.setPendingPlanApproval({ id: pId, toolUseID: contentBlock.id })
            actions.setStreamingActivity(null)
            actions.setMessages(prev => [...prev, {
              id: pId,
              role: 'tool',
              content: '',
              toolName: contentBlock.name!,
              planApproval: { pending: true },
              timestamp: Date.now(),
            }])
          }
        }
      } else if (contentBlock?.type === 'text') {
        actions.setStreamingActivity({ status: 'replying' })
      }
    }
    return
  }

  // 工具統計事件
  if (event.type === 'tool_stats') {
    const stats = event.stats as Record<string, { count: number }>
    actions.setSessionMeta(prev => ({ ...prev, toolStats: stats }))
    return
  }

  const streamEvent = event as unknown as ClaudeStreamEvent

  if (streamEvent.type === 'system') {
    console.debug('[chat] event: system', streamEvent.subtype)
    if (streamEvent.subtype === 'init' && streamEvent.model) {
      actions.setSessionMeta(prev => ({ ...prev, model: streamEvent.model }))
    }
    return
  }

  if (streamEvent.type === 'assistant') {
    console.debug('[chat] event: assistant')
    const usage = streamEvent.message.usage
    if (usage) {
      actions.setSessionMeta(prev => ({
        ...prev,
        totalInputTokens: prev.totalInputTokens + usage.input_tokens,
        totalOutputTokens: prev.totalOutputTokens + usage.output_tokens,
      }))
    }
    const content = streamEvent.message.content
    for (const block of content) {
      if (block.type === 'text') {
        actions.setStreamingActivity({ status: 'replying' })
        if (!ctx.currentAssistantId) {
          ctx.currentAssistantId = crypto.randomUUID()
          actions.setStreamingAssistantId(ctx.currentAssistantId)
          const aid = ctx.currentAssistantId
          actions.setMessages(prev => [...prev, {
            id: aid,
            role: 'assistant',
            content: block.text,
            timestamp: Date.now(),
          }])
        } else {
          // 逐字串流已建立 message → 用完整文字覆蓋（而非 append）
          const aid = ctx.currentAssistantId
          actions.setMessages(prev => prev.map(m =>
            m.id === aid ? { ...m, content: block.text } : m
          ))
        }
      } else if (block.type === 'tool_use') {
        console.debug('[chat] assistant tool_use block', { name: block.name, id: block.id, hasId: 'id' in block })
        // 更新 streaming activity（所有 tool 都顯示）
        const toolDesc = extractToolDescription(block.name, block.input as Record<string, unknown>)
        actions.setStreamingActivity({ status: 'tool', toolName: block.name, toolDetail: toolDesc || undefined })

        // TodoWrite
        if (block.name === 'TodoWrite') {
          const todoInput = block.input as { todos?: TodoItem[] }
          if (todoInput.todos) {
            actions.setTodos(todoInput.todos)
            actions.setMessages(prev => [...prev, {
              id: crypto.randomUUID(),
              role: 'tool',
              content: '',
              toolName: block.name,
              todos: todoInput.todos,
              timestamp: Date.now(),
            }])
          }
          ctx.currentAssistantId = null
          actions.setStreamingAssistantId(null)
          return
        }

        // AskUserQuestion — canUseTool 阻塞中，SSE 不斷開
        if (block.name === 'AskUserQuestion') {
          // 防重複：同一 tool_use block 可能從 partial + complete message 各收到一次
          if (ctx.handledToolUseIDs.has(block.id)) return
          ctx.handledToolUseIDs.add(block.id)
          const qInput = block.input as { questions?: UserQuestion[] }
          if (qInput.questions) {
            const qId = crypto.randomUUID()
            actions.setPendingQuestions({ id: qId, toolUseID: block.id, questions: qInput.questions })
            ctx.hasPendingQuestions = true
            actions.setStreamingActivity(null) // 清除 thinking/tool 狀態
            actions.setMessages(prev => [...prev, {
              id: qId,
              role: 'tool',
              content: '',
              toolName: block.name,
              questions: qInput.questions,
              timestamp: Date.now(),
            }])
          }
          ctx.currentAssistantId = null
          actions.setStreamingAssistantId(null)
          return
        }

        // ExitPlanMode — canUseTool 阻塞中，SSE 不斷開
        if (block.name === 'ExitPlanMode') {
          console.debug('[chat] ExitPlanMode detected', { blockId: block.id, alreadyHandled: ctx.handledToolUseIDs.has(block.id) })
          // 防重複：同一 tool_use block 可能從 partial + complete message 各收到一次
          if (ctx.handledToolUseIDs.has(block.id)) return
          ctx.handledToolUseIDs.add(block.id)
          ctx.exitPlanModeHandled = true
          ctx.hasPendingApproval = true
          const pId = crypto.randomUUID()
          actions.setPendingPlanApproval({ id: pId, toolUseID: block.id })
          actions.setStreamingActivity(null) // 清除 thinking/tool 狀態
          actions.setMessages(prev => [...prev, {
            id: pId,
            role: 'tool',
            content: '',
            toolName: block.name,
            planApproval: { pending: true },
            timestamp: Date.now(),
          }])
          ctx.currentAssistantId = null
          actions.setStreamingAssistantId(null)
          return
        }

        // TeamCreate — 標記 team 事件，UI 渲染 TeamMonitorPanel
        if (block.name === 'TeamCreate') {
          if (ctx.handledToolUseIDs.has(block.id)) return
          ctx.handledToolUseIDs.add(block.id)
          const teamInput = block.input as { team_name?: string; description?: string }
          actions.setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: 'tool',
            content: JSON.stringify(block.input, null, 2),
            toolName: block.name,
            toolDescription: `Team: ${teamInput.team_name || ''}`,
            teamEvent: { type: 'create', teamName: teamInput.team_name || '', description: teamInput.description },
            timestamp: Date.now(),
          }])
          ctx.currentAssistantId = null
          actions.setStreamingAssistantId(null)
          return
        }

        // TeamDelete — 標記 team 結束事件
        if (block.name === 'TeamDelete') {
          if (ctx.handledToolUseIDs.has(block.id)) return
          ctx.handledToolUseIDs.add(block.id)
          actions.setMessages(prev => [...prev, {
            id: crypto.randomUUID(),
            role: 'tool',
            content: '',
            toolName: block.name,
            toolDescription: 'Team dissolved',
            teamEvent: { type: 'delete', teamName: '' },
            timestamp: Date.now(),
          }])
          ctx.currentAssistantId = null
          actions.setStreamingAssistantId(null)
          return
        }

        // 其他工具
        actions.setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'tool',
          content: JSON.stringify(block.input, null, 2),
          toolName: block.name,
          toolDescription: extractToolDescription(block.name, block.input as Record<string, unknown>),
          timestamp: Date.now(),
        }])
        ctx.currentAssistantId = null
        actions.setStreamingAssistantId(null)
      }
    }
    return
  }

  if (streamEvent.type === 'result') {
    console.debug('[chat] event: result', streamEvent.subtype, { is_error: streamEvent.is_error })
    actions.setStreamingActivity(null)
    if (streamEvent.duration_ms) {
      actions.setSessionMeta(prev => ({ ...prev, lastDurationMs: streamEvent.duration_ms }))
    }
    if (streamEvent.is_error || (streamEvent.subtype && streamEvent.subtype !== 'success')) {
      const errorsDetail = streamEvent.errors?.join('; ') || ''
      const errorText = errorsDetail || streamEvent.result || `Claude 執行失敗 (${streamEvent.subtype})`
      // Session 不可用（不存在或 process crash）→ 標記重試
      const isSessionNotFound = streamEvent.errors?.some(e => e.includes('No conversation found'))
      const isProcessCrash = errorText.includes('exited with code')
      if ((isSessionNotFound || isProcessCrash) && actions.currentSessionId) {
        console.debug('[chat] session unusable, will retry with fresh session', { isSessionNotFound, isProcessCrash })
        actions.setSessionId(null)
        ctx.newSessionIdForHistory = null
        ctx.retryWithFreshSession = true
        return
      }
      // 其他錯誤
      actions.setSessionId(null)
      ctx.newSessionIdForHistory = null
      actions.setError(errorText)
      actions.setMessages(prev => [...prev, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: errorText,
        isError: true,
        timestamp: Date.now(),
      }])
    } else {
      if (!ctx.currentAssistantId && streamEvent.result) {
        actions.setMessages(prev => [...prev, {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: streamEvent.result,
          timestamp: Date.now(),
        }])
      }
      if (streamEvent.subtype === 'success') {
        ctx.resultSuccess = true
      }
      // Store cost/duration on the last assistant message for budget tracking
      if (streamEvent.total_cost_usd !== undefined || streamEvent.duration_ms !== undefined) {
        actions.setMessages(prev => {
          const lastAssistantIdx = [...prev].reverse().findIndex(m => m.role === 'assistant')
          if (lastAssistantIdx === -1) return prev
          const idx = prev.length - 1 - lastAssistantIdx
          const updated = [...prev]
          updated[idx] = {
            ...updated[idx],
            costUsd: streamEvent.total_cost_usd,
            durationMs: streamEvent.duration_ms,
          }
          return updated
        })
      }
    }
    return
  }

  console.debug('[chat] event: unknown type', event.type)
}

// --- 讀取 SSE stream 的共用函式 ---
async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  ctx: StreamContext,
  actions: StreamActions,
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue

      try {
        const event = JSON.parse(data)
        processStreamEvent(event, ctx, actions)
      } catch (parseErr) {
        console.debug('[chat] JSON parse skip:', data.slice(0, 80))
      }
    }
  }
}

// --- 從 sendMessage 提取的 helper 函數 ---

// 上傳圖片到暫存區，回傳伺服器檔案路徑
async function uploadImages(
  images: File[],
  onError: (msg: string) => void,
): Promise<{ paths: string[] } | null> {
  try {
    const formData = new FormData()
    for (const img of images) {
      formData.append('images', img)
    }
    const res = await fetch('/api/claude-chat/upload', {
      method: 'POST',
      body: formData,
    })
    if (!res.ok) {
      let errMsg = '圖片上傳失敗'
      try {
        const errData = await res.json()
        if (errData.error) errMsg = errData.error
      } catch { /* response 非 JSON */ }
      console.error('[chat] image upload failed:', errMsg)
      onError(errMsg)
      return null
    }
    const data = await res.json()
    return { paths: data.paths }
  } catch (err) {
    console.error('[chat] image upload error:', err)
    onError('圖片上傳失敗：' + (err instanceof Error ? err.message : '網路錯誤'))
    return null
  }
}

// 執行 SSE 串流（含自動重試 fresh session）
async function executeStream(opts: {
  projectId: string
  fullMessage: string
  sessionId: string | null
  mode: ChatMode
  model?: string
  effort?: string
  systemPromptAppend?: string
  controller: AbortController
  ctx: StreamContext
  actions: StreamActions
}): Promise<void> {
  const { projectId, fullMessage, sessionId, mode, model, effort, systemPromptAppend, controller, ctx, actions } = opts

  console.debug('[chat] fetching /api/claude-chat', { projectId, sessionId })
  const res = await fetch('/api/claude-chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      message: fullMessage,
      sessionId,
      mode,
      model: model || undefined,
      effort: effort || undefined,
      systemPromptAppend: systemPromptAppend || undefined,
    }),
    signal: controller.signal,
  })

  console.debug('[chat] fetch response', { status: res.status })

  if (!res.ok) {
    const errData = await res.json()
    throw new Error(errData.error || 'Request failed')
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')

  await readSSEStream(reader, ctx, actions)

  // Session 不存在 → 自動重試（用新 session）
  if (ctx.retryWithFreshSession) {
    console.debug('[chat] retrying with fresh session')
    ctx.retryWithFreshSession = false

    const retryRes = await fetch('/api/claude-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        message: fullMessage,
        sessionId: null,
        mode,
        model: model || undefined,
        effort: effort || undefined,
        systemPromptAppend: systemPromptAppend || undefined,
      }),
      signal: controller.signal,
    })

    if (retryRes.ok) {
      const retryReader = retryRes.body?.getReader()
      if (retryReader) {
        await readSSEStream(retryReader, ctx, actions)
      }
    }
  }
}

// 持久化 session 歷史和訊息（fire-and-forget）
function persistSession(
  projectId: string,
  sessionId: string,
  messages: ChatMessage[],
  meta?: { totalCostUsd?: number; totalDurationMs?: number; model?: string | null; totalInputTokens?: number; totalOutputTokens?: number },
): void {
  const userMsgCount = messages.filter(m => m.role === 'user').length

  const totalCostUsd = meta?.totalCostUsd
  const totalDurationMs = meta?.totalDurationMs
  const totalInputTokens = meta?.totalInputTokens
  const totalOutputTokens = meta?.totalOutputTokens
  const modelMsg = meta?.model

  fetch('/api/claude-chat/history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId,
      sessionId,
      messageCount: userMsgCount,
      ...(totalCostUsd !== undefined && totalCostUsd > 0 && { totalCostUsd }),
      ...(totalDurationMs !== undefined && totalDurationMs > 0 && { totalDurationMs }),
      ...(totalInputTokens !== undefined && totalInputTokens > 0 && { totalInputTokens }),
      ...(totalOutputTokens !== undefined && totalOutputTokens > 0 && { totalOutputTokens }),
      ...(modelMsg && { model: modelMsg }),
    }),
  }).catch(() => {})

  const persistable = messages.map(m => {
    if (m.images) {
      const { images: _images, ...rest } = m
      return rest
    }
    return m
  })
  fetch('/api/claude-chat/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, sessionId, messages: persistable }),
  }).catch(() => {})
}

export function useClaudeChat(projectId: string, config?: UseClaudeChatConfig): UseClaudeChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('idle')
  const isStreaming = streamStatus === 'streaming'
  // sessionId: state 供 UI 讀取，ref 供 callback 內部讀取（避免 stale closure）
  const [sessionId, _setSessionId] = useState<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const setSessionId = useCallback((id: string | null) => {
    sessionIdRef.current = id
    _setSessionId(id)
  }, [])
  const [error, setError] = useState<string | null>(null)
  const [lastFailedMessage, setLastFailedMessage] = useState<{ message: string; mode?: ChatMode } | null>(null)
  const [streamStartTime, setStreamStartTime] = useState<number | null>(null)
  const [pendingQuestions, _setPendingQuestions] = useState<PendingQuestionsState | null>(null)
  const [pendingPlanApproval, _setPendingPlanApproval] = useState<PendingPlanApprovalState | null>(null)
  const [streamingActivity, setStreamingActivity] = useState<StreamingActivity | null>(null)
  const [streamingAssistantId, setStreamingAssistantId] = useState<string | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [sessionMeta, setSessionMeta] = useState<SessionMeta>({
    model: null,
    permissionMode: 'acceptEdits',
    totalInputTokens: 0,
    totalOutputTokens: 0,
  })
  const abortRef = useRef<AbortController | null>(null)
  const currentModeRef = useRef<ChatMode>('plan')
  const pendingQuestionsRef = useRef<PendingQuestionsState | null>(null)
  const pendingPlanApprovalRef = useRef<PendingPlanApprovalState | null>(null)
  const setPendingQuestions = useCallback((v: PendingQuestionsState | null | ((prev: PendingQuestionsState | null) => PendingQuestionsState | null)) => {
    _setPendingQuestions(prev => {
      const next = typeof v === 'function' ? v(prev) : v
      pendingQuestionsRef.current = next
      return next
    })
  }, [])
  const setPendingPlanApproval = useCallback((v: PendingPlanApprovalState | null | ((prev: PendingPlanApprovalState | null) => PendingPlanApprovalState | null)) => {
    _setPendingPlanApproval(prev => {
      const next = typeof v === 'function' ? v(prev) : v
      pendingPlanApprovalRef.current = next
      return next
    })
  }, [])

  const stopStreaming = useCallback(() => {
    console.debug('[chat] stopStreaming called')
    abortRef.current?.abort()
    abortRef.current = null
    setStreamStatus('idle')
    setStreamingAssistantId(null)
  }, [])

  const resetStreamStatus = useCallback(() => {
    setStreamStatus('idle')
  }, [])

  const sendMessage = useCallback(async (message: string, mode?: ChatMode, images?: File[], modelOverride?: 'haiku' | 'sonnet' | 'opus', effortOverride?: 'low' | 'medium' | 'high') => {
    if (!message.trim() && (!images || images.length === 0)) {
      console.debug('[chat] sendMessage skipped: empty message')
      return
    }

    // canUseTool 阻塞期間，阻擋新訊息（避免 abort 掉等待中的 SSE）
    if (pendingQuestionsRef.current || pendingPlanApprovalRef.current) {
      console.debug('[chat] sendMessage blocked: pending canUseTool interaction')
      return
    }

    console.debug('[chat] sendMessage', { messageLen: message.length, mode, sessionId: sessionIdRef.current })

    currentModeRef.current = mode || 'plan'

    // 如果正在串流，先中斷上一個
    if (abortRef.current) {
      console.debug('[chat] aborting previous stream')
      abortRef.current.abort()
    }

    setError(null)

    // 用戶送出新訊息時，清除所有未處理的互動元素（問題對話框、執行按鈕等）
    setPendingQuestions(null)
    setPendingPlanApproval(null)

    // 上傳圖片（如果有的話）
    let imagePaths: string[] = []
    let imagePreviewUrls: string[] = []
    if (images && images.length > 0) {
      imagePreviewUrls = images.map(f => URL.createObjectURL(f))
      const result = await uploadImages(images, setError)
      if (!result) return
      imagePaths = result.paths
    }

    // 組合訊息
    let fullMessage = message
    if (imagePaths.length > 0) {
      const pathList = imagePaths.map(p => `- ${p}`).join('\n')
      fullMessage += `\n\n[附加圖片，請使用 Read 工具讀取以下圖片檔案：\n${pathList}\n]`
    }

    // 加入使用者訊息
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: message,
      images: imagePreviewUrls.length > 0 ? imagePreviewUrls : undefined,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    setStreamStatus('streaming')
    setStreamingActivity({ status: 'connecting' })
    setStreamStartTime(Date.now())
    setLastFailedMessage(null)

    const controller = new AbortController()
    abortRef.current = controller
    controller.signal.addEventListener('abort', () => {
      console.debug('[chat] ⚠️ AbortController fired!', new Error('abort trace').stack)
    })

    const currentSessionId = sessionIdRef.current

    const ctx: StreamContext = {
      currentAssistantId: null,
      exitPlanModeHandled: false,
      resultSuccess: false,
      hasPendingApproval: false,
      hasPendingQuestions: false,
      retryWithFreshSession: false,
      newSessionIdForHistory: null,
      handledToolUseIDs: new Set(),
    }

    const actions: StreamActions = {
      setMessages,
      setTodos,
      setSessionId,
      setSessionMeta,
      setError,
      setPendingQuestions,
      setPendingPlanApproval,
      setStreamingActivity,
      setStreamingAssistantId,
      projectId,
      message,
      currentSessionId,
      ephemeral: !!config?.ephemeral,
    }

    try {
      await executeStream({
        projectId,
        fullMessage,
        sessionId: currentSessionId,
        mode: mode || 'plan',
        model: modelOverride || config?.model || undefined,
        effort: effortOverride || undefined,
        systemPromptAppend: config?.systemPromptAppend,
        controller,
        ctx,
        actions,
      })

    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[chat] sendMessage failed:', err)
        setError(err.message)
        setLastFailedMessage({ message, mode })
      }
    } finally {
      setStreamStartTime(null)
      // 根據串流結果原子化設定最終狀態
      const finalStatus: StreamStatus = (ctx.hasPendingApproval || ctx.hasPendingQuestions)
        ? 'idle'
        : ctx.resultSuccess
          ? 'completed'
          : 'idle'
      console.debug('[chat] stream ended', { resultSuccess: ctx.resultSuccess, finalStatus, hasPendingApproval: ctx.hasPendingApproval })
      setStreamStatus(finalStatus)
      setStreamingActivity(null)
      setStreamingAssistantId(null)

      // 更新歷史紀錄（ephemeral 模式跳過）
      const sid = sessionIdRef.current || ctx.newSessionIdForHistory
      if (sid && !config?.ephemeral) {
        setMessages(prev => {
          // Aggregate cost from messages (result events store costUsd on last assistant msg)
          const totalCostUsd = prev.reduce((sum, m) => sum + (m.costUsd ?? 0), 0)
          const totalDurationMs = prev.reduce((sum, m) => sum + (m.durationMs ?? 0), 0)
          setSessionMeta(meta => {
            persistSession(projectId, sid, prev, {
              totalCostUsd: totalCostUsd || undefined,
              totalDurationMs: totalDurationMs || undefined,
              model: meta.model,
              totalInputTokens: meta.totalInputTokens || undefined,
              totalOutputTokens: meta.totalOutputTokens || undefined,
            })
            return meta
          })
          return prev
        })
      }
    }
  }, [projectId, config?.model, setSessionId])

  // 回答 AskUserQuestion — POST 到 /answer endpoint，不開新 SSE
  const answerQuestion = useCallback(async (answers: Record<string, string>) => {
    const pending = pendingQuestionsRef.current
    setPendingQuestions(null)
    if (!pending) return

    const sid = sessionIdRef.current
    if (!sid) return

    const answerText = Object.entries(answers)
      .map(([q, a]) => `${q}: ${a}`)
      .join('\n')
    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'user',
      content: answerText,
      timestamp: Date.now(),
    }])
    setStreamingActivity({ status: 'thinking' })

    try {
      const res = await fetch('/api/claude-chat/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          toolUseID: pending.toolUseID,
          type: 'question',
          answers,
        }),
      })
      if (!res.ok) {
        console.error('[chat] answerQuestion failed:', await res.json().catch(() => ({})))
        setStreamingActivity(null)
        setError('回答提交失敗，請重試')
      }
    } catch (err) {
      console.error('[chat] answerQuestion POST failed:', err)
      setStreamingActivity(null)
      setError('回答提交失敗，請重試')
    }
  }, [])

  // 審批計畫 — POST 到 /answer endpoint，不開新 SSE
  const approvePlan = useCallback(async (approved: boolean, feedback?: string) => {
    const pending = pendingPlanApprovalRef.current
    console.debug('[chat] approvePlan called', { approved, hasPending: !!pending, toolUseID: pending?.toolUseID, sessionId: sessionIdRef.current })
    if (approved) {
      setMessages(prev => prev.map(m =>
        m.planApproval?.pending ? { ...m, planApproval: { pending: false, approved: true } } : m
      ))
    } else {
      setMessages(prev => prev.map(m =>
        m.planApproval?.pending ? { ...m, planApproval: { pending: false, approved: false } } : m
      ))
    }
    setPendingPlanApproval(null)
    if (!pending) return

    const sid = sessionIdRef.current
    if (!sid) return

    setMessages(prev => [...prev, {
      id: crypto.randomUUID(),
      role: 'user',
      content: approved ? '✓ 批准計畫' : (feedback || '拒絕計畫'),
      timestamp: Date.now(),
    }])
    setStreamingActivity({ status: 'thinking' })

    try {
      const res = await fetch('/api/claude-chat/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sid,
          toolUseID: pending.toolUseID,
          type: 'planApproval',
          approved,
          feedback: feedback || undefined,
        }),
      })
      const resBody = await res.json().catch(() => ({}))
      console.debug('[chat] approvePlan response', { status: res.status, body: resBody })
      if (!res.ok) {
        console.error('[chat] approvePlan failed:', resBody)
        setStreamingActivity(null)
        setError('計畫審批失敗，請重試')
      }
    } catch (err) {
      console.error('[chat] approvePlan POST failed:', err)
      setStreamingActivity(null)
      setError('計畫審批失敗，請重試')
    }
  }, [])

  const clearChat = useCallback(() => {
    console.debug('[chat] clearChat called', { hasAbortRef: !!abortRef.current })
    abortRef.current?.abort()
    setMessages([])
    setTodos([])
    setSessionId(null)
    setError(null)
    setStreamStatus('idle')
    setPendingQuestions(null)
    setPendingPlanApproval(null)
    setSessionMeta({ model: null, permissionMode: 'acceptEdits', totalInputTokens: 0, totalOutputTokens: 0 })
    setStreamingActivity(null)
  }, [setSessionId])

  const resumeSession = useCallback(async (targetSessionId: string) => {
    console.debug('[chat] resumeSession', targetSessionId, { hasAbortRef: !!abortRef.current })
    abortRef.current?.abort()
    setError(null)
    setStreamStatus('idle')
    setPendingQuestions(null)
    setPendingPlanApproval(null)
    setSessionMeta({ model: null, permissionMode: 'acceptEdits', totalInputTokens: 0, totalOutputTokens: 0 })
    setStreamingActivity(null)
    setIsLoadingHistory(true)
    setMessages([])
    setSessionId(targetSessionId)

    // 從持久化儲存載入歷史訊息
    try {
      const res = await fetch(`/api/claude-chat/messages?projectId=${encodeURIComponent(projectId)}&sessionId=${encodeURIComponent(targetSessionId)}`)
      if (res.ok) {
        const data = await res.json()
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages)
          const lastTodoMsg = [...data.messages].reverse().find((m: { toolName?: string; todos?: unknown[] }) => m.toolName === 'TodoWrite' && m.todos)
          if (lastTodoMsg?.todos) {
            setTodos(lastTodoMsg.todos)
          } else {
            setTodos([])
          }
          return
        }
      }
      setMessages([])
      setTodos([])
    } catch (err) {
      console.error('[chat] resumeSession load failed:', err)
      setMessages([])
      setTodos([])
    } finally {
      setIsLoadingHistory(false)
    }
  }, [projectId, setSessionId])

  const clearError = useCallback(() => setError(null), [])

  return { messages, todos, isStreaming, streamStatus, streamingActivity, streamingAssistantId, sessionId, sessionMeta, pendingQuestions, pendingPlanApproval, sendMessage, answerQuestion, approvePlan, stopStreaming, resetStreamStatus, clearChat, resumeSession, isLoadingHistory, error, clearError, lastFailedMessage, streamStartTime }
}
