import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

function getAccessToken(): string {
  const raw = execSync(
    'security find-generic-password -s "Claude Code-credentials" -w',
    { encoding: 'utf-8' }
  ).trim();
  const credentials = JSON.parse(raw);
  return credentials.claudeAiOauth.accessToken;
}

export async function GET() {
  try {
    const token = getAccessToken();

    const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
        'User-Agent': 'claude-code/2.0.32',
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Anthropic API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to fetch usage: ${message}` },
      { status: 500 }
    );
  }
}
