import { NextResponse } from 'next/server';
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
  let port = 3012;
  while (usedPorts.has(port)) port++;
  return port;
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
    return NextResponse.json({ devPort, devAddedAt });
  }

  if (action === 'remove-from-dev') {
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
