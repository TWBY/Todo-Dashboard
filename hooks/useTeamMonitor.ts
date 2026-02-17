'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { TeamMember, TeamTask, TeamMessage } from '@/lib/claude-chat-types'

interface TeamMonitorData {
  teamName: string
  description?: string
  members: TeamMember[]
  tasks: TeamTask[]
  messages: TeamMessage[]
  isActive: boolean
  startTime: number
}

const POLL_INTERVAL = 2000 // 2 秒輪詢

export function useTeamMonitor(teamName: string | null) {
  const [data, setData] = useState<TeamMonitorData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isActiveRef = useRef(true) // 追蹤團隊是否仍在運作

  const fetchTeamData = useCallback(async (name: string) => {
    try {
      const res = await fetch(`/api/team-monitor?name=${encodeURIComponent(name)}`)
      if (!res.ok) {
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
        isActive: isActiveRef.current,
        startTime: json.createdAt || Date.now(),
      })
      setError(null)
    } catch (err) {
      setError(String(err))
    }
  }, [])

  // 開始/停止輪詢
  useEffect(() => {
    if (!teamName) {
      setData(null)
      return
    }

    isActiveRef.current = true

    // 立即拉一次
    fetchTeamData(teamName)

    // 定時輪詢
    intervalRef.current = setInterval(() => {
      if (isActiveRef.current) {
        fetchTeamData(teamName)
      }
    }, POLL_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [teamName, fetchTeamData])

  // 標記團隊結束
  const markInactive = useCallback(() => {
    isActiveRef.current = false
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setData(prev => prev ? { ...prev, isActive: false } : null)
  }, [])

  return { data, error, markInactive }
}
