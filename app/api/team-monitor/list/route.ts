import { NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import path from 'path'

const CLAUDE_DIR = path.join(process.env.HOME || '/root', '.claude')

interface TeamInfo {
  name: string
  description?: string
  createdAt: number
}

export async function GET() {
  const teamsDir = path.join(CLAUDE_DIR, 'teams')

  try {
    const teamNames = await readdir(teamsDir)
    const teams: TeamInfo[] = []

    for (const name of teamNames) {
      try {
        const configPath = path.join(teamsDir, name, 'config.json')
        const configRaw = await readFile(configPath, 'utf-8')
        const config = JSON.parse(configRaw)

        teams.push({
          name: config.name || name,
          description: config.description,
          createdAt: config.createdAt || Date.now(),
        })
      } catch {
        // Skip malformed team directories
      }
    }

    // Sort by createdAt descending (most recent first)
    teams.sort((a, b) => b.createdAt - a.createdAt)

    return NextResponse.json({ teams })
  } catch {
    // teams directory doesn't exist or other error
    return NextResponse.json({ teams: [] })
  }
}
