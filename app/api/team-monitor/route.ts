import { NextRequest, NextResponse } from 'next/server'
import { readFile, readdir } from 'fs/promises'
import path from 'path'

const CLAUDE_DIR = path.join(process.env.HOME || '/root', '.claude')

export async function GET(request: NextRequest) {
  const teamName = request.nextUrl.searchParams.get('name')
  if (!teamName) {
    return NextResponse.json({ error: 'Missing team name' }, { status: 400 })
  }

  // DEV mock: redirect to mock endpoint
  if (teamName === '__mock__') {
    const mockUrl = new URL('/api/team-monitor/mock', request.nextUrl.origin)
    const mockRes = await fetch(mockUrl)
    const mockData = await mockRes.json()
    return NextResponse.json(mockData)
  }

  const teamDir = path.join(CLAUDE_DIR, 'teams', teamName)
  const taskDir = path.join(CLAUDE_DIR, 'tasks', teamName)

  try {
    // 1. Read team config
    const configRaw = await readFile(path.join(teamDir, 'config.json'), 'utf-8')
    const config = JSON.parse(configRaw)

    // 2. Read tasks
    const tasks: Array<{ id: string; description: string; status: string; owner?: string }> = []
    try {
      const taskFiles = await readdir(taskDir)
      for (const f of taskFiles) {
        if (!f.endsWith('.json')) continue
        try {
          const raw = await readFile(path.join(taskDir, f), 'utf-8')
          const task = JSON.parse(raw)
          let title = ''
          if (task.description) {
            const desc = String(task.description)
            const firstLine = desc.split('\n').find(l => l.trim().length > 0)?.trim() || ''
            title = firstLine.replace(/^#+\s*/, '').slice(0, 60)
            if (firstLine.length > 60) title += '...'
          }
          tasks.push({
            id: task.id,
            description: title || `Task ${task.id}`,
            status: task.status || 'pending',
            owner: task.subject || undefined,
          })
        } catch { /* skip malformed task files */ }
      }
    } catch { /* no task directory */ }

    // 3. Read ALL inbox messages (every recipient's inbox = bidirectional view)
    const allMessages: Array<{
      from: string; to: string; summary: string; text?: string
      timestamp: string; color?: string; type: string
    }> = []

    const inboxDir = path.join(teamDir, 'inboxes')
    try {
      const inboxFiles = await readdir(inboxDir)
      for (const f of inboxFiles) {
        if (!f.endsWith('.json')) continue
        const recipientName = f.replace('.json', '')
        try {
          const raw = await readFile(path.join(inboxDir, f), 'utf-8')
          const inboxMessages = JSON.parse(raw) as Array<{
            from: string; text: string; summary?: string; timestamp: string; color?: string
          }>
          for (const msg of inboxMessages) {
            let msgType: string = 'message'
            let summary = msg.summary || ''
            let text: string | undefined = msg.text

            // Detect structured notifications from JSON text
            try {
              const parsed = JSON.parse(msg.text)
              if (parsed.type === 'idle_notification') {
                msgType = 'idle'
                summary = parsed.lastToolUse
                  ? `${msg.from} 閒置中（上次操作：${parsed.lastToolUse}）`
                  : `${msg.from} 閒置中`
                text = undefined
              } else if (parsed.type === 'shutdown_request') {
                msgType = 'shutdown'
                summary = parsed.content || parsed.reason || '要求關閉'
                text = undefined
              } else if (parsed.type === 'shutdown_response') {
                msgType = 'shutdown'
                summary = parsed.approve ? `${msg.from} 已確認關閉` : `${msg.from} 拒絕關閉：${parsed.content || ''}`
                text = undefined
              }
            } catch { /* not JSON, use raw text */ }

            allMessages.push({
              from: msg.from,
              to: recipientName,
              summary: summary || (msg.text?.slice(0, 80) ?? ''),
              text: msgType === 'message' ? text : undefined,
              timestamp: msg.timestamp,
              color: msg.color,
              type: msgType,
            })
          }
        } catch { /* skip malformed inbox files */ }
      }
    } catch { /* no inbox directory */ }

    // Sort all messages by timestamp
    allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // 4. Build member status from task status + message activity
    const members = (config.members || []).map((m: { name: string; agentId: string; agentType: string; color?: string }) => {
      const memberSentMessages = allMessages.filter(msg => msg.from === m.name)
      const lastSent = memberSentMessages[memberSentMessages.length - 1]

      // Check if member has any in_progress task
      const hasActiveTask = tasks.some(t => t.owner === m.name && t.status === 'in_progress')

      // Determine status:
      // 1. Last message is shutdown → shutdown
      // 2. Has in_progress task → working
      // 3. Last message is idle → idle
      // 4. No messages yet → working (just spawned)
      // 5. Otherwise → idle
      let status: 'working' | 'idle' | 'shutdown' = 'idle'
      if (lastSent?.type === 'shutdown') {
        status = 'shutdown'
      } else if (hasActiveTask) {
        status = 'working'
      } else if (!lastSent) {
        status = 'working' // just spawned, no messages yet
      } else if (lastSent.type === 'idle') {
        status = 'idle'
      }

      return {
        name: m.name,
        agentId: m.agentId,
        agentType: m.agentType,
        color: m.color || undefined,
        status,
      }
    })

    // 5. Separate messages into user messages and system events
    const userMessages = allMessages.filter(m => m.type === 'message')
    const systemEvents = allMessages
      .filter(m => m.type === 'idle' || m.type === 'shutdown')
      .map(m => ({
        type: m.type,
        from: m.from,
        summary: m.summary,
        timestamp: m.timestamp,
      }))

    return NextResponse.json({
      teamName: config.name,
      description: config.description,
      createdAt: config.createdAt,
      members,
      tasks: tasks.sort((a, b) => Number(a.id) - Number(b.id)),
      messages: userMessages,
      systemEvents,
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Team "${teamName}" not found`, detail: String(err) },
      { status: 404 }
    )
  }
}
