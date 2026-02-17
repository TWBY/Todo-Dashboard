import { NextResponse } from 'next/server'
import { readJsonFile } from '@/lib/data'
import type { Project } from '@/lib/types'

export async function GET() {
  const [projects, courseFiles, utilityTools] = await Promise.all([
    readJsonFile<Project>('projects.json'),
    readJsonFile<Project>('coursefiles.json'),
    readJsonFile<Project>('utility-tools.json'),
  ])

  return NextResponse.json({
    projects: projects.sort((a, b) => a.name.localeCompare(b.name)),
    courseFiles: courseFiles.sort((a, b) => a.name.localeCompare(b.name)),
    utilityTools: utilityTools.sort((a, b) => a.name.localeCompare(b.name)),
  })
}
