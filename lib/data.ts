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
