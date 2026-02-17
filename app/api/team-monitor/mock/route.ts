import { NextResponse } from 'next/server'

/**
 * Mock Team Monitor API — 回傳模擬的 ct-fix 團隊資料
 * 用於視覺測試 TeamMonitorPanel，不需要啟動真正的 Agent Team
 *
 * GET /api/team-monitor/mock
 */
export async function GET() {
  return NextResponse.json({
    teamName: 'ct-fix',
    description: '修復 ClaudeTerminal App 在 streaming 結束後自動退出的問題',
    createdAt: Date.now() - 120000, // 2 分鐘前建立
    members: [
      { name: 'team-lead', agentId: 'team-lead@ct-fix', agentType: 'lead', status: 'idle' },
      { name: 'investigator', agentId: 'investigator@ct-fix', agentType: 'general-purpose', color: 'blue', status: 'working' },
      { name: 'researcher', agentId: 'researcher@ct-fix', agentType: 'general-purpose', color: 'green', status: 'idle' },
      { name: 'tester', agentId: 'tester@ct-fix', agentType: 'general-purpose', color: 'yellow', status: 'working' },
    ],
    tasks: [
      { id: '1', description: '調查 ClaudeTerminal exit 問題的根本原因', status: 'completed', owner: 'investigator' },
      { id: '2', description: '搜尋 MenuBarExtra + AsyncStream 相關文獻', status: 'in_progress', owner: 'researcher' },
      { id: '3', description: '撰寫最小化測試 App 驗證假設', status: 'in_progress', owner: 'tester' },
      { id: '4', description: '套用修復方案並驗證', status: 'pending', owner: undefined },
    ],
    messages: [
      {
        from: 'team-lead',
        to: 'investigator',
        summary: '請分析 stream 結束後的完整執行路徑',
        timestamp: new Date(Date.now() - 100000).toISOString(),
      },
      {
        from: 'investigator',
        to: 'team-lead',
        summary: 'ClaudeTerminal exit 完整分析及修復建議',
        timestamp: new Date(Date.now() - 80000).toISOString(),
      },
      {
        from: 'team-lead',
        to: 'researcher',
        summary: '搜尋 SwiftUI MenuBarExtra + AsyncStream 退出問題',
        timestamp: new Date(Date.now() - 70000).toISOString(),
      },
      {
        from: 'tester',
        to: 'team-lead',
        summary: 'Hypothesis NOT confirmed - both test apps stayed running',
        timestamp: new Date(Date.now() - 50000).toISOString(),
      },
      {
        from: 'researcher',
        to: 'team-lead',
        summary: 'Research results on MenuBarExtra + AsyncStream exit issue',
        timestamp: new Date(Date.now() - 30000).toISOString(),
      },
    ],
  })
}
