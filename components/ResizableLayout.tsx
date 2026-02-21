'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import gsap from 'gsap'
import { useChatPanels } from '@/contexts/ChatPanelsContext'
import { useLeftPanel } from '@/contexts/LeftPanelContext'
import { useBuildPanel } from '@/contexts/BuildPanelContext'
import { useTodoPanel } from '@/contexts/TodoPanelContext'
import { useDocsPanel } from '@/contexts/DocsPanelContext'
import { usePortsPanel } from '@/contexts/PortsPanelContext'
import ClaudeChatPanel from '@/components/ClaudeChatPanel'
import TeamMonitorPanel from '@/components/TeamMonitorPanel'
import BuildPanel from '@/components/BuildPanel'
import TodoPanel from '@/components/TodoPanel'
import DocsPanel from '@/components/DocsPanel'
import PortsPanel from '@/components/PortsPanel'

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

const MIN_LEFT_PX = 360
const MIN_CHAT_PX = 360

function Divider({ dividerRef, onHoverClose }: { dividerRef: React.RefObject<HTMLDivElement | null>; onHoverClose: () => void }) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    dividerRef.current?.setAttribute('data-hovering', 'true')
    timerRef.current = setTimeout(() => {
      onHoverClose()
    }, 300)
  }

  const handleMouseLeave = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null }
    dividerRef.current?.setAttribute('data-hovering', 'false')
  }

  return (
    <div
      ref={dividerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="divider-handle flex-shrink-0 cursor-default flex items-stretch justify-center relative z-10"
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
  const { open: buildPanelOpen, toggle: toggleBuildPanel, close: closeBuildPanel } = useBuildPanel()
  const { open: todoPanelOpen, toggle: toggleTodoPanel, close: closeTodoPanel } = useTodoPanel()
  const { open: docsPanelOpen, toggle: toggleDocsPanel, close: closeDocsPanel } = useDocsPanel()
  const { open: portsPanelOpen, toggle: togglePortsPanel, close: closePortsPanel } = usePortsPanel()

  const DASHBOARD_PROJECT_ID = 'dashboard'
  const DASHBOARD_PROJECT_NAME = 'Todo-Dashboard'

  const openAskChat = () => {
    addPanel(DASHBOARD_PROJECT_ID, DASHBOARD_PROJECT_NAME, { emailMode: true })
  }
  const openDocsChat = () => {
    addPanel(DASHBOARD_PROJECT_ID, DASHBOARD_PROJECT_NAME, { docsMode: true })
  }
  const containerRef = useRef<HTMLDivElement>(null)
  const leftPanelRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const expandBtnRef = useRef<HTMLButtonElement>(null)
  const dividerRef = useRef<HTMLDivElement>(null)
  const rightPanelRef = useRef<HTMLDivElement>(null)
  const collapsedRef = useRef(leftCollapsed)
  const panelCountRef = useRef(0)
  const hasMounted = useRef(false)
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set())

  const activeOverlay: 'build' | 'todo' | 'docs' | 'ports' | null =
    buildPanelOpen ? 'build' :
    todoPanelOpen ? 'todo' :
    docsPanelOpen ? 'docs' :
    portsPanelOpen ? 'ports' : null
  const activeOverlayRef = useRef(activeOverlay)


  // Mount 時設定初始狀態（不播動畫）
  useEffect(() => {
    const panel = leftPanelRef.current
    const expandBtn = expandBtnRef.current
    const divider = dividerRef.current
    if (!panel || !expandBtn || !divider) return

    const content = contentRef.current
    const noPanels = openPanels.length === 0 && !buildPanelOpen && !todoPanelOpen && !docsPanelOpen && !portsPanelOpen

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
        width: `${MIN_LEFT_PX}px`,
        paddingTop: '1.5rem', paddingBottom: '1rem',
        paddingLeft: '1rem', paddingRight: '1rem',
        overflowY: 'auto',
      })
      gsap.set(expandBtn, { width: 0, opacity: 0, overflow: 'hidden' })
      gsap.set(divider, { width: 16, opacity: 1 })
      if (content) gsap.set(content, { opacity: 1, x: 0 })
    }

    // Overlay 容器初始隱藏
    if (overlayRef.current) {
      gsap.set(overlayRef.current, { opacity: 0, y: 8, pointerEvents: 'none' })
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
      panel.style.overflow = 'hidden'
      panel.style.willChange = 'width'

      const targetWidth = panelCountRef.current > 0 ? `${MIN_LEFT_PX}px` : '100%'
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

  // Overlay 淡入/淡出動畫
  useEffect(() => {
    if (!hasMounted.current) return
    const el = overlayRef.current
    if (!el) return

    gsap.killTweensOf(el)
    if (activeOverlay) {
      gsap.to(el, {
        opacity: 1, y: 0, pointerEvents: 'auto',
        duration: 0.25, ease: M3_DECELERATE, delay: 0.15,
      })
    } else {
      gsap.to(el, {
        opacity: 0, y: 8, pointerEvents: 'none',
        duration: 0.15, ease: M3_ACCELERATE,
      })
    }
    activeOverlayRef.current = activeOverlay
  }, [activeOverlay])

  // Chat / Build 面板增減時的佈局動畫（漸進式空間讓渡）
  const virtualPanelCount = Math.max(openPanels.length, (buildPanelOpen || todoPanelOpen || docsPanelOpen || portsPanelOpen) ? 1 : 0)
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
      panel.style.width = `${MIN_LEFT_PX}px`
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
      // === N → N+M：面板增加，檢查空間是否足夠 ===
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const neededRightPx = newCount * MIN_CHAT_PX
      const availableWithLeft = rect.width - MIN_LEFT_PX - 16 // divider

      if (neededRightPx > availableWithLeft) {
        // 空間不足，自動收合左側面板
        toggleLeft()
      }
      // 左側寬度固定，無需調整
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualPanelCount])

  // 所有面板：僅動態面板
  const allPanels = openPanels.map(p => ({ panelId: p.panelId, projectId: p.projectId, projectName: p.projectName, type: p.type || 'chat' as const, teamName: p.teamName, isFixed: false, planOnly: p.planOnly, emailMode: p.emailMode, model: p.model, initialMessage: p.initialMessage, initialMode: p.initialMode, sessionId: p.sessionId, ephemeral: p.ephemeral, scratchItemId: p.scratchItemId }))

  // Chat 面板退場：設定 exitingIds，CSS transition 處理淡出，onTransitionEnd 移除
  const handlePanelClose = useCallback((panelId: string) => {
    if (exitingIds.has(panelId)) return
    setExitingIds(prev => new Set(prev).add(panelId))
  }, [exitingIds])

  // 版面重置救援按鈕：清除左側 GSAP 殘留樣式，右側由 CSS 自動處理
  useEffect(() => {
    const handleLayoutReset = () => {
      const panel = leftPanelRef.current
      const divider = dividerRef.current
      if (!panel || !divider) return

      const noPanels = openPanels.length === 0 && !buildPanelOpen && !todoPanelOpen && !docsPanelOpen && !portsPanelOpen

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
        gsap.set(panel, {
          width: `${MIN_LEFT_PX}px`,
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
  }, [openPanels.length])

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
          {/* 上排：Todo, Email */}
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (todoPanelOpen) {
                  closeTodoPanel()
                  if (leftCollapsed) setTimeout(() => toggleLeft(), 130)
                } else {
                  if (buildPanelOpen) closeBuildPanel()
                  if (docsPanelOpen) closeDocsPanel()
                  if (portsPanelOpen) closePortsPanel()
                  if (!leftCollapsed) toggleLeft()
                  toggleTodoPanel()
                }
              }}
              className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: todoPanelOpen ? 'rgba(59,130,246,0.15)' : 'var(--background-tertiary)',
                color: todoPanelOpen ? '#60a5fa' : 'var(--text-tertiary)',
                border: todoPanelOpen ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
              }}
            >
              Todo
            </button>
            <a
              href="mailto:"
              className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer text-center border border-transparent"
              style={{
                backgroundColor: 'var(--background-tertiary)',
                color: 'var(--text-tertiary)',
              }}
            >
              Email
            </a>
          </div>
          {/* 下排：Ask, Doc */}
          <div className="flex gap-2">
            <button
              onClick={openAskChat}
              className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: 'var(--background-tertiary)',
                color: 'var(--text-tertiary)',
              }}
              suppressHydrationWarning
            >
              Ask
            </button>
            <button
              onClick={() => {
                if (docsPanelOpen) {
                  closeDocsPanel()
                  if (leftCollapsed) setTimeout(() => toggleLeft(), 130)
                } else {
                  if (buildPanelOpen) closeBuildPanel()
                  if (todoPanelOpen) closeTodoPanel()
                  if (portsPanelOpen) closePortsPanel()
                  if (!leftCollapsed) toggleLeft()
                  toggleDocsPanel()
                }
              }}
              className="flex-1 py-2 rounded-lg text-base transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: docsPanelOpen ? 'rgba(59,130,246,0.15)' : 'var(--background-tertiary)',
                color: docsPanelOpen ? '#60a5fa' : 'var(--text-tertiary)',
                border: docsPanelOpen ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent',
              }}
            >
              Doc
            </button>
          </div>

          {/* Dev 工具（僅開發環境） */}
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
        className="expand-handle flex-shrink-0 h-screen cursor-default"
        onMouseEnter={() => {
          if (expandTimerRef.current) clearTimeout(expandTimerRef.current)
          expandBtnRef.current?.setAttribute('data-hovering', 'true')
          expandTimerRef.current = setTimeout(() => {
            expandBtnRef.current?.setAttribute('data-hovering', 'false')
            if (leftCollapsed && buildPanelOpen) {
              closeBuildPanel()
              setTimeout(() => toggleLeft(), 130)
            } else if (leftCollapsed && todoPanelOpen) {
              closeTodoPanel()
              setTimeout(() => toggleLeft(), 130)
            } else if (leftCollapsed && docsPanelOpen) {
              closeDocsPanel()
              setTimeout(() => toggleLeft(), 130)
            } else if (leftCollapsed && portsPanelOpen) {
              closePortsPanel()
              setTimeout(() => toggleLeft(), 130)
            } else {
              toggleLeft()
            }
          }, 400)
        }}
        onMouseLeave={() => {
          if (expandTimerRef.current) { clearTimeout(expandTimerRef.current); expandTimerRef.current = null }
          expandBtnRef.current?.setAttribute('data-hovering', 'false')
        }}
        title="展開專案列表"
      />

      {/* 空狀態提示 — 左側收合且無 Chat 時顯示 */}
      {showEmptyState && (
        <div className="flex-1 flex items-center justify-center">
          <button
            onClick={() => {
              if (leftCollapsed && buildPanelOpen) {
                closeBuildPanel()
                setTimeout(() => toggleLeft(), 130)
              } else if (leftCollapsed && todoPanelOpen) {
                closeTodoPanel()
                setTimeout(() => toggleLeft(), 130)
              } else if (leftCollapsed && docsPanelOpen) {
                closeDocsPanel()
                setTimeout(() => toggleLeft(), 130)
              } else if (leftCollapsed && portsPanelOpen) {
                closePortsPanel()
                setTimeout(() => toggleLeft(), 130)
              } else {
                toggleLeft()
              }
            }}
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

      {/* 左右分隔條 — 始終在 DOM 中，靠 GSAP 控制 */}
      <Divider dividerRef={dividerRef} onHoverClose={toggleLeft} />

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
                docsMode={panel.docsMode}
                model={panel.model}
                sessionId={panel.sessionId}
                initialMessage={panel.initialMessage}
                initialMode={panel.initialMode}
                ephemeral={panel.ephemeral}
                scratchItemId={panel.scratchItemId}
                onClose={() => handlePanelClose(panel.panelId)}
              />
            )}
          </div>
        ))}

        {/* 統一 Overlay 容器 — 永遠在 DOM，靠 GSAP 控制顯隱 */}
        <div
          ref={overlayRef}
          style={{ position: 'absolute', inset: 0, zIndex: 10, backgroundColor: 'var(--background-primary)' }}
        >
          {activeOverlay === 'build' && <BuildPanel />}
          {activeOverlay === 'todo' && <TodoPanel />}
          {activeOverlay === 'docs' && <DocsPanel />}
          {activeOverlay === 'ports' && <PortsPanel />}
        </div>
      </div>
    </div>
  )
}
