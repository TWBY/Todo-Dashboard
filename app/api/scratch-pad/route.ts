import { NextResponse } from 'next/server';
import { readJsonFile, writeJsonFile } from '@/lib/data';
import type { ScratchItem } from '@/lib/types';

const FILE = 'scratch-pad.json';

export async function GET() {
  const items = await readJsonFile<ScratchItem>(FILE);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return NextResponse.json({ data: items });
}

export async function POST(request: Request) {
  const body = await request.json();
  if (!body.content?.trim()) {
    return NextResponse.json({ error: 'Content is required' }, { status: 400 });
  }
  const items = await readJsonFile<ScratchItem>(FILE);
  const newItem: ScratchItem = {
    id: crypto.randomUUID(),
    content: body.content.trim(),
    done: false,
    createdAt: new Date().toISOString(),
    ...(body.plan && { plan: body.plan }),
    ...(body.chatSessionId && { chatSessionId: body.chatSessionId }),
  };
  items.push(newItem);
  await writeJsonFile(FILE, items);
  return NextResponse.json({ data: newItem }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const items = await readJsonFile<ScratchItem>(FILE);
  const index = items.findIndex((item) => item.id === body.id);
  if (index === -1) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (body.done !== undefined) items[index].done = body.done;
  if (body.chatSessionId !== undefined) items[index].chatSessionId = body.chatSessionId;
  if (body.plan !== undefined) items[index].plan = body.plan;
  await writeJsonFile(FILE, items);
  return NextResponse.json({ data: items[index] });
}

export async function DELETE(request: Request) {
  const body = await request.json();
  const items = await readJsonFile<ScratchItem>(FILE);
  const filtered = items.filter((item) => item.id !== body.id);
  if (filtered.length === items.length) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  await writeJsonFile(FILE, filtered);
  return NextResponse.json({ data: { success: true } });
}
