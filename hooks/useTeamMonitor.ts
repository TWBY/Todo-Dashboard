'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { TeamMember, TeamTask, TeamMessage, TeamSystemEvent } from '@/lib/claude-chat-types'

interface TeamMonitorData {
  teamName: string
  description?: string
  members: TeamMember[]
  tasks: TeamTask[]
  messages: TeamMessage[]
  systemEvents: TeamSystemEvent[]
  isActive: boolean
  startTime: number
}

const POLL_INTERVAL = 2000 // 2 秒輪詢

export function useTeamMonitor(teamName: string | null) {
  const [data, setData] = useState<TeamMonitorData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isActiveRef = useRef(true)

  const stopPolling = useCallback(() => {
    isActiveRef.current = false
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const fetchTeamData = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/team-monitor?name=${encodeURIComponent(name)}`)
      if (!res.ok) {
        if (res.status === 404) {
          // Team deleted — stop polling, mark inactive
          stopPolling()
          setData(prev => prev ? { ...prev, isActive: false } : null)
          return
        }
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `HTTP ${res.status}`)
      }
      const json = await res.json()
      setData({
        teamName: json.teamName,
        description: json.description,
        members: json.members || [],
        tasks: json.tasks || [],
        messages: json.messages || [],
        systemEvents: json.systemEvents || [],
        isActive: isActiveRef.current,
        startTime: json.createdAt || Date.now(),
      })
      setError(null)
    } catch (err) {
      setError(String(err))
    }
  }, [stopPolling])

  useEffect(() => {
    if (!teamName) {
      setData(null)
      return
    }

    isActiveRef.current = true
    fetchTeamData(teamName)

    intervalRef.current = setInterval(() => {
      if (isActiveRef.current) {
        fetchTeamData(teamName)
      }
    }, POLL_INTERVAL)

    return () => {
      stopPolling()
    }
  }, [teamName, fetchTeamData, stopPolling])

  const markInactive = useCallback(() => {
    stopPolling()
    setData(prev => prev ? { ...prev, isActive: false } : null)
  }, [stopPolling])

  return { data, error, markInactive }
}
