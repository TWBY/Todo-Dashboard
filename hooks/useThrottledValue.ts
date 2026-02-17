import { useState, useEffect, useRef } from 'react'

/**
 * Throttle 一個持續變化的值，避免過於頻繁觸發 re-render。
 * streaming 結束（值不再變化）時會立即同步到最新值。
 */
export function useThrottledValue<T>(value: T, intervalMs: number): T {
  const [throttled, setThrottled] = useState(value)
  const lastUpdated = useRef(Date.now())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const now = Date.now()
    const elapsed = now - lastUpdated.current

    if (elapsed >= intervalMs) {
      // 已超過間隔，立即更新
      setThrottled(value)
      lastUpdated.current = now
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    } else if (!timerRef.current) {
      // 排程在間隔結束時更新
      timerRef.current = setTimeout(() => {
        setThrottled(value)
        lastUpdated.current = Date.now()
        timerRef.current = null
      }, intervalMs - elapsed)
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [value, intervalMs])

  // 確保最終值一定同步
  useEffect(() => {
    return () => setThrottled(value)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return throttled
}
