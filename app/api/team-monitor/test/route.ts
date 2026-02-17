import { NextResponse } from 'next/server'

/**
 * Test endpoint — 渲染一個獨立的 HTML 頁面來預覽 TeamMonitorPanel
 * 直接在瀏覽器開啟 http://localhost:3000/api/team-monitor/test
 */
export async function GET() {
  const html = `<!DOCTYPE html>
<html>
<head>
  <title>Team Monitor Test</title>
  <style>
    body { background: #000; color: #fff; font-family: system-ui; padding: 40px; max-width: 600px; margin: 0 auto; }
    h2 { color: #58a6ff; margin-bottom: 20px; }
    p { color: #8b949e; margin-bottom: 10px; }
    .info { background: #0d1117; border: 1px solid #1c2333; border-radius: 6px; padding: 16px; margin-bottom: 20px; }
    a { color: #58a6ff; }
    code { background: #111; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
  </style>
</head>
<body>
  <h2>Team Monitor — API Test</h2>

  <div class="info">
    <p><strong>Mock data (via __mock__):</strong></p>
    <p><a href="/api/team-monitor?name=__mock__" target="_blank">/api/team-monitor?name=__mock__</a></p>
    <p>Simulated team data — 1-minute lifecycle with all states</p>
  </div>

  <div class="info">
    <p><strong>Mock data (direct):</strong></p>
    <p><a href="/api/team-monitor/mock" target="_blank">/api/team-monitor/mock</a></p>
    <p>Same mock data, direct endpoint</p>
  </div>

  <div class="info">
    <p><strong>To test the full panel in Chat UI:</strong></p>
    <p>Click the <code>DEV: Test Team Monitor</code> button on the Dashboard chat page (dev only).</p>
    <p>Or start a real Agent Team session — the panel appears when Claude uses <code>TeamCreate</code>.</p>
  </div>
</body>
</html>`

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  })
}
