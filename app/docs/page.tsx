'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ClaudeChatPanel from '@/components/ClaudeChatPanel'

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
  { id: 'tech-stack',  label: '技術架構',          icon: 'fa-layer-group' },
  { id: 'env-compare', label: 'Claude 環境比較', icon: 'fa-code-compare' },
  { id: 'settings',    label: 'settings.json',   icon: 'fa-gear' },
  { id: 'claude-md',   label: 'CLAUDE.md',        icon: 'fa-file-lines' },
  { id: 'memory',      label: 'Memory',            icon: 'fa-brain' },
  { id: 'mcp',         label: 'MCP 設定',          icon: 'fa-plug' },
  { id: 'arc-cdp',     label: 'Arc CDP',           icon: 'fa-microchip' },
  { id: 'gaps',        label: '文件缺口',          icon: 'fa-circle-exclamation' },
]

// ── Sub-components ──────────────────────────────────────────────

// ── Reusable UI Components ──────────────────────────────────────

function ExpandableBox({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--border-color)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm cursor-pointer transition-colors duration-150"
        style={{
          backgroundColor: 'var(--background-secondary)',
          borderBottom: open ? '1px solid var(--border-color)' : 'none',
          color: 'var(--text-secondary)',
        }}
      >
        <span className="flex items-center gap-2.5">
          <i className="fa-solid fa-circle-info" style={{ color: '#3b82f6' }} />
          {label}
        </span>
        <i
          className="fa-solid fa-chevron-down text-[10px]"
          style={{
            color: 'var(--text-tertiary)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 200ms ease',
          }}
        />
      </button>
      {open && (
        <div
          className="px-5 py-4 text-sm animate-fade-in"
          style={{
            backgroundColor: 'var(--background-primary)',
            color: 'var(--text-secondary)',
            lineHeight: '1.75',
          }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

type CalloutType = 'info' | 'tip' | 'warn'

function CalloutBox({ type, children }: { type: CalloutType; children: React.ReactNode }) {
  const styles: Record<CalloutType, { bg: string; border: string; icon: string; color: string }> = {
    info: { bg: 'rgba(59,130,246,0.06)', border: 'rgba(59,130,246,0.2)', icon: 'fa-circle-info', color: '#3b82f6' },
    tip: { bg: 'rgba(74,222,128,0.06)', border: 'rgba(74,222,128,0.2)', icon: 'fa-lightbulb', color: '#4ade80' },
    warn: { bg: 'rgba(251,191,36,0.06)', border: 'rgba(251,191,36,0.2)', icon: 'fa-triangle-exclamation', color: '#fbbf24' },
  }
  const s = styles[type]
  return (
    <div
      className="rounded-xl px-5 py-4 text-sm mb-4 flex gap-3"
      style={{
        backgroundColor: s.bg,
        border: `1px solid ${s.border}`,
        color: 'var(--text-secondary)',
        lineHeight: '1.75',
      }}
    >
      <i className={`fa-solid ${s.icon} mt-0.5 shrink-0`} style={{ color: s.color }} />
      <div>{children}</div>
    </div>
  )
}


function SectionTable({ section }: { section: DocSection }) {
  return (
    <div className="rounded-xl overflow-hidden mb-5" style={{ border: '1px solid var(--border-color)' }}>
      <div
        className="px-5 py-3 text-base font-semibold"
        style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
      >
        {section.title}
      </div>
      <div style={{ backgroundColor: 'var(--background-primary)' }}>
        {section.items.map((item, i) => (
          <div
            key={i}
            className="grid grid-cols-[160px_1fr_1fr]"
            style={{ borderBottom: i < section.items.length - 1 ? '1px solid var(--border-color)' : undefined }}
          >
            <div className="px-5 py-3.5 text-sm font-medium" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>
              {item.label}
            </div>
            <div className="px-5 py-3.5 text-sm" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)' }}>
              {item.cursor}
            </div>
            <div className="px-5 py-3.5 text-sm" style={{ color: 'var(--text-primary)' }}>
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
    <div className="rounded-xl overflow-hidden mb-5" style={{ border: '1px solid var(--border-color)' }}>
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>{title}</span>
        <code className="text-sm px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)', fontFamily: 'ui-monospace, monospace' }}>
          {path}
        </code>
      </div>
      <pre
        className="px-5 py-4 text-sm"
        style={{
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--background-primary)',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          lineHeight: '1.7',
          margin: 0,
        }}
      >
        {content}
      </pre>
    </div>
  )
}

// ── Tab Content Components ───────────────────────────────────────

function TechStackTab() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        Todo-Dashboard 技術架構
      </h2>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
        本專案的前端、後端、AI 整合、部署等技術選型一覽。了解整體架構有助於快速定位問題和擴充功能。
      </p>

      <CalloutBox type="info">
        <strong>把 Todo-Dashboard 想成一棟公司大樓。</strong> 前端（Next.js + React）是大廳和各樓層的裝潢——訪客看到的一切。AI 整合（Claude SDK）是駐樓的顧問公司，從大樓後門（Node.js process）進出，用對講機（MCP）操控設備。後端（API Routes + JSON）是地下室的檔案室和機房。部署系統是大樓的兩個出入口：開發環境是員工通道（port 3002），生產環境是正門（port 3001）。
      </CalloutBox>

      {/* Frontend */}
      <div className="rounded-xl overflow-hidden mb-5" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-5 py-3 text-base font-semibold" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          <i className="fa-solid fa-display mr-2" style={{ color: '#3b82f6' }} />
          前端（Frontend）
        </div>
        <div style={{ backgroundColor: 'var(--background-primary)' }}>
          {[
            { tech: 'Next.js 16', role: '前端框架', detail: 'App Router、Turbopack dev、Server Components' },
            { tech: 'React 19', role: 'UI 函式庫', detail: '使用 Server Components + Client Components 混合模式' },
            { tech: 'TypeScript 5', role: '型別系統', detail: '全專案 strict mode' },
            { tech: 'Tailwind CSS 4', role: '樣式系統', detail: '搭配 CSS 變數做暗色/亮色主題切換' },
            { tech: 'Font Awesome 6', role: '圖示庫', detail: '透過 CDN 載入，全站禁止 Unicode emoji' },
          ].map((row, i, arr) => (
            <div key={row.tech} className="grid grid-cols-[160px_120px_1fr] text-sm" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
              <div className="px-5 py-3.5 font-semibold" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>{row.tech}</div>
              <div className="px-5 py-3.5" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)' }}>{row.role}</div>
              <div className="px-5 py-3.5" style={{ color: 'var(--text-secondary)' }}>{row.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Integration */}
      <div className="rounded-xl overflow-hidden mb-5" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-5 py-3 text-base font-semibold" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          <i className="fa-solid fa-robot mr-2" style={{ color: '#a78bfa' }} />
          AI 整合（Claude Code SDK）
        </div>
        <div style={{ backgroundColor: 'var(--background-primary)' }}>
          {[
            { tech: '@anthropic-ai/claude-code', role: 'Claude SDK', detail: '透過 Node.js spawn Claude binary，提供 Chat 功能' },
            { tech: 'Node.js', role: 'SDK 運行環境', detail: 'SDK 在 server-side 以 Node.js process 運行，非瀏覽器端' },
            { tech: 'claude-session-manager.ts', role: 'Session 管理', detail: '封裝 buildQueryOptions — permissionMode、mcpServers、systemPrompt' },
            { tech: 'MCP (arc-cdp)', role: '瀏覽器控制', detail: '透過 Playwright MCP 控制 Arc 瀏覽器（CDP port 9222）' },
          ].map((row, i, arr) => (
            <div key={row.tech} className="grid grid-cols-[240px_120px_1fr] text-sm" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
              <div className="px-5 py-3.5 font-mono font-semibold" style={{ color: '#a78bfa', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>{row.tech}</div>
              <div className="px-5 py-3.5" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)' }}>{row.role}</div>
              <div className="px-5 py-3.5" style={{ color: 'var(--text-secondary)' }}>{row.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Backend & Data */}
      <div className="rounded-xl overflow-hidden mb-5" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-5 py-3 text-base font-semibold" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          <i className="fa-solid fa-database mr-2" style={{ color: '#f97316' }} />
          後端與資料（Backend & Data）
        </div>
        <div style={{ backgroundColor: 'var(--background-primary)' }}>
          {[
            { tech: 'Next.js API Routes', role: 'API 層', detail: 'app/api/ 目錄，處理 Claude session、專案資料、dev server 控制等' },
            { tech: 'JSON 檔案', role: '資料儲存', detail: 'projects.json / coursefiles.json / utility-tools.json — 專案清單和 port 登記' },
            { tech: 'Insforge (Supabase)', role: '遠端資料庫', detail: 'Blog 文章、部署記錄等持久化資料（REST API + MCP）' },
            { tech: 'PM2', role: 'Production 進程管理', detail: '背景運行 production server（port 3001），支援自動重啟' },
          ].map((row, i, arr) => (
            <div key={row.tech} className="grid grid-cols-[200px_140px_1fr] text-sm" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
              <div className="px-5 py-3.5 font-semibold" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>{row.tech}</div>
              <div className="px-5 py-3.5" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)' }}>{row.role}</div>
              <div className="px-5 py-3.5" style={{ color: 'var(--text-secondary)' }}>{row.detail}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Deployment */}
      <div className="rounded-xl overflow-hidden mb-5" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-5 py-3 text-base font-semibold" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          <i className="fa-solid fa-rocket mr-2" style={{ color: '#4ade80' }} />
          部署與環境（Deployment）
        </div>
        <div style={{ backgroundColor: 'var(--background-primary)' }}>
          {[
            { env: '開發環境 (DEV)', port: '3002', command: 'npm run dev', note: 'Turbopack HMR，紅色環境條' },
            { env: '生產環境 (PROD)', port: '3001', command: 'npm run prod:start', note: 'PM2 背景運行，藍色環境條' },
            { env: 'Zeabur 雲端', port: '—', command: '/ship skill', note: '透過 Zeabur MCP 部署到雲端' },
          ].map((row, i, arr) => (
            <div key={row.env} className="grid grid-cols-[180px_80px_200px_1fr] text-sm" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
              <div className="px-5 py-3.5 font-semibold" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>{row.env}</div>
              <div className="px-5 py-3.5 font-mono" style={{ color: '#f97316', borderRight: '1px solid var(--border-color)' }}>{row.port}</div>
              <div className="px-5 py-3.5 font-mono" style={{ color: 'var(--text-secondary)', borderRight: '1px solid var(--border-color)' }}>{row.command}</div>
              <div className="px-5 py-3.5" style={{ color: 'var(--text-tertiary)' }}>{row.note}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Architecture Diagram */}
      <CalloutBox type="info">
        <strong>大樓動線圖：</strong> 訪客（使用者）從正門進入大廳（瀏覽器） → 搭電梯到辦公樓層（Next.js 前端） → 按下求助鈴（API Routes） → 後門的顧問公司（Claude SDK）派人進場 → 顧問拿起對講機（MCP）操控各種設備（Arc 瀏覽器、Zeabur 部署台、Insforge 資料庫）。所有顧問的工作證（permissions、MCP、system prompt）統一在人事部（<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '4px' }}>lib/claude-session-manager.ts</code>）核發。
      </CalloutBox>

      <ExpandableBox label="Dev Server Port 管理（Station 報戶口制度）">
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
          把 Todo-Dashboard 想成一個國家，國內有三座城市（Brickverse / CourseFiles / Utility）。國家裡有一個工作園區叫 <strong>Station</strong>——類似科技園區，進駐需要報戶口（登記 port）。不是所有居民都需要住在園區裡，但住進去的專案會拿到一個專屬的門牌號碼（devPort）：
          <div style={{ marginTop: '12px' }}>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
              {[
                { tier: 'Tier 1', status: '國外', desc: '不在任何 JSON 資料檔中', color: 'var(--text-tertiary)' },
                { tier: 'Tier 2', status: '城市居民', desc: '在 JSON 中，但沒有 devPort 欄位', color: '#fbbf24' },
                { tier: 'Tier 3', status: 'Station 進駐', desc: '有 devPort，已完成雙重登記（JSON + package.json）', color: '#4ade80' },
                { tier: 'Tier 4', status: '在崗工作中', desc: 'dev server 正在運行', color: '#3b82f6' },
              ].map((row, i, arr) => (
                <div key={row.tier} className="grid grid-cols-[80px_120px_1fr] text-sm" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
                  <div className="px-5 py-3 font-mono font-semibold" style={{ color: row.color, borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>{row.tier}</div>
                  <div className="px-5 py-3 font-medium" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)' }}>{row.status}</div>
                  <div className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>{row.desc}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ marginTop: '12px', color: 'var(--text-tertiary)' }}>
            Source of Truth：JSON 檔案的 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '4px' }}>devPort</code> 欄位。管理頁面：<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '4px' }}>/ports</code>
          </div>
        </div>
      </ExpandableBox>
    </div>
  )
}

function EnvCompareTab() {
  return (
    <div>
      <div className="rounded-xl px-5 py-4 mb-6" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Claude Code Extension vs Dashboard SDK
        </h2>
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
          兩個環境跑的是同一個 Claude Code 執行檔，但啟動方式不同。
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          把 Claude Code 想成承包商。工頭（IDE Bridge）是 Cursor extension 配的仲介，工具箱（MCP servers、IDE 感知）是仲介備好的。你透過 SDK 直接雇人時，仲介不在場，工具箱裡的東西你要自己備齊。
        </p>
      </div>

      <CalloutBox type="tip">
        <strong>大樓比喻：</strong> Extension 就像住在辦公室裡的駐點員工——公司配好了電腦、門禁卡、印表機（MCP 工具），他坐下來就能工作。SDK 則像外派的遠端員工，公司只給了電話號碼（Claude binary），桌椅要自己搬、門禁卡要自己申請、印表機要自己接線。兩個人能力一樣，差在「到職時公司準備了什麼」。
      </CalloutBox>

      <div className="grid grid-cols-[140px_1fr_1fr] mb-2">
        <div className="px-4 text-sm font-semibold" style={{ color: 'var(--text-tertiary)' }} />
        <div className="px-4 text-sm font-semibold" style={{ color: '#3b82f6' }}>Claude Code Extension（Cursor）</div>
        <div className="px-4 text-sm font-semibold" style={{ color: '#f97316' }}>Dashboard Chat SDK</div>
      </div>

      <div style={{ marginTop: '24px', marginBottom: '12px' }}>
        <CalloutBox type="info">
          <strong>什麼是 MCP？</strong> MCP（Model Context Protocol）是大樓裡的「設備控制系統」。有了 MCP，Claude 才能操控外部工具——就像有了門禁卡才能進機房。例如 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>arc-cdp</code> MCP 讓 Claude 能截圖、點擊、導航 Arc 瀏覽器。Extension 的 MCP 由 Cursor 在入職時自動配好；SDK 需要你在程式碼裡明確列出要掛哪些 MCP，否則 Claude 就「沒有手」。
        </CalloutBox>
      </div>

      {sections.map((s, i) => <SectionTable key={i} section={s} />)}

      <ExpandableBox label="為什麼 SDK 永遠感知不到 IDE？">
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
          Extension 在 Cursor 內部運行，就像坐在辦公室裡的員工——他能看到白板上的待辦事項（開啟的檔案）、聽到同事的討論（選取的程式碼）。Cursor 的 VS Code API 會自動把這些「辦公室內的資訊」打包成 context 注入 Claude 的 session。
          <div style={{ marginTop: '8px' }}>
            SDK 是在 Node.js process 裡跑，就像在家遠端工作的員工——他在另一棟建築物裡，不管怎麼打電話給他，他都看不到辦公室白板上寫了什麼、也不知道誰剛走進會議室。
          </div>
          <div style={{ marginTop: '8px', color: 'var(--text-tertiary)' }}>
            這是架構性限制（物理位置不同），無法補。唯一能做的是「把白板內容拍照傳過去」——也就是在 system prompt 或對話中手動提供上下文。
          </div>
        </div>
      </ExpandableBox>

      <div style={{ marginTop: '24px', marginBottom: '12px' }}>
        <h3 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>功能對比一覽</h3>
        <p className="text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>展開下方表格，快速掃一眼兩個環境的優劣勢對比。</p>
      </div>

      <ExpandableBox label="展開：Extension vs SDK 功能對比">
        <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--border-color)' }}>
          <div className="grid grid-cols-[140px_1fr_1fr] text-sm" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }}>
            <div className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)' }}>功能</div>
            <div className="px-4 py-2.5 font-semibold" style={{ color: '#3b82f6', borderRight: '1px solid var(--border-color)' }}>Extension</div>
            <div className="px-4 py-2.5 font-semibold" style={{ color: '#f97316' }}>Dashboard SDK</div>
          </div>
          {[
            { feature: 'MCP 工具', ext: '開箱即用', sdk: '需手動配置' },
            { feature: 'IDE 感知', ext: '有（選取程式碼、開啟檔案）', sdk: '無' },
            { feature: 'System Prompt', ext: '固定無法改', sdk: '完全可控' },
            { feature: 'CanUseTool', ext: '無法攔截', sdk: '可攔截（ExitPlanMode 等）' },
            { feature: 'Session 控制', ext: '無法程式化控制', sdk: '完全控制' },
            { feature: 'UI 整合', ext: 'Cursor 原生', sdk: '可串流進自己的 UI' },
            { feature: '多專案支援', ext: '單工作區', sdk: '同時多個獨立 session' },
            { feature: 'MCP 啟動', ext: '常駐，無冷啟動', sdk: '每 session 重新 spawn，較慢' },
            { feature: '自動化能力', ext: '受限於 IDE', sdk: '可背景執行、自動化' },
          ].map((row, i, arr) => (
            <div key={row.feature} className="grid grid-cols-[140px_1fr_1fr] text-sm" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
              <div className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-secondary)', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>{row.feature}</div>
              <div className="px-4 py-2.5" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)' }}>{row.ext}</div>
              <div className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>{row.sdk}</div>
            </div>
          ))}
        </div>
      </ExpandableBox>

      <ExpandableBox label="SDK 需要安裝什麼？前置準備">
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
          <strong style={{ color: 'var(--text-primary)' }}>1. Claude Code SDK</strong>
          <pre style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-secondary)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontFamily: 'ui-monospace, monospace', marginTop: '6px', marginBottom: '12px' }}>
{`npm install @anthropic-ai/claude-code`}
          </pre>

          <strong style={{ color: 'var(--text-primary)' }}>2. Claude Code CLI（必須已安裝）</strong>
          <div style={{ marginTop: '4px', marginBottom: '12px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
            SDK 會 spawn Claude Code 的 binary。確認安裝：<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>claude --version</code>
            <div style={{ marginTop: '4px' }}>
              若未安裝：<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>npm install -g @anthropic-ai/claude-code</code>
            </div>
          </div>

          <strong style={{ color: 'var(--text-primary)' }}>3. API Key</strong>
          <div style={{ marginTop: '4px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
            需要有效的 Anthropic API key 或 Claude Max 訂閱（已登入 claude 即可）
          </div>
        </div>
      </ExpandableBox>

      <div className="rounded-xl px-5 py-4 mt-4" style={{ backgroundColor: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}>
        <h3 className="text-base font-semibold mb-2" style={{ color: '#4ade80' }}>已修復</h3>
        <ul className="text-sm space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
          <li>
            <i className="fa-solid fa-check" style={{ color: '#4ade80' }} />{' '}
            <strong>arc-cdp（playwright-mcp）</strong> — 已透過 <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>opts.mcpServers</code> 明確加入，Dashboard Chat 可使用 /cdp-test
          </li>
          <li>
            <i className="fa-solid fa-check" style={{ color: '#4ade80' }} />{' '}
            修改位置：<code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>lib/claude-session-manager.ts</code> 的 <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>buildQueryOptions</code>
          </li>
        </ul>
      </div>

      <div className="rounded-xl px-5 py-4 mt-6" style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <h3 className="text-base font-semibold mb-2" style={{ color: '#3b82f6' }}>下一步行動</h3>
        <ul className="text-sm space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
          <li>• 了解 Extension 和 SDK 的差異後，決定「自己適合用哪個環境」</li>
          <li>• 想深入了解 MCP 工具配置？看「MCP 設定」Tab</li>
          <li>• 想自訂 system prompt？進階研究 buildQueryOptions 程式碼</li>
        </ul>
      </div>
    </div>
  )
}

function SettingsTab() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>~/.claude/settings.json</h2>
      <p className="text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>
        兩個環境都讀同一份。規則共用，但 <code className="px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>permissionMode</code> 各自獨立設定。
      </p>

      <CalloutBox type="info">
        想像 settings.json 是大樓的公共規則（不准大聲喧嘩、公共設施使用方式）。Extension 和 SDK 都住在這棟樓，所以 allow/deny 規則共用。但各自的「工作模式」(permissionMode) 就像各房間各自調冷氣——同一個中央系統，但溫度自己設。
      </CalloutBox>

      {/* env */}
      <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-4 py-2 text-sm font-semibold flex items-center justify-between" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          <span>env</span>
          <span className="px-2 py-0.5 rounded text-sm" style={{ backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>兩邊共用</span>
        </div>
        {[
          { key: 'CLAUDE_CODE_EFFORT_LEVEL', val: '"medium"', note: '預設努力程度' },
          { key: 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS', val: '"1"', note: '啟用 Agent Teams 功能' },
        ].map((r, i, arr) => (
          <div key={r.key} className="grid grid-cols-[200px_80px_1fr] text-sm" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
            <div className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)' }}>{r.key}</div>
            <div className="px-4 py-2.5 font-mono" style={{ color: '#f97316', borderRight: '1px solid var(--border-color)' }}>{r.val}</div>
            <div className="px-4 py-2.5" style={{ color: 'var(--text-tertiary)' }}>{r.note}</div>
          </div>
        ))}
      </div>

      <ExpandableBox label="展開：這兩個環境變數控制什麼？">
        <div style={{ marginBottom: '12px' }}>
          <strong style={{ color: 'var(--text-primary)' }}>CLAUDE_CODE_EFFORT_LEVEL</strong>
          <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
            Claude 完成任務時的「投入程度」。
            <ul style={{ marginTop: '6px', marginLeft: '20px', listStyleType: 'disc' }}>
              <li><strong>low</strong> — 較快、較省 token，適合簡單查詢</li>
              <li><strong>medium</strong> — 平衡（預設）</li>
              <li><strong>high</strong> — Claude 會多思考、多驗證，適合複雜任務</li>
            </ul>
            <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
              注意：SDK 可以用 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>opts.effort</code> 覆寫此值（在 buildQueryOptions 中）
            </div>
          </div>
        </div>

        <div>
          <strong style={{ color: 'var(--text-primary)' }}>CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS</strong>
          <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
            打開這個開關後，Claude Code 會啟用 Agent Teams 功能：
            <ul style={{ marginTop: '6px', marginLeft: '20px', listStyleType: 'disc' }}>
              <li>允許 Claude 用 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>TeamCreate</code> 建立子 Agent 群組</li>
              <li>允許多個 Claude instance 協同工作（由主 Claude 當隊長）</li>
              <li>這是實驗性功能（EXPERIMENTAL），API 可能隨版本變動</li>
            </ul>
          </div>
        </div>
      </ExpandableBox>

      {/* permissions.allow */}
      <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-4 py-2 text-sm font-semibold flex items-center justify-between" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          <span>permissions.allow — 開放的命令</span>
          <span className="px-2 py-0.5 rounded text-sm" style={{ backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>兩邊共用</span>
        </div>
        <div className="px-4 py-3" style={{ color: 'var(--text-secondary)', lineHeight: '1.75', fontSize: '13px' }}>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>版本控制</strong><br />
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>git</code>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>包管理工具</strong><br />
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>npm</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>npx</code>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>JavaScript 運行時</strong><br />
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>node</code>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>前端框架與工具</strong><br />
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>next</code>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>容器與部署</strong><br />
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>docker</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>xcodebuild</code>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>系統查詢</strong><br />
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>lsof</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>ps</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>ls</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>find</code>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>文件操作</strong><br />
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>cat</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>head</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>tail</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>grep</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>cut</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>sort</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>uniq</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>wc</code>
            <br />
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>mkdir</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>rm</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>cp</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>mv</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>chmod</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>chown</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>tar</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>zip</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>unzip</code>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>網路工具</strong><br />
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>curl</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>wget</code>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>文本處理</strong><br />
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>sed</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>awk</code>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>程序管理與系統</strong><br />
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>pkill</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>open</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>screencapture</code>
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Claude Code 工具</strong><br />
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>Read</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>Write</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>Edit</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>Glob</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>Grep</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>WebSearch</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>WebFetch</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>mcp__arc-cdp__*</code>
            <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px', marginRight: '4px' }}>mcp__chrome-devtools__*</code>
          </div>
        </div>
      </div>

      {/* permissions.deny */}
      <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-4 py-2 text-sm font-semibold flex items-center justify-between" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          <span>permissions.deny — 禁止進入的區域</span>
          <span className="px-2 py-0.5 rounded text-sm" style={{ backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ade80' }}>兩邊共用</span>
        </div>
        <div className="px-4 py-2 text-sm" style={{ color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
          <i className="fa-solid fa-ban mr-1.5" style={{ color: '#ef4444' }} />
          大樓裡有些區域是絕對禁區——配電室（<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>rm -rf /</code>）、保險箱（<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>~/.ssh</code>）、總開關（<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>sudo</code>）。不管你是駐點還是遠端，門禁卡都過不了。
        </div>
        <div className="px-4 py-3 flex flex-wrap gap-1.5">
          {[
            'Bash(rm -rf /*)', 'Bash(rm -rf /)', 'Bash(sudo *)', 'Bash(chmod 777 *)',
            'Bash(dd *)', 'Bash(eval *)', 'Bash(exec *)', 'Bash(source *)', 'Bash(.*)',
            'Bash(mv /etc/*)', 'Bash(mv ~/.ssh/*)', 'Bash(mv ~/.aws/*)', 'Bash(mv ~/.claude/*)',
          ].map(p => (
            <span key={p} className="px-2 py-0.5 rounded font-mono text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>{p}</span>
          ))}
        </div>
      </div>

      <ExpandableBox label="規則審視：哪些 deny 規則可能太嚴格？">
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
          <CalloutBox type="warn">
            以下規則可能過於嚴格，視你的使用情境可考慮調整：
          </CalloutBox>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Bash(source *)</strong>
            <div style={{ marginTop: '4px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>source</code> 常用於載入 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>.env</code> 或 shell 設定。若你需要 Claude 幫忙 source 環境變數，可改為精確匹配：
              <div style={{ marginTop: '4px' }}>
                建議：<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>Bash(source ~/.zshrc)</code>、<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>Bash(source .env)</code> 放到 deny（保留危險用法），但移除通配 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>*</code>
              </div>
            </div>
          </div>
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>Bash(.*)</strong>
            <div style={{ marginTop: '4px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              這條會擋所有正規表達式匹配的命令——看起來像是想擋 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>. script.sh</code>（source 的簡寫）。但寫法過於寬泛，建議改為精確的 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>Bash(. *)</code>（注意 dot 和空格之間的空格）
            </div>
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)' }}>Bash(sudo *)</strong>
            <div style={{ marginTop: '4px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              某些全域安裝（如 PM2、全域 npm 套件）需要 sudo。若常需要安裝全域工具，可考慮用 nvm / volta 等不需要 sudo 的版本管理工具來繞過。
              <div style={{ marginTop: '4px' }}>
                替代方案：使用 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>volta install pm2</code> 或 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>npx pm2</code> 代替 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>sudo npm install -g pm2</code>
              </div>
            </div>
          </div>
        </div>
      </ExpandableBox>

      {/* 其他設定 */}
      <div className="rounded-xl overflow-hidden mb-3" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-4 py-2 text-sm font-semibold" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          其他設定
        </div>
        {[
          { key: 'permissions.defaultMode', val: '"acceptEdits"', note: 'Extension 採用此值；SDK 在 buildQueryOptions 硬覆寫（plan 或 acceptEdits）' },
          { key: 'effortLevel',             val: '"medium"',      note: '兩邊都吃，SDK 可透過 opts.effort 覆寫' },
          { key: 'model',                   val: '"haiku"',       note: '預設模型；SDK 可透過 opts.model 覆寫，Dashboard Chat 預設走此值' },
        ].map((r, i, arr) => (
          <div key={r.key} className="grid grid-cols-[200px_80px_1fr] text-sm" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
            <div className="px-4 py-2.5 font-mono" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)' }}>{r.key}</div>
            <div className="px-4 py-2.5 font-mono" style={{ color: '#f97316', borderRight: '1px solid var(--border-color)' }}>{r.val}</div>
            <div className="px-4 py-2.5" style={{ color: 'var(--text-tertiary)' }}>{r.note}</div>
          </div>
        ))}
      </div>

      <ExpandableBox label="展開：permissionMode 兩邊各是什麼？">
        <div style={{ marginBottom: '4px', color: 'var(--text-tertiary)', fontSize: '13px', lineHeight: '1.6' }}>
          <i className="fa-solid fa-building mr-1.5" style={{ color: '#3b82f6' }} />
          把 permissionMode 想成辦公室的「門禁等級」。<strong style={{ color: '#3b82f6' }}>acceptEdits</strong> 像是給員工一張全通行門禁卡——他可以自由進出各個房間改動文件。<strong style={{ color: '#f97316' }}>plan</strong> 則像是訪客證——每次要進新房間，他得先填單子交給櫃台（報告計劃），等你蓋章（按「開始實作」）才能進去。
        </div>
        <div style={{ marginTop: '12px', marginBottom: '12px' }}>
          <strong style={{ color: '#3b82f6' }}>Extension（Cursor）</strong>
          <div style={{ marginTop: '6px', color: 'var(--text-secondary)' }}>
            直接讀取 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>permissions.defaultMode: "acceptEdits"</code>
            <div style={{ marginTop: '4px' }}>Claude 持有全通行卡，可直接寫入、修改檔案，不需要你確認每一步。</div>
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <strong style={{ color: '#f97316' }}>Dashboard SDK（lib/claude-session-manager.ts:78）</strong>
          <pre
            style={{
              backgroundColor: 'var(--background-tertiary)',
              color: 'var(--text-secondary)',
              padding: '12px',
              borderRadius: '6px',
              fontSize: '13px',
              fontFamily: 'ui-monospace, monospace',
              overflow: 'auto',
              marginTop: '6px',
              marginBottom: '8px',
            }}
          >
{`const permissionMode: PermissionMode = mode === 'edit' ? 'acceptEdits' : 'plan'`}
          </pre>
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            <div>• 當 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>mode = "edit"</code> →  <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>permissionMode = "acceptEdits"</code>（同 Extension）</div>
            <div style={{ marginTop: '4px' }}>• 當 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>mode = "plan"</code>（預設）→  <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>permissionMode = "plan"</code>（Claude 先規劃，等點核准才行動）</div>
          </div>
        </div>

        <div style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
          <i className="fa-solid fa-lightbulb" style={{ color: '#fbbf24', marginRight: '6px' }} />
          這就是 Dashboard Chat 有「ExitPlanMode」互動的原因——Claude 必須先報告計劃，等你按「開始實作」，才能進入 acceptEdits 模式。
        </div>
      </ExpandableBox>

      <ExpandableBox label="settings.json 在哪裡？怎麼編輯？">
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
          <strong>檔案位置：</strong>
          <pre style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-secondary)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontFamily: 'ui-monospace, monospace', marginTop: '6px', marginBottom: '8px' }}>
{`~/.claude/settings.json`}
          </pre>
          <div style={{ marginBottom: '8px' }}>
            <strong>編輯方式：</strong>
          </div>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
            • 直接用文字編輯器開啟（VS Code / Cursor 都可以）<br />
            • 或在終端機：<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>code ~/.claude/settings.json</code><br />
            • 存檔後立即生效，不需要重啟 Claude Code
          </div>
          <div style={{ marginTop: '8px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ color: '#fbbf24', marginRight: '6px' }} />
            如果檔案不存在，手動建立一份即可。Claude Code 首次執行時也會自動建立預設值。
          </div>
        </div>
      </ExpandableBox>

      <div className="rounded-xl px-5 py-4 mt-6" style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <h3 className="text-base font-semibold mb-2" style={{ color: '#3b82f6' }}>下一步行動</h3>
        <ul className="text-sm space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
          <li>• 若要修改 allow/deny 規則，編輯 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>~/.claude/settings.json</code> 的 permissions 區塊</li>
          <li>• 若要針對某個專案補充規則，編輯 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>.claude/CLAUDE.md</code>（見「CLAUDE.md」Tab）</li>
          <li>• 若要檢查當前 permissionMode，查看 Dashboard Chat 的 Header 右上角狀態指示器</li>
        </ul>
      </div>
    </div>
  )
}

function ClaudeMdTab() {
  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>CLAUDE.md 設定檔</h2>
        <span className="text-sm px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.2)' }}>
          人寫給 Claude 的指令
        </span>
      </div>
      <p className="text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>
        每次對話開始時自動載入為系統提示的一部分。全域 + 專案兩層疊加，專案層可覆蓋全域設定。
      </p>

      <CalloutBox type="info">
        <strong>疊加機制（大樓公告欄比喻）：</strong> 全域 CLAUDE.md 是貼在大樓大廳的公告——所有住戶都看得到（安全政策、公共設施規則）。專案 CLAUDE.md 是貼在你辦公室門口的備忘——只有進這間辦公室的人看得到（dev port、框架版本）。兩張公告同時生效，但如果內容衝突，辦公室門口的備忘（專案層）蓋過大廳公告（全域層），因為它貼得更近。
      </CalloutBox>

      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
        <strong>專案級設定的關鍵部分：</strong> Dev Server port 對照表（避免 AI 猜錯 port）、Pack 按鈕說明（避免 AI 與 Ship skill 搞混）。
      </p>
      <ClaudeMdViewer title="專案級設定" path=".claude/CLAUDE.md" content={projectClaudeMdContent} />

      <ExpandableBox label="PM2 是什麼？怎麼安裝？">
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
          <strong style={{ color: 'var(--text-primary)' }}>PM2</strong> 是 Node.js 的 process manager，用於在背景持續運行 production server（port 3001）。
          <div style={{ marginTop: '8px' }}>
            <strong>安裝方式（二選一）：</strong>
          </div>
          <pre style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-secondary)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontFamily: 'ui-monospace, monospace', marginTop: '6px', marginBottom: '8px' }}>
{`# 方法 1：全域安裝（需要 sudo 或用 volta/nvm）
npm install -g pm2

# 方法 2：用 npx（不需全域安裝）
npx pm2 start npm -- run prod:start`}
          </pre>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
            常用指令：<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>pm2 list</code>（查看進程）、<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>pm2 restart all</code>（重啟）、<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>pm2 logs</code>（看 log）
          </div>
        </div>
      </ExpandableBox>

      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
        <strong>全域設定的導覽：</strong> 包含 5 個大區塊，最容易被新手忽略的是 MCP 瀏覽器規則第 4 條（必須先新開分頁才能導航）。
      </p>

      <ExpandableBox label="全域 CLAUDE.md 的 5 個區塊一覽">
        <ol style={{ marginLeft: '20px', color: 'var(--text-secondary)', lineHeight: '1.75' }}>
          <li style={{ marginBottom: '8px' }}>
            <strong>MCP 瀏覽器規則</strong> — 控制 Arc 瀏覽器的 5 條規則。第 4 條最重要：必須先 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>browser_tabs(action: "new")</code> 建立新分頁，才能導航。
          </li>
          <li style={{ marginBottom: '8px' }}>
            <strong>Bash 安全政策</strong> — allow 清單（開放的命令）和 deny 清單（禁止的命令，如 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>sudo</code>、<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>eval</code>、<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>rm -rf /</code>）
          </li>
          <li style={{ marginBottom: '8px' }}>
            <strong>部署注意</strong> — 路徑大小寫問題（macOS 不敏感，但 Linux 敏感）。必須使用正確的大小寫和絕對路徑。
          </li>
          <li style={{ marginBottom: '8px' }}>
            <strong>Hydration 注意</strong> — 加 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>suppressHydrationWarning</code> 到 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>&lt;html&gt;</code>、<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>&lt;body&gt;</code>、<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>&lt;img&gt;</code>，避免暗色模式擴充套件注入樣式導致不一致。
          </li>
          <li>
            <strong>Dev Server Port 制度</strong> — Station 報戶口制度的 Tier 1–4 分級與進出方式。
          </li>
        </ol>
      </ExpandableBox>

      <ClaudeMdViewer title="全域設定" path="~/.claude/CLAUDE.md" content={globalClaudeMdContent} />

      <ExpandableBox label="如何建立 CLAUDE.md？新專案的第一步">
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
          <strong>專案層級（推薦先做）：</strong>
          <pre style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-secondary)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontFamily: 'ui-monospace, monospace', marginTop: '6px', marginBottom: '8px' }}>
{`mkdir -p .claude
touch .claude/CLAUDE.md`}
          </pre>
          <div style={{ marginBottom: '12px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
            內容建議：先寫 dev server port、使用的框架版本、圖示庫等基本資訊。Claude 第一次接手時就不用猜。
          </div>

          <strong>全域層級：</strong>
          <pre style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-secondary)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontFamily: 'ui-monospace, monospace', marginTop: '6px', marginBottom: '8px' }}>
{`mkdir -p ~/.claude
touch ~/.claude/CLAUDE.md`}
          </pre>
          <div style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
            內容建議：安全政策（deny 清單）、個人偏好（禁止 emoji、回應風格）、跨專案通用的 MCP 規則。
          </div>
        </div>
      </ExpandableBox>

      <div className="rounded-xl px-5 py-4 mt-6" style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <h3 className="text-base font-semibold mb-2" style={{ color: '#3b82f6' }}>下一步行動</h3>
        <ul className="text-sm space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
          <li>• 想新增專案級規則？編輯 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>.claude/CLAUDE.md</code>（可只覆寫你需要改的部分）</li>
          <li>• 想改全域設定（如圖示風格、部署注意）？編輯 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>~/.claude/CLAUDE.md</code></li>
          <li>• 發現規則不夠詳細？可同時用 Memory（MEMORY.md）補充跨 session 發現的細節（見「Memory」Tab）</li>
        </ul>
      </div>
    </div>
  )
}

function MemoryTab() {
  return (
    <div>
      {/* 對比表 */}
      <div className="flex items-center gap-3 mb-1">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Memory vs CLAUDE.md</h2>
      </div>
      <p className="text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>同樣都會載入系統提示，但身份完全不同。</p>

      <CalloutBox type="tip">
        <strong>大樓比喻：</strong> CLAUDE.md 是你（大樓管理員）貼在公告欄的「操作手冊」——禁止事項、設備使用規範、緊急聯絡方式。Memory 是員工（Claude）自己放在抽屜裡的「工作日誌」——上次修水管的心得、某樓層的燈容易故障。手冊是你下的命令，日誌是他自己的經驗。兩者互不衝突，同時生效。
      </CalloutBox>

      <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--border-color)' }}>
        <div className="grid grid-cols-[120px_1fr_1fr] text-sm" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }}>
          <div className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)' }} />
          <div className="px-4 py-2.5 font-semibold" style={{ color: '#a78bfa', borderRight: '1px solid var(--border-color)' }}>CLAUDE.md</div>
          <div className="px-4 py-2.5 font-semibold" style={{ color: '#38bdf8' }}>Memory（MEMORY.md）</div>
        </div>
        {memoryVsClaudeMd.map((row, i) => (
          <div key={row.aspect} className="grid grid-cols-[120px_1fr_1fr] text-sm" style={{ borderBottom: i < memoryVsClaudeMd.length - 1 ? '1px solid var(--border-color)' : undefined }}>
            <div className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>{row.aspect}</div>
            <div className="px-4 py-2.5" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)' }}>{row.claudeMd}</div>
            <div className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>{row.memory}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl px-5 py-3 text-sm mb-8" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-tertiary)', lineHeight: '1.7' }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Memory 路徑：</strong>{' '}
        ~/.claude/projects/-Users-ruanbaiye-Documents-Brickverse-Todo-Dashboard/memory/MEMORY.md
        <br />
        <strong style={{ color: 'var(--text-secondary)' }}>規則：</strong>{' '}
        MEMORY.md 前 200 行自動載入系統提示；超過 200 行的內容被截斷，細節另存 topic 檔案再從 MEMORY.md 連結。
      </div>

      {/* 使用情境 */}
      <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>使用情境</h2>
      <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>兩者都載入系統提示，但觸發條件和角色完全不同。</p>

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
              <span className="text-sm font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)' }}>{s.id}</span>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{s.title}</span>
            </div>
            <div className="grid grid-cols-2 text-sm" style={{ borderBottom: '1px solid var(--border-color)' }}>
              <div className="px-4 py-3" style={{ borderRight: '1px solid var(--border-color)' }}>
                <div className="font-semibold mb-1" style={{ color: '#a78bfa' }}>CLAUDE.md</div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{s.claudeMd}</div>
              </div>
              <div className="px-4 py-3">
                <div className="font-semibold mb-1" style={{ color: '#38bdf8' }}>Memory</div>
                <div style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{s.memory}</div>
              </div>
            </div>
            <div className="px-4 py-2.5 text-sm" style={{ color: 'var(--text-tertiary)' }}>
              <i className="fa-solid fa-lightbulb mr-1.5" style={{ color: '#fbbf24' }} />
              {s.insight}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl overflow-hidden mt-4" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-4 py-2.5 text-sm font-semibold" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          一句話總結
        </div>
        {[
          { aspect: '觸發條件', claudeMd: '你想要 Claude 知道',  memory: 'Claude 發現值得記' },
          { aspect: '時機',     claudeMd: '專案開始、規則改變時', memory: '解完問題後' },
          { aspect: '保證程度', claudeMd: '100%（你控制）',       memory: '85%（Claude 自律）' },
          { aspect: '適合',     claudeMd: '鐵律、慣例、設計決策', memory: 'bug 記錄、模式發現、偏好細節' },
        ].map((row, i, arr) => (
          <div key={row.aspect} className="grid grid-cols-[100px_1fr_1fr] text-sm" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
            <div className="px-4 py-2.5 font-medium" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>{row.aspect}</div>
            <div className="px-4 py-2.5" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)' }}>{row.claudeMd}</div>
            <div className="px-4 py-2.5" style={{ color: 'var(--text-primary)' }}>{row.memory}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl px-5 py-4 mt-6" style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <h3 className="text-base font-semibold mb-2" style={{ color: '#3b82f6' }}>下一步行動</h3>
        <ul className="text-sm space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
          <li>• 檢查你的 MEMORY.md：<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>~/.claude/projects/.../memory/MEMORY.md</code></li>
          <li>• 重複遇到同一個問題時，檢查是否應該記進 MEMORY.md（或寫進 CLAUDE.md 如果是全局規則）</li>
          <li>• 定期複審 MEMORY.md 前 200 行，確保重要內容不被舊筆記埋沒；可用 topic 檔案（如 debugging.md、patterns.md）拆分長內容</li>
        </ul>
      </div>
    </div>
  )
}

function McpTab() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>~/.claude/mcp.json</h2>
      <p className="text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>
        Claude Code Extension 讀取的 MCP server 清單。SDK 環境的 settingSources 讀取此檔不可靠，需在 opts.mcpServers 明確傳入。
      </p>

      <CalloutBox type="info">
        <strong>MCP 就是大樓的設備間。</strong> 每台設備（MCP server）是一個獨立的控制器——<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>arc-cdp</code> 是瀏覽器遙控器、<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>zeabur</code> 是部署發射台、<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>insforge</code> 是資料庫查詢機。Extension 員工入職時，設備間已經配好了所有設備；SDK 遠端員工則需要你親手把設備搬進他的工作站（<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>opts.mcpServers</code>），否則他什麼都操作不了。
      </CalloutBox>

      <ExpandableBox label="為什麼 settingSources 不可靠？">
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
          <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>settingSources: ['user', 'project']</code> 告訴 SDK「去大廳公告欄和辦公室門口看看有哪些設備清單」。
          <div style={{ marginTop: '8px' }}>
            問題是：遠端員工（SDK）有時候走到公告欄時，公告還沒貼好（時序問題），或者公告格式改了他看不懂（版本差異）。最可靠的做法是直接把設備清單塞進他的公事包（<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>opts.mcpServers</code>），到哪裡都能用。
          </div>
        </div>
      </ExpandableBox>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
        {[
          { name: 'arc-cdp',                command: 'npx @playwright/mcp --cdp-endpoint http://localhost:9222', note: '透過 CDP 9222 控制 Arc 瀏覽器', status: 'SDK 已手動加入', color: '#4ade80' },
          { name: 'zeabur',                 command: 'npx @zeabur/mcp-server',                                  note: 'Zeabur 部署管理',              status: '僅 Extension',   color: '#fbbf24' },
          { name: 'OfficeWebsite_insforge', command: 'npx -y @insforge/mcp@latest',                             note: 'Insforge 資料庫 MCP',          status: '僅 Extension',   color: '#fbbf24' },
        ].map((server, i, arr) => (
          <div key={server.name} className="grid grid-cols-[160px_1fr_auto] text-sm" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
            <div className="px-4 py-3 font-mono font-semibold" style={{ color: '#a78bfa', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>
              {server.name}
            </div>
            <div className="px-4 py-3" style={{ borderRight: '1px solid var(--border-color)' }}>
              <div className="font-mono mb-0.5" style={{ color: 'var(--text-primary)' }}>{server.command}</div>
              <div style={{ color: 'var(--text-tertiary)' }}>{server.note}</div>
            </div>
            <div className="px-4 py-3 flex items-center">
              <span className="text-sm px-2 py-0.5 rounded whitespace-nowrap" style={{ backgroundColor: server.color === '#4ade80' ? 'rgba(74,222,128,0.1)' : 'rgba(251,191,36,0.1)', color: server.color, border: `1px solid ${server.color}33` }}>
                {server.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      <ExpandableBox label="安裝與前置準備：各 MCP server 需要什麼？">
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
          <div style={{ marginBottom: '16px' }}>
            <strong style={{ color: '#a78bfa' }}>arc-cdp（playwright-mcp）</strong>
            <div style={{ marginTop: '6px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              <div style={{ marginBottom: '4px' }}>1. 安裝套件（npx 會自動下載，不需預裝）</div>
              <div style={{ marginBottom: '4px' }}>2. Arc 瀏覽器必須以 CDP 模式啟動：</div>
              <pre style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-secondary)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontFamily: 'ui-monospace, monospace', marginTop: '4px', marginBottom: '8px' }}>
{`pkill -a Arc; open -a Arc --args --remote-debugging-port=9222`}
              </pre>
              <div style={{ color: '#fbbf24' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }} />
                從 Dock/Spotlight 開啟 Arc 不會帶 CDP flag。Arc UI 設定裡的 Remote Debugging 開關也無效。必須用上方指令重啟。
              </div>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <strong style={{ color: '#a78bfa' }}>zeabur</strong>
            <div style={{ marginTop: '6px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              <div style={{ marginBottom: '4px' }}>透過 npx 執行，不需預裝：</div>
              <pre style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-secondary)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontFamily: 'ui-monospace, monospace', marginTop: '4px', marginBottom: '4px' }}>
{`npx @zeabur/mcp-server`}
              </pre>
              <div>需要 Zeabur 帳號和 API Token（首次執行時會引導設定）</div>
            </div>
          </div>

          <div>
            <strong style={{ color: '#a78bfa' }}>insforge</strong>
            <div style={{ marginTop: '6px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              <div style={{ marginBottom: '4px' }}>透過 npx 執行，不需預裝：</div>
              <pre style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-secondary)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontFamily: 'ui-monospace, monospace', marginTop: '4px', marginBottom: '4px' }}>
{`npx -y @insforge/mcp@latest`}
              </pre>
              <div>需要 Insforge API Key（設定在 MCP config 的 env 中）</div>
            </div>
          </div>
        </div>
      </ExpandableBox>

      <ExpandableBox label="opts.mcpServers 在哪裡設定？">
        <div style={{ color: 'var(--text-secondary)', marginBottom: '12px' }}>
          在 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>lib/claude-session-manager.ts</code> 的 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>buildQueryOptions()</code> 函式中：
        </div>

        <pre
          style={{
            backgroundColor: 'var(--background-tertiary)',
            color: 'var(--text-secondary)',
            padding: '12px',
            borderRadius: '6px',
            fontSize: '13px',
            fontFamily: 'ui-monospace, monospace',
            overflow: 'auto',
            marginBottom: '12px',
          }}
        >
{`mcpServers: {
  'arc-cdp': {
    type: 'stdio',
    command: 'npx',
    args: ['@playwright/mcp', '--cdp-endpoint', 'http://localhost:9222'],
  },
  // 新增 MCP 在此加入
}`}
        </pre>

        <div style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
          <div>• 這段設定在每個 session 建立時被傳入</div>
          <div>• 確保 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>arc-cdp</code> 可用</div>
          <div>• 新增 MCP 需手動在此加入；Extension 不需要這個步驟</div>
        </div>
      </ExpandableBox>

      <div className="rounded-xl px-5 py-4 mt-6" style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <h3 className="text-base font-semibold mb-2" style={{ color: '#3b82f6' }}>下一步行動</h3>
        <ul className="text-sm space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
          <li>• 需要新增 MCP？編輯 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>lib/claude-session-manager.ts</code> 的 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>mcpServers</code> 物件</li>
          <li>• 想測試 arc-cdp 是否正常？在 Dashboard Chat 輸入 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>/cdp-test</code> skill</li>
          <li>• 遇到 MCP 連線問題？檢查「CLAUDE.md」Tab 的全域設定，特別是 MCP 瀏覽器規則部分</li>
        </ul>
      </div>
    </div>
  )
}

function ArcCdpTab() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Arc CDP — 瀏覽器遠端偵錯協議</h2>
      <p className="text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>Chrome DevTools Protocol (CDP) 是 Arc 瀏覽器的遠端控制介面，允許 Claude 自動化操控瀏覽器。</p>

      <CalloutBox type="info">
        <strong>CDP 的作用：</strong> 讓 Claude Code 可以透過 Playwright MCP 自動化控制 Arc 瀏覽器（點擊、填表、截圖、讀取網頁內容）。這是 browser_click、browser_navigate、browser_snapshot 等工具的基礎。
      </CalloutBox>

      <h3 className="text-base font-semibold mt-6 mb-3" style={{ color: 'var(--text-primary)' }}>啟動 Arc CDP</h3>
      <div className="rounded-xl px-5 py-4 mb-4" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
        <p className="text-sm mb-2">在終端執行以下指令：</p>
        <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '8px 12px', borderRadius: '4px', display: 'block', color: 'var(--text-primary)', fontSize: '12px', lineHeight: '1.6' }}>
          pkill -a Arc; open -a Arc --args --remote-debugging-port=9222
        </code>
      </div>

      <CalloutBox type="warn">
        <strong>重要：</strong> Arc UI 設定裡的「Remote Debugging」開關無效，必須使用上面的啟動指令才能真正啟用 CDP。從 Dock 或 Spotlight 點擊開啟 Arc 時，CDP 不會自動啟動。
      </CalloutBox>

      <h3 className="text-base font-semibold mt-6 mb-3" style={{ color: 'var(--text-primary)' }}>CDP 工作原理</h3>
      <div className="space-y-3">
        <div className="rounded-xl px-4 py-3 mb-2" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
          <strong className="text-sm" style={{ color: 'var(--text-primary)' }}>通訊層</strong>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            Arc 瀏覽器監聽 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>localhost:9222</code>，Claude Code 透過 WebSocket 發送 CDP 命令。
          </p>
        </div>

        <div className="rounded-xl px-4 py-3 mb-2" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
          <strong className="text-sm" style={{ color: 'var(--text-primary)' }}>MCP 橋接</strong>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            Playwright MCP（arc-cdp）是中介層，將 Claude 的高階指令（「點擊登入按鈕」）轉換為低階 CDP 命令。
          </p>
        </div>

        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
          <strong className="text-sm" style={{ color: 'var(--text-primary)' }}>頁面快照</strong>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>
            Claude 透過 CDP 取得頁面 accessibility tree，可以理解頁面結構、找到對應元素、執行操作。
          </p>
        </div>
      </div>

      <h3 className="text-base font-semibold mt-6 mb-3" style={{ color: 'var(--text-primary)' }}>CDPStatusBadge 元件與連線狀態</h3>
      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>首頁左側邊欄的「開啟 CDP」/「關閉 CDP」按鈕負責控制 CDP 連線狀態。按鈕的文案反映了當前的連線狀態。</p>

      <div className="rounded-xl px-5 py-4 mb-4" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          <div><strong>位置：</strong> <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>components/DashboardContent.tsx</code> 中的 CdpStatusBadge 元件</div>
          <div style={{ marginTop: '8px' }}><strong>核心功能：</strong></div>
          <div style={{ marginTop: '4px', marginLeft: '12px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
            • 每 10 秒檢查一次 CDP 連線狀態（呼叫 /api/cdp-status）<br />
            • 點擊按鈕時呼叫 /api/cdp-restart 重啟 Arc（帶或不帶 CDP）<br />
            • 按鈕文案隨連線狀態動態更新
          </div>
        </div>
      </div>

      <h4 className="text-sm font-semibold mt-4 mb-2" style={{ color: 'var(--text-primary)' }}>三種連線狀態</h4>
      <div className="space-y-2 mb-4">
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
          <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
            <strong>1. CDP 已連線</strong>
          </div>
          <div className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
            <div><strong>條件：</strong> Port 9222 監聽中 + CDP 端點回應正常</div>
            <div style={{ marginTop: '4px' }}><strong>按鈕外觀：</strong> 透明背景、灰色文字、邊框</div>
            <div style={{ marginTop: '4px' }}><strong>按鈕文案：</strong> 「關閉 CDP」</div>
            <div style={{ marginTop: '4px' }}><strong>含義：</strong> Arc 瀏覽器正在監聽 port 9222，Claude Code 可以透過 Playwright MCP 控制瀏覽器</div>
            <div style={{ marginTop: '4px' }}><strong>技術檢查項：</strong></div>
            <div style={{ marginTop: '2px', marginLeft: '12px' }}>
              • Port 9222 正在被 Arc 進程監聽（可用 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>lsof -i :9222</code> 檢查）<br />
              • /api/cdp-status 返回 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>{"{portOpen: true, cdpResponding: true}"}</code>
            </div>
          </div>
        </div>

        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
          <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
            <strong>2. CDP 未連線</strong>
          </div>
          <div className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
            <div><strong>條件：</strong> Port 9222 未監聽 或 CDP 端點無回應</div>
            <div style={{ marginTop: '4px' }}><strong>按鈕外觀：</strong> 藍色背景（accent color）、白色文字</div>
            <div style={{ marginTop: '4px' }}><strong>按鈕文案：</strong> 「開啟 CDP」</div>
            <div style={{ marginTop: '4px' }}><strong>含義：</strong> Arc 瀏覽器未正確啟動 CDP，或進程已終止</div>
            <div style={{ marginTop: '4px' }}><strong>可能原因：</strong></div>
            <div style={{ marginTop: '2px', marginLeft: '12px' }}>
              • Arc 進程未執行<br />
              • Arc 啟動時未帶 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>--remote-debugging-port=9222</code> 參數<br />
              • Arc 崩潰或被手動終止
            </div>
          </div>
        </div>

        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
          <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
            <strong>3. 重新啟動中</strong>
          </div>
          <div className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
            <div><strong>觸發條件：</strong> 點擊按鈕後，等待 Arc 重啟完成</div>
            <div style={{ marginTop: '4px' }}><strong>按鈕外觀：</strong> 灰色背景、灰色文字、透明度降低</div>
            <div style={{ marginTop: '4px' }}><strong>按鈕文案：</strong> 「重新啟動中...」</div>
            <div style={{ marginTop: '4px' }}><strong>含義：</strong> 已發送 /api/cdp-restart 指令，等待 Arc 進程重啟（通常 3-4 秒）</div>
            <div style={{ marginTop: '4px' }}><strong>狀態流轉：</strong></div>
            <div style={{ marginTop: '2px', marginLeft: '12px' }}>
              • 點擊按鈕 → cdpActive 變為 true，呼叫 /api/cdp-restart<br />
              • restarting flag 設為 true，按鈕禁用<br />
              • 等待 4000ms（給 Arc 重啟時間）<br />
              • 重新檢查 /api/cdp-status 獲取新狀態<br />
              • 按鈕重新啟用，顯示新的連線狀態
            </div>
          </div>
        </div>
      </div>

      <h3 className="text-base font-semibold mt-6 mb-3" style={{ color: 'var(--text-primary)' }}>故障排除</h3>
      <div className="space-y-3">
        <ExpandableBox label="症狀：CDP 不可用（按鈕一直是「開啟 CDP」）">
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
            <strong>診斷步驟：</strong>
            <div style={{ marginTop: '8px', marginLeft: '12px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              1. 檢查 Arc 是否在執行 — 用 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>ps aux | grep Arc</code><br />
              2. 檢查 port 9222 是否監聽 — 用 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>lsof -i :9222</code><br />
              3. 執行啟動指令重啟 Arc — <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>pkill -a Arc; open -a Arc --args --remote-debugging-port=9222</code><br />
              4. 等待 10 秒讓儀表板重新檢測狀態
            </div>
          </div>
        </ExpandableBox>

        <ExpandableBox label="症狀：CDP 連線成功但 browser_* 工具仍失敗">
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
            <strong>可能原因：</strong>
            <div style={{ marginTop: '8px', marginLeft: '12px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              • Arc 沒有任何開啟的分頁 — Playwright 無法連接到頁面<br />
              • 分頁無法訪問該 URL — 網路問題或權限限制<br />
              • browser_navigate 在無新分頁的情況下執行 — 覆寫了其他人的分頁（多 session 共用）
            </div>
            <div style={{ marginTop: '8px' }}><strong>解決方案：</strong></div>
            <div style={{ marginTop: '4px', marginLeft: '12px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              1. 在 Arc 中手動開啟一個分頁<br />
              2. 在 browser_* 操作前先執行 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>browser_tabs(action: 'new')</code> 建立新分頁<br />
              3. 之後再執行 browser_navigate 和其他操作
            </div>
          </div>
        </ExpandableBox>
      </div>

      <h3 className="text-base font-semibold mt-6 mb-3" style={{ color: 'var(--text-primary)' }}>相關 API</h3>
      <div className="space-y-2">
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
          <div className="text-sm" style={{ color: 'var(--text-primary)' }}>/api/cdp-status</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>檢查 CDP 連線狀態，返回 portOpen、cdpResponding、browser 資訊</div>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
          <div className="text-sm" style={{ color: 'var(--text-primary)' }}>/api/cdp-restart</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>重啟 Arc 瀏覽器，可選擇是否啟用 CDP（POST body: {"{cdp: boolean}"}</div>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
          <div className="text-sm" style={{ color: 'var(--text-primary)' }}>/api/cdp-sdk-test</div>
          <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>測試 Playwright MCP 是否正常運作（已棄用，技術債）</div>
        </div>
      </div>
    </div>
  )
}

function GapsTab() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>文件缺口 — 建議補充</h2>
      <p className="text-sm mb-3" style={{ color: 'var(--text-tertiary)' }}>以下項目尚未列入技術文件，但對理解整個系統有幫助。點擊展開了解詳情。</p>

      <CalloutBox type="tip">
        <strong>大樓導覽圖的空白處。</strong> 這棟大樓的導覽圖（技術文件）還有幾個房間沒標上去。有些是儲藏室（keybindings.json），不急但終究要標；有些是電力總控室（buildQueryOptions），不標的話新來的水電工（開發者）會迷路。優先度用顏色標記：紅色 = 必須標、黃色 = 建議標、灰色 = 有空再說。
      </CalloutBox>
      <div className="space-y-3">
        <div>
          <div className="rounded-xl px-4 py-3 flex items-start gap-3 mb-2" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
            <span className="text-sm px-1.5 py-0.5 rounded mt-0.5 shrink-0" style={{ backgroundColor: 'rgba(100,116,139,0.1)', color: '#64748b', border: '1px solid rgba(100,116,139,0.2)' }}>低</span>
            <code className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>~/.claude/keybindings.json</code>
          </div>
          <ExpandableBox label="為什麼需要 keybindings.json？">
            <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
              <strong>用途：</strong> 自訂鍵盤快捷鍵，將常用 Skill 綁定到快速鍵。
              <div style={{ marginTop: '8px' }}>
                <strong>例子：</strong>
              </div>
              <div style={{ marginTop: '4px', marginLeft: '12px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                • 綁定 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>Ctrl+Shift+C</code> 到 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>/commit</code> skill（快速提交）<br />
                • 綁定 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>Ctrl+Shift+S</code> 到 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>/ship</code> skill（快速部署）
              </div>
              <div style={{ marginTop: '8px' }}>
                <strong>管理方式：</strong> 用 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>/keybindings-help</code> skill 查詢和修改
              </div>
            </div>
          </ExpandableBox>
        </div>

        <div>
          <div className="rounded-xl px-4 py-3 flex items-start gap-3 mb-2" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
            <span className="text-sm px-1.5 py-0.5 rounded mt-0.5 shrink-0" style={{ backgroundColor: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>中</span>
            <code className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>~/.claude/skills/ 目錄</code>
          </div>
          <ExpandableBox label="為什麼需要 skills 清單？">
            <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
              <strong>用途：</strong> 列舉所有可用的全域 Skill（助手們可跨專案使用的命令）。
              <div style={{ marginTop: '8px' }}>
                <strong>現有 Skill 例子：</strong>
              </div>
              <div style={{ marginTop: '4px', marginLeft: '12px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                • <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>/port-sync</code> — Station 保姆，同步所有 port 登記狀態<br />
                • <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>/blog-pipeline-review</code> — 複查 Blog 編輯流水線<br />
                • <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>/ship</code> — 全域部署工具（對標專案層的 Pack）
              </div>
              <div style={{ marginTop: '8px' }}>
                <strong>為什麼重要：</strong> 新手不知道「有哪些 Skill 可用」，導致重複造輪子或不知道怎麼用
              </div>
            </div>
          </ExpandableBox>
        </div>

        <div>
          <div className="rounded-xl px-4 py-3 flex items-start gap-3 mb-2" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
            <span className="text-sm px-1.5 py-0.5 rounded mt-0.5 shrink-0" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>高</span>
            <code className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>lib/claude-session-manager.ts — buildQueryOptions</code>
          </div>
          <ExpandableBox label="為什麼 buildQueryOptions 最重要？">
            <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
              <strong>這是什麼：</strong> Dashboard SDK 的核心配置函式，決定了每個 Claude session 的行為。
              <div style={{ marginTop: '8px' }}>
                <strong>控制項包括：</strong>
              </div>
              <div style={{ marginTop: '4px', marginLeft: '12px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                • <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>permissionMode</code> — 工作模式（plan vs acceptEdits）<br />
                • <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>mcpServers</code> — 掛載哪些 MCP（Arc、Zeabur 等）<br />
                • <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>systemPrompt</code> — 全局系統提示<br />
                • <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>effort</code> — 努力程度（low/medium/high）
              </div>
              <div style={{ marginTop: '8px' }}>
                <strong>為什麼重要：</strong> 想理解「Extension 和 SDK 為什麼不同」，這個函式就是答案。本文件中提到的 permissionMode、opts.mcpServers 等概念都源自於此。
              </div>
            </div>
          </ExpandableBox>
        </div>

        <div>
          <div className="rounded-xl px-4 py-3 flex items-start gap-3 mb-2" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
            <span className="text-sm px-1.5 py-0.5 rounded mt-0.5 shrink-0" style={{ backgroundColor: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>中</span>
            <code className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>Auto Memory — ~/.claude/projects/.../memory/</code>
          </div>
          <ExpandableBox label="為什麼需要 Memory 系統文檔？">
            <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
              <strong>概念：</strong> Claude 跨 session 自動維護的筆記，不同於 CLAUDE.md 的人工指令。
              <div style={{ marginTop: '8px' }}>
                <strong>記錄內容包括：</strong>
              </div>
              <div style={{ marginTop: '4px', marginLeft: '12px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                • <strong>已修復的 bug</strong> — 這個 bug 怎麼修的，下次遇到別再查<br />
                • <strong>發現的模式</strong> — BlogFrontend 的 basePath 需要用 /blog 路徑<br />
                • <strong>用戶偏好</strong> — 「每次自動用 port 3002」「禁止 Unicode emoji」等
              </div>
              <div style={{ marginTop: '8px' }}>
                <strong>儲存位置：</strong> 每個專案有獨立的 MEMORY.md（位於 ~/.claude/projects/...../memory/）
              </div>
              <div style={{ marginTop: '8px' }}>
                <strong>自動載入：</strong> MEMORY.md 的前 200 行會自動在每個 session 載入系統提示
              </div>
              <div style={{ marginTop: '8px' }}>
                <strong>為什麼重要：</strong> 了解「Memory vs CLAUDE.md 的區別」對於建立高效知識庫至關重要（詳見本文件的 Memory Tab）
              </div>
            </div>
          </ExpandableBox>
        </div>
      </div>

      <div className="rounded-xl px-5 py-4 mt-6" style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <h3 className="text-base font-semibold mb-2" style={{ color: '#3b82f6' }}>下一步行動</h3>
        <ul className="text-sm space-y-1.5" style={{ color: 'var(--text-secondary)' }}>
          <li>• 想建立全域 Skill 清單？貢獻到 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>~/.claude/skills/</code> 目錄</li>
          <li>• 遇到 permission 問題？通常答案在 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>lib/claude-session-manager.ts</code> — 看最優先度高的項目</li>
          <li>• 想減少 MEMORY.md 超過 200 行的問題？用 topic 檔案（如 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>debugging.md</code>、<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>patterns.md</code>）拆分長內容</li>
        </ul>
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────

const DOCS_SYSTEM_PROMPT = `你是 Todo-Dashboard 技術文件的書僮助手。使用者正在閱讀 /docs 技術文件頁面，可能會問你關於：
- Claude Code Extension vs Dashboard SDK 的差異
- settings.json / CLAUDE.md / Memory 的設定方式
- MCP 工具配置（arc-cdp、zeabur、insforge）
- Chat 系統架構和功能
- Station 報戶口制度（Dev Server Port 管理）
- 技術架構（Next.js、React、TypeScript、Tailwind CSS）

請用簡潔的中文回答，必要時引用具體檔案路徑和程式碼片段。禁止使用 Unicode emoji。`

export default function DocsPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('tech-stack')

  return (
    <div style={{ backgroundColor: 'var(--background-primary)', color: 'var(--text-primary)', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky header — top: 8px to clear EnvironmentIndicator (h-2) */}
      <div
        className="sticky z-40 flex items-center gap-4"
        style={{
          top: 8,
          backgroundColor: 'var(--background-secondary)',
          borderBottom: '1px solid var(--border-color)',
          padding: '10px 24px',
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => router.push('/')}
          className="shrink-0 px-2.5 py-1.5 rounded-lg text-sm transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] flex items-center gap-2"
          style={{
            backgroundColor: 'var(--background-tertiary)',
            color: 'var(--text-tertiary)',
            border: '1px solid var(--border-color)',
          }}
        >
          <i className="fa-solid fa-arrow-left text-sm" />
          <span>儀表板</span>
        </button>

        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="shrink-0 flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg cursor-pointer transition-colors duration-150"
                style={{
                  backgroundColor: isActive ? 'var(--background-primary)' : 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  border: isActive ? '1px solid var(--border-color)' : '1px solid transparent',
                }}
              >
                <i className={`fa-solid ${tab.icon} text-sm`} style={{ color: isActive ? '#0184ff' : undefined }} />
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Body: left content + right chat panel */}
      <div className="flex flex-1 min-h-0">
        {/* Left: scrollable documentation content */}
        <main className="flex-1 overflow-y-auto" style={{ padding: '32px 32px 80px' }}>
          <div style={{ maxWidth: '56rem' }}>
            {activeTab === 'tech-stack'  && <TechStackTab />}
            {activeTab === 'env-compare' && <EnvCompareTab />}
            {activeTab === 'settings'    && <SettingsTab />}
            {activeTab === 'claude-md'   && <ClaudeMdTab />}
            {activeTab === 'memory'      && <MemoryTab />}
            {activeTab === 'mcp'         && <McpTab />}
            {activeTab === 'arc-cdp'     && <ArcCdpTab />}
            {activeTab === 'gaps'        && <GapsTab />}
          </div>
        </main>

        {/* Right: sticky Chat panel */}
        <aside
          className="shrink-0 flex flex-col"
          style={{
            width: 380,
            borderLeft: '1px solid var(--border-color)',
            height: '100%',
          }}
        >
          <ClaudeChatPanel
            projectId="dashboard"
            projectName="Docs 書僮"
            isFixed
            systemPrompt={DOCS_SYSTEM_PROMPT}
          />
        </aside>
      </div>
    </div>
  )
}
