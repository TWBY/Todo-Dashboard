'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ChatSessionRecord } from '@/lib/claude-chat-types'

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const d = new Date(timestamp)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function isToday(timestamp: number): boolean {
  const d = new Date(timestamp)
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
}

function isYesterday(timestamp: number): boolean {
  const d = new Date(timestamp)
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  return d.getFullYear() === yesterday.getFullYear() && d.getMonth() === yesterday.getMonth() && d.getDate() === yesterday.getDate()
}

interface ChatHistoryProps {
  projectId: string
  currentSessionId: string | null
  onResumeSession: (sessionId: string) => void
}

export default function ChatHistory({ projectId, currentSessionId, onResumeSession }: ChatHistoryProps) {
  const [sessions, setSessions] = useState<ChatSessionRecord[]>([])
  const [expanded, setExpanded] = useState(false)

  const fetchSessions = useCallback(() => {
    fetch(`/api/claude-chat/history?projectId=${encodeURIComponent(projectId)}`)
      .then(r => r.json())
      .then(data => setSessions(data.sessions || []))
      .catch(() => {})
  }, [projectId])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const todaySessions = sessions.filter(s => isToday(s.lastActiveAt))
  const yesterdaySessions = sessions.filter(s => isYesterday(s.lastActiveAt))
  const olderSessions = sessions.filter(s => !isToday(s.lastActiveAt) && !isYesterday(s.lastActiveAt))

  return (
    <div className="flex-shrink-0 mb-2">
      {/* Toggle bar */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center gap-1.5 py-1 px-1 text-sm transition-colors hover:bg-white/5 rounded"
        style={{ color: '#666666' }}
      >
        <svg
          width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
          style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 150ms' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        History
        {sessions.length > 0 && (
          <span style={{ color: '#444444' }}>({sessions.length})</span>
        )}
      </button>

      {expanded && (
        <div
          className="mt-1 rounded overflow-hidden"
          style={{ border: '1px solid #222222', backgroundColor: '#0a0a0a' }}
        >
          {/* Sessions list */}
          <div className="max-h-[200px] overflow-y-auto">
            {sessions.length === 0 && (
              <div className="px-3 py-3 text-sm text-center" style={{ color: '#444444' }}>
                No recent sessions
              </div>
            )}

            {todaySessions.length > 0 && (
              <>
                <div className="px-2.5 pt-2 pb-1 text-sm font-semibold uppercase tracking-wider" style={{ color: '#444444' }}>
                  Today
                </div>
                {todaySessions.map(s => (
                  <SessionEntry
                    key={s.sessionId}
                    session={s}
                    isActive={currentSessionId === s.sessionId}
                    onSelect={() => { onResumeSession(s.sessionId); setExpanded(false) }}
                  />
                ))}
              </>
            )}

            {yesterdaySessions.length > 0 && (
              <>
                <div className="px-2.5 pt-2 pb-1 text-sm font-semibold uppercase tracking-wider" style={{ color: '#444444' }}>
                  Yesterday
                </div>
                {yesterdaySessions.map(s => (
                  <SessionEntry
                    key={s.sessionId}
                    session={s}
                    isActive={currentSessionId === s.sessionId}
                    onSelect={() => { onResumeSession(s.sessionId); setExpanded(false) }}
                  />
                ))}
              </>
            )}

            {olderSessions.length > 0 && (
              <>
                <div className="px-2.5 pt-2 pb-1 text-sm font-semibold uppercase tracking-wider" style={{ color: '#444444' }}>
                  Earlier
                </div>
                {olderSessions.map(s => (
                  <SessionEntry
                    key={s.sessionId}
                    session={s}
                    isActive={currentSessionId === s.sessionId}
                    onSelect={() => { onResumeSession(s.sessionId); setExpanded(false) }}
                  />
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SessionEntry({ session, isActive, onSelect }: {
  session: ChatSessionRecord
  isActive: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-2.5 py-1.5 flex items-center gap-2 transition-colors hover:bg-white/5"
      style={{
        backgroundColor: isActive ? 'rgba(255,255,255,0.08)' : 'transparent',
      }}
    >
      <div className="flex-1 min-w-0">
        <div
          className="text-sm truncate"
          style={{ color: isActive ? '#ffffff' : '#bbbbbb' }}
          title={session.title}
        >
          {session.title}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-sm" style={{ color: '#555555' }}>
          {session.messageCount} msg
        </span>
        <span className="text-sm w-12 text-right" style={{ color: '#444444' }}>
          {relativeTime(session.lastActiveAt)}
        </span>
      </div>
    </button>
  )
}
