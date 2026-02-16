'use client'

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'

const STORAGE_KEY = 'chat-panels-state'

export interface ChatPanelState {
  panelId: string
  projectId: string
  projectName: string
  sessionId?: string
  planOnly?: boolean
  emailMode?: boolean
  scratchItemId?: string
  initialMessage?: string
  initialMode?: 'plan' | 'edit'
  model?: string
  ephemeral?: boolean
}

interface AddPanelOpts {
  planOnly?: boolean
  emailMode?: boolean
  scratchItemId?: string
  initialMessage?: string
  initialMode?: 'plan' | 'edit'
  model?: string
  ephemeral?: boolean
}

/** 持久化時排除一次性欄位 */
interface PersistedPanelState {
  panelId: string
  projectId: string
  projectName: string
  sessionId?: string
  planOnly?: boolean
  emailMode?: boolean
  scratchItemId?: string
}

interface ChatPanelsContextValue {
  openPanels: ChatPanelState[]
  addPanel: (projectId: string, projectName: string, opts?: AddPanelOpts) => void
  removePanel: (panelId: string) => void
  duplicatePanel: (panelId: string) => void
  updatePanelSession: (panelId: string, sessionId: string) => void
}

function loadPanels(): ChatPanelState[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PersistedPanelState[]
    if (!Array.isArray(parsed)) return []
    // 基本驗證
    return parsed.filter(p => p.panelId && p.projectId && p.projectName)
  } catch {
    return []
  }
}

function savePanels(panels: ChatPanelState[]) {
  const persisted: PersistedPanelState[] = panels
    .filter(p => !p.ephemeral)
    .map(({ panelId, projectId, projectName, sessionId, planOnly, emailMode, scratchItemId }) => ({
      panelId, projectId, projectName, sessionId, planOnly, emailMode, scratchItemId,
    }))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persisted))
}

const ChatPanelsContext = createContext<ChatPanelsContextValue | null>(null)

export function ChatPanelsProvider({ children }: { children: React.ReactNode }) {
  // SSR 和 CSR 都從空陣列開始，避免 hydration mismatch
  const [openPanels, setOpenPanels] = useState<ChatPanelState[]>([])
  const isFirstRender = useRef(true)
  const hasLoadedFromStorage = useRef(false)

  // Client 端載入 localStorage
  useEffect(() => {
    if (!hasLoadedFromStorage.current) {
      hasLoadedFromStorage.current = true
      setOpenPanels(loadPanels())
    }
  }, [])

  // State 變更時寫入 localStorage（跳過首次載入）
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    if (!hasLoadedFromStorage.current) return
    savePanels(openPanels)
  }, [openPanels])

  const addPanel = useCallback((projectId: string, projectName: string, opts?: AddPanelOpts) => {
    const panelId = crypto.randomUUID()
    setOpenPanels(prev => [...prev, { panelId, projectId, projectName, ...opts }])
  }, [])

  const removePanel = useCallback((panelId: string) => {
    setOpenPanels(prev => prev.filter(p => p.panelId !== panelId))
  }, [])

  const duplicatePanel = useCallback((panelId: string) => {
    setOpenPanels(prev => {
      const idx = prev.findIndex(p => p.panelId === panelId)
      if (idx === -1) return prev
      const source = prev[idx]
      const newPanel: ChatPanelState = {
        panelId: crypto.randomUUID(),
        projectId: source.projectId,
        projectName: source.projectName,
      }
      const next = [...prev]
      next.splice(idx + 1, 0, newPanel)
      return next
    })
  }, [])

  const updatePanelSession = useCallback((panelId: string, sessionId: string) => {
    setOpenPanels(prev => {
      const idx = prev.findIndex(p => p.panelId === panelId)
      if (idx === -1) return prev
      if (prev[idx].sessionId === sessionId) return prev // 避免無意義更新
      const next = [...prev]
      next[idx] = { ...next[idx], sessionId }
      return next
    })
  }, [])

  return (
    <ChatPanelsContext.Provider value={{ openPanels, addPanel, removePanel, duplicatePanel, updatePanelSession }}>
      {children}
    </ChatPanelsContext.Provider>
  )
}

export function useChatPanels() {
  const ctx = useContext(ChatPanelsContext)
  if (!ctx) throw new Error('useChatPanels must be used within ChatPanelsProvider')
  return ctx
}
