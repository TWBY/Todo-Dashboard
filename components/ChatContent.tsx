'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ProjectImagePicker from '@/components/ProjectImagePicker'
import ChatHistory from '@/components/ChatHistory'
import type { ChatMessage, ChatMode, TodoItem, UserQuestion } from '@/lib/claude-chat-types'
import { useClaudeChat } from '@/hooks/useClaudeChat'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import { useChatPanels } from '@/contexts/ChatPanelsContext'
import { useStreamingReveal } from '@/hooks/useStreamingReveal'


const MODE_CONFIG: Record<ChatMode, { label: string; prefix: string; placeholder: string }> = {
  plan: { label: 'Plan mode', prefix: 'P', placeholder: '規劃任務...（Claude 不會編輯檔案）' },
  edit: { label: 'Edit', prefix: 'E', placeholder: '描述需要 Claude 做的變更...' },
}

const MODE_CYCLE: ChatMode[] = ['plan', 'edit']

// ContentsRate 進度條元件
function ContentsRate({ inputTokens, outputTokens, lastDurationMs }: { inputTokens: number; outputTokens: number; lastDurationMs?: number }) {
  const totalTokens = inputTokens + outputTokens
  const contextLimit = 200_000
  const pct = Math.min(Math.round((totalTokens / contextLimit) * 100), 100)
  const color = pct >= 80 ? '#f87171' : pct >= 50 ? '#fbbf24' : '#999999'

  const durationStr = lastDurationMs
    ? lastDurationMs >= 60000
      ? `${(lastDurationMs / 60000).toFixed(1)}m`
      : `${(lastDurationMs / 1000).toFixed(1)}s`
    : null

  return (
    <div className="flex items-center gap-1.5" title={`輸入: ${inputTokens.toLocaleString()} / 輸出: ${outputTokens.toLocaleString()} / 上限: ${contextLimit.toLocaleString()}`}>
      {durationStr && (
        <span className="text-sm" style={{ color: '#555555' }} title="上次執行時長">
          {durationStr}
        </span>
      )}
      <div className="w-16 h-1 rounded-full" style={{ backgroundColor: 'var(--background-primary)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
        {pct}%
      </span>
    </div>
  )
}

// Todo 進度元件
function TodoList({ todos, isStreaming }: { todos: TodoItem[]; isStreaming: boolean }) {
  return (
    <div className="space-y-2">
      {todos.map((todo, i) => {
        // streaming 結束時，自動完成所有 in_progress 的 todo
        const effectiveStatus = !isStreaming && todo.status === 'in_progress' ? 'completed' : todo.status
        return (
          <div key={i} className="flex items-center gap-2 text-base">
            <span className="w-3 flex-shrink-0 flex items-center justify-center">
              {effectiveStatus === 'completed' && (
                <i className="fa-solid fa-check text-green-400 text-[11px]" />
              )}
              {effectiveStatus === 'in_progress' && (
                <i className="fa-solid fa-circle shimmer-dot text-[6px]" style={{ color: '#999999', animationDelay: `${i * 0.3}s` }} />
              )}
              {effectiveStatus === 'pending' && (
                <span className="w-3 h-3 rounded-full border border-gray-500" />
              )}
            </span>
            <span
              className={`${effectiveStatus === 'completed' ? 'line-through opacity-60' : ''} ${effectiveStatus === 'in_progress' ? 'shimmer-text' : ''}`}
              style={effectiveStatus === 'in_progress' ? { color: '#999999', animationDelay: `${i * 0.3}s` } : undefined}
            >
              {effectiveStatus === 'in_progress' ? todo.activeForm : todo.content}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// 完成提示音（Web Audio API 合成叮咚音）
function playCompletionSound() {
  try {
    const ctx = new AudioContext()
    const now = ctx.currentTime

    // 叮（高音）
    const osc1 = ctx.createOscillator()
    const gain1 = ctx.createGain()
    osc1.connect(gain1)
    gain1.connect(ctx.destination)
    osc1.frequency.setValueAtTime(880, now)
    gain1.gain.setValueAtTime(0.3, now)
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
    osc1.start(now)
    osc1.stop(now + 0.2)

    // 咚（低音，延遲 0.15s）
    const osc2 = ctx.createOscillator()
    const gain2 = ctx.createGain()
    osc2.connect(gain2)
    gain2.connect(ctx.destination)
    osc2.frequency.setValueAtTime(660, now + 0.15)
    gain2.gain.setValueAtTime(0, now)
    gain2.gain.setValueAtTime(0.25, now + 0.15)
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45)
    osc2.start(now + 0.15)
    osc2.stop(now + 0.45)
  } catch { /* 靜默失敗 */ }
}

// 浮動決策面板容器
function ActionOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="action-overlay-enter flex-shrink-0 mb-2 px-2">
      {children}
    </div>
  )
}

// Team Monitor 查看列
function TeamMonitorBanner({ onOpen, teamName }: { onOpen: () => void; teamName: string }) {
  return (
    <div className="animate-fade-in">
      <button
        onClick={onOpen}
        className="w-full py-2 rounded text-base font-medium transition-all duration-200 flex items-center justify-center gap-2"
        style={{
          backgroundColor: 'rgba(88, 166, 255, 0.15)',
          color: '#58a6ff',
        }}
      >
        <span>查看 Agent Team</span>
        <span style={{ color: '#666666', fontSize: '0.875rem' }}>({teamName})</span>
      </button>
    </div>
  )
}

// Email 訊息複製按鈕（複製為 rich text，貼到 Gmail 會保留格式）
function EmailCopyButton({ content }: { content: string }) {
  const { copyRichText, isCopied } = useCopyToClipboard()
  // 抽取 --- 分隔線之間的 Email 草稿內容，若沒有分隔線就複製全部
  const extractEmailContent = (text: string): string => {
    const match = text.match(/---\n([\s\S]*?)\n---/)
    return (match ? match[1] : text).trim()
  }
  const emailText = extractEmailContent(content)
  const copied = isCopied(emailText)
  return (
    <button
      onClick={() => copyRichText(emailText)}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all duration-150"
      style={{
        backgroundColor: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
        color: copied ? '#22c55e' : '#999',
        border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : '#222222'}`,
      }}
      title="複製 Email 內容"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          已複製
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          複製 Email
        </>
      )}
    </button>
  )
}

// Assistant 訊息複製按鈕（hover 時顯示於右上角）
function AssistantCopyButton({ content }: { content: string }) {
  const { copy, isCopied } = useCopyToClipboard()
  const copied = isCopied(content)
  return (
    <button
      onClick={() => copy(content)}
      className="absolute top-0 right-0 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 p-1 rounded"
      style={{
        backgroundColor: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.08)',
        color: copied ? '#22c55e' : '#666',
      }}
      title={copied ? '已複製' : '複製訊息'}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      )}
    </button>
  )
}

// 程式碼區塊複製按鈕
function CodeBlockWithCopy({ children, ...props }: React.ComponentPropsWithoutRef<'pre'>) {
  const { copy, isCopied } = useCopyToClipboard()

  const extractText = (node: React.ReactNode): string => {
    if (typeof node === 'string') return node
    if (Array.isArray(node)) return node.map(extractText).join('')
    if (node && typeof node === 'object' && 'props' in node) {
      return extractText((node as React.ReactElement<{ children?: React.ReactNode }>).props.children)
    }
    return ''
  }

  // 從 <code className="language-xxx"> 擷取語言名稱
  const extractLang = (node: React.ReactNode): string => {
    if (node && typeof node === 'object' && 'props' in node) {
      const el = node as React.ReactElement<{ className?: string; children?: React.ReactNode }>
      const match = el.props.className?.match(/language-(\w+)/)
      if (match) return match[1]
    }
    return ''
  }

  const text = extractText(children)
  const lang = extractLang(Array.isArray(children) ? children[0] : children)
  const copied = isCopied(text)

  return (
    <div className="relative group">
      <pre {...props}>{children}</pre>
      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        {lang && (
          <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: '#666', backgroundColor: 'rgba(255,255,255,0.06)' }}>
            {lang}
          </span>
        )}
        <button
          onClick={() => copy(text)}
          className="w-7 h-7 rounded flex items-center justify-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
          title="複製程式碼"
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

// 表格溢出容器
function TableWrapper({ children, ...rest }: React.HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto my-3 rounded-lg" style={{ border: '1px solid #222222' }}>
      <table className="w-full border-collapse" {...rest}>{children}</table>
    </div>
  )
}

const markdownComponents = {
  pre: CodeBlockWithCopy,
  table: TableWrapper,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline hover:opacity-80 transition-opacity"
    >
      {children}
    </a>
  ),
}

// 共用 Markdown 排版 className（基於 Brick Design 設計系統）
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

// Streaming 中的 assistant 訊息：diff-chunk 漸進式揭露（FlowToken 風格）
// 每次 SSE 送來新文字 → 新 chunk mount → CSS fade-in 動畫
// Streaming 結束後外層會切回 ReactMarkdown 渲染完整 Markdown
function StreamingAssistantMessage({
  msg,
  emailMode,
}: {
  msg: ChatMessage
  emailMode: boolean
}) {
  const { chunks } = useStreamingReveal(msg.content, true)

  return (
    <div className="group/msg relative">
      <div
        className="text-base leading-[1.75] tracking-[0em] whitespace-pre-wrap"
        style={{ color: '#ffffff' }}
      >
        {chunks.map((chunk) => (
          <span
            key={chunk.id}
            className={chunk.id >= 0 ? 'streaming-word-reveal' : undefined}
          >
            {chunk.text}
          </span>
        ))}
      </div>
      {emailMode && msg.content.length > 20 && (
        <div className="mt-1.5">
          <EmailCopyButton content={msg.content} />
        </div>
      )}
      {!emailMode && msg.content.length > 20 && (
        <AssistantCopyButton content={msg.content} />
      )}
    </div>
  )
}

// 工具操作 Log：streaming 時展開即時顯示，結束後收合
function ToolGroup({ msgs, isLive }: { msgs: ChatMessage[]; isLive?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const logEndRef = useRef<HTMLDivElement>(null)
  const count = msgs.length

  // streaming 時自動捲到底部
  useEffect(() => {
    if (isLive && logEndRef.current) {
      logEndRef.current.scrollIntoView({ block: 'end' })
    }
  }, [isLive, count])

  // streaming 時強制展開
  const showExpanded = isLive || expanded

  if (!showExpanded) {
    const lastMsg = msgs[msgs.length - 1]
    const lastDesc = lastMsg.toolDescription || ''
    const lastLabel = lastDesc ? `${lastMsg.toolName} ${lastDesc}` : lastMsg.toolName || ''
    return (
      <div
        className="text-sm animate-fade-in cursor-pointer flex items-center gap-1.5 px-1.5 -mx-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(true)}
        title="點擊展開所有操作"
      >
        <span key={lastMsg.id} className="tool-crossfade" style={{ color: '#666666' }}>
          {lastLabel}
        </span>
        {count > 1 && (
          <span className="text-xs px-1 py-0.5 rounded-sm" style={{ color: '#555555', backgroundColor: '#111111' }}>
            +{count - 1}
          </span>
        )}
        <span style={{ color: '#444444', fontSize: '0.75rem' }}>›</span>
      </div>
    )
  }

  return (
    <div
      className={`animate-fade-in text-sm ${!isLive ? 'cursor-pointer' : ''}`}
      onClick={!isLive ? () => setExpanded(false) : undefined}
      style={{
        maxHeight: isLive ? '7.5rem' : undefined,
        overflowY: isLive ? 'auto' : undefined,
        maskImage: isLive && count > 5 ? 'linear-gradient(to bottom, transparent 0%, black 15%)' : undefined,
        WebkitMaskImage: isLive && count > 5 ? 'linear-gradient(to bottom, transparent 0%, black 15%)' : undefined,
      }}
    >
      <div className="space-y-0.5">
        {msgs.map((tm, i) => {
          const desc = tm.toolDescription || ''
          const isLast = isLive && i === msgs.length - 1
          return (
            <div key={tm.id} className={isLast ? 'streaming-status-text' : ''} style={{ color: isLast ? '#888888' : '#555555' }}>
              {tm.toolName}
              {desc && <span style={{ color: isLast ? undefined : '#444444' }}> {desc}</span>}
            </div>
          )
        })}
        <div ref={logEndRef} />
      </div>
    </div>
  )
}

// Plan 審批列
function PlanApprovalBar({ onApprove, onReject, planOnly, loading }: { onApprove: () => void; onReject?: () => void; planOnly?: boolean; loading?: boolean }) {
  return (
    <div className="animate-fade-in space-y-1.5">
      <button
        onClick={onApprove}
        disabled={loading}
        className="w-full py-2 rounded text-base font-medium transition-all duration-200"
        style={{
          backgroundColor: loading ? 'rgba(100, 100, 100, 0.15)' : planOnly ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
          color: loading ? '#888' : planOnly ? '#34d399' : '#60a5fa',
          cursor: loading ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? (planOnly ? '回存中...' : '執行中...') : planOnly ? '回存' : '執行'}
      </button>
      {!planOnly && !loading && onReject && (
        <button
          onClick={onReject}
          className="w-full py-2 rounded text-base font-medium transition-all duration-200"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            color: '#f87171',
          }}
        >
          我還有要補充
        </button>
      )}
    </div>
  )
}

// 互動式問題彈窗
const CUSTOM_OPTION_KEY = '__custom__'

function QuestionDialog({ questions, onAnswer }: {
  questions: UserQuestion[]
  onAnswer: (answers: Record<string, string>) => void
}) {
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({})

  const handleSelect = (question: string, value: string) => {
    setSelections(prev => ({ ...prev, [question]: value }))
    // 選取選項時清空自訂文字
    setCustomTexts(prev => ({ ...prev, [question]: '' }))
  }

  const handleCustomTextChange = (question: string, text: string) => {
    setCustomTexts(prev => ({ ...prev, [question]: text }))
    // 有輸入文字時自動切換為自訂模式，清空時取消
    if (text.trim().length > 0) {
      setSelections(prev => ({ ...prev, [question]: CUSTOM_OPTION_KEY }))
    } else {
      setSelections(prev => {
        const next = { ...prev }
        delete next[question]
        return next
      })
    }
  }

  const handleSubmit = () => {
    const finalAnswers: Record<string, string> = {}
    for (const q of questions) {
      const sel = selections[q.question]
      if (!sel) return
      finalAnswers[q.question] = sel === CUSTOM_OPTION_KEY
        ? customTexts[q.question] || ''
        : sel
    }
    onAnswer(finalAnswers)
  }

  const allAnswered = questions.every(q => {
    const sel = selections[q.question]
    if (!sel) return false
    if (sel === CUSTOM_OPTION_KEY) return (customTexts[q.question] || '').trim().length > 0
    return true
  })

  return (
    <div
      className="rounded p-3 space-y-3 animate-fade-in overflow-y-auto"
      style={{
        backgroundColor: '#111111',
        border: '1px solid #222222',
        maxHeight: '60vh',
      }}
    >
      {questions.map((q, qi) => {
        const isCustomSelected = selections[q.question] === CUSTOM_OPTION_KEY
        return (
          <div key={qi} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className="text-sm px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: '#222222', color: '#999999' }}
              >
                {q.header}
              </span>
            </div>
            <p className="text-base font-medium" style={{ color: '#ffffff' }}>
              {q.question}
            </p>
            <div className="space-y-1">
              {q.options.map((opt, oi) => (
                <button
                  key={oi}
                  onClick={() => handleSelect(q.question, opt.label)}
                  className="w-full text-left px-2.5 py-1.5 rounded text-base transition-all duration-150"
                  style={{
                    backgroundColor: selections[q.question] === opt.label
                      ? '#222222'
                      : '#111111',
                    border: selections[q.question] === opt.label
                      ? '1px solid #ffffff'
                      : '1px solid #222222',
                    color: '#ffffff',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full border-[1.5px] flex items-center justify-center flex-shrink-0"
                      style={{
                        borderColor: selections[q.question] === opt.label ? '#ffffff' : '#666666',
                      }}
                    >
                      {selections[q.question] === opt.label && (
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#ffffff' }} />
                      )}
                    </span>
                    <div>
                      <div className="font-medium">{opt.label}</div>
                      {opt.description && (
                        <div className="text-sm mt-0.5" style={{ color: '#666666' }}>
                          {opt.description}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              {/* 自行輸入框 - 始終可見 */}
              <textarea
                value={customTexts[q.question] || ''}
                onChange={e => handleCustomTextChange(q.question, e.target.value)}
                placeholder="都不需要？直接輸入你的回答..."
                rows={2}
                className="w-full px-2.5 py-1.5 rounded text-base mt-1 resize-none outline-none"
                style={{
                  backgroundColor: '#1a1a1a',
                  border: isCustomSelected ? '1px solid #ffffff' : '1px solid #333333',
                  color: '#ffffff',
                }}
              />
            </div>
          </div>
        )
      })}
      <button
        onClick={handleSubmit}
        disabled={!allAnswered}
        className="w-full py-1.5 rounded text-base font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          backgroundColor: allAnswered ? '#333333' : '#111111',
          color: allAnswered ? '#ffffff' : '#666666',
        }}
      >
        提交回答
      </button>
    </div>
  )
}

export type PanelStatus = 'idle' | 'streaming' | 'waiting' | 'completed'

interface ChatContentProps {
  projectId: string
  projectName: string
  compact?: boolean
  planOnly?: boolean
  emailMode?: boolean
  model?: string
  resumeSessionId?: string
  initialMessage?: string
  initialMode?: 'plan' | 'edit'
  ephemeral?: boolean
  onSessionIdChange?: (sessionId: string) => void
  onSessionMetaChange?: (meta: { totalInputTokens: number; totalOutputTokens: number; lastDurationMs?: number }) => void
  onPanelStatusChange?: (status: PanelStatus) => void
}

interface SkillInfo { name: string; description: string; model?: 'haiku' | 'sonnet' | 'opus'; category?: string }

export { ContentsRate }

export default function ChatContent({ projectId, projectName, compact, planOnly, emailMode, model: modelProp, resumeSessionId, initialMessage, initialMode, ephemeral, onSessionIdChange, onSessionMetaChange, onPanelStatusChange }: ChatContentProps) {
  // input 改為 uncontrolled（不觸發 React re-render），只在送出/清空時用 ref 讀取
  const inputRef = useRef('')
  const hasInputRef = useRef(false) // 用 ref 避免 onChange 閉包 stale
  const [hasInput, setHasInput] = useState(false) // 只在 empty↔non-empty 時更新（控制送出按鈕外觀）
  const [isComposing, setIsComposing] = useState(false)
  const [mode, setMode] = useState<ChatMode>('plan')
  const [images, setImages] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [showImagePicker, setShowImagePicker] = useState(false)
  const [globalSkills, setGlobalSkills] = useState<SkillInfo[]>([])
  const [projectCommands, setProjectCommands] = useState<SkillInfo[]>([])
  const [slashFilter, setSlashFilter] = useState<string | null>(null)
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0)
  const [modelChoice, setModelChoice] = useState<'haiku' | 'sonnet' | 'opus'>('sonnet')
  const [effortLevel, setEffortLevel] = useState<'low' | 'medium' | 'high'>('medium')
  const [isApproving, setIsApproving] = useState(false)
  const [showScrollBottom, setShowScrollBottom] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [autoResolvedModel, setAutoResolvedModel] = useState<string | null>(null)
  const [activeTeam, setActiveTeam] = useState<{ name: string; description?: string } | null>(null)
  const dragCounterRef = useRef(0)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isNearBottomRef = useRef(true)

  // 合併 project + global skills，去重
  const allSkills = useMemo(() => {
    const map = new Map<string, SkillInfo>()
    for (const s of projectCommands) map.set(s.name, s)
    for (const s of globalSkills) if (!map.has(s.name)) map.set(s.name, s)
    return Array.from(map.values())
  }, [projectCommands, globalSkills])

  const filteredSkills = useMemo(() => {
    if (slashFilter === null) return []
    if (slashFilter === '') return allSkills
    return allSkills.filter(s => s.name.toLowerCase().includes(slashFilter.toLowerCase()))
  }, [allSkills, slashFilter])

  const effectiveModel = modelProp || modelChoice
  const { messages, todos, isStreaming, streamStatus, streamingActivity, sessionId, sessionMeta, pendingQuestions, pendingPlanApproval, sendMessage, answerQuestion, approvePlan, stopStreaming, resetStreamStatus, clearChat, resumeSession, isLoadingHistory, error, clearError, lastFailedMessage, streamStartTime } = useClaudeChat(projectId, { model: effectiveModel, ephemeral })
  const { addPanel } = useChatPanels()

  // 偵測 Team 事件（TeamCreate / TeamDelete）→ 追蹤 activeTeam state（不自動開啟面板）
  useEffect(() => {
    const lastMsg = messages[messages.length - 1]
    if (!lastMsg?.teamEvent) return
    if (lastMsg.teamEvent.type === 'create') {
      const teamName = lastMsg.teamEvent.teamName
      setActiveTeam({ name: teamName, description: lastMsg.teamEvent.description })
      // 不再自動開啟面板，由用戶點擊 banner 手動開啟
    } else if (lastMsg.teamEvent.type === 'delete') {
      setActiveTeam(prev => prev ? { ...prev, name: prev.name } : null)
      setTimeout(() => setActiveTeam(null), 5000)
    }
  }, [messages, projectId])

  // Mount 時自動恢復上次的 session（僅在 mount 時執行一次）
  const hasResumedRef = useRef(false)
  const resumeSessionIdRef = useRef(resumeSessionId)
  useEffect(() => {
    // 只在 mount 時恢復 session，之後的 sessionId 變更不再觸發 resume
    // （串流中 setSessionId 會更新 resumeSessionId prop，不應中斷正在進行的串流）
    if (hasResumedRef.current) return
    if (!resumeSessionIdRef.current) return
    hasResumedRef.current = true
    resumeSession(resumeSessionIdRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // initialMessage: 自動發送初始訊息
  // 使用 ref 紀錄初始訊息 ID，確保渲染時能正確去重
  const hasAutoSentRef = useRef(false)
  const initialMsgIdRef = useRef<string | null>(null)
  useEffect(() => {
    if (hasAutoSentRef.current || !initialMessage || !initialMessage.trim()) return
    hasAutoSentRef.current = true
    sendMessage(initialMessage, initialMode ?? 'plan')
  }, [initialMessage, sendMessage])

  // 計算 displayMessages：確保 initialMessage 在 messages 為空時也能顯示
  const displayMessages = useMemo(() => {
    if (!initialMessage) return messages
    // 如果 messages 中已有 user 訊息，直接使用
    const hasUserMsg = messages.some(m => m.role === 'user')
    if (hasUserMsg) return messages
    // 否則在前面加一個虛擬 user 訊息（確保 ID 穩定，避免閃爍）
    if (!initialMsgIdRef.current) initialMsgIdRef.current = crypto.randomUUID()
    return [{
      id: initialMsgIdRef.current,
      role: 'user' as const,
      content: initialMessage,
      timestamp: Date.now(),
    }, ...messages]
  }, [messages, initialMessage])

  // sessionId 變更時回報給父元件（用於持久化）
  useEffect(() => {
    if (sessionId && onSessionIdChange) onSessionIdChange(sessionId)
  }, [sessionId, onSessionIdChange])

  // 手動開啟 Team Monitor 面板
  const handleOpenTeamMonitor = useCallback(() => {
    if (!activeTeam) return
    const teamName = activeTeam.name
    addPanel(projectId, `Team: ${teamName}`, {
      type: 'team-monitor',
      teamName,
      ephemeral: true
    })
  }, [activeTeam, projectId, addPanel])

  // 批准計畫時自動切換 mode 到 edit（planOnly 模式下不切換，改為自動存回 Scratch Pad）
  const isApprovingRef = useRef(false)
  const handleApprovePlan = useCallback(async (approved: boolean, feedback?: string) => {
    if (isApprovingRef.current) return // 防重複點擊（用 ref 避免 closure stale）
    isApprovingRef.current = true
    setIsApproving(true)
    try {
      if (approved && planOnly) {
        // planOnly: 只回存到 Scratch Pad，不讓 Claude 繼續執行
        approvePlan(false) // 清除 pending 狀態，不發送執行指令
        const firstUserMsg = messages.find(m => m.role === 'user')
        // 優先從 plan file Write 工具結果擷取完整計畫
        let plan = ''
        const planWriteMsg = [...messages].reverse().find(
          m => m.role === 'tool' && m.toolName === 'Write' && m.content.includes('/plans/')
        )
        if (planWriteMsg) {
          try {
            const parsed = JSON.parse(planWriteMsg.content)
            plan = parsed.content || planWriteMsg.content
          } catch {
            plan = planWriteMsg.content
          }
        } else {
          // fallback: 取最後一則 assistant 訊息
          const assistantMsgs = messages.filter(m => m.role === 'assistant' && m.content)
          plan = assistantMsgs.length > 0 ? assistantMsgs[assistantMsgs.length - 1].content : ''
        }
        // 從 plan 中擷取 H1 標題作為 content，否則用原始用戶訊息
        const h1Match = plan.match(/^#\s+(.+)$/m)
        const content = h1Match ? h1Match[1].trim() : (firstUserMsg?.content || '未命名想法')
        try {
          await fetch('/api/scratch-pad', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content, plan, chatSessionId: sessionId }),
          })
          window.dispatchEvent(new Event('scratchpad-refresh'))
        } catch { /* ignore */ }
        return
      }
      await approvePlan(approved, feedback)
      if (approved) {
        setMode('edit')
      }
    } finally {
      isApprovingRef.current = false
      setIsApproving(false)
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
  }, [approvePlan, planOnly, messages, sessionId])

  // 非致命錯誤（無重試按鈕）5 秒後自動消失
  useEffect(() => {
    if (!error || lastFailedMessage) return // 有重試按鈕的錯誤不自動消失
    const timer = setTimeout(() => clearError(), 5000)
    return () => clearTimeout(timer)
  }, [error, lastFailedMessage, clearError])

  // 回答問題後自動 focus 回 textarea
  const prevPendingQRef = useRef(pendingQuestions)
  useEffect(() => {
    if (prevPendingQRef.current && !pendingQuestions) {
      requestAnimationFrame(() => textareaRef.current?.focus())
    }
    prevPendingQRef.current = pendingQuestions
  }, [pendingQuestions])

  // 通知父元件 sessionMeta 變化
  useEffect(() => {
    onSessionMetaChange?.({ totalInputTokens: sessionMeta.totalInputTokens, totalOutputTokens: sessionMeta.totalOutputTokens, lastDurationMs: sessionMeta.lastDurationMs })
  }, [sessionMeta.totalInputTokens, sessionMeta.totalOutputTokens, sessionMeta.lastDurationMs, onSessionMetaChange])

  // [已移除] 重複的 initialMessage effect — 保留 line 416 的版本即可

  // 區分程式性捲動 vs 用戶捲動，避免 programmatic scroll 觸發 onScroll 時誤判
  const isProgrammaticScrollRef = useRef(false)

  // 判斷使用者是否在訊息區底部附近（100px 以內）
  const handleScroll = useCallback(() => {
    // 程式性捲動觸發的 scroll event — 忽略，不更新 isNearBottomRef
    if (isProgrammaticScrollRef.current) {
      isProgrammaticScrollRef.current = false
      return
    }
    const el = messagesContainerRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100
    isNearBottomRef.current = nearBottom
    setShowScrollBottom(!nearBottom)
  }, [])

  // 只在使用者已經在底部時才自動捲動
  useEffect(() => {
    const el = messagesContainerRef.current
    if (el && isNearBottomRef.current) {
      isProgrammaticScrollRef.current = true
      el.scrollTop = el.scrollHeight
    }
  }, [messages])

  // resumeSession 載入歷史後，強制捲到底部並重設 near-bottom 狀態
  const prevSessionIdRef = useRef(sessionId)
  useEffect(() => {
    if (sessionId && sessionId !== prevSessionIdRef.current) {
      prevSessionIdRef.current = sessionId
      requestAnimationFrame(() => {
        const el = messagesContainerRef.current
        if (el) {
          isProgrammaticScrollRef.current = true
          el.scrollTop = el.scrollHeight
          isNearBottomRef.current = true
        }
      })
    }
  }, [sessionId, messages])

  // 偵測串流完成 → 綠色邊框 + 音效
  // streamStatus 由 hook 原子化設定，消除 React 狀態批次更新的 race condition
  useEffect(() => {
    if (streamStatus === 'completed') {
      playCompletionSound()
    }
  }, [streamStatus])

  // 串流經過時間計時器
  useEffect(() => {
    if (!streamStartTime) { setElapsed(0); return }
    setElapsed(Math.floor((Date.now() - streamStartTime) / 1000))
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - streamStartTime) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [streamStartTime])

  // 捲動到底部（用戶主動點擊）
  const scrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current
    if (el) {
      isNearBottomRef.current = true
      setShowScrollBottom(false)
      isProgrammaticScrollRef.current = true
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [])

  // 自動調整 textarea 高度（debounced，避免每次按鍵都 layout thrash）
  const adjustTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const adjustTextareaHeight = useCallback(() => {
    if (adjustTimerRef.current) return // 已排程，不重複
    adjustTimerRef.current = setTimeout(() => {
      adjustTimerRef.current = null
      const el = textareaRef.current
      if (!el) return
      // 統一使用 JS 方案控制高度（移除 fieldSizing 依賴）
      el.style.height = 'auto'
      const maxH = 200
      const scrollH = el.scrollHeight
      if (scrollH > maxH) {
        el.style.height = maxH + 'px'
        el.style.overflowY = 'auto'
      } else {
        el.style.height = scrollH + 'px'
        el.style.overflowY = 'hidden'
      }
    }, 50)
  }, [])

  // 載入 skills 列表
  useEffect(() => {
    fetch(`/api/claude-chat/skills?projectId=${projectId}`)
      .then(r => r.json())
      .then(data => {
        setGlobalSkills(data.globalSkills || [])
        setProjectCommands(data.projectCommands || [])
      })
      .catch(() => {})
  }, [projectId])

  // 圖片預覽 URLs（自動清理）
  const imagePreviewUrls = useMemo(() => images.map(f => URL.createObjectURL(f)), [images])
  useEffect(() => {
    return () => imagePreviewUrls.forEach(url => URL.revokeObjectURL(url))
  }, [imagePreviewUrls])

  const MAX_IMAGES = 5
  const addImages = useCallback((files: FileList | File[]) => {
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (valid.length > 0) setImages(prev => {
      const remaining = MAX_IMAGES - prev.length
      if (remaining <= 0) return prev
      return [...prev, ...valid.slice(0, remaining)]
    })
  }, [])

  const removeImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    const imageFiles: File[] = []
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault()
      addImages(imageFiles)
    }
    // 純文字：不攔截，交回瀏覽器原生處理
  }, [addImages])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current = 0
    setIsDragging(false)
    if (e.dataTransfer.files?.length > 0) addImages(e.dataTransfer.files)
  }, [addImages])

  const handleSend = async () => {
    const currentInput = inputRef.current
    if (!currentInput.trim() && images.length === 0) return

    // 有待審批計畫時，偵測確認類關鍵字 → 自動觸發執行
    if (pendingPlanApproval && currentInput.trim()) {
      const confirmWords = ['執行', '好', '確認', '批准', '開始', 'yes', 'ok', 'go', 'approve', 'execute', 'run']
      if (confirmWords.some(w => currentInput.trim().toLowerCase().includes(w))) {
        inputRef.current = ''
        hasInputRef.current = false
        if (textareaRef.current) textareaRef.current.value = ''
        setHasInput(false)
        handleApprovePlan(true)
        return
      }
    }

    console.debug('[chat-ui] handleSend', { inputLen: currentInput.trim().length, mode, imagesCount: images.length })
    isNearBottomRef.current = true

    let messageToSend = currentInput.trim()


    // emailMode 且是第一則訊息：加上 Email 回覆系統指示前綴
    if (emailMode && messages.filter(m => m.role === 'user').length === 0) {
      const emailSystemPrompt = `[系統指示] 你是「Email 回覆小幫手」。

**角色定位**：
- 你是 Brickverse 講師柏燁的 Email 回覆助手
- 用戶會貼上收到的訊息內容，你幫忙討論並草擬回覆

**嚴格限制**：
- 不進行任何文章搜尋
- 不讀取任何程式碼或文件
- 專注於 Email 回覆的討論與撰寫

**回覆格式要求（非常重要，必須嚴格遵守）**：
- 產出的 Email 草稿必須使用以下 Markdown 層級，大小適合直接貼入郵件：
  - ### 作為 Email 主標題（例如：### 關於 AI 融入教學研習回覆）
  - #### 作為段落小標（例如：#### 研習內容規劃）
  - * 作為列點（不用 -）
  - **粗體** 用於列點內的重點標示（例如：* **時間與費用**：...）
- 開頭稱呼獨立一行（例如：親愛的○○老師您好：）
- 結尾署名：**Brickverse 講師 柏燁**
- 段落之間保留空行，確保排版清晰
- 草稿前加一行「---」分隔線，草稿後也加一行「---」分隔線，讓用戶明確知道哪段是可複製的 Email 內容
- 分隔線之後可以加一句簡短的詢問（如「還有哪裡需要微調嗎？」），但不要放在分隔線裡面

**工作流程**：
1. 用戶貼上收到的內容
2. 你先理解內容，提出回覆方向建議
3. 與用戶討論確認回覆策略
4. 產出正式的回覆草稿（用 --- 分隔線包起來）

以下是用戶貼上的內容：
`
      messageToSend = emailSystemPrompt + messageToSend
    }

    sendMessage(messageToSend, mode, images.length > 0 ? images : undefined, modelChoice, effortLevel)
    inputRef.current = ''
    hasInputRef.current = false
    if (textareaRef.current) textareaRef.current.value = ''
    setHasInput(false)
    setImages([])
    // 重置 textarea 高度 & 自動 focus
    requestAnimationFrame(() => {
      adjustTextareaHeight()
      textareaRef.current?.focus()
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Slash menu 鍵盤操作
    if (slashFilter !== null && filteredSkills.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSlashSelectedIndex(i => (i + 1) % filteredSkills.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSlashSelectedIndex(i => (i - 1 + filteredSkills.length) % filteredSkills.length)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        runSkill(filteredSkills[slashSelectedIndex].name)
        return
      }
    }
    if (slashFilter !== null && e.key === 'Escape') {
      e.preventDefault()
      setSlashFilter(null)
      return
    }
    if (e.key === 'Escape' && isStreaming) {
      e.preventDefault()
      stopStreaming()
      return
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      // compositionEnd 在某些瀏覽器中會在 keyDown 之後觸發，用 nativeEvent.isComposing 即時判斷
      if (isComposing || e.nativeEvent.isComposing) {
        console.debug('[chat-ui] keydown blocked: composing')
        return
      }
      e.preventDefault()
      handleSend()
    }
  }

  const runSkill = (name: string) => {
    setSlashFilter(null)
    const skill = allSkills.find(s => s.name === name)
    const skillModel = skill?.model
    // Skill 有指定 model → 同步更新 UI 選擇器
    if (skillModel && !modelProp) {
      setModelChoice(skillModel)
    }
    inputRef.current = ''
    hasInputRef.current = false
    if (textareaRef.current) textareaRef.current.value = ''
    setHasInput(false)
    requestAnimationFrame(() => {
      adjustTextareaHeight()
      textareaRef.current?.focus()
    })
    isNearBottomRef.current = true
    sendMessage(`/${name}`, 'edit', undefined, skillModel)
    setMode('edit')
  }

  const selectMode = (m: ChatMode) => {
    if (isStreaming) return
    setMode(m)
  }

  const modeConfig = MODE_CONFIG[mode]

  // 面板狀態顏色（直接從 streamStatus 衍生，無 race condition）
  const panelStatus: PanelStatus = pendingPlanApproval || pendingQuestions
    ? 'waiting'
    : isStreaming ? 'streaming'
    : streamStatus === 'completed' ? 'completed' : 'idle'

  // 通知父元件面板狀態變化
  useEffect(() => {
    onPanelStatusChange?.(panelStatus)
  }, [panelStatus, onPanelStatusChange])

  return (
    <div
      className="flex flex-col h-full min-h-0 min-w-0"
      onClick={() => { if (panelStatus === 'completed') resetStreamStatus() }}
    >
      {/* History Panel */}
      <ChatHistory
        projectId={projectId}
        currentSessionId={sessionId}
        onResumeSession={resumeSession}
      />

      {/* Messages Area */}
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="overflow-y-auto overflow-x-hidden mb-3 space-y-4 p-2 flex-1 min-h-0"
          style={{
            backgroundColor: '#000000',
          }}
        >
        {/* DEV: Team Monitor 測試按鈕（開發環境才顯示） */}
        {process.env.NODE_ENV === 'development' && !activeTeam && displayMessages.length === 0 && !emailMode && !isStreaming && (
          <button
            onClick={() => {
              setActiveTeam({ name: 'ct-fix', description: '修復 ClaudeTerminal App 在 streaming 結束後自動退出的問題' })
              addPanel(projectId, 'Team: ct-fix', { type: 'team-monitor', teamName: 'ct-fix', ephemeral: true })
            }}
            className="text-xs px-2 py-1 rounded mb-2"
            style={{ backgroundColor: '#0d1117', border: '1px solid #1f3a5f', color: '#58a6ff' }}
          >
            DEV: Test Team Monitor
          </button>
        )}

        {/* emailMode 初始歡迎訊息 */}
        {emailMode && displayMessages.length === 0 && (
          <div className="animate-fade-in">
            <div
              className="text-base leading-[1.5] prose prose-invert max-w-none"
              style={{ color: '#999999' }}
            >
              你好，我是 Email 回覆小幫手。請把收到的信件內容貼上來，我來幫你討論並草擬回覆。
            </div>
          </div>
        )}

        {(() => {
          const LOW_LEVEL_TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'Diff', 'MultiEdit', 'NotebookEdit', 'WebFetch', 'WebSearch', 'SendMessage']

          const isLowLevelTool = (m: typeof displayMessages[0]) =>
            m.role === 'tool' &&
            LOW_LEVEL_TOOLS.includes(m.toolName || '') &&
            !(m.toolName === 'Write' && m.content.includes('/plans/'))

          // 將訊息分組：連續的 low-level tool 合併為一組
          const groups: Array<{ type: 'single'; msg: typeof displayMessages[0] } | { type: 'tool-group'; msgs: typeof displayMessages }> = []
          for (const m of displayMessages) {
            if (isLowLevelTool(m)) {
              const last = groups[groups.length - 1]
              if (last?.type === 'tool-group') {
                last.msgs.push(m)
              } else {
                groups.push({ type: 'tool-group', msgs: [m] })
              }
            } else {
              groups.push({ type: 'single', msg: m })
            }
          }

          return groups.map((group, gi) => {
            // 連續 low-level tools → streaming 時展開即時 log，結束後收合
            if (group.type === 'tool-group') {
              const isLastGroup = gi === groups.length - 1
              return <ToolGroup key={`tg-${gi}`} msgs={group.msgs} isLive={isLastGroup && isStreaming} />
            }

            const msg = group.msg
            return (
              <div key={msg.id} className="animate-fade-in">
                {msg.role === 'user' && (
                  <div>
                    <div className="text-base leading-[1.5] whitespace-pre-wrap" style={{ color: '#ffffff' }}>
                      {msg.images && msg.images.length > 0 && (
                        <div className="flex gap-1.5 mb-1.5 flex-wrap">
                          {msg.images.map((url, i) => (
                            <img
                              key={i}
                              suppressHydrationWarning
                              src={url}
                              alt=""
                              className="w-16 h-16 object-cover rounded"
                              style={{ border: '1px solid #222222' }}
                            />
                          ))}
                        </div>
                      )}
                      {(() => {
                        // emailMode: 隱藏系統指示前綴
                        if (emailMode && msg.content.startsWith('[系統指示]')) {
                          const match = msg.content.match(/以下是用戶貼上的內容：\s*\n(.+)/s)
                          return match ? match[1] : msg.content
                        }
                        return msg.content
                      })()}
                    </div>
                  </div>
                )}

                {msg.role === 'assistant' && (() => {
                  const isStreamingMsg = isStreaming && gi === groups.length - 1
                  if (isStreamingMsg) {
                    return <StreamingAssistantMessage msg={msg} emailMode={!!emailMode} />
                  }
                  return (
                    <div className="group/msg relative">
                      <div
                        className={`text-base leading-[1.75] tracking-[0em] ${MARKDOWN_PROSE}`}
                        style={{ color: '#ffffff' }}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{msg.content}</ReactMarkdown>
                      </div>
                      {emailMode && msg.content.length > 20 && (
                        <div className="mt-1.5">
                          <EmailCopyButton content={msg.content} />
                        </div>
                      )}
                      {!emailMode && msg.content.length > 20 && (
                        <AssistantCopyButton content={msg.content} />
                      )}
                    </div>
                  )
                })()}

                {msg.role === 'tool' && msg.toolName === 'Task' && (() => {
                  const isRunning = isStreaming && gi === groups.length - 1
                  return (
                    <div
                      className="px-2.5 py-2 rounded text-sm"
                      style={{
                        backgroundColor: '#0d1117',
                        border: `1px solid ${isRunning ? '#1f3a5f' : '#1c2333'}`,
                        color: '#8b949e',
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {isRunning ? (
                          <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: '#58a6ff' }} />
                            <span className="relative inline-flex rounded-full h-3 w-3" style={{ backgroundColor: '#58a6ff' }} />
                          </span>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                          </svg>
                        )}
                        <span style={{ color: '#c9d1d9' }}>
                          {msg.toolDescription || 'Sub-agent'}
                        </span>
                        {isRunning && (
                          <span className="streaming-status-text text-xs" style={{ color: '#58a6ff' }}>執行中</span>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {msg.role === 'tool' && msg.toolName === 'TeamCreate' && msg.teamEvent && (
                  <div className="text-sm py-0.5 flex items-center gap-2" style={{ color: '#58a6ff' }}>
                    <i className="fa-solid fa-users-gear text-xs" />
                    <span>Team: {msg.teamEvent.teamName}</span>
                    {msg.teamEvent.description && (
                      <span style={{ color: '#666666' }}>— {msg.teamEvent.description}</span>
                    )}
                  </div>
                )}

                {msg.role === 'tool' && msg.toolName === 'TeamDelete' && (
                  <div className="text-sm py-0.5" style={{ color: '#666666' }}>
                    團隊已解散
                  </div>
                )}

                {msg.role === 'tool' && msg.toolName === 'TodoWrite' && msg.todos && (
                  <div>
                    <div
                      className="px-2.5 py-2 rounded text-base"
                      style={{
                        backgroundColor: '#111111',
                        border: '1px solid #222222',
                        color: '#999999',
                      }}
                    >
                      <div className="font-medium mb-1 text-sm" style={{ color: '#666666' }}>
                        Update Todos
                      </div>
                      <TodoList todos={msg.todos} isStreaming={isStreaming} />
                    </div>
                  </div>
                )}


                {msg.role === 'tool' && msg.toolName === 'ExitPlanMode' && msg.planApproval?.approved && (
                  <div className="w-full">
                    <div className="text-sm py-0.5" style={{ color: '#666666' }}>
                      已審批計畫
                    </div>
                  </div>
                )}

                {msg.role === 'tool' && msg.toolName !== 'TodoWrite' && msg.toolName !== 'AskUserQuestion' && msg.toolName !== 'ExitPlanMode' && msg.toolName !== 'TeamCreate' && msg.toolName !== 'TeamDelete' && (() => {
                  const isPlanWrite = msg.toolName === 'Write' && msg.content.includes('/plans/')

                  if (isPlanWrite) {
                    let planMarkdown = msg.content
                    try {
                      const parsed = JSON.parse(msg.content)
                      if (parsed.content) planMarkdown = parsed.content
                    } catch { /* use raw content */ }

                    return (
                      <div
                        className={`text-base leading-[1.75] tracking-[0em] ${MARKDOWN_PROSE}`}
                        style={{ color: '#cccccc' }}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{planMarkdown}</ReactMarkdown>
                      </div>
                    )
                  }

                  // 非 low-level 且非 plan write → 通用 JSON 顯示
                  return (
                    <div>
                      <div
                        className="px-2.5 py-1.5 rounded text-sm font-mono"
                        style={{
                          backgroundColor: '#111111',
                          border: '1px solid #222222',
                          color: '#999999',
                        }}
                      >
                        <div className="font-medium mb-1 text-sm" style={{ color: '#666666' }}>
                          {msg.toolName}
                        </div>
                        <div
                          className="overflow-x-auto max-h-32 overflow-y-auto"
                          onWheel={(e) => {
                            const el = e.currentTarget
                            el.style.overflowY = 'hidden'
                            requestAnimationFrame(() => {
                              el.style.overflowY = 'auto'
                            })
                          }}
                        >
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )
          })
        })()}

        {isLoadingHistory && (
          <div className="text-sm animate-fade-in">
            <span className="streaming-status-text">載入對話紀錄...</span>
          </div>
        )}
        {isStreaming && streamingActivity && (
          <div className="text-sm animate-fade-in flex items-center gap-2">
            <span className="streaming-status-text">
              {streamingActivity.status === 'connecting' && '正在連線...'}
              {streamingActivity.status === 'thinking' && '正在思考...'}
              {streamingActivity.status === 'replying' && '正在回覆...'}
              {streamingActivity.status === 'tool' && (
                streamingActivity.toolName === 'Task'
                  ? `Agent: ${streamingActivity.toolDetail || 'running...'}`
                  : streamingActivity.toolDetail
                    ? `${streamingActivity.toolName} — ${streamingActivity.toolDetail}`
                    : streamingActivity.toolName
              )}
            </span>
            {elapsed > 0 && (
              <span style={{ color: '#555' }}>
                {elapsed >= 60 ? `${Math.floor(elapsed / 60)}m ${elapsed % 60}s` : `${elapsed}s`}
              </span>
            )}
          </div>
        )}
        </div>

        {/* 回到底部按鈕 */}
        {showScrollBottom && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110"
            style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #444',
              color: '#aaa',
              boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
            }}
            title="回到底部"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        )}
      </div>

      {/* 決策面板 — 在 Input 之上 */}
      {pendingPlanApproval && (
        <ActionOverlay>
          <PlanApprovalBar onApprove={() => handleApprovePlan(true)} onReject={() => handleApprovePlan(false)} planOnly={planOnly} loading={isApproving} />
        </ActionOverlay>
      )}
      {pendingQuestions && (
        <ActionOverlay>
          <QuestionDialog questions={pendingQuestions.questions} onAnswer={answerQuestion} />
        </ActionOverlay>
      )}

      {/* Team Monitor 查看按鈕 — 在 Input 之上 */}
      {activeTeam && (
        <ActionOverlay>
          <TeamMonitorBanner onOpen={handleOpenTeamMonitor} teamName={activeTeam.name} />
        </ActionOverlay>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-2 flex-shrink-0 flex items-stretch gap-2">
          {lastFailedMessage && (
            <button
              onClick={() => {
                clearError()
                sendMessage(lastFailedMessage.message, lastFailedMessage.mode)
              }}
              className="px-4 rounded text-base font-medium transition-colors hover:bg-red-500/20"
              style={{
                backgroundColor: 'rgba(220, 38, 38, 0.1)',
                color: '#ef4444',
                minWidth: '72px',
              }}
            >
              重試
            </button>
          )}
          <div
            className="flex-1 p-2 rounded text-base flex items-center"
            style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', color: '#ef4444' }}
          >
            <span className="flex-1">{error}</span>
            <button
              onClick={clearError}
              className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center hover:bg-white/10 transition-colors ml-2"
              title="關閉"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Slash Command Dropdown — 在 Input 之上 */}
      {slashFilter !== null && filteredSkills.length > 0 && (
        <div
          className="mb-2 min-w-[200px] max-h-[240px] overflow-y-auto rounded py-1.5 flex-shrink-0"
          style={{
            backgroundColor: '#111111',
            border: '1px solid #222222',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          }}
        >
          {filteredSkills.map((s, i) => (
            <button
              key={s.name}
              onClick={() => runSkill(s.name)}
              className="w-full text-left px-3 py-2 text-base transition-colors"
              style={{
                color: 'var(--text-primary)',
                backgroundColor: i === slashSelectedIndex ? 'rgba(255,255,255,0.1)' : 'transparent',
              }}
            >
              <div className="font-medium">/{s.name}</div>
              {s.description && (
                <div className="mt-0.5 truncate text-sm" style={{ color: 'var(--text-tertiary)' }}>
                  {s.description}
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Input Container — 整合式設計 */}
      <div
        className="rounded-lg flex-shrink-0 overflow-hidden relative"
        style={{
          backgroundColor: '#000000',
          border: isDragging ? '1px solid #ffffff' : '1px solid #222222',
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center rounded-lg"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)' }}
          >
            <span className="text-base font-medium" style={{ color: '#999999' }}>
              放開以加入圖片
            </span>
          </div>
        )}

        {/* Image Previews */}
        {imagePreviewUrls.length > 0 && (
          <div className="flex gap-2 px-4 pt-3 pb-1 flex-wrap">
            {imagePreviewUrls.map((url, i) => (
              <div key={i} className="relative group">
                <img
                  suppressHydrationWarning
                  src={url}
                  alt=""
                  className="w-14 h-14 object-cover rounded-lg"
                  style={{ border: '1px solid var(--border-color)' }}
                />
                <button
                  onClick={() => removeImage(i)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: '#ef4444', color: 'white' }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          defaultValue=""
          onChange={(e) => {
            inputRef.current = e.target.value
            const nowHas = e.target.value.trim().length > 0
            if (nowHas !== hasInputRef.current) {
              hasInputRef.current = nowHas
              setHasInput(nowHas)
            }
            adjustTextareaHeight()
            // Slash command 偵測：只在整行只有 /xxx 時觸發（無換行、無空格前綴）
            const val = e.target.value
            if (/^\/[^\s]*$/.test(val)) {
              setSlashFilter(val.slice(1))
              setSlashSelectedIndex(0)
            } else if (slashFilter !== null) {
              setSlashFilter(null)
            }
          }}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          placeholder={(pendingPlanApproval || pendingQuestions) ? '請先處理上方的決策...' : modeConfig.placeholder}
          rows={1}
          className="w-full px-4 pt-3 pb-1 text-base outline-none resize-none bg-transparent"
          style={{
            color: 'var(--text-primary)',
            maxHeight: '200px',
            opacity: (pendingPlanApproval || pendingQuestions) ? 0.4 : 1,
            transition: 'opacity 0.2s',
          }}
        />

        {/* Bottom Toolbar */}
        <div className="flex items-center px-3 py-2">
          {/* Left group: P E A + Skills + ContentsRate */}
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {(planOnly || emailMode) ? (
              <span
                className="w-7 h-7 rounded-md text-sm font-semibold flex items-center justify-center"
                style={{ backgroundColor: '#222222', color: '#ffffff', border: '1px solid #333333' }}
                title={emailMode ? "Email mode (locked)" : "Plan mode (locked)"}
              >
                {emailMode ? 'A' : 'P'}
              </span>
            ) : MODE_CYCLE.map(m => {
              const isActive = mode === m
              return (
                <button
                  key={m}
                  onClick={() => selectMode(m)}
                  disabled={isStreaming}
                  className="w-7 h-7 rounded-md text-sm font-semibold flex items-center justify-center transition-all duration-150"
                  style={{
                    backgroundColor: isActive ? '#222222' : 'transparent',
                    color: isActive ? '#ffffff' : '#666666',
                    border: isActive ? '1px solid #333333' : '1px solid transparent',
                    opacity: isStreaming ? 0.4 : 1,
                    cursor: isStreaming ? 'not-allowed' : 'pointer',
                  }}
                  title={MODE_CONFIG[m].label}
                >
                  {MODE_CONFIG[m].prefix}
                </button>
              )
            })}

            {/* Model Switcher: [H][S][O] */}
            {!planOnly && !emailMode && (
              <>
                <span className="mx-1 text-xs" style={{ color: '#444444' }}>|</span>
                {(['haiku', 'sonnet', 'opus'] as const).map(m => {
                  const isActive = modelChoice === m
                  const label = m === 'haiku' ? 'H' : m === 'sonnet' ? 'S' : 'O'
                  const isOpusActive = m === 'opus' && isActive
                  const isHaikuActive = m === 'haiku' && isActive
                  return (
                    <button
                      key={m}
                      onClick={() => setModelChoice(m)}
                      className="w-7 h-7 rounded-md text-sm font-semibold flex items-center justify-center transition-all duration-150"
                      style={{
                        backgroundColor: isActive ? (isOpusActive ? '#2d1f00' : isHaikuActive ? '#0a1a1f' : '#222222') : 'transparent',
                        color: isActive ? (isOpusActive ? '#f5a623' : isHaikuActive ? '#34d399' : '#ffffff') : '#666666',
                        border: isActive ? (isOpusActive ? '1px solid #f5a623' : isHaikuActive ? '1px solid #34d399' : '1px solid #333333') : '1px solid transparent',
                      }}
                      title={m === 'haiku' ? 'Haiku (fast & lightweight)' : m === 'sonnet' ? 'Sonnet (default)' : `Opus (effort: ${effortLevel})`}
                    >
                      {label}
                    </button>
                  )
                })}
                {modelChoice === 'opus' && (
                  <button
                    onClick={() => {
                      const cycle = ['low', 'medium', 'high'] as const
                      setEffortLevel(prev => cycle[(cycle.indexOf(prev) + 1) % 3])
                    }}
                    className="w-7 h-7 rounded-md text-xs font-semibold flex items-center justify-center transition-all duration-150"
                    style={{
                      backgroundColor: '#2d1f00',
                      color: '#f5a623',
                      border: '1px solid #f5a623',
                    }}
                    title={`Effort: ${effortLevel}`}
                  >
                    {effortLevel === 'low' ? 'L' : effortLevel === 'medium' ? 'M' : 'H'}
                  </button>
                )}
                <span className="mx-1 text-xs" style={{ color: '#444444' }}>|</span>
              </>
            )}


            {!planOnly && !emailMode && (
              <button
                onClick={() => runSkill('ship')}
                disabled={isStreaming}
                className="w-7 h-7 rounded-md text-sm flex items-center justify-center transition-all duration-150 disabled:opacity-40"
                style={{
                  backgroundColor: 'transparent',
                  color: '#666666',
                  border: '1px solid transparent',
                }}
                title="Ship (部署)"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
              </button>
            )}

            {!planOnly && !emailMode && (
              <button
                onClick={() => setShowImagePicker(true)}
                disabled={isStreaming}
                className="w-7 h-7 rounded-md text-sm flex items-center justify-center transition-all duration-150 disabled:opacity-40"
                style={{
                  backgroundColor: 'transparent',
                  color: '#666666',
                  border: '1px solid transparent',
                }}
                title="從專案選擇圖片"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </button>
            )}
          </div>

          {/* Right: Send/Stop */}
          <div className="flex-shrink-0 ml-2">
            {isStreaming ? (
              <button
                onClick={stopStreaming}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105"
                style={{ backgroundColor: '#ef4444', color: 'white' }}
                title="停止 (Esc)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="4" y="4" width="16" height="16" rx="2"/>
                </svg>
              </button>
            ) : (
              <button
                onClick={handleSend}
                disabled={!hasInput && images.length === 0}
                className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{
                  backgroundColor: (hasInput || images.length > 0) ? '#ffffff' : '#1a1a1a',
                  color: (hasInput || images.length > 0) ? '#000000' : '#444444',
                }}
                title="傳送 (Enter)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {showImagePicker && (
        <ProjectImagePicker
          projectId={projectId}
          onSelect={addImages}
          onClose={() => setShowImagePicker(false)}
        />
      )}
    </div>
  )
}
