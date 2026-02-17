import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { loadAllProjects } from '@/lib/data'

interface SkillInfo {
  name: string
  description: string
  model?: string
  category?: string
}

async function parseFrontmatter(filePath: string): Promise<{ description: string; model?: string; category?: string }> {
  try {
    const content = await readFile(filePath, 'utf-8')
    let description = ''
    let model: string | undefined
    let category: string | undefined

    // 嘗試從 frontmatter 取 description、model、category
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
    if (fmMatch) {
      const descMatch = fmMatch[1].match(/description:\s*(.+)/)
      if (descMatch) description = descMatch[1].trim()
      const modelMatch = fmMatch[1].match(/model:\s*(.+)/)
      if (modelMatch) model = modelMatch[1].trim()
      const catMatch = fmMatch[1].match(/category:\s*(.+)/)
      if (catMatch) category = catMatch[1].trim()
    }

    // 沒有 description 時，取第一個 markdown 標題後的第一行非空文字
    if (!description) {
      const lines = content.split('\n')
      let pastFrontmatter = false
      let pastTitle = false
      for (const line of lines) {
        if (line.startsWith('---') && !pastFrontmatter) { pastFrontmatter = true; continue }
        if (pastFrontmatter && line.startsWith('---')) { pastFrontmatter = false; continue }
        if (pastFrontmatter) continue
        if (line.startsWith('#')) { pastTitle = true; continue }
        if (pastTitle && line.trim()) { description = line.trim(); break }
      }
    }

    return { description, model, category }
  } catch {
    return { description: '' }
  }
}

async function listSkills(dir: string, ext: string): Promise<SkillInfo[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    const results: SkillInfo[] = []
    for (const entry of entries) {
      if (ext === 'SKILL.md' && entry.isDirectory()) {
        const skillFile = join(dir, entry.name, 'SKILL.md')
        const { description, model, category } = await parseFrontmatter(skillFile)
        results.push({ name: entry.name, description, model, category })
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const name = entry.name.replace(/\.md$/, '')
        const { description, model, category } = await parseFrontmatter(join(dir, entry.name))
        results.push({ name, description, model, category })
      }
    }
    return results.sort((a, b) => a.name.localeCompare(b.name))
  } catch {
    return []
  }
}

async function listProjectSkills(projectPath: string): Promise<SkillInfo[]> {
  const skillsFromSkillsDir = await listSkills(join(projectPath, '.claude', 'skills'), 'SKILL.md')
  const skillsFromCommandsDir = await listSkills(join(projectPath, '.claude', 'commands'), '.md')
  return [...skillsFromSkillsDir, ...skillsFromCommandsDir]
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get('projectId')
  const allProjects = searchParams.get('allProjects') === 'true'

  // 全域 skills
  const homeDir = process.env.HOME || ''
  const globalSkills = await listSkills(join(homeDir, '.claude', 'skills'), 'SKILL.md')

  // 載入所有專案
  const projects = await loadAllProjects()

  if (allProjects) {
    // 批次查詢所有專案的 skills
    const projectSkills: Record<string, { name: string; skills: SkillInfo[] }> = {}
    for (const project of projects) {
      const projectPath = project.devPath || project.path
      const skills = await listProjectSkills(projectPath)
      if (skills.length > 0) {
        projectSkills[project.id] = { name: project.name, skills }
      }
    }
    return Response.json({ globalSkills, projectSkills })
  }

  // port-manager 使用 Todo-Dashboard 的 project-level skills
  // port-sync 是全域 skill，不需要在此重複宣告

  // 單一專案查詢
  let projectCommands: SkillInfo[] = []
  if (projectId === 'port-manager') {
    // port-manager 映射到 Todo-Dashboard 路徑，使用其 skill 檔案
    projectCommands = await listProjectSkills('/Users/ruanbaiye/Documents/Brickverse/Todo-Dashboard')
  } else if (projectId) {
    const project = projects.find(p => p.id === projectId)
    if (project) {
      const projectPath = project.devPath || project.path
      projectCommands = await listProjectSkills(projectPath)
    }
  }

  return Response.json({ globalSkills, projectCommands })
}
