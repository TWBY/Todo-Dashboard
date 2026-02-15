'use client'

import { createContext, useContext, useState, useCallback } from 'react'

interface LeftPanelContextValue {
  collapsed: boolean
  toggle: () => void
}

const LeftPanelContext = createContext<LeftPanelContextValue>({ collapsed: false, toggle: () => {} })

export function LeftPanelProvider({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('dashboard-left-collapsed') === 'true'
  })

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
