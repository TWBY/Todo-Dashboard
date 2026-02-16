import { useState, useRef, useEffect } from 'react'

/**
 * 漸進式文字揭露 hook
 *
 * 用 setInterval 定時批次 flush，而非逐字即時顯示。
 * 兩次 flush 之間，不論收到多少 SSE delta，UI 都不更新。
 * 每次 flush 時一次揭露累積的所有文字 —「拉開布幕」效果。
 */

const FLUSH_INTERVAL = 300 // ms

export function useStreamingReveal(
  fullText: string,
  isStreaming: boolean,
): string {
  const [displayText, setDisplayText] = useState(fullText)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const fullTextRef = useRef(fullText)

  // 持續追蹤最新 fullText（不觸發 re-render）
  fullTextRef.current = fullText

  // streaming 開始：啟動定時 flush
  useEffect(() => {
    if (!isStreaming) return

    intervalRef.current = setInterval(() => {
      setDisplayText(fullTextRef.current)
    }, FLUSH_INTERVAL)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [isStreaming])

  // streaming 結束：立即 flush 剩餘文字
  useEffect(() => {
    if (!isStreaming) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setDisplayText(fullText)
    }
  }, [isStreaming, fullText])

  return displayText
}
