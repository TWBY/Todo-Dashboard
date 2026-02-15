import { readChatMessages, writeChatMessages } from '@/lib/data'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  const sessionId = searchParams.get('sessionId')

  if (!projectId || !sessionId) {
    return new Response(JSON.stringify({ error: 'Missing projectId or sessionId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const messages = await readChatMessages(projectId, sessionId)

  return new Response(JSON.stringify({ messages }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function POST(request: Request) {
  try {
    const { projectId, sessionId, messages } = await request.json()

    if (!projectId || !sessionId || !messages) {
      return new Response(JSON.stringify({ error: 'Missing projectId, sessionId, or messages' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    await writeChatMessages(projectId, sessionId, messages)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to save messages' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
