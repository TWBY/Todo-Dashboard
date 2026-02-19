import { query } from '@anthropic-ai/claude-agent-sdk'
import type { Query, Options, PermissionMode, SDKMessage } from '@anthropic-ai/claude-agent-sdk'

/**
 * Claude Agent SDK Session Manager (V2)
 *
 * 逐字串流：includePartialMessages: true
 * 雙向互動：canUseTool callback 攔截 AskUserQuestion/ExitPlanMode，
 *           建立 pending Promise，由 /api/claude-chat/answer endpoint resolve。
 * 工具統計：透過 toolStats 累計工具使用次數。
 */

// --- Active Queries Map（用於 ExitPlanMode 後切換 permissionMode） ---

const activeQueries = new Map<string, Query>()

export function setActiveQuery(sessionId: string, q: Query) {
  activeQueries.set(sessionId, q)
}

export function getActiveQuery(sessionId: string): Query | undefined {
  return activeQueries.get(sessionId)
}

export function removeActiveQuery(sessionId: string) {
  activeQueries.delete(sessionId)
}

// --- Pending Requests Map（canUseTool 阻塞時暫存 Promise） ---

interface PendingRequest {
  resolve: (result: { behavior: 'allow'; updatedInput?: Record<string, unknown> } | { behavior: 'deny'; message: string }) => void
  reject: (error: Error) => void
  toolName: string
  input: Record<string, unknown>
  toolUseID: string
  timestamp: number
  timeoutHandle: ReturnType<typeof setTimeout>
}

const pendingRequests = new Map<string, PendingRequest>()

const PENDING_TIMEOUT_MS = 5 * 60 * 1000 // 5 分鐘

export function resolvePendingRequest(
  key: string,
  result: { behavior: 'allow'; updatedInput?: Record<string, unknown> } | { behavior: 'deny'; message: string },
): boolean {
  const pending = pendingRequests.get(key)
  if (!pending) return false
  clearTimeout(pending.timeoutHandle)
  pendingRequests.delete(key)
  pending.resolve(result)
  return true
}

export function hasPendingRequest(key: string): boolean {
  return pendingRequests.has(key)
}

// --- Tool Stats ---

export interface ToolStats {
  [toolName: string]: { count: number }
}

// --- Build Query Options ---

function buildQueryOptions(
  projectPath: string,
  mode: string,
  model?: string,
  existingSessionId?: string | null,
  newSessionId?: string,
  effort?: 'low' | 'medium' | 'high',
  systemPromptAppend?: string,
): Options {
  const permissionMode: PermissionMode = mode === 'edit' ? 'acceptEdits' : 'default'

  const opts: Options = {
    cwd: projectPath,
    additionalDirectories: [projectPath],
    permissionMode,
    settingSources: ['user', 'project'],
    systemPrompt: {
      type: 'preset',
      preset: 'claude_code',
      append: 'IMPORTANT: When your ExitPlanMode tool call is approved, the user has already confirmed they want you to proceed. Start implementing immediately without summarizing the plan again or asking for confirmation. Do NOT say things like "準備開始實作嗎？" or "Ready to start?" — just begin working.' + (systemPromptAppend ? '\n\n' + systemPromptAppend : ''),
    },
    includePartialMessages: true,
    env: {
      HOME: process.env.HOME || '',
      PATH: process.env.PATH || '',
      TMPDIR: process.env.TMPDIR || '/tmp',
    },
    mcpServers: {
      'arc-cdp': {
        type: 'stdio',
        command: 'npx',
        args: ['@playwright/mcp', '--cdp-endpoint', 'http://localhost:9222'],
      },
      'bot-browser': {
        type: 'stdio',
        command: 'npx',
        args: ['@playwright/mcp'],
      },
    },
  }

  if (model === 'haiku') {
    opts.model = 'haiku'
  } else if (model === 'sonnet') {
    opts.model = 'sonnet'
  } else if (model === 'opus') {
    opts.model = 'opus'
  }

  if (effort) {
    opts.effort = effort
  }

  if (existingSessionId) {
    opts.resume = existingSessionId
  } else if (newSessionId) {
    opts.sessionId = newSessionId as `${string}-${string}-${string}-${string}-${string}`
  }

  return opts
}

// --- Create SDK Query ---

export function createSDKQuery(
  projectPath: string,
  message: string,
  mode: string,
  model?: string,
  existingSessionId?: string | null,
  newSessionId?: string,
  effort?: 'low' | 'medium' | 'high',
  systemPromptAppend?: string,
): { queryInstance: Query; abortController: AbortController; toolStats: ToolStats } {
  const abortController = new AbortController()
  const sessionId = existingSessionId || newSessionId || 'unknown'
  const toolStats: ToolStats = {}

  const opts = buildQueryOptions(projectPath, mode, model, existingSessionId, newSessionId, effort, systemPromptAppend)
  opts.abortController = abortController

  // canUseTool：攔截 AskUserQuestion/ExitPlanMode
  opts.canUseTool = async (toolName: string, input: Record<string, unknown>, options: { toolUseID: string; signal: AbortSignal }) => {
    // 工具統計：計數
    if (!toolStats[toolName]) toolStats[toolName] = { count: 0 }
    toolStats[toolName].count++

    if (toolName !== 'AskUserQuestion' && toolName !== 'ExitPlanMode') {
      return { behavior: 'allow' as const }
    }

    const key = `${sessionId}:${options.toolUseID}`
    console.log(`[session-manager] canUseTool blocking: ${toolName}`, { key })

    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        pendingRequests.delete(key)
        reject(new Error(`User input timeout for ${toolName}`))
      }, PENDING_TIMEOUT_MS)

      // 如果 request abort，清理 pending
      options.signal.addEventListener('abort', () => {
        clearTimeout(timeoutHandle)
        pendingRequests.delete(key)
        reject(new Error('Request aborted'))
      }, { once: true })

      pendingRequests.set(key, {
        resolve,
        reject,
        toolName,
        input,
        toolUseID: options.toolUseID,
        timestamp: Date.now(),
        timeoutHandle,
      })
    })
  }

  console.log('[session-manager] creating query', {
    cwd: projectPath,
    mode,
    model: model || 'default',
    resume: existingSessionId || null,
    newSession: newSessionId || null,
  })
  console.log('[session-manager] opts.model:', opts.model, '| opts.effort:', opts.effort)

  const queryInstance = query({
    prompt: message,
    options: opts,
  })

  return { queryInstance, abortController, toolStats }
}

export type { SDKMessage, Query }
