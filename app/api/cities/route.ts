import { NextResponse } from 'next/server'
import { loadAllProjectsWithCities } from '@/lib/data'

export async function GET() {
  const { projects, courseFiles, utilityTools } = await loadAllProjectsWithCities()

  return NextResponse.json({
    projects: projects.sort((a, b) => a.name.localeCompare(b.name)),
    courseFiles: courseFiles.sort((a, b) => a.name.localeCompare(b.name)),
    utilityTools: utilityTools.sort((a, b) => a.name.localeCompare(b.name)),
  })
}
