'use client'

import { useState, useRef, useCallback } from 'react'
import type { ChatMessage, ChatMode, ClaudeStreamEvent, TodoItem, UserQuestion, SessionMeta } from '@/lib/claude-chat-types'

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
    default: return ''
  }
}

export type StreamStatus = 'idle' | 'streaming' | 'completed' | 'error'

interface UseClaudeChatReturn {
  messages: ChatMessage[]
  todos: TodoItem[]
  isStreaming: boolean
  streamStatus: StreamStatus
  sessionId: string | null
  sessionMeta: SessionMeta
  pendingQuestions: { id: string; questions: UserQuestion[] } | null
  pendingPlanApproval: { id: string } | null
  sendMessage: (message: string, mode?: ChatMode, images?: File[], modelOverride?: 'sonnet' | 'opus') => Promise<void>
  answerQuestion: (answers: Record<string, string>) => void
  approvePlan: (approved: boolean, feedback?: string) => void
  stopStreaming: () => void
  resetStreamStatus: () => void
  clearChat: () => void
  resumeSession: (sessionId: string) => Promise<void>
  error: string | null
}

interface UseClaudeChatConfig {
  ideaMode?: boolean
  model?: 'sonnet' | 'opus'
}

// --- 串流事件處理器（主迴圈 & 重試共用） ---

interface StreamContext {
  currentAssistantId: string | null
  exitPlanModeHandled: boolean
  resultSuccess: boolean
  shouldStopReading: boolean
  hasPendingApproval: boolean
  hasPendingQuestions: boolean
  retryWithFreshSession: boolean
  newSessionIdForHistory: string | null
}

interface StreamActions {
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  setTodos: React.Dispatch<React.SetStateAction<TodoItem[]>>
  setSessionId: (id: string | null) => void
  setSessionMeta: React.Dispatch<React.SetStateAction<SessionMeta>>
  setError: React.Dispatch<React.SetStateAction<string | null>>
  setPendingQuestions: React.Dispatch<React.SetStateAction<{ id: string; questions: UserQuestion[] } | null>>
  setPendingPlanApproval: React.Dispatch<React.SetStateAction<{ id: string } | null>>
  projectId: string
  message: string
  currentSessionId: string | null
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
    ctx.newSessionIdForHistory = event.session_id as string
    if (!actions.currentSessionId) {
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
      content: `⚠️ ${event.message}`,
      timestamp: Date.now(),
      isError: true,
    }])
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
        if (!ctx.currentAssistantId) {
          ctx.currentAssistantId = crypto.randomUUID()
          const aid = ctx.currentAssistantId
          actions.setMessages(prev => [...prev, {
            id: aid,
            role: 'assistant',
            content: block.text,
            timestamp: Date.now(),
          }])
        } else {
          const aid = ctx.currentAssistantId
          actions.setMessages(prev => prev.map(m =>
            m.id === aid ? { ...m, content: m.content + block.text } : m
          ))
        }
      } else if (block.type === 'tool_use') {
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
          return
        }

        // AskUserQuestion
        if (block.name === 'AskUserQuestion') {
          const qInput = block.input as { questions?: UserQuestion[] }
          if (qInput.questions) {
            const qId = crypto.randomUUID()
            actions.setPendingQuestions({ id: qId, questions: qInput.questions })
            ctx.hasPendingQuestions = true
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
          ctx.shouldStopReading = true
          return
        }

        // ExitPlanMode
        if (block.name === 'ExitPlanMode') {
          ctx.exitPlanModeHandled = true
          ctx.hasPendingApproval = true
          const pId = crypto.randomUUID()
          actions.setPendingPlanApproval({ id: pId })
          actions.setMessages(prev => [...prev, {
            id: pId,
            role: 'tool',
            content: '',
            toolName: block.name,
            planApproval: { pending: true },
            timestamp: Date.now(),
          }])
          ctx.currentAssistantId = null
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
      }
    }
    return
  }

  if (streamEvent.type === 'result') {
    console.debug('[chat] event: result', streamEvent.subtype, { is_error: streamEvent.is_error })
    if (streamEvent.is_error || (streamEvent.subtype && streamEvent.subtype !== 'success')) {
      const errorsDetail = streamEvent.errors?.join('; ') || ''
      const errorText = errorsDetail || streamEvent.result || `Claude 執行失敗 (${streamEvent.subtype})`
      // Session 不存在 → 標記重試
      const isSessionNotFound = streamEvent.errors?.some(e => e.includes('No conversation found'))
      if (isSessionNotFound && actions.currentSessionId) {
        console.debug('[chat] session not found, will retry with fresh session')
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
        content: `⚠️ ${errorText}`,
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
    if (ctx.shouldStopReading) {
      reader.cancel()
      break
    }
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    buffer += chunk
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (ctx.shouldStopReading) break
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
  const [pendingQuestions, setPendingQuestions] = useState<{ id: string; questions: UserQuestion[] } | null>(null)
  const [pendingPlanApproval, setPendingPlanApproval] = useState<{ id: string } | null>(null)
  const [sessionMeta, setSessionMeta] = useState<SessionMeta>({
    model: null,
    permissionMode: 'acceptEdits',
    totalInputTokens: 0,
    totalOutputTokens: 0,
  })
  const abortRef = useRef<AbortController | null>(null)
  const currentModeRef = useRef<ChatMode>('plan')

  const stopStreaming = useCallback(() => {
    console.debug('[chat] stopStreaming called')
    abortRef.current?.abort()
    abortRef.current = null
    setStreamStatus('idle')
  }, [])

  const resetStreamStatus = useCallback(() => {
    setStreamStatus('idle')
  }, [])

  const sendMessage = useCallback(async (message: string, mode?: ChatMode, images?: File[], modelOverride?: 'sonnet' | 'opus') => {
    if (!message.trim() && (!images || images.length === 0)) {
      console.debug('[chat] sendMessage skipped: empty message')
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
      try {
        const formData = new FormData()
        for (const img of images) {
          formData.append('images', img)
        }
        const uploadRes = await fetch('/api/claude-chat/upload', {
          method: 'POST',
          body: formData,
        })
        if (!uploadRes.ok) {
          const errData = await uploadRes.json()
          console.error('[chat] image upload failed:', errData)
          setError(errData.error || '圖片上傳失敗')
          return
        }
        const uploadData = await uploadRes.json()
        imagePaths = uploadData.paths
      } catch (uploadErr) {
        console.error('[chat] image upload error:', uploadErr)
        setError('圖片上傳失敗')
        return
      }
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
      shouldStopReading: false,
      hasPendingApproval: false,
      hasPendingQuestions: false,
      retryWithFreshSession: false,
      newSessionIdForHistory: null,
    }

    const actions: StreamActions = {
      setMessages,
      setTodos,
      setSessionId,
      setSessionMeta,
      setError,
      setPendingQuestions,
      setPendingPlanApproval,
      projectId,
      message,
      currentSessionId,
    }

    try {
      console.debug('[chat] fetching /api/claude-chat', { projectId, sessionId: currentSessionId })
      const res = await fetch('/api/claude-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          message: fullMessage,
          sessionId: currentSessionId,
          mode: mode || 'plan',
          ideaMode: config?.ideaMode || false,
          model: modelOverride || config?.model || undefined,
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
        // 重置 context 給重試用
        ctx.retryWithFreshSession = false
        ctx.shouldStopReading = false

        const retryRes = await fetch('/api/claude-chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId, message: fullMessage, sessionId: null, mode: mode || 'plan' }),
          signal: controller.signal,
        })

        if (retryRes.ok) {
          const retryReader = retryRes.body?.getReader()
          if (retryReader) {
            await readSSEStream(retryReader, ctx, actions)
          }
        }
      }

      // Plan mode fallback
      if (currentModeRef.current === 'plan' && ctx.resultSuccess && !ctx.exitPlanModeHandled) {
        ctx.hasPendingApproval = true
        const pId = crypto.randomUUID()
        setPendingPlanApproval({ id: pId })
        setMessages(prev => [...prev, {
          id: pId,
          role: 'tool',
          content: '',
          toolName: 'ExitPlanMode',
          planApproval: { pending: true },
          timestamp: Date.now(),
        }])
      }
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        console.error('[chat] sendMessage failed:', err)
        setError(err.message)
      }
    } finally {
      // 根據串流結果原子化設定最終狀態
      const finalStatus: StreamStatus = (ctx.hasPendingApproval || ctx.hasPendingQuestions)
        ? 'idle'
        : (ctx.resultSuccess || ctx.currentAssistantId)
          ? 'completed'
          : 'idle'
      console.debug('[chat] stream ended', { resultSuccess: ctx.resultSuccess, finalStatus, hasPendingApproval: ctx.hasPendingApproval })
      setStreamStatus(finalStatus)

      // 更新歷史紀錄
      const sid = sessionIdRef.current || ctx.newSessionIdForHistory
      if (sid) {
        setMessages(prev => {
          const userMsgCount = prev.filter(m => m.role === 'user').length
          fetch('/api/claude-chat/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              sessionId: sid,
              messageCount: userMsgCount,
            }),
          }).catch(() => {})
          // 持久化訊息
          const persistable = prev.map(m => {
            if (m.images) {
              const { images, ...rest } = m
              return rest
            }
            return m
          })
          fetch('/api/claude-chat/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectId,
              sessionId: sid,
              messages: persistable,
            }),
          }).catch(() => {})
          return prev
        })
      }
    }
  }, [projectId, config?.ideaMode, config?.model, setSessionId])

  // 回答 AskUserQuestion
  const answerQuestion = useCallback((answers: Record<string, string>) => {
    setPendingQuestions(null)
    const answerText = Object.entries(answers)
      .map(([q, a]) => `${q}: ${a}`)
      .join('\n')
    sendMessage(answerText)
  }, [sendMessage])

  // 審批計畫
  const approvePlan = useCallback((approved: boolean, feedback?: string) => {
    setPendingPlanApproval(null)
    if (approved) {
      sendMessage('yes, 請開始執行計畫', 'edit')
    } else if (feedback) {
      sendMessage(feedback, 'plan')
    }
  }, [sendMessage])

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
  }, [setSessionId])

  const resumeSession = useCallback(async (targetSessionId: string) => {
    console.debug('[chat] resumeSession', targetSessionId, { hasAbortRef: !!abortRef.current })
    abortRef.current?.abort()
    setError(null)
    setStreamStatus('idle')
    setPendingQuestions(null)
    setPendingPlanApproval(null)
    setSessionMeta({ model: null, permissionMode: 'acceptEdits', totalInputTokens: 0, totalOutputTokens: 0 })
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
    } catch (err) {
      console.error('[chat] resumeSession load failed:', err)
    }

    setMessages([])
    setTodos([])
  }, [projectId, setSessionId])

  return { messages, todos, isStreaming, streamStatus, sessionId, sessionMeta, pendingQuestions, pendingPlanApproval, sendMessage, answerQuestion, approvePlan, stopStreaming, resetStreamStatus, clearChat, resumeSession, error }
}
