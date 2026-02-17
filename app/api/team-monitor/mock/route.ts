import { NextResponse } from 'next/server'

/**
 * Mock Team Monitor API — 動態模擬 Agent Team 生命週期
 * 每次 polling 根據「距離首次請求」的秒數，回傳對應階段的狀態
 * 時間線：60 秒跑完整個 Team 生命週期
 *
 * GET /api/team-monitor/mock
 */

// 全域記住起點（模組層級，dev server hot-reload 時重置）
let startTime: number | null = null
let createdAt: number | null = null

// 重置：加 ?reset=<token> 參數可重新開始
export async function GET(request: Request) {
  const url = new URL(request.url)
  const reset = url.searchParams.get('reset')

  // 新的重置機制：?reset=<任意值> 直接重置
  if (reset && reset !== 'false' && reset !== '0') {
    startTime = Date.now()
    createdAt = Date.now()
    return NextResponse.json({ reset: true, createdAt })
  }

  if (!startTime) {
    startTime = Date.now()
    createdAt = Date.now()
  }
  const elapsed = (Date.now() - startTime) / 1000 // 經過秒數

  // ─── 時間線定義（秒） ───
  // 0s:  team 建立，3 member spawned
  // 2s:  team-lead 分派任務 (3 條下行訊息)
  // 8s:  scanner-fixer 完成第一個子任務
  // 12s: scanner-builder 進度回報
  // 18s: scanner-fixer 完成第二個子任務
  // 22s: ui-improver 進度回報
  // 28s: scanner-fixer 全部完成 → idle
  // 30s: scanner-builder 全部完成 → idle
  // 35s: team-lead 廣播查進度
  // 40s: ui-improver 全部完成
  // 45s: scanner-builder shutdown
  // 47s: scanner-fixer shutdown
  // 50s: ui-improver shutdown
  // 55s: 全部結束

  const now = Date.now()
  const ts = (secondsAfterStart: number) => new Date(startTime! + secondsAfterStart * 1000).toISOString()

  // ─── Members（根據時間決定狀態）───
  const members = [
    { name: 'team-lead', agentId: 'team-lead@smu', agentType: 'lead', status: 'idle' as const },
    {
      name: 'scanner-builder', agentId: 'scanner-builder@smu', agentType: 'general-purpose', color: 'blue',
      status: elapsed >= 45 ? 'shutdown' as const : elapsed >= 30 ? 'idle' as const : 'working' as const,
    },
    {
      name: 'scanner-fixer', agentId: 'scanner-fixer@smu', agentType: 'general-purpose', color: 'green',
      status: elapsed >= 47 ? 'shutdown' as const : elapsed >= 28 ? 'idle' as const : 'working' as const,
    },
    {
      name: 'ui-improver', agentId: 'ui-improver@smu', agentType: 'general-purpose', color: 'yellow',
      status: elapsed >= 50 ? 'shutdown' as const : elapsed >= 40 ? 'idle' as const : 'working' as const,
    },
  ]

  // ─── Tasks（根據時間推進狀態）───
  const taskDef = [
    { id: '1', desc: '新增 env-secrets + macos-security 掃描器', owner: 'scanner-builder', doneAt: 30 },
    { id: '2', desc: '擴充 credentials.ts（AWS/GitHub CLI/gcloud）', owner: 'scanner-builder', doneAt: 30 },
    { id: '3', desc: '修復 scoring.ts — low severity 不加分', owner: 'scanner-fixer', doneAt: 8 },
    { id: '4', desc: '改善 system-services.ts 網路監聽偵測', owner: 'scanner-fixer', doneAt: 18 },
    { id: '5', desc: '擴充 MCP token 偵測模式（11 種）', owner: 'scanner-fixer', doneAt: 28 },
    { id: '6', desc: '新增分類過濾器', owner: 'ui-improver', doneAt: 22 },
    { id: '7', desc: 'CategoryCard 可點擊跳轉', owner: 'ui-improver', doneAt: 35 },
    { id: '8', desc: '新增回到頂部按鈕', owner: 'ui-improver', doneAt: 40 },
  ]

  const tasks = taskDef.map(t => ({
    id: t.id,
    description: t.desc,
    owner: t.owner,
    status: elapsed >= t.doneAt ? 'completed'
      : elapsed >= t.doneAt - 8 ? 'in_progress' // 完成前 8 秒開始 in_progress
      : 'pending',
  }))

  // ─── Messages + Events（只回傳已到達時間的）───
  type Msg = { from: string; to: string; summary: string; text?: string; timestamp: string }
  type Evt = { type: string; from: string; summary: string; timestamp: string }

  const allMessages: (Msg & { showAt: number })[] = [
    // :02 team-lead 分派任務
    { showAt: 2, from: 'team-lead', to: 'scanner-builder', summary: '建立 env-secrets 和 macos-security 兩個新掃描器，並擴充 credentials.ts', text: '## 你的任務\n\n### Task 1: 建立 lib/scanners/env-secrets.ts\n掃描 ~/.zshrc、~/.zprofile 中的硬編碼 API key\n\n### Task 2: 建立 lib/scanners/macos-security.ts\n掃描 FileVault、SIP、Firewall、Gatekeeper\n\n### Task 3: 擴充 credentials.ts\n新增 AWS、GitHub CLI、gcloud、npmrc、kubeconfig', timestamp: ts(2) },
    { showAt: 2, from: 'team-lead', to: 'scanner-fixer', summary: '修復 scoring 計分問題，改善 system-services 和 MCP token 偵測', text: '## 你的任務\n\n1. scoring.ts — low severity 改為 0 分\n2. system-services.ts — 區分 0.0.0.0 vs 127.0.0.1\n3. mcp-servers.ts — token 偵測從 3 種擴充到 11 種', timestamp: ts(2.5) },
    { showAt: 2, from: 'team-lead', to: 'ui-improver', summary: '新增分類過濾器、CategoryCard 點擊跳轉、回到頂部按鈕', text: '## 你的任務\n\n1. FindingsByCategory 頂部新增 pill 篩選器\n2. CategoryCard 可點擊，跳轉到 Finding 區塊\n3. 浮動回到頂部按鈕', timestamp: ts(3) },

    // :08 scanner-fixer 第一個回報
    { showAt: 8, from: 'scanner-fixer', to: 'team-lead', summary: 'scoring.ts 已修復：low severity 改為 0 分', text: '已將 SEVERITY_POINTS 中的 low 從 3 改為 0。安全區卡片不再推高風險分數。', timestamp: ts(8) },

    // :12 scanner-builder 進度回報
    { showAt: 12, from: 'scanner-builder', to: 'team-lead', summary: 'env-secrets.ts 已完成，正在建立 macos-security.ts', timestamp: ts(12) },

    // :18 scanner-fixer 第二個回報
    { showAt: 18, from: 'scanner-fixer', to: 'team-lead', summary: 'system-services.ts 已改善：區分 0.0.0.0 vs 127.0.0.1', text: '1. 監聽埠區分 0.0.0.0（暴露 → high）vs 127.0.0.1（本地）\n2. 新增 ~/.ssh/authorized_keys 偵測\n3. 新增 StrictHostKeyChecking no 偵測', timestamp: ts(18) },

    // :22 ui-improver 回報
    { showAt: 22, from: 'ui-improver', to: 'team-lead', summary: '分類過濾器和 CategoryCard 點擊跳轉已完成', text: '- FindingsByCategory 頂部新增 pill 篩選器\n- CategoryCard 可點擊，自動過濾並捲動到 Findings\n- 狀態由 DashboardClient 管理', timestamp: ts(22) },

    // :28 scanner-fixer 全部完成
    { showAt: 28, from: 'scanner-fixer', to: 'team-lead', summary: 'All 3 scanner bug fixes completed', text: '✅ scoring.ts — low = 0 分\n✅ system-services.ts — 0.0.0.0 vs localhost\n✅ mcp-servers.ts — 11 種 token 偵測', timestamp: ts(28) },

    // :30 scanner-builder 全部完成
    { showAt: 30, from: 'scanner-builder', to: 'team-lead', summary: 'All 4 scanner tasks completed, build passes', text: '✅ env-secrets.ts — shell 設定檔 API key 掃描\n✅ macos-security.ts — FileVault/SIP/Firewall/Gatekeeper\n✅ credentials.ts 擴充 — AWS/GitHub CLI/gcloud/npmrc/kube\n✅ npm run build 通過', timestamp: ts(30) },

    // :35 team-lead 廣播
    { showAt: 35, from: 'team-lead', to: 'scanner-builder', summary: '請回報目前進度', timestamp: ts(35) },
    { showAt: 35, from: 'team-lead', to: 'scanner-fixer', summary: '請回報目前進度', timestamp: ts(35) },
    { showAt: 35, from: 'team-lead', to: 'ui-improver', summary: '請回報目前進度', timestamp: ts(35) },

    // :40 ui-improver 最終回報
    { showAt: 40, from: 'ui-improver', to: 'team-lead', summary: 'All 3 UI tasks complete: filter, clickable cards, scroll-to-top', timestamp: ts(40) },
  ]

  const allEvents: (Evt & { showAt: number })[] = [
    { showAt: 9, type: 'idle', from: 'scanner-fixer', summary: 'scanner-fixer 閒置中（上次操作：Edit）', timestamp: ts(9) },
    { showAt: 13, type: 'idle', from: 'scanner-builder', summary: 'scanner-builder 閒置中（上次操作：Write）', timestamp: ts(13) },
    { showAt: 19, type: 'idle', from: 'scanner-fixer', summary: 'scanner-fixer 閒置中（上次操作：Edit）', timestamp: ts(19) },
    { showAt: 23, type: 'idle', from: 'ui-improver', summary: 'ui-improver 閒置中（上次操作：Write）', timestamp: ts(23) },
    { showAt: 29, type: 'idle', from: 'scanner-fixer', summary: 'scanner-fixer 閒置中（所有任務完成）', timestamp: ts(29) },
    { showAt: 31, type: 'idle', from: 'scanner-builder', summary: 'scanner-builder 閒置中（所有任務完成）', timestamp: ts(31) },
    { showAt: 45, type: 'shutdown', from: 'scanner-builder', summary: 'scanner-builder 已確認關閉', timestamp: ts(45) },
    { showAt: 47, type: 'shutdown', from: 'scanner-fixer', summary: 'scanner-fixer 已確認關閉', timestamp: ts(47) },
    { showAt: 50, type: 'shutdown', from: 'ui-improver', summary: 'ui-improver 已確認關閉', timestamp: ts(50) },
  ]

  // 只回傳已到時間的
  const messages = allMessages
    .filter(m => elapsed >= m.showAt)
    .map(({ showAt, ...rest }) => rest)

  const systemEvents = allEvents
    .filter(e => elapsed >= e.showAt)
    .map(({ showAt, ...rest }) => rest)

  return NextResponse.json({
    teamName: 'security-monitor-upgrade',
    description: 'SecurityMonitor 安全儀表板功能強化 — 新增掃描器、修復現有問題、改善 UI',
    createdAt: createdAt || startTime,
    members,
    tasks,
    messages,
    systemEvents,
  })
}
