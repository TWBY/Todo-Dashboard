import { NextResponse } from 'next/server'
import { readFile, writeFile, access } from 'fs/promises'
import path from 'path'
import { readJsonFile, flattenProjectsWithChildren, loadAllProjects } from '@/lib/data'
import type { Project } from '@/lib/types'

// Station 房間限制
const STATION_ROOM_MIN = 3003
const STATION_ROOM_MAX = 3010

interface AuditEntry {
  name: string
  port: number
  path: string
  source: 'brickverse' | 'coursefiles' | 'utility'
  packageJson: 'correct' | 'missing-port' | 'wrong-port' | 'no-file'
  packageJsonDetail?: string
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

        const pkgResult = await checkPackageJson(projectPath, port)

        return {
          name: project.name,
          port,
          path: projectPath,
          source: project.source,
          ...pkgResult,
        }
      })
    )

    // 按 port 排序
    entries.sort((a, b) => a.port - b.port)

    // 統計
    const stats = {
      total: entries.length,
      packageJsonOk: entries.filter(e => e.packageJson === 'correct').length,
      fullyRegistered: entries.filter(e => e.packageJson === 'correct').length,
      roomsTotal: STATION_ROOM_MAX - STATION_ROOM_MIN + 1,
      roomsUsed: entries.length,
      roomsAvailable: (STATION_ROOM_MAX - STATION_ROOM_MIN + 1) - entries.length,
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

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { action, projectPath, port } = body as { action: string; projectPath: string; port: number }

    if (action === 'fix-package-json') {
      const result = await fixPackageJson(projectPath, port)
      return NextResponse.json({ result })
    }

    if (action === 'fix-all') {
      const allProjects = (await loadAllProjects()).filter(p => p.devPort)

      const results: { name: string; pkg: string }[] = []
      for (const project of allProjects) {
        const pPath = project.devPath || project.path
        const pPort = project.devPort!

        const pkgCheck = await checkPackageJson(pPath, pPort)

        let pkgResult = 'ok'
        if (pkgCheck.packageJson !== 'correct' && pkgCheck.packageJson !== 'no-file') {
          pkgResult = await fixPackageJson(pPath, pPort)
        }

        if (pkgResult !== 'ok') {
          results.push({ name: project.name, pkg: pkgResult })
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
