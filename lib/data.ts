import fs from 'fs/promises';
import path from 'path';
import type { Project } from './types';
import type { ChatSessionRecord, ChatMessage } from './claude-chat-types';

function getDataPath(filename: string): string {
  return path.join(process.cwd(), 'data', filename);
}

function getChatHistoryPath(projectId: string): string {
  const safeId = projectId.replace(/::/g, '--')
  return path.join(process.cwd(), 'data', 'chat-history', `${safeId}.json`)
}

function getChatMessagesDir(projectId: string): string {
  const safeId = projectId.replace(/::/g, '--')
  return path.join(process.cwd(), 'data', 'chat-messages', safeId)
}

export async function readChatMessages(projectId: string, sessionId: string): Promise<ChatMessage[]> {
  try {
    const dir = getChatMessagesDir(projectId)
    const filePath = path.join(dir, `${sessionId}.json`)
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as ChatMessage[]
  } catch {
    return []
  }
}

export async function writeChatMessages(projectId: string, sessionId: string, messages: ChatMessage[]): Promise<void> {
  const dir = getChatMessagesDir(projectId)
  await fs.mkdir(dir, { recursive: true })
  const filePath = path.join(dir, `${sessionId}.json`)
  await fs.writeFile(filePath, JSON.stringify(messages, null, 2), 'utf-8')
}

export async function readChatHistory(projectId: string): Promise<ChatSessionRecord[]> {
  try {
    const filePath = getChatHistoryPath(projectId)
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as ChatSessionRecord[]
  } catch {
    return []
  }
}

export async function writeChatHistory(projectId: string, records: ChatSessionRecord[]): Promise<void> {
  const filePath = getChatHistoryPath(projectId)
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), 'utf-8')
}

/**
 * 清理過期的 chat-messages 檔案（超過 cutoffMs 的自動刪除）
 */
export async function cleanExpiredChatMessages(projectId: string, cutoffMs: number): Promise<number> {
  const dir = getChatMessagesDir(projectId)
  let deleted = 0
  try {
    const files = await fs.readdir(dir)
    const now = Date.now()
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const filePath = path.join(dir, file)
      const fileStat = await fs.stat(filePath)
      if (now - fileStat.mtimeMs > cutoffMs) {
        await fs.unlink(filePath)
        deleted++
      }
    }
  } catch {
    // directory doesn't exist or read error — ignore
  }
  return deleted
}

export async function readJsonFile<T>(filename: string): Promise<T[]> {
  try {
    const filePath = getDataPath(filename);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T[];
  } catch {
    return [];
  }
}

export async function writeJsonFile<T>(filename: string, data: T[]): Promise<void> {
  const filePath = getDataPath(filename);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Load all projects from all three city JSON files and flatten children.
 * Replaces the pattern of reading 3 JSONs + flattenProjectsWithChildren that was repeated 8+ times.
 */
export async function loadAllProjects(): Promise<Project[]> {
  const [brickverse, courseFiles, utilityTools] = await Promise.all([
    readJsonFile<Project>('projects.json'),
    readJsonFile<Project>('coursefiles.json'),
    readJsonFile<Project>('utility-tools.json'),
  ])
  return flattenProjectsWithChildren([...brickverse, ...courseFiles, ...utilityTools])
}

/**
 * Load all projects from all three city JSON files, returning both raw (per-city) and flattened.
 */
export async function loadAllProjectsWithCities() {
  const [projects, courseFiles, utilityTools] = await Promise.all([
    readJsonFile<Project>('projects.json'),
    readJsonFile<Project>('coursefiles.json'),
    readJsonFile<Project>('utility-tools.json'),
  ])
  const allFlattened = flattenProjectsWithChildren([...projects, ...courseFiles, ...utilityTools])
  return { projects, courseFiles, utilityTools, allFlattened }
}

/**
 * Flatten projects: expand children with devPort into virtual Project objects.
 * Child projects get id = "parentId::childName" and path = "parentPath/childName".
 */
export function flattenProjectsWithChildren(projects: Project[]): Project[] {
  const result: Project[] = [...projects];
  for (const project of projects) {
    if (project.children) {
      for (const child of project.children) {
        if (child.devPort) {
          result.push({
            id: `${project.id}::${child.name}`,
            productId: project.productId,
            name: child.name,
            path: `${project.path}/${child.name}`,
            description: child.description,
            techStack: [],
            devPort: child.devPort,
            devCommand: child.devCommand,
            devBasePath: child.devBasePath,
            devAddedAt: child.devAddedAt,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
          });
        }
      }
    }
  }
  return result;
}
