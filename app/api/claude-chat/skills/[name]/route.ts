import { readFile } from 'fs/promises'
import { join } from 'path'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const homeDir = process.env.HOME || ''
  const skillPath = join(homeDir, '.claude', 'skills', name, 'SKILL.md')

  try {
    const content = await readFile(skillPath, 'utf-8')

    // Strip frontmatter for display
    const stripped = content.replace(/^---\n[\s\S]*?\n---\n*/, '')

    return Response.json({ name, content: stripped })
  } catch {
    return Response.json({ error: 'Skill not found' }, { status: 404 })
  }
}
