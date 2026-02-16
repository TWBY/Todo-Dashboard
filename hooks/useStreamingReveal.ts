import { useRef } from 'react'

interface Chunk {
  id: number
  text: string
}

/**
 * Streaming 文字漸進式揭露 hook（FlowToken diff-chunk 模式）
 *
 * 每次 fullText 變長時，把新增部分作為一個 chunk 累積。
 * 每個 chunk 有穩定的 id 作為 React key：
 * - 新 chunk mount 時觸發 CSS animation（fade-in + blur）
 * - 舊 chunk 因 key 不變不 re-mount，不會重新動畫
 *
 * streaming 結束後，合併為單一無動畫 chunk（外層會切回 ReactMarkdown）。
 */
export function useStreamingReveal(
  fullText: string,
  isStreaming: boolean,
): { chunks: Chunk[]; isStreaming: boolean } {
  const chunksRef = useRef<Chunk[]>([])
  const prevLenRef = useRef(0)
  const nextIdRef = useRef(0)

  if (isStreaming) {
    if (fullText.length > prevLenRef.current) {
      // 有新內容 → 產生新 chunk
      chunksRef.current = [
        ...chunksRef.current,
        { id: nextIdRef.current++, text: fullText.slice(prevLenRef.current) },
      ]
      prevLenRef.current = fullText.length
    } else if (fullText.length < prevLenRef.current) {
      // fullText 變短 = 新對話重置
      chunksRef.current = [{ id: nextIdRef.current++, text: fullText }]
      prevLenRef.current = fullText.length
    }
  } else {
    // streaming 結束 → 合併為單一無動畫 chunk（id = -1）
    chunksRef.current = [{ id: -1, text: fullText }]
    prevLenRef.current = fullText.length
  }

  return { chunks: chunksRef.current, isStreaming }
}
