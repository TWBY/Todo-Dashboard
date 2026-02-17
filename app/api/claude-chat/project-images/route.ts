import { NextResponse } from 'next/server'
import { readdir, stat, mkdir, writeFile, unlink, access } from 'fs/promises'
import { join, relative, extname, resolve } from 'path'
import { loadAllProjects } from '@/lib/data'

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'])
const ALLOWED_UPLOAD_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml']

async function resolveProject(projectId: string) {
  const projects = await loadAllProjects()
  return projects.find(p => p.id === projectId)
}

async function scanImages(dir: string, baseDir: string): Promise<{ filename: string; relativePath: string; size: number }[]> {
  const results: { filename: string; relativePath: string; size: number }[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        const sub = await scanImages(fullPath, baseDir)
        results.push(...sub)
      } else if (entry.isFile() && IMAGE_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        const info = await stat(fullPath)
        results.push({
          filename: entry.name,
          relativePath: relative(baseDir, fullPath),
          size: info.size,
        })
      }
    }
  } catch {
    // Directory doesn't exist or not readable
  }
  return results
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    const project = await resolveProject(projectId)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const projectPath = project.devPath || project.path
    const publicDir = join(projectPath, 'public')
    const images = await scanImages(publicDir, publicDir)

    images.sort((a, b) => a.relativePath.localeCompare(b.relativePath))

    return NextResponse.json({ images })
  } catch (error) {
    console.error('Error listing project images:', error)
    return NextResponse.json({ error: 'Failed to list images' }, { status: 500 })
  }
}

// Upload images to a project's public/ subfolder
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const projectId = formData.get('projectId') as string
    const folder = (formData.get('folder') as string) || ''
    const files = formData.getAll('images') as File[]

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }
    if (folder.includes('..') || folder.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid folder path' }, { status: 403 })
    }

    const project = await resolveProject(projectId)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const projectPath = project.devPath || project.path
    const publicDir = join(projectPath, 'public')
    const targetDir = folder ? resolve(publicDir, folder) : publicDir

    // Security: ensure target is within public/
    if (!targetDir.startsWith(publicDir)) {
      return NextResponse.json({ error: 'Invalid folder path' }, { status: 403 })
    }

    await mkdir(targetDir, { recursive: true })

    const uploaded: { filename: string; relativePath: string; size: number }[] = []

    for (const file of files) {
      if (!ALLOWED_UPLOAD_TYPES.includes(file.type)) continue

      let filename = file.name
      const targetPath = join(targetDir, filename)

      // If file already exists, add timestamp prefix
      try {
        await access(targetPath)
        const ext = extname(filename)
        const base = filename.slice(0, -ext.length)
        filename = `${base}-${Date.now()}${ext}`
      } catch {
        // File doesn't exist, use original name
      }

      const buffer = Buffer.from(await file.arrayBuffer())
      const finalPath = join(targetDir, filename)
      await writeFile(finalPath, buffer)

      uploaded.push({
        filename,
        relativePath: relative(publicDir, finalPath),
        size: buffer.length,
      })
    }

    return NextResponse.json({ uploaded })
  } catch (error) {
    console.error('Error uploading project image:', error)
    return NextResponse.json({ error: 'Failed to upload' }, { status: 500 })
  }
}

// Delete an image from a project's public/ directory
export async function DELETE(request: Request) {
  try {
    const { projectId, path: imagePath } = await request.json()

    if (!projectId || !imagePath) {
      return NextResponse.json({ error: 'Missing projectId or path' }, { status: 400 })
    }
    if (imagePath.includes('..') || imagePath.startsWith('/')) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 })
    }

    const project = await resolveProject(projectId)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const projectPath = project.devPath || project.path
    const publicDir = join(projectPath, 'public')
    const fullPath = resolve(publicDir, imagePath)

    if (!fullPath.startsWith(publicDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 })
    }

    await unlink(fullPath)
    return NextResponse.json({ success: true })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }
    console.error('Error deleting project image:', error)
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 })
  }
}
