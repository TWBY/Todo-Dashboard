import { NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'

const UPLOAD_DIR = '/tmp/claude-chat-images'
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const files = formData.getAll('images') as File[]

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    await mkdir(UPLOAD_DIR, { recursive: true })

    const paths: string[] = []

    for (const file of files) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { error: `不支援的檔案格式：${file.type}，僅支援 PNG、JPG、GIF、WebP` },
          { status: 400 }
        )
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `檔案 ${file.name} 超過 10MB 限制` },
          { status: 400 }
        )
      }

      const ext = file.name.split('.').pop() || 'png'
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
      const filepath = join(UPLOAD_DIR, filename)

      const buffer = Buffer.from(await file.arrayBuffer())
      await writeFile(filepath, buffer)
      paths.push(filepath)
    }

    return NextResponse.json({ paths })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Failed to upload files' }, { status: 500 })
  }
}
