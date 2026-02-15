import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export async function POST(request: Request) {
  try {
    const { message } = await request.json()

    if (!message) {
      return Response.json({ model: 'sonnet' })
    }

    const prompt = `你是一個任務分類器。根據以下使用者訊息，判斷應該使用哪個 AI 模型：

- "opus"：適合複雜任務，例如：大規模重構、架構設計、多檔案修改、複雜 debug、效能優化、安全審查、程式碼審計
- "sonnet"：適合一般任務，例如：簡單修改、問答、單一功能開發、小 bug 修復、格式調整

只回覆一個單字："opus" 或 "sonnet"，不要有其他文字。

使用者訊息：
${message.slice(0, 500)}`

    const claudePath = '/Users/ruanbaiye/.local/bin/claude'
    const cleanEnv: Record<string, string> = {}
    for (const [key, value] of Object.entries(process.env)) {
      if (value && !key.startsWith('CLAUDE') && !key.startsWith('CURSOR_SPAWN')) {
        cleanEnv[key] = value
      }
    }
    cleanEnv.PATH = `${process.env.HOME}/.local/bin:${cleanEnv.PATH || ''}`
    cleanEnv.HOME = process.env.HOME || ''

    const { stdout } = await execFileAsync(claudePath, [
      '--print',
      '--model', 'haiku',
      '--no-session-persistence',
      '-p', prompt,
    ], {
      env: cleanEnv as NodeJS.ProcessEnv,
      timeout: 10000,
    })

    const result = stdout.trim().toLowerCase()
    const model = result.includes('opus') ? 'opus' : 'sonnet'

    console.log(`[classify] "${message.slice(0, 60)}..." → ${model}`)
    return Response.json({ model })
  } catch (error) {
    console.error('[classify] error:', error)
    return Response.json({ model: 'sonnet' })
  }
}
