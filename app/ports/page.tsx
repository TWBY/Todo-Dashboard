'use client'

import { useState, useEffect } from 'react'
import ChatContent from '@/components/ChatContent'
import SubpageShell from '@/components/SubpageShell'
import type { Project } from '@/lib/types'

type Source = 'brickverse' | 'coursefiles' | 'utility'
type PkgStatus = 'correct' | 'missing-port' | 'wrong-port' | 'no-file'
type ClaudeStatus = 'registered' | 'no-port' | 'wrong-port' | 'no-file'

interface PortEntry {
  projectId: string
  port: number
  isRunning: boolean
  projectPath?: string
  source?: Source
  devBasePath?: string
}

interface AuditEntry {
  name: string
  port: number
  path: string
  source: Source
  packageJson: PkgStatus
  packageJsonDetail?: string
  localClaude: ClaudeStatus
  localClaudePath?: string
  localClaudeDetail?: string
}

interface AuditStats {
  total: number
  packageJsonOk: number
  localClaudeOk: number
  fullyRegistered: number
}

const SOURCE_LABELS: Record<Source, string> = {
  brickverse: 'Brickverse',
  coursefiles: 'CourseFiles',
  utility: 'Utility',
}

const SOURCE_COLORS: Record<Source, { bg: string; fg: string; border: string }> = {
  brickverse: { bg: 'rgba(59,130,246,0.1)', fg: '#3b82f6', border: 'rgba(59,130,246,0.15)' },
  coursefiles: { bg: 'rgba(249,115,22,0.1)', fg: '#f97316', border: 'rgba(249,115,22,0.15)' },
  utility: { bg: 'rgba(168,85,247,0.1)', fg: '#a855f7', border: 'rgba(168,85,247,0.15)' },
}

const PRODUCTION_ENTRY: PortEntry = {
  projectId: 'dashboard-production',
  port: 4000,
  isRunning: false,
  projectPath: '/Users/ruanbaiye/Documents/Brickverse/Todo-Dashboard',
  source: 'brickverse',
}

function getDisplayName(projectId: string, port: number): string {
  if (port === 4000) return 'Todo-Dashboard (Production)'
  if (projectId.includes('::')) {
    const [parent, child] = projectId.split('::')
    return `${formatId(parent)} / ${child}`
  }
  return formatId(projectId)
}

function formatId(id: string): string {
  const MAP: Record<string, string> = {
    'dashboard': 'Todo-Dashboard',
    'blogfront': 'BlogFrontend',
    'blogbackend': 'BlogBackend',
    'brickverse-web': 'brickverse-web',
    'brickverse-design': 'brickverse-design',
    'brickverse-learn': 'brickverse-learn',
    'gsc-dashboard': 'GSC-Dashboard',
    'salekit': 'SaleKit',
    'classpost': 'ClassPost',
    'claude-code-lab': 'ClaudeCodeLab',
    'excel-factory': 'ExcelFactory',
    'cover-maker': 'CoverMaker',
    'security-monitor': 'SecurityMonitor',
    'course-hub': 'CourseHub',
    'course-template': 'CourseTemplate',
    'hr-workshop': 'HRWorkshop',
    'aicode100': 'AICode100',
    'aicode101': 'AICode101',
  }
  return MAP[id] ?? id
}

// 登記狀態的圖示與顏色
function statusIcon(status: PkgStatus | ClaudeStatus): { symbol: string; color: string } {
  switch (status) {
    case 'correct':
    case 'registered':
      return { symbol: '✓', color: '#22c55e' }
    case 'missing-port':
    case 'no-port':
      return { symbol: '⚠', color: '#f97316' }
    case 'wrong-port':
      return { symbol: '✗', color: '#ef4444' }
    case 'no-file':
      return { symbol: '—', color: 'var(--text-tertiary)' }
  }
}

function statusLabel(status: PkgStatus | ClaudeStatus): string {
  switch (status) {
    case 'correct': return '正確'
    case 'registered': return '已登記'
    case 'missing-port': return '缺少 port'
    case 'no-port': return '未填 port'
    case 'wrong-port': return 'port 錯誤'
    case 'no-file': return '無檔案'
  }
}

type TabId = 'cities' | 'residents' | 'audit' | 'rules'

export default function PortsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('cities')
  const [entries, setEntries] = useState<PortEntry[]>([])
  const [prodRunning, setProdRunning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([])
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null)
  const [auditLoading, setAuditLoading] = useState(false)
  const [auditLoaded, setAuditLoaded] = useState(false)
  const [cityProjects, setCityProjects] = useState<Project[]>([])
  const [cityCourseFiles, setCityCourseFiles] = useState<Project[]>([])
  const [cityUtilityTools, setCityUtilityTools] = useState<Project[]>([])
  const [citiesLoaded, setCitiesLoaded] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [fixingItems, setFixingItems] = useState<Set<string>>(new Set())
  const [fixAllLoading, setFixAllLoading] = useState(false)
  const [stationLoading, setStationLoading] = useState<Record<string, boolean>>({})

  // 重新載入審計資料
  const reloadAudit = async () => {
    setAuditLoading(true)
    try {
      const res = await fetch('/api/port-audit')
      const json = await res.json()
      setAuditEntries(json.entries ?? [])
      setAuditStats(json.stats ?? null)
    } catch { /* ignore */ }
    finally { setAuditLoading(false) }
  }

  // 單項修復
  const handleFixItem = async (entryPath: string, port: number, fixType: 'fix-package-json' | 'fix-claude-md') => {
    const key = `${entryPath}:${fixType}`
    setFixingItems(prev => new Set(prev).add(key))
    try {
      await fetch('/api/port-audit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: fixType, projectPath: entryPath, port }),
      })
      await reloadAudit()
    } finally {
      setFixingItems(prev => { const next = new Set(prev); next.delete(key); return next })
    }
  }

  // 全部修復
  const handleFixAll = async () => {
    setFixAllLoading(true)
    try {
      await fetch('/api/port-audit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fix-all' }),
      })
      await reloadAudit()
    } finally {
      setFixAllLoading(false)
    }
  }

  // Station 操作：Start / Stop
  const handleStationAction = async (projectId: string, action: 'start' | 'stop') => {
    setStationLoading(prev => ({ ...prev, [projectId]: true }))
    try {
      await fetch('/api/dev-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, action }),
      })
      // 重新載入狀態
      const res = await fetch('/api/dev-server')
      if (res.ok) {
        const json = await res.json()
        setEntries((json.data ?? []).map((s: PortEntry) => ({
          projectId: s.projectId, port: s.port, isRunning: s.isRunning,
          projectPath: s.projectPath, source: s.source, devBasePath: s.devBasePath,
        })))
      }
    } finally {
      setStationLoading(prev => ({ ...prev, [projectId]: false }))
    }
  }

  // Station 操作：Open Browser
  const handleStationOpen = (entry: PortEntry) => {
    const url = `http://localhost:${entry.port}${entry.devBasePath || ''}`
    const isCourseFiles = entry.projectPath?.includes('/CourseFiles/')
    if (isCourseFiles) {
      fetch('/api/dev-server', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: entry.projectId, action: 'open-browser' }),
      })
    } else {
      window.open(url, '_blank')
    }
  }

  // 載入城市資料
  useEffect(() => {
    if (citiesLoaded) return
    fetch('/api/cities')
      .then(res => res.json())
      .then(json => {
        setCityProjects(json.projects ?? [])
        setCityCourseFiles(json.courseFiles ?? [])
        setCityUtilityTools(json.utilityTools ?? [])
        setCitiesLoaded(true)
      })
      .catch(() => {})
  }, [citiesLoaded])

  // 載入居民資料
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/dev-server')
        if (!res.ok) return
        const json = await res.json()
        setEntries((json.data ?? []).map((s: PortEntry) => ({
          projectId: s.projectId,
          port: s.port,
          isRunning: s.isRunning,
          projectPath: s.projectPath,
          source: s.source,
          devBasePath: s.devBasePath,
        })))
      } finally {
        setLoading(false)
      }
    }

    async function checkProd() {
      try {
        const res = await fetch('/api/dev-server', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'check-production' }),
        })
        if (!res.ok) return
        const json = await res.json()
        setProdRunning(json.isRunning ?? false)
      } catch { /* ignore */ }
    }

    load()
    checkProd()
  }, [])

  // 切換到 audit tab 時載入審計資料
  useEffect(() => {
    if (activeTab !== 'audit' || auditLoaded) return
    setAuditLoading(true)
    fetch('/api/port-audit')
      .then(res => res.json())
      .then(json => {
        setAuditEntries(json.entries ?? [])
        setAuditStats(json.stats ?? null)
        setAuditLoaded(true)
      })
      .catch(() => {})
      .finally(() => setAuditLoading(false))
  }, [activeTab, auditLoaded])

  // 合併 + 排序
  const allEntries: PortEntry[] = [
    ...entries,
    { ...PRODUCTION_ENTRY, isRunning: prodRunning },
  ].sort((a, b) => a.port - b.port)

  // 統計
  const runningCount = allEntries.filter(e => e.isRunning).length
  const assignedPorts = new Set(allEntries.map(e => e.port))
  const maxDevPort = Math.max(...allEntries.filter(e => e.port < 4000).map(e => e.port), 3020)
  const vacantPorts: number[] = []
  for (let p = 3001; p <= maxDevPort; p++) {
    if (p !== 4000 && !assignedPorts.has(p)) vacantPorts.push(p)
  }
  let nextAvailable = maxDevPort + 1
  while (nextAvailable === 4000) nextAvailable++

  // 報戶口完成後：更新城市資料、重新載入居民資料、跳轉 Station
  const handleRegistered = async () => {
    // 重新載入城市資料
    setCitiesLoaded(false)
    // 重新載入居民資料
    setLoading(true)
    try {
      const res = await fetch('/api/dev-server')
      if (res.ok) {
        const json = await res.json()
        setEntries((json.data ?? []).map((s: PortEntry) => ({
          projectId: s.projectId,
          port: s.port,
          isRunning: s.isRunning,
          projectPath: s.projectPath,
          source: s.source,
          devBasePath: s.devBasePath,
        })))
      }
    } finally {
      setLoading(false)
    }
    // 跳轉到 Station tab
    setActiveTab('residents')
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'cities', label: '城市' },
    { id: 'residents', label: 'Station' },
    { id: 'audit', label: '登記審計' },
    { id: 'rules', label: '報戶口規範' },
  ]

  return (
    <SubpageShell
      title="Port 管理"
      headerRight={
        <button
          onClick={() => setChatOpen(prev => !prev)}
          className="px-2.5 py-1.5 rounded-lg text-sm transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] flex items-center gap-2"
          style={{
            backgroundColor: chatOpen ? 'rgba(1,132,255,0.15)' : 'var(--background-tertiary)',
            color: chatOpen ? '#0184ff' : 'var(--text-tertiary)',
            border: chatOpen ? '1px solid rgba(1,132,255,0.25)' : '1px solid var(--border-color)',
          }}
        >
          <i className="fa-solid fa-comment-dots text-xs" />
          管理員
        </button>
      }
      headerExtension={
        <div style={{ backgroundColor: 'var(--background-secondary)' }}>
          <div className="px-4 flex gap-0 overflow-x-auto border-t border-t-[var(--border-color)]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-2.5 text-sm font-medium transition-colors duration-200 cursor-pointer whitespace-nowrap border-b-2"
                style={{
                  borderBottomColor: activeTab === tab.id ? '#0184ff' : 'transparent',
                  color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  backgroundColor: 'transparent',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      }
      sidePanel={
        chatOpen ? (
          <div
            className="flex flex-col shrink-0"
            style={{
              width: '420px',
              minWidth: '420px',
              borderLeft: '1px solid var(--border-color)',
              backgroundColor: 'var(--background-secondary)',
            }}
          >
            <ChatContent projectId="port-manager" projectName="Port 管理員" compact />
          </div>
        ) : undefined
      }
    >
      <div className="px-4 py-6 pb-16">

        {/* Tab: 城市 */}
        {activeTab === 'cities' && (
          citiesLoaded ? (
            <div className="space-y-8">
              <CityBlock name="Brickverse" color="#3b82f6" projects={cityProjects} allEntries={allEntries} onEnterStation={() => setActiveTab('residents')} onRegistered={handleRegistered} />
              <CityBlock name="CourseFiles" color="#f97316" projects={cityCourseFiles} allEntries={allEntries} onEnterStation={() => setActiveTab('residents')} onRegistered={handleRegistered} />
              <CityBlock name="UtilityTools" color="#a855f7" projects={cityUtilityTools} allEntries={allEntries} onEnterStation={() => setActiveTab('residents')} onRegistered={handleRegistered} />
            </div>
          ) : (
            <div className="px-4 py-8 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
              載入中...
            </div>
          )
        )}

        {/* Tab: 居民表 */}
        {activeTab === 'residents' && (
          <>
            {/* 摘要統計 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Station 進駐', value: loading ? '—' : allEntries.length },
                { label: '在崗工作', value: loading ? '—' : runningCount, highlight: runningCount > 0 },
                { label: '空號', value: loading ? '—' : vacantPorts.length, warn: vacantPorts.length > 0 },
                { label: '下一個可用', value: loading ? '—' : nextAvailable },
              ].map(({ label, value, highlight, warn }) => (
                <div
                  key={label}
                  className="rounded-[var(--radius-small)] px-3 py-2"
                  style={{ backgroundColor: 'var(--background-tertiary)', border: '1px solid var(--border-color)' }}
                >
                  <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
                  <div
                    className="text-xl font-semibold"
                    style={{ color: highlight ? '#22c55e' : warn ? '#f97316' : 'var(--text-primary)' }}
                  >
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* 空號列表 */}
            {!loading && vacantPorts.length > 0 && (
              <div
                className="mb-6 px-3 py-2 rounded-[var(--radius-small)] text-sm"
                style={{ backgroundColor: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.15)', color: '#f97316' }}
              >
                空號：{vacantPorts.join(', ')}
              </div>
            )}

            {/* 居民列表 */}
            <div className="rounded-[var(--radius-medium)] overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
              {loading ? (
                <div className="px-3 py-8 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
                  載入中...
                </div>
              ) : (
                allEntries.map((entry, i) => {
                  const isLast = i === allEntries.length - 1
                  const isProd = entry.port === 4000
                  const src = entry.source
                  const srcColor = src ? SOURCE_COLORS[src] : undefined
                  const isLoading = stationLoading[entry.projectId] || false

                  return (
                    <div
                      key={entry.port}
                      className="flex items-center px-3 py-2 text-sm"
                      style={{
                        borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
                      }}
                    >
                      {/* 左側：狀態圓點 + port + 名稱 */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span
                          className={`w-2 h-2 rounded-full shrink-0${entry.isRunning ? ' animate-port-glow' : ''}`}
                          style={{ backgroundColor: entry.isRunning ? '#22c55e' : 'var(--text-tertiary)', opacity: entry.isRunning ? 1 : 0.4 }}
                        />
                        <span className="font-mono font-medium text-xs w-10 shrink-0" style={{ color: isProd ? '#f97316' : 'var(--text-tertiary)' }}>
                          {entry.port}
                        </span>
                        <span className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>
                          {getDisplayName(entry.projectId, entry.port)}
                        </span>
                        {entry.devBasePath && (
                          <span className="text-xs font-mono shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                            {entry.devBasePath}
                          </span>
                        )}
                      </div>
                      {/* 右側：城市標籤 + 操作按鈕 */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isProd ? (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: 'rgba(249,115,22,0.1)', color: '#f97316', border: '1px solid rgba(249,115,22,0.15)' }}
                          >
                            Production
                          </span>
                        ) : src && srcColor ? (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: srcColor.bg, color: srcColor.fg, border: `1px solid ${srcColor.border}` }}
                          >
                            {SOURCE_LABELS[src]}
                          </span>
                        ) : null}
                        {/* Open 按鈕 */}
                        {entry.isRunning && !isLoading && !isProd && (
                          <button
                            onClick={() => handleStationOpen(entry)}
                            className="px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-200 hover:shadow-md hover:scale-[1.02]"
                            style={{ backgroundColor: '#222222', color: '#cccccc', border: '1px solid #333333' }}
                            title="Open"
                          >
                            Open
                          </button>
                        )}
                        {/* Start / Stop 按鈕 */}
                        {!isProd && (
                          <button
                            onClick={() => handleStationAction(entry.projectId, entry.isRunning ? 'stop' : 'start')}
                            disabled={isLoading}
                            className="px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-200 hover:shadow-md hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                            style={{
                              backgroundColor: isLoading ? '#333333' : entry.isRunning ? '#3d1515' : '#15332a',
                              color: isLoading ? '#999999' : entry.isRunning ? '#ef4444' : '#10b981',
                              border: isLoading ? '1px solid #444444' : entry.isRunning ? '1px solid #5c2020' : '1px solid #1a4a3a',
                            }}
                            title={entry.isRunning ? 'Stop' : 'Start'}
                          >
                            {isLoading ? (
                              <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            ) : entry.isRunning ? 'Stop' : 'Start'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </>
        )}

        {/* Tab: 登記審計 */}
        {activeTab === 'audit' && (
          <>
            {/* 審計統計 */}
            {auditStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                {[
                  { label: '總專案', value: auditStats.total },
                  { label: 'package.json 正確', value: auditStats.packageJsonOk, highlight: auditStats.packageJsonOk === auditStats.total },
                  { label: '區域戶口已登記', value: auditStats.localClaudeOk, highlight: auditStats.localClaudeOk === auditStats.total },
                  { label: '完整登記', value: auditStats.fullyRegistered, highlight: auditStats.fullyRegistered === auditStats.total, warn: auditStats.fullyRegistered < auditStats.total },
                ].map(({ label, value, highlight, warn }) => (
                  <div
                    key={label}
                    className="rounded-[var(--radius-small)] px-3 py-2"
                    style={{ backgroundColor: 'var(--background-tertiary)', border: '1px solid var(--border-color)' }}
                  >
                    <div className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
                    <div
                      className="text-xl font-semibold"
                      style={{ color: highlight ? '#22c55e' : warn ? '#f97316' : 'var(--text-primary)' }}
                    >
                      {value} / {auditStats.total}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 全部修復按鈕 */}
            {auditStats && auditStats.fullyRegistered < auditStats.total && (
              <div className="mb-4">
                <button
                  onClick={handleFixAll}
                  disabled={fixAllLoading}
                  className="px-2.5 py-1.5 rounded-lg text-sm font-semibold transition-all duration-200 hover:shadow-md hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  style={{ backgroundColor: '#15332a', color: '#10b981', border: '1px solid #1a4a3a' }}
                >
                  {fixAllLoading ? (
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  ) : (
                    <i className="fa-solid fa-wrench text-xs" />
                  )}
                  全部修復
                </button>
              </div>
            )}

            {/* 審計表格 */}
            <div className="rounded-[var(--radius-medium)] overflow-hidden" style={{ border: '1px solid var(--border-color)' }}>
              {auditLoading ? (
                <div className="px-3 py-8 text-sm text-center" style={{ color: 'var(--text-tertiary)' }}>
                  審計中...
                </div>
              ) : (
                auditEntries.map((entry, i) => {
                  const isLast = i === auditEntries.length - 1
                  const pkgIcon = statusIcon(entry.packageJson)
                  const claudeIcon = statusIcon(entry.localClaude)
                  const pkgNeedsFix = entry.packageJson !== 'correct' && entry.packageJson !== 'no-file'
                  const claudeNeedsFix = entry.localClaude !== 'registered'
                  const pkgFixing = fixingItems.has(`${entry.path}:fix-package-json`)
                  const claudeFixing = fixingItems.has(`${entry.path}:fix-claude-md`)

                  return (
                    <div
                      key={entry.port}
                      className="flex items-center px-3 py-2 text-sm"
                      style={{
                        borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
                      }}
                    >
                      {/* 左側：port + 名稱 */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="font-mono font-medium text-xs w-10 shrink-0" style={{ color: 'var(--text-tertiary)' }}>{entry.port}</span>
                        <div className="min-w-0">
                          <span className="truncate block font-medium">{entry.name}</span>
                          {entry.localClaudePath && (
                            <span className="text-xs font-mono block mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                              {entry.localClaudePath}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* 右側：審計結果 + 修復按鈕 */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5" title={entry.packageJsonDetail}>
                          <span style={{ color: pkgIcon.color, fontWeight: 600 }}>{pkgIcon.symbol}</span>
                          <span className="text-xs" style={{ color: pkgIcon.color }}>
                            {statusLabel(entry.packageJson)}
                          </span>
                          {pkgNeedsFix && (
                            <button
                              onClick={() => handleFixItem(entry.path, entry.port, 'fix-package-json')}
                              disabled={pkgFixing}
                              className="px-1.5 py-0.5 rounded text-[11px] font-semibold transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 cursor-pointer"
                              style={{ backgroundColor: '#15332a', color: '#10b981', border: '1px solid #1a4a3a' }}
                              title="修復 package.json"
                            >
                              {pkgFixing ? '...' : '修復'}
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5" title={entry.localClaudeDetail}>
                          <span style={{ color: claudeIcon.color, fontWeight: 600 }}>{claudeIcon.symbol}</span>
                          <span className="text-xs" style={{ color: claudeIcon.color }}>
                            {statusLabel(entry.localClaude)}
                          </span>
                          {claudeNeedsFix && (
                            <button
                              onClick={() => handleFixItem(entry.path, entry.port, 'fix-claude-md')}
                              disabled={claudeFixing}
                              className="px-1.5 py-0.5 rounded text-[11px] font-semibold transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 cursor-pointer"
                              style={{ backgroundColor: '#15332a', color: '#10b981', border: '1px solid #1a4a3a' }}
                              title="修復 CLAUDE.md"
                            >
                              {claudeFixing ? '...' : '修復'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            {/* 全域居民表說明 */}
            {auditStats && (
              <div
                className="mt-4 px-3 py-2 rounded-[var(--radius-small)] text-xs"
                style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)' }}
              >
                全域居民表（~/.claude/CLAUDE.md）由 /port-sync Skill 統一管理同步，不在此處審計。
                此表審計的是各專案自身的 package.json 與區域 CLAUDE.md。
              </div>
            )}
          </>
        )}

        {/* Tab: 報戶口規範 */}
        {activeTab === 'rules' && (
          <div className="space-y-6">

            {/* 世界觀 */}
            <Section title="世界觀">
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
                Todo-Dashboard 是一個<strong>國家</strong>，國內有三座城市：Brickverse、CourseFiles、Utility。
                國家裡有一個工作園區叫 <strong>Station</strong>，進入 Station 必須持有身份證（報戶口）。
                只有在 Station 裡的專案才能被啟動工作。
              </p>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <TierItem
                  tier={1}
                  label="國外"
                  color="var(--text-tertiary)"
                  description="不在任何 JSON 裡，Dashboard 完全不知道這個專案的存在"
                />
                <TierItem
                  tier={2}
                  label="城市居民"
                  color="#3b82f6"
                  description="已登記在 JSON（projects / coursefiles / utility-tools），住在城市裡但還沒進 Station"
                />
                <TierItem
                  tier={3}
                  label="Station 進駐"
                  color="#f59e0b"
                  description="有 devPort、已完成三重登記（報戶口），可以被 Start / Open / Chat"
                />
                <TierItem
                  tier={4}
                  label="在崗工作中"
                  color="#22c55e"
                  description="已按下 Start，dev server 正在運行（isRunning: true）"
                />
              </div>
            </Section>

            {/* Station 身份證：報戶口制度 */}
            <Section title="Station 身份證（報戶口制度）">
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
                要從城市居民（Tier 2）進入 Station（Tier 3），必須辦好身份證 — 完成<strong>三重登記</strong>，缺一不可。
                所有登記與同步操作由 <code className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>/port-sync</code> Skill（Port 保姆）統一執行。
              </p>
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <RegistrationItem
                  number={1}
                  title="JSON 資料檔"
                  role="唯一真相來源"
                  description="projects.json / utility-tools.json / coursefiles.json 的 devPort 欄位。在 Dashboard UI 操作修改。"
                  color="#3b82f6"
                />
                <RegistrationItem
                  number={2}
                  title="package.json"
                  role="執行依據"
                  description="scripts.dev 必須寫死 -p <port>（如 next dev -p 3001），不可省略。Todo-Dashboard (port 3000) 因為是 Next.js 預設值，可以不寫。"
                  color="#22c55e"
                />
                <RegistrationItem
                  number={3}
                  title="CLAUDE.md 雙重登記"
                  role="身分證明"
                  description="分為全域居民表（~/.claude/CLAUDE.md）和區域戶口（各專案自己的 CLAUDE.md）。全域是統一查詢入口，區域是每個專案知道自己住在哪。"
                  color="#a855f7"
                />
              </div>
            </Section>

            {/* 區域戶口格式 */}
            <Section title="區域戶口格式">
              <div
                className="rounded-[var(--radius-small)] p-3 font-mono text-xs leading-relaxed"
                style={{ backgroundColor: 'var(--background-tertiary)', border: '1px solid var(--border-color)' }}
              >
                <div style={{ color: 'var(--text-tertiary)' }}>## Dev Server</div>
                <div className="mt-2" style={{ color: 'var(--text-tertiary)' }}>| 環境 | Port | 指令 |</div>
                <div style={{ color: 'var(--text-tertiary)' }}>|------|------|------|</div>
                <div>| 開發 | <span style={{ color: '#3b82f6' }}>`3001`</span> | <span style={{ color: '#22c55e' }}>`npm run dev`</span> |</div>
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                位置優先級：先找 .claude/CLAUDE.md，再找根目錄 CLAUDE.md。沒有就新建在根目錄。
              </p>
            </Section>

            {/* 進駐 Station（搬入） */}
            <Section title="進駐 Station（搬入流程）">
              <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                城市居民（Tier 2）要進入 Station（Tier 3）的完整步驟：
              </p>
              <ol className="text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
                <FlowStep step={1}>查全域居民表，找下一個可用 port（目前 3000~3020 全滿，下一個：<strong>{nextAvailable}</strong>）</FlowStep>
                <FlowStep step={2}>在專案 package.json 的 scripts.dev 加上 <code className="text-xs px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>-p {'<port>'}</code></FlowStep>
                <FlowStep step={3}>在專案 CLAUDE.md 登記 Dev Server port（區域戶口）</FlowStep>
                <FlowStep step={4}>在全域居民表（~/.claude/CLAUDE.md）新增一行</FlowStep>
                <FlowStep step={5}>在 Dashboard JSON 加上 devPort → 專案出現在 Station 面板</FlowStep>
              </ol>
            </Section>

            {/* 離開 Station（搬出） */}
            <Section title="離開 Station（搬出流程）">
              <p className="text-xs mb-3" style={{ color: 'var(--text-tertiary)' }}>
                從 Station（Tier 3）退回城市居民（Tier 2）。在 Station 面板按 ✕ 或手動操作：
              </p>
              <ol className="text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
                <FlowStep step={1}>從全域居民表刪除該行</FlowStep>
                <FlowStep step={2}>從 Dashboard JSON 移除 devPort</FlowStep>
                <FlowStep step={3}>區域 CLAUDE.md 的 Dev Server 區段移除</FlowStep>
                <FlowStep step={4}>釋出的 port 號變成空號，後續新專案可填入</FlowStep>
              </ol>
            </Section>

            {/* 注意事項 */}
            <Section title="注意事項">
              <ul className="text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
                <li>啟動 dev server 前必須查居民表，確認 port 正確</li>
                <li>嚴禁憑空指定 port，必須以 package.json 和居民表為準</li>
                <li>JSON 是唯一真相來源 — 如果 package.json 或 CLAUDE.md 不一致，以 JSON 為準</li>
                <li>Port 4000 保留給 Todo-Dashboard Production（next start -p 4000）</li>
                <li>不是所有城市居民都需要進 Station — 沒有 dev server 需求的專案留在城市即可</li>
                <li>執行 <code className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--background-tertiary)' }}>/port-sync</code> 可自動巡邏並修正所有不一致</li>
              </ul>
            </Section>
          </div>
        )}

      </div>
    </SubpageShell>
  )
}

// --- Sub-components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-[var(--radius-medium)] p-4"
      style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}
    >
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{title}</h2>
      {children}
    </div>
  )
}

function RegistrationItem({ number, title, role, description, color }: {
  number: number; title: string; role: string; description: string; color: string
}) {
  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-[var(--radius-small)]"
      style={{ backgroundColor: 'var(--background-tertiary)' }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: color + '20', color }}
        >
          {number}
        </div>
        <div className="flex flex-col">
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {title}
          </div>
          <div className="text-xs" style={{ color }}>{role}</div>
        </div>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
    </div>
  )
}

function TierItem({ tier, label, color, description }: {
  tier: number; label: string; color: string; description: string
}) {
  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-[var(--radius-small)]"
      style={{ backgroundColor: 'var(--background-tertiary)' }}
    >
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold shrink-0"
          style={{ backgroundColor: color + '20', color }}
        >
          {tier}
        </div>
        <div className="text-sm font-medium" style={{ color }}>{label}</div>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
    </div>
  )
}

function FlowStep({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 items-start">
      <span
        className="w-6 h-6 rounded flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5"
        style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)' }}
      >
        {step}
      </span>
      <span>{children}</span>
    </li>
  )
}

// --- City Tab Components ---

function getTier(project: Project, allEntries: PortEntry[]): 2 | 3 | 4 {
  if (!project.devPort) return 2
  const running = allEntries.find(e => e.port === project.devPort && e.isRunning)
  return running ? 4 : 3
}

function getChildTier(child: { devPort?: number }, allEntries: PortEntry[]): 2 | 3 | 4 {
  if (!child.devPort) return 2
  const running = allEntries.find(e => e.port === child.devPort && e.isRunning)
  return running ? 4 : 3
}

const TIER_STYLE: Record<2 | 3 | 4, { color: string; label: string }> = {
  2: { color: 'var(--text-tertiary)', label: '居民' },
  3: { color: '#f59e0b', label: 'Station' },
  4: { color: '#22c55e', label: '在崗' },
}

function PortTag({ port }: { port: number }) {
  return (
    <span
      className="text-[11px] font-mono px-1.5 py-0.5 rounded"
      style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)' }}
    >
      :{port}
    </span>
  )
}

function TierDot({ tier }: { tier: 2 | 3 | 4 }) {
  const { color } = TIER_STYLE[tier]
  return (
    <span
      className={`w-[7px] h-[7px] rounded-full shrink-0${tier === 4 ? ' animate-port-glow' : ''}`}
      style={{ backgroundColor: color, opacity: tier === 2 ? 0.4 : 1 }}
      title={TIER_STYLE[tier].label}
    />
  )
}

/** 報戶口按鈕（+）：城市居民 → Station */
function RegisterButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      disabled={loading}
      className="px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-200 hover:shadow-md hover:scale-[1.02] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
      style={{ backgroundColor: '#332815', color: '#f59e0b', border: '1px solid #4a3520' }}
      title="報戶口進入 Station"
    >
      {loading ? (
        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <i className="fa-solid fa-plus" />
      )}
    </button>
  )
}

/** 退出 Station 按鈕（−）：Station → 城市居民 */
function UnregisterButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      disabled={loading}
      className="px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-200 hover:shadow-md hover:scale-[1.02] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 opacity-0 group-hover:opacity-100"
      style={{ backgroundColor: '#3d1515', color: '#ef4444', border: '1px solid #5c2020' }}
      title="離開 Station"
    >
      {loading ? (
        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : (
        <i className="fa-solid fa-minus" />
      )}
    </button>
  )
}

function ResidentCard({ name, description, tier, port, onRegister, onUnregister, onEnterStation }: {
  name: string; description?: string; tier: 2 | 3 | 4; port?: number
  onRegister?: () => Promise<void>; onUnregister?: () => Promise<void>; onEnterStation?: () => void
}) {
  const [loading, setLoading] = useState(false)
  const isStation = tier >= 3

  const handleAction = async (action: () => Promise<void>) => {
    setLoading(true)
    try { await action() } finally { setLoading(false) }
  }

  return (
    <div
      className={`group flex items-center gap-3 px-3 py-2 rounded-[var(--radius-small)] transition-colors duration-150 ${isStation ? 'cursor-pointer hover:brightness-110' : ''}`}
      style={{ backgroundColor: 'var(--background-tertiary)' }}
      onClick={isStation ? onEnterStation : undefined}
    >
      <TierDot tier={tier} />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{name}</span>
        {description ? (
          <span className="text-xs ml-2" style={{ color: 'var(--text-tertiary)' }}>{description}</span>
        ) : (
          <span className="text-xs ml-2 italic" style={{ color: 'var(--text-tertiary)', opacity: 0.5 }}>未填寫描述</span>
        )}
      </div>
      {port && <PortTag port={port} />}
      {/* Tier 2: 顯示「+」報戶口 */}
      {tier === 2 && onRegister && (
        <RegisterButton onClick={() => handleAction(onRegister)} loading={loading} />
      )}
      {/* Tier 3/4: hover 顯示「−」退出 Station */}
      {isStation && onUnregister && (
        <UnregisterButton onClick={() => handleAction(onUnregister)} loading={loading} />
      )}
    </div>
  )
}

function DistrictBlock({ name, districtId, childProjects, allEntries, onRegister, onUnregister, onEnterStation }: {
  name: string
  districtId: string
  childProjects: { name: string; description: string; devPort?: number }[]
  allEntries: PortEntry[]
  onRegister: (projectId: string, childName: string) => Promise<void>
  onUnregister: (projectId: string, childName: string) => Promise<void>
  onEnterStation: () => void
}) {
  return (
    <div
      className="rounded-[var(--radius-small)] overflow-hidden"
      style={{ border: '1px solid var(--border-color)' }}
    >
      <div
        className="px-3 py-1.5 text-xs font-semibold"
        style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}
      >
        {name}
      </div>
      <div className="p-1.5 space-y-1">
        {childProjects.map(child => {
          const tier = getChildTier(child, allEntries)
          return (
            <ResidentCard
              key={child.name}
              name={child.name}
              description={child.description}
              tier={tier}
              port={child.devPort}
              onRegister={() => onRegister(districtId, child.name)}
              onUnregister={() => onUnregister(districtId, child.name)}
              onEnterStation={onEnterStation}
            />
          )
        })}
      </div>
    </div>
  )
}

function CityBlock({ name, color, projects, allEntries, onEnterStation, onRegistered }: {
  name: string; color: string; projects: Project[]; allEntries: PortEntry[]
  onEnterStation: () => void; onRegistered: () => Promise<void>
}) {
  const total = projects.reduce((sum, p) => sum + (p.children?.length || 1), 0)
  const stationCount = projects.reduce((sum, p) => {
    if (p.children?.length) return sum + p.children.filter(c => c.devPort).length
    return sum + (p.devPort ? 1 : 0)
  }, 0)

  const handleRegister = async (projectId: string, childName?: string) => {
    const res = await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, childName, action: 'add-to-dev' }),
    })
    if (res.ok) await onRegistered()
  }

  const handleUnregister = async (projectId: string, childName?: string) => {
    const res = await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, childName, action: 'remove-from-dev' }),
    })
    if (res.ok) await onRegistered()
  }

  // 分成兩類：有 children 的（區域）和無 children 的（獨立居民）
  const districts = projects.filter(p => p.children && p.children.length > 0)
  const independents = projects.filter(p => !p.children || p.children.length === 0)

  return (
    <div
      className="rounded-[var(--radius-medium)] overflow-hidden"
      style={{ border: '1px solid var(--border-color)' }}
    >
      {/* 城市 Header */}
      <div
        className="px-3 py-2.5 flex items-center justify-between"
        style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</h3>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            {total} 專案
          </span>
        </div>
        <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          {stationCount} 在 Station
        </div>
      </div>

      {/* 城市內容 */}
      <div className="p-3">
        {/* 區域（有 children 的 group） */}
        {districts.length > 0 && (
          <div className="grid gap-3 mb-3" style={{ gridTemplateColumns: `repeat(${Math.min(districts.length, 3)}, 1fr)` }}>
            {districts.map(district => (
              <DistrictBlock
                key={district.id}
                name={district.displayName || district.name}
                districtId={district.id}
                childProjects={district.children!}
                allEntries={allEntries}
                onRegister={handleRegister}
                onUnregister={handleUnregister}
                onEnterStation={onEnterStation}
              />
            ))}
          </div>
        )}

        {/* 獨立居民 */}
        {independents.length > 0 && (
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
            {independents.map(project => {
              const tier = getTier(project, allEntries)
              return (
                <ResidentCard
                  key={project.id}
                  name={project.displayName || project.name}
                  description={project.description?.slice(0, 40) || undefined}
                  tier={tier}
                  port={project.devPort}
                  onRegister={() => handleRegister(project.id)}
                  onUnregister={() => handleUnregister(project.id)}
                  onEnterStation={onEnterStation}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
