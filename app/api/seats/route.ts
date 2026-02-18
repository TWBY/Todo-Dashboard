import { NextResponse } from 'next/server'
import { readJsonFile, flattenProjectsWithChildren } from '@/lib/data'
import type { Project } from '@/lib/types'

const STATION_ROOM_MIN = 3003
const STATION_ROOM_MAX = 3010

interface SeatEntry {
  projectId: string | null
  projectName: string | null
  port: number
}

export async function GET() {
  try {
    const brickverseProjects = await readJsonFile<Project>('projects.json')
    const courseFiles = await readJsonFile<Project>('coursefiles.json')
    const utilityTools = await readJsonFile<Project>('utility-tools.json')

    const brickverseFlat = flattenProjectsWithChildren(brickverseProjects).map(p => ({ ...p, source: 'brickverse' as const }))
    const courseFlat = flattenProjectsWithChildren(courseFiles).map(p => ({ ...p, source: 'coursefiles' as const }))
    const utilityFlat = flattenProjectsWithChildren(utilityTools).map(p => ({ ...p, source: 'utility' as const }))
    const allProjects = [...brickverseFlat, ...courseFlat, ...utilityFlat].filter(p => p.devPort && p.devPort >= STATION_ROOM_MIN && p.devPort <= STATION_ROOM_MAX)

    // 建立座位陣列：8 個座位（索引 0-7 映射 port 3003-3010）
    const seats: (SeatEntry | null)[] = Array(STATION_ROOM_MAX - STATION_ROOM_MIN + 1).fill(null)

    // 填入已占用的座位
    for (const project of allProjects) {
      const seatIndex = project.devPort! - STATION_ROOM_MIN
      if (seatIndex >= 0 && seatIndex < seats.length) {
        seats[seatIndex] = {
          projectId: project.id,
          projectName: project.name,
          port: project.devPort!,
        }
      }
    }

    return NextResponse.json({
      seats,
      total: seats.length,
      occupied: seats.filter(s => s !== null).length,
      available: seats.filter(s => s === null).length,
    })
  } catch (error) {
    console.error('Seats error:', error)
    return NextResponse.json({ error: 'Failed to get seats' }, { status: 500 })
  }
}
