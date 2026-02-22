'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { ModelBadge } from '@/components/SkillArchitecture'
import SkillArchitecture from '@/components/SkillArchitecture'
import BlogChatPanel from '@/components/BlogChatPanel'
import {
  CHAT_FEATURES,
  generatePortingChecklist,
  type ChatFeature,
  type FeatureTier,
} from '@/lib/chat-center-features'
import versionConfig from '@/version.json'

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

注意：Ship skill 是全域發布工具，與 Pack 功能分開。

---

## Dev Server Port 管理（Station 報戶口制度）

VIP 座位：3001（Prod）、3002（Dev）— 固定保留
Station 座位：3003–3010（8 個，先到先得）

| Tier | 狀態 | 條件 |
|------|------|------|
| 居民 | 城市居民 | 在 JSON 裡，無 devPort |
| Station | 已進駐 | 有 devPort（3003–3010） |
| 在崗 | 運行中 | dev server 正在跑 |

Source of Truth：JSON 的 devPort 欄位（projects.json / coursefiles.json / utility-tools.json）
進駐：/api/projects PATCH \`add-to-dev\` — 分配座位 + 寫 devPort + 更新 package.json -p
離開：/api/projects PATCH \`remove-from-dev\` — 移除 devPort + 移除 -p flag，座位釋出
查看：/ports 頁面`

const globalClaudeMdContent = `# 全局用戶偏好設定

- **上網查詢**: 需要上網搜尋資料時直接執行，不需要詢問確認
- **MCP 瀏覽器工具（Bot Browser）**：不需要詢問確認，直接執行。連線失敗時自動重試即可。

---

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

interface TabGroup {
  group: string
  icon: string
  letter: string
  tabs: { id: string; label: string }[]
}

const TAB_GROUPS: TabGroup[] = [
  {
    group: '系統藍圖',
    icon: 'fa-city',
    letter: 'A',
    tabs: [
      { id: 'tech-stack',   label: '技術架構' },
      { id: 'cli-vs-sdk',   label: 'CLI 與 SDK' },
      { id: 'env-compare',  label: 'Extension vs SDK' },
    ],
  },
  {
    group: '規章制度',
    icon: 'fa-building-shield',
    letter: 'B',
    tabs: [
      { id: 'permissions',  label: '權限模型' },
      { id: 'settings',     label: 'settings.json' },
      { id: 'claude-md',    label: 'CLAUDE.md' },
      { id: 'memory',       label: 'Memory' },
    ],
  },
  {
    group: '工具箱',
    icon: 'fa-toolbox',
    letter: 'C',
    tabs: [
      { id: 'model-choice', label: '模型選擇（H/S/O）' },
      { id: 'mcp',          label: 'MCP 設定' },
      { id: 'arc-cdp',      label: 'Browser MCP' },
    ],
  },
  {
    group: '產品線',
    icon: 'fa-industry',
    letter: 'D',
    tabs: [
      { id: 'chat',         label: 'Agent SDK Chat' },
      { id: 'chat-doc',     label: 'Chat 技術文件' },
      { id: 'blog',         label: 'Blog 編輯流水線' },
      { id: 'skills',       label: 'Skills 總覽' },
      { id: 'sdk',          label: 'Agent SDK' },
    ],
  },
  {
    group: '檔案室',
    icon: 'fa-book-open',
    letter: 'E',
    tabs: [
      { id: 'gaps',         label: '文件缺口' },
      { id: 'changelog',    label: '版本歷史' },
    ],
  },
]

const TABS = TAB_GROUPS.flatMap(g => g.tabs)
const TAB_ID_TO_CODE = (() => {
  const map: Record<string, string> = {}
  TAB_GROUPS.forEach(g => {
    g.tabs.forEach((t, i) => { map[t.id] = `${g.letter}${i + 1}` })
  })
  return map
})()

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
      <div
        className="px-5 py-4 text-sm prose prose-invert max-w-none
          [&_h1]:text-base [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
          [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-4 [&_h2]:mb-1.5 [&_h2]:text-[var(--text-primary)]
          [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1
          [&_p]:my-1.5 [&_p]:leading-[1.7]
          [&_ul]:my-1.5 [&_ul]:pl-4 [&_li]:my-0.5
          [&_ol]:my-1.5 [&_ol]:pl-4
          [&_strong]:font-semibold [&_strong]:text-[var(--text-primary)]
          [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:bg-[var(--background-tertiary)] [&_code]:text-[var(--text-secondary)]
          [&_pre]:bg-[var(--background-tertiary)] [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:my-2 [&_pre]:overflow-x-auto
          [&_pre_code]:bg-transparent [&_pre_code]:p-0
          [&_table]:w-full [&_table]:text-xs [&_table]:border-collapse [&_table]:my-2
          [&_th]:px-3 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:border [&_th]:border-[var(--border-color)] [&_th]:bg-[var(--background-secondary)]
          [&_td]:px-3 [&_td]:py-1.5 [&_td]:border [&_td]:border-[var(--border-color)]
          [&_hr]:border-[var(--border-color)] [&_hr]:my-3"
        style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--background-primary)' }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
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

      <div className="rounded-xl px-5 py-4 mb-5" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 11 }}>大樓比喻</p>
        <div className="text-sm grid gap-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <div className="flex gap-3">
            <i className="fa-solid fa-display mt-0.5 shrink-0 text-xs" style={{ color: '#3b82f6', width: 14 }} />
            <span><strong style={{ color: 'var(--text-primary)' }}>前端（Next.js + React）</strong> — 大廳和各樓層的裝潢，訪客看到的一切</span>
          </div>
          <div className="flex gap-3">
            <i className="fa-solid fa-robot mt-0.5 shrink-0 text-xs" style={{ color: '#a78bfa', width: 14 }} />
            <span><strong style={{ color: 'var(--text-primary)' }}>AI 整合（Claude SDK）</strong> — 駐樓顧問公司，從後門（Node.js process）進出，用對講機（MCP）操控設備</span>
          </div>
          <div className="flex gap-3">
            <i className="fa-solid fa-database mt-0.5 shrink-0 text-xs" style={{ color: '#f97316', width: 14 }} />
            <span><strong style={{ color: 'var(--text-primary)' }}>後端（API Routes + JSON）</strong> — 地下室的檔案室和機房</span>
          </div>
          <div className="flex gap-3">
            <i className="fa-solid fa-door-open mt-0.5 shrink-0 text-xs" style={{ color: '#4ade80', width: 14 }} />
            <span><strong style={{ color: 'var(--text-primary)' }}>部署系統</strong> — 兩個出入口：員工通道（port 3002 dev）、正門（port 3001 prod）</span>
          </div>
        </div>
      </div>

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
      <div className="rounded-xl px-5 py-4 mb-5" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 11 }}>大樓動線圖</p>
        <div className="flex flex-wrap items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          {[
            { label: '使用者', sub: '訪客' },
            { label: '瀏覽器', sub: '正門大廳' },
            { label: 'Next.js 前端', sub: '辦公樓層' },
            { label: 'API Routes', sub: '求助鈴' },
            { label: 'Claude SDK', sub: '後門顧問公司' },
            { label: 'MCP 設備', sub: 'Arc / Zeabur / Insforge' },
          ].map((item, i, arr) => (
            <span key={i} className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg text-xs font-medium" style={{ backgroundColor: 'var(--background-primary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                {item.label}
                <span className="ml-1" style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>（{item.sub}）</span>
              </span>
              {i < arr.length - 1 && <i className="fa-solid fa-arrow-right text-xs" style={{ color: 'var(--text-tertiary)' }} />}
            </span>
          ))}
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
          所有顧問工作證（permissions、MCP、system prompt）統一在人事部 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>lib/claude-session-manager.ts</code> 核發
        </p>
      </div>

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

          {/* 座位制度 */}
          <div style={{ marginTop: '20px' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Station 座位制度</p>
            <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              Station 有 <strong>8 個座位</strong>（Port 3003–3010）。每個進駐的專案占據一個座位。分配規則最簡單：<strong>優先給最小編號的空位</strong>。離開時座位釋出給下一個人。
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <div className="flex items-center gap-2"><i className="fa-solid fa-circle" style={{ color: '#22c55e', fontSize: 8 }} />空位 = 可以進駐</div>
              <div className="flex items-center gap-2"><i className="fa-solid fa-circle" style={{ color: '#3b82f6', fontSize: 8 }} />被占用 = 已進駐</div>
            </div>
          </div>

          {/* 雙重登記 */}
          <div style={{ marginTop: '20px' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>雙重登記（進駐必須同時做）</p>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {[
                { num: 1, title: 'JSON devPort', role: '紀錄座位', desc: 'projects.json / coursefiles.json / utility-tools.json 記錄誰坐在哪個座位（port）。', color: '#3b82f6' },
                { num: 2, title: 'package.json -p flag', role: '執行時讀取', desc: 'scripts.dev 寫死 -p <port>，讓 Node.js 啟動伺服器時用正確的 port。', color: '#22c55e' },
              ].map(item => (
                <div key={item.num} className="rounded-lg p-3 text-sm" style={{ backgroundColor: 'var(--background-primary)', border: '1px solid var(--border-color)' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ backgroundColor: item.color + '20', color: item.color }}>{item.num}</span>
                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.title}</span>
                  </div>
                  <div className="text-xs mb-1" style={{ color: item.color }}>{item.role}</div>
                  <div className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{item.desc}</div>
                </div>
              ))}
            </div>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>一次 API 呼叫會自動同時更新這兩個地方。</p>
          </div>

          {/* 進駐 / 離開 */}
          <div className="grid grid-cols-2 gap-3" style={{ marginTop: '20px' }}>
            {[
              { title: '進駐（坐下）', steps: ['從 Dashboard 點「進駐」', 'API 自動分配最小編號的空座位，同步更新 JSON 和 package.json', '完成！專案現在在 Station 可以被 Start / Open'] },
              { title: '離開（站起來）', steps: ['先停止 dev server（如果正在運行）', '點「離開」→ API 清除 JSON devPort 和 package.json 的 -p flag', '座位釋出，下一個人可以坐'] },
            ].map(block => (
              <div key={block.title} className="rounded-lg p-3" style={{ backgroundColor: 'var(--background-primary)', border: '1px solid var(--border-color)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{block.title}</p>
                <ol className="space-y-1.5">
                  {block.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 items-start text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <span className="w-4 h-4 rounded flex items-center justify-center font-mono font-bold shrink-0 mt-0.5" style={{ backgroundColor: 'var(--background-secondary)', color: 'var(--text-tertiary)', fontSize: 10 }}>{i + 1}</span>
                      <span style={{ lineHeight: 1.6 }}>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div style={{ marginTop: '16px', backgroundColor: 'var(--background-primary)', border: '1px solid var(--border-color)' }} className="rounded-lg p-3 text-xs leading-relaxed">
            <p className="font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>為什麼要同時更新 JSON 和 package.json？</p>
            <div className="space-y-1" style={{ color: 'var(--text-secondary)' }}>
              <p><strong>JSON</strong> 是 Dashboard 的紀錄簿；<strong>package.json</strong> 是 Node.js 的說明書。只更新一個會造成不一致：</p>
              <ul className="ml-3 space-y-0.5 list-disc list-inside" style={{ color: 'var(--text-tertiary)' }}>
                <li>只更新 JSON → package.json 說「用 3001」，但沒人在 3001 坐著，混亂</li>
                <li>只更新 package.json → 程式用了 3001，但 Dashboard 不知道，找不到</li>
              </ul>
              <p>所以一次 API 呼叫會同時做好這兩件事。</p>
            </div>
          </div>
        </div>
      </ExpandableBox>
    </div>
  )
}

function CliVsSdkTab() {
  return (
    <div>
      <div className="rounded-xl px-5 py-4 mb-6" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          Claude Code CLI 與 Agent SDK 的關係
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          兩者不是競爭關係——SDK 把 CLI binary 打包在裡面，呼叫 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>query()</code> 時在背景 spawn 一個 CLI subprocess 去執行。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: '#3b82f6' }}>
            <i className="fa-solid fa-terminal mr-1.5" />Claude Code CLI
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>終端機互動工具（<code style={{ fontSize: '11px' }}>claude</code> 指令）。你親自打字，Claude 即時回應，可中斷、可修改方向。</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: '#f97316' }}>
            <i className="fa-solid fa-cube mr-1.5" />claude-agent-sdk
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>程式碼呼叫的函式庫（<code style={{ fontSize: '11px' }}>query()</code>）。自動化、嵌入 app、背景執行，不需要人在場。</p>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden mb-5" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-5 py-3" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            <i className="fa-solid fa-diagram-project mr-2" style={{ color: '#a78bfa' }} />執行架構
          </p>
        </div>
        <pre className="px-5 py-4 text-sm" style={{
          color: 'var(--text-secondary)',
          backgroundColor: 'var(--background-primary)',
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          whiteSpace: 'pre-wrap',
          lineHeight: '1.9',
          margin: 0,
        }}>
{`  Todo-Dashboard（Next.js）
          ↓  呼叫
     query() from SDK
          ↓  spawn subprocess（約 12 秒冷啟動）
  bundled Claude Code CLI binary
          ↓  HTTP call
     Anthropic API  →  消耗 Max 訂閱額度`}
        </pre>
      </div>

      <CalloutBox type="info">
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>SDK 如何運作</strong>
          <div style={{ marginTop: '4px' }}>
            SDK <strong>不是</strong>直接呼叫 Anthropic API。它把 Claude Code CLI binary 打包在套件裡，每次呼叫 <code style={{ backgroundColor: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: '3px', fontSize: '12px' }}>query()</code> 都會在背景 <strong>spawn 一個新的 subprocess</strong>，由那個 subprocess 去打 API 並把結果串流回來。
          </div>
        </div>
      </CalloutBox>

      <CalloutBox type="tip">
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>為什麼你不需要 API Key</strong>
          <div style={{ marginTop: '4px' }}>
            spawn 出來的 subprocess 就是你本機已登入的 Claude Code CLI，它繼承你的 <strong>Max 訂閱身份</strong>。所以 Todo-Dashboard 的每次 query() 消耗的是你的訂閱額度，而不是另外計費的 API token。
          </div>
        </div>
      </CalloutBox>

      <div style={{ marginTop: '24px', marginBottom: '12px' }}>
        <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>認證方式對照</h3>
      </div>

      <div className="rounded-xl overflow-hidden mb-5" style={{ border: '1px solid var(--border-color)' }}>
        <div className="grid grid-cols-3 text-sm" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }}>
          <div className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)' }}>情境</div>
          <div className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)' }}>認證方式</div>
          <div className="px-4 py-2.5 font-semibold" style={{ color: 'var(--text-tertiary)' }}>費用</div>
        </div>
        {[
          { situation: 'Todo-Dashboard', auth: '本機 CLI 登入狀態', cost: 'Max 訂閱額度', costColor: '#4ade80' },
          { situation: '第三方開發者自建 app', auth: 'ANTHROPIC_API_KEY', cost: '按 token 計費', costColor: 'var(--text-primary)' },
          { situation: 'AWS Bedrock', auth: 'AWS credentials', cost: 'AWS 計費', costColor: 'var(--text-primary)' },
          { situation: 'Google Vertex AI', auth: 'GCP credentials', cost: 'GCP 計費', costColor: 'var(--text-primary)' },
        ].map((row, i, arr) => (
          <div key={row.situation} className="grid grid-cols-3 text-sm" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
            <div className="px-4 py-2.5" style={{ color: 'var(--text-secondary)', borderRight: '1px solid var(--border-color)' }}>{row.situation}</div>
            <div className="px-4 py-2.5" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)' }}>
              <code style={{ fontSize: '12px', backgroundColor: 'var(--background-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>{row.auth}</code>
            </div>
            <div className="px-4 py-2.5" style={{ color: row.costColor }}>{row.cost}</div>
          </div>
        ))}
      </div>

      <ExpandableBox label="展開：query() 詳細執行流程">
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
          <div className="grid gap-2">
            {[
              { step: '1', text: 'query() 被呼叫（來自你的 Next.js API route）' },
              { step: '2', text: 'SDK 在 Node.js 中 spawn 一個子進程，執行 bundled Claude Code CLI binary' },
              { step: '3', text: '子進程繼承你本機的 CLI 登入狀態（或讀取 ANTHROPIC_API_KEY 環境變數）' },
              { step: '4', text: 'CLI 向 Anthropic API 發送 HTTP 請求，開始 agent loop（思考 → 工具 → 思考...）' },
              { step: '5', text: '執行結果透過 IPC（進程間通訊）串流回 SDK，轉為 async generator messages' },
              { step: '6', text: '任務完成後子進程退出，資源釋放' },
            ].map(({ step, text }) => (
              <div key={step} className="flex gap-3 items-start">
                <span className="shrink-0 text-xs font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--background-tertiary)', color: '#0184ff', fontFamily: 'ui-monospace, monospace' }}>{step}</span>
                <span className="text-sm">{text}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: '12px', padding: '10px 12px', backgroundColor: 'var(--background-tertiary)', borderRadius: '8px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
            注意：每次 query() 都要重新 spawn subprocess，冷啟動約需 12 秒。長對話使用 session resume 可降低延遲。
          </div>
        </div>
      </ExpandableBox>

      <div className="rounded-xl px-5 py-4 mt-5" style={{ backgroundColor: 'rgba(1,132,255,0.06)', border: '1px solid rgba(1,132,255,0.2)' }}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: '#0184ff' }}>
              <i className="fa-solid fa-book-open mr-2" />Agent SDK 入門指南
            </p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>從零開始了解 query()、內建工具（Read / Edit / Bash）與常見應用範例</p>
          </div>
          <a href="/agent-sdk" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shrink-0" style={{ backgroundColor: '#0184ff', color: '#fff', textDecoration: 'none' }}>
            查看指南
            <i className="fa-solid fa-arrow-right text-xs" />
          </a>
        </div>
      </div>
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

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: '#3b82f6' }}>Extension（駐點員工）</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>公司配好了電腦、門禁卡、印表機（MCP 工具）。坐下來就能工作。</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)' }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: '#f97316' }}>SDK（遠端外派員工）</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>只拿到電話號碼（Claude binary）。桌椅、門禁卡、印表機都要自己備齊。</p>
        </div>
      </div>

      <div className="rounded-xl px-5 py-4 mb-5" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
        <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>什麼是 MCP？</p>
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          MCP（Model Context Protocol）是 Claude 的「設備控制系統」——有了 MCP，Claude 才能操控外部工具，就像有了門禁卡才能進機房。
        </p>
        <div className="text-sm grid gap-2" style={{ color: 'var(--text-secondary)' }}>
          <div className="flex gap-2">
            <i className="fa-solid fa-circle-check text-xs mt-0.5 shrink-0" style={{ color: '#4ade80' }} />
            <span><code style={{ backgroundColor: 'var(--background-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>arc-cdp</code> MCP — 讓 Claude 截圖、點擊、導航 Arc 瀏覽器</span>
          </div>
          <div className="flex gap-2">
            <i className="fa-solid fa-circle-check text-xs mt-0.5 shrink-0" style={{ color: '#4ade80' }} />
            <span>Extension 自動配好；SDK 需在程式碼中明確列出，否則 Claude「沒有手」</span>
          </div>
        </div>
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

function ModelChoiceTab() {
  return (
    <div>
      <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
        Chat 面板模型選擇（H/S/O）
      </h2>
      <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
        Chat 面板底部有三個模型快鍵：<strong>H</strong>（Haiku）、<strong>S</strong>（Sonnet）、<strong>O</strong>（Opus）。選擇不同模型會影響 Claude 的速度、成本和推理能力。本文檔記錄了模型選擇邏輯的驗證過程及實作細節。
      </p>

      <CalloutBox type="info">
        把三個模型想成三種不同的顧問：<strong>Haiku</strong> 是快速回應的實習生（便宜、快），<strong>Sonnet</strong> 是全能的資深顧問（平衡），<strong>Opus</strong> 是思考最深的首席顧問（貴、慢、但最聰明）。根據任務複雜度選擇合適的人選。
      </CalloutBox>

      {/* Model Overview */}
      <div className="rounded-xl overflow-hidden mb-5" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-5 py-3 text-base font-semibold" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
          <i className="fa-solid fa-brain mr-2" style={{ color: '#3b82f6' }} />
          三種模型比較
        </div>
        <div style={{ backgroundColor: 'var(--background-primary)' }}>
          {[
            { model: 'H (Haiku)', speed: '極快', cost: '最便宜', use: '簡單查詢、文字處理、快速反饋', id: 'haiku' },
            { model: 'S (Sonnet)', speed: '中等', cost: '中等（預設）', use: '一般任務、代碼審查、文章寫作', id: 'sonnet' },
            { model: 'O (Opus)', speed: '慢', cost: '最貴', use: '複雜推理、深度分析、長篇規劃', id: 'opus' },
          ].map((row, i, arr) => (
            <div key={row.id} className="grid grid-cols-[120px_100px_100px_1fr] text-sm" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
              <div className="px-5 py-3.5 font-semibold" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>{row.model}</div>
              <div className="px-5 py-3.5" style={{ color: '#4ade80', borderRight: '1px solid var(--border-color)' }}>{row.speed}</div>
              <div className="px-5 py-3.5" style={{ color: '#f97316', borderRight: '1px solid var(--border-color)' }}>{row.cost}</div>
              <div className="px-5 py-3.5" style={{ color: 'var(--text-secondary)' }}>{row.use}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Implementation Details */}
      <ExpandableBox label="實作細節：模型參數如何傳遞？">
        <div style={{ marginBottom: '12px' }}>
          <strong style={{ color: 'var(--text-primary)' }}>完整傳遞路徑</strong>
          <pre style={{ backgroundColor: 'var(--background-secondary)', padding: '12px', borderRadius: '8px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', overflow: 'auto', lineHeight: '1.5' }}>
{`用戶點擊 [H] / [S] / [O]
    ↓
ChatContent.tsx (line 1353)
  → setModelChoice('haiku'|'sonnet'|'opus')
  → sendMessage(msg, mode, images, modelChoice, effortLevel)
    ↓
useClaudeChat.ts (line 668)
  → executeStream({
      model: modelOverride || config?.model || undefined
    })
    ↓
POST /api/claude-chat
  → body: { model: 'haiku'|'sonnet'|'opus', ... }
    ↓
route.ts (line 9)
  → const { model } = await request.json()
  → createSDKQuery(..., model)
    ↓
lib/claude-session-manager.ts (line 105-111)
  → buildQueryOptions():
      if (model === 'haiku') {
        opts.model = 'haiku'
      } else if (model === 'sonnet') {
        opts.model = 'sonnet'  ← 2025-02-19 修復：新增此分支
      } else if (model === 'opus') {
        opts.model = 'opus'
      }
    ↓
query({ prompt, options: opts })  ← 傳遞給 @anthropic-ai/claude-agent-sdk`}
          </pre>
        </div>
      </ExpandableBox>

      {/* Verification */}
      <ExpandableBox label="如何驗證模型選擇是否正確？">
        <div style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>方法 1：Terminal 日誌</strong>
          <div style={{ marginTop: '8px', marginBottom: '12px' }}>
            啟動開發伺服器後（<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '4px' }}>npm run dev</code>），在 Chat 面板分別點擊 H、S、O 發送訊息。Terminal 應該會輸出：
            <pre style={{ backgroundColor: 'var(--background-secondary)', padding: '12px', borderRadius: '8px', fontSize: '12px', marginTop: '6px', lineHeight: '1.5', overflow: 'auto', color: '#4ade80' }}>
{`[session-manager] opts.model: 'haiku' | opts.effort: undefined
[session-manager] opts.model: 'sonnet' | opts.effort: undefined
[session-manager] opts.model: 'opus' | opts.effort: 'high'  ← Opus 可配合 effort 調整`}
            </pre>
          </div>

          <strong style={{ color: 'var(--text-primary)' }}>方法 2：Arc 瀏覽器 Network 標籤</strong>
          <div style={{ marginTop: '8px', marginBottom: '12px' }}>
            1. 打開 Arc 瀏覽器開發者工具（F12）→ Network 標籤<br />
            2. 在 Chat 面板選擇模型並傳送訊息<br />
            3. 找到 POST `/api/claude-chat` 的請求 → 點擊 Payload 標籤<br />
            4. 確認 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '4px' }}>model: 'haiku'|'sonnet'|'opus'</code> 欄位已傳入
          </div>

          <strong style={{ color: 'var(--text-primary)' }}>方法 3：Chat 面板的按鈕視覺反饋</strong>
          <div style={{ marginTop: '8px' }}>
            所選的模型按鈕會呈現不同的背景色和邊框：
            <ul style={{ marginTop: '6px', marginLeft: '20px', listStyleType: 'disc', color: 'var(--text-secondary)' }}>
              <li><strong style={{ color: '#34d399' }}>H</strong> — 綠色邊框（Haiku Active）</li>
              <li><strong style={{ color: '#ffffff' }}>S</strong> — 白色邊框（Sonnet Active）</li>
              <li><strong style={{ color: '#f5a623' }}>O</strong> — 橙色邊框（Opus Active）</li>
            </ul>
          </div>
        </div>
      </ExpandableBox>

      {/* Known Issues */}
      <ExpandableBox label="已知問題與修復">
        <div style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
          <strong style={{ color: '#fbbf24' }}>問題（已修復）</strong>
          <div style={{ marginTop: '8px', marginBottom: '12px' }}>
            在 2025-02-19 之前，<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '4px' }}>buildQueryOptions()</code> 中對 Sonnet 沒有明確傳遞 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '4px' }}>opts.model</code>，導致 S 選項依賴 SDK 的預設值而非明確指定。雖然結果通常是正確的（因為預設值也是 Sonnet），但這存在隱患。
          </div>

          <strong style={{ color: '#4ade80' }}>修復方案</strong>
          <div style={{ marginTop: '8px' }}>
            在 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '4px' }}>lib/claude-session-manager.ts</code> 第 107-108 行新增 sonnet 分支：
            <pre style={{ backgroundColor: 'var(--background-secondary)', padding: '12px', borderRadius: '8px', fontSize: '12px', marginTop: '6px', lineHeight: '1.5', overflow: 'auto' }}>
{`if (model === 'haiku') {
  opts.model = 'haiku'
} else if (model === 'sonnet') {
  opts.model = 'sonnet'  // ← 新增（commit: pending）
} else if (model === 'opus') {
  opts.model = 'opus'
}`}
            </pre>
            同時在第 190 行加上調試日誌：
            <pre style={{ backgroundColor: 'var(--background-secondary)', padding: '12px', borderRadius: '8px', fontSize: '12px', marginTop: '6px', lineHeight: '1.5', overflow: 'auto' }}>
{`console.log('[session-manager] opts.model:', opts.model, '| opts.effort:', opts.effort)`}
            </pre>
          </div>
        </div>
      </ExpandableBox>

      {/* Best Practices */}
      <CalloutBox type="tip">
        <strong>最佳實踐建議：</strong>
        <ul style={{ marginTop: '8px', marginLeft: '20px', listStyleType: 'disc', color: 'var(--text-secondary)' }}>
          <li>一般任務預設用 <strong>S (Sonnet)</strong>，速度和成本平衡</li>
          <li>簡單任務（查詢、格式轉換）用 <strong>H (Haiku)</strong> 節省成本</li>
          <li>複雜推理（架構設計、深度分析）用 <strong>O (Opus)</strong>，搭配 <strong>effort: high</strong></li>
          <li>Opus 搭配 effort 切換（L/M/H）來微調思考深度，Haiku 和 Sonnet 的 effort 欄位被忽略</li>
        </ul>
      </CalloutBox>
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

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: '#4ade80' }}>allow / deny 規則</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>大樓公共規則，Extension 和 SDK 共用同一份</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: '#3b82f6' }}>permissionMode</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>各自獨立設定，就像同棟大樓的各房間各調各的冷氣</p>
        </div>
      </div>

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
          <div key={r.key} className="grid text-sm" style={{ gridTemplateColumns: '1fr 80px 140px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
            <div className="px-4 py-3 font-mono" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)' }}>{r.key}</div>
            <div className="px-4 py-3 font-mono" style={{ color: '#f97316', borderRight: '1px solid var(--border-color)' }}>{r.val}</div>
            <div className="px-4 py-3" style={{ color: 'var(--text-tertiary)' }}>{r.note}</div>
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
          <div key={r.key} className="grid text-sm" style={{ gridTemplateColumns: '200px 110px 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
            <div className="px-4 py-3 font-mono" style={{ color: 'var(--text-primary)', borderRight: '1px solid var(--border-color)' }}>{r.key}</div>
            <div className="px-4 py-3 font-mono" style={{ color: '#f97316', borderRight: '1px solid var(--border-color)' }}>{r.val}</div>
            <div className="px-4 py-3" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{r.note}</div>
          </div>
        ))}
      </div>

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

function PermissionsTab() {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Claude Code 權限模型</h2>
      <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>
        Claude Code 有三層獨立的權限控制，各管不同的事。理解這三層是設定 Claude 行為的關鍵。
      </p>

      {/* 辦公大樓比喻 */}
      <CalloutBox type="info">
        <div>
          <strong style={{ color: 'var(--text-primary)' }}>比喻：一棟辦公大樓</strong>
          <div style={{ marginTop: '8px' }}>
            你是大樓老闆，Claude 是裡面的員工。整棟大樓有三套管理系統，各自獨立運作，缺一不可。
          </div>
        </div>
      </CalloutBox>

      {/* Layer 1 */}
      <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: 'rgba(59,130,246,0.06)', borderBottom: '1px solid var(--border-color)' }}>
          <i className="fa-solid fa-id-card text-sm" style={{ color: '#3b82f6' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Layer 1 — permissionMode：工作證等級</span>
        </div>
        <div className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
          <p className="mb-3">員工進大樓時拿到的工作證，決定他能進哪些樓層。這張卡在進門時就決定了，<strong style={{ color: 'var(--text-primary)' }}>進去之後無法改變</strong>。共五種等級，限制程度由強到弱：</p>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
            <div className="grid text-xs font-semibold" style={{ gridTemplateColumns: '150px 1fr 160px', backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-tertiary)' }}>
              <div className="px-4 py-2" style={{ borderRight: '1px solid var(--border-color)' }}>工作證等級</div>
              <div className="px-4 py-2" style={{ borderRight: '1px solid var(--border-color)' }}>辦公室比喻</div>
              <div className="px-4 py-2">實際行為</div>
            </div>
            {[
              { mode: 'plan',               color: '#f87171', metaphor: '訪客證 — 只能在大廳等',                    desc: '只能分析和提報告，完全不能執行任何操作' },
              { mode: 'default',            color: '#fbbf24', metaphor: '一般員工卡 — 進機密室要刷卡確認',          desc: '讀取隨意，寫檔/執行指令需要你確認' },
              { mode: 'acceptEdits',        color: '#4ade80', metaphor: '資深員工卡 — 大部分樓層自由進出',          desc: '自動接受檔案修改，危險操作仍需確認' },
              { mode: 'dontAsk',            color: '#60a5fa', metaphor: '部門主管卡 — 幾乎不需要找你',              desc: '自動化場景用，極少中斷，不主動要求確認' },
              { mode: 'bypassPermissions',  color: '#c084fc', metaphor: '大樓管理員萬用鑰匙 — 所有門全開',          desc: '跳過所有權限檢查，僅限隔離環境（容器/VM）使用' },
            ].map((r, i, arr) => (
              <div key={r.mode} className="grid text-xs" style={{ gridTemplateColumns: '150px 1fr 160px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
                <div className="px-4 py-2.5 font-mono font-semibold" style={{ color: r.color, borderRight: '1px solid var(--border-color)' }}>{r.mode}</div>
                <div className="px-4 py-2.5" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)' }}>{r.metaphor}</div>
                <div className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{r.desc}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg px-4 py-3 text-xs" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-tertiary)', lineHeight: '1.8' }}>
            <div className="mb-1"><strong style={{ color: 'var(--text-secondary)' }}>Dashboard Chat Panel</strong> 右上角的 P / E / A 按鈕對應：</div>
            <div><span className="font-mono" style={{ color: '#f97316' }}>P</span> → <span className="font-mono">default</span>（注意：ChatMode 是 &apos;plan&apos;，但 permissionMode 是 &apos;default&apos;，不是 plan），<span className="font-mono" style={{ color: '#f97316' }}>E</span> → <span className="font-mono">acceptEdits</span>，<span className="font-mono" style={{ color: '#f97316' }}>A</span> → <span className="font-mono">acceptEdits</span> + ExitPlanMode 自動批准（不暫停等你確認）</div>
            <div className="mt-1"><span className="font-mono" style={{ color: '#c084fc' }}>bypassPermissions</span> 只能在 SDK 啟動時設定，不對應任何 UI 按鈕，<strong style={{ color: '#f87171' }}>僅限容器或 VM 等隔離環境</strong>。</div>
          </div>
        </div>
      </div>

      {/* Layer 2 */}
      <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: 'rgba(74,222,128,0.06)', borderBottom: '1px solid var(--border-color)' }}>
          <i className="fa-solid fa-book text-sm" style={{ color: '#4ade80' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Layer 2 — settings.json / CLAUDE.md：保全規則手冊</span>
        </div>
        <div className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
          <p className="mb-3">保全室裡的規則手冊，上面寫著「幾樓不能去、哪些房間要登記」。這決定的是<strong style={{ color: 'var(--text-primary)' }}>到達某層後，哪些房間可以進</strong>。</p>
          <CalloutBox type="warn">
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>關鍵限制</strong>：保全規則手冊只有在員工能進門的情況下才有用。如果員工是訪客證（<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>plan</code> mode），根本進不了電梯，手冊寫什麼都沒用。
            </div>
          </CalloutBox>
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="rounded-lg p-4" style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>
              <div className="flex items-center gap-2 mb-2">
                <i className="fa-solid fa-gear text-xs" style={{ color: '#3b82f6' }} />
                <span className="text-xs font-semibold font-mono" style={{ color: '#3b82f6' }}>settings.json</span>
              </div>
              <div className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>大樓保全條例 — 阻止危險行為</div>
              <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)', listStyleType: 'disc', paddingLeft: '14px' }}>
                <li>白紙黑字貼在牆上：哪些指令<strong style={{ color: 'var(--text-primary)' }}>絕對不能執行</strong></li>
                <li>保全看到就擋，Claude 無法說理由繞過</li>
                <li>全域生效，影響所有專案</li>
              </ul>
            </div>
            <div className="rounded-lg p-4" style={{ border: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>
              <div className="flex items-center gap-2 mb-2">
                <i className="fa-solid fa-file-lines text-xs" style={{ color: '#a78bfa' }} />
                <span className="text-xs font-semibold font-mono" style={{ color: '#a78bfa' }}>CLAUDE.md</span>
              </div>
              <div className="text-xs mb-2" style={{ color: 'var(--text-tertiary)' }}>部門工作手冊 — 引導工作習慣</div>
              <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)', listStyleType: 'disc', paddingLeft: '14px' }}>
                <li>主管給員工的指引：<strong style={{ color: 'var(--text-primary)' }}>這裡習慣怎麼做事</strong></li>
                <li>員工會照做，但這是習慣，不是物理阻擋</li>
                <li>全域或專案層級都可以設定</li>
              </ul>
            </div>
          </div>

          {/* 關鍵問題：Bash 要寫在哪裡？ */}
          <div className="rounded-lg mt-4 overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
            <div className="px-4 py-2.5 text-xs font-semibold" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              Bash 相關設定寫在哪裡？
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {[
                { need: '這個指令絕對不能執行', where: 'settings.json Deny list', reason: '硬性封鎖，Claude 無法繞過' },
                { need: '這個指令通常可以，但要小心', where: 'CLAUDE.md', reason: '行為規範，影響 Claude 的判斷方式' },
                { need: '這個專案有特殊工作流程', where: 'CLAUDE.md（專案層）', reason: '只對這個專案有效，不影響其他專案' },
                { need: '所有專案都適用的限制', where: 'settings.json', reason: '全域生效，一次設定到位' },
              ].map((r, i, arr) => (
                <div key={i} className="grid text-xs" style={{ gridTemplateColumns: '1fr 140px 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
                  <div className="px-4 py-2.5" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)' }}>{r.need}</div>
                  <div className="px-4 py-2.5 font-mono font-semibold" style={{ color: '#f97316', borderRight: '1px solid var(--border-color)' }}>{r.where}</div>
                  <div className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{r.reason}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 命名陷阱：permissionMode vs permissions.defaultMode */}
          <div className="mt-4 rounded-lg px-4 py-4" style={{ backgroundColor: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)' }}>
            <div className="flex items-center gap-2 mb-2">
              <i className="fa-solid fa-triangle-exclamation text-xs" style={{ color: '#fbbf24' }} />
              <span className="text-xs font-semibold" style={{ color: '#fbbf24' }}>命名陷阱：permissionMode vs permissions.defaultMode</span>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
              settings.json 裡有個 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>permissions.defaultMode</code> 欄位，名字和 Layer 1 的 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>permissionMode</code> 極度相似，但兩者是完全不同的東西：
            </p>
            <div className="rounded-lg overflow-hidden mb-3" style={{ border: '1px solid var(--border-color)' }}>
              <div className="grid text-xs font-semibold" style={{ gridTemplateColumns: '100px 1fr 1fr', backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-tertiary)' }}>
                <div className="px-3 py-2" style={{ borderRight: '1px solid var(--border-color)' }} />
                <div className="px-3 py-2 font-mono" style={{ borderRight: '1px solid var(--border-color)', color: '#60a5fa' }}>permissionMode</div>
                <div className="px-3 py-2 font-mono" style={{ color: '#a78bfa' }}>permissions.defaultMode</div>
              </div>
              {[
                { aspect: '屬於哪層', pm: 'Layer 1 — 工作證等級', pd: 'Layer 2 — settings.json 欄位' },
                { aspect: '在哪設定', pm: 'SDK 啟動時動態傳入', pd: 'settings.json 檔案' },
                { aspect: '誰會讀它', pm: 'SDK query() 直接使用', pd: 'Cursor extension 讀；SDK 不讀' },
                { aspect: '能被覆蓋嗎', pm: 'SDK 每次啟動都覆蓋', pd: '專案層蓋過全域層' },
              ].map((r, i, arr) => (
                <div key={i} className="grid text-xs" style={{ gridTemplateColumns: '100px 1fr 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
                  <div className="px-3 py-2 font-semibold" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)' }}>{r.aspect}</div>
                  <div className="px-3 py-2" style={{ color: 'var(--text-secondary)', borderRight: '1px solid var(--border-color)' }}>{r.pm}</div>
                  <div className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{r.pd}</div>
                </div>
              ))}
            </div>

            {/* 四層優先級 */}
            <div className="mb-3">
              <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>settings.json 的四層優先級（由高到低）</div>
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
                {[
                  { file: 'managed-settings.json',        note: '系統管理員層（最高）' },
                  { file: '.claude/settings.local.json',  note: '本機個人覆蓋（不進版本控制）' },
                  { file: '.claude/settings.json',        note: '專案層（git 追蹤）← 蓋過全域' },
                  { file: '~/.claude/settings.json',      note: '全域用戶層（最低）' },
                ].map((r, i, arr) => (
                  <div key={i} className="grid text-xs" style={{ gridTemplateColumns: '220px 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
                    <div className="px-3 py-2 font-mono" style={{ color: '#f97316', borderRight: '1px solid var(--border-color)' }}>{r.file}</div>
                    <div className="px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>{r.note}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cursor 常見困惑 */}
            <ExpandableBox label="常見困惑：Cursor 裡 Bash 明明有 allow，為什麼還是被擋？">
              <div className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
                <p className="mb-2">情境：全域 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>~/.claude/settings.json</code> 設了 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>defaultMode: &quot;acceptEdits&quot;</code>，也有 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>Bash(*)</code> allow，但 Cursor 裡大部分 Bash 指令還是跳確認框。</p>
                <p className="mb-2"><strong style={{ color: '#f87171' }}>根因</strong>：專案的 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>.claude/settings.json</code> 有 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>defaultMode: &quot;plan&quot;</code>，<strong style={{ color: 'var(--text-primary)' }}>專案層優先於全域層</strong>，Cursor extension 讀到的是 plan，所以所有操作都跳確認。</p>
                <div className="rounded-lg px-3 py-2 mb-2" style={{ backgroundColor: 'var(--background-tertiary)', border: '1px solid var(--border-color)' }}>
                  <div className="font-semibold mb-1" style={{ color: 'var(--text-secondary)' }}>解法：把專案層的 defaultMode 改成 acceptEdits</div>
                  <pre style={{ fontFamily: 'ui-monospace, monospace', fontSize: '11px', color: '#4ade80', margin: 0 }}>{`// .claude/settings.json\n"defaultMode": "acceptEdits"`}</pre>
                </div>
                <p style={{ color: 'var(--text-tertiary)' }}>注意：CLI、Cursor extension、SDK 子代理三者共用同一套 settings.json，改了對全部生效。</p>
              </div>
            </ExpandableBox>
          </div>
        </div>
      </div>

      {/* CLAUDE.md vs Memory 比較 */}
      <div className="rounded-xl px-5 py-4 mb-4" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-2 mb-1">
          <i className="fa-solid fa-code-compare text-xs" style={{ color: 'var(--text-tertiary)' }} />
          <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>這三個都是「給 Claude 看的文字」，差在哪？</span>
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>settings.json、CLAUDE.md、Memory 都會影響 Claude 的行為，但時機和目的完全不同。</p>
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
          <div className="grid text-xs font-semibold" style={{ gridTemplateColumns: '110px 1fr 1fr 1fr', backgroundColor: 'var(--background-tertiary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-tertiary)' }}>
            <div className="px-3 py-2" style={{ borderRight: '1px solid var(--border-color)' }} />
            <div className="px-3 py-2" style={{ borderRight: '1px solid var(--border-color)', color: '#3b82f6' }}>settings.json</div>
            <div className="px-3 py-2" style={{ borderRight: '1px solid var(--border-color)', color: '#a78bfa' }}>CLAUDE.md</div>
            <div className="px-3 py-2" style={{ color: '#4ade80' }}>Memory</div>
          </div>
          {[
            { aspect: '誰寫的', settings: '你（人類）', claude: '你（人類）', memory: 'Claude 自己寫' },
            { aspect: '內容性質', settings: '結構化規則', claude: '自然語言指引', memory: '自然語言筆記' },
            { aspect: '用途', settings: '阻止危險行為', claude: '引導工作方式', memory: '記住跨對話的資訊' },
            { aspect: '硬性/軟性', settings: '硬性，無法繞過', claude: '軟性，影響判斷', memory: '軟性，背景參考' },
            { aspect: '生效時機', settings: '每次工具呼叫時', claude: '對話開始時載入', memory: '對話開始時載入' },
            { aspect: '適合放什麼', settings: 'Deny 危險指令', claude: '專案慣例、工作流程', memory: '修過的 bug、用戶偏好' },
          ].map((r, i, arr) => (
            <div key={i} className="grid text-xs" style={{ gridTemplateColumns: '110px 1fr 1fr 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
              <div className="px-3 py-2 font-semibold" style={{ color: 'var(--text-tertiary)', borderRight: '1px solid var(--border-color)' }}>{r.aspect}</div>
              <div className="px-3 py-2" style={{ color: 'var(--text-secondary)', borderRight: '1px solid var(--border-color)' }}>{r.settings}</div>
              <div className="px-3 py-2" style={{ color: 'var(--text-secondary)', borderRight: '1px solid var(--border-color)' }}>{r.claude}</div>
              <div className="px-3 py-2" style={{ color: 'var(--text-secondary)' }}>{r.memory}</div>
            </div>
          ))}
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--text-tertiary)' }}>
          Memory 的詳細用法見 <span style={{ color: '#4ade80' }}>Ch6 Memory</span>，CLAUDE.md 見 <span style={{ color: '#a78bfa' }}>Ch5 CLAUDE.md</span>。
        </p>
      </div>

      {/* Layer 3 */}
      <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--border-color)' }}>
        <div className="px-4 py-3 flex items-center gap-3" style={{ backgroundColor: 'rgba(251,191,36,0.06)', borderBottom: '1px solid var(--border-color)' }}>
          <i className="fa-solid fa-note-sticky text-sm" style={{ color: '#fbbf24' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Layer 3 — P / E / A 按鈕：今天的工作清單</span>
        </div>
        <div className="px-5 py-4 text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
          <p className="mb-3">貼在員工桌上的便利貼，上面寫「今天專注在規劃」或「今天可以直接動手」。這<strong style={{ color: 'var(--text-primary)' }}>只影響工作風格，不影響工作證等級</strong>。</p>
          <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
            <div className="grid grid-cols-[60px_1fr] text-xs font-semibold" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-tertiary)' }}>
              <div className="px-4 py-2" style={{ borderRight: '1px solid var(--border-color)' }}>按鈕</div>
              <div className="px-4 py-2">工作風格</div>
            </div>
            {[
              { btn: 'P', desc: 'Plan — 先規劃、等你批准才動手' },
              { btn: 'E', desc: 'Execute — 可以執行，但有疑慮會暫停確認' },
              { btn: 'A', desc: 'Auto — 全自動、不中途打擾你' },
            ].map((r, i, arr) => (
              <div key={r.btn} className="grid grid-cols-[60px_1fr] text-sm" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
                <div className="px-4 py-2.5 font-mono font-bold" style={{ color: '#f97316', borderRight: '1px solid var(--border-color)' }}>{r.btn}</div>
                <div className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{r.desc}</div>
              </div>
            ))}
          </div>

          {/* 適用情境 */}
          <div className="mt-4 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
            <div className="px-4 py-2.5 text-xs font-semibold" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              什麼情境用哪個模式？
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
              {[
                {
                  btn: 'P',
                  when: '不確定怎麼做的大任務',
                  desc: '讓 Claude 先提計劃，你審查方向對了再批准執行。',
                  examples: ['重構 component', '設計 API 結構', '新增複雜功能'],
                  participation: '高（審計計劃）',
                  color: '#f97316',
                },
                {
                  btn: 'E',
                  when: '明確的小任務',
                  desc: '任務清楚、範圍小，直接讓 Claude 動手，有疑慮的步驟它會暫停問你。',
                  examples: ['修 bug', '改成 TypeScript', '加一個欄位'],
                  participation: '中（偶爾確認）',
                  color: '#fbbf24',
                },
                {
                  btn: 'A',
                  when: '放手跑的長任務',
                  desc: 'Claude 自己規劃自己執行，全程不暫停，你不想被中途打斷。',
                  examples: ['/audit', '/ship', '批量更新多個檔案', '執行 skill'],
                  participation: '低（放手）',
                  color: '#4ade80',
                },
              ].map((r, i, arr) => (
                <div key={r.btn} className="px-4 py-3 text-xs" style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-sm w-5" style={{ color: r.color }}>{r.btn}</span>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{r.when}</span>
                    <span className="ml-auto" style={{ color: 'var(--text-tertiary)' }}>參與度：{r.participation}</span>
                  </div>
                  <div className="mb-1.5 ml-7" style={{ color: 'var(--text-secondary)' }}>{r.desc}</div>
                  <div className="flex gap-1.5 ml-7 flex-wrap">
                    {r.examples.map(ex => (
                      <span key={ex} className="font-mono px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)' }}>{ex}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 命名撞車說明 */}
          <div className="mt-4 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
            <div className="px-4 py-2.5 text-xs font-semibold" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              深入：P / E / A 與 permissionMode 的關係
            </div>
            <div className="px-4 py-3 text-xs space-y-3" style={{ color: 'var(--text-tertiary)', lineHeight: '1.8' }}>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>兩個完全獨立的維度</strong><br />
                P / E / A 是前台的 <span className="font-mono" style={{ color: '#f97316' }}>ChatMode</span>，控制 UI 行為（要不要暫停等批准）。<br />
                <span className="font-mono" style={{ color: '#3b82f6' }}>permissionMode</span> 是後台的 SDK 參數，控制 Claude 實際能做什麼。<br />
                兩者是兩條獨立的線，中間的轉換邏輯由你的代碼決定。
              </div>
              <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
                <div className="grid text-xs font-semibold" style={{ gridTemplateColumns: '60px 1fr 1fr', backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-tertiary)' }}>
                  <div className="px-3 py-2" style={{ borderRight: '1px solid var(--border-color)' }}>按鈕</div>
                  <div className="px-3 py-2" style={{ borderRight: '1px solid var(--border-color)' }}>ChatMode（前台）</div>
                  <div className="px-3 py-2">permissionMode（後台）</div>
                </div>
                {[
                  { btn: 'P', chat: 'plan → 暫停等批准', perm: 'acceptEdits' },
                  { btn: 'E', chat: 'edit → 直接執行', perm: 'acceptEdits' },
                  { btn: 'A', chat: 'auto → 自動批准計劃', perm: 'acceptEdits' },
                ].map((r, i, arr) => (
                  <div key={r.btn} className="grid text-xs" style={{ gridTemplateColumns: '60px 1fr 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
                    <div className="px-3 py-2 font-mono font-bold" style={{ color: '#f97316', borderRight: '1px solid var(--border-color)' }}>{r.btn}</div>
                    <div className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)', borderRight: '1px solid var(--border-color)' }}>{r.chat}</div>
                    <div className="px-3 py-2 font-mono" style={{ color: '#3b82f6' }}>{r.perm}</div>
                  </div>
                ))}
              </div>
              <div>
                <strong style={{ color: '#fbbf24' }}>命名撞車陷阱</strong>：<span className="font-mono">plan</span> 這個詞在系統裡出現兩次，但指不同東西。<br />
                <span className="font-mono" style={{ color: '#f97316' }}>ChatMode 的 plan</span> = 你自己定義的 UI 概念（按鈕 P）。<br />
                <span className="font-mono" style={{ color: '#c084fc' }}>permissionMode 的 plan</span> = Claude SDK 原生的門禁等級（比 default 更嚴，幾乎什麼都不能做）。<br />
                按下 P 按鈕，後台傳的是 <span className="font-mono" style={{ color: '#3b82f6' }}>acceptEdits</span>，不是 SDK 的 <span className="font-mono" style={{ color: '#c084fc' }}>plan</span>。
              </div>
              <div>
                <strong style={{ color: 'var(--text-primary)' }}>這個對應是你自己寫的</strong>，不是 SDK 規定的。<br />
                <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 6px', borderRadius: '3px', color: 'var(--text-secondary)' }}>lib/claude-session-manager.ts</code> 裡的一行轉換代碼決定了誰對應誰：
                <pre style={{ backgroundColor: 'var(--background-tertiary)', padding: '8px 10px', borderRadius: '6px', marginTop: '6px', fontFamily: 'ui-monospace, monospace', color: 'var(--text-secondary)', fontSize: '11px' }}>{`const permissionMode = (mode === 'edit' || mode === 'auto') ? 'acceptEdits' : 'default'`}</pre>
                SDK 那端只收到一個 permissionMode 字串，不知道前面有 P / E / A 的存在。理論上 P 也可以傳 <span className="font-mono">acceptEdits</span>，完全取決於你怎麼寫這行。
              </div>
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <strong style={{ color: 'var(--text-primary)' }}>permissionMode 是倒數第二道關卡，不是第一道</strong><br />
                SDK 官方文檔定義的完整判斷順序（先到先得，匹配即停止）：
                <div className="rounded overflow-hidden mt-2" style={{ border: '1px solid var(--border-color)' }}>
                  {[
                    { step: '1', name: 'Hooks', desc: '自訂 hook 可強制 allow / deny，優先於一切' },
                    { step: '2', name: 'deny rules', desc: 'settings.json deny 清單，命中即擋死，不看後面' },
                    { step: '3', name: 'allow rules', desc: 'settings.json allow 清單，命中即放行，不看後面' },
                    { step: '4', name: 'ask rules', desc: 'settings.json ask 清單，命中則彈視窗' },
                    { step: '5', name: 'permissionMode', desc: '前面都沒命中，才輪到這裡決定預設行為' },
                    { step: '6', name: 'canUseTool callback', desc: '代碼層的最後攔截，可做任意自訂邏輯' },
                  ].map((r, i, arr) => (
                    <div key={r.step} className="grid text-xs" style={{ gridTemplateColumns: '28px 110px 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
                      <div className="px-2 py-2 font-mono text-center" style={{ color: '#555', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--background-secondary)' }}>{r.step}</div>
                      <div className="px-3 py-2 font-mono font-semibold" style={{ color: i < 2 ? '#f87171' : i < 4 ? '#4ade80' : i === 4 ? '#3b82f6' : '#a78bfa', borderRight: '1px solid var(--border-color)' }}>{r.name}</div>
                      <div className="px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>{r.desc}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
                  <div className="px-3 py-2 text-xs font-semibold" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-tertiary)' }}>情境對照：各指令停在第幾關</div>
                  <div className="grid text-xs font-semibold" style={{ gridTemplateColumns: '1fr 80px 60px 1fr', backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-tertiary)' }}>
                    <div className="px-3 py-2" style={{ borderRight: '1px solid var(--border-color)' }}>指令 / mode</div>
                    <div className="px-3 py-2" style={{ borderRight: '1px solid var(--border-color)' }}>停在第幾關</div>
                    <div className="px-3 py-2" style={{ borderRight: '1px solid var(--border-color)' }}>結果</div>
                    <div className="px-3 py-2">原因</div>
                  </div>
                  {[
                    { cmd: 'git commit，P mode', gate: '② allow', result: '放行', resultColor: '#4ade80', reason: 'Bash(git *) 在 allow 清單命中，permissionMode 沒被問到' },
                    { cmd: 'rm -rf /*，任何 mode', gate: '② deny', result: '擋死', resultColor: '#f87171', reason: 'deny 清單命中，後面三關全跳過' },
                    { cmd: 'sed ...，E mode', gate: '③ permissionMode', result: '彈視窗', resultColor: '#fbbf24', reason: 'sed 不在清單，acceptEdits 不含 Bash，交給 permissionMode' },
                    { cmd: 'sed ...，P mode', gate: '③ permissionMode', result: '彈視窗', resultColor: '#fbbf24', reason: 'sed 不在清單，default 遇到未預批准工具一律彈視窗' },
                    { cmd: 'Write（寫檔案），任何 mode', gate: '② allow', result: '放行', resultColor: '#4ade80', reason: '"Write" 在 allow 清單，P / E 按鈕對寫檔沒有差異' },
                  ].map((r, i, arr) => (
                    <div key={i} className="grid text-xs" style={{ gridTemplateColumns: '1fr 80px 60px 1fr', borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
                      <div className="px-3 py-2 font-mono" style={{ color: 'var(--text-secondary)', borderRight: '1px solid var(--border-color)' }}>{r.cmd}</div>
                      <div className="px-3 py-2 font-mono font-semibold" style={{ color: '#3b82f6', borderRight: '1px solid var(--border-color)' }}>{r.gate}</div>
                      <div className="px-3 py-2 font-semibold" style={{ color: r.resultColor, borderRight: '1px solid var(--border-color)' }}>{r.result}</div>
                      <div className="px-3 py-2" style={{ color: 'var(--text-tertiary)' }}>{r.reason}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  <strong style={{ color: 'var(--text-secondary)' }}>結論</strong>：P / E 按鈕的差異，只對「不在 allow / deny 清單裡的指令」才有意義。清單裡的東西，按哪個按鈕都一樣。
                </div>
              </div>
            </div>
          </div>

          {/* 與 Claude Code Extension 對照 */}
          <div className="mt-4 rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
            <div className="px-4 py-2.5 text-xs font-semibold" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
              與 Claude Code 官方 Extension 對照
            </div>
            <div className="px-4 py-3 text-xs space-y-3" style={{ color: 'var(--text-tertiary)', lineHeight: '1.8' }}>
              <div>
                Claude Code 官方 VS Code / Cursor Extension 也有三個 UI 模式，和你的 P / E / A 概念相似，但底層各自獨立實作。
              </div>
              <div className="rounded overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
                <div className="grid text-xs font-semibold" style={{ gridTemplateColumns: '1fr 1fr 100px', backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)', color: 'var(--text-tertiary)' }}>
                  <div className="px-3 py-2" style={{ borderRight: '1px solid var(--border-color)' }}>Extension UI</div>
                  <div className="px-3 py-2" style={{ borderRight: '1px solid var(--border-color)' }}>Dashboard P/E/A</div>
                  <div className="px-3 py-2">permissionMode</div>
                </div>
                {[
                  { ext: 'Plan mode', dashboard: 'P（Plan）', perm: 'plan', extColor: '#f87171', dashColor: '#f97316' },
                  { ext: 'Ask before edits', dashboard: 'E（Edit）', perm: 'default', extColor: '#fbbf24', dashColor: '#fbbf24' },
                  { ext: 'Edit automatically', dashboard: 'A（Auto）', perm: 'acceptEdits', extColor: '#4ade80', dashColor: '#4ade80' },
                ].map((r, i, arr) => (
                  <div key={i} className="grid text-xs" style={{ gridTemplateColumns: '1fr 1fr 100px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-color)' : undefined }}>
                    <div className="px-3 py-2 font-semibold" style={{ color: r.extColor, borderRight: '1px solid var(--border-color)' }}>{r.ext}</div>
                    <div className="px-3 py-2 font-semibold" style={{ color: r.dashColor, borderRight: '1px solid var(--border-color)' }}>{r.dashboard}</div>
                    <div className="px-3 py-2 font-mono" style={{ color: '#3b82f6' }}>{r.perm}</div>
                  </div>
                ))}
              </div>
              <div>
                <strong style={{ color: '#fbbf24' }}>關鍵差異</strong>：Extension 的 Plan mode 使用 SDK 原生的 <span className="font-mono" style={{ color: '#c084fc' }}>plan</span> permissionMode（Claude 完全不能動任何東西）。Dashboard 的 P 按鈕底層傳的是 <span className="font-mono" style={{ color: '#3b82f6' }}>acceptEdits</span>，不是 SDK 的 <span className="font-mono" style={{ color: '#c084fc' }}>plan</span>——「等批准」是 ChatMode 層的 UI 行為，不是 SDK 層的硬性封鎖。
              </div>
              <div>
                兩者都用同一個 Claude Agent SDK，只是各自在上面包了自己的 UI 和轉換邏輯，互不影響。
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 三層關係圖 */}
      <div className="rounded-xl px-5 py-4 mb-4" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>三層關係：各管各的，互不衝突</h3>
        <div className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
          <div className="mb-2">
            <span style={{ color: '#3b82f6' }}>● Layer 1（工作證）</span> — 管「能不能進電梯、到達那一層」
          </div>
          <div className="mb-2">
            <span style={{ color: '#4ade80' }}>● Layer 2（保全手冊）</span> — 管「到了那層之後，哪些房間可以進」
          </div>
          <div className="mb-3">
            <span style={{ color: '#fbbf24' }}>● Layer 3（便利貼）</span> — 管「進去之後，員工怎麼工作」
          </div>
          <CalloutBox type="tip">
            <div>
              <strong style={{ color: 'var(--text-primary)' }}>所以 permissionMode 寬鬆 + settings.json 嚴格並不矛盾</strong>：
              Layer 1 決定員工能到每一層，Layer 2 決定到了之後很多房間還是鎖著。
              兩個都存在，各管各的。
            </div>
          </CalloutBox>
        </div>
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

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>全域 CLAUDE.md</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>貼在大樓大廳的公告——所有住戶都看得到。安全政策、公共規則。</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 10 }}>專案 CLAUDE.md</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>貼在辦公室門口的備忘——只有進這間辦公室的人看到。<strong style={{ color: 'var(--text-primary)' }}>衝突時蓋過全域層</strong>。</p>
        </div>
      </div>

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

      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)' }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: '#a78bfa' }}>CLAUDE.md（你的命令）</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>你貼在公告欄的操作手冊——禁止事項、設備規範、緊急聯絡方式。你下的命令。</p>
        </div>
        <div className="rounded-xl px-4 py-3" style={{ backgroundColor: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.15)' }}>
          <p className="text-xs font-semibold mb-1.5" style={{ color: '#38bdf8' }}>Memory（Claude 的筆記）</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.65 }}>員工自己放在抽屜裡的工作日誌——修水管的心得、某樓燈容易壞。他自己的經驗。</p>
        </div>
      </div>

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

      <div className="rounded-xl px-5 py-4 mb-5" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase', fontSize: 11 }}>MCP 設備清單比喻</p>
        <div className="grid gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {[
            { code: 'arc-cdp',    icon: 'fa-globe',    label: '瀏覽器遙控器' },
            { code: 'zeabur',     icon: 'fa-rocket',   label: '部署發射台' },
            { code: 'insforge',   icon: 'fa-database', label: '資料庫查詢機' },
          ].map(item => (
            <div key={item.code} className="flex items-center gap-3">
              <i className={`fa-solid ${item.icon} text-xs`} style={{ color: '#a78bfa', width: 14, textAlign: 'center' }} />
              <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '1px 6px', borderRadius: '3px', color: '#a78bfa' }}>{item.code}</code>
              <span style={{ color: 'var(--text-tertiary)' }}>—</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
        <p className="text-sm mt-3" style={{ color: 'var(--text-tertiary)', lineHeight: 1.65 }}>
          Extension 員工入職時設備間已配好；SDK 遠端員工需要你親手把設備搬進工作站（<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>opts.mcpServers</code>）。
        </p>
      </div>

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
          { name: 'arc-cdp',                command: 'npx @playwright/mcp --cdp-endpoint http://localhost:9222', note: '透過 CDP 9222 控制 Arc 瀏覽器（人機協作）',   status: 'SDK 已手動加入', color: '#4ade80' },
          { name: 'bot-browser',            command: 'npx @playwright/mcp',                                     note: 'AI 專屬 headless Chromium（自動化測試）', status: 'SDK 已手動加入', color: '#4ade80' },
          { name: 'zeabur',                 command: 'npx @zeabur/mcp-server',                                  note: 'Zeabur 部署管理',                         status: '僅 Extension',   color: '#fbbf24' },
          { name: 'OfficeWebsite_insforge', command: 'npx -y @insforge/mcp@latest',                             note: 'Insforge 資料庫 MCP',                     status: '僅 Extension',   color: '#fbbf24' },
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
            <strong style={{ color: '#4ade80' }}>bot-browser（playwright-mcp headless）</strong>
            <div style={{ marginTop: '6px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              <div style={{ marginBottom: '4px' }}>不需要任何前置條件。Playwright 會在 AI 需要時自動在背景啟動一個 Chromium，不可見、不干擾 Arc。</div>
              <div style={{ marginBottom: '4px' }}>啟動指令（SDK 自動執行，不需手動）：</div>
              <pre style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-secondary)', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', fontFamily: 'ui-monospace, monospace', marginTop: '4px', marginBottom: '8px' }}>
{`npx @playwright/mcp`}
              </pre>
              <div style={{ color: '#4ade80' }}>
                <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }} />
                不依賴 Arc，不依賴 CDP port 9222，完全獨立運作。
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

      <ExpandableBox label="arc-cdp vs bot-browser — 兩種 MCP 的職責分離">
        <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
          <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
            同樣都是 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>@playwright/mcp</code>，差一個 flag，行為完全不同。
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
            <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.3)', backgroundColor: 'rgba(167,139,250,0.05)' }}>
              <div style={{ color: '#a78bfa', fontWeight: 600, marginBottom: '8px' }}>
                <i className="fa-solid fa-user mr-2" />arc-cdp
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                <div><strong style={{ color: 'var(--text-secondary)' }}>模式：</strong>連接既有瀏覽器</div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>依賴：</strong>Arc 必須以 CDP 啟動</div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>可見性：</strong>你看得到 AI 的操作</div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>適合：</strong>人機協作、截圖、觀察</div>
                <div style={{ marginTop: '6px', color: '#fbbf24' }}>
                  <i className="fa-solid fa-triangle-exclamation mr-1" />共用你的瀏覽器，有誤觸風險
                </div>
              </div>
            </div>
            <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid rgba(74,222,128,0.3)', backgroundColor: 'rgba(74,222,128,0.05)' }}>
              <div style={{ color: '#4ade80', fontWeight: 600, marginBottom: '8px' }}>
                <i className="fa-solid fa-robot mr-2" />bot-browser
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
                <div><strong style={{ color: 'var(--text-secondary)' }}>模式：</strong>自動啟動 headless Chromium</div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>依賴：</strong>無，完全獨立</div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>可見性：</strong>背景執行，不可見</div>
                <div><strong style={{ color: 'var(--text-secondary)' }}>適合：</strong>自動化測試、CI/CD</div>
                <div style={{ marginTop: '6px', color: '#4ade80' }}>
                  <i className="fa-solid fa-circle-check mr-1" />完全不碰你的 Arc，零干擾
                </div>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '13px', marginBottom: '8px' }}>
            <strong style={{ color: 'var(--text-primary)' }}>設計原則：</strong>
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.7 }}>
            <div>• <strong style={{ color: 'var(--text-secondary)' }}>arc-cdp</strong> 保留，供人類需要 AI 協助操作瀏覽器時使用（例如「幫我截圖這個頁面」）</div>
            <div>• <strong style={{ color: 'var(--text-secondary)' }}>bot-browser</strong> 用於所有自動化情境，AI 自己跑、自己測、不需要 Arc</div>
            <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '6px', backgroundColor: 'var(--background-tertiary)', color: 'var(--text-secondary)' }}>
              <i className="fa-solid fa-lightbulb mr-2" style={{ color: '#fbbf24' }} />
              過去「AI 誤把你的 3001 分頁導走」、「重複開出多個 3002 分頁」的問題，根本原因是 AI 和人類共用同一個 Arc session。改用 bot-browser 後，AI 在自己的 Chromium 裡操作，從根本解決職責混淆的問題。
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
  const [cdpStatus, setCdpStatus] = useState<{ portOpen: boolean; cdpResponding: boolean; wsConnectable: boolean | null } | null>(null)
  const [restarting, setRestarting] = useState(false)

  const checkStatus = useCallback(() => {
    fetch('/api/cdp-status')
      .then(r => r.json())
      .then(d => setCdpStatus({ portOpen: d.portOpen, cdpResponding: d.cdpResponding, wsConnectable: d.wsConnectable ?? null }))
      .catch(() => setCdpStatus({ portOpen: false, cdpResponding: false, wsConnectable: null }))
  }, [])

  useEffect(() => {
    checkStatus()
    const pollId = setInterval(checkStatus, 10 * 1000)
    return () => clearInterval(pollId)
  }, [checkStatus])

  const handleRestart = useCallback((withCdp: boolean) => {
    setRestarting(true)
    fetch('/api/cdp-restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cdp: withCdp }),
    }).finally(() => {
      setTimeout(() => {
        setRestarting(false)
        checkStatus()
      }, 4000)
    })
  }, [checkStatus])

  const isConnected = cdpStatus?.portOpen && cdpStatus?.cdpResponding && cdpStatus?.wsConnectable !== false
  const statusColor = restarting ? '#6b7280' : isConnected ? '#10b981' : '#ef4444'
  const statusText = restarting ? '重新啟動中...' : isConnected ? '已連線' : '未連線'

  return (
    <div>
      <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Browser MCP — 瀏覽器自動化的兩條路</h2>
      <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>這裡有兩個 MCP，底層都是同一個工具（<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>@playwright/mcp</code>），卻解決了兩個截然不同的問題。要理解為什麼，得從頭說起。</p>

      {/* 第一章 */}
      <div className="rounded-xl px-5 py-4 mb-4" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
        <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          <i className="fa-solid fa-robot mr-2" style={{ color: '#4ade80' }} />第一章：機器人測試員的誕生
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          很久以前，工程師們想讓程式自動測試網頁——點按鈕、填表單、確認結果。於是 Playwright 誕生了。它的做法很直接：<strong>自己開一個瀏覽器</strong>，在背景默默跑，不打擾任何人。這個瀏覽器沒有介面、不需要你盯著看，只管執行指令、回傳結果。
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          這就是 <strong>bot-browser</strong> 的本質：一個全自動的無頭機器人，隨叫隨到，用完即棄，設定極其簡單——
        </p>
        <pre style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-secondary)', padding: '10px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'ui-monospace, monospace', marginTop: '10px', lineHeight: 1.6 }}>
{`npx @playwright/mcp --browser chromium --headless`}</pre>
        <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>不需要任何前置條件，Playwright 自己負責啟動和關閉 Chromium。</p>
      </div>

      {/* 第二章 */}
      <div className="rounded-xl px-5 py-4 mb-4" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
        <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          <i className="fa-solid fa-triangle-exclamation mr-2" style={{ color: '#fbbf24' }} />第二章：機器人沒有記憶
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          但問題來了。這個機器人每次啟動都是全新的 Chromium，<strong>沒有任何 cookies、沒有登入狀態</strong>。你登入 Google、GitHub、公司後台的那些 session，機器人完全看不到。
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.75, fontStyle: 'italic' }}>
          「幫我看一下後台這個頁面有沒有問題。」<br />
          機器人到了那個 URL，看到的是登入頁。
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          對於需要身份驗證的頁面，無頭機器人是個瞎子。
        </p>
      </div>

      {/* 第三章 */}
      <div className="rounded-xl px-5 py-4 mb-4" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
        <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          <i className="fa-solid fa-key mr-2" style={{ color: '#a78bfa' }} />第三章：Chrome 的後門
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          其實 Chrome 從很早就內建了一個「遠端偵錯協議」，叫做 <strong>CDP（Chrome DevTools Protocol）</strong>。它原本是給 DevTools 用的——你在 F12 裡看到的所有東西，背後都是 CDP。
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          有人發現：只要讓瀏覽器開放這個後門（監聽一個 port），外部程式就可以「寄生」進去，<strong>繼承所有 session、cookies、登入狀態</strong>——用你正在使用的那個瀏覽器。
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          Playwright 順勢加了一個參數 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>--cdp-endpoint</code>，不再自己開瀏覽器，改成連接你已經在用的那一個。這就是 <strong>arc-cdp</strong> 的誕生：
        </p>
        <pre style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-secondary)', padding: '10px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'ui-monospace, monospace', marginTop: '10px', lineHeight: 1.6 }}>
{`npx @playwright/mcp --cdp-endpoint http://localhost:9222`}</pre>
      </div>

      {/* 第四章 */}
      <div className="rounded-xl px-5 py-4 mb-4" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          <i className="fa-solid fa-door-open mr-2" style={{ color: '#ef4444' }} />第四章：後門為什麼這麼麻煩
        </div>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          寄生進別人的瀏覽器，代價是你得讓對方先開門。Arc 預設不開放這個後門——每次從 Dock 或 Spotlight 點擊開啟，都是普通模式，沒有 CDP。你必須用特殊指令重啟：
        </p>
        <pre style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-secondary)', padding: '10px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'ui-monospace, monospace', marginTop: '10px', lineHeight: 1.6 }}>
{`pkill -a Arc; open -a Arc --args --remote-debugging-port=9222`}</pre>
        <p className="text-sm mt-3" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          Arc UI 設定裡有個「Remote Debugging」開關，看起來能省掉這步——<strong>但它是假的，完全無效</strong>。唯一方式就是上面那行指令。
        </p>
        <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          還有另一個代價：你和 AI 現在共用同一個瀏覽器。AI 說「我要打開 localhost:3001」，它可能直接把你正在看的分頁導走。多個 Claude session 同時運行，就像多個人搶同一台電腦的滑鼠——誰都可能誤觸別人的分頁。
        </p>
      </div>

      {/* 結局 */}
      <div className="rounded-xl px-5 py-4 mb-5" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
        <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          <i className="fa-solid fa-code-branch mr-2" style={{ color: '#0184ff' }} />現在的分工
        </div>
        <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)', lineHeight: 1.7 }}>
          arc-cdp 解決了 bot-browser 解決不了的問題，但 bot-browser 本身從來沒有消失。它一直都在——只是之前沒有被放進 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '1px 4px', borderRadius: '2px' }}>mcp.json</code>。現在兩個並存，根據場景選用。
        </p>
        <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid rgba(74,222,128,0.3)', backgroundColor: 'rgba(74,222,128,0.05)' }}>
            <div className="text-sm font-semibold mb-2" style={{ color: '#4ade80' }}>
              <i className="fa-solid fa-robot mr-2" />bot-browser <span style={{ fontSize: '10px', fontWeight: 400, color: '#6b7280' }}>（原始方案）</span>
            </div>
            <div className="text-xs space-y-1" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              <div>自己啟動 headless Chromium</div>
              <div>無前置條件，隨叫隨到</div>
              <div>無登入狀態（全新乾淨環境）</div>
              <div>不碰你的 Arc，零干擾</div>
              <div style={{ marginTop: '6px', color: 'var(--text-secondary)' }}>適合：UI 測試、點擊流程、截圖公開頁面</div>
            </div>
          </div>
          <div style={{ padding: '12px', borderRadius: '8px', border: '1px solid rgba(167,139,250,0.3)', backgroundColor: 'rgba(167,139,250,0.05)' }}>
            <div className="text-sm font-semibold mb-2" style={{ color: '#a78bfa' }}>
              <i className="fa-solid fa-user mr-2" />arc-cdp <span style={{ fontSize: '10px', fontWeight: 400, color: '#6b7280' }}>（後來加的）</span>
            </div>
            <div className="text-xs space-y-1" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              <div>連接你正在用的 Arc</div>
              <div>需要特殊指令重啟 Arc</div>
              <div>繼承你的所有 session / cookies</div>
              <div>AI 和你共用同一個瀏覽器</div>
              <div style={{ marginTop: '6px', color: 'var(--text-secondary)' }}>適合：需要登入的後台、staging 環境排查</div>
            </div>
          </div>
        </div>
      </div>

      <CalloutBox type="info">
        <strong>底層秘密：</strong> arc-cdp 和 bot-browser 的名字是我們自己取的，兩個都是 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>@playwright/mcp</code>，差的只是一個參數。bot-browser 用 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>--browser chromium --headless</code>，arc-cdp 用 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>--cdp-endpoint http://localhost:9222</code>。
      </CalloutBox>

      <h3 className="text-base font-semibold mt-6 mb-2" style={{ color: 'var(--text-primary)' }}>arc-cdp 即時狀態監控</h3>
      <p className="text-sm mb-4" style={{ color: 'var(--text-tertiary)' }}>因為 arc-cdp 需要 Arc 以特殊模式運行，以下面板即時顯示連線狀態。</p>

      {/* 實時監控面板 */}
      <div className="rounded-xl px-5 py-4 mb-5" style={{ backgroundColor: 'var(--background-secondary)' }}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>連線狀態監控</h4>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
            <span className="text-sm font-medium" style={{ color: statusColor }}>{statusText}</span>
          </div>
        </div>

        <div className="space-y-2 mb-3" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
          <div className="flex items-center justify-between py-2 px-3 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>
            <span>Port 9222 監聽</span>
            <span style={{ color: cdpStatus?.portOpen ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
              {cdpStatus?.portOpen ? '✓ 開啟' : '✗ 未開啟'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 px-3 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>
            <span>CDP 端點回應</span>
            <span style={{ color: cdpStatus?.cdpResponding ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
              {cdpStatus?.cdpResponding ? '✓ 正常' : '✗ 無回應'}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 px-3 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>
            <span>WebSocket 連線</span>
            <span style={{
              color: cdpStatus?.wsConnectable === true ? '#10b981' : cdpStatus?.wsConnectable === false ? '#ef4444' : '#6b7280',
              fontWeight: 'bold'
            }}>
              {cdpStatus?.wsConnectable === true ? '✓ 可連線' : cdpStatus?.wsConnectable === false ? '✗ 失敗' : '— 未測試'}
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleRestart(!isConnected)}
            disabled={restarting}
            className="flex-1 text-xs py-2 px-3 rounded-lg cursor-pointer transition-all font-medium"
            style={{
              backgroundColor: restarting ? 'var(--background-tertiary)' : isConnected ? 'transparent' : 'var(--accent-color, #0184ff)',
              color: restarting ? 'var(--text-tertiary)' : isConnected ? 'var(--text-secondary)' : '#fff',
              opacity: restarting ? 0.6 : 1,
              border: isConnected ? '1px solid var(--border-color)' : 'none',
            }}
          >
            {restarting ? '重新啟動中...' : isConnected ? '關閉 CDP' : '開啟 CDP'}
          </button>
        </div>
      </div>

      <h3 className="text-base font-semibold mt-6 mb-3" style={{ color: 'var(--text-primary)' }}>arc-cdp 故障排除</h3>
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

        <ExpandableBox label="症狀：狀態顯示「WebSocket 連線 ✗ 失敗」">
          <div style={{ color: 'var(--text-secondary)', lineHeight: '1.75' }}>
            <strong>含義：</strong> HTTP 層正常（port 開著、/json/version 有回應），但 WebSocket 握手失敗——這就是 Playwright MCP timeout 的根本原因。
            <div style={{ marginTop: '8px' }}><strong>可能原因：</strong></div>
            <div style={{ marginTop: '4px', marginLeft: '12px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              • Arc 剛重啟，browser context 尚未就緒（HTTP 先開，WS 慢幾秒）<br />
              • 有舊的 Playwright MCP 進程仍掛著佔用 WebSocket 連線<br />
              • Arc 內部狀態異常，需要完整重啟
            </div>
            <div style={{ marginTop: '8px' }}><strong>解決方案（依順序嘗試）：</strong></div>
            <div style={{ marginTop: '4px', marginLeft: '12px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
              1. 等待 10 秒讓儀表板重新檢測（Arc 剛重啟時 context 需要時間）<br />
              2. 清理舊的 MCP 進程：<code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>pkill -f &quot;playwright/mcp&quot;</code><br />
              3. 若仍失敗，重啟 Arc：點擊「開啟 CDP」按鈕，或手動執行 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>pkill -a Arc; sleep 2; open -a Arc --args --remote-debugging-port=9222</code>
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
                • <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>permissionMode</code> — 工作模式（plan / default / acceptEdits）<br />
                • <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>mcpServers</code> — 掛載哪些 MCP（Arc、Zeabur 等）<br />
                • <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>systemPrompt</code> — 全局系統提示<br />
                • <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>effort</code> — 努力程度（low/medium/high）
              </div>
              <div style={{ marginTop: '8px' }}>
                <strong>為什麼重要：</strong> 想理解「Extension 和 SDK 為什麼不同」，這個函式就是答案。本文件中提到的 permissionMode、opts.mcpServers 等概念都源自於此。
              </div>

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>先搞清楚：這幾個東西不是同一層</strong>
              </div>
              <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-tertiary)', lineHeight: 1.7 }}>
                被擋住的時候，很容易不知道是哪一層的問題。常見的混淆：「我 CLAUDE.md 已經開放 Bash 了，為什麼還被擋？」答案是：這三個東西在不同層次，上層擋住，下層設定完全沒效。
              </div>
              <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: '1px', fontSize: '12px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <div style={{ padding: '8px 10px', backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)', fontWeight: 600 }}>層次</div>
                <div style={{ padding: '8px 10px', backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)', fontWeight: 600 }}>是什麼</div>
                <div style={{ padding: '8px 10px', backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)', fontWeight: 600 }}>管什麼</div>
                <div style={{ padding: '8px 10px', backgroundColor: 'rgba(239,68,68,0.08)', color: '#f87171', fontWeight: 600 }}>Layer 1（最強）</div>
                <div style={{ padding: '8px 10px', backgroundColor: 'rgba(239,68,68,0.04)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>SDK permissionMode</div>
                <div style={{ padding: '8px 10px', backgroundColor: 'rgba(239,68,68,0.04)', color: 'var(--text-tertiary)' }}>全局開關，plan 模式下所有 tool 一律擋住</div>
                <div style={{ padding: '8px 10px', backgroundColor: 'rgba(251,191,36,0.08)', color: '#fbbf24', fontWeight: 600 }}>Layer 2</div>
                <div style={{ padding: '8px 10px', backgroundColor: 'rgba(251,191,36,0.04)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>CLAUDE.md / settings.json</div>
                <div style={{ padding: '8px 10px', backgroundColor: 'rgba(251,191,36,0.04)', color: 'var(--text-tertiary)' }}>Bash 黑白名單，管哪些指令可以執行</div>
                <div style={{ padding: '8px 10px', backgroundColor: 'rgba(74,222,128,0.08)', color: '#4ade80', fontWeight: 600 }}>Layer 3（最弱）</div>
                <div style={{ padding: '8px 10px', backgroundColor: 'rgba(74,222,128,0.04)', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>Chat P/E/A 按鈕</div>
                <div style={{ padding: '8px 10px', backgroundColor: 'rgba(74,222,128,0.04)', color: 'var(--text-tertiary)' }}>AI 行為風格提示，不是真正的權限控制</div>
              </div>
              <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                另一個常見混淆：<strong style={{ color: 'var(--text-secondary)' }}>Chat 的「P 按鈕」不等於 SDK 的 plan mode</strong>。P 按鈕背後是 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '1px 4px', borderRadius: '2px' }}>permissionMode = "default"</code>，SDK 的 plan mode 才是真的把所有 tool 鎖住。名字一樣，層次完全不同。
              </div>

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>實際踩坑範例：permissionMode 的三層架構</strong>
              </div>
              <div style={{ marginTop: '8px', fontSize: '13px' }}>
                <strong>現象：</strong> 全域 CLAUDE.md 已開放 Bash 權限，但在 Chat 視窗（Plan mode）執行 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>git status</code> 仍被擋住，必須先批准 ExitPlanMode 才能繼續。
              </div>
              <div style={{ marginTop: '8px', fontSize: '13px' }}>
                <strong>根因：</strong> 權限控制有三個層次，優先度由高到低：
              </div>
              <div style={{ marginTop: '4px', marginLeft: '12px', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                1. <strong>SDK permissionMode（最高）</strong> — <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>'plan'</code> 模式在 SDK 層全局禁止所有工具執行，不管下層怎麼設定<br />
                2. <strong>canUseTool callback（中）</strong> — 應用層控制，對 Bash 返回 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>allow</code>，但被上層 SDK 覆蓋<br />
                3. <strong>CLAUDE.md 黑白名單（低）</strong> — 全域用戶設定，最底層，影響不到 SDK 層行為
              </div>
              <div style={{ marginTop: '8px', fontSize: '13px' }}>
                <strong>解法：</strong> 改用 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>'default'</code> 取代 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>'plan'</code>，讓 canUseTool 的邏輯自行控制：
              </div>
              <div style={{ marginTop: '6px', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre', backgroundColor: 'var(--background-tertiary)', color: 'var(--text-secondary)' }}>
                {`// 修改前（Bash 被 SDK 攔截）\nconst permissionMode = mode === 'edit' ? 'acceptEdits' : 'plan'\n\n// 修改後（Bash 直接放行，ExitPlanMode 繼續被攔截）\nconst permissionMode = mode === 'edit' ? 'acceptEdits' : 'default'`}
              </div>
              <div style={{ marginTop: '8px', fontSize: '13px' }}>
                <strong>教訓：</strong> <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>permissionMode</code> 是 SDK 全局開關，優先於所有應用層設定。「我已經在 CLAUDE.md 開放了 bash」這句話，在 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>permissionMode='plan'</code> 面前完全無效。
              </div>

              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>延伸踩坑：permissionMode 是對話層級的，文字輸入無法解除</strong>
              </div>
              <div style={{ marginTop: '8px', fontSize: '13px' }}>
                <strong>現象：</strong> 對話中叫 AI「退出 plan mode」、「切換到 default 模式」，AI 收到指令但 Bash 仍然被擋，錯誤訊息是 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>ZodError</code> 而非一般的 permission denied。
              </div>
              <div style={{ marginTop: '8px', fontSize: '13px' }}>
                <strong>根因：</strong> <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '2px 4px', borderRadius: '2px' }}>permissionMode</code> 是在對話開啟時就寫入 conversation metadata 的，屬於<strong>對話層級的設定</strong>。User message 只是對話內容，無法改變 metadata。AI 在對話中「說」它要切換模式，但 SDK 層的 permissionMode 根本沒動。
              </div>
              <div style={{ marginTop: '8px', fontSize: '13px' }}>
                <strong>解法：</strong> 只能從 <strong>UI 層</strong>操作（Claude Code 介面的模式切換按鈕），或直接在 terminal 手動執行需要的指令，不能靠文字輸入讓 AI 解除。
              </div>
              <div style={{ marginTop: '8px', fontSize: '13px' }}>
                <strong>教訓：</strong> 對話裡的 user message 只能影響 AI 的回應，不能影響 SDK 的 permission 狀態。兩者是不同層次的東西——一個是 conversation，另一個是 runtime configuration。
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

// ── Chat Tab ─────────────────────────────────────────────────────

function ChatTierBadge({ tier }: { tier: FeatureTier }) {
  const config: Record<FeatureTier, { label: string; bg: string; fg: string; border: string }> = {
    core:     { label: '基本配備', bg: 'rgba(34,197,94,0.1)',  fg: '#22c55e', border: 'rgba(34,197,94,0.2)' },
    standard: { label: '標準配備', bg: 'rgba(249,115,22,0.1)', fg: '#f97316', border: 'rgba(249,115,22,0.2)' },
    optional: { label: '選配',     bg: 'rgba(59,130,246,0.1)', fg: '#3b82f6', border: 'rgba(59,130,246,0.2)' },
    advanced: { label: '進階',     bg: 'rgba(168,85,247,0.1)', fg: '#a855f7', border: 'rgba(168,85,247,0.2)' },
  }
  const c = config[tier]
  return (
    <span className="text-sm px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: c.bg, color: c.fg, border: `1px solid ${c.border}` }}>
      {c.label}
    </span>
  )
}

function ChatFeatureCard({ feature, expanded, onToggle }: { feature: ChatFeature; expanded: boolean; onToggle: () => void }) {
  return (
    <div
      className="rounded-lg cursor-pointer transition-colors duration-150 hover:bg-white/5"
      style={{ backgroundColor: 'var(--background-tertiary)', border: '1px solid var(--border-color)', padding: '12px 16px' }}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{feature.label}</span>
          <span className="text-sm font-mono" style={{ color: 'var(--text-tertiary)' }}>{feature.name}</span>
        </div>
        <ChatTierBadge tier={feature.tier} />
      </div>
      <div className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{feature.description}</div>
      {feature.useCases.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {feature.useCases.map((uc, i) => (
            <span key={i} className="text-sm px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}>
              {uc}
            </span>
          ))}
        </div>
      )}
      {expanded && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div className="text-sm mb-1.5 font-semibold" style={{ color: 'var(--text-secondary)' }}>包含檔案</div>
          {feature.files.map(file => (
            <div key={file} className="text-sm font-mono ml-4" style={{ color: 'var(--text-tertiary)' }}>{file}</div>
          ))}
          {feature.npmPackages && feature.npmPackages.length > 0 && (
            <>
              <div className="text-sm mt-2 mb-1 font-semibold" style={{ color: 'var(--text-secondary)' }}>npm 套件</div>
              {feature.npmPackages.map(pkg => (
                <div key={pkg} className="text-sm font-mono ml-4" style={{ color: 'var(--text-tertiary)' }}>{pkg}</div>
              ))}
            </>
          )}
          {feature.dependencies.length > 0 && (
            <>
              <div className="text-sm mt-2 mb-1 font-semibold" style={{ color: 'var(--text-secondary)' }}>依賴</div>
              <div className="text-sm font-mono ml-4" style={{ color: 'var(--text-tertiary)' }}>{feature.dependencies.join(', ')}</div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ChatConfiguratorRow({ feature, checked, locked, onToggle }: { feature: ChatFeature; checked: boolean; locked: boolean; onToggle: () => void }) {
  const depLabels = feature.dependencies
    .map(depId => CHAT_FEATURES.find(f => f.id === depId)?.label)
    .filter(Boolean)
  return (
    <label
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors duration-150 ${locked ? '' : 'cursor-pointer hover:bg-white/5'}`}
      style={{ backgroundColor: checked ? 'rgba(255,255,255,0.03)' : 'transparent', border: '1px solid var(--border-color)' }}
    >
      <input type="checkbox" checked={checked} disabled={locked} onChange={onToggle} className="accent-[#3b82f6] w-4 h-4" />
      <span className="text-sm flex-1" style={{ color: checked ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{feature.label}</span>
      {depLabels.length > 0 && (
        <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{depLabels.join(', ')}</span>
      )}
      <ChatTierBadge tier={feature.tier} />
    </label>
  )
}

function ChatTab() {
  const { copy, isCopied } = useCopyToClipboard(2000)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(CHAT_FEATURES.filter(f => f.tier === 'core' || f.tier === 'standard').map(f => f.id))
  )
  const [showOutput, setShowOutput] = useState(false)

  const toggleFeature = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
        for (const f of CHAT_FEATURES) {
          if (f.dependencies.includes(id) && f.tier !== 'core') next.delete(f.id)
        }
      } else {
        next.add(id)
        const feature = CHAT_FEATURES.find(f => f.id === id)
        if (feature) {
          for (const depId of feature.dependencies) next.add(depId)
        }
      }
      return next
    })
    setShowOutput(false)
  }

  const coreFeatures     = CHAT_FEATURES.filter(f => f.tier === 'core')
  const standardFeatures = CHAT_FEATURES.filter(f => f.tier === 'standard')
  const optionalFeatures = CHAT_FEATURES.filter(f => f.tier === 'optional')
  const advancedFeatures = CHAT_FEATURES.filter(f => f.tier === 'advanced')
  const selectedFeatures = CHAT_FEATURES.filter(f => selectedIds.has(f.id))
  const totalFiles       = selectedFeatures.reduce((sum, f) => sum + f.files.length, 0)
  const checklist        = useMemo(() => generatePortingChecklist(selectedIds), [selectedIds])
  const copied           = isCopied(checklist)

  return (
    <div>
      {/* Section 1: 功能展示 */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>功能展示</span>
          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Chat 系統的所有模組一覽</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CHAT_FEATURES.map(feature => (
            <ChatFeatureCard
              key={feature.id}
              feature={feature}
              expanded={expandedCard === feature.id}
              onToggle={() => setExpandedCard(prev => (prev === feature.id ? null : feature.id))}
            />
          ))}
        </div>
      </section>

      {/* Section 2: 自定義選配 */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>自定義選配</span>
          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>勾選要移植的功能模組</span>
        </div>
        <div className="mb-4">
          <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>基本配備 <span className="ml-2 font-normal" style={{ color: 'var(--text-tertiary)' }}>— 必要元件，無法取消</span></div>
          <div className="space-y-2">
            {coreFeatures.map(f => <ChatConfiguratorRow key={f.id} feature={f} checked={true} locked={true} onToggle={() => {}} />)}
          </div>
        </div>
        <div className="mb-4">
          <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>標準配備 <span className="ml-2 font-normal" style={{ color: 'var(--text-tertiary)' }}>— 大多數場景都需要，預設包含</span></div>
          <div className="space-y-2">
            {standardFeatures.map(f => <ChatConfiguratorRow key={f.id} feature={f} checked={selectedIds.has(f.id)} locked={false} onToggle={() => toggleFeature(f.id)} />)}
          </div>
        </div>
        <div className="mb-4">
          <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>選配功能 <span className="ml-2 font-normal" style={{ color: 'var(--text-tertiary)' }}>— 依需求自由搭配</span></div>
          <div className="space-y-2">
            {optionalFeatures.map(f => <ChatConfiguratorRow key={f.id} feature={f} checked={selectedIds.has(f.id)} locked={false} onToggle={() => toggleFeature(f.id)} />)}
          </div>
        </div>
        <div className="mb-4">
          <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>進階功能 <span className="ml-2 font-normal" style={{ color: 'var(--text-tertiary)' }}>— 較複雜的擴充模組</span></div>
          <div className="space-y-2">
            {advancedFeatures.map(f => <ChatConfiguratorRow key={f.id} feature={f} checked={selectedIds.has(f.id)} locked={false} onToggle={() => toggleFeature(f.id)} />)}
          </div>
        </div>
        <div className="flex items-center justify-between px-4 py-3 rounded-lg mt-4" style={{ backgroundColor: 'var(--background-tertiary)', border: '1px solid var(--border-color)' }}>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>已選 <strong>{selectedIds.size}</strong> 項功能，共 <strong>{totalFiles}</strong> 個檔案</span>
          <button
            onClick={() => setShowOutput(true)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
            style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)' }}
          >
            生成移植清單
          </button>
        </div>
      </section>

      {/* Section 3: 一鍵複製 */}
      {showOutput && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>移植清單</span>
            </div>
            <button
              onClick={() => copy(checklist)}
              className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                color: copied ? '#22c55e' : 'var(--text-secondary)',
                border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--border-color)'}`,
              }}
            >
              {copied ? '已複製' : '複製到剪貼簿'}
            </button>
          </div>
          <pre className="text-sm font-mono p-5 rounded-lg overflow-x-auto whitespace-pre-wrap" style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', lineHeight: 1.6 }}>
            {checklist}
          </pre>
        </section>
      )}
    </div>
  )
}

// ── Chat Doc Tab ─────────────────────────────────────────────────

function ChatDocSectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 mt-8 first:mt-0">
      <span className="text-sm font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>{title}</span>
      {subtitle && <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{subtitle}</span>}
    </div>
  )
}

function ChatDocTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="rounded-lg overflow-hidden mb-4" style={{ border: '1px solid var(--border-color)' }}>
      <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: 'var(--background-secondary)' }}>
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-2.5 text-left font-medium" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'var(--background-primary)' : 'var(--background-secondary)' }}>
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2" style={{ color: 'var(--text-secondary)', borderBottom: i < rows.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                  {j === 0 ? <code className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--primary-blue-light)' }}>{cell}</code> : cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChatDocCodeBlock({ code, label }: { code: string; label?: string }) {
  return (
    <div className="rounded-lg overflow-hidden mb-4" style={{ border: '1px solid var(--border-color)' }}>
      {label && (
        <div className="px-4 py-2 text-xs font-medium" style={{ backgroundColor: 'var(--background-secondary)', color: 'var(--text-tertiary)', borderBottom: '1px solid var(--border-color)' }}>
          {label}
        </div>
      )}
      <pre className="px-4 py-3 text-sm font-mono overflow-x-auto" style={{ backgroundColor: 'var(--background-primary)', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
        {code}
      </pre>
    </div>
  )
}

function ChatDocTab() {
  return (
    <div>
      {/* Overview */}
      <div className="rounded-xl px-5 py-4 mb-8" style={{ backgroundColor: 'var(--background-tertiary)', border: '1px solid var(--border-color)' }}>
        <div className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
          本頁記錄 Chat 系統的技術實作細節，包含 SDK 版本、Thinking 機制、架構分層與參數傳遞。
          功能模組總覽請參考
          <span className="font-medium" style={{ color: 'var(--primary-blue-light)' }}> Agent SDK Chat </span>
          分頁。
        </div>
      </div>

      {/* Section 1: 核心依賴 */}
      <ChatDocSectionHeader title="核心依賴" subtitle="runtime 層級的套件" />
      <ChatDocTable
        headers={['套件', '版本', '角色']}
        rows={[
          ['@anthropic-ai/claude-agent-sdk', '0.2.45', '核心 SDK — spawn Claude Code binary，提供 query() 函數'],
          ['@anthropic-ai/sdk', 'SDK 內部依賴', '底層 Anthropic API 型別定義（BetaMessage、BetaRawMessageStreamEvent）'],
          ['@modelcontextprotocol/sdk', 'SDK 內部依賴', 'MCP 伺服器連接層（McpServer、CallToolResult）'],
        ]}
      />
      <div className="text-sm mb-6" style={{ color: 'var(--text-tertiary)', lineHeight: 1.75 }}>
        <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--primary-blue-light)' }}>claude-agent-sdk</code> 不是直接呼叫 Anthropic Messages API，
        而是在 Node.js 環境中 spawn 一個 Claude Code CLI binary（與終端機中使用的 <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--primary-blue-light)' }}>claude</code> 指令相同），
        透過 stdin/stdout JSON 串流與之通訊。這意味著 SDK 繼承了 Claude Code 的所有功能：工具執行、檔案操作、MCP 連接、session 持久化等。
      </div>

      {/* Section 2: 系統架構 */}
      <ChatDocSectionHeader title="系統架構" subtitle="四層結構" />
      <ChatDocCodeBlock
        label="資料流方向（由前端到底層）"
        code={`前端 Hook (useClaudeChat)          hooks/useClaudeChat.ts
  \u2192 API Route (POST /api/claude-chat)  app/api/claude-chat/route.ts
    \u2192 Session Manager (createSDKQuery)   lib/claude-session-manager.ts
      \u2192 Claude Agent SDK (query())         node_modules/@anthropic-ai/claude-agent-sdk`}
      />
      <div className="space-y-3 mb-6">
        {[
          {
            layer: 'useClaudeChat',
            file: 'hooks/useClaudeChat.ts',
            desc: '前端 React Hook\u3002管理 messages state\u3001sendMessage \u7de8\u6392\u5668\uff08\u5716\u7247\u4e0a\u50b3 \u2192 SSE fetch \u2192 retry \u2192 \u6301\u4e45\u5316\uff09\u3001SSE \u89e3\u6790\u5f15\u64ce\uff08readSSEStream \u9010\u884c\u89e3\u6790 + carry-over buffer\uff09\u3001stopStreaming\u3001clearChat\u3001\u932f\u8aa4\u8655\u7406\u8207\u81ea\u52d5\u91cd\u8a66\u3002',
            details: '\u5167\u5efa processStreamEvent \u5206\u6d3e\u5668\uff0c\u5c07\u4e0d\u540c\u985e\u578b\u7684 SSE \u4e8b\u4ef6\uff08system / assistant / stream / result / tool_stats\uff09\u8def\u7531\u5230\u5c0d\u61c9\u7684 state \u66f4\u65b0\u3002\u6bcf\u500b\u5de5\u5177\u547c\u53eb\u6703\u900f\u904e extractToolDescription \u64f7\u53d6\u7c21\u77ed\u63cf\u8ff0\uff0c\u986f\u793a\u5728 UI \u7684 ToolGroup \u4e2d\u3002',
          },
          {
            layer: 'API Route',
            file: 'app/api/claude-chat/route.ts',
            desc: 'Next.js API Route\uff08maxDuration: 300s\uff09\u3002\u63a5\u6536\u524d\u7aef POST \u8acb\u6c42\uff0c\u89e3\u6790 projectId \u2192 \u5c08\u6848\u8def\u5f91\uff08\u652f\u63f4\u865b\u64ec\u5c08\u6848 port-manager / chat-lab\uff09\uff0c\u5efa\u7acb SDK query\uff0c\u518d\u7528 ReadableStream \u5c07 SDK message \u8f49\u767c\u70ba SSE\u3002',
            details: '\u8655\u7406\u56db\u7a2e SDK \u8a0a\u606f\u578b\u5225\uff1asystem\uff08init\u3001\u6a21\u578b\u8cc7\u8a0a\uff09\u3001assistant\uff08BetaMessage \u683c\u5f0f\u7684\u5b8c\u6574\u56de\u61c9\uff09\u3001stream_event\uff08\u9010\u5b57\u4e32\u6d41\u7247\u6bb5\uff09\u3001result\uff08\u6210\u529f/\u5931\u6557 + \u8cbb\u7528\u7d71\u8a08\uff09\u3002\u76e3\u807d request.signal abort \u4ee5\u5075\u6e2c client \u65b7\u958b\u9023\u7dda\u3002',
          },
          {
            layer: 'Session Manager',
            file: 'lib/claude-session-manager.ts',
            desc: 'SDK query \u5de5\u5ee0\u3002buildQueryOptions \u5c07\u524d\u7aef\u53c3\u6578\uff08model / effort / mode / sessionId\uff09\u7d44\u88dd\u6210 SDK Options \u7269\u4ef6\uff0ccanUseTool callback \u653e\u884c\u4e00\u822c\u5de5\u5177\u4f46\u6514\u622a AskUserQuestion \u548c ExitPlanMode\u3002',
            details: '\u7ba1\u7406\u4e09\u500b\u5168\u57df Map\uff1aactiveQueries\uff08session \u2192 Query \u5be6\u4f8b\uff0c\u4f9b answer API \u547c\u53eb setPermissionMode\uff09\u3001pendingRequests\uff08Promise \u6682\u5b58\uff0c5 \u5206\u9418\u903e\u6642\uff09\u3001toolStats\uff08\u5de5\u5177\u4f7f\u7528\u6b21\u6578\u7d71\u8a08\uff09\u3002',
          },
          {
            layer: 'Agent SDK',
            file: 'node_modules/@anthropic-ai/claude-agent-sdk',
            desc: '\u5e95\u5c64 binary\u3002SDK spawn \u4e00\u500b Claude Code \u5b50\u7a0b\u5e8f\uff0c\u900f\u904e --output-format stream-json --input-format stream-json \u9032\u884c JSON \u4e32\u6d41\u901a\u8a0a\u3002\u5b50\u7a0b\u5e8f\u8ca0\u8cac\u8207 Anthropic API \u5be6\u969b\u901a\u8a0a\u3001\u57f7\u884c\u5de5\u5177\u3001\u7ba1\u7406 thinking\u3002',
            details: 'SDK \u81ea\u52d5\u5c07 Options \u4e2d\u7684 model / effort / maxThinkingTokens \u8f49\u63db\u70ba CLI \u53c3\u6578\uff08--model / --effort / --max-thinking-tokens\uff09\u3002\u5982\u679c\u50b3\u5165 thinking: { type: "adaptive" }\uff0c\u5247\u4f7f\u7528\u9810\u8a2d 32000 tokens \u7684 max thinking budget\u3002',
          },
        ].map(item => (
          <div key={item.layer} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
            <div className="flex items-center gap-3 px-4 py-3" style={{ backgroundColor: 'var(--background-secondary)' }}>
              <code className="text-xs px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.2)' }}>{item.layer}</code>
              <code className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.file}</code>
            </div>
            <div className="px-4 py-3" style={{ backgroundColor: 'var(--background-primary)' }}>
              <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{item.desc}</div>
              <div className="text-sm" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{item.details}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Section 3: Adaptive Thinking */}
      <ChatDocSectionHeader title="Adaptive Thinking" subtitle="Opus 4.6 / Sonnet 4.6 的思考機制" />
      <div className="text-sm mb-4" style={{ color: 'var(--text-secondary)', lineHeight: 1.75 }}>
        Claude 4.6 引入了 <strong>Adaptive Thinking</strong> 取代舊版的固定 budget_tokens 模式。
        在 Adaptive 模式下，Claude 會根據問題的複雜度自行決定是否啟動 extended thinking 以及使用多少 token 進行推理。
        這代表簡單的任務（如「把變數改名」）可能完全不觸發 thinking，而複雜任務（如「重構整個認證系統」）會進行深度推理。
      </div>
      <div className="rounded-lg px-4 py-3 mb-4" style={{ backgroundColor: 'rgba(34,197,94,0.04)', border: '1px solid rgba(34,197,94,0.2)' }}>
        <div className="flex items-center gap-2 mb-1">
          <i className="fa-solid fa-circle-check text-xs" style={{ color: '#22c55e' }} />
          <span className="text-sm font-medium" style={{ color: '#22c55e' }}>預設開啟</span>
        </div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          SDK <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>sdk.d.ts</code> 第 618 行明確註解：
          <em style={{ color: 'var(--text-tertiary)' }}>{' "{ type: \'adaptive\' } — This is the default for models that support it."'}</em>
          <br />
          Opus 4.6 和 Sonnet 4.6 會自動以 Adaptive Thinking 模式運行，不需要額外設定。
        </div>
      </div>
      <div className="text-sm mb-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Effort 等級與思考行為</div>
      <div className="text-sm mb-3" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        effort 參數是 Adaptive Thinking 的控制桿，決定 Claude 投入多少思考資源。它不是開關（開/關），而是一個漸進的深度控制。
      </div>
      <ChatDocTable
        headers={['Effort', '思考行為', '適用場景', '備註']}
        rows={[
          ['max', '永遠思考，無限制', '最困難的推理任務', '僅 Opus 4.6'],
          ['high（預設）', '幾乎永遠思考', '複雜程式碼、架構決策', '不傳 effort 時的預設值'],
          ['medium', '中等思考，簡單問題可能跳過', '日常開發、中等難度', '平衡速度與品質'],
          ['low', '盡量跳過思考', '分類、查詢、高吞吐量場景', '速度優先'],
        ]}
      />
      <div className="text-sm mb-3 font-medium" style={{ color: 'var(--text-secondary)' }}>Thinking 模式比較</div>
      <ChatDocTable
        headers={['模式', 'API 設定', '適用模型', '說明']}
        rows={[
          ['Adaptive', 'thinking: { type: "adaptive" }', 'Opus 4.6、Sonnet 4.6', 'Claude 自行決定是否思考（預設）'],
          ['Manual', 'thinking: { type: "enabled", budgetTokens: N }', '所有模型', '固定 token 預算（4.6 已標記 deprecated）'],
          ['Disabled', '省略 thinking 參數', '所有模型', '不思考，最低延遲'],
        ]}
      />
      <div className="text-sm mb-4" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        Adaptive 模式還自動啟用 <strong>Interleaved Thinking</strong>：Claude 可以在工具呼叫之間穿插思考（而非只在開頭思考一次），這對 agentic 工作流特別有效 — 每次收到工具結果後，Claude 會重新評估下一步策略。
      </div>
      <div className="rounded-lg px-4 py-3 mb-6" style={{ backgroundColor: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.2)' }}>
        <div className="flex items-center gap-2 mb-1">
          <i className="fa-solid fa-triangle-exclamation text-xs" style={{ color: '#fbbf24' }} />
          <span className="text-sm font-medium" style={{ color: '#fbbf24' }}>我們系統的實際狀態</span>
        </div>
        <div className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          我們沒有明確傳入 <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>thinking</code> 參數，SDK 會自動為 Opus 4.6 / Sonnet 4.6 啟用 Adaptive Thinking。
          <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>effort</code> 參數由使用者在 UI 選擇（L/M/H 按鈕），未選時 CLI 預設為 <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>high</code>。
          <br />
          Haiku 4.5 不支援 Adaptive Thinking，使用 Haiku 時 thinking 被完全略過。
        </div>
      </div>

      {/* Section 4: 可傳入參數 */}
      <ChatDocSectionHeader title="可傳入參數" subtitle="前端 UI → API Route → Session Manager → SDK CLI" />
      <div className="text-sm mb-3" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        使用者在 Chat UI 上的每個操作（選模型、選 effort、切模式）都會通過以下四層傳遞，最終轉換為 Claude Code CLI 的命令列參數。
      </div>
      <ChatDocTable
        headers={['參數', '來源', '說明', '不傳時的預設']}
        rows={[
          ['model', 'UI 模型切換（H/S/O）', 'haiku / sonnet / opus', 'SDK 預設模型'],
          ['effort', 'UI effort 切換（L/M/H）', 'low / medium / high', 'CLI 預設 high'],
          ['mode', 'UI 模式切換（P/E）', 'plan / edit — 影響 permissionMode 和 MCP 載入', 'plan'],
          ['sessionId', '自動管理', '傳入則 resume 舊 session（SDK --resume flag）', '建立新 session'],
          ['systemPromptAppend', 'Skill / 特殊場景', '追加到 system prompt 的 append 欄位', '空字串'],
        ]}
      />
      <ChatDocCodeBlock
        label="buildQueryOptions() 產出的 Options 結構（lib/claude-session-manager.ts）"
        code={`{
  cwd: projectPath,                          // 專案根目錄
  additionalDirectories: [projectPath],      // 允許存取的額外目錄
  permissionMode: 'acceptEdits',             // 預設權限模式
  settingSources: ['user', 'project'],       // 讀取 settings.json 的來源
  systemPrompt: {
    type: 'preset',
    preset: 'claude_code',                   // 使用 Claude Code 內建 system prompt
    append: '...',                           // 自訂追加指令 + systemPromptAppend
  },
  includePartialMessages: true,              // 啟用逐字串流（stream_event）
  env: { ...process.env（排除 CLAUDECODE）},  // 傳遞環境變數，排除巢狀偵測 flag
  model?: 'haiku' | 'sonnet' | 'opus',      // 依 UI 選擇
  effort?: 'low' | 'medium' | 'high',       // 依 UI 選擇
  resume?: sessionId,                        // 恢復既有 session
  mcpServers?: {                             // edit mode 不載入
    'arc-cdp': { command: 'npx', args: ['@playwright/mcp', '--cdp-endpoint', 'http://localhost:9222'] },
    'bot-browser': { command: 'npx', args: ['@playwright/mcp'] },
  },
}`}
      />
      <div className="text-sm mb-6" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--text-secondary)' }}>env 處理</strong>：SDK 會將 process.env 傳給子程序，但必須排除 <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>CLAUDECODE</code> 環境變數，
        否則 Claude Code binary 會偵測到巢狀執行並拒絕啟動（{'"Claude Code cannot be launched inside another Claude Code session"'}）。
      </div>

      {/* Section 5: 關鍵機制 */}
      <ChatDocSectionHeader title="關鍵機制" subtitle="系統運作的核心邏輯" />
      <div className="space-y-4 mb-6">
        {/* SSE 串流 */}
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: 'var(--background-secondary)' }}>
            <i className="fa-solid fa-bolt text-xs" style={{ color: '#3b82f6' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>SSE 串流</span>
          </div>
          <div className="px-4 py-3" style={{ backgroundColor: 'var(--background-primary)' }}>
            <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              設定 <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>includePartialMessages: true</code> 啟用逐字串流。SDK 產出的四種訊息類型透過 ReadableStream 即時轉發給前端：
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {[
                { type: 'system', desc: 'init 事件 — 模型名稱、可用工具、工作目錄' },
                { type: 'assistant', desc: '完整回應訊息（BetaMessage 格式）' },
                { type: 'stream_event', desc: '逐字串流片段（部分文字 / 工具呼叫）' },
                { type: 'result', desc: '任務完成 — 耗時、花費、錯誤訊息' },
              ].map(item => (
                <div key={item.type} className="flex items-start gap-2 px-3 py-2 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>
                  <code className="text-xs px-1 py-0.5 rounded shrink-0 mt-0.5" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--primary-blue-light)' }}>{item.type}</code>
                  <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{item.desc}</span>
                </div>
              ))}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              前端 readSSEStream 逐行解析 SSE（處理跨 chunk 的不完整行），再由 processStreamEvent 路由到對應的 state 更新。
            </div>
          </div>
        </div>

        {/* canUseTool 阻塞 */}
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: 'var(--background-secondary)' }}>
            <i className="fa-solid fa-hand text-xs" style={{ color: '#f59e0b' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>canUseTool 阻塞機制</span>
          </div>
          <div className="px-4 py-3" style={{ backgroundColor: 'var(--background-primary)' }}>
            <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              SDK 的 <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>canUseTool</code> callback 在每個工具執行前被呼叫。我們利用它實現「暫停等待用戶」：
            </div>
            <div className="text-sm mb-2" style={{ color: 'var(--text-tertiary)', lineHeight: 1.75 }}>
              1. 一般工具（Read / Edit / Bash 等）→ 直接放行（<code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>{'{ behavior: "allow" }'}</code>）<br />
              2. <strong>AskUserQuestion</strong> / <strong>ExitPlanMode</strong> → 建立 Promise，存入 pendingRequests Map<br />
              3. SDK 暫停在 await 上，等待 Promise resolve<br />
              4. 用戶在 UI 點擊回應 → 呼叫 /api/claude-chat/answer → resolve Promise → SDK 繼續<br />
              5. 超過 5 分鐘無回應 → 自動 reject，SDK 收到 timeout 錯誤
            </div>
            <div className="text-sm" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              同時，canUseTool 也負責工具統計（toolStats），計算每個工具的呼叫次數，最後在串流結束時作為 tool_stats 事件傳回前端。
            </div>
          </div>
        </div>

        {/* Answer API */}
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: 'var(--background-secondary)' }}>
            <i className="fa-solid fa-reply text-xs" style={{ color: '#22c55e' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Answer API</span>
            <code className="text-xs" style={{ color: 'var(--text-tertiary)' }}>/api/claude-chat/answer</code>
          </div>
          <div className="px-4 py-3" style={{ backgroundColor: 'var(--background-primary)' }}>
            <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              處理兩種用戶回應類型：
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="px-3 py-2 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>
                <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>question</div>
                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  用戶回答 AskUserQuestion → resolve pending Promise，answers 傳回 SDK 作為工具結果
                </div>
              </div>
              <div className="px-3 py-2 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>
                <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>planApproval</div>
                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  批准 → resolve + 自動 q.setPermissionMode({'"acceptEdits"'})<br />
                  拒絕 → deny + feedback 訊息傳回 SDK
                </div>
              </div>
            </div>
            <div className="text-sm" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Timing Race 處理</strong>：前端從 SSE 偵測到 ExitPlanMode 可能早於 server 端 canUseTool callback 建立 pending Promise。
              Answer API 內建輪詢機制（每 200ms 檢查一次，最多等 5 秒），確保 pending request 已就緒後才 resolve。
            </div>
          </div>
        </div>

        {/* MCP 伺服器 */}
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: 'var(--background-secondary)' }}>
            <i className="fa-solid fa-puzzle-piece text-xs" style={{ color: '#a855f7' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>MCP 伺服器</span>
          </div>
          <div className="px-4 py-3" style={{ backgroundColor: 'var(--background-primary)' }}>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="px-3 py-2 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>
                <div className="text-xs font-medium mb-1" style={{ color: '#a855f7' }}>arc-cdp</div>
                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  透過 @playwright/mcp 連接 Arc 瀏覽器的 CDP port 9222。可操作瀏覽器分頁、截圖、讀取 Console。
                </div>
              </div>
              <div className="px-3 py-2 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>
                <div className="text-xs font-medium mb-1" style={{ color: '#a855f7' }}>bot-browser</div>
                <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  獨立 Playwright 實例（無 CDP endpoint）。用於不需要 Arc 的自動化場景。
                </div>
              </div>
            </div>
            <div className="text-sm" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-secondary)' }}>條件載入</strong>：<code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>mode === {"'edit'"}</code> 時不載入任何 MCP 伺服器，因為 Pack 流程只需要檔案操作，不需要瀏覽器。
            </div>
          </div>
        </div>

        {/* permissionMode */}
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
          <div className="flex items-center gap-2 px-4 py-2.5" style={{ backgroundColor: 'var(--background-secondary)' }}>
            <i className="fa-solid fa-shield-halved text-xs" style={{ color: '#ef4444' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>permissionMode</span>
          </div>
          <div className="px-4 py-3" style={{ backgroundColor: 'var(--background-primary)' }}>
            <div className="text-sm mb-2" style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              預設使用 <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>acceptEdits</code> — 允許檔案讀寫但需確認破壞性操作（如 git push --force）。
            </div>
            <div className="text-sm" style={{ color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Plan mode 的權限流轉</strong>：SDK 啟動時使用 plan mode，Claude 只能讀取和規劃。
              當用戶批准 ExitPlanMode 後，Answer API 呼叫 <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>q.setPermissionMode({'"acceptEdits"'})</code>，
              SDK 切換到 acceptEdits mode，Claude 才能開始實際修改檔案。這確保了「先審批再執行」的工作流。
            </div>
          </div>
        </div>
      </div>

      {/* Section 6: 相關檔案索引 */}
      <ChatDocSectionHeader title="相關檔案索引" />
      <div className="space-y-1.5 mb-6">
        {[
          { path: 'lib/claude-session-manager.ts', desc: 'Session Manager — query 工廠、canUseTool 阻塞、activeQueries / pendingRequests Map 管理' },
          { path: 'lib/claude-chat-types.ts', desc: '所有 Chat 相關 TypeScript 型別定義（ChatMessage、StreamingActivity、SessionMeta 等）' },
          { path: 'app/api/claude-chat/route.ts', desc: '主要 SSE 串流 API 端點 — projectId 解析、SDK message 轉發、client 斷線偵測' },
          { path: 'app/api/claude-chat/answer/route.ts', desc: '用戶回應 API — Plan 審批 / Question 回答、timing race 輪詢、permissionMode 切換' },
          { path: 'hooks/useClaudeChat.ts', desc: '前端 Chat Hook — 訊息狀態管理、SSE 解析引擎、sendMessage 編排器' },
          { path: 'components/ChatContent.tsx', desc: 'Chat UI 核心 — 訊息列表、textarea 輸入框、Plan/Question 互動覆蓋層' },
          { path: 'components/ClaudeChatPanel.tsx', desc: 'Chat Panel 容器 — 專案選擇器、模式 / 模型 / effort 切換按鈕' },
          { path: 'lib/chat-center-features.ts', desc: 'Chat 功能目錄資料 — CHAT_FEATURES 陣列 + 移植清單生成器' },
        ].map(item => (
          <div key={item.path} className="flex items-start gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--background-tertiary)' }}>
            <code className="text-xs font-mono shrink-0 mt-0.5" style={{ color: 'var(--primary-blue-light)' }}>{item.path}</code>
            <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{item.desc}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Blog Tab ──────────────────────────────────────────────────────

interface BlogNodeData {
  command: string
  label: string
  model?: string
  role?: string
  description?: string
  conditional?: string
}

const BLOG_PHASE_1: BlogNodeData = {
  command: '/blog-intake',
  label: 'blog-intake',
  model: 'opus',
  role: 'Bridge Skill',
  description: '收斂對話中的素材，整理成結構化素材包後啟動流水線',
}
const BLOG_PHASE_2_BEFORE: BlogNodeData[] = [
  { command: '/blog-outline-architect', label: 'outline-architect', model: 'opus',   role: '大綱架構師', description: '將靈感收斂為文章骨架' },
  { command: '/blog-pitfall-recorder',  label: 'pitfall-recorder',  model: 'sonnet', role: '踩坑記錄員', description: '補充技術坑點', conditional: '僅技術文' },
  { command: '/blog-beginner-reviewer', label: 'beginner-reviewer', model: 'sonnet', role: '小白審查員', description: '用初學者視角找出看不懂的地方' },
  { command: '/blog-visual-advisor',    label: 'visual-advisor',    model: 'sonnet', role: '視覺顧問',   description: '建議圖片、表格、callout 的位置' },
  { command: '/blog-professional-editor', label: 'professional-editor', model: 'sonnet', role: '專業編輯', description: '文字潤色、用詞統一、排版規範' },
]
const BLOG_PHASE_2_MIDPOINT: BlogNodeData = {
  command: '',
  label: '提前寫入 + 語意計算',
  role: '單向模式',
  description: '將文章以 draft 寫入 Insforge，觸發 bge-m3 embedding 計算（skipBidirectional），讓後續 Skill 能取得 ML 推薦',
}
const BLOG_PHASE_2_AFTER: BlogNodeData[] = [
  { command: '/blog-seo-specialist',    label: 'seo-specialist',    model: 'sonnet', role: 'SEO 專家',       description: '標題、關鍵詞、meta description、內鏈推薦（讀取語意索引）' },
  { command: '/blog-ai-quoter',         label: 'ai-quoter',         model: 'opus',   role: 'AI 引用優化師',  description: '讓文章更容易被 AI 搜尋引擎引用（讀取語意索引）' },
  { command: '/blog-engagement-designer', label: 'engagement-designer', model: 'sonnet', role: '互動設計師', description: 'CTA、延伸閱讀推薦（讀取語意索引）' },
]
const BLOG_PHASE_5: BlogNodeData = {
  command: '',
  label: '語意索引雙向更新',
  role: '發布後觸發',
  description: '完整雙向更新 — 讓其他文章的推薦清單也能「看見」這篇新文章',
}
const BLOG_UTILITIES: BlogNodeData[] = [
  { command: '/blog-articles',       label: 'blog-articles',       model: 'haiku', role: '站內文章查詢',  description: '被 SEO、AI 引用、互動設計等 Skill 引用' },
  { command: '/blog-pipeline-review', label: 'pipeline-review',   model: 'opus',  role: '流水線覆盤',   description: '手動觸發，檢討各 Skill 是否需要調整' },
]

function BlogVArrow({ dashed }: { dashed?: boolean }) {
  return (
    <div className="flex flex-col items-center" style={{ height: '28px', margin: '4px 0' }}>
      <div style={{ width: dashed ? 0 : 2, height: 16, borderLeft: dashed ? '2px dashed var(--text-tertiary)' : undefined, backgroundColor: dashed ? 'transparent' : 'var(--text-tertiary)' }} />
      <div style={{ width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderTop: '6px solid var(--text-tertiary)' }} />
    </div>
  )
}

function BlogSkillNode({ node, index, copy, isCopied }: { node: BlogNodeData; index?: number; copy: (text: string) => boolean; isCopied: (text: string) => boolean }) {
  const hasCmd = !!node.command
  const copied = hasCmd && isCopied(node.command)
  return (
    <div
      className={`rounded-lg transition-colors duration-150 ${hasCmd ? 'cursor-pointer hover:bg-white/5' : ''}`}
      style={{ backgroundColor: 'var(--background-tertiary)', border: copied ? '1px solid rgba(34,197,94,0.4)' : '1px solid var(--border-color)', padding: '10px 14px' }}
      onClick={hasCmd ? () => copy(node.command) : undefined}
      title={hasCmd ? '點擊複製指令' : undefined}
    >
      <div className="flex items-start gap-2">
        {typeof index === 'number' && (
          <span className="text-sm shrink-0 mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{String.fromCharCode(9312 + index)}</span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-mono" style={{ color: hasCmd ? 'var(--primary-blue-light)' : 'var(--text-primary)' }}>
                {hasCmd ? <>/{copied ? <span style={{ color: '#22c55e' }}>已複製</span> : node.label}</> : node.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {node.conditional && (
                <span className="text-sm px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                  {node.conditional}
                </span>
              )}
              {node.model && <ModelBadge model={node.model} />}
            </div>
          </div>
          {node.role && <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{node.role}</div>}
          {node.description && <div className="text-sm mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{node.description}</div>}
        </div>
      </div>
    </div>
  )
}

function BlogPhaseHeader({ phase, title }: { phase: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-sm font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>{phase}</span>
      <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>{title}</span>
    </div>
  )
}

function BlogStatusBadge({ label, color }: { label: string; color: 'green' | 'blue' }) {
  const colors = {
    green: { bg: 'rgba(34,197,94,0.1)',  fg: '#22c55e', border: 'rgba(34,197,94,0.2)' },
    blue:  { bg: 'rgba(59,130,246,0.1)', fg: '#3b82f6', border: 'rgba(59,130,246,0.2)' },
  }
  const c = colors[color]
  return (
    <span className="text-sm px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: c.bg, color: c.fg, border: `1px solid ${c.border}` }}>
      {label}
    </span>
  )
}

function BlogTab() {
  const { copy, isCopied } = useCopyToClipboard(1000)
  return (
    <div>
      <div className="flex items-center gap-5 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-5 h-[2px]" style={{ backgroundColor: 'var(--text-tertiary)' }} />
          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>依序執行</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-0" style={{ borderTop: '2px dashed var(--text-tertiary)' }} />
          <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>條件執行</span>
        </div>
      </div>

      {/* Phase 1 */}
      <BlogPhaseHeader phase="Phase 1" title="收斂討論" />
      <BlogSkillNode node={BLOG_PHASE_1} copy={copy} isCopied={isCopied} />
      <BlogVArrow />

      {/* Phase 2 */}
      <BlogPhaseHeader phase="Phase 2" title="流水線（依序執行）" />
      {BLOG_PHASE_2_BEFORE.map((node, i) => (
        <div key={node.command}>
          {i > 0 && <BlogVArrow dashed={node.conditional !== undefined} />}
          <BlogSkillNode node={node} index={i} copy={copy} isCopied={isCopied} />
        </div>
      ))}
      <BlogVArrow />

      {/* Midpoint */}
      <div className="rounded-lg px-4 py-3" style={{ border: '1px dashed rgba(168,85,247,0.4)', backgroundColor: 'rgba(168,85,247,0.04)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <i className="fa-sharp fa-regular fa-brain-circuit text-sm" style={{ color: '#a855f7' }} />
            <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{BLOG_PHASE_2_MIDPOINT.label}</span>
          </div>
          <span className="text-sm px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }}>
            bge-m3 模型
          </span>
        </div>
        <div className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>{BLOG_PHASE_2_MIDPOINT.description}</div>
      </div>
      <BlogVArrow />

      {BLOG_PHASE_2_AFTER.map((node, i) => (
        <div key={node.command}>
          {i > 0 && <BlogVArrow />}
          <BlogSkillNode node={node} index={BLOG_PHASE_2_BEFORE.length + i} copy={copy} isCopied={isCopied} />
          <div className="mt-1.5 ml-6 text-xs" style={{ color: 'var(--text-tertiary)', opacity: 0.6 }}>
            <i className="fa-sharp fa-regular fa-bookmark mr-1" style={{ color: '#a855f7' }} />
            讀取小紙條（Insforge `article_similarities` 表）
          </div>
        </div>
      ))}
      <BlogVArrow />

      {/* Phase 3 */}
      <BlogPhaseHeader phase="Phase 3" title="更新入庫" />
      <div className="rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--background-tertiary)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>Insforge DB</span>
          <BlogStatusBadge label="PATCH 更新" color="green" />
        </div>
        <div className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>將最終版內容 PATCH 更新到資料庫（文章已在流水線中提前寫入）</div>
      </div>
      <BlogVArrow dashed />

      {/* Phase 4 */}
      <BlogPhaseHeader phase="Phase 4" title="人工審閱" />
      <div className="rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--background-tertiary)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>BlogBackend</span>
          <BlogStatusBadge label="published" color="blue" />
        </div>
        <div className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>人工審閱、微調後發布</div>
        <div className="text-sm mt-0.5 font-mono" style={{ color: 'var(--text-tertiary)' }}>~/Documents/Brickverse/BlogBackend</div>
      </div>
      <BlogVArrow dashed />

      {/* Phase 5 */}
      <BlogPhaseHeader phase="Phase 5" title="語意索引雙向更新（發布後手動觸發）" />
      <div className="rounded-lg px-4 py-3" style={{ backgroundColor: 'var(--background-tertiary)', border: '1px dashed rgba(168,85,247,0.4)' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <i className="fa-sharp fa-regular fa-brain-circuit text-sm" style={{ color: '#a855f7' }} />
            <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{BLOG_PHASE_5.label}</span>
          </div>
          <span className="text-sm px-1.5 py-0.5 rounded shrink-0" style={{ backgroundColor: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }}>
            bge-m3 模型
          </span>
        </div>
        <div className="text-sm mt-1.5" style={{ color: 'var(--text-tertiary)' }}>{BLOG_PHASE_5.description}</div>
        <div className="text-sm mt-3 px-3 py-2 rounded" style={{ backgroundColor: 'rgba(168,85,247,0.06)', color: 'var(--text-secondary)' }}>
          <div className="flex items-center gap-1.5 mb-1">
            <i className="fa-sharp fa-regular fa-arrow-turn-up fa-rotate-180 text-xs" style={{ color: '#a855f7' }} />
            <span className="font-medium" style={{ color: '#a855f7' }}>回饋循環</span>
          </div>
          <div style={{ color: 'var(--text-tertiary)' }}>
            流水線中已做單向計算（新文章知道跟誰像）；發布後按「更新此篇」做雙向更新，讓其他文章也能推薦這篇
          </div>
        </div>
      </div>

      {/* Utilities */}
      <div className="mt-10 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
        <div className="text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>輔助工具</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {BLOG_UTILITIES.map(node => (
            <BlogSkillNode key={node.command} node={node} copy={copy} isCopied={isCopied} />
          ))}
        </div>
        <div className="text-sm font-mono px-4 py-2.5 rounded-lg mt-3" style={{ color: 'var(--text-tertiary)', border: '1px dashed var(--border-color)' }}>
          ⑥⑦⑧ 讀取流水線中提前計算的語意索引推薦相關文章，/blog-articles 作為補充
        </div>
      </div>
    </div>
  )
}

// ── Skills Tab ────────────────────────────────────────────────────

function SkillsTab() {
  return (
    <div>
      <SkillArchitecture />
    </div>
  )
}

// ── SDK Tab ───────────────────────────────────────────────────────

function SdkSectionHeader({ icon, color, title, subtitle }: { icon: string; color: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18`, border: `1px solid ${color}30` }}>
        <i className={`fa-solid ${icon} text-sm`} style={{ color }} />
      </div>
      <div>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{subtitle}</p>
      </div>
    </div>
  )
}

function SdkToolBadge({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <i className="fa-solid fa-circle-check text-xs mt-0.5 shrink-0" style={{ color: '#4ade80' }} />
      <span className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
        <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '1px 5px', borderRadius: '3px', fontSize: '12px', color: 'var(--text-primary)' }}>{name}</code>
        {' '}— {desc}
      </span>
    </div>
  )
}

function SdkCodeBlock({ code, lang = 'typescript' }: { code: string; lang?: string }) {
  return (
    <div className="rounded-xl overflow-hidden mt-3 mb-1" style={{ border: '1px solid var(--border-color)' }}>
      <div className="px-4 py-2 flex items-center gap-2" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }}>
        <i className="fa-solid fa-code text-xs" style={{ color: 'var(--text-tertiary)' }} />
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'ui-monospace, monospace' }}>{lang}</span>
      </div>
      <pre className="px-5 py-4 text-sm overflow-x-auto" style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--background-primary)', fontFamily: 'ui-monospace, SFMono-Regular, monospace', whiteSpace: 'pre', lineHeight: '1.7', margin: 0 }}>
        {code}
      </pre>
    </div>
  )
}

function SdkUsageList({ items }: { items: string[] }) {
  return (
    <div className="grid gap-1.5 mt-3">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-start">
          <i className="fa-solid fa-chevron-right text-xs mt-1 shrink-0" style={{ color: '#0184ff' }} />
          <span className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>{item}</span>
        </div>
      ))}
    </div>
  )
}

function SdkDivider() {
  return <div className="my-8" style={{ borderTop: '1px solid var(--border-color)' }} />
}

function SdkTab() {
  return (
    <div>
      {/* Overview */}
      <div className="rounded-xl px-5 py-4 mb-8" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-2 mb-3">
          <i className="fa-solid fa-robot text-sm" style={{ color: '#a78bfa' }} />
          <h1 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Claude Agent SDK</h1>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>前身 claude-code-sdk</span>
        </div>
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          Claude Agent SDK 提供了強大且直觀的基礎功能，讓你幾行程式碼就能做出能「自己動手」的 AI 代理。
          它把 Claude Code CLI binary 打包在裡面，呼叫 <code style={{ backgroundColor: 'var(--background-tertiary)', padding: '1px 4px', borderRadius: '3px', fontSize: '12px' }}>query()</code> 時會在背景 spawn 一個 subprocess 去執行。
        </p>
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[
            { icon: 'fa-file-lines', color: '#3b82f6', label: '讀寫檔案' },
            { icon: 'fa-terminal',   color: '#f97316', label: '執行指令' },
            { icon: 'fa-globe',      color: '#4ade80', label: '搜尋網路' },
          ].map(({ icon, color, label }) => (
            <div key={label} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: `${color}10`, border: `1px solid ${color}25` }}>
              <i className={`fa-solid ${icon} text-xs`} style={{ color }} />
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section 1 */}
      <SdkSectionHeader icon="fa-magnifying-glass" color="#3b82f6" title="1. 檔案讀取與搜尋" subtitle="讓 Claude 能看到你專案裡的檔案內容，自動分析程式碼、文件、設定檔等。最基礎的起手式。" />
      <div className="grid gap-2">
        <SdkToolBadge name="Read" desc="讀取指定檔案全部或部分內容" />
        <SdkToolBadge name="Glob" desc="用模式匹配找檔案（例如 **/*.py 或 src/**/*.ts）" />
        <SdkToolBadge name="Grep" desc="用正則表達式在檔案內容中搜尋關鍵字" />
      </div>
      <SdkCodeBlock lang="typescript" code={`import { query } from '@anthropic-ai/claude-agent-sdk'

for await (const msg of query({
  prompt: '找出專案裡所有用到 deprecated API 的地方',
  options: { allowedTools: ['Read', 'Glob', 'Grep'] }
})) {
  process.stdout.write(msg.type === 'text' ? msg.text : '')
}`} />
      <SdkUsageList items={['幫我找出專案裡所有用到 deprecated API 的地方', '讀取 README.md 並總結專案功能', '搜尋所有 TODO 留言並列表顯示']} />

      <SdkDivider />

      {/* Section 2 */}
      <SdkSectionHeader icon="fa-pen-to-square" color="#f97316" title="2. 寫入與編輯檔案" subtitle="寫程式、修 bug、產生新檔案時最常用的功能。支援精準的行號級修改。" />
      <div className="grid gap-2">
        <SdkToolBadge name="Write" desc="建立新檔案（包含完整內容）" />
        <SdkToolBadge name="Edit"  desc="對現有檔案做精準修改（支援替換、插入，不覆蓋整個檔案）" />
      </div>
      <SdkCodeBlock lang="typescript" code={`for await (const msg of query({
  prompt: '在 main.ts 裡新增一個 validateEmail() function，並加上 unit test',
  options: { allowedTools: ['Read', 'Write', 'Edit'] }
})) { /* handle stream */ }`} />
      <SdkUsageList items={['在 main.py 裡新增一個 function，並補上文件字串', '把所有 console.log 改成 logger.debug', '根據現有格式產生一個新的 requirements.txt']} />

      <SdkDivider />

      {/* Section 3 */}
      <SdkSectionHeader icon="fa-terminal" color="#fbbf24" title="3. 執行終端機指令" subtitle="給代理「完整電腦」的能力——git commit、安裝套件、跑測試、build 專案，全都行。" />
      <div className="grid gap-2">
        <SdkToolBadge name="Bash" desc="執行任意 shell 指令，並取得輸出結果" />
      </div>
      <SdkCodeBlock lang="typescript" code={`for await (const msg of query({
  prompt: '跑 npm test，找出失敗的測試並修復',
  options: { allowedTools: ['Read', 'Edit', 'Bash'] }
})) { /* handle stream */ }`} />
      <SdkUsageList items={['git status 看看有什麼變更，然後幫我整理 commit message', '跑 npm test 並告訴我哪裡失敗', '安裝 package 並確認 package.json 已更新']} />
      <div className="rounded-xl px-4 py-3 mt-3" style={{ backgroundColor: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
        <p className="text-xs font-semibold mb-1" style={{ color: '#fbbf24' }}>
          <i className="fa-solid fa-triangle-exclamation mr-1.5" />注意
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          Bash 工具功能強大，建議搭配 <code style={{ fontSize: '12px', backgroundColor: 'var(--background-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>allowedTools</code> 明確限制可用工具範圍，避免代理執行非預期的系統指令。
        </p>
      </div>

      <SdkDivider />

      {/* Section 4 */}
      <SdkSectionHeader icon="fa-globe" color="#4ade80" title="4. 網頁搜尋與內容擷取" subtitle="讓代理能查最新資料、讀文章、彙整報告。非 coding 任務超常用的功能組合。" />
      <div className="grid gap-2">
        <SdkToolBadge name="WebSearch" desc="搜尋網路最新資訊（搜尋引擎結果）" />
        <SdkToolBadge name="WebFetch"  desc="抓取並解析特定網頁的完整內容" />
      </div>
      <SdkCodeBlock lang="typescript" code={`for await (const msg of query({
  prompt: 'React 19 有哪些新功能？幫我整理成 markdown 報告並存到 react19-notes.md',
  options: { allowedTools: ['WebSearch', 'WebFetch', 'Write'] }
})) { /* handle stream */ }`} />
      <SdkUsageList items={['查最新的比特幣價格並整理成報表', '找 React 19 的新功能並總結成 markdown', '研究型代理：自動搜尋 → 讀文章 → 彙整報告']} />

      <SdkDivider />

      {/* Section 5 */}
      <SdkSectionHeader icon="fa-rotate" color="#a78bfa" title="5. Agent Loop（核心執行機制）" subtitle="query() 內建的自動循環：思考 → 用工具 → 看結果 → 再思考 → 直到完成。你只需要發 prompt。" />
      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>最簡單的 Hello World 範例（TypeScript）——Claude 會自己決定用什麼工具：</p>
      <SdkCodeBlock lang="typescript" code={`import { query } from '@anthropic-ai/claude-agent-sdk'

// 最基本的用法：只給 prompt，讓 Claude 自己決定工具
for await (const message of query({
  prompt: '列出目前資料夾的所有 TypeScript 檔案，並統計行數',
})) {
  if (message.type === 'assistant') {
    for (const block of message.message.content) {
      if (block.type === 'text') process.stdout.write(block.text)
    }
  }
}`} />
      <p className="text-sm mt-4 mb-2" style={{ color: 'var(--text-secondary)' }}>進階：限制工具範圍 + 串流顯示</p>
      <SdkCodeBlock lang="typescript" code={`import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'

async function runAgent(prompt: string) {
  const messages: SDKMessage[] = []

  for await (const msg of query({
    prompt,
    options: {
      allowedTools: ['Read', 'Glob', 'Edit', 'Bash'],
      permissionMode: 'acceptEdits',   // 自動接受所有檔案修改
      model: 'claude-sonnet-4-6',
    },
  })) {
    messages.push(msg)
    // 即時顯示 Claude 的思考過程
    if (msg.type === 'assistant') {
      for (const block of msg.message.content) {
        if (block.type === 'text') process.stdout.write(block.text)
      }
    }
  }

  return messages
}`} />

      <SdkDivider />

      {/* Section 6 */}
      <SdkSectionHeader icon="fa-layer-group" color="#0184ff" title="6. 常見組合應用" subtitle="這些是最高頻使用的代理模式，開箱即用，不需要自己寫 tool calling 邏輯。" />
      <div className="grid gap-3">
        {[
          { title: 'Bug 修復代理',    icon: 'fa-bug',            color: '#ef4444', desc: '讀取錯誤 log → 找相關檔案 → 提出修改 → 跑測試驗證',        tools: 'Read, Glob, Edit, Bash' },
          { title: '程式碼重構代理',  icon: 'fa-arrows-rotate',  color: '#f97316', desc: 'Glob 找所有相關檔案 → 逐一 Edit → 確保格式一致',           tools: 'Read, Glob, Edit' },
          { title: '研究 / 報告代理', icon: 'fa-file-lines',     color: '#4ade80', desc: 'WebSearch + WebFetch → 總結成 markdown → Write 成檔案',   tools: 'WebSearch, WebFetch, Write' },
          { title: '自動 commit 代理', icon: 'fa-code-branch',   color: '#a78bfa', desc: '讀取 git diff → 分析變更 → 產生 commit message → git commit', tools: 'Read, Bash' },
        ].map(({ title, icon, color, desc, tools }) => (
          <div key={title} className="rounded-xl px-4 py-3.5 flex gap-3 items-start" style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}>
            <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5" style={{ backgroundColor: `${color}15`, border: `1px solid ${color}25` }}>
              <i className={`fa-solid ${icon} text-xs`} style={{ color }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{title}</p>
              <p className="text-sm mb-1.5" style={{ color: 'var(--text-secondary)', lineHeight: '1.5' }}>{desc}</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                <i className="fa-solid fa-wrench mr-1" />
                工具：<code style={{ fontSize: '11px' }}>{tools}</code>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Changelog Tab ─────────────────────────────────────────────────

interface ChangelogEntry {
  version: string
  summary: string
  hash: string
  date: string
  type: 'release' | 'commit'
}

function ChangelogTab() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/changelog')
      .then(r => r.json())
      .then(data => { setEntries(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div>
      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--text-tertiary)' }}>載入中...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-16" style={{ color: 'var(--text-tertiary)' }}>尚無 release 記錄</div>
      ) : (
        <div className="relative ml-16">
          <div className="absolute left-[7px] top-3 bottom-3" style={{ width: 2, backgroundColor: 'var(--border-color)' }} />
          <div className="space-y-0">
            {(() => {
              const currentDevVersion = versionConfig.development
              const latestReleaseVersion = entries.find(e => e.type === 'release')?.version?.replace(/^v/, '')
              const devVersionNumber = currentDevVersion.replace(/-dev$/, '')
              const isVersionGreater = (a: string, b: string): boolean => {
                const aParts = a.split('.').map(Number)
                const bParts = b.split('.').map(Number)
                for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                  const aPart = aParts[i] || 0
                  const bPart = bParts[i] || 0
                  if (aPart > bPart) return true
                  if (aPart < bPart) return false
                }
                return false
              }
              if (latestReleaseVersion && isVersionGreater(devVersionNumber, latestReleaseVersion)) {
                return (
                  <div className="relative pl-8 pb-8">
                    <div className="absolute -left-16 top-0">
                      <span className="text-xs px-1.5 py-0.5 rounded whitespace-nowrap" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>DEV</span>
                    </div>
                    <div className="absolute left-0 top-1.5 w-4 h-4">
                      <div className="absolute inset-0 rounded-full animate-ping" style={{ backgroundColor: '#4ade80', opacity: 0.3 }} />
                      <div className="absolute inset-0 rounded-full" style={{ backgroundColor: '#22c55e', border: '2px solid #16a34a' }} />
                    </div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-lg font-bold shrink-0" style={{ color: '#4ade80' }}>v{devVersionNumber}</span>
                      <span className="text-sm shrink-0 whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>開發中</span>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>{currentDevVersion}</span>
                    </div>
                    <p className="text-base" style={{ color: 'var(--text-secondary)' }}>尚未發布的開發版本</p>
                  </div>
                )
              }
              return null
            })()}

            {entries.map((entry, i) => {
              const isRelease = entry.type === 'release'
              const isFirst = i === 0
              return (
                <div key={entry.hash} className={`relative pl-8 ${isRelease ? 'pb-8' : 'pb-4'}`}>
                  {isRelease && (() => {
                    const ver = entry.version.replace(/^v/, '')
                    const isProd = ver === versionConfig.production
                    const isDev  = ver === versionConfig.development.replace(/-dev$/, '')
                    if (!isProd && !isDev) return null
                    return (
                      <div className="absolute -left-16 top-0 flex flex-col gap-1">
                        {isProd && <span className="text-xs px-1.5 py-0.5 rounded whitespace-nowrap" style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>PROD</span>}
                        {isDev  && <span className="text-xs px-1.5 py-0.5 rounded whitespace-nowrap" style={{ backgroundColor: 'rgba(34,197,94,0.15)',  color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}>DEV</span>}
                      </div>
                    )
                  })()}
                  <div
                    className={`absolute left-0 ${isRelease ? 'top-1.5 w-4 h-4' : 'top-1.5 w-3 h-3 ml-0.5'} rounded-full`}
                    style={isRelease
                      ? { backgroundColor: isFirst ? '#a78bfa' : '#7c3aed', border: isFirst ? '2px solid #7c3aed' : '2px solid #6d28d9' }
                      : { backgroundColor: '#333333', border: '2px solid #444444' }
                    }
                  />
                  {isRelease ? (
                    <>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-lg font-bold shrink-0" style={{ color: isFirst ? '#a78bfa' : '#c4b5fd' }}>{entry.version}</span>
                        <span className="text-sm shrink-0 whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>{entry.date}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0" style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)' }}>{entry.hash}</span>
                      </div>
                      {entry.summary && <p className="text-base" style={{ color: 'var(--text-secondary)' }}>{entry.summary}</p>}
                    </>
                  ) : (
                    <div className="grid items-start gap-x-2" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
                      <span className="text-xs px-1.5 py-0.5 rounded font-mono whitespace-nowrap" style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)' }}>{entry.hash}</span>
                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.summary}</span>
                      <span className="text-xs whitespace-nowrap pt-0.5" style={{ color: 'var(--text-tertiary)' }}>{entry.date}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeTab, setActiveTab] = useState('tech-stack')
  const mainRef = useRef<HTMLElement>(null)

  const TAB_IDS = TABS.map(t => t.id)
  const currentIndex = TAB_IDS.indexOf(activeTab)
  const prevTab = currentIndex > 0 ? TABS[currentIndex - 1] : null
  const nextTab = currentIndex < TABS.length - 1 ? TABS[currentIndex + 1] : null

  const navigate = (id: string) => {
    setActiveTab(id)
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div style={{ backgroundColor: 'var(--background-primary)', color: 'var(--text-primary)', height: '100vh', display: 'flex' }}>

      {/* Left: fixed nav sidebar */}
      <nav
        style={{
          width: 220,
          flexShrink: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--background-secondary)',
          borderRight: '1px solid var(--border-color)',
          overflowY: 'auto',
        }}
      >

        {/* Grouped tab list */}
        <div style={{ padding: '0 8px 16px', flex: 1 }}>
          {TAB_GROUPS.map((group) => (
            <div key={group.letter}>
              {/* Group header */}
              <div
                className="flex items-center gap-2 px-3 mt-3 mb-1"
                style={{ paddingTop: group.letter === 'A' ? 12 : 4 }}
              >
                <i className={`fa-solid ${group.icon}`} style={{ fontSize: 9, color: 'var(--text-tertiary)', opacity: 0.7 }} />
                <span style={{ fontSize: 10, letterSpacing: '0.06em', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                  {group.letter}. {group.group}
                </span>
              </div>
              {/* Tabs in group */}
              {group.tabs.map((tab, i) => {
                const isActive = activeTab === tab.id
                const code = `${group.letter}${i + 1}`
                return (
                  <button
                    key={tab.id}
                    onClick={() => navigate(tab.id)}
                    className="flex items-center gap-2.5 w-full text-left px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors duration-150 mb-0.5"
                    style={{
                      backgroundColor: isActive ? 'var(--background-primary)' : 'transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
                      border: isActive ? '1px solid var(--border-color)' : '1px solid transparent',
                      fontWeight: isActive ? 500 : 400,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        fontFamily: 'ui-monospace, monospace',
                        color: isActive ? '#0184ff' : 'var(--text-tertiary)',
                        width: 28,
                        flexShrink: 0,
                        letterSpacing: '0.02em',
                      }}
                    >
                      {code}
                    </span>
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </nav>

      {/* Center: scrollable documentation content */}
      <main ref={mainRef} className="flex-1 overflow-y-auto" style={{ minWidth: 0 }}>
        <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '32px 48px 0' }}>
          {activeTab === 'tech-stack'   && <TechStackTab />}
          {activeTab === 'model-choice' && <ModelChoiceTab />}
          {activeTab === 'settings'     && <SettingsTab />}
          {activeTab === 'permissions'  && <PermissionsTab />}
          {activeTab === 'claude-md'    && <ClaudeMdTab />}
          {activeTab === 'memory'       && <MemoryTab />}
          {activeTab === 'mcp'          && <McpTab />}
          {activeTab === 'env-compare'  && <EnvCompareTab />}
          {activeTab === 'cli-vs-sdk'   && <CliVsSdkTab />}
          {activeTab === 'arc-cdp'      && <ArcCdpTab />}
          {activeTab === 'gaps'         && <GapsTab />}
          {activeTab === 'chat'         && <ChatTab />}
          {activeTab === 'chat-doc'     && <ChatDocTab />}
          {activeTab === 'blog'         && <BlogTab />}
          {activeTab === 'skills'       && <SkillsTab />}
          {activeTab === 'sdk'          && <SdkTab />}
          {activeTab === 'changelog'    && <ChangelogTab />}
        </div>

        {/* Prev / Next navigation */}
        <div
          className="flex items-center justify-between"
          style={{ maxWidth: '72rem', margin: '0 auto', padding: '32px 48px 48px', marginTop: 8, borderTop: '1px solid var(--border-color)' }}
        >
          {prevTab ? (
            <button
              onClick={() => navigate(prevTab.id)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-150 group"
              style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#0184ff33'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
            >
              <i className="fa-solid fa-arrow-left text-xs" style={{ color: '#0184ff' }} />
              <div className="text-left">
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>上一章</div>
                <div className="text-sm font-medium">{prevTab.label}</div>
              </div>
            </button>
          ) : <div />}

          {nextTab ? (
            <button
              onClick={() => navigate(nextTab.id)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-150"
              style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#0184ff33'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-color)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)' }}
            >
              <div className="text-right">
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>下一章</div>
                <div className="text-sm font-medium">{nextTab.label}</div>
              </div>
              <i className="fa-solid fa-arrow-right text-xs" style={{ color: '#0184ff' }} />
            </button>
          ) : <div />}
        </div>
      </main>

    </div>
  )
}
