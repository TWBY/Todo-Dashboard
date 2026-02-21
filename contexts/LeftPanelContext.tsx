'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'

interface LeftPanelContextValue {
  collapsed: boolean
  toggle: () => void
}

const LeftPanelContext = createContext<LeftPanelContextValue>({ collapsed: false, toggle: () => {} })

export function LeftPanelProvider({ children }: { children: React.ReactNode }) {
  // 一律先以 false 渲染，避免 SSR 與 client 讀取 localStorage 結果不同造成 hydration mismatch
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('dashboard-left-collapsed')
    if (stored === 'true') setCollapsed(true)
  }, [])

  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('dashboard-left-collapsed', String(next))
      return next
    })
  }, [])

  return (
    <LeftPanelContext.Provider value={{ collapsed, toggle }}>
      {children}
    </LeftPanelContext.Provider>
  )
}

export function useLeftPanel() {
  return useContext(LeftPanelContext)
}
