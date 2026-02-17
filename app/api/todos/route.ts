import { NextRequest, NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile } from '@/lib/data';
import type { Todo } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const projectId = searchParams.get('projectId');
  const status = searchParams.get('status');

  let todos = await readJsonFile<Todo>('todos.json');

  if (projectId) {
    todos = todos.filter((t) => t.projectId === projectId);
  }
  if (status) {
    todos = todos.filter((t) => t.status === status);
  }

  return NextResponse.json({ data: todos });
}

export async function POST(request: Request) {
  const body = await request.json();

  if (!body.title || typeof body.title !== 'string' || !body.title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  const validPriorities = ['low', 'medium', 'high'] as const;
  const priority = validPriorities.includes(body.priority) ? body.priority : 'medium';

  const todos = await readJsonFile<Todo>('todos.json');

  const newTodo: Todo = {
    id: crypto.randomUUID(),
    title: body.title.trim(),
    description: body.description,
    projectId: body.projectId || '',
    status: 'pending',
    priority,
    createdAt: new Date().toISOString(),
  };

  todos.push(newTodo);
  await writeJsonFile('todos.json', todos);
  return NextResponse.json({ data: newTodo }, { status: 201 });
}
