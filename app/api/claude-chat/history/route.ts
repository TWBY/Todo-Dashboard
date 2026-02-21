import { readChatHistory, writeChatHistory, cleanExpiredChatMessages } from '@/lib/data'
import type { ChatSessionRecord } from '@/lib/claude-chat-types'

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')

  if (!projectId) {
    return new Response(JSON.stringify({ error: 'Missing projectId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const records = await readChatHistory(projectId)
  const cutoff = Date.now() - FOURTEEN_DAYS_MS
  const recent = records
    .filter(r => r.lastActiveAt >= cutoff)
    .sort((a, b) => b.lastActiveAt - a.lastActiveAt)

  return new Response(JSON.stringify({ sessions: recent }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(request: Request) {
  try {
    const { projectId, sessionId, title, messageCount, totalCostUsd, totalDurationMs, model, totalInputTokens, totalOutputTokens } = await request.json()

    if (!projectId || !sessionId) {
      return new Response(JSON.stringify({ error: 'Missing projectId or sessionId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const records = await readChatHistory(projectId)
    const now = Date.now()

    // Clean up records older than 30 days
    const cleanCutoff = now - THIRTY_DAYS_MS
    const cleaned = records.filter(r => r.lastActiveAt >= cleanCutoff)

    const existing = cleaned.find(r => r.sessionId === sessionId)
    if (existing) {
      existing.lastActiveAt = now
      if (messageCount !== undefined) existing.messageCount = messageCount
      if (title && !existing.title) existing.title = title
      if (totalCostUsd !== undefined) existing.totalCostUsd = totalCostUsd
      if (totalDurationMs !== undefined) existing.totalDurationMs = totalDurationMs
      if (model) existing.model = model
      if (totalInputTokens !== undefined) existing.totalInputTokens = totalInputTokens
      if (totalOutputTokens !== undefined) existing.totalOutputTokens = totalOutputTokens
    } else {
      cleaned.push({
        sessionId,
        projectId,
        title: title || 'Untitled',
        messageCount: messageCount || 1,
        createdAt: now,
        lastActiveAt: now,
        ...(totalCostUsd !== undefined && { totalCostUsd }),
        ...(totalDurationMs !== undefined && { totalDurationMs }),
        ...(model && { model }),
        ...(totalInputTokens !== undefined && { totalInputTokens }),
        ...(totalOutputTokens !== undefined && { totalOutputTokens }),
      } satisfies ChatSessionRecord)
    }

    await writeChatHistory(projectId, cleaned)

    // 順便清理超過 2 天的 chat-messages 檔案
    cleanExpiredChatMessages(projectId, FOURTEEN_DAYS_MS).catch(() => {})

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to save history' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
