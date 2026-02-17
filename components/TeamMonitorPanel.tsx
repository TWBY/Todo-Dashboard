'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { TeamMember, TeamTask, TeamMessage, TeamSystemEvent } from '@/lib/claude-chat-types'
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

// ── 從任務狀態衍生真實活動描述 ──
function getMemberActivity(member: TeamMember, tasks: TeamTask[]): string | null {
  if (member.status === 'shutdown') return null
  const activeTask = tasks.find(t => t.owner === member.name && t.status === 'in_progress')
  if (activeTask) return activeTask.description
  const completedCount = tasks.filter(t => t.owner === member.name && t.status === 'completed').length
  if (completedCount > 0) return `已完成 ${completedCount} 項任務`
  if (member.status === 'working') return '啟動中...'
  return null
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

    let delay = 600
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
  tasks,
}: {
  members: TeamMember[]
  tasks: TeamTask[]
}) {
  return (
    <div className="space-y-1">
      {members.map(m => {
        const color = getMemberColor(m.color)
        const isWorking = m.status === 'working'
        const isShutdown = m.status === 'shutdown'
        const activity = getMemberActivity(m, tasks)

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
// SECTION 3: Messages + System Events
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

function SystemEventItem({ event }: { event: TeamSystemEvent }) {
  const isShutdown = event.type === 'shutdown'
  return (
    <div className="flex items-center gap-2 py-1.5" style={{ color: '#484f58' }}>
      <i className={`fa-solid ${isShutdown ? 'fa-power-off' : 'fa-pause'} text-[9px]`} />
      <span className="text-[12px] flex-1 min-w-0 truncate">{event.summary}</span>
      <span className="text-[11px] font-mono flex-shrink-0">
        {new Date(event.timestamp).toLocaleTimeString('zh-TW', {
          hour: '2-digit', minute: '2-digit',
        })}
      </span>
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
  const { data, markInactive } = useTeamMonitor(teamName || null)
  const [elapsed, setElapsed] = useState(0)
  const [membersExpanded, setMembersExpanded] = useState(true)
  const [tasksExpanded, setTasksExpanded] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const mountTimeRef = useRef(Date.now())

  // Elapsed timer
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - mountTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Auto-detect all members shutdown → mark inactive
  useEffect(() => {
    if (!data || data.members.length === 0) return
    const allDone = data.members.every(m => m.status === 'shutdown' || m.status === 'idle')
    const hasShutdown = data.members.some(m => m.status === 'shutdown')
    if (allDone && hasShutdown && data.isActive) {
      markInactive()
    }
  }, [data, markInactive])

  // Merge messages + system events into timeline
  const timeline = (() => {
    if (!data) return []
    const items: Array<{ type: 'message' | 'event'; data: TeamMessage | TeamSystemEvent; timestamp: string }> = []
    for (const msg of data.messages) {
      items.push({ type: 'message', data: msg, timestamp: msg.timestamp })
    }
    for (const evt of data.systemEvents) {
      items.push({ type: 'event', data: evt, timestamp: evt.timestamp })
    }
    items.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    return items
  })()

  // Progressive reveal for timeline
  const { visibleMessages: visibleTimeline, isRevealing } = useProgressiveReveal(
    // Adapt timeline to TeamMessage shape for the hook
    timeline.map(item => item.type === 'message'
      ? item.data as TeamMessage
      : { from: (item.data as TeamSystemEvent).from, summary: (item.data as TeamSystemEvent).summary, timestamp: item.timestamp } as TeamMessage
    )
  )

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (el && isNearBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [visibleTimeline.length])

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

        <div className="flex items-center justify-between">
          {data && (
            <span className="text-[12px]" style={{ color: '#484f58' }}>
              {data.members.length} members · {data.tasks.length} tasks
            </span>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            {data?.isActive ? (
              <span className="flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#58a6ff' }} />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: '#58a6ff' }} />
                </span>
                <span className="text-[12px]" style={{ color: '#58a6ff' }}>執行中</span>
              </span>
            ) : data ? (
              <span className="flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: '#3fb950' }} />
                </span>
                <span className="text-[12px]" style={{ color: '#3fb950' }}>已完成</span>
              </span>
            ) : null}
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
          {/* ── Section 1: Members（可摺疊） ── */}
          <div className="flex-shrink-0 pb-2 mb-2" style={{ borderBottom: '1px solid #151a22' }}>
            <button
              onClick={() => setMembersExpanded(!membersExpanded)}
              className="w-full text-left text-[12px] font-medium uppercase tracking-wider transition-colors hover:text-text-primary"
              style={{ color: '#555' }}
            >
              <i className={`fa-solid fa-chevron-${membersExpanded ? 'down' : 'right'} text-[9px] mr-1.5`} />
              Members ({data.members.length})
            </button>
            {membersExpanded && (
              <div className="mt-1.5">
                <MembersList members={data.members} tasks={data.tasks} />
              </div>
            )}
          </div>

          {/* ── Section 2: Tasks（可摺疊） ── */}
          <div className="flex-shrink-0 pb-2 mb-2" style={{ borderBottom: '1px solid #151a22' }}>
            <button
              onClick={() => setTasksExpanded(!tasksExpanded)}
              className="w-full text-left text-[12px] font-medium uppercase tracking-wider transition-colors hover:text-text-primary"
              style={{ color: '#555' }}
            >
              <i className={`fa-solid fa-chevron-${tasksExpanded ? 'down' : 'right'} text-[9px] mr-1.5`} />
              Tasks ({data.tasks.length})
            </button>
            {tasksExpanded && (
              <div className="mt-1.5">
                <TasksList tasks={data.tasks} members={data.members} />
              </div>
            )}
          </div>

          {/* ── Section 3: Timeline (Messages + System Events) ── */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="text-[12px] font-medium uppercase tracking-wider mb-1.5 flex-shrink-0" style={{ color: '#333' }}>
              Messages
              {data.messages.length > 0 && (
                <span className="ml-1.5 normal-case tracking-normal" style={{ color: '#2a2a2a' }}>
                  ({data.messages.length})
                </span>
              )}
            </div>

            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
            >
              {visibleTimeline.map((item, i) => {
                const original = timeline[i]
                if (!original) return null
                if (original.type === 'event') {
                  return (
                    <SystemEventItem
                      key={`evt-${original.timestamp}`}
                      event={original.data as TeamSystemEvent}
                    />
                  )
                }
                return (
                  <MessageItem
                    key={`msg-${(original.data as TeamMessage).from}-${original.timestamp}`}
                    msg={original.data as TeamMessage}
                    members={data.members}
                    isLatest={i === visibleTimeline.length - 1 && isRevealing}
                  />
                )
              })}

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
              {!isRevealing && visibleTimeline.length === 0 && (
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
