'use client'

import SubpageShell from '@/components/SubpageShell'

function SectionHeader({ icon, color, title, subtitle }: {
  icon: string
  color: string
  title: string
  subtitle: string
}) {
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

function ToolBadge({ name, desc }: { name: string; desc: string }) {
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

function CodeBlock({ code, lang = 'typescript' }: { code: string; lang?: string }) {
  return (
    <div className="rounded-xl overflow-hidden mt-3 mb-1" style={{ border: '1px solid var(--border-color)' }}>
      <div className="px-4 py-2 flex items-center gap-2" style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }}>
        <i className="fa-solid fa-code text-xs" style={{ color: 'var(--text-tertiary)' }} />
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontFamily: 'ui-monospace, monospace' }}>{lang}</span>
      </div>
      <pre className="px-5 py-4 text-sm overflow-x-auto" style={{
        color: 'var(--text-secondary)',
        backgroundColor: 'var(--background-primary)',
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        whiteSpace: 'pre',
        lineHeight: '1.7',
        margin: 0,
      }}>
        {code}
      </pre>
    </div>
  )
}

function UsageList({ items }: { items: string[] }) {
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

function Divider() {
  return <div className="my-8" style={{ borderTop: '1px solid var(--border-color)' }} />
}

export default function AgentSdkPage() {
  return (
    <SubpageShell title="Agent SDK 入門">
      <div className="max-w-2xl mx-auto px-6 py-8">

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
              { icon: 'fa-terminal', color: '#f97316', label: '執行指令' },
              { icon: 'fa-globe', color: '#4ade80', label: '搜尋網路' },
            ].map(({ icon, color, label }) => (
              <div key={label} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: `${color}10`, border: `1px solid ${color}25` }}>
                <i className={`fa-solid ${icon} text-xs`} style={{ color }} />
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Section 1: File read */}
        <SectionHeader
          icon="fa-magnifying-glass"
          color="#3b82f6"
          title="1. 檔案讀取與搜尋"
          subtitle="讓 Claude 能看到你專案裡的檔案內容，自動分析程式碼、文件、設定檔等。最基礎的起手式。"
        />
        <div className="grid gap-2">
          <ToolBadge name="Read" desc="讀取指定檔案全部或部分內容" />
          <ToolBadge name="Glob" desc="用模式匹配找檔案（例如 **/*.py 或 src/**/*.ts）" />
          <ToolBadge name="Grep" desc="用正則表達式在檔案內容中搜尋關鍵字" />
        </div>
        <CodeBlock lang="typescript" code={`import { query } from '@anthropic-ai/claude-agent-sdk'

for await (const msg of query({
  prompt: '找出專案裡所有用到 deprecated API 的地方',
  options: { allowedTools: ['Read', 'Glob', 'Grep'] }
})) {
  process.stdout.write(msg.type === 'text' ? msg.text : '')
}`} />
        <UsageList items={[
          '幫我找出專案裡所有用到 deprecated API 的地方',
          '讀取 README.md 並總結專案功能',
          '搜尋所有 TODO 留言並列表顯示',
        ]} />

        <Divider />

        {/* Section 2: Write/Edit */}
        <SectionHeader
          icon="fa-pen-to-square"
          color="#f97316"
          title="2. 寫入與編輯檔案"
          subtitle="寫程式、修 bug、產生新檔案時最常用的功能。支援精準的行號級修改。"
        />
        <div className="grid gap-2">
          <ToolBadge name="Write" desc="建立新檔案（包含完整內容）" />
          <ToolBadge name="Edit" desc="對現有檔案做精準修改（支援替換、插入，不覆蓋整個檔案）" />
        </div>
        <CodeBlock lang="typescript" code={`for await (const msg of query({
  prompt: '在 main.ts 裡新增一個 validateEmail() function，並加上 unit test',
  options: { allowedTools: ['Read', 'Write', 'Edit'] }
})) { /* handle stream */ }`} />
        <UsageList items={[
          '在 main.py 裡新增一個 function，並補上文件字串',
          '把所有 console.log 改成 logger.debug',
          '根據現有格式產生一個新的 requirements.txt',
        ]} />

        <Divider />

        {/* Section 3: Bash */}
        <SectionHeader
          icon="fa-terminal"
          color="#fbbf24"
          title="3. 執行終端機指令"
          subtitle="給代理「完整電腦」的能力——git commit、安裝套件、跑測試、build 專案，全都行。"
        />
        <div className="grid gap-2">
          <ToolBadge name="Bash" desc="執行任意 shell 指令，並取得輸出結果" />
        </div>
        <CodeBlock lang="typescript" code={`for await (const msg of query({
  prompt: '跑 npm test，找出失敗的測試並修復',
  options: { allowedTools: ['Read', 'Edit', 'Bash'] }
})) { /* handle stream */ }`} />
        <UsageList items={[
          'git status 看看有什麼變更，然後幫我整理 commit message',
          '跑 npm test 並告訴我哪裡失敗',
          '安裝 package 並確認 package.json 已更新',
        ]} />
        <div className="rounded-xl px-4 py-3 mt-3" style={{ backgroundColor: 'rgba(251,191,36,0.07)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <p className="text-xs font-semibold mb-1" style={{ color: '#fbbf24' }}>
            <i className="fa-solid fa-triangle-exclamation mr-1.5" />注意
          </p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
            Bash 工具功能強大，建議搭配 <code style={{ fontSize: '12px', backgroundColor: 'var(--background-tertiary)', padding: '1px 4px', borderRadius: '3px' }}>allowedTools</code> 明確限制可用工具範圍，避免代理執行非預期的系統指令。
          </p>
        </div>

        <Divider />

        {/* Section 4: Web */}
        <SectionHeader
          icon="fa-globe"
          color="#4ade80"
          title="4. 網頁搜尋與內容擷取"
          subtitle="讓代理能查最新資料、讀文章、彙整報告。非 coding 任務超常用的功能組合。"
        />
        <div className="grid gap-2">
          <ToolBadge name="WebSearch" desc="搜尋網路最新資訊（搜尋引擎結果）" />
          <ToolBadge name="WebFetch" desc="抓取並解析特定網頁的完整內容" />
        </div>
        <CodeBlock lang="typescript" code={`for await (const msg of query({
  prompt: 'React 19 有哪些新功能？幫我整理成 markdown 報告並存到 react19-notes.md',
  options: { allowedTools: ['WebSearch', 'WebFetch', 'Write'] }
})) { /* handle stream */ }`} />
        <UsageList items={[
          '查最新的比特幣價格並整理成報表',
          '找 React 19 的新功能並總結成 markdown',
          '研究型代理：自動搜尋 → 讀文章 → 彙整報告',
        ]} />

        <Divider />

        {/* Section 5: Agent Loop */}
        <SectionHeader
          icon="fa-rotate"
          color="#a78bfa"
          title="5. Agent Loop（核心執行機制）"
          subtitle="query() 內建的自動循環：思考 → 用工具 → 看結果 → 再思考 → 直到完成。你只需要發 prompt。"
        />
        <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          最簡單的 Hello World 範例（TypeScript）——Claude 會自己決定用什麼工具：
        </p>
        <CodeBlock lang="typescript" code={`import { query } from '@anthropic-ai/claude-agent-sdk'

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
        <CodeBlock lang="typescript" code={`import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk'

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

        <Divider />

        {/* Section 6: Patterns */}
        <SectionHeader
          icon="fa-layer-group"
          color="#0184ff"
          title="6. 常見組合應用"
          subtitle="這些是最高頻使用的代理模式，開箱即用，不需要自己寫 tool calling 邏輯。"
        />

        <div className="grid gap-3">
          {[
            {
              title: 'Bug 修復代理',
              icon: 'fa-bug',
              color: '#ef4444',
              desc: '讀取錯誤 log → 找相關檔案 → 提出修改 → 跑測試驗證',
              tools: 'Read, Glob, Edit, Bash',
            },
            {
              title: '程式碼重構代理',
              icon: 'fa-arrows-rotate',
              color: '#f97316',
              desc: 'Glob 找所有相關檔案 → 逐一 Edit → 確保格式一致',
              tools: 'Read, Glob, Edit',
            },
            {
              title: '研究 / 報告代理',
              icon: 'fa-file-lines',
              color: '#4ade80',
              desc: 'WebSearch + WebFetch → 總結成 markdown → Write 成檔案',
              tools: 'WebSearch, WebFetch, Write',
            },
            {
              title: '自動 commit 代理',
              icon: 'fa-code-branch',
              color: '#a78bfa',
              desc: '讀取 git diff → 分析變更 → 產生 commit message → git commit',
              tools: 'Read, Bash',
            },
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

        <Divider />

        {/* Footer: back to docs */}
        <div className="rounded-xl px-5 py-4" style={{ backgroundColor: 'rgba(1,132,255,0.06)', border: '1px solid rgba(1,132,255,0.2)' }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: '#0184ff' }}>
                <i className="fa-solid fa-book mr-2" />深入了解架構
              </p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>了解 CLI 與 SDK 的關係、query() 的運作方式、為何 Max 訂閱直接可用</p>
            </div>
            <a href="/docs" className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium shrink-0" style={{ backgroundColor: 'var(--background-secondary)', color: '#0184ff', textDecoration: 'none', border: '1px solid rgba(1,132,255,0.3)' }}>
              技術文件
              <i className="fa-solid fa-arrow-right text-xs" />
            </a>
          </div>
        </div>

      </div>
    </SubpageShell>
  )
}
