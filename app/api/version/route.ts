import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const data = JSON.parse(readFileSync(join(process.cwd(), 'version.json'), 'utf-8'))
    return Response.json(data)
  } catch {
    return Response.json({ development: '0.0.0', production: '0.0.0' })
  }
}
