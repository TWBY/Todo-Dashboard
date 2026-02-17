import { NextResponse } from 'next/server';
import { readFile, writeFile, access } from 'fs/promises';
import { join } from 'path';
import { readJsonFile, writeJsonFile } from '@/lib/data';
import type { Project } from '@/lib/types';

function generateProductId(existingIds: string[]): string {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-1);
  const month = now.getMonth() + 1;
  const monthChar = month <= 9 ? String(month) : String.fromCharCode(55 + month);

  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let attempts = 0;

  while (attempts < 100) {
    const r1 = chars[Math.floor(Math.random() * 36)];
    const r2 = chars[Math.floor(Math.random() * 36)];
    const productId = `B-${year}${monthChar}${r1}${r2}`;

    if (!existingIds.includes(productId)) {
      return productId;
    }
    attempts++;
  }

  return `B-${year}${monthChar}${Date.now().toString(36).slice(-2).toUpperCase()}`;
}

export async function GET() {
  const projects = await readJsonFile<Project>('projects.json');
  projects.sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ data: projects });
}

function findNextAvailablePort(allProjects: Project[]): number {
  const usedPorts = new Set<number>();
  for (const p of allProjects) {
    if (p.devPort) usedPorts.add(p.devPort);
    if (p.children) {
      for (const c of p.children) {
        if (c.devPort) usedPorts.add(c.devPort);
      }
    }
  }
  let port = 3001;
  while (usedPorts.has(port) || port === 4000) port++;
  return port;
}

// --- 三重登記 helpers ---

async function fileExists(path: string): Promise<boolean> {
  try { await access(path); return true } catch { return false }
}

/** 更新 package.json：在 scripts.dev 加上 -p <port> */
async function updatePackageJsonPort(projectPath: string, port: number): Promise<void> {
  const pkgPath = join(projectPath, 'package.json')
  if (!await fileExists(pkgPath)) return
  try {
    const raw = await readFile(pkgPath, 'utf-8')
    const pkg = JSON.parse(raw)
    if (!pkg.scripts?.dev) return
    const devScript: string = pkg.scripts.dev
    // 如果已經有 -p，先移除舊的
    const cleaned = devScript.replace(/\s+-p\s+\d+/g, '').replace(/\s+--port\s+\d+/g, '')
    pkg.scripts.dev = `${cleaned} -p ${port}`
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
  } catch { /* ignore parse errors */ }
}

/** 從 package.json scripts.dev 移除 -p <port> */
async function removePackageJsonPort(projectPath: string): Promise<void> {
  const pkgPath = join(projectPath, 'package.json')
  if (!await fileExists(pkgPath)) return
  try {
    const raw = await readFile(pkgPath, 'utf-8')
    const pkg = JSON.parse(raw)
    if (!pkg.scripts?.dev) return
    pkg.scripts.dev = pkg.scripts.dev.replace(/\s+-p\s+\d+/g, '').replace(/\s+--port\s+\d+/g, '')
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
  } catch { /* ignore */ }
}

const DEV_SERVER_TABLE = (port: number) =>
  `\n## Dev Server\n\n| 環境 | Port | 指令 |\n|------|------|------|\n| 開發 | \`${port}\` | \`npm run dev\` |\n`

/** 在專案 CLAUDE.md 登記 Dev Server port（區域戶口） */
async function updateClaudeMdPort(projectPath: string, port: number): Promise<void> {
  // 優先用 .claude/CLAUDE.md，其次根目錄 CLAUDE.md
  const dotClaudePath = join(projectPath, '.claude', 'CLAUDE.md')
  const rootClaudePath = join(projectPath, 'CLAUDE.md')

  let claudePath: string
  if (await fileExists(dotClaudePath)) {
    claudePath = dotClaudePath
  } else if (await fileExists(rootClaudePath)) {
    claudePath = rootClaudePath
  } else {
    // 新建在根目錄
    claudePath = rootClaudePath
    await writeFile(claudePath, `# ${projectPath.split('/').pop()}\n${DEV_SERVER_TABLE(port)}`, 'utf-8')
    return
  }

  const content = await readFile(claudePath, 'utf-8')
  // 如果已有 Dev Server 區段，替換
  const devServerRegex = /\n## Dev Server\n[\s\S]*?(?=\n## |\n# |$)/
  if (devServerRegex.test(content)) {
    const updated = content.replace(devServerRegex, DEV_SERVER_TABLE(port))
    await writeFile(claudePath, updated, 'utf-8')
  } else {
    // 追加到末尾
    await writeFile(claudePath, content.trimEnd() + '\n' + DEV_SERVER_TABLE(port), 'utf-8')
  }
}

/** 從專案 CLAUDE.md 移除 Dev Server 區段 */
async function removeClaudeMdPort(projectPath: string): Promise<void> {
  const dotClaudePath = join(projectPath, '.claude', 'CLAUDE.md')
  const rootClaudePath = join(projectPath, 'CLAUDE.md')

  let claudePath: string
  if (await fileExists(dotClaudePath)) {
    claudePath = dotClaudePath
  } else if (await fileExists(rootClaudePath)) {
    claudePath = rootClaudePath
  } else {
    return
  }

  const content = await readFile(claudePath, 'utf-8')
  const devServerRegex = /\n## Dev Server\n[\s\S]*?(?=\n## |\n# |$)/
  if (devServerRegex.test(content)) {
    const updated = content.replace(devServerRegex, '')
    await writeFile(claudePath, updated.trimEnd() + '\n', 'utf-8')
  }
}

/** 解析專案路徑：直接專案 vs child（CourseFiles 子專案） */
function resolveProjectPath(project: Project, childName?: string): string {
  if (childName && project.children) {
    // CourseFiles 子專案：路徑 = parent.path / childName
    return join(project.path, childName)
  }
  return project.devPath || project.path
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { projectId, childName, action } = body as { projectId: string; childName?: string; action: 'add-to-dev' | 'remove-from-dev' };

  if (!projectId || !action) {
    return NextResponse.json({ error: 'Missing projectId or action' }, { status: 400 });
  }

  const brickverseProjects = await readJsonFile<Project>('projects.json');
  const courseFiles = await readJsonFile<Project>('coursefiles.json');
  const utilityTools = await readJsonFile<Project>('utility-tools.json');

  // Find which file contains this project
  type DataFile = 'projects.json' | 'coursefiles.json' | 'utility-tools.json';
  let targetFile: DataFile | null = null;
  let targetList: Project[] | null = null;
  let targetIndex = brickverseProjects.findIndex(p => p.id === projectId);

  if (targetIndex !== -1) {
    targetFile = 'projects.json';
    targetList = brickverseProjects;
  } else {
    targetIndex = courseFiles.findIndex(p => p.id === projectId);
    if (targetIndex !== -1) {
      targetFile = 'coursefiles.json';
      targetList = courseFiles;
    } else {
      targetIndex = utilityTools.findIndex(p => p.id === projectId);
      if (targetIndex !== -1) {
        targetFile = 'utility-tools.json';
        targetList = utilityTools;
      }
    }
  }

  if (!targetFile || !targetList || targetIndex === -1) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (action === 'add-to-dev') {
    const allProjects = [...brickverseProjects, ...courseFiles, ...utilityTools];
    const devPort = findNextAvailablePort(allProjects);
    const devAddedAt = new Date().toISOString();

    if (childName) {
      const child = targetList[targetIndex].children?.find(c => c.name === childName);
      if (!child) {
        return NextResponse.json({ error: 'Child not found' }, { status: 404 });
      }
      child.devPort = devPort;
      child.devAddedAt = devAddedAt;
    } else {
      targetList[targetIndex].devPort = devPort;
      targetList[targetIndex].devAddedAt = devAddedAt;
    }
    targetList[targetIndex].updatedAt = new Date().toISOString();
    await writeJsonFile(targetFile, targetList);

    // 三重登記：package.json + CLAUDE.md
    const projectPath = resolveProjectPath(targetList[targetIndex], childName);
    await Promise.all([
      updatePackageJsonPort(projectPath, devPort),
      updateClaudeMdPort(projectPath, devPort),
    ]);

    return NextResponse.json({ devPort, devAddedAt });
  }

  if (action === 'remove-from-dev') {
    // 先取得路徑（移除前 project 還有 path 資訊）
    const projectPath = resolveProjectPath(targetList[targetIndex], childName);

    if (childName) {
      const child = targetList[targetIndex].children?.find(c => c.name === childName);
      if (!child) {
        return NextResponse.json({ error: 'Child not found' }, { status: 404 });
      }
      delete child.devPort;
      delete child.devCommand;
      delete child.devBasePath;
      delete child.devAddedAt;
    } else {
      delete targetList[targetIndex].devPort;
      delete targetList[targetIndex].devCommand;
      delete targetList[targetIndex].devBasePath;
      delete targetList[targetIndex].devAddedAt;
    }
    targetList[targetIndex].updatedAt = new Date().toISOString();
    await writeJsonFile(targetFile, targetList);

    // 三重清理：package.json + CLAUDE.md
    await Promise.all([
      removePackageJsonPort(projectPath),
      removeClaudeMdPort(projectPath),
    ]);

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function POST(request: Request) {
  const body = await request.json();
  const projects = await readJsonFile<Project>('projects.json');

  const existingIds = projects.map(p => p.productId).filter((id): id is string => !!id);
  const newProductId = generateProductId(existingIds);

  const newProject: Project = {
    id: crypto.randomUUID(),
    productId: body.productId || newProductId,
    name: body.name,
    path: body.path,
    description: body.description || '',
    techStack: body.techStack || [],

    url: body.url,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  projects.push(newProject);
  await writeJsonFile('projects.json', projects);
  return NextResponse.json({ data: newProject }, { status: 201 });
}
