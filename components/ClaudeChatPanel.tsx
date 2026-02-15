'use client'

import { useState, useCallback, useRef } from 'react'
import ChatContent, { ContentsRate } from '@/components/ChatContent'
import type { PanelStatus } from '@/components/ChatContent'
import { useChatPanels } from '@/contexts/ChatPanelsContext'

interface ClaudeChatPanelProps {
  projectId: string
  projectName: string
  panelId?: string
  isFixed?: boolean
  planOnly?: boolean
  emailMode?: boolean
  model?: string
  sessionId?: string
  initialMessage?: string
  initialMode?: 'plan' | 'edit' | 'ask'
  theme?: 'default' | 'green'
  onClose?: () => void
}

export default function ClaudeChatPanel({ projectId, projectName, panelId, isFixed, planOnly, emailMode, model, sessionId, initialMessage, initialMode, theme = 'default', onClose }: ClaudeChatPanelProps) {
  const { duplicatePanel, updatePanelSession } = useChatPanels()
  const [chatKey, setChatKey] = useState(0)
  const [isClearing, setIsClearing] = useState(false)
  const [tokenMeta, setTokenMeta] = useState({ totalInputTokens: 0, totalOutputTokens: 0 })
  const [panelStatus, setPanelStatus] = useState<PanelStatus>('idle')

  const clearingRef = useRef<HTMLDivElement>(null)

  const handleSessionChange = useCallback((newSessionId: string) => {
    if (panelId) updatePanelSession(panelId, newSessionId)
  }, [panelId, updatePanelSession])

  // 清除後不再自動恢復舊 session
  const [clearedSession, setClearedSession] = useState(false)

  const handleClear = useCallback(() => {
    if (isClearing) return
    setIsClearing(true)
    setClearedSession(true)
    // fallback: 若 transitionEnd 未觸發，300ms 後強制清除
    setTimeout(() => {
      setChatKey(k => k + 1)
      setIsClearing(false)
    }, 300)
  }, [isClearing])

  const handleTransitionEnd = useCallback((e: React.TransitionEvent) => {
    if (!isClearing) return
    // 只處理自身的 transition，忽略子元素冒泡
    if (e.target !== clearingRef.current) return
    setChatKey(k => k + 1)
    setIsClearing(false)
  }, [isClearing])

  const effectiveTheme = theme

  return (
    <div
      className={`h-full flex flex-col min-w-0 ${panelStatus === 'waiting' ? (effectiveTheme === 'green' ? 'panel-breathing-green' : 'panel-breathing') : ''}`}
      style={{
        border: panelStatus === 'waiting'
          ? `1.5px solid ${effectiveTheme === 'green' ? '#22c55e' : '#facc15'}`
          : panelStatus === 'completed' ? '1.5px solid #22c55e'
          : `1.5px solid ${effectiveTheme === 'green' ? 'rgba(34,197,94,0.15)' : 'transparent'}`,
        borderRadius: 6,
        transition: panelStatus === 'waiting' ? 'none' : 'border-color 0.3s ease',
        padding: '6px 8px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h2 className="font-semibold text-lg truncate" style={{ color: 'var(--text-primary)' }}>
          {emailMode ? 'Email 回覆' : projectName}
        </h2>
        <div className="flex items-center gap-1 flex-shrink-0">
          <ContentsRate inputTokens={tokenMeta.totalInputTokens} outputTokens={tokenMeta.totalOutputTokens} />
          {panelId && (
            <button
              onClick={() => duplicatePanel(panelId)}
              className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ color: 'var(--text-tertiary)' }}
              title="複製面板"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
          )}
          <button
            onClick={handleClear}
            className="w-8 h-8 rounded-md flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: 'var(--text-tertiary)' }}
            title="清除對話"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18"/>
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            </svg>
          </button>
          {!isFixed && onClose && (
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-md flex items-center justify-center text-sm transition-colors hover:bg-red-500/20"
              style={{ color: 'var(--text-tertiary)' }}
              title="關閉"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Chat body */}
      <div
        ref={clearingRef}
        className={`flex-1 min-h-0 ${isClearing ? 'chat-clearing' : ''}`}
        onTransitionEnd={handleTransitionEnd}
      >
        <ChatContent
          key={`${projectId}-${chatKey}`}
          projectId={projectId}
          projectName={projectName}
          planOnly={planOnly}
          emailMode={emailMode}
          model={model}
          resumeSessionId={clearedSession ? undefined : sessionId}
          initialMessage={initialMessage}
          initialMode={initialMode}
          onSessionIdChange={handleSessionChange}
          onSessionMetaChange={setTokenMeta}
          onPanelStatusChange={setPanelStatus}
        />
      </div>
    </div>
  )
}
