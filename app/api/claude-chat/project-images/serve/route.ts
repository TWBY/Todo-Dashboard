import { NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join, resolve, extname } from 'path'
import { loadAllProjects } from '@/lib/data'

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const imagePath = searchParams.get('path')

    if (!projectId || !imagePath) {
      return NextResponse.json({ error: 'Missing projectId or path' }, { status: 400 })
    }

    // Security: reject directory traversal
    if (imagePath.includes('..') || imagePath.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 })
    }

    const projects = await loadAllProjects()

    const project = projects.find(p => p.id === projectId)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const projectPath = project.devPath || project.path
    const publicDir = join(projectPath, 'public')
    const fullPath = resolve(publicDir, imagePath)

    // Security: ensure resolved path is within public directory
    if (!fullPath.startsWith(publicDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 })
    }

    const ext = extname(fullPath).toLowerCase()
    const mimeType = MIME_TYPES[ext]
    if (!mimeType) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    const buffer = await readFile(fullPath)
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    console.error('Error serving project image:', error)
    return NextResponse.json({ error: 'Failed to serve image' }, { status: 500 })
  }
}
