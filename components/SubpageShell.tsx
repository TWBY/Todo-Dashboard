'use client'

import { useRouter } from 'next/navigation'
import { ReactNode } from 'react'

interface SubpageShellProps {
  /** Page title displayed next to the back button */
  title: string
  /** Optional right-side header actions (chat toggle, legend, etc.) */
  headerRight?: ReactNode
  /** Optional content rendered below the header but still inside the sticky area (e.g. tabs) */
  headerExtension?: ReactNode
  /** Optional right-side panel (chat panel, etc.) */
  sidePanel?: ReactNode
  /** Main page content */
  children: ReactNode
}

export default function SubpageShell({
  title,
  headerRight,
  headerExtension,
  sidePanel,
  children,
}: SubpageShellProps) {
  const router = useRouter()

  return (
    <div
      style={{
        backgroundColor: 'var(--background-primary)',
        color: 'var(--text-primary)',
        minHeight: '100vh',
      }}
      className="flex flex-col"
    >
      {/* Sticky header */}
      <div
        style={{
          backgroundColor: 'var(--background-secondary)',
          borderBottom: '1px solid var(--border-color)',
        }}
        className="sticky top-0 z-40"
      >
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/')}
              className="px-2.5 py-1.5 rounded-lg text-sm transition-all duration-200 cursor-pointer hover:shadow-md hover:scale-[1.02] flex items-center gap-2"
              style={{
                backgroundColor: 'var(--background-tertiary)',
                color: 'var(--text-tertiary)',
                border: '1px solid var(--border-color)',
              }}
            >
              <i className="fa-solid fa-arrow-left text-xs" />
              <span>儀表板</span>
            </button>
            <h1
              className="text-lg font-semibold"
              style={{ color: 'var(--text-primary)' }}
            >
              {title}
            </h1>
          </div>
          {headerRight && (
            <div className="flex items-center gap-3">
              {headerRight}
            </div>
          )}
        </div>
        {headerExtension}
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
        {sidePanel}
      </div>
    </div>
  )
}
