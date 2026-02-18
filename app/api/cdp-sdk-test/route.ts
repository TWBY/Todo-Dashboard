import { spawn } from 'child_process'

export async function GET() {
  // 直接 spawn playwright-mcp 做 JSON-RPC 握手
  // 若成功代表 SDK 子進程也能連上 arc-cdp
  return new Promise<Response>((resolve) => {
    const timeout = setTimeout(() => {
      proc.kill()
      resolve(Response.json({ ok: false, error: 'timeout' }))
    }, 4000)

    const proc = spawn('npx', ['@playwright/mcp', '--cdp-endpoint', 'http://localhost:9222'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let buf = ''
    let settled = false

    const done = (ok: boolean, detail?: string) => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      proc.kill()
      resolve(Response.json({ ok, detail: detail ?? null }))
    }

    proc.stdout.on('data', (chunk: Buffer) => {
      buf += chunk.toString()
      // 收到任何 JSON-RPC 回應就算成功
      const lines = buf.split('\n')
      for (const line of lines) {
        if (line.trim().startsWith('{')) {
          try {
            JSON.parse(line.trim())
            done(true, 'mcp handshake ok')
            return
          } catch { /* 繼續等 */ }
        }
      }
    })

    proc.stderr.on('data', (chunk: Buffer) => {
      const msg = chunk.toString()
      // playwright-mcp 啟動時會在 stderr 印出 "Listening..." 類訊息
      if (msg.includes('Listening') || msg.includes('listening') || msg.includes('ready') || msg.includes('Browser')) {
        done(true, 'mcp server started')
      }
    })

    proc.on('error', (err: Error) => done(false, err.message))
    proc.on('close', (code: number | null) => {
      if (!settled) done(false, `exited with code ${code}`)
    })

    // 送 JSON-RPC initialize
    const initMsg = JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'cdp-sdk-test', version: '1.0' },
      },
    })
    proc.stdin.write(initMsg + '\n')
  })
}
