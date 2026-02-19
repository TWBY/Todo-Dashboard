import { exec } from 'child_process'
import { promisify } from 'util'
import * as net from 'net'

const execAsync = promisify(exec)

// Stage 3: 嘗試升級 WebSocket 連線到 CDP debugger endpoint
// 取得第一個可用的 debugger WebSocket URL，然後做 HTTP Upgrade 握手
// 回傳 true = 握手成功, false = 失敗/timeout
function checkWsConnectable(wsDebuggerUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    const url = new URL(wsDebuggerUrl)
    const timer = setTimeout(() => {
      socket.destroy()
      resolve(false)
    }, 2000)

    const socket = net.createConnection({ host: url.hostname, port: Number(url.port) || 9222 }, () => {
      const key = Buffer.from(Math.random().toString()).toString('base64')
      const request = [
        `GET ${url.pathname} HTTP/1.1`,
        `Host: ${url.host}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${key}`,
        'Sec-WebSocket-Version: 13',
        '',
        '',
      ].join('\r\n')
      socket.write(request)
    })

    socket.on('data', (data) => {
      clearTimeout(timer)
      socket.destroy()
      // HTTP 101 Switching Protocols = WebSocket 握手成功
      resolve(data.toString().startsWith('HTTP/1.1 101'))
    })

    socket.on('error', () => {
      clearTimeout(timer)
      resolve(false)
    })
  })
}

export async function GET() {
  // Stage 1: port 9222 有沒有人監聽
  let portOpen = false
  try {
    const { stdout } = await execAsync('lsof -i :9222 -t')
    portOpen = !!stdout.trim()
  } catch {
    portOpen = false
  }

  // Stage 2: CDP 端點有沒有回應
  let cdpResponding = false
  let browser: string | null = null
  let wsDebuggerUrl: string | null = null
  if (portOpen) {
    try {
      const res = await fetch('http://localhost:9222/json/version', {
        signal: AbortSignal.timeout(1500),
      })
      if (res.ok) {
        const data = await res.json()
        cdpResponding = true
        browser = data.Browser || null
        wsDebuggerUrl = data.webSocketDebuggerUrl || null
      }
    } catch {
      cdpResponding = false
    }
  }

  // Stage 3: WebSocket session 是否真的能建立
  // 只有 Stage 2 成功且有 wsDebuggerUrl 時才測試
  let wsConnectable: boolean | null = null
  if (cdpResponding && wsDebuggerUrl) {
    wsConnectable = await checkWsConnectable(wsDebuggerUrl)
  }

  return Response.json({ portOpen, cdpResponding, wsConnectable, browser })
}
