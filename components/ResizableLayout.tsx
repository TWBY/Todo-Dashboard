'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'
import { useChatPanels } from '@/contexts/ChatPanelsContext'
import { useLeftPanel } from '@/contexts/LeftPanelContext'
import { useBuildPanel } from '@/contexts/BuildPanelContext'
import ClaudeChatPanel from '@/components/ClaudeChatPanel'
import TeamMonitorPanel from '@/components/TeamMonitorPanel'
import BuildPanel from '@/components/BuildPanel'
import QuickTodoModal from '@/components/QuickTodoModal'

// — M3 Easing Utilities —
function bezierPoint(p1: number, p2: number, t: number): number {
  return 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t
}

function bezierSlope(p1: number, p2: number, t: number): number {
  return 3 * (1 - t) * (1 - t) * p1 + 6 * (1 - t) * t * (p2 - p1) + 3 * t * t * (1 - p2)
}

function cubicBezierEase(x1: number, y1: number, x2: number, y2: number) {
  return (t: number): number => {
    if (t <= 0) return 0
    if (t >= 1) return 1
    let guess = t
    for (let i = 0; i < 8; i++) {
      const err = bezierPoint(x1, x2, guess) - t
      const slope = bezierSlope(x1, x2, guess)
      if (Math.abs(slope) < 1e-7) break
      guess -= err / slope
    }
    return bezierPoint(y1, y2, guess)
  }
}

// Material Design 3 Emphasized easing curves
const M3_DECELERATE = cubicBezierEase(0.05, 0.7, 0.1, 1)   // 進場用
const M3_ACCELERATE = cubicBezierEase(0.3, 0, 0.8, 0.15)   // 退場用

interface ResizableLayoutProps {
  left: React.ReactNode
}

const DEFAULT_RIGHT_PCT = 50
const MIN_RIGHT_PCT = 20
const MAX_RIGHT_PCT = 85
const MIN_LEFT_PX = 360
const MIN_CHAT_PX = 360

function Divider({ onMouseDown, dividerRef }: { onMouseDown: (e: React.MouseEvent) => void; dividerRef: React.RefObject<HTMLDivElement | null> }) {
  return (
    <div
      ref={dividerRef}
      onMouseDown={onMouseDown}
      className="divider-handle flex-shrink-0 cursor-col-resize flex items-stretch justify-center relative z-10"
    >
      <div className="divider-bg" />
      <div className="divider-line" />
    </div>
  )
}

export default function ResizableLayout({ left }: ResizableLayoutProps) {
  const router = useRouter()
  const { openPanels, removePanel, addPanel } = useChatPanels()
  const { collapsed: leftCollapsed, toggle: toggleLeft } = useLeftPanel()
  const { open: buildPanelOpen, toggle: toggleBuildPanel } = useBuildPanel()
  const [todoModalOpen, setTodoModalOpen] = useState(false)

  const DASHBOARD_PROJECT_ID = 'dashboard'
  const DASHBOARD_PROJECT_NAME = 'Todo-Dashboard'

  const openAskChat = () => {
    addPanel(DASHBOARD_PROJECT_ID, DASHBOARD_PROJECT_NAME, { emailMode: true })
  }
  const [rightPct, setRightPct] = useState(DEFAULT_RIGHT_PCT)
  const isDragging = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const leftPanelRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const expandBtnRef = useRef<HTMLButtonElement>(null)
  const dividerRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const collapsedRef = useRef(leftCollapsed)
  const rightPctRef = useRef(rightPct)
  const panelCountRef = useRef(0)
  const hasMounted = useRef(false)
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set())

  // Keep refs in sync
  rightPctRef.current = rightPct

  // 統一 clamp 邏輯：同時考慮百分比上下限和像素最小左寬
  const clampRightPct = useCallback((pct: number) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return Math.min(MAX_RIGHT_PCT, Math.max(MIN_RIGHT_PCT, pct))
    const maxFromPx = ((rect.width - MIN_LEFT_PX) / rect.width) * 100
    const effectiveMax = Math.min(MAX_RIGHT_PCT, maxFromPx)
    return Math.min(effectiveMax, Math.max(MIN_RIGHT_PCT, pct))
  }, [])

  // 從 localStorage 讀取右側面板群寬度百分比，mount 後 clamp
  useEffect(() => {
    const saved = localStorage.getItem('dashboard-right-pct')
    const raw = saved ? parseFloat(saved) : DEFAULT_RIGHT_PCT
    // 延一幀確保 containerRef ready，再根據實際寬度 clamp
    requestAnimationFrame(() => {
      setRightPct(clampRightPct(raw))
    })
  }, [clampRightPct])

  // 視窗 resize 時重新 clamp，確保左側不低於最小寬度
  useEffect(() => {
    const handleResize = () => {
      if (panelCountRef.current === 0 || collapsedRef.current) return
      setRightPct(prev => clampRightPct(prev))
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [clampRightPct])


  // Mount 時設定初始狀態（不播動畫）
  useEffect(() => {
    const panel = leftPanelRef.current
    const expandBtn = expandBtnRef.current
    const divider = dividerRef.current
    if (!panel || !expandBtn || !divider) return

    const content = contentRef.current
    const noPanels = openPanels.length === 0 && !buildPanelOpen

    if (leftCollapsed) {
      gsap.set(panel, { width: 0, padding: 0, overflow: 'hidden' })
      gsap.set(expandBtn, { width: 24, opacity: 1, overflow: 'visible' })
      gsap.set(divider, { width: 0, opacity: 0, overflow: 'hidden' })
      if (content) gsap.set(content, { opacity: 0, x: -8 })
    } else if (noPanels) {
      // 無 Chat — 左側滿版
      gsap.set(panel, {
        width: '100%',
        paddingTop: '1.5rem', paddingBottom: '1rem',
        paddingLeft: '1rem', paddingRight: '1rem',
        overflowY: 'auto',
      })
      gsap.set(expandBtn, { width: 0, opacity: 0, overflow: 'hidden' })
      gsap.set(divider, { width: 0, opacity: 0, overflow: 'hidden' })
      if (content) gsap.set(content, { opacity: 1, x: 0 })
    } else {
      gsap.set(panel, {
        width: `${100 - rightPctRef.current}%`,
        paddingTop: '1.5rem', paddingBottom: '1rem',
        paddingLeft: '1rem', paddingRight: '1rem',
        overflowY: 'auto',
      })
      gsap.set(expandBtn, { width: 0, opacity: 0, overflow: 'hidden' })
      gsap.set(divider, { width: 16, opacity: 1 })
      if (content) gsap.set(content, { opacity: 1, x: 0 })
    }

    // 右側面板群由 CSS class + data-state 控制，不需要 GSAP

    collapsedRef.current = leftCollapsed
    panelCountRef.current = openPanels.length
    hasMounted.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // GSAP 收合/展開動畫 — 只在 leftCollapsed 實際改變時觸發
  useEffect(() => {
    if (!hasMounted.current) return
    // 只在值真正改變時才動畫
    if (leftCollapsed === collapsedRef.current) return
    collapsedRef.current = leftCollapsed

    const panel = leftPanelRef.current
    const expandBtn = expandBtnRef.current
    const divider = dividerRef.current
    if (!panel || !expandBtn || !divider) return

    const content = contentRef.current

    // Kill any ongoing animations & reset content if expanding
    gsap.killTweensOf([panel, expandBtn, divider, content].filter(Boolean))
    if (!leftCollapsed && content) {
      gsap.set(content, { opacity: 1, x: 0 })
    }

    if (leftCollapsed) {
      // — 收合動畫 —
      // 階段 1: 內容淡出 → 階段 2: 面板縮合 + Divider → 階段 3: 展開按鈕出現
      const tl = gsap.timeline()
      panel.style.overflow = 'hidden'
      panel.style.willChange = 'width'

      // 階段 1: 內容淡出 (120ms, M3 Accelerate)
      if (content) {
        tl.to(content, {
          opacity: 0,
          x: -8,
          duration: 0.12,
          ease: M3_ACCELERATE,
        })
      }

      // 階段 2: 面板寬度歸零 (250ms, M3 Accelerate)，與階段 1 尾端重疊 50ms
      tl.to(panel, {
        width: 0,
        padding: 0,
        duration: 0.25,
        ease: M3_ACCELERATE,
        onComplete: () => { panel.style.willChange = 'auto' },
      }, '-=0.05')

      // Divider 同步消失 (150ms, M3 Accelerate)
      tl.to(divider, {
        width: 0,
        opacity: 0,
        duration: 0.15,
        ease: M3_ACCELERATE,
        onComplete: () => { divider.style.overflow = 'hidden' },
      }, '<')

      // 階段 3: 展開按鈕出現 (150ms, M3 Decelerate)，與階段 2 尾端重疊
      tl.to(expandBtn, {
        width: 24,
        opacity: 1,
        duration: 0.15,
        ease: M3_DECELERATE,
        onStart: () => { expandBtn.style.overflow = 'visible' },
      }, '-=0.1')
    } else {
      // — 展開動畫 —
      // 階段 1: 展開按鈕消失 → 階段 2: 面板展開 + Divider → 階段 3: 內容淡入
      const tl = gsap.timeline()

      // 預設內容為隱藏
      if (content) {
        gsap.set(content, { opacity: 0, x: -8 })
      }

      // 階段 1: 展開按鈕消失 (100ms, M3 Accelerate)
      tl.to(expandBtn, {
        width: 0,
        opacity: 0,
        duration: 0.1,
        ease: M3_ACCELERATE,
        onComplete: () => { expandBtn.style.overflow = 'hidden' },
      })

      // 階段 2: 面板展開 (300ms, M3 Decelerate)
      // 展開時反向檢查：確保 Chat 面板仍有足夠空間
      if (panelCountRef.current > 0) {
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          const neededRightPx = panelCountRef.current * MIN_CHAT_PX
          const neededPct = (neededRightPx / rect.width) * 100
          const targetPct = Math.max(rightPctRef.current, neededPct)
          const clamped = clampRightPct(targetPct)
          if (clamped !== rightPctRef.current) setRightPct(clamped)
        }
      }

      panel.style.overflow = 'hidden'
      panel.style.willChange = 'width'

      const targetWidth = panelCountRef.current > 0 ? `${100 - rightPctRef.current}%` : '100%'
      tl.to(panel, {
        width: targetWidth,
        paddingTop: '1.5rem',
        paddingBottom: '1rem',
        paddingLeft: '1rem',
        paddingRight: '1rem',
        duration: 0.3,
        ease: M3_DECELERATE,
        onComplete: () => {
          panel.style.overflow = 'auto'
          panel.style.overflowY = 'auto'
          panel.style.willChange = 'auto'
        },
      }, '-=0.03')

      // Divider 延遲 100ms 出現 — 僅在有 Chat 時
      if (panelCountRef.current > 0) {
        tl.to(divider, {
          width: 16,
          opacity: 1,
          duration: 0.2,
          ease: M3_DECELERATE,
          onStart: () => { divider.style.overflow = 'visible' },
        }, '<+0.1')
      }

      // 階段 3: 內容淡入 (200ms, M3 Decelerate)，與面板展開尾端重疊
      if (content) {
        tl.to(content, {
          opacity: 1,
          x: 0,
          duration: 0.2,
          ease: M3_DECELERATE,
        }, '-=0.15')
      }
    }
  }, [leftCollapsed])

  // Chat / Build 面板增減時的佈局動畫（漸進式空間讓渡）
  const virtualPanelCount = Math.max(openPanels.length, buildPanelOpen ? 1 : 0)
  useEffect(() => {
    if (!hasMounted.current) return
    const prevCount = panelCountRef.current
    const newCount = virtualPanelCount
    if (newCount === prevCount) return
    panelCountRef.current = newCount

    const panel = leftPanelRef.current
    const divider = dividerRef.current
    if (!panel || !divider) return

    const hadPanels = prevCount > 0
    const hasPanels = newCount > 0
    const increased = newCount > prevCount

    // 左側收合狀態下，右側面板群由 CSS data-state 自動處理顯隱
    if (collapsedRef.current) return

    gsap.killTweensOf([panel, divider].filter(Boolean))

    if (hasPanels && !hadPanels) {
      // === 0 → N：滿版 → 分割（右側由 CSS data-state 自動處理）===
      const rect = containerRef.current?.getBoundingClientRect()
      let targetPct = rightPctRef.current

      if (rect) {
        const neededRightPx = newCount * MIN_CHAT_PX
        const neededPct = (neededRightPx / rect.width) * 100
        targetPct = Math.max(targetPct, neededPct)
      }

      const clamped = clampRightPct(targetPct)
      if (clamped !== rightPctRef.current) setRightPct(clamped)

      // 左側面板縮小 + divider 出現
      panel.style.width = `${100 - clamped}%`
      divider.style.width = '16px'
      divider.style.opacity = '1'
      divider.style.overflow = 'visible'
    } else if (!hasPanels && hadPanels) {
      // === N → 0：分割 → 滿版（右側由 CSS data-state 自動隱藏）===
      divider.style.width = '0'
      divider.style.opacity = '0'
      divider.style.overflow = 'hidden'
      panel.style.width = '100%'
    } else if (increased) {
      // === N → N+M：面板增加，漸進式空間讓渡 ===
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const neededRightPx = newCount * MIN_CHAT_PX
      const availableWithLeft = rect.width - MIN_LEFT_PX - 16 // divider

      if (neededRightPx <= availableWithLeft) {
        // 步驟 1+2：調整 rightPct，左側保持展開
        const neededPct = (neededRightPx / rect.width) * 100
        const targetPct = Math.max(rightPctRef.current, neededPct)
        const clamped = clampRightPct(targetPct)

        if (clamped !== rightPctRef.current) {
          setRightPct(clamped)
          // 動畫左側面板到新寬度
          panel.style.willChange = 'width'
          gsap.to(panel, {
            width: `${100 - clamped}%`,
            duration: 0.3,
            ease: M3_DECELERATE,
            onComplete: () => { panel.style.willChange = 'auto' },
          })
        }
      } else {
        // 步驟 3：空間不足，自動收合左側面板
        toggleLeft()
        // 收合動畫由 leftCollapsed effect 處理
        // 步驟 4 由 overflow-x-auto 兜底（Chat 面板有 minWidth + flex-shrink-0）
      }
    }
    // 面板減少（但不歸零）：不自動縮小 rightPct，讓用戶保持當前佈局
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualPanelCount])

  // 拖曳時更新面板寬度（非動畫，直接設定）
  useEffect(() => {
    if (!hasMounted.current || leftCollapsed || panelCountRef.current === 0) return
    const panel = leftPanelRef.current
    if (panel) {
      panel.style.width = `${100 - rightPct}%`
    }
  }, [rightPct, leftCollapsed])

  // 所有面板：僅動態面板
  const allPanels = openPanels.map(p => ({ panelId: p.panelId, projectId: p.projectId, projectName: p.projectName, type: p.type || 'chat' as const, teamName: p.teamName, isFixed: false, planOnly: p.planOnly, emailMode: p.emailMode, model: p.model, initialMessage: p.initialMessage, initialMode: p.initialMode, sessionId: p.sessionId, ephemeral: p.ephemeral }))

  // Chat 面板退場：設定 exitingIds，CSS transition 處理淡出，onTransitionEnd 移除
  const handlePanelClose = useCallback((panelId: string) => {
    if (exitingIds.has(panelId)) return
    setExitingIds(prev => new Set(prev).add(panelId))
  }, [exitingIds])

  const handleDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const rightPx = rect.right - e.clientX
      const pct = (rightPx / rect.width) * 100
      setRightPct(clampRightPct(pct))
    }

    const handleMouseUp = () => {
      if (isDragging.current) {
        isDragging.current = false
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        setRightPct(prev => {
          localStorage.setItem('dashboard-right-pct', String(prev))
          return prev
        })
      }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  // 版面重置救援按鈕：清除左側 GSAP 殘留樣式，右側由 CSS 自動處理
  useEffect(() => {
    const handleLayoutReset = () => {
      const panel = leftPanelRef.current
      const divider = dividerRef.current
      if (!panel || !divider) return

      const noPanels = openPanels.length === 0 && !buildPanelOpen

      // 停止左側面板和 divider 的動畫
      gsap.killTweensOf([panel, divider])

      if (noPanels) {
        gsap.set(panel, {
          width: '100%',
          paddingTop: '1.5rem', paddingBottom: '1rem',
          paddingLeft: '1rem', paddingRight: '1rem',
          overflowY: 'auto',
        })
        gsap.set(divider, { width: 0, opacity: 0, overflow: 'hidden' })
      } else {
        const clamped = clampRightPct(rightPctRef.current)
        gsap.set(panel, {
          width: `${100 - clamped}%`,
          paddingTop: '1.5rem', paddingBottom: '1rem',
          paddingLeft: '1rem', paddingRight: '1rem',
          overflowY: 'auto',
        })
        gsap.set(divider, { width: 16, opacity: 1 })
      }
      // 右側面板群完全由 CSS class + data-state 控制，無需重置
    }

    window.addEventListener('layout-reset', handleLayoutReset)
    return () => window.removeEventListener('layout-reset', handleLayoutReset)
  }, [openPanels.length, clampRightPct])

  // 是否顯示空狀態提示（左側收合 + 無 Chat 面板）
  const showEmptyState = leftCollapsed && virtualPanelCount === 0

  return (
    <div ref={containerRef} className="h-screen flex">
      {/* 左側主內容 — 不用條件式 style，完全由 GSAP 控制 */}
      <div
        ref={leftPanelRef}
        className="min-w-0 shrink-0 flex flex-col"
      >
        <div ref={contentRef} className="flex-1 overflow-y-auto">
          {left}
        </div>
        {/* 底部導覽按鈕 */}
        <div className="flex flex-col gap-2 p-3">
          {/* 第一排：動作類 */}
          <div className="flex gap-2">
            <button
              onClick={() => setTodoModalOpen(true)}
              className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: 'var(--background-tertiary)',
                color: 'var(--text-tertiary)',
              }}
            >
              待辦
            </button>
            <button
              onClick={openAskChat}
              className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: 'var(--background-tertiary)',
                color: 'var(--text-tertiary)',
              }}
              suppressHydrationWarning
            >
              Email
            </button>
            <button
              onClick={() => router.push('/docs')}
              className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: 'var(--background-tertiary)',
                color: 'var(--text-tertiary)',
              }}
            >
              技術文件
            </button>
          </div>

          {/* 第二排：導覽類 */}
          <div className="flex gap-2">
            <button
              onClick={() => router.push('/chat/center')}
              className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: 'var(--background-tertiary)',
                color: 'var(--text-tertiary)',
              }}
              title="Chat 功能中心"
            >
              Chat
            </button>
            <button
              onClick={() => router.push('/blog/pipeline')}
              className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: 'var(--background-tertiary)',
                color: 'var(--text-tertiary)',
              }}
              title="Blog 編輯流水線"
            >
              Blog
            </button>
            <button
              onClick={() => router.push('/skills')}
              className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: 'var(--background-tertiary)',
                color: 'var(--text-tertiary)',
              }}
              title="Skills 總覽"
            >
              Skills
            </button>
            <button
              onClick={() => router.push('/agent-sdk')}
              className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: 'var(--background-tertiary)',
                color: 'var(--text-tertiary)',
              }}
              title="Agent SDK 入門指南"
            >
              SDK
            </button>
          </div>

          {/* 第三排：Pack / Log */}
          <div className="flex gap-2">
            <button
              onClick={toggleBuildPanel}
              className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
              style={{ backgroundColor: '#332815', color: '#f59e0b', border: '1px solid #4a3520' }}
              title="版本升級與打包流程"
            >
              P
            </button>
            <button
              onClick={() => router.push('/changelog')}
              className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
              style={{ backgroundColor: '#1f1533', color: '#a78bfa', border: '1px solid #3b2663' }}
              title="版本歷史"
            >
              L
            </button>
          </div>

          {/* 第四排：Dev 工具（僅開發環境） */}
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={() => router.push('/chat-demo')}
              className="w-full py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: 'var(--background-tertiary)',
                color: 'var(--text-tertiary)',
              }}
            >
              Chat Demo
            </button>
          )}
        </div>
      </div>

      {/* 收合時的展開長條 — 始終在 DOM 中，靠 GSAP 控制寬度 */}
      <button
        ref={expandBtnRef}
        onClick={toggleLeft}
        className="flex-shrink-0 h-screen cursor-pointer"
        style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.15)' }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)' }}
        title="展開專案列表"
      />

      {/* 空狀態提示 — 左側收合且無 Chat 時顯示 */}
      {showEmptyState && (
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={toggleLeft}
            className="flex items-center gap-3 px-6 py-4 rounded-lg cursor-pointer transition-colors"
            style={{
              backgroundColor: 'rgba(255,255,255,0.05)',
              color: 'var(--text-secondary)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.08)'
              e.currentTarget.style.color = 'var(--text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'
              e.currentTarget.style.color = 'var(--text-secondary)'
            }}
          >
            <i className="fa-solid fa-arrow-left" style={{ fontSize: '1.25rem', fontWeight: 900 }} />
            <span style={{ fontSize: '1rem' }}>請開啟左側面板開始</span>
          </button>
        </div>
      )}

      {/* 左右分隔拖曳條 — 始終在 DOM 中，靠 GSAP 控制 */}
      <Divider dividerRef={dividerRef} onMouseDown={handleDividerMouseDown} />

      {/* 右側面板群 — 純 CSS Grid，不受 GSAP 干擾 */}
      <div
        ref={rightPanelRef}
        className="right-panel-group"
        data-state={virtualPanelCount === 0 ? 'hidden' : 'visible'}
        style={{
          gridTemplateColumns: `repeat(${allPanels.length || 1}, minmax(${MIN_CHAT_PX}px, 1fr))`,
          position: 'relative',
        }}
      >
        {allPanels.map((panel) => (
          <div
            key={panel.panelId}
            className="chat-panel-cell"
            data-exiting={exitingIds.has(panel.panelId) ? 'true' : undefined}
            onTransitionEnd={(e) => {
              if (e.propertyName === 'opacity' && exitingIds.has(panel.panelId)) {
                removePanel(panel.panelId)
                setExitingIds(prev => { const next = new Set(prev); next.delete(panel.panelId); return next })
              }
            }}
          >
            {panel.type === 'team-monitor' ? (
              <TeamMonitorPanel
                key={panel.teamName}
                teamName={panel.teamName || ''}
                panelId={panel.panelId}
                onClose={() => handlePanelClose(panel.panelId)}
              />
            ) : (
              <ClaudeChatPanel
                projectId={panel.projectId}
                projectName={panel.projectName}
                panelId={panel.panelId}
                isFixed={panel.isFixed}
                planOnly={panel.planOnly}
                emailMode={panel.emailMode}
                model={panel.model}
                sessionId={panel.sessionId}
                initialMessage={panel.initialMessage}
                initialMode={panel.initialMode}
                ephemeral={panel.ephemeral}
                onClose={() => handlePanelClose(panel.panelId)}
              />
            )}
          </div>
        ))}

        {/* Build 面板 — 覆蓋在 Chat 面板之上 */}
        {buildPanelOpen && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, backgroundColor: 'var(--background-primary)' }}>
            <BuildPanel />
          </div>
        )}
      </div>

      <QuickTodoModal
        open={todoModalOpen}
        onClose={() => setTodoModalOpen(false)}
      />
    </div>
  )
}
