import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export async function GET() {
  try {
    const { stdout } = await execAsync('lsof -i :9222 -t')
    const pid = stdout.trim()
    return Response.json({ active: !!pid, pid: pid || null })
  } catch {
    // lsof exits with code 1 if no processes found
    return Response.json({ active: false, pid: null })
  }
}
