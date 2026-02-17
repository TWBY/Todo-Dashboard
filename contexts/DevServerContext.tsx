'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'

interface PortStatus {
  projectId: string
  port: number
  isRunning: boolean
  pid?: number
  projectPath?: string
  memoryMB?: number
  cpuPercent?: number
  source?: 'brickverse' | 'coursefiles' | 'utility'
  devBasePath?: string
}

interface ExternalProcess {
  name: string
  memoryMB: number
}

interface SystemMemory {
  pressureLevel: 'normal' | 'warning' | 'critical'
  usedGB: number
  totalGB: number
  usedPercent: number
  suggestedStops: string[]
  topProcesses: ExternalProcess[]
}

interface DevServerContextValue {
  statuses: PortStatus[]
  systemMemory: SystemMemory | null
  systemCpu: number | null
  isInitialLoad: boolean
  refresh: () => Promise<void>
}

const DevServerContext = createContext<DevServerContextValue>({
  statuses: [],
  systemMemory: null,
  systemCpu: null,
  isInitialLoad: true,
  refresh: async () => {},
})

export function DevServerProvider({ children }: { children: React.ReactNode }) {
  const [statuses, setStatuses] = useState<PortStatus[]>([])
  const [systemMemory, setSystemMemory] = useState<SystemMemory | null>(null)
  const [systemCpu, setSystemCpu] = useState<number | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const controllerRef = useRef<AbortController | null>(null)

  const fetchData = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/dev-server', { signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setStatuses(data.data || [])
      setSystemMemory(data.systemMemory || null)
      setSystemCpu(data.systemCpu ?? null)
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      // Silent fail — server may be restarting
    } finally {
      setIsInitialLoad(false)
    }
  }, [])

  const refresh = useCallback(async () => {
    await fetchData(controllerRef.current?.signal)
  }, [fetchData])

  useEffect(() => {
    const controller = new AbortController()
    controllerRef.current = controller
    fetchData(controller.signal)
    const interval = setInterval(() => fetchData(controller.signal), 15000)
    return () => {
      controller.abort()
      clearInterval(interval)
    }
  }, [fetchData])

  return (
    <DevServerContext.Provider value={{ statuses, systemMemory, systemCpu, isInitialLoad, refresh }}>
      {children}
    </DevServerContext.Provider>
  )
}

export function useDevServer() {
  return useContext(DevServerContext)
}
