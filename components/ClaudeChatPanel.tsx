'use client'

import { useState, useCallback, useRef, forwardRef } from 'react'
import ChatContent, { ContentsRate } from '@/components/ChatContent'
import type { PanelStatus, ChatContentHandle } from '@/components/ChatContent'
import { useChatPanels } from '@/contexts/ChatPanelsContext'

interface ClaudeChatPanelProps {
  projectId: string
  projectName: string
  panelId?: string
  isFixed?: boolean
  planOnly?: boolean
  emailMode?: boolean
  docsMode?: boolean
  model?: string
  sessionId?: string
  initialMessage?: string
  initialMode?: 'plan' | 'edit'
  ephemeral?: boolean
  theme?: 'default' | 'green'
  systemPrompt?: string
  scratchItemId?: string
  onClose?: () => void
}

const ClaudeChatPanel = forwardRef<ChatContentHandle, ClaudeChatPanelProps>(function ClaudeChatPanel({ projectId, projectName, panelId, isFixed, planOnly, emailMode, docsMode, model, sessionId, initialMessage, initialMode, ephemeral, theme = 'default', systemPrompt, scratchItemId, onClose }, ref) {
  const { duplicatePanel, updatePanelSession } = useChatPanels()
  const [chatKey, setChatKey] = useState(0)
  const [isClearing, setIsClearing] = useState(false)
  const [scratchResolved, setScratchResolved] = useState(false)
  const [tokenMeta, setTokenMeta] = useState({ totalInputTokens: 0, totalOutputTokens: 0, lastDurationMs: undefined as number | undefined })
  const handleSessionMetaChange = useCallback((meta: { totalInputTokens: number; totalOutputTokens: number; lastDurationMs?: number }) => {
    setTokenMeta({ totalInputTokens: meta.totalInputTokens, totalOutputTokens: meta.totalOutputTokens, lastDurationMs: meta.lastDurationMs })
  }, [])
  const [panelStatus, setPanelStatus] = useState<PanelStatus>('idle')

  const clearingRef = useRef<HTMLDivElement>(null)

  const currentSessionIdRef = useRef<string | undefined>(sessionId)

  const handleSessionChange = useCallback((newSessionId: string) => {
    currentSessionIdRef.current = newSessionId
    if (panelId) updatePanelSession(panelId, newSessionId)
  }, [panelId, updatePanelSession])

  const handleResolve = useCallback(async () => {
    if (!scratchItemId || scratchResolved) return
    setScratchResolved(true)
    try {
      await fetch('/api/scratch-pad', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: scratchItemId,
          done: true,
          resolvedSessionId: currentSessionIdRef.current || undefined,
        }),
      })
    } catch { /* ignore */ }
  }, [scratchItemId, scratchResolved])

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

  return (
    <div
      className="h-full flex flex-col min-w-0"
      style={{
        borderRadius: 6,
        padding: '6px 8px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h2
          className={`font-semibold text-lg truncate ${panelStatus === 'streaming' ? 'shimmer-text' : ''}`}
          style={{
            color: panelStatus === 'completed' ? '#22c55e'
              : panelStatus === 'waiting' ? '#facc15'
              : 'var(--text-primary)',
            transition: panelStatus === 'streaming' ? 'none' : 'color 0.3s ease',
          }}
        >
          {docsMode ? '技術文件助手' : emailMode ? 'Email 回覆' : projectName}
        </h2>
        <div className="flex items-center gap-1 flex-shrink-0">
          <ContentsRate inputTokens={tokenMeta.totalInputTokens} outputTokens={tokenMeta.totalOutputTokens} lastDurationMs={tokenMeta.lastDurationMs} />
          {scratchItemId && !scratchResolved && (
            <button
              onClick={handleResolve}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors cursor-pointer"
              style={{ backgroundColor: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(74,222,128,0.2)' }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(74,222,128,0.1)' }}
              title="標記此待辦事項為已解決"
            >
              <i className="fa-solid fa-check" style={{ fontSize: '10px' }} />
              已解決
            </button>
          )}
          {scratchItemId && scratchResolved && (
            <span className="flex items-center gap-1 px-2 py-1 rounded-md text-xs" style={{ color: '#4ade80', opacity: 0.6 }}>
              <i className="fa-solid fa-circle-check" style={{ fontSize: '10px' }} />
              已解決
            </span>
          )}
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
              <i className="fa-solid fa-xmark" />
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
          docsMode={docsMode}
          model={model}
          resumeSessionId={clearedSession ? undefined : sessionId}
          initialMessage={initialMessage}
          initialMode={initialMode}
          ephemeral={ephemeral}
          systemPrompt={systemPrompt}
          onSessionIdChange={handleSessionChange}
          onSessionMetaChange={handleSessionMetaChange}
          onPanelStatusChange={setPanelStatus}
          ref={ref}
        />
      </div>
    </div>
  )
})

export default ClaudeChatPanel
