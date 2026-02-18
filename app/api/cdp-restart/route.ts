import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function POST(request: Request) {
  const { cdp } = await request.json().catch(() => ({ cdp: true }))
  const cmd = cdp
    ? 'pkill -a Arc; sleep 1; open -a Arc --args --remote-debugging-port=9222'
    : 'pkill -a Arc; sleep 1; open -a Arc'
  try {
    await execAsync(cmd)
  } catch {
    // pkill 如果 Arc 沒在跑會 exit code 1，open 仍成功，忽略
  }
  return Response.json({ ok: true })
}
