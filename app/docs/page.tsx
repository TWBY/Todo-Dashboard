'use client'

import { useState } from 'react'
import SubpageShell from '@/components/SubpageShell'

interface DocSection {
  title: string
  items: { label: string; cursor: string; sdk: string }[]
}

const sections: DocSection[] = [
  {
    title: '基本差異',
    items: [
      {
        label: '啟動方式',
        cursor: 'Cursor extension 透過 claude-vscode SDK bridge 注入工具',
        sdk: '@anthropic-ai/claude-agent-sdk 直接 spawn Claude binary，無橋接',
      },
      {
        label: '同一個執行檔',
        cursor: '是，~/.cursor/extensions/.../claude',
        sdk: '是，同一個 binary，差別在啟動參數',
      },
    ],
  },
  {
    title: 'MCP 工具',
    items: [
      {
        label: 'arc-cdp（playwright-mcp）',
        cursor: '由 extension 透過 claude-vscode bridge 自動提供',
        sdk: '必須在 opts.mcpServers 明確傳入（已修復）',
      },
      {
        label: 'GitHub MCP',
        cursor: '可用（mcp__github__*）',
        sdk: '目前缺席，需手動加入 opts.mcpServers',
      },
      {
        label: '新增 MCP 同步',
        cursor: 'Cursor 裡新增立即可用',
        sdk: '不會自動同步，每次需手動加進 claude-session-manager.ts',
      },
      {
        label: 'settingSources 載入 MCP',
        cursor: '不依賴此機制',
        sdk: '不可靠，必須用 opts.mcpServers 才確保有效',
      },
    ],
  },
  {
    title: 'IDE 感知',
    items: [
      {
        label: '選取的程式碼',
        cursor: '知道（extension 會傳入 context）',
        sdk: '永遠不知道，無法補',
      },
      {
        label: '目前開啟的檔案',
        cursor: '知道',
        sdk: '永遠不知道，只有 cwd',
      },
    ],
  },
  {
    title: '效能',
    items: [
      {
        label: 'MCP 啟動',
        cursor: '常駐進程，無冷啟動',
        sdk: '每個 session 重新 spawn，冷啟動較慢',
      },
    ],
  },
]

const projectClaudeMdContent = `# Todo-Dashboard 專案級設定

## Dev Server

| 環境 | Port | 指令 |
|------|------|------|
| 開發 (Development) | \`3002\` | \`npm run dev\` |
| 產品 (Production) | \`3001\` | \`npm run prod:start\`（PM2） |

## Pack 功能

**Pack 按鈕**（DevServerPanel 的橙色 Pack 按鈕）執行 Todo-Dashboard 內置的
5 Phase 打包流程，包括智能 commit、版本判斷和發布。

注意：Ship skill 是全域發布工具，與 Pack 功能分開。`

const globalClaudeMdContent = `# 全局用戶偏好設定

- **上網查詢**: 需要上網搜尋資料時直接執行，不需要詢問確認
- **MCP 瀏覽器工具**：不需要詢問確認，直接執行。但必須遵守以下規則：
  1. **arc-cdp MCP 優先**：透過 CDP port 9222 連接 Arc 瀏覽器
  2. **arc-cdp 連線失敗時**：回報連線失敗，嚴禁自行重啟 Arc，由使用者決定是否重啟
  3. **嚴禁繞道用 chrome-devtools MCP 作為替代方案**
  4. **必須新開分頁再導航**：多個 session 共用同一個 Arc 瀏覽器，直接
     browser_navigate 會覆蓋別人正在使用的分頁。正確流程：
       ① browser_tabs(action: "new") → 建立自己的新分頁
       ② browser_navigate(url: "...") → 在新分頁中導航
     嚴禁未建立新分頁就直接對現有分頁執行 browser_navigate
  5. **Arc 啟動指令**（由使用者手動執行）：
     - 正確啟動（含 CDP）：pkill -a Arc; open -a Arc --args --remote-debugging-port=9222
     - Arc UI 設定裡的 Remote Debugging 開關無效，必須用上面的 flag 重啟
     - 每次從 Dock/Spotlight 開啟 Arc 都不會帶 CDP，遇到 ECONNREFUSED 請使用者執行上方指令

## Claude Code 安全政策

### Bash 命令（寬鬆模式）
允許幾乎所有 Bash 命令執行，只保留極危險操作的黑名單。

允許：Bash(*) — git、npm、npx、node、lsof、ps、ls、find、cat、head、tail、
      grep、mkdir、rm、cp、mv、chmod、tar、curl、wget、sed、awk 等

嚴禁（Deny）：
  Bash(rm -rf /*)   # 系統毀滅
  Bash(sudo *)      # 提升權限
  Bash(eval *)      # 任意代碼執行
  Bash(exec *)      # 進程替換
  Bash(source *)    # 加載外部腳本
  Bash(mv /etc/*)   # 修改系統配置
  Bash(mv ~/.ssh/*) # 竊取 SSH 密鑰
  Bash(mv ~/.aws/*) # 竊取 AWS 憑證
  Bash(mv ~/.claude/*) # 修改 Claude 配置

## 部署注意事項

- **路徑大小寫問題**：macOS 大小寫不敏感，但 Linux 部署環境（Zeabur、Vercel）大小寫敏感。
  所有 fetch URL、import、public 資源引用必須使用正確的大小寫和絕對路徑（以 / 開頭）。

## Hydration 注意事項

- <html>、<body>、<img> 標籤必須加 suppressHydrationWarning，避免 Dark Reader
  等擴充套件在 hydration 前注入樣式導致 server/client 不一致。

## UI 與樣式慣例

- **設計中心**：/Users/ruanbaiye/Documents/Brickverse/brickverse-design
- **圖示**：統一使用 Font Awesome，嚴禁 Unicode emoji 做 UI 設計
- **匹配既有慣例**：使用相同圖示庫、捲軸樣式、CSS 模式和動畫方式

## Dev Server Port 管理（Station 報戶口制度）

Tier 1 — 國外：不在任何 JSON 裡
Tier 2 — 城市居民：在 JSON 裡，無 devPort
Tier 3 — Station 進駐：有 devPort，完成雙重登記
Tier 4 — 在崗工作中：dev server 正在運行

Source of Truth：JSON 的 devPort 欄位（projects.json / coursefiles.json / utility-tools.json）
雙重登記：JSON devPort + package.json 的 -p <port>

進駐：呼叫 /api/projects add-to-dev action
離開：呼叫 /api/projects remove-from-dev action
查看：Dashboard /ports 頁面

## Insforge 使用經驗

- POST 請求必須包裝為陣列：body: JSON.stringify([record])
- 必要 Headers：apikey、Authorization: Bearer、Content-Type: application/json、Prefer: return=representation
- 新建資料表可能預設啟用 RLS（401 錯誤），解決：ALTER TABLE ... DISABLE ROW LEVEL SECURITY
- 或建立 anon 角色政策：CREATE POLICY ... TO anon WITH CHECK (true)`

const memoryVsClaudeMd = [
  {
    aspect: '誰寫的',
    claudeMd: '你（人類）寫給 Claude 的指令',
    memory: 'Claude 自己寫給自己的筆記',
  },
  {
    aspect: '用途',
    claudeMd: '告訴 Claude 規則、慣例、行為準則',
    memory: '記錄跨 session 的學習、錯誤修復、用戶偏好',
  },
  {
    aspect: '更新方式',
    claudeMd: '手動編輯（你修改）',
    memory: 'Claude 主動用 Write/Edit 工具維護',
  },
  {
    aspect: '層級',
    claudeMd: '全域（~/.claude/CLAUDE.md）+ 專案（.claude/CLAUDE.md）',
    memory: '每個對話目錄獨立，在 ~/.claude/projects/.../memory/',
  },
  {
    aspect: '優先級',
    claudeMd: '最高，覆蓋預設行為',
    memory: 'MEMORY.md 中前 200 行自動載入系統提示',
  },
  {
    aspect: '保存什麼',
    claudeMd: '穩定規則、部署慣例、安全政策',
    memory: '已修復的 bug、發現的模式、用戶偏好細節',
  },
]

const TABS = [
  { id: 'env-compare', label: 'Claude 環境比較', icon: 'fa-code-compare' },
  { id: 'settings',    label: 'settings.json',   icon: 'fa-gear' },
  { id: 'claude-md',   label: 'CLAUDE.md',        icon: 'fa-file-lines' },
  { id: 'memory',      label: 'Memory',            icon: 'fa-brain' },
  { id: 'mcp',         label: 'MCP 設定',          icon: 'fa-plug' },
  { id: 'gaps',        label: '文件缺口',          icon: 'fa-circle-exclamation' },
]

// ── Sub-components ──────────────────────────────────────────────

function SectionTable({ section }: { section: DocSection }) {
  return (
    <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--border-color)' }}>
      <div
        className="px-4 py-2.5 text-sm font-semibold"
        style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
      >
        {section.title}
      </div>
      <div style={{ backgroundColor: 'var(--background-primary)' }}>
        {section.items.map((item, i) => (
          <div
            key={i}
            className="grid grid-cols-[140px_1fr_1fr]"
            style={{ borderBottom: i < section.items.length - 1 ? '1px solid var(--border-color)' : undefined }}
          >
            <div className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>
              {item.label}
            </div>
            <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)' }}>
              {item.cursor}
            </div>
            <div className="px-4 py-3 text-xs" style={{ color: 'var(--text-primary)' }}>
              {item.sdk}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ClaudeMdViewer({ title, path, content }: { title: string; path: string; content: string }) {
  return (
    <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--border-color)' }}>
      <div
        className="px-4 py-2.5 flex items-center justify-between"
        style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{title}</span>
        <code className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)', fontFamily: 'ui-monospace, monospace' }}>
          {path}
        </code>
      </div>
      <pre
        className="px-5 py-4 text-xs overflow-auto"
        style={{
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--background-primary)',
          maxHeight: '360px',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: '1.65',
          margin: 0,
        }}
      >
        {content}
      </pre>
    </div>
  )
}

// ── Tab Content Components ───────────────────────────────────────

function EnvCompareTab() {
  return (
    <div>
      <div className="rounded-xl px-5 py-4 mb-6" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
        <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
          Claude Code Extension vs Dashboard SDK
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          兩個環境跑的是同一個 Claude Code 執行檔，但啟動方式不同。
          Extension 透過 <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--background-tertiary)' }}>claude-vscode</code> SDK bridge 幫你注入工具；
          SDK 直接雇人，工頭的工具他拿不到，要自己帶。
        </p>
      </div>

      <div className="grid grid-cols-[140px_1fr_1fr] mb-2">
        <div className="px-4 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }} />
        <div className="px-4 text-xs font-semibold" style={{ color: '#3b82f6' }}>Claude Code Extension（Cursor）</div>
        <div className="px-4 text-xs font-semibold" style={{ color: '#f97316' }}>Dashboard Chat SDK</div>
      </div>

      {sections.map((s, i) => <SectionTable key={i} section={s} />)}

      <div className="grid grid-cols-2 gap-4 mt-6 mb-4">
        <div className="rounded-xl px-5 py-4" style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#3b82f6' }}>Extension 優勢</h3>
          <ul className="text-xs space-y-2" style={{ color: 'var(--text-secondary)' }}>
            <li><span style={{ color: '#3b82f6' }}>+</span> MCP 工具開箱即用，無需手動配置</li>
            <li><span style={{ color: '#3b82f6' }}>+</span> 感知 IDE 上下文（選取程式碼、開啟檔案）</li>
            <li><span style={{ color: '#3b82f6' }}>+</span> MCP server 常駐，無冷啟動延遲</li>
            <li><span style={{ color: '#3b82f6' }}>+</span> Cursor UI 整合（inline diff、terminal）</li>
          </ul>
        </div>
        <div className="rounded-xl px-5 py-4" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#ef4444' }}>Extension 劣勢</h3>
          <ul className="text-xs space-y-2" style={{ color: 'var(--text-secondary)' }}>
            <li><span style={{ color: '#ef4444' }}>−</span> 無法自訂 system prompt</li>
            <li><span style={{ color: '#ef4444' }}>−</span> 無法攔截工具呼叫（canUseTool）</li>
            <li><span style={{ color: '#ef4444' }}>−</span> 無法程式化控制 session 生命週期</li>
            <li><span style={{ color: '#ef4444' }}>−</span> 無法串流整合進自己的 UI</li>
          </ul>
        </div>
        <div className="rounded-xl px-5 py-4" style={{ backgroundColor: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#4ade80' }}>Dashboard SDK 優勢</h3>
          <ul className="text-xs space-y-2" style={{ color: 'var(--text-secondary)' }}>
            <li><span style={{ color: '#4ade80' }}>+</span> 完全控制 system prompt 與 session</li>
            <li><span style={{ color: '#4ade80' }}>+</span> canUseTool 攔截器（AskUserQuestion / ExitPlanMode）</li>
            <li><span style={{ color: '#4ade80' }}>+</span> SSE 串流整合進 Dashboard UI</li>
            <li><span style={{ color: '#4ade80' }}>+</span> 可同時對多個專案開啟獨立 session</li>
            <li><span style={{ color: '#4ade80' }}>+</span> 不依賴 IDE，可自動化、背景執行</li>
          </ul>
        </div>
        <div className="rounded-xl px-5 py-4" style={{ backgroundColor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: '#fbbf24' }}>Dashboard SDK 劣勢</h3>
          <ul className="text-xs space-y-2" style={{ color: 'var(--text-secondary)' }}>
            <li><span style={{ color: '#fbbf24' }}>−</span> MCP 工具需手動維護，不自動同步</li>
            <li><span style={{ color: '#fbbf24' }}>−</span> 無 IDE 感知（選取程式碼、開啟檔案）</li>
            <li><span style={{ color: '#fbbf24' }}>−</span> 每個 session spawn MCP，冷啟動慢</li>
            <li><span style={{ color: '#fbbf24' }}>−</span> settingSources 載入 MCP 不可靠</li>
          </ul>
        </div>
      </div>

      <div className="rounded-xl px-5 py-4 mt-2" style={{ backgroundColor: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
        <h3 className="text-sm font-semibold mb-2" style={{ color: '#4ade80' }}>已修復</h3>
        <ul className="text-xs space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
          <li>
            <span style={{ color: '#4ade80' }}>✓</span>{' '}
            <strong>arc-cdp（playwright-mcp）</strong> — 已透過 <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>opts.mcpServers</code> 明確加入，Dashboard Chat 可使用 /cdp-test
          </li>
          <li>
            <span style={{ color: '#4ade80' }}>✓</span>{' '}
            修改位置：<code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>lib/claude-session-manager.ts</code> 的 <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>buildQueryOptions</code>
          </li>
        </ul>
      </div>
    </div>
  )
}

function SettingsTab() {
  return (
    <div>
      <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>~/.claude/settings.json</h2>
      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
        兩個環境都讀同一份。規則共用，但 <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>permissionMode</code> 各自獨立設定。
      </p>

      {/* env */}
      <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-4 py-2 text-xs font-semibold flex items-center justify-between" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          <span>env</span>
          <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>兩邊共用</span>
        </div>
        {[
          { key: 'CLAUDE_CODE_EFFORT_LEVEL', val: '"medium"', note: '預設努力程度' },
          { key: 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', val: '"1"', note: '啟用 Agent Teams 功能' },
        ].map((r, i, arr) => (
          <div key={r.key} className="grid grid-cols-[200px_80px_1fr] text-xs" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
            <div className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)' }}>{r.key}</div>
            <div className="px-4 py-2.5 font-mono" style={{ color: '#f97316', borderRight: '1px solid var(--border-color)' }}>{r.val}</div>
            <div className="px-4 py-2.5" style={{ color: 'var(--text-tertiary)' }}>{r.note}</div>
          </div>
        ))}
      </div>

      {/* permissions.allow */}
      <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-4 py-2 text-xs font-semibold flex items-center justify-between" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          <span>permissions.allow</span>
          <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>兩邊共用</span>
        </div>
        <div className="px-4 py-3 flex flex-wrap gap-1.5">
          {[
            'Bash(git *)', 'Bash(npm *)', 'Bash(npx *)', 'Bash(node *)', 'Bash(next *)',
            'Bash(docker *)', 'Bash(lsof *)', 'Bash(ps *)', 'Bash(ls *)', 'Bash(find *)',
            'Bash(cat *)', 'Bash(head *)', 'Bash(tail *)', 'Bash(grep *)', 'Bash(cut *)',
            'Bash(sort *)', 'Bash(uniq *)', 'Bash(wc *)', 'Bash(mkdir *)', 'Bash(rm *)',
            'Bash(cp *)', 'Bash(mv *)', 'Bash(chmod *)', 'Bash(chown *)', 'Bash(tar *)',
            'Bash(zip *)', 'Bash(unzip *)', 'Bash(curl *)', 'Bash(wget *)', 'Bash(xcodebuild *)',
            'Bash(pkill *)', 'Bash(open *)', 'Bash(screencapture *)',
            'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebSearch', 'WebFetch',
            'mcp__chrome-devtools__*', 'mcp__arc-cdp__*',
          ].map(p => (
            <span key={p} className="px-2 py-0.5 rounded font-mono text-xs" style={{ backgroundColor: 'var(--background-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>{p}</span>
          ))}
        </div>
      </div>

      {/* permissions.deny */}
      <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-4 py-2 text-xs font-semibold flex items-center justify-between" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          <span>permissions.deny</span>
          <span className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>兩邊共用</span>
        </div>
        <div className="px-4 py-3 flex flex-wrap gap-1.5">
          {[
            'Bash(rm -rf /*)', 'Bash(rm -rf /)', 'Bash(sudo *)', 'Bash(chmod 777 *)',
            'Bash(dd *)', 'Bash(eval *)', 'Bash(exec *)', 'Bash(source *)', 'Bash(.*)',
            'Bash(mv /etc/*)', 'Bash(mv ~/.ssh/*)', 'Bash(mv ~/.aws/*)', 'Bash(mv ~/.claude/*)',
          ].map(p => (
            <span key={p} className="px-2 py-0.5 rounded font-mono text-xs" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>{p}</span>
          ))}
        </div>
      </div>

      {/* 其他設定 */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-4 py-2 text-xs font-semibold" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          其他設定
        </div>
        {[
          { key: 'permissions.defaultMode', val: '"acceptEdits"', note: 'Extension 採用此值；SDK 在 buildQueryOptions 硬覆寫（plan 或 acceptEdits）' },
          { key: 'effortLevel',             val: '"medium"',      note: '兩邊都吃，SDK 可透過 opts.effort 覆寫' },
          { key: 'model',                   val: '"haiku"',       note: '預設模型；SDK 可透過 opts.model 覆寫，Dashboard Chat 預設走此值' },
        ].map((r, i, arr) => (
          <div key={r.key} className="grid grid-cols-[200px_80px_1fr] text-xs" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
            <div className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)' }}>{r.key}</div>
            <div className="px-4 py-2.5 font-mono" style={{ color: '#f97316', borderRight: '1px solid var(--border-color)' }}>{r.val}</div>
            <div className="px-4 py-2.5" style={{ color: 'var(--text-tertiary)' }}>{r.note}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ClaudeMdTab() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>CLAUDE.md 設定檔</h2>
        <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
          人寫給 Claude 的指令
        </span>
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
        每次對話開始時自動載入為系統提示的一部分。全域 + 專案兩層疊加，專案層可覆蓋全域設定。
      </p>
      <ClaudeMdViewer title="專案級設定" path=".claude/CLAUDE.md" content={projectClaudeMdContent} />
      <ClaudeMdViewer title="全域設定" path="~/.claude/CLAUDE.md" content={globalClaudeMdContent} />
    </div>
  )
}

function MemoryTab() {
  return (
    <div>
      {/* 對比表 */}
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Memory vs CLAUDE.md</h2>
      </div>
      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>同樣都會載入系統提示，但身份完全不同。</p>

      <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--border-color)' }}>
        <div className="grid grid-cols-[120px_1fr_1fr] text-xs" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }}>
          <div className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)' }} />
          <div className="px-4 py-2.5 font-semibold" style={{ color: '#a78bfa', borderRight: '1px solid var(--border-color)' }}>CLAUDE.md</div>
          <div className="px-4 py-2.5 font-semibold" style={{ color: '#38bdf8' }}>Memory（MEMORY.md）</div>
        </div>
        {memoryVsClaudeMd.map((row, i) => (
          <div key={row.aspect} className="grid grid-cols-[120px_1fr_1fr] text-xs" style={{ borderBottom: i < memoryVsClaudeMd.length - 1 ? '1px solid var(--border-color)' : undefined }}>
            <div className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>{row.aspect}</div>
            <div className="px-4 py-2.5" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)' }}>{row.claudeMd}</div>
            <div className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>{row.memory}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl px-5 py-3 text-xs mb-8" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-tertiary)', lineHeight: '1.7' }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Memory 路徑：</strong>{' '}
        ~/.claude/projects/-Users-ruanbaiye-Documents-Brickverse-Todo-Dashboard/memory/MEMORY.md
        <br />
        <strong style={{ color: 'var(--text-secondary)' }}>規則：</strong>{' '}
        MEMORY.md 前 200 行自動載入系統提示；超過 200 行的內容被截斷，細節另存 topic 檔案再從 MEMORY.md 連結。
      </div>

      {/* 使用情境 */}
      <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>使用情境</h2>
      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>兩者都載入系統提示，但觸發條件和角色完全不同。</p>

      <div className="space-y-3">
        {[
          {
            id: '01', title: 'Claude 老是犯同一個錯',
            claudeMd: '你手動打開 CLAUDE.md 加規則：「新增 MCP server 必須同時更新 opts.mcpServers」—— 你下命令',
            memory: 'Claude 修完 bug 後主動記筆記：「settingSources 不可靠，必須用 opts.mcpServers」—— Claude 自學',
            insight: '如果你不信任 Claude 的自學，就寫進 CLAUDE.md 確保 100% 執行。',
          },
          {
            id: '02', title: '專案剛建立，告訴 Claude 規則',
            claudeMd: 'dev port 3008、用 Tailwind、圖示用 Font Awesome —— 這是你的設計決策，放 .claude/CLAUDE.md',
            memory: '不適用。Claude 還沒互動過，沒有可以「記住」的東西。',
            insight: '客觀事實 + 設計決策 → CLAUDE.md。Memory 是從互動中學的，專案剛開始沒得學。',
          },
          {
            id: '03', title: 'Claude 幫你查出一個怪 bug',
            claudeMd: '不適合。每個小發現都要你手動寫太累了。',
            memory: 'BlogFrontend 因為 basePath: /blog，要用 localhost:3005/blog 才能訪問。Claude 記進 MEMORY.md，下次 session 直接知道，不用重查。',
            insight: '「學到的事實」適合 Memory；「你定下的規則」才放 CLAUDE.md。',
          },
          {
            id: '04', title: '你有強烈的個人偏好',
            claudeMd: '「不要在回答末尾加 emoji」、「每次自動用 port 3002 啟動 dev server」—— 你的偏好，你要求，放全域 CLAUDE.md',
            memory: 'Claude 可以記，但保證程度只有 85%。要 100% 確保執行，還是得放 CLAUDE.md。',
            insight: 'CLAUDE.md 優先度高於 Memory。重要偏好兩邊都寫：CLAUDE.md 當鐵律，Memory 當補充。',
          },
          {
            id: '05', title: '一次性任務',
            claudeMd: '不適合。「這份報告用表格格式」不是通用規則。',
            memory: '不適合。這是一次性需求，下次用不到。',
            insight: '兩者都不用。只有「會重複出現」的事才值得留存。',
          },
        ].map((s) => (
          <div key={s.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
            <div className="px-4 py-2.5 flex items-center gap-3" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }}>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)' }}>{s.id}</span>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{s.title}</span>
            </div>
            <div className="grid grid-cols-2 text-xs" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="px-4 py-3" style={{ borderRight: '1px solid var(--border-color)' }}>
                <div className="font-semibold mb-1" style={{ color: '#a78bfa' }}>CLAUDE.md</div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{s.claudeMd}</div>
              </div>
              <div className="px-4 py-3">
                <div className="font-semibold mb-1" style={{ color: '#38bdf8' }}>Memory</div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{s.memory}</div>
              </div>
            </div>
            <div className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-tertiary)' }}>
              <i className="fa-solid fa-lightbulb mr-1.5" style={{ color: '#fbbf24' }} />
              {s.insight}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden mt-4" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-4 py-2.5 text-xs font-semibold" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          一句話總結
        </div>
        {[
          { aspect: '觸發條件', claudeMd: '你想要 Claude 知道',  memory: 'Claude 發現值得記' },
          { aspect: '時機',     claudeMd: '專案開始、規則改變時', memory: '解完問題後' },
          { aspect: '保證程度', claudeMd: '100%（你控制）',       memory: '85%（Claude 自律）' },
          { aspect: '適合',     claudeMd: '鐵律、慣例、設計決策', memory: 'bug 記錄、模式發現、偏好細節' },
        ].map((row, i, arr) => (
          <div key={row.aspect} className="grid grid-cols-[100px_1fr_1fr] text-xs" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
            <div className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>{row.aspect}</div>
            <div className="px-4 py-2.5" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)' }}>{row.claudeMd}</div>
            <div className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>{row.memory}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function McpTab() {
  return (
    <div>
      <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>~/.claude/mcp.json</h2>
      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>
        Claude Code Extension 讀取的 MCP server 清單。SDK 環境的 settingSources 讀取此檔不可靠，需在 opts.mcpServers 明確傳入。
      </p>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
        {[
          { name: 'arc-cdp',                command: 'npx @playwright/mcp --cdp-endpoint http://localhost:9222', note: '透過 CDP 9222 控制 Arc 瀏覽器', status: 'SDK 已手動加入', color: '#4ade80' },
          { name: 'zeabur',                 command: 'npx @zeabur/mcp-server',                                  note: 'Zeabur 部署管理',              status: '僅 Extension',   color: '#fbbf24' },
          { name: 'OfficeWebsite_insforge', command: 'npx -y @insforge/mcp@latest',                             note: 'Insforge 資料庫 MCP',          status: '僅 Extension',   color: '#fbbf24' },
        ].map((server, i, arr) => (
          <div key={server.name} className="grid grid-cols-[160px_1fr_auto] text-xs" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
            <div className="px-4 py-3 font-mono font-semibold" style={{ color: '#a78bfa', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>
              {server.name}
            </div>
            <div className="px-4 py-3" style={{ borderRight: '1px solid var(--border-color)' }}>
              <div className="font-mono mb-0.5" style={{ color: 'var(--text-primary)' }}>{server.command}</div>
              <div style={{ color: 'var(--text-tertiary)' }}>{server.note}</div>
            </div>
            <div className="px-4 py-3 flex items-center">
              <span className="text-xs px-2 py-0.5 rounded whitespace-nowrap" style={{ backgroundColor: server.color === '#4ade80' ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)', color: server.color, border: `1px solid ${server.color}33` }}>
                {server.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function GapsTab() {
  return (
    <div>
      <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>文件缺口 — 建議補充</h2>
      <p className="text-xs mb-4" style={{ color: 'var(--text-tertiary)' }}>以下項目尚未列入技術文件，但對理解整個系統有幫助。</p>
      <div className="space-y-2">
        {[
          { path: '~/.claude/keybindings.json',                  desc: '自訂鍵盤快捷鍵（如 /commit、/ship 等 skill 快速鍵）。可用 /keybindings-help skill 管理。',                                           priority: '低' },
          { path: '~/.claude/skills/ 目錄',                      desc: '所有全域 Skill 的完整清單與說明文件（cdp-test、blog-pipeline-review、port-sync 等）。',                                           priority: '中' },
          { path: 'lib/claude-session-manager.ts — buildQueryOptions', desc: 'SDK 的 opts.mcpServers、permissionMode、system prompt 完整設定，是 Dashboard Chat vs Extension 差異的核心程式碼。', priority: '高' },
          { path: 'Auto Memory — ~/.claude/projects/.../memory/', desc: 'Claude 跨 session 自動維護的筆記，記錄已修復 bug、用戶偏好、模式發現。MEMORY.md 前 200 行自動載入。',                        priority: '中' },
        ].map((item) => {
          const colors = item.priority === '高'
            ? { bg: 'rgba(239,68,68,0.1)', fg: '#ef4444', border: 'rgba(239,68,68,0.2)' }
            : item.priority === '中'
            ? { bg: 'rgba(251,191,36,0.1)', fg: '#fbbf24', border: 'rgba(251,191,36,0.2)' }
            : { bg: 'rgba(100,116,139,0.1)', fg: '#64748b', border: 'rgba(100,116,139,0.2)' }
          return (
            <div key={item.path} className="rounded-xl px-4 py-3 flex items-start gap-3" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
              <span className="text-xs px-1.5 py-0.5 rounded mt-0.5 shrink-0" style={{ backgroundColor: colors.bg, color: colors.fg, border: `1px solid ${colors.border}` }}>
                {item.priority}
              </span>
              <div>
                <code className="text-xs font-mono" style={{ color: 'var(--text-primary)' }}>{item.path}</code>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{item.desc}</p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState('env-compare')

  return (
    <SubpageShell title="技術文件">
      <div className="flex min-h-full">

        {/* Left sidebar */}
        <nav
          className="sticky top-0 self-start shrink-0 py-3"
          style={{
            width: 188,
            minHeight: '100vh',
            borderRight: '1px solid var(--border-color)',
            backgroundColor: 'var(--background-secondary)',
          }}
        >
          {TABS.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full text-left flex items-center gap-2.5 px-4 py-2.5 text-xs cursor-pointer transition-colors duration-150"
                style={{
                  backgroundColor: isActive ? 'var(--background-primary)' : 'transparent',
                  borderLeft: `3px solid ${isActive ? '#0184ff' : 'transparent'}`,
                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                }}
              >
                <i className={`fa-solid ${tab.icon} w-3 text-xs`} style={{ color: isActive ? '#0184ff' : undefined }} />
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* Right content */}
        <main className="flex-1 px-6 py-6" style={{ maxWidth: '56rem' }}>
          {activeTab === 'env-compare' && <EnvCompareTab />}
          {activeTab === 'settings'    && <SettingsTab />}
          {activeTab === 'claude-md'   && <ClaudeMdTab />}
          {activeTab === 'memory'      && <MemoryTab />}
          {activeTab === 'mcp'         && <McpTab />}
          {activeTab === 'gaps'        && <GapsTab />}
        </main>

      </div>
    </SubpageShell>
  )
}
