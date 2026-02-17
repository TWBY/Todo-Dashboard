'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import type { TeamMember, TeamTask, TeamMessage } from '@/lib/claude-chat-types'
import { useTeamMonitor } from '@/hooks/useTeamMonitor'

// ── 成員顏色 ──
const MEMBER_COLORS: Record<string, string> = {
  blue: '#58a6ff',
  green: '#3fb950',
  yellow: '#d29922',
  red: '#f85149',
  purple: '#bc8cff',
}

function getMemberColor(color?: string): string {
  if (!color) return '#8b949e'
  return MEMBER_COLORS[color] || color
}

// ── Activity Simulation 模板 ──
const ACTIVITY_TEMPLATES: Record<string, string[]> = {
  investigate: [
    'Reading ClaudeProcessManager.swift...',
    'Analyzing exit code paths...',
    'Tracing signal handler registration...',
    'Checking process lifecycle hooks...',
    'Inspecting AsyncStream termination...',
    'Reading bridge.mjs execution flow...',
    'Analyzing EOF handler behavior...',
  ],
  research: [
    'Searching Apple Developer Forums...',
    'Reading SwiftUI MenuBarExtra docs...',
    'Analyzing StackOverflow results...',
    'Reviewing GitHub issues...',
    'Scanning WWDC session notes...',
    'Reading structured concurrency docs...',
    'Checking swift-async-algorithms...',
  ],
  test: [
    'Building test harness with Xcode...',
    'Running minimal reproduction app...',
    'Comparing stdout vs stderr capture...',
    'Profiling memory allocation...',
    'Validating hypothesis with mock process...',
    'Compiling MenuBarTestApp.swift...',
    'Monitoring process exit behavior...',
  ],
  default: [
    'Reading source files...',
    'Analyzing code patterns...',
    'Searching codebase...',
    'Reviewing documentation...',
    'Processing results...',
    'Checking dependencies...',
    'Examining configuration...',
  ],
}

function getTemplateKey(desc: string): string {
  const lower = desc.toLowerCase()
  if (lower.includes('調查') || lower.includes('investigat') || lower.includes('分析')) return 'investigate'
  if (lower.includes('搜尋') || lower.includes('research') || lower.includes('文獻')) return 'research'
  if (lower.includes('測試') || lower.includes('test') || lower.includes('驗證')) return 'test'
  return 'default'
}

// ── Activity Simulator Hook ──
function useActivitySimulator(members: TeamMember[], tasks: TeamTask[]) {
  const [activities, setActivities] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (members.length === 0) {
      setActivities(new Map())
      return
    }

    const memberTemplates = members.map(m => {
      const task = tasks.find(t => t.owner === m.name)
      const key = task ? getTemplateKey(task.description) : 'default'
      return { name: m.name, templates: ACTIVITY_TEMPLATES[key] }
    })

    const initial = new Map<string, string>()
    memberTemplates.forEach(({ name, templates }) => {
      initial.set(name, templates[0])
    })
    setActivities(initial)

    const counters = new Map<string, number>()
    memberTemplates.forEach(({ name }) => counters.set(name, 0))

    const intervals = memberTemplates.map(({ name, templates }, idx) => {
      const member = members.find(m => m.name === name)
      const isWorking = member?.status === 'working'
      const interval = isWorking ? 1500 : 4000
      return setInterval(() => {
        const count = (counters.get(name) || 0) + 1
        counters.set(name, count)
        setActivities(prev => {
          const next = new Map(prev)
          next.set(name, templates[count % templates.length])
          return next
        })
      }, interval + idx * 200)
    })

    return () => intervals.forEach(clearInterval)
  }, [members, tasks])

  return activities
}

// ── Progressive Reveal Hook（僅用於 Messages） ──
function useProgressiveReveal(allMessages: TeamMessage[]) {
  const [visibleCount, setVisibleCount] = useState(0)
  const hasRevealedRef = useRef(false)
  const prevLenRef = useRef(0)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    if (allMessages.length === 0) return
    if (hasRevealedRef.current && allMessages.length === prevLenRef.current) return

    if (hasRevealedRef.current && allMessages.length > prevLenRef.current) {
      prevLenRef.current = allMessages.length
      setVisibleCount(allMessages.length)
      return
    }

    hasRevealedRef.current = true
    prevLenRef.current = allMessages.length
    setVisibleCount(0)

    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    let delay = 600 // 先讓 Members + Tasks 有時間顯示
    allMessages.forEach((_, i) => {
      delay += 400 + Math.min((allMessages[i].summary?.length || 0) * 2, 300)
      const timer = setTimeout(() => setVisibleCount(i + 1), delay)
      timersRef.current.push(timer)
    })

    return () => {
      timersRef.current.forEach(clearTimeout)
      timersRef.current = []
    }
  }, [allMessages])

  return {
    visibleMessages: allMessages.slice(0, visibleCount),
    isRevealing: visibleCount < allMessages.length,
  }
}

// ══════════════════════════════════════════════
// SECTION 1: Members
// ══════════════════════════════════════════════
function MembersList({
  members,
  activities,
}: {
  members: TeamMember[]
  activities: Map<string, string>
}) {
  return (
    <div className="space-y-1">
      {members.map(m => {
        const color = getMemberColor(m.color)
        const isWorking = m.status === 'working'
        const isShutdown = m.status === 'shutdown'
        const activity = activities.get(m.name)

        return (
          <div
            key={m.name}
            className="flex items-start gap-2 py-1"
            style={{ opacity: isShutdown ? 0.35 : 1 }}
          >
            {/* 狀態點 */}
            <span className="relative flex h-1.5 w-1.5 mt-[5px] flex-shrink-0">
              {isWorking && (
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: color }}
                />
              )}
              <span
                className="relative inline-flex rounded-full h-1.5 w-1.5"
                style={{ backgroundColor: isWorking ? color : isShutdown ? '#333' : '#555' }}
              />
            </span>

            {/* 名稱 + 活動 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className="text-[14px] font-medium"
                  style={{
                    color: isWorking ? color : '#8b949e',
                    textDecoration: isShutdown ? 'line-through' : undefined,
                  }}
                >
                  {m.name}
                </span>
                <span className="text-[12px]" style={{ color: isWorking ? '#555' : '#333' }}>
                  {isWorking ? 'working' : isShutdown ? 'done' : 'idle'}
                </span>
              </div>
              {activity && (
                <div
                  key={activity}
                  className={`text-[13px] mt-0.5 truncate ${isWorking ? 'shimmer-text team-activity-line' : ''}`}
                  style={{ color: isWorking ? '#555' : '#333' }}
                >
                  {activity}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════
// SECTION 2: Tasks
// ══════════════════════════════════════════════
function TasksList({ tasks, members }: { tasks: TeamTask[]; members: TeamMember[] }) {
  return (
    <div className="space-y-1">
      {tasks.map(t => {
        const ownerMember = members.find(m => m.name === t.owner)
        const color = getMemberColor(ownerMember?.color)
        const isCompleted = t.status === 'completed'
        const isInProgress = t.status === 'in_progress'

        return (
          <div key={t.id} className="flex items-center gap-2 py-0.5">
            {/* 狀態 icon */}
            <span className="w-3 flex-shrink-0 flex items-center justify-center">
              {isCompleted && (
                <i className="fa-solid fa-check text-[10px]" style={{ color: '#3fb950' }} />
              )}
              {isInProgress && (
                <i className="fa-solid fa-circle shimmer-dot text-[5px]" style={{ color: '#58a6ff' }} />
              )}
              {!isCompleted && !isInProgress && (
                <span className="w-2 h-2 rounded-full" style={{ border: '1px solid #444' }} />
              )}
            </span>

            {/* 任務描述 */}
            <span
              className={`text-[14px] flex-1 min-w-0 truncate ${isCompleted ? 'line-through' : ''}`}
              style={{ color: isCompleted ? '#555' : '#999' }}
            >
              {t.description}
            </span>

            {/* 指派人 */}
            {t.owner && (
              <span className="text-[12px] flex-shrink-0" style={{ color }}>
                {t.owner}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════
// SECTION 3: Messages
// ══════════════════════════════════════════════
function MessageItem({ msg, members, isLatest }: {
  msg: TeamMessage
  members: TeamMember[]
  isLatest: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const senderMember = members.find(m => m.name === msg.from)
  const color = getMemberColor(senderMember?.color)
  const hasDetail = !!msg.text

  return (
    <div
      className={`team-msg-enter py-2.5 ${hasDetail ? 'cursor-pointer' : ''}`}
      onClick={hasDetail ? () => setExpanded(!expanded) : undefined}
    >
      {/* sender → recipient + time */}
      <div className="flex items-center gap-1.5">
        <span className="text-[14px] font-semibold" style={{ color }}>
          {msg.from}
        </span>
        {msg.to && (
          <>
            <i className="fa-solid fa-arrow-right text-[7px]" style={{ color: '#333' }} />
            <span className="text-[14px]" style={{ color: '#666' }}>{msg.to}</span>
          </>
        )}
        <span className="text-[12px] ml-auto font-mono flex-shrink-0" style={{ color: '#333' }}>
          {new Date(msg.timestamp).toLocaleTimeString('zh-TW', {
            hour: '2-digit', minute: '2-digit',
          })}
        </span>
      </div>

      {/* Summary */}
      <div
        className={`text-[14px] leading-relaxed mt-1 ${isLatest ? 'streaming-word-reveal' : ''}`}
        style={{ color: '#c9d1d9' }}
      >
        {msg.summary}
      </div>

      {/* 展開提示 */}
      {hasDetail && !expanded && (
        <div className="flex items-center gap-1 mt-1" style={{ color: '#333' }}>
          <i className="fa-solid fa-chevron-down text-[7px]" />
          <span className="text-[12px]">詳細內容</span>
        </div>
      )}

      {/* 展開的完整訊息 */}
      {expanded && msg.text && (
        <div
          className="mt-2 text-xs leading-relaxed whitespace-pre-wrap rounded-md p-2.5 animate-fade-in"
          style={{
            color: '#7a8490',
            backgroundColor: '#080b10',
            border: '1px solid #151a22',
            maxHeight: '300px',
            overflowY: 'auto',
          }}
        >
          {msg.text.slice(0, 800)}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════
// Main Panel
// ══════════════════════════════════════════════
interface TeamMonitorPanelProps {
  teamName: string
  panelId?: string
  onClose?: () => void
}

export default function TeamMonitorPanel({ teamName, panelId, onClose }: TeamMonitorPanelProps) {
  const { data } = useTeamMonitor(teamName || null)
  const [elapsed, setElapsed] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  // 用面板 mount 時間作為起點（不是團隊建立時間）
  const mountTimeRef = useRef(Date.now())

  // Elapsed timer — 從面板開啟時開始計時
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - mountTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Progressive reveal（僅用於 Messages）
  const { visibleMessages, isRevealing } = useProgressiveReveal(data?.messages || [])

  // Activity simulation
  const activities = useActivitySimulator(data?.members || [], data?.tasks || [])

  // Auto-scroll messages
  useEffect(() => {
    const el = scrollRef.current
    if (el && isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [visibleMessages.length])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }, [])

  const elapsedStr = elapsed >= 60
    ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`
    : `${elapsed}s`

  return (
    <div
      className="h-full flex flex-col min-w-0"
      style={{ borderRadius: 6, padding: '6px 8px' }}
    >
      {/* Header */}
      <div className="flex-shrink-0 pb-2 mb-2" style={{ borderBottom: '1px solid #151a22' }}>
        {/* Top Row: Title + Close Button */}
        <div className="flex items-center justify-between mb-1.5">
          <h2 className="font-semibold text-lg truncate" style={{ color: '#c9d1d9' }}>
            Team: {teamName}
          </h2>
          {onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-white/10 flex-shrink-0"
              style={{ color: 'var(--text-tertiary)' }}
              title="關閉"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Bottom Row: Stats + Status + Timer */}
        <div className="flex items-center justify-between">
          {data && (
            <span className="text-[12px]" style={{ color: '#484f58' }}>
              {data.members.length} members · {data.tasks.length} tasks
            </span>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            {data?.isActive && (
              <span className="flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#58a6ff' }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: '#58a6ff' }} />
                </span>
                <span className="text-[12px]" style={{ color: '#58a6ff' }}>執行中</span>
              </span>
            )}
            <span className="text-[12px] font-mono" style={{ color: '#484f58' }}>
              {elapsedStr}
            </span>
          </div>
        </div>
      </div>

      {/* Loading */}
      {!data && (
        <div className="flex-1 flex items-center justify-center">
          <span className="streaming-status-text text-sm" style={{ color: '#484f58' }}>載入團隊資料...</span>
        </div>
      )}

      {data && (
        <>
          {/* ── Section 1: Members ── */}
          <div className="flex-shrink-0 pb-2 mb-2" style={{ borderBottom: '1px solid #151a22' }}>
            <div className="text-[12px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#333' }}>
              Members
            </div>
            <MembersList members={data.members} activities={activities} />
          </div>

          {/* ── Section 2: Tasks ── */}
          <div className="flex-shrink-0 pb-2 mb-2" style={{ borderBottom: '1px solid #151a22' }}>
            <div className="text-[12px] font-medium uppercase tracking-wider mb-1.5" style={{ color: '#333' }}>
              Tasks
            </div>
            <TasksList tasks={data.tasks} members={data.members} />
          </div>

          {/* ── Section 3: Messages ── */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="text-[12px] font-medium uppercase tracking-wider mb-1.5 flex-shrink-0" style={{ color: '#333' }}>
              Messages
              {visibleMessages.length > 0 && (
                <span className="ml-1.5 normal-case tracking-normal" style={{ color: '#2a2a2a' }}>
                  ({visibleMessages.length})
                </span>
              )}
            </div>

            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
            >
              {visibleMessages.map((msg, i) => (
                <MessageItem
                  key={`${msg.from}-${msg.timestamp}`}
                  msg={msg}
                  members={data.members}
                  isLatest={i === visibleMessages.length - 1 && isRevealing}
                />
              ))}

              {/* Typing indicator */}
              {isRevealing && (
                <div className="flex items-center gap-1.5 py-2" style={{ color: '#484f58' }}>
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full inline-block shimmer-dot" style={{ backgroundColor: '#58a6ff' }} />
                    <span className="w-1 h-1 rounded-full inline-block shimmer-dot" style={{ backgroundColor: '#58a6ff', animationDelay: '0.2s' }} />
                    <span className="w-1 h-1 rounded-full inline-block shimmer-dot" style={{ backgroundColor: '#58a6ff', animationDelay: '0.4s' }} />
                  </span>
                </div>
              )}

              {/* 空狀態 */}
              {!isRevealing && visibleMessages.length === 0 && (
                <div className="text-[14px] py-2" style={{ color: '#333' }}>
                  等待訊息...
                </div>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  )
}
