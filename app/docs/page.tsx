'use client'

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

function SectionTable({ section }: { section: DocSection }) {
  return (
    <div
      className="rounded-xl overflow-hidden mb-4"
      style={{ border: '1px solid var(--border-color)' }}
    >
      <div
        className="px-4 py-2.5 text-sm font-semibold"
        style={{
          backgroundColor: 'var(--background-secondary)',
          borderBottom: '1px solid var(--border-color)',
          color: 'var(--text-secondary)',
        }}
      >
        {section.title}
      </div>
      <div style={{ backgroundColor: 'var(--background-primary)' }}>
        {section.items.map((item, i) => (
          <div
            key={i}
            className="grid grid-cols-[140px_1fr_1fr] gap-0"
            style={{
              borderBottom: i < section.items.length - 1 ? '1px solid var(--border-color)' : undefined,
            }}
          >
            <div
              className="px-4 py-3 text-xs font-medium"
              style={{
                color: 'var(--text-tertiary)',
                borderRight: '1px solid var(--border-color)',
                backgroundColor: 'var(--background-secondary)',
              }}
            >
              {item.label}
            </div>
            <div
              className="px-4 py-3 text-xs"
              style={{
                color: 'var(--text-primary)',
                borderRight: '1px solid var(--border-color)',
              }}
            >
              {item.cursor}
            </div>
            <div
              className="px-4 py-3 text-xs"
              style={{ color: 'var(--text-primary)' }}
            >
              {item.sdk}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DocsPage() {
  return (
    <SubpageShell title="技術文件">
      <div className="px-6 py-6 max-w-4xl mx-auto">

        {/* 標題說明 */}
        <div
          className="rounded-xl px-5 py-4 mb-6"
          style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}
        >
          <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
            Claude Code Extension vs Dashboard SDK
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            兩個環境跑的是同一個 Claude Code 執行檔，但啟動方式不同。
            Extension 透過 <code className="px-1 py-0.5 rounded text-xs" style={{ backgroundColor: 'var(--background-tertiary)' }}>claude-vscode</code> SDK bridge 幫你注入工具；
            SDK 直接雇人，工頭的工具他拿不到，要自己帶。
          </p>
        </div>

        {/* 欄位標題 */}
        <div
          className="grid grid-cols-[140px_1fr_1fr] gap-0 mb-2 px-0"
        >
          <div className="px-4 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }} />
          <div className="px-4 text-xs font-semibold" style={{ color: '#3b82f6' }}>
            Claude Code Extension（Cursor）
          </div>
          <div className="px-4 text-xs font-semibold" style={{ color: '#f97316' }}>
            Dashboard Chat SDK
          </div>
        </div>

        {sections.map((s, i) => (
          <SectionTable key={i} section={s} />
        ))}

        {/* 優劣勢比較 */}
        <div className="grid grid-cols-2 gap-4 mt-6 mb-4">
          {/* Extension 優勢 */}
          <div
            className="rounded-xl px-5 py-4"
            style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#3b82f6' }}>
              Extension 優勢
            </h3>
            <ul className="text-xs space-y-2" style={{ color: 'var(--text-secondary)' }}>
              <li><span style={{ color: '#3b82f6' }}>+</span> MCP 工具開箱即用，無需手動配置</li>
              <li><span style={{ color: '#3b82f6' }}>+</span> 感知 IDE 上下文（選取程式碼、開啟檔案）</li>
              <li><span style={{ color: '#3b82f6' }}>+</span> MCP server 常駐，無冷啟動延遲</li>
              <li><span style={{ color: '#3b82f6' }}>+</span> Cursor UI 整合（inline diff、terminal）</li>
            </ul>
          </div>

          {/* Extension 劣勢 */}
          <div
            className="rounded-xl px-5 py-4"
            style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#ef4444' }}>
              Extension 劣勢
            </h3>
            <ul className="text-xs space-y-2" style={{ color: 'var(--text-secondary)' }}>
              <li><span style={{ color: '#ef4444' }}>−</span> 無法自訂 system prompt</li>
              <li><span style={{ color: '#ef4444' }}>−</span> 無法攔截工具呼叫（canUseTool）</li>
              <li><span style={{ color: '#ef4444' }}>−</span> 無法程式化控制 session 生命週期</li>
              <li><span style={{ color: '#ef4444' }}>−</span> 無法串流整合進自己的 UI</li>
            </ul>
          </div>

          {/* SDK 優勢 */}
          <div
            className="rounded-xl px-5 py-4"
            style={{ backgroundColor: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#4ade80' }}>
              Dashboard SDK 優勢
            </h3>
            <ul className="text-xs space-y-2" style={{ color: 'var(--text-secondary)' }}>
              <li><span style={{ color: '#4ade80' }}>+</span> 完全控制 system prompt 與 session</li>
              <li><span style={{ color: '#4ade80' }}>+</span> canUseTool 攔截器（AskUserQuestion / ExitPlanMode）</li>
              <li><span style={{ color: '#4ade80' }}>+</span> SSE 串流整合進 Dashboard UI</li>
              <li><span style={{ color: '#4ade80' }}>+</span> 可同時對多個專案開啟獨立 session</li>
              <li><span style={{ color: '#4ade80' }}>+</span> 不依賴 IDE，可自動化、背景執行</li>
            </ul>
          </div>

          {/* SDK 劣勢 */}
          <div
            className="rounded-xl px-5 py-4"
            style={{ backgroundColor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.2)' }}
          >
            <h3 className="text-sm font-semibold mb-3" style={{ color: '#fbbf24' }}>
              Dashboard SDK 劣勢
            </h3>
            <ul className="text-xs space-y-2" style={{ color: 'var(--text-secondary)' }}>
              <li><span style={{ color: '#fbbf24' }}>−</span> MCP 工具需手動維護，不自動同步</li>
              <li><span style={{ color: '#fbbf24' }}>−</span> 無 IDE 感知（選取程式碼、開啟檔案）</li>
              <li><span style={{ color: '#fbbf24' }}>−</span> 每個 session spawn MCP，冷啟動慢</li>
              <li><span style={{ color: '#fbbf24' }}>−</span> settingSources 載入 MCP 不可靠</li>
            </ul>
          </div>
        </div>

        {/* 已修復 */}
        <div
          className="rounded-xl px-5 py-4 mt-6"
          style={{ backgroundColor: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)' }}
        >
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
    </SubpageShell>
  )
}
