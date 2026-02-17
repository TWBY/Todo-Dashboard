import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile } from '@/lib/data';
import type { Todo } from '@/lib/types';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const todos = await readJsonFile<Todo>('todos.json');
  const index = todos.findIndex((t) => t.id === id);

  if (index === -1) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Whitelist updatable fields to prevent overwriting id/createdAt
  const validStatuses = ['pending', 'in_progress', 'completed'] as const;
  const validPriorities = ['low', 'medium', 'high'] as const;
  const updates: Partial<Todo> = {};
  if (body.title && typeof body.title === 'string') updates.title = body.title.trim();
  if (body.description !== undefined) updates.description = body.description;
  if (body.projectId && typeof body.projectId === 'string') updates.projectId = body.projectId;
  if (validStatuses.includes(body.status)) updates.status = body.status;
  if (validPriorities.includes(body.priority)) updates.priority = body.priority;

  todos[index] = {
    ...todos[index],
    ...updates,
    completedAt: body.status === 'completed' ? new Date().toISOString() : todos[index].completedAt,
  };

  await writeJsonFile('todos.json', todos);
  return NextResponse.json({ data: todos[index] });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const todos = await readJsonFile<Todo>('todos.json');
  const filtered = todos.filter((t) => t.id !== id);

  if (filtered.length === todos.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await writeJsonFile('todos.json', filtered);
  return NextResponse.json({ data: { success: true } });
}
