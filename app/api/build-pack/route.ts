import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'

const CWD = process.cwd()

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const bump: 'patch' | 'minor' | 'major' = body.bump || 'patch'

    // 1. 找上次 release commit
    let changes: string
    try {
      const lastReleaseHash = execSync('git log --oneline --grep="^release:" -1 --format=%H', { cwd: CWD })
        .toString().trim()
      if (lastReleaseHash) {
        changes = execSync(`git log ${lastReleaseHash}..HEAD --oneline`, { cwd: CWD }).toString().trim()
      } else {
        changes = execSync('git log --oneline -20', { cwd: CWD }).toString().trim()
      }
    } catch {
      changes = execSync('git log --oneline -20', { cwd: CWD }).toString().trim()
    }

    if (!changes) {
      return NextResponse.json({ error: '沒有新的 commit 需要打包', step: 'git-log' }, { status: 400 })
    }

    // 2. npm version
    try {
      execSync(`npm version ${bump} --no-git-tag-version`, { cwd: CWD })
    } catch (err) {
      return NextResponse.json({
        error: `npm version 失敗: ${err instanceof Error ? err.message : String(err)}`,
        step: 'version',
      }, { status: 500 })
    }

    // 3. 讀取新版本號
    const pkg = JSON.parse(readFileSync(join(CWD, 'package.json'), 'utf-8'))
    const version: string = pkg.version

    // 4. npm run build
    try {
      execSync('npm run build', { cwd: CWD, timeout: 180000, stdio: 'pipe' })
    } catch (err) {
      // Build 失敗：回滾版本號
      try {
        execSync('git checkout -- package.json package-lock.json', { cwd: CWD })
      } catch { /* ignore rollback error */ }

      const stderr = err instanceof Error && 'stderr' in err
        ? (err as { stderr: Buffer }).stderr?.toString() || ''
        : String(err)
      return NextResponse.json({
        error: stderr.slice(-2000), // 只取最後 2000 字元
        step: 'build',
        changes,
      }, { status: 500 })
    }

    // 5. git commit
    const changeLines = changes.split('\n').map(l => l.replace(/^[a-f0-9]+ /, ''))
    const summary = changeLines.slice(0, 5).join('、')
    const commitMsg = `release: v${version} — ${summary}`

    try {
      execSync('git add package.json package-lock.json', { cwd: CWD })
      execSync(`git commit -m ${JSON.stringify(commitMsg)}`, { cwd: CWD })
    } catch (err) {
      return NextResponse.json({
        error: `git commit 失敗: ${err instanceof Error ? err.message : String(err)}`,
        step: 'commit',
      }, { status: 500 })
    }

    return NextResponse.json({ version, changes, commitMsg })
  } catch (err) {
    return NextResponse.json({
      error: `未預期錯誤: ${err instanceof Error ? err.message : String(err)}`,
      step: 'unknown',
    }, { status: 500 })
  }
}
