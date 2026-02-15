import { execSync } from 'child_process'

export async function GET() {
  try {
    const raw = execSync(
      'git log --format="%h|%s|%ai"',
      { encoding: 'utf-8', cwd: process.cwd() }
    ).trim()

    if (!raw) {
      return Response.json([])
    }

    const entries = raw.split('\n').map(line => {
      const [hash, message, dateStr] = line.split('|')

      // release commit: "release: vX.Y.Z — summary"
      const releaseMatch = message.match(/^release:\s*(v[\d.]+)\s*[—–-]\s*(.+)$/)
      if (releaseMatch) {
        return {
          version: releaseMatch[1],
          summary: releaseMatch[2],
          hash,
          date: formatDateTime(dateStr),
          type: 'release' as const,
        }
      }

      // 一般 commit
      return {
        version: '',
        summary: message,
        hash,
        date: formatDateTime(dateStr),
        type: 'commit' as const,
      }
    })

    return Response.json(entries)
  } catch {
    return Response.json([])
  }
}

function formatDateTime(dateStr: string): string {
  if (!dateStr) return ''
  // dateStr format: "2026-02-15 14:50:12 +0800"
  const parts = dateStr.trim().split(' ')
  if (parts.length < 2) return dateStr
  // 回傳 "2026-02-15 14:50"
  const time = parts[1].split(':').slice(0, 2).join(':')
  return `${parts[0]} ${time}`
}
