import { readJsonFile, flattenProjectsWithChildren } from '@/lib/data'
import type { Project } from '@/lib/types'
import { createSDKQuery } from '@/lib/claude-session-manager'
import type { SDKMessage } from '@/lib/claude-session-manager'

export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const { projectId, message, sessionId, mode, model } = await request.json()

    if (!projectId || !message) {
      return new Response(JSON.stringify({ error: 'Missing projectId or message' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 解析專案路徑
    const brickverseProjects = await readJsonFile<Project>('projects.json')
    const courseFiles = await readJsonFile<Project>('coursefiles.json')
    const utilityTools = await readJsonFile<Project>('utility-tools.json')
    const projects = flattenProjectsWithChildren([...brickverseProjects, ...courseFiles, ...utilityTools])
    const project = projects.find(p => p.id === projectId)

    if (!project) {
      return new Response(JSON.stringify({ error: 'Project not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const projectPath = project.devPath || project.path
    const newSessionId = sessionId || crypto.randomUUID()

    console.log('[claude-chat] creating SDK query', {
      sessionId: sessionId || 'new:' + newSessionId,
      projectId,
      mode,
      model,
    })

    const { queryInstance, abortController, toolStats } = createSDKQuery(
      projectPath,
      message,
      mode || 'plan',
      model,
      sessionId,                          // resume existing session
      sessionId ? undefined : newSessionId, // new session ID
    )

    // 監聽 client 斷開連線
    request.signal.addEventListener('abort', () => {
      console.log('[claude-chat] request.signal aborted — client disconnected')
      abortController.abort()
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

            // 其他事件類型（user replays, status, tool_progress 等）跳過
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
