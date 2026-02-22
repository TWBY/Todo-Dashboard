import { loadAllProjects } from '@/lib/data'
import { createSDKQuery, setActiveQuery, removeActiveQuery } from '@/lib/claude-session-manager'
import type { SDKMessage } from '@/lib/claude-session-manager'

export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const { projectId, message, sessionId, mode, model, effort, systemPromptAppend } = await request.json()

    if (!projectId || !message) {
      return new Response(JSON.stringify({ error: 'Missing projectId or message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 解析專案路徑
    const projects = await loadAllProjects()
    // 虛擬專案（不在 projects JSON 裡，但允許 Claude 在指定路徑工作）
    const VIRTUAL_PROJECTS: Record<string, string> = {
      'port-manager': '/Users/ruanbaiye/Documents/Brickverse/Todo-Dashboard',
      'chat-lab': '/Users/ruanbaiye/Documents/Brickverse/Todo-Dashboard',
    }

    const project = projects.find(p => p.id === projectId)
    const projectPath = VIRTUAL_PROJECTS[projectId] || (project ? (project.devPath || project.path) : null)

    if (!projectPath) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    const newSessionId = sessionId || crypto.randomUUID()

    console.log('[claude-chat] creating SDK query', {
      sessionId: sessionId || 'new:' + newSessionId,
      projectId,
      mode,
      model,
      effort,
    })

    const { queryInstance, abortController, toolStats } = createSDKQuery(
      projectPath,
      message,
      mode || 'plan',
      model,
      sessionId,                          // resume existing session
      sessionId ? undefined : newSessionId, // new session ID
      effort,
      systemPromptAppend,
    )

    // 註冊 activeQuery（供 /answer endpoint 在 ExitPlanMode 後切換 permissionMode）
    setActiveQuery(newSessionId, queryInstance)

    // 監聽 client 斷開連線
    request.signal.addEventListener('abort', () => {
      console.log('[claude-chat] request.signal aborted — client disconnected')
      abortController.abort()
      removeActiveQuery(newSessionId)
    })

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        const safeEnqueue = (data: string) => {
          try {
            controller.enqueue(encoder.encode(data))
          } catch {
            // Controller already closed
          }
        }

        // 先送 sessionId 給前端（與 CLI 版本一致）
        safeEnqueue(`data: ${JSON.stringify({ type: 'session', session_id: newSessionId })}\n\n`)

        let hasResult = false

        try {
          for await (const msg of queryInstance) {
            const sdkMsg = msg as SDKMessage & Record<string, unknown>

            // system init — 轉發模型資訊
            if (sdkMsg.type === 'system' && 'subtype' in sdkMsg && sdkMsg.subtype === 'init') {
              safeEnqueue(`data: ${JSON.stringify({
                type: 'system',
                subtype: 'init',
                session_id: (sdkMsg as { session_id: string }).session_id,
                model: (sdkMsg as { model: string }).model,
                tools: (sdkMsg as { tools: string[] }).tools,
                cwd: (sdkMsg as { cwd: string }).cwd,
              })}\n\n`)
              continue
            }

            // assistant — 直接轉發（SDK 的 BetaMessage 格式與 CLI stream-json 一致）
            if (sdkMsg.type === 'assistant') {
              hasResult = true
              const aMsg = sdkMsg as {
                type: 'assistant'
                message: { role: string; content: unknown[]; usage: unknown }
                session_id: string
              }
              safeEnqueue(`data: ${JSON.stringify({
                type: 'assistant',
                message: aMsg.message,
                session_id: aMsg.session_id,
              })}\n\n`)
              continue
            }

            // user — 包含 tool_result blocks（工具執行結果）
            if (sdkMsg.type === 'user') {
              const uMsg = sdkMsg as {
                type: 'user'
                message: { role: string; content: unknown }
                session_id: string
              }
              const content = uMsg.message?.content
              if (Array.isArray(content)) {
                for (const block of content) {
                  const b = block as Record<string, unknown>
                  if (b.type === 'tool_result') {
                    // tool_result block: { type, tool_use_id, content: string | Array }
                    const toolUseId = b.tool_use_id as string
                    let resultText = ''
                    if (typeof b.content === 'string') {
                      resultText = b.content
                    } else if (Array.isArray(b.content)) {
                      resultText = (b.content as Array<{ type: string; text?: string }>)
                        .filter(c => c.type === 'text' && c.text)
                        .map(c => c.text!)
                        .join('\n')
                    }
                    if (toolUseId && resultText) {
                      safeEnqueue(`data: ${JSON.stringify({
                        type: 'tool_result',
                        tool_use_id: toolUseId,
                        content: resultText,
                      })}\n\n`)
                    }
                  }
                }
              }
              continue
            }

            // result — 映射欄位
            if (sdkMsg.type === 'result') {
              hasResult = true
              const rMsg = sdkMsg as {
                type: 'result'
                subtype: string
                is_error: boolean
                result?: string
                duration_ms: number
                total_cost_usd: number
                session_id: string
                errors?: string[]
              }
              safeEnqueue(`data: ${JSON.stringify({
                type: 'result',
                subtype: rMsg.subtype === 'success' ? 'success' : rMsg.subtype,
                is_error: rMsg.is_error,
                result: rMsg.result || '',
                duration_ms: rMsg.duration_ms,
                total_cost_usd: rMsg.total_cost_usd,
                session_id: rMsg.session_id,
                errors: rMsg.errors,
              })}\n\n`)
              continue
            }

            // stream_event — 逐字串流（includePartialMessages: true）
            if (sdkMsg.type === 'stream_event') {
              hasResult = true
              const streamMsg = sdkMsg as {
                type: 'stream_event'
                event: Record<string, unknown>
                session_id: string
              }
              safeEnqueue(`data: ${JSON.stringify({
                type: 'stream',
                event: streamMsg.event,
              })}\n\n`)
              continue
            }

            // 其他事件類型 — log 以便 debug
            console.log('[claude-chat] unhandled SDK message type:', sdkMsg.type, JSON.stringify(sdkMsg).slice(0, 500))
          }
        } catch (err) {
          if (err instanceof Error && err.name !== 'AbortError') {
            console.error('[claude-chat] SDK query error:', err)
            safeEnqueue(`data: ${JSON.stringify({
              type: 'error',
              message: err.message,
            })}\n\n`)
          }
        }

        removeActiveQuery(newSessionId)

        if (!hasResult) {
          safeEnqueue(`data: ${JSON.stringify({
            type: 'error',
            message: 'SDK query 未產生任何回應',
          })}\n\n`)
        }

        // 工具統計
        if (Object.keys(toolStats).length > 0) {
          safeEnqueue(`data: ${JSON.stringify({
            type: 'tool_stats',
            stats: toolStats,
          })}\n\n`)
        }

        safeEnqueue('data: [DONE]\n\n')
        try {
          controller.close()
        } catch {
          // Already closed
        }
      },
      cancel() {
        console.log('[claude-chat] ReadableStream cancel() — aborting SDK query')
        abortController.abort()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Claude chat error:', error)
    return new Response(JSON.stringify({ error: 'Failed to process request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
