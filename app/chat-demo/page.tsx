'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useThrottledValue } from '@/hooks/useThrottledValue'
import { rehypeAnimate } from '@/lib/rehype-animate'

// ── 模擬用 Markdown 素材 ──────────────────────────────────
const DEMO_TEXT = `## 串流渲染效果展示

這是一段模擬 AI 回覆的串流輸出。每個 token 會逐字送出，讓你能觀察底部漸入效果和平滑捲動的表現。

### 程式碼範例

以下是一段 TypeScript 函式：

\`\`\`typescript
function fibonacci(n: number): number {
  if (n <= 1) return n
  return fibonacci(n - 1) + fibonacci(n - 2)
}

// 使用 memoization 優化
const memo = new Map<number, number>()
function fib(n: number): number {
  if (memo.has(n)) return memo.get(n)!
  const result = n <= 1 ? n : fib(n - 1) + fib(n - 2)
  memo.set(n, result)
  return result
}
\`\`\`

### 列表與格式

串流渲染需要處理的 Markdown 元素：

- **粗體文字** 和 *斜體文字*
- \`inline code\` 行內程式碼
- [超連結](https://example.com)
- 巢狀列表：
  - 第二層
    - 第三層

### 表格

| 參數 | 預設值 | 說明 |
|------|--------|------|
| throttle | 80ms | 限制重繪頻率 |
| mask duration | 150ms | 漸層淡入時長 |
| mask range | 2lh | 漸層覆蓋行高 |
| scroll | smooth | 捲動行為 |

### 長段落

在實際的 AI 對話中，模型經常會輸出長段落的連續文字。這種場景下，逐字跳出的效果會特別刺眼——每個 token 到達時畫面都會抖一下。透過底部漸層 mask，新文字從透明漸入到不透明，整個過程就像墨水暈染一樣自然。搭配 smooth scroll，頁面會柔和地跟著內容向下滑動，而不是生硬地跳到底部。

> 這是一段引用文字，用來測試 blockquote 的串流渲染效果。引用區塊在串流中也需要正確渲染邊框和縮排。

### 結語

以上就是完整的串流渲染效果展示。你可以調整右側的參數面板來比較不同設定下的視覺差異。`

// ── Markdown 共用樣式（與 ChatContent 一致）──────────────
const MARKDOWN_PROSE = `prose prose-invert max-w-none overflow-hidden break-words
  [&_h1]:text-[1.6rem] [&_h1]:font-bold [&_h1]:leading-[1.4] [&_h1]:mt-8 [&_h1]:mb-3
  [&_h2]:text-[1.35rem] [&_h2]:font-bold [&_h2]:leading-[1.4] [&_h2]:mt-6 [&_h2]:mb-2.5
  [&_h3]:text-[1.15rem] [&_h3]:font-semibold [&_h3]:leading-[1.4] [&_h3]:mt-5 [&_h3]:mb-2
  [&_h4]:text-[1.05rem] [&_h4]:font-semibold [&_h4]:leading-[1.4] [&_h4]:mt-4 [&_h4]:mb-1.5
  [&>:first-child]:mt-0
  [&_p]:mt-1 [&_p]:mb-3 [&_p]:whitespace-pre-wrap
  [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1
  [&_ol]:pl-[1.5em] [&_ul]:pl-[1.5em]
  [&_ul]:list-disc [&_ol]:list-decimal
  [&_ul_ul]:list-[circle] [&_ul_ul_ul]:list-[square]
  [&_li]:display-list-item
  [&_ul>li::marker]:text-[#666666] [&_ol>li::marker]:text-[#666666]
  [&_pre]:my-3 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_pre]:bg-[#111111] [&_pre]:border [&_pre]:border-[#222222]
  [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-[0.9em] [&_code]:bg-[#111111]
  [&_pre_code]:p-0 [&_pre_code]:bg-transparent
  [&_strong]:font-bold
  [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:bg-[#111111] [&_th]:text-sm [&_th]:font-semibold
  [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm
  [&_tr]:border-b [&_tr]:border-[#222222] [&_tr:last-child]:border-0
  [&_blockquote]:border-l-2 [&_blockquote]:border-[#333] [&_blockquote]:pl-4 [&_blockquote]:my-4 [&_blockquote]:text-[#999]
  [&_hr]:border-[#333333] [&_hr]:my-4`

// ── 模擬串流 Hook ─────────────────────────────────────────
function useSimulatedStream(text: string, speed: number, isRunning: boolean) {
  const [content, setContent] = useState('')
  const indexRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!isRunning) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }

    // 將文字按「token」拆分（模擬真實 LLM 輸出，每次 1-4 字）
    const tokens: string[] = []
    let i = 0
    while (i < text.length) {
      const chunkSize = Math.floor(Math.random() * 4) + 1
      tokens.push(text.slice(i, i + chunkSize))
      i += chunkSize
    }

    indexRef.current = 0
    setContent('')

    timerRef.current = setInterval(() => {
      if (indexRef.current >= tokens.length) {
        if (timerRef.current) clearInterval(timerRef.current)
        return
      }
      indexRef.current++
      setContent(tokens.slice(0, indexRef.current).join(''))
    }, speed)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [text, speed, isRunning])

  const reset = useCallback(() => {
    indexRef.current = 0
    setContent('')
    if (timerRef.current) clearInterval(timerRef.current)
  }, [])

  const isComplete = content.length >= text.length

  return { content, isComplete, reset }
}

// ── Streaming 渲染元件（與 ChatContent 相同邏輯）──────────
function StreamingMessage({
  content,
  throttleMs,
  enableAnimate,
}: {
  content: string
  throttleMs: number
  enableAnimate: boolean
}) {
  const throttled = useThrottledValue(content, throttleMs)

  return (
    <div
      className={`text-base leading-[1.75] tracking-[0em] ${MARKDOWN_PROSE}`}
      style={{ color: '#ffffff' }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={enableAnimate ? [rehypeAnimate] : []}
      >
        {throttled}
      </ReactMarkdown>
    </div>
  )
}

// ── 主頁面 ────────────────────────────────────────────────
export default function ChatDemoPage() {
  const [isRunning, setIsRunning] = useState(false)
  const [speed, setSpeed] = useState(30)
  const [throttleMs, setThrottleMs] = useState(100)
  const [enableAnimate, setEnableAnimate] = useState(true)
  const [smoothScroll, setSmoothScroll] = useState(true)

  const { content, isComplete, reset } = useSimulatedStream(DEMO_TEXT, speed, isRunning)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isNearBottomRef = useRef(true)
  const isProgrammaticRef = useRef(false)
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 自動捲動
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !isNearBottomRef.current) return
    isProgrammaticRef.current = true
    if (smoothScroll) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } else {
      el.scrollTop = el.scrollHeight
    }
  }, [content, smoothScroll])

  const handleScroll = useCallback(() => {
    if (isProgrammaticRef.current) {
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current)
      scrollTimerRef.current = setTimeout(() => {
        isProgrammaticRef.current = false
        scrollTimerRef.current = null
      }, 200)
      return
    }
    const el = scrollRef.current
    if (!el) return
    isNearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100
  }, [])

  const handleStart = () => {
    reset()
    setIsRunning(true)
  }

  const handleStop = () => {
    setIsRunning(false)
  }

  useEffect(() => {
    if (isComplete) setIsRunning(false)
  }, [isComplete])

  return (
    <div className="min-h-screen bg-black text-white flex">
      {/* 左側：串流展示區 */}
      <div className="flex-1 flex flex-col" style={{ maxWidth: 'calc(100% - 320px)' }}>
        {/* 標題列 */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-[#222]">
          <a href="/" className="text-[#666] hover:text-white transition-colors">
            <i className="fa-solid fa-arrow-left" />
          </a>
          <h1 className="text-lg font-semibold">Chat Streaming Demo</h1>
          <span className="text-xs text-[#666] ml-2">模擬串流渲染效果</span>
          <div className="flex-1" />
          {isRunning ? (
            <span className="text-xs text-[#0a84ff] flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#0a84ff] animate-pulse" />
              Streaming...
            </span>
          ) : isComplete ? (
            <span className="text-xs text-[#30d158]">
              <i className="fa-solid fa-check mr-1" />
              Complete
            </span>
          ) : null}
        </div>

        {/* 訊息區 */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6"
          style={{ backgroundColor: '#000' }}
        >
          {content.length > 0 ? (
            <div className="max-w-3xl">
              {isRunning || !isComplete ? (
                <StreamingMessage
                  content={content}
                  throttleMs={throttleMs}
                  enableAnimate={enableAnimate}
                />
              ) : (
                <div
                  className={`text-base leading-[1.75] tracking-[0em] ${MARKDOWN_PROSE}`}
                  style={{ color: '#ffffff' }}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-[#666]">
              <div className="text-center">
                <i className="fa-solid fa-play text-3xl mb-3 block" />
                <p className="text-sm">按下「開始串流」模擬 AI 輸出</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 右側：控制面板 */}
      <div className="w-[320px] border-l border-[#222] bg-[#0a0a0a] p-5 overflow-y-auto flex flex-col gap-5">
        <div>
          <h2 className="text-sm font-semibold text-[#999] uppercase tracking-wider mb-4">
            Controls
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleStart}
              disabled={isRunning}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
              style={{
                backgroundColor: isRunning ? '#222' : '#0a84ff',
                color: isRunning ? '#666' : '#fff',
              }}
            >
              <i className="fa-solid fa-play mr-1.5" />
              {isComplete ? '重新開始' : '開始串流'}
            </button>
            <button
              onClick={handleStop}
              disabled={!isRunning}
              className="px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40"
              style={{
                backgroundColor: !isRunning ? '#222' : '#ff453a',
                color: !isRunning ? '#666' : '#fff',
              }}
            >
              <i className="fa-solid fa-stop" />
            </button>
          </div>
        </div>

        <hr className="border-[#222]" />

        {/* Token 速度 */}
        <ParamSlider
          label="Token 速度"
          value={speed}
          onChange={setSpeed}
          min={5}
          max={100}
          unit="ms/token"
          description="每個 token 的間隔時間，越小越快"
        />

        {/* Throttle */}
        <ParamSlider
          label="Throttle 間隔"
          value={throttleMs}
          onChange={setThrottleMs}
          min={16}
          max={300}
          unit="ms"
          description="限制 React 重繪頻率"
        />

        <hr className="border-[#222]" />

        <h2 className="text-sm font-semibold text-[#999] uppercase tracking-wider">
          Word Animation
        </h2>

        <ParamToggle
          label="Per-word Fade-in"
          value={enableAnimate}
          onChange={setEnableAnimate}
        />
        <p className="text-[11px] text-[#555] -mt-3">
          rehype plugin 拆文字為 per-word span，每個新 word 獨立做 opacity + blur 淡入（0.6s ease）
        </p>

        <hr className="border-[#222]" />

        {/* Smooth Scroll */}
        <ParamToggle
          label="Smooth Scroll 平滑捲動"
          value={smoothScroll}
          onChange={setSmoothScroll}
        />

        {/* 即時狀態 */}
        <div className="mt-auto pt-4 border-t border-[#222]">
          <h2 className="text-xs font-semibold text-[#555] uppercase tracking-wider mb-2">
            Runtime Info
          </h2>
          <div className="text-xs text-[#666] space-y-1 font-mono">
            <p>content: {content.length} chars</p>
            <p>total: {DEMO_TEXT.length} chars</p>
            <p>progress: {content.length > 0 ? Math.round((content.length / DEMO_TEXT.length) * 100) : 0}%</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 通用控制元件 ──────────────────────────────────────────
function ParamSlider({
  label,
  value,
  onChange,
  min,
  max,
  unit,
  description,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
  unit: string
  description: string
  disabled?: boolean
}) {
  return (
    <div className={disabled ? 'opacity-40 pointer-events-none' : ''}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs text-[#999]">{label}</label>
        <span className="text-xs font-mono text-[#0a84ff]">
          {value}
          <span className="text-[#555] ml-0.5">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#0a84ff]"
      />
      <p className="text-[11px] text-[#555] mt-1">{description}</p>
    </div>
  )
}

function ParamToggle({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-xs text-[#999] group-hover:text-white transition-colors">{label}</span>
      <div
        className="relative w-9 h-5 rounded-full transition-colors"
        style={{ backgroundColor: value ? '#0a84ff' : '#333' }}
        onClick={() => onChange(!value)}
      >
        <div
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          style={{ transform: value ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </div>
    </label>
  )
}
