'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useDevServer } from '@/contexts/DevServerContext'
import type { Project } from '@/lib/types'

type Source = 'brickverse' | 'coursefiles' | 'utility'
type PkgStatus = 'correct' | 'missing-port' | 'wrong-port' | 'no-file'

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
}

interface AuditStats {
  total: number
  packageJsonOk: number
  fullyRegistered: number
  roomsTotal: number
  roomsUsed: number
  roomsAvailable: number
}

interface SeatEntry {
  projectId: string | null
  projectName: string | null
  port: number
}

interface SeatsResponse {
  seats: (SeatEntry | null)[]
  total: number
  occupied: number
  available: number
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
  port: 3001,
  isRunning: false,
  projectPath: '/Users/ruanbaiye/Documents/Brickverse/Todo-Dashboard',
  source: 'brickverse',
}

function getDisplayName(projectId: string, port: number): string {
  if (port === 3001) return 'Todo-Dashboard (Prod)'
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
function statusIcon(status: PkgStatus): { icon: string; color: string } {
  switch (status) {
    case 'correct':
      return { icon: 'fa-solid fa-check', color: '#22c55e' }
    case 'missing-port':
      return { icon: 'fa-solid fa-triangle-exclamation', color: '#f97316' }
    case 'wrong-port':
      return { icon: 'fa-solid fa-xmark', color: '#ef4444' }
    case 'no-file':
      return { icon: 'fa-solid fa-minus', color: 'var(--text-tertiary)' }
  }
}

function statusLabel(status: PkgStatus): string {
  switch (status) {
    case 'correct': return '正確'
    case 'missing-port': return '缺少 port'
    case 'wrong-port': return 'port 錯誤'
    case 'no-file': return '無檔案'
  }
}

export default function PortsPage() {
  const router = useRouter()
  const { refresh: refreshDevContext } = useDevServer()
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
  const [fixingItems, setFixingItems] = useState<Set<string>>(new Set())
  const [fixAllLoading, setFixAllLoading] = useState(false)
  const [stationLoading, setStationLoading] = useState<Record<string, boolean>>({})
  const [seats, setSeats] = useState<(SeatEntry | null)[]>([])
  const [showRules, setShowRules] = useState(false)

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
  const handleFixItem = async (entryPath: string, port: number, fixType: 'fix-package-json') => {
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
    // Sync homepage DevServerContext
    refreshDevContext()
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

        // 載入座位陣列
        const seatsRes = await fetch('/api/seats')
        if (seatsRes.ok) {
          const seatsJson = await seatsRes.json()
          setSeats(seatsJson.seats ?? [])
        }
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

  // 載入審計資料
  useEffect(() => {
    if (auditLoaded) return
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
  }, [auditLoaded])

  // 合併 + 排序
  const allEntries: PortEntry[] = [
    ...entries,
    { ...PRODUCTION_ENTRY, isRunning: prodRunning },
  ].sort((a, b) => a.port - b.port)

  // 統計
  const runningCount = allEntries.filter(e => e.isRunning).length
  const STATION_ROOM_MIN = 3003
  const STATION_ROOM_MAX = 3010
  const stationEntries = allEntries.filter(e => e.port >= STATION_ROOM_MIN && e.port <= STATION_ROOM_MAX)
  const roomsTotal = STATION_ROOM_MAX - STATION_ROOM_MIN + 1
  const roomsUsed = stationEntries.length
  const roomsAvailable = roomsTotal - roomsUsed

  // 報戶口完成後：更新城市資料、重新載入居民資料、座位資訊、審計資料
  const handleRegistered = async () => {
    // 重新載入城市資料（加 cache bust 確保拿到最新資料）
    setCitiesLoaded(false)
    // 重新載入居民資料 + 座位資訊 + 審計資料
    setLoading(true)
    try {
      const now = Date.now()
      const [devRes, seatsRes, auditRes, citiesRes] = await Promise.all([
        fetch('/api/dev-server'),
        fetch('/api/seats'),
        fetch('/api/port-audit'),
        fetch(`/api/cities?_t=${now}`),  // cache bust: 加時間戳
      ])

      if (devRes.ok) {
        const json = await devRes.json()
        setEntries((json.data ?? []).map((s: PortEntry) => ({
          projectId: s.projectId,
          port: s.port,
          isRunning: s.isRunning,
          projectPath: s.projectPath,
          source: s.source,
          devBasePath: s.devBasePath,
        })))
      }

      if (seatsRes.ok) {
        const seatsJson = await seatsRes.json()
        setSeats(seatsJson.seats ?? [])
      }

      if (auditRes.ok) {
        const auditJson = await auditRes.json()
        setAuditEntries(auditJson.entries ?? [])
        setAuditStats(auditJson.stats ?? null)
      }

      if (citiesRes.ok) {
        const citiesJson = await citiesRes.json()
        setCityProjects(citiesJson.projects ?? [])
        setCityCourseFiles(citiesJson.courseFiles ?? [])
        setCityUtilityTools(citiesJson.utilityTools ?? [])
        setCitiesLoaded(true)
      }
    } finally {
      setLoading(false)
    }
    // Sync homepage DevServerContext so it picks up station changes
    refreshDevContext()
  }

  return (
    <div
      style={{ backgroundColor: 'var(--background-primary)', color: 'var(--text-primary)', minHeight: '100vh' }}
      className="flex flex-col"
    >
      {/* Sticky header */}
      <div
        style={{ backgroundColor: 'var(--background-secondary)', borderBottom: '1px solid var(--border-color)' }}
        className="sticky top-0 z-40"
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="px-2.5 py-1.5 rounded-lg text-sm transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] flex items-center gap-2"
              style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)', border: '1px solid var(--border-color)' }}
            >
              <i className="fa-solid fa-arrow-left text-xs" />
              <span>儀表板</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRegistered}
              className="px-2.5 py-1.5 rounded-lg text-sm transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] flex items-center gap-2"
              style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)', border: '1px solid var(--border-color)' }}
              title="重新整理所有狀態"
            >
              <i className="fa-solid fa-arrows-rotate text-xs" />
            </button>
            <button
              onClick={() => setShowRules(prev => !prev)}
              className="px-2.5 py-1.5 rounded-lg text-sm transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] flex items-center gap-2"
              style={{
                backgroundColor: showRules ? 'rgba(1,132,255,0.15)' : 'var(--background-tertiary)',
                color: showRules ? '#0184ff' : 'var(--text-tertiary)',
                border: showRules ? '1px solid rgba(1,132,255,0.25)' : '1px solid var(--border-color)',
              }}
            >
              <i className="fa-solid fa-book text-xs" />
              查看說明
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
      <div className="px-4 py-6 pb-16">

        {/* 主內容：如果顯示說明，只顯示說明；否則顯示城市 + Station + 審計 */}
        {showRules ? (
          <div className="space-y-6">

            {/* 座位制度說明 */}
            <Section title="Station 座位制度">
              <p className="text-base leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
                Station 有 <strong>8 個座位</strong>（Port 3003 - 3010）。每個進駐的專案占據一個座位。
                分配規則最簡單：<strong>優先給最小編號的空位</strong>。離開時座位釋出給下一個人。
              </p>
              <div className="p-3 rounded-[var(--radius-small)] mb-4" style={{ backgroundColor: 'var(--background-tertiary)' }}>
                <p className="text-sm font-semibold mb-2">座位狀態：</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><i className="fa-solid fa-circle text-lg text-green-500 mr-1" />空位 = 可以進駐</div>
                  <div><i className="fa-solid fa-circle text-lg text-blue-500 mr-1" />被占用 = 已進駐</div>
                </div>
              </div>
            </Section>

            {/* 雙重登記 */}
            <Section title="雙重登記（進駐必須同時做）">
              <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                <RegistrationItem
                  number={1}
                  title="JSON devPort"
                  role="紀錄座位"
                  description="projects.json / coursefiles.json / utility-tools.json 記錄誰坐在哪個座位（port）。"
                  color="#3b82f6"
                />
                <RegistrationItem
                  number={2}
                  title="package.json -p flag"
                  role="執行時讀取"
                  description="scripts.dev 寫死 -p <port>，讓 Node.js 啟動伺服器時用正確的 port。"
                  color="#22c55e"
                />
              </div>
              <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                一次 API 呼叫會自動同時更新這兩個地方。
              </p>
            </Section>

            {/* 進駐 */}
            <Section title="進駐（坐下）">
              <ol className="text-base space-y-2" style={{ color: 'var(--text-secondary)' }}>
                <FlowStep step={1}>從 Dashboard 點「進駐」</FlowStep>
                <FlowStep step={2}>API 自動分配最小編號的空座位，同步更新 JSON 和 package.json</FlowStep>
                <FlowStep step={3}>完成！專案現在在 Station 可以被 Start / Open</FlowStep>
              </ol>
            </Section>

            {/* 離開 */}
            <Section title="離開（站起來）">
              <ol className="text-base space-y-2" style={{ color: 'var(--text-secondary)' }}>
                <FlowStep step={1}>先停止 dev server（如果正在運行）</FlowStep>
                <FlowStep step={2}>點「離開」→ API 清除 JSON devPort 和 package.json 的 -p flag</FlowStep>
                <FlowStep step={3}>座位釋出，下一個人可以坐</FlowStep>
              </ol>
            </Section>

            {/* 為什麼需要兩個地方都更新 */}
            <Section title="為什麼要同時更新 JSON 和 package.json？">
              <div className="space-y-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                <p>
                  <strong>JSON</strong> 是 Dashboard 的紀錄簿 — 用來顯示「誰坐在哪個座位」。
                  <strong>package.json</strong> 是 Node.js 的說明書 — 用來告訴程式「用哪個 port 啟動」。
                </p>
                <p>
                  只更新一個會造成不一致：
                </p>
                <ul className="ml-4 space-y-1 text-sm">
                  <li>只更新 JSON → package.json 說「用 3001」，但沒人在 3001 坐著，混亂</li>
                  <li>只更新 package.json → 程式用了 3001，但 Dashboard 不知道，找不到</li>
                </ul>
                <p>
                  所以一次 API 呼叫會同時做好這兩件事。
                </p>
              </div>
            </Section>
          </div>
        ) : (
          <>
            {/* Station Section */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Station（工作園區）</h2>
              </div>

              {/* VIP 座位 */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  VIP 座位
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {loading ? (
                    [...Array(2)].map((_, i) => (
                      <div
                        key={`loading-vip-${i}`}
                        className="rounded-lg p-3 animate-pulse"
                        style={{ backgroundColor: 'var(--background-tertiary)' }}
                      >
                        <div className="h-4 w-12 rounded mb-1" style={{ backgroundColor: 'var(--border-color)' }} />
                        <div className="h-3 w-16 rounded" style={{ backgroundColor: 'var(--border-color)' }} />
                      </div>
                    ))
                  ) : (
                    [
                      { port: 3001, name: 'Todo-Dashboard (Prod)', isRunning: prodRunning, isProd: true },
                      { port: 3002, name: 'Todo-Dashboard (Dev)', isRunning: true, isProd: false },
                    ].map(({ port, name, isRunning, isProd }) => (
                      <div
                        key={port}
                        className="rounded-lg p-3 text-sm transition-all flex items-center justify-between"
                        style={{
                          backgroundColor: 'rgba(59,130,246,0.08)',
                          border: '1px solid rgba(59,130,246,0.2)',
                          color: '#3b82f6',
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-mono font-semibold text-xs mb-1" style={{ color: '#3b82f6' }}>
                            {port}
                          </div>
                          <div className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>
                            {name}
                          </div>
                        </div>
                        {isRunning && (
                          <span
                            className="ml-2 w-2 h-2 rounded-full shrink-0 animate-port-glow"
                            style={{ backgroundColor: '#22c55e' }}
                            title="運行中"
                          />
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Station 座位圖 */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  座位安排（3003 - 3010）
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {loading ? (
                    [...Array(8)].map((_, i) => (
                      <div
                        key={`loading-seat-${i}`}
                        className="rounded-lg p-3 animate-pulse"
                        style={{ backgroundColor: 'var(--background-tertiary)' }}
                      >
                        <div className="h-4 w-12 rounded mb-1" style={{ backgroundColor: 'var(--border-color)' }} />
                        <div className="h-3 w-16 rounded" style={{ backgroundColor: 'var(--border-color)' }} />
                      </div>
                    ))
                  ) : (
                    seats.map((seat, i) => {
                      const port = 3003 + i
                      const isEmpty = seat === null
                      const entry = isEmpty ? null : allEntries.find(e => e.port === port)
                      const isLoading = entry ? stationLoading[entry.projectId] : false

                      return (
                        <div
                          key={port}
                          className="rounded-lg p-3 text-sm transition-all flex items-center justify-between group"
                          style={{
                            backgroundColor: isEmpty ? 'rgba(34,197,94,0.1)' : 'rgba(59,130,246,0.1)',
                            border: isEmpty ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(59,130,246,0.2)',
                            color: isEmpty ? '#22c55e' : '#0184ff',
                          }}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-mono font-semibold text-xs mb-1" style={{ color: isEmpty ? '#22c55e' : '#0184ff' }}>
                              {port}
                            </div>
                            <div className="text-xs truncate" style={{ color: isEmpty ? '#22c55e' : 'var(--text-primary)' }}>
                              {isEmpty ? '空位' : seat.projectName || '？'}
                            </div>
                          </div>

                          {/* 退出按鈕 */}
                          {!isEmpty && entry && (
                            <button
                              onClick={async () => {
                                setStationLoading(prev => ({ ...prev, [entry.projectId]: true }))
                                try {
                                  await fetch('/api/projects', {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ projectId: entry.projectId, action: 'remove-from-dev' }),
                                  })
                                  await handleRegistered()
                                } finally {
                                  setStationLoading(prev => ({ ...prev, [entry.projectId]: false }))
                                }
                              }}
                              disabled={isLoading}
                              className="ml-2 px-2 py-1 rounded text-xs font-semibold transition-all duration-200 hover:shadow-md hover:scale-[1.05] disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                              style={{ backgroundColor: '#3d1515', color: '#ef4444', border: '1px solid #5c2020' }}
                              title="離開 Station"
                            >
                              {isLoading ? (
                                <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                              ) : (
                                <i className="fa-solid fa-minus" />
                              )}
                            </button>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

            </div>

            {/* 審計 Section */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>登記審計</h2>

              {/* 審計統計 */}
              {auditStats && (
                <div className="grid grid-cols-2 gap-3 mb-6">
                  {[
                    { label: '總專案', value: auditStats.total },
                    { label: 'package.json', value: auditStats.packageJsonOk, highlight: auditStats.packageJsonOk === auditStats.total, warn: auditStats.packageJsonOk < auditStats.total },
                  ].map(({ label, value, highlight, warn }) => (
                    <div
                      key={label}
                      className="rounded-[var(--radius-small)] px-3 py-2"
                      style={{ backgroundColor: 'var(--background-tertiary)', border: '1px solid var(--border-color)' }}
                    >
                      <div className="text-sm mb-1" style={{ color: 'var(--text-tertiary)' }}>{label}</div>
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
                    const pkgNeedsFix = entry.packageJson !== 'correct' && entry.packageJson !== 'no-file'
                    const pkgFixing = fixingItems.has(`${entry.path}:fix-package-json`)

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
                          <span className="font-mono font-medium text-sm w-10 shrink-0" style={{ color: 'var(--text-tertiary)' }}>{entry.port}</span>
                          <span className="truncate block font-medium">{entry.name}</span>
                        </div>
                        {/* 右側：審計結果 + 修復按鈕 */}
                        <div className="flex items-center gap-1.5 shrink-0" title={entry.packageJsonDetail}>
                          <i className={`${pkgIcon.icon} text-[10px]`} style={{ color: pkgIcon.color }} />
                          <span className="text-sm" style={{ color: pkgIcon.color }}>
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
                      </div>
                    )
                  })
                )}
              </div>

              {/* 說明 */}
              {auditStats && (
                <div
                  className="mt-4 px-3 py-2 rounded-[var(--radius-small)] text-sm"
                  style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)' }}
                >
                  審計檢查 package.json 的 scripts.dev 是否包含正確的 -p flag，以 JSON devPort 為唯一 source of truth。
                </div>
              )}
            </div>

            {/* 城市 Section - 移到最下面 */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>城市</h2>
              {citiesLoaded ? (
                <div className="space-y-6">
                  <CityBlock name="Brickverse" color="#3b82f6" projects={cityProjects} allEntries={allEntries} onEnterStation={() => {}} onRegistered={handleRegistered} />
                  <CityBlock name="CourseFiles" color="#f97316" projects={cityCourseFiles} allEntries={allEntries} onEnterStation={() => {}} onRegistered={handleRegistered} />
                  <CityBlock name="UtilityTools" color="#a855f7" projects={cityUtilityTools} allEntries={allEntries} onEnterStation={() => {}} onRegistered={handleRegistered} />
                </div>
              ) : (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={`loading-city-block-${i}`} className="space-y-2">
                      <div className="h-5 w-24 rounded animate-pulse" style={{ backgroundColor: 'var(--background-tertiary)' }} />
                      <div className="space-y-1.5">
                        {[...Array(3 + i)].map((_, j) => (
                          <div key={`loading-city-${j}`} className="flex items-center gap-3 py-1.5">
                            <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--background-tertiary)' }} />
                            <div className="h-4 rounded animate-pulse" style={{ backgroundColor: 'var(--background-tertiary)', width: `${100 + j * 20}px` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      </div>
        </div>
      </div>
    </div>
  )
}

// --- Sub-components ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-[var(--radius-medium)] p-4"
      style={{ backgroundColor: 'var(--background-secondary)', border: '1px solid var(--border-color)' }}
    >
      <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>{title}</h2>
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
          className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
          style={{ backgroundColor: color + '20', color }}
        >
          {number}
        </div>
        <div className="flex flex-col">
          <div className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
            {title}
          </div>
          <div className="text-sm" style={{ color }}>{role}</div>
        </div>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
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
          className="w-6 h-6 rounded flex items-center justify-center text-sm font-bold shrink-0"
          style={{ backgroundColor: color + '20', color }}
        >
          {tier}
        </div>
        <div className="text-base font-medium" style={{ color }}>{label}</div>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
    </div>
  )
}

function FlowStep({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 items-start">
      <span
        className="w-6 h-6 rounded flex items-center justify-center text-sm font-mono font-bold shrink-0 mt-0.5"
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
function RegisterButton({ onClick, loading, disabled, title }: { onClick: () => void; loading: boolean; disabled?: boolean; title?: string }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick() }}
      disabled={loading || disabled}
      className="px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-200 hover:shadow-md hover:scale-[1.02] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
      style={{ backgroundColor: '#332815', color: '#f59e0b', border: '1px solid #4a3520' }}
      title={title || "報戶口進入 Station"}
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
      className="px-2 py-1 rounded-lg text-xs font-semibold transition-all duration-200 hover:shadow-md hover:scale-[1.02] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
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

function ResidentCard({ name, tier, port, showPort = false, framework, onRegister, onUnregister, onEnterStation }: {
  name: string; tier: 2 | 3 | 4; port?: number; showPort?: boolean; framework?: string
  onRegister?: () => Promise<void>; onUnregister?: () => Promise<void>; onEnterStation?: () => void
}) {
  const [loading, setLoading] = useState(false)
  const isStation = tier >= 3
  const isNonNextJs = !!(framework && framework !== 'nextjs')

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
        <span className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>{name}</span>
      </div>
      {showPort && port && <PortTag port={port} />}
      {/* Tier 2: 顯示「+」報戶口（非 Next.js 框架 disabled） */}
      {tier === 2 && onRegister && (
        <RegisterButton
          onClick={() => handleAction(onRegister)}
          loading={loading}
          disabled={isNonNextJs}
          title={isNonNextJs ? `${framework} 框架不支援 npm dev` : undefined}
        />
      )}
      {/* Tier 3/4: 顯示「−」退出 Station（不用 hover，直接顯示） */}
      {isStation && onUnregister && (
        <UnregisterButton onClick={() => handleAction(onUnregister)} loading={loading} />
      )}
    </div>
  )
}

function DistrictBlock({ name, districtId, childProjects, allEntries, onRegister, onUnregister, onEnterStation }: {
  name: string
  districtId: string
  childProjects: { name: string; description: string; devPort?: number; framework?: string }[]
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
        className="px-3 py-1.5 text-sm font-semibold"
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
              tier={tier}
              port={child.devPort}
              showPort={false}
              framework={child.framework}
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
  const [registerMessage, setRegisterMessage] = useState<{ text: string; type: 'ok' | 'warn' } | null>(null)

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
    if (res.ok) {
      const data = await res.json()
      if (data.packageJsonStatus === 'updated') {
        setRegisterMessage({ text: '報戶口完成，package.json 已同步', type: 'ok' })
      } else if (data.packageJsonStatus?.startsWith('skipped-')) {
        // html/python/swift 等老人家，不需要 package.json 更新
        setRegisterMessage(null)
      } else {
        setRegisterMessage({ text: `package.json 未更新（${data.packageJsonStatus}），請到「登記審計」手動修復`, type: 'warn' })
      }
      await onRegistered()
      setTimeout(() => setRegisterMessage(null), 5000)
    }
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
      {/* Flash message */}
      {registerMessage && (
        <div className={`text-xs px-3 py-1.5 ${
          registerMessage.type === 'ok'
            ? 'bg-green-500/10 text-green-400'
            : 'bg-yellow-500/10 text-yellow-400'
        }`}>
          {registerMessage.text}
        </div>
      )}

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
                  tier={tier}
                  port={project.devPort}
                  showPort={false}
                  framework={project.framework}
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
