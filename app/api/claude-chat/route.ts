import { spawn, type ChildProcess } from 'child_process'
import { readJsonFile, flattenProjectsWithChildren } from '@/lib/data'
import type { Project } from '@/lib/types'

export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const { projectId, message, sessionId, mode, ideaMode, model } = await request.json()

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

    const args = [
      '--print',
      '--output-format', 'stream-json',
      '--verbose',
      '--add-dir', projectPath,
      '--permission-mode', mode === 'edit' ? 'acceptEdits' : 'plan',
    ]

    // ideaMode：使用最便宜的模型 (haiku)
    if (ideaMode) {
      args.push('--model', 'haiku')
    } else if (model === 'opus') {
      args.push('--model', 'opus')
    }

    // 若有 sessionId 代表續接對話，否則建立新 session
    if (sessionId) {
      args.push('--resume', sessionId)
    } else {
      args.push('--session-id', newSessionId)
    }

    args.push('-p', message)

    const claudePath = '/Users/ruanbaiye/.local/bin/claude'
    // 清除 Claude Code 環境變數，避免嵌套檢測導致子進程阻塞
    const cleanEnv: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (value && !key.startsWith('CLAUDE') && !key.startsWith('CURSOR_SPAWN')) {
        cleanEnv[key] = value
      }
    }
    cleanEnv.PATH = `${process.env.HOME}/.local/bin:${cleanEnv.PATH || ''}`
    cleanEnv.HOME = process.env.HOME || ''

    console.log('[claude-chat] spawning CLI', { sessionId: sessionId || 'new:' + newSessionId, projectId, argsLen: args.length })

    const child: ChildProcess = spawn(claudePath, args, {
      cwd: projectPath,
      env: cleanEnv as NodeJS.ProcessEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    console.log('[claude-chat] child spawned', { pid: child.pid })

    // 監聽 request abort（客戶端斷開連線）
    request.signal.addEventListener('abort', () => {
      console.log('[claude-chat] ⚠️ request.signal aborted — client disconnected', { pid: child.pid })
    })

    // 用 line buffer 處理跨 chunk 的 NDJSON
    let lineBuffer = ''
    let hasStdout = false
    let hasResult = false  // 追蹤是否收到有意義的回應（assistant 或 result 事件）

    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()

        // 先送 sessionId 給前端
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'session', session_id: newSessionId })}\n\n`))

        child.stdout?.on('data', (chunk: Buffer) => {
          hasStdout = true
          lineBuffer += chunk.toString()
          const lines = lineBuffer.split('\n')
          // 最後一段可能不完整，保留
          lineBuffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed) {
              controller.enqueue(encoder.encode(`data: ${trimmed}\n\n`))
              // 追蹤是否收到有意義的回應事件
              if (!hasResult) {
                try {
                  const parsed = JSON.parse(trimmed)
                  if (parsed.type === 'assistant' || parsed.type === 'result') {
                    hasResult = true
                  }
                } catch { /* not valid JSON, ignore */ }
              }
            }
          }
        })

        let stderrBuffer = ''
        child.stderr?.on('data', (chunk: Buffer) => {
          const text = chunk.toString().trim()
          if (text) {
            stderrBuffer += text + '\n'
            // 不即時轉發 stderr — verbose 模式會產生大量非錯誤輸出
            // 真正的錯誤在 close 事件中處理（結合 exit code + hasStdout 判斷）
          }
        })

        child.on('close', (code) => {
          const safeEnqueue = (data: Uint8Array) => {
            try {
              controller.enqueue(data)
            } catch (err) {
              // Controller already closed, ignore
            }
          }

          // DEBUG: 總是記錄 stderr（包含成功情況，幫助診斷）
          if (stderrBuffer.trim()) {
            console.log(`[claude-chat] stderr output (code: ${code}):`, stderrBuffer.trim().slice(0, 500))
          }

          // 處理 buffer 中剩餘的資料
          if (lineBuffer.trim()) {
            safeEnqueue(encoder.encode(`data: ${lineBuffer.trim()}\n\n`))
          }

          // 錯誤偵測：分三種情境
          if (!hasStdout) {
            // 情境 1：完全沒有 stdout
            const exitMsg = code !== 0
              ? `Claude CLI 異常退出 (exit code: ${code})${stderrBuffer ? '\n' + stderrBuffer.trim() : ''}`
              : 'Claude CLI 未產生任何回應，可能是記憶體不足或進程被系統終止。'
            console.error(`[claude-chat] ${exitMsg}`)
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: exitMsg })}\n\n`))
          } else if (!hasResult) {
            // 情境 2：有 stdout（如 init 事件）但沒有實際回應
            const exitMsg = `Claude CLI 已啟動但未產生回應 (exit code: ${code ?? 'null'})。可能是 cold-start 超時或內部錯誤。`
            console.error(`[claude-chat] ${exitMsg}`)
            safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: exitMsg })}\n\n`))
          } else if (code !== 0 && code !== null) {
            // 情境 3：有回應但 exit code 非 0
            const lastStderr = stderrBuffer.trim().split('\n').slice(-3).join('\n')
            if (lastStderr) {
              console.error(`[claude-chat] CLI exited with code ${code}, stderr: ${lastStderr}`)
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: `CLI 異常退出 (code: ${code}): ${lastStderr}` })}\n\n`))
            }
          }

          safeEnqueue(encoder.encode('data: [DONE]\n\n'))
          try {
            controller.close()
          } catch {
            // Already closed
          }
        })

        child.on('error', (err: Error) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`))
          controller.close()
        })
      },
      cancel() {
        console.log('[claude-chat] ⚠️ ReadableStream cancel() called — killing child process', { pid: child.pid })
        console.trace('[claude-chat] cancel() call stack')
        child.kill()
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
