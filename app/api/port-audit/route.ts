import { NextResponse } from 'next/server'
import { readFile, writeFile, access } from 'fs/promises'
import path from 'path'
import { readJsonFile, flattenProjectsWithChildren } from '@/lib/data'
import type { Project } from '@/lib/types'

interface AuditEntry {
  name: string
  port: number
  path: string
  source: 'brickverse' | 'coursefiles' | 'utility'
  packageJson: 'correct' | 'missing-port' | 'wrong-port' | 'no-file'
  packageJsonDetail?: string
  localClaude: 'registered' | 'no-port' | 'wrong-port' | 'no-file'
  localClaudePath?: string
  localClaudeDetail?: string
}

// 讀取 package.json 並檢查 dev script 的 port
async function checkPackageJson(projectPath: string, expectedPort: number): Promise<Pick<AuditEntry, 'packageJson' | 'packageJsonDetail'>> {
  try {
    const pkgPath = path.join(projectPath, 'package.json')
    await access(pkgPath)
    const content = await readFile(pkgPath, 'utf-8')
    const pkg = JSON.parse(content)
    const devScript: string | undefined = pkg.scripts?.dev

    if (!devScript) {
      return { packageJson: 'no-file', packageJsonDetail: '無 scripts.dev' }
    }

    // 檢查 port：-p <port> 或 --port <port>
    const portMatch = devScript.match(/(?:-p|--port)\s+(\d+)/)
    if (!portMatch) {
      // Todo-Dashboard port 3000 是預設值，不需要寫 -p
      if (expectedPort === 3000) {
        return { packageJson: 'correct', packageJsonDetail: devScript }
      }
      return { packageJson: 'missing-port', packageJsonDetail: devScript }
    }

    const actualPort = parseInt(portMatch[1])
    if (actualPort === expectedPort) {
      return { packageJson: 'correct', packageJsonDetail: devScript }
    }

    return { packageJson: 'wrong-port', packageJsonDetail: `${devScript}（應為 ${expectedPort}）` }
  } catch {
    return { packageJson: 'no-file', packageJsonDetail: '找不到 package.json' }
  }
}

// 檢查區域 CLAUDE.md 的 port 登記
async function checkLocalClaude(projectPath: string, expectedPort: number): Promise<Pick<AuditEntry, 'localClaude' | 'localClaudePath' | 'localClaudeDetail'>> {
  // 先檢查 .claude/CLAUDE.md，再檢查根目錄 CLAUDE.md
  const candidates = [
    path.join(projectPath, '.claude', 'CLAUDE.md'),
    path.join(projectPath, 'CLAUDE.md'),
  ]

  for (const filePath of candidates) {
    try {
      await access(filePath)
      const content = await readFile(filePath, 'utf-8')
      const relativePath = filePath.replace(projectPath + '/', '')

      // 檢查是否包含 port 數字
      const portPattern = new RegExp(`\\b${expectedPort}\\b`)
      if (portPattern.test(content)) {
        return { localClaude: 'registered', localClaudePath: relativePath }
      }

      // 有檔案但沒有正確的 port
      const anyPortMatch = content.match(/`(\d{4})`/)
      if (anyPortMatch) {
        return {
          localClaude: 'wrong-port',
          localClaudePath: relativePath,
          localClaudeDetail: `登記為 ${anyPortMatch[1]}，應為 ${expectedPort}`,
        }
      }

      return {
        localClaude: 'no-port',
        localClaudePath: relativePath,
        localClaudeDetail: '有 CLAUDE.md 但未登記 port',
      }
    } catch {
      // 檔案不存在，繼續檢查下一個候選
    }
  }

  return { localClaude: 'no-file', localClaudeDetail: '無 CLAUDE.md' }
}

export async function GET() {
  try {
    const brickverseProjects = await readJsonFile<Project>('projects.json')
    const courseFiles = await readJsonFile<Project>('coursefiles.json')
    const utilityTools = await readJsonFile<Project>('utility-tools.json')

    const brickverseFlat = flattenProjectsWithChildren(brickverseProjects).map(p => ({ ...p, source: 'brickverse' as const }))
    const courseFlat = flattenProjectsWithChildren(courseFiles).map(p => ({ ...p, source: 'coursefiles' as const }))
    const utilityFlat = flattenProjectsWithChildren(utilityTools).map(p => ({ ...p, source: 'utility' as const }))
    const allProjects = [...brickverseFlat, ...courseFlat, ...utilityFlat].filter(p => p.devPort)

    const entries: AuditEntry[] = await Promise.all(
      allProjects.map(async (project) => {
        const projectPath = project.devPath || project.path
        const port = project.devPort!

        const [pkgResult, claudeResult] = await Promise.all([
          checkPackageJson(projectPath, port),
          checkLocalClaude(projectPath, port),
        ])

        return {
          name: project.name,
          port,
          path: projectPath,
          source: project.source,
          ...pkgResult,
          ...claudeResult,
        }
      })
    )

    // 按 port 排序
    entries.sort((a, b) => a.port - b.port)

    // 統計
    const stats = {
      total: entries.length,
      packageJsonOk: entries.filter(e => e.packageJson === 'correct').length,
      localClaudeOk: entries.filter(e => e.localClaude === 'registered').length,
      fullyRegistered: entries.filter(e => e.packageJson === 'correct' && e.localClaude === 'registered').length,
    }

    return NextResponse.json({ entries, stats })
  } catch (error) {
    console.error('Port audit error:', error)
    return NextResponse.json({ error: 'Audit failed' }, { status: 500 })
  }
}

// --- 一鍵修復 ---

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true } catch { return false }
}

const DEV_SERVER_TABLE = (port: number) =>
  `\n## Dev Server\n\n| 環境 | Port | 指令 |\n|------|------|------|\n| 開發 | \`${port}\` | \`npm run dev\` |\n`

async function fixPackageJson(projectPath: string, port: number): Promise<string> {
  const pkgPath = path.join(projectPath, 'package.json')
  if (!await fileExists(pkgPath)) return 'no-file'
  try {
    const raw = await readFile(pkgPath, 'utf-8')
    const pkg = JSON.parse(raw)
    if (!pkg.scripts?.dev) return 'no-scripts-dev'
    const cleaned = pkg.scripts.dev.replace(/\s+-p\s+\d+/g, '').replace(/\s+--port\s+\d+/g, '')
    pkg.scripts.dev = `${cleaned} -p ${port}`
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
    return 'fixed'
  } catch { return 'error' }
}

async function fixClaudeMd(projectPath: string, port: number): Promise<string> {
  const dotClaudePath = path.join(projectPath, '.claude', 'CLAUDE.md')
  const rootClaudePath = path.join(projectPath, 'CLAUDE.md')

  let claudePath: string
  if (await fileExists(dotClaudePath)) {
    claudePath = dotClaudePath
  } else if (await fileExists(rootClaudePath)) {
    claudePath = rootClaudePath
  } else {
    claudePath = rootClaudePath
    const dirName = projectPath.split('/').pop() || 'Project'
    await writeFile(claudePath, `# ${dirName}\n${DEV_SERVER_TABLE(port)}`, 'utf-8')
    return 'created'
  }

  const content = await readFile(claudePath, 'utf-8')
  const devServerRegex = /\n## Dev Server\n[\s\S]*?(?=\n## |\n# |$)/
  if (devServerRegex.test(content)) {
    const updated = content.replace(devServerRegex, DEV_SERVER_TABLE(port))
    await writeFile(claudePath, updated, 'utf-8')
  } else {
    await writeFile(claudePath, content.trimEnd() + '\n' + DEV_SERVER_TABLE(port), 'utf-8')
  }
  return 'fixed'
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { action, projectPath, port } = body as { action: string; projectPath: string; port: number }

    if (action === 'fix-package-json') {
      const result = await fixPackageJson(projectPath, port)
      return NextResponse.json({ result })
    }

    if (action === 'fix-claude-md') {
      const result = await fixClaudeMd(projectPath, port)
      return NextResponse.json({ result })
    }

    if (action === 'fix-all') {
      // 取得所有有問題的項目並修復
      const brickverseProjects = await readJsonFile<Project>('projects.json')
      const courseFiles = await readJsonFile<Project>('coursefiles.json')
      const utilityTools = await readJsonFile<Project>('utility-tools.json')

      const allProjects = [
        ...flattenProjectsWithChildren(brickverseProjects),
        ...flattenProjectsWithChildren(courseFiles),
        ...flattenProjectsWithChildren(utilityTools),
      ].filter(p => p.devPort)

      const results: { name: string; pkg: string; claude: string }[] = []
      for (const project of allProjects) {
        const pPath = project.devPath || project.path
        const pPort = project.devPort!

        // 先檢查再修
        const [pkgCheck, claudeCheck] = await Promise.all([
          checkPackageJson(pPath, pPort),
          checkLocalClaude(pPath, pPort),
        ])

        let pkgResult = 'ok'
        let claudeResult = 'ok'

        if (pkgCheck.packageJson !== 'correct' && pkgCheck.packageJson !== 'no-file') {
          pkgResult = await fixPackageJson(pPath, pPort)
        }
        if (claudeCheck.localClaude !== 'registered') {
          claudeResult = await fixClaudeMd(pPath, pPort)
        }

        if (pkgResult !== 'ok' || claudeResult !== 'ok') {
          results.push({ name: project.name, pkg: pkgResult, claude: claudeResult })
        }
      }

      return NextResponse.json({ results, count: results.length })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Port audit fix error:', error)
    return NextResponse.json({ error: 'Fix failed' }, { status: 500 })
  }
}
