import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

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
  if (portOpen) {
    try {
      const res = await fetch('http://localhost:9222/json/version', {
        signal: AbortSignal.timeout(1500),
      })
      if (res.ok) {
        const data = await res.json()
        cdpResponding = true
        browser = data.Browser || null
      }
    } catch {
      cdpResponding = false
    }
  }

  return Response.json({ portOpen, cdpResponding, browser })
}
