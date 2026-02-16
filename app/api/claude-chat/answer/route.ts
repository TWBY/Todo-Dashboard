import { resolvePendingRequest, hasPendingRequest, getActiveQuery } from '@/lib/claude-session-manager'

export async function POST(request: Request) {
  try {
    const { sessionId, toolUseID, type, answers, approved, feedback } = await request.json()

    if (!sessionId || !toolUseID) {
      return new Response(JSON.stringify({ error: 'Missing sessionId or toolUseID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const key = `${sessionId}:${toolUseID}`
    console.log('[claude-chat/answer] received', { key, type, approved, hasPending: hasPendingRequest(key) })

    // 輪詢等待 pending request（解決 timing race：前端從 stream 偵測到 ExitPlanMode
    // 早於 server 端 canUseTool callback 建立 pending request）
    if (!hasPendingRequest(key)) {
      const maxWait = 5000
      const interval = 200
      let waited = 0
      while (!hasPendingRequest(key) && waited < maxWait) {
        await new Promise(r => setTimeout(r, interval))
        waited += interval
      }
      if (!hasPendingRequest(key)) {
        return new Response(JSON.stringify({ error: 'No pending request found', key }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        })
      }
    }

    let resolved = false

    if (type === 'question') {
      resolved = resolvePendingRequest(key, {
        behavior: 'allow',
        updatedInput: answers ? { answers } : undefined,
      })
    } else if (type === 'planApproval') {
      if (approved) {
        resolved = resolvePendingRequest(key, { behavior: 'allow' })
        // ExitPlanMode 批准後，切換 SDK 的 permissionMode 到 acceptEdits
        // 否則 SDK 仍停留在 plan mode，後續工具呼叫全部會被擋下
        const q = getActiveQuery(sessionId)
        if (q) {
          try {
            await q.setPermissionMode('acceptEdits')
            console.log('[claude-chat/answer] permissionMode switched to acceptEdits')
          } catch (err) {
            console.error('[claude-chat/answer] setPermissionMode failed:', err)
          }
        }
      } else {
        resolved = resolvePendingRequest(key, {
          behavior: 'deny',
          message: feedback || '用戶拒絕了計畫',
        })
      }
    } else {
      return new Response(JSON.stringify({ error: 'Invalid type' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: resolved }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('[claude-chat/answer] error:', error)
    return new Response(JSON.stringify({ error: 'Failed to process answer' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
