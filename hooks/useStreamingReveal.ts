import { useState, useRef, useEffect, useCallback } from 'react'

/**
 * 漸進式文字揭露 hook
 *
 * 用 rAF 動畫讓 displayText 平滑追趕 fullText，
 * 而非逐字即時顯示。效果：文字以「一批一批」的方式揭露。
 */
export function useStreamingReveal(
  fullText: string,
  isStreaming: boolean,
): string {
  const [displayLength, setDisplayLength] = useState(0)
  const targetLenRef = useRef(fullText.length)
  const rafRef = useRef<number>(0)
  const isStreamingRef = useRef(isStreaming)

  // 持續更新 target（不觸發 effect re-run）
  targetLenRef.current = fullText.length
  isStreamingRef.current = isStreaming

  // streaming 結束時，立即顯示全部
  useEffect(() => {
    if (!isStreaming) {
      cancelAnimationFrame(rafRef.current)
      setDisplayLength(fullText.length)
    }
  }, [isStreaming, fullText.length])

  // streaming 開始時，啟動 rAF 追趕迴圈（只在 isStreaming 變化時觸發）
  useEffect(() => {
    if (!isStreaming) return

    const animate = () => {
      const target = targetLenRef.current

      setDisplayLength(prev => {
        if (prev >= target) return prev

        // 差距越大追越快，最少每幀 3 字
        const gap = target - prev
        const step = Math.max(3, Math.ceil(gap * 0.25))
        return Math.min(prev + step, target)
      })

      // 只在 streaming 期間繼續動畫
      if (isStreamingRef.current) {
        rafRef.current = requestAnimationFrame(animate)
      }
    }

    rafRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(rafRef.current)
    }
  }, [isStreaming])

  return fullText.slice(0, displayLength)
}
