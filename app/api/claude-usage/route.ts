import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

interface OAuthCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

/**
 * Read Claude Code credentials from macOS Keychain.
 * `security find-generic-password -w` may return hex-encoded data
 * depending on the stored content type.
 */
function readKeychainCredentials(): OAuthCredentials {
  const raw = execSync(
    'security find-generic-password -s "Claude Code-credentials" -w',
    { encoding: 'utf-8', timeout: 5000 }
  ).trim();

  // Try direct JSON parse first
  let decoded: string;
  try {
    const parsed = JSON.parse(raw);
    return parsed.claudeAiOauth;
  } catch {
    // Likely hex-encoded — decode it
    decoded = Buffer.from(raw, 'hex').toString('utf-8');
  }

  // Strip non-printable control characters (e.g. \x07 BEL prefix from Keychain)
  decoded = decoded.replace(/[\x00-\x1f\x7f]/g, '');

  // Keychain may truncate long values, so full JSON parse may fail.
  // Extract the claudeAiOauth object directly via brace matching.
  const marker = '"claudeAiOauth":';
  const idx = decoded.indexOf(marker);
  if (idx === -1) throw new Error('claudeAiOauth not found in Keychain data');

  const objStart = decoded.indexOf('{', idx + marker.length);
  if (objStart === -1) throw new Error('Invalid claudeAiOauth structure');

  // Find matching closing brace
  let depth = 0;
  let objEnd = -1;
  for (let i = objStart; i < decoded.length; i++) {
    if (decoded[i] === '{') depth++;
    else if (decoded[i] === '}') {
      depth--;
      if (depth === 0) { objEnd = i; break; }
    }
  }
  if (objEnd === -1) throw new Error('Truncated claudeAiOauth in Keychain');

  return JSON.parse(decoded.slice(objStart, objEnd + 1));
}

/**
 * Refresh the access token using the refresh token.
 */
async function refreshAccessToken(refreshToken: string): Promise<OAuthCredentials> {
  const res = await fetch('https://console.anthropic.com/v1/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: 'ce0bab3e-cc07-4221-b44a-5de43e713e58', // Claude Code client ID
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

// In-memory cache for refreshed tokens (survives across requests, not across server restarts)
let cachedToken: { token: string; expiresAt: number } | null = null;

/**
 * Get a valid access token — refresh if expired or expiring soon (< 5 min).
 */
async function getValidAccessToken(): Promise<string> {
  const bufferMs = 5 * 60 * 1000;

  // Check in-memory cache first (from a previous refresh)
  if (cachedToken && cachedToken.expiresAt > Date.now() + bufferMs) {
    return cachedToken.token;
  }

  const creds = readKeychainCredentials();

  // If token expires in > 5 minutes, use it directly
  if (creds.expiresAt > Date.now() + bufferMs) {
    return creds.accessToken;
  }

  // Token expired or expiring soon — refresh
  const newCreds = await refreshAccessToken(creds.refreshToken);

  // Note: We don't write back to Keychain because the stored data may be
  // truncated (Keychain length limits). The refreshed token is cached in memory
  // and Claude Code will handle its own credential persistence.
  cachedToken = { token: newCreds.accessToken, expiresAt: newCreds.expiresAt };
  return newCreds.accessToken;
}

export async function GET() {
  try {
    const token = await getValidAccessToken();

    const res = await fetch('https://api.anthropic.com/api/oauth/usage', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'anthropic-beta': 'oauth-2025-04-20',
      },
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `Anthropic API ${res.status}: ${body}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
