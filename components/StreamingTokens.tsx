'use client'

import React, { useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface TokenChunk {
  text: string
  key: number
}

/**
 * Streaming 文字的漸進式揭露元件。
 *
 * 原理（靈感來自 FlowToken 的 diff 模式）：
 * 1. 追蹤上一次的 content，找出新增的文字（diff）
 * 2. 每個 diff chunk 用 <span className="streaming-token"> 包裝
 * 3. CSS @keyframes streaming-fade-in 讓新 chunk fadeIn + blurIn
 * 4. React key 確保已有的 chunk 不會重複動畫
 *
 * 用法：<StreamingTokens content={msg.content} markdownComponents={...} />
 */
function DiffTokenizer({ text, animate }: { text: string; animate: boolean }) {
  const chunksRef = useRef<TokenChunk[]>([])
  const prevTextRef = useRef('')

  if (text !== prevTextRef.current) {
    if (text.length < prevTextRef.current.length || !text.startsWith(prevTextRef.current)) {
      // 文字變短或完全不同 → 重置
      chunksRef.current = [{ text, key: 0 }]
    } else {
      const newContent = text.slice(prevTextRef.current.length)
      if (newContent.length > 0) {
        chunksRef.current = [
          ...chunksRef.current,
          { text: newContent, key: chunksRef.current.length },
        ]
      }
    }
    prevTextRef.current = text
  }

  // streaming 結束後不套動畫，避免切換元件時的「啪」一聲
  if (!animate) {
    return <>{chunksRef.current.map((c) => c.text).join('')}</>
  }

  return (
    <>
      {chunksRef.current.map((chunk) => (
        <span key={chunk.key} className="streaming-token">
          {chunk.text}
        </span>
      ))}
    </>
  )
}

// 從 ReactMarkdown children 中提取純文字（遞迴處理嵌套元素）
function extractText(children: React.ReactNode): string {
  if (typeof children === 'string') return children
  if (typeof children === 'number') return String(children)
  if (Array.isArray(children)) return children.map(extractText).join('')
  if (React.isValidElement(children)) {
    const props = children.props as Record<string, unknown>
    if (props.children) return extractText(props.children as React.ReactNode)
  }
  return ''
}

// 包裝函式：保留原始 Markdown 元素結構，但對文字 children 套用 DiffTokenizer
function AnimatedChildren({ children, animate }: { children: React.ReactNode; animate: boolean }) {
  const text = extractText(children)
  return <DiffTokenizer text={text} animate={animate} />
}

export function StreamingTokens({
  content,
  isStreaming,
  markdownComponents,
}: {
  content: string
  isStreaming: boolean
  markdownComponents?: Record<string, React.ComponentType<any>>
}) {
  // 將文字元素包裝成帶動畫的版本
  const streamComponents = React.useMemo(() => ({
    ...markdownComponents,
    p: ({ children, ...props }: any) => (
      <p {...props} ><AnimatedChildren animate={isStreaming}>{children}</AnimatedChildren></p>
    ),
    li: ({ children, ...props }: any) => (
      <li {...props} ><AnimatedChildren animate={isStreaming}>{children}</AnimatedChildren></li>
    ),
    h1: ({ children, ...props }: any) => (
      <h1 {...props} ><AnimatedChildren animate={isStreaming}>{children}</AnimatedChildren></h1>
    ),
    h2: ({ children, ...props }: any) => (
      <h2 {...props} ><AnimatedChildren animate={isStreaming}>{children}</AnimatedChildren></h2>
    ),
    h3: ({ children, ...props }: any) => (
      <h3 {...props} ><AnimatedChildren animate={isStreaming}>{children}</AnimatedChildren></h3>
    ),
    h4: ({ children, ...props }: any) => (
      <h4 {...props} ><AnimatedChildren animate={isStreaming}>{children}</AnimatedChildren></h4>
    ),
    strong: ({ children, ...props }: any) => (
      <strong {...props}><AnimatedChildren animate={isStreaming}>{children}</AnimatedChildren></strong>
    ),
    em: ({ children, ...props }: any) => (
      <em {...props}><AnimatedChildren animate={isStreaming}>{children}</AnimatedChildren></em>
    ),
  }), [markdownComponents, isStreaming])

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={streamComponents}>
      {content}
    </ReactMarkdown>
  )
}
