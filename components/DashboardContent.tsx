'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DevServerPanel from './DevServerPanel';
import ScratchPad from './ScratchPad';
import ResizableLayout from './ResizableLayout';

const CDP_INTERVAL = 10

function CdpStatusBadge() {
  const [cdpActive, setCdpActive] = useState<boolean | null>(null)
  const [restarting, setRestarting] = useState(false)

  const checkStatus = useCallback(() => {
    fetch('/api/cdp-status')
      .then(r => r.json())
      .then(d => setCdpActive(d.portOpen && d.cdpResponding && d.wsConnectable !== false))
      .catch(() => setCdpActive(false))
  }, [])

  useEffect(() => {
    checkStatus()
  }, [checkStatus])

  const handleRestart = useCallback((withCdp: boolean) => {
    setRestarting(true)
    fetch('/api/cdp-restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cdp: withCdp }),
    }).finally(() => {
      setTimeout(() => {
        setRestarting(false)
        checkStatus()
      }, 4000)
    })
  }, [checkStatus])

  if (cdpActive === null) return null

  return (
    <button
      onClick={() => handleRestart(!cdpActive)}
      disabled={restarting}
      className="flex-shrink-0 mt-3 mx-3 w-auto text-xs py-1.5 px-3 rounded-lg cursor-pointer transition-all"
      style={{
        backgroundColor: restarting ? 'var(--background-tertiary)' : cdpActive ? 'transparent' : 'var(--accent-color, #0184ff)',
        color: restarting ? 'var(--text-tertiary)' : cdpActive ? 'var(--text-secondary)' : '#fff',
        opacity: restarting ? 0.6 : 1,
        border: cdpActive ? '1px solid var(--border-color)' : 'none',
      }}
    >
      {restarting ? '重新啟動中...' : cdpActive ? '關閉 CDP' : '開啟 CDP'}
    </button>
  )
}

export default function DashboardContent() {
  const router = useRouter();

  return (
    <>
    <ResizableLayout
      left={
        <div className="animate-fade-in flex flex-col h-full">
          {/* Quick Actions: ScratchPad */}
          <div className="flex-shrink-0 mb-3">
            <ScratchPad />
          </div>

          {/* Main: Dev Server panel (fills remaining space) */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <DevServerPanel />
          </div>

          {/* Chat Test Lab 按鈕（僅 dev 環境） */}
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={() => router.push('/chat-test')}
              className="flex-shrink-0 mt-3 mx-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-colors"
              style={{
                backgroundColor: 'var(--background-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-flask-vial" style={{ fontSize: '0.75rem' }} />
              <span>Chat Test Lab</span>
            </button>
          )}

          {/* CDP Status */}
          <CdpStatusBadge />

        </div>
      }
    />

    </>
  );
}
