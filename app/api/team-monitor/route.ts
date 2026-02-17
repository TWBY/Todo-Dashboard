import { NextRequest, NextResponse } from 'next/server'
import { readFile, readdir } from 'fs/promises'
import path from 'path'

const CLAUDE_DIR = path.join(process.env.HOME || '/root', '.claude')

export async function GET(request: NextRequest) {
  const teamName = request.nextUrl.searchParams.get('name')
  if (!teamName) {
    return NextResponse.json({ error: 'Missing team name' }, { status: 400 })
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
          // 擷取簡短標題：優先用 subject 角色名，否則取 description 第一行（去掉 markdown 標記）
          let title = ''
          if (task.description) {
            const desc = String(task.description)
            // 取第一行非空文字，去掉 markdown # 和 ## 前綴
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

    // 3. Read all inbox messages
    const messages: Array<{ from: string; to: string; summary: string; text?: string; timestamp: string; color?: string; type?: string }> = []
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
            // Detect idle/shutdown notifications from JSON text
            let msgType: string = 'message'
            let summary = msg.summary || ''
            try {
              const parsed = JSON.parse(msg.text)
              if (parsed.type === 'idle_notification') {
                msgType = 'idle'
                summary = `${msg.from} is idle`
              } else if (parsed.type === 'shutdown_request') {
                msgType = 'shutdown'
                summary = parsed.reason || 'Shutdown requested'
              }
            } catch { /* not JSON, use raw text */ }

            messages.push({
              from: msg.from,
              to: recipientName,
              summary: summary || msg.text?.slice(0, 80) || '',
              text: msgType === 'message' ? msg.text : undefined,
              timestamp: msg.timestamp,
              color: msg.color,
              type: msgType,
            })
          }
        } catch { /* skip malformed inbox files */ }
      }
    } catch { /* no inbox directory */ }

    // Sort messages by timestamp
    messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    // Build member status from inbox activity
    const members = (config.members || []).map((m: { name: string; agentId: string; agentType: string; color?: string }) => {
      // Check if member has sent an idle notification as their last message
      const memberMessages = messages.filter(msg => msg.from === m.name)
      const lastMsg = memberMessages[memberMessages.length - 1]
      const status = lastMsg?.type === 'idle' ? 'idle'
        : lastMsg?.type === 'shutdown' ? 'shutdown'
        : memberMessages.length > 0 ? 'idle' // has sent messages but no explicit status → assume idle (historical data)
        : 'working' // no messages yet → might still be working
      return {
        name: m.name,
        agentId: m.agentId,
        agentType: m.agentType,
        color: m.color || undefined,
        status,
      }
    })

    return NextResponse.json({
      teamName: config.name,
      description: config.description,
      createdAt: config.createdAt,
      members,
      tasks: tasks.sort((a, b) => Number(a.id) - Number(b.id)),
      messages: messages.filter(m => m.type === 'message'), // Only real messages, not idle/shutdown
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Team "${teamName}" not found`, detail: String(err) },
      { status: 404 }
    )
  }
}
