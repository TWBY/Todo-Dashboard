'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import versionConfig from '@/version.json'

interface ChangelogEntry {
  version: string
  summary: string
  hash: string
  date: string
  type: 'release' | 'commit'
}

export default function ChangelogPage() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/changelog')
      .then(r => r.json())
      .then(data => { setEntries(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: '#0a0a0a', color: '#e5e5e5' }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
        style={{ backgroundColor: '#0a0a0a', borderBottom: '1px solid #1a1a1a' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
            style={{ color: '#888888' }}
            title="返回 Dashboard"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/>
            </svg>
          </button>
          <h1 className="text-xl font-semibold">Changelog</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-16" style={{ color: '#666666' }}>
            載入中...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16" style={{ color: '#666666' }}>
            尚無 release 記錄
          </div>
        ) : (
          <div className="relative ml-16">
            {/* Timeline line */}
            <div
              className="absolute left-[7px] top-3 bottom-3"
              style={{ width: 2, backgroundColor: '#222222' }}
            />

            <div className="space-y-0">
              {entries.map((entry, i) => {
                const isRelease = entry.type === 'release'
                const isFirst = i === 0

                return (
                  <div key={entry.hash} className={`relative pl-8 ${isRelease ? 'pb-8' : 'pb-4'}`}>
                    {/* Version tags (only for first release) */}
                    {isRelease && isFirst && (
                      <div className="absolute -left-16 top-0 flex flex-col gap-1">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}
                        >
                          DEV
                        </span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}
                        >
                          PROD
                        </span>
                      </div>
                    )}

                    {/* Timeline dot */}
                    <div
                      className={`absolute left-0 ${isRelease ? 'top-1.5 w-4 h-4' : 'top-1.5 w-3 h-3 ml-0.5'} rounded-full`}
                      style={
                        isRelease
                          ? {
                              backgroundColor: isFirst ? '#a78bfa' : '#7c3aed',
                              border: isFirst ? '2px solid #7c3aed' : '2px solid #6d28d9',
                            }
                          : {
                              backgroundColor: '#333333',
                              border: '2px solid #444444',
                            }
                      }
                    />

                    {isRelease ? (
                      <>
                        {/* Release header */}
                        <div className="flex items-center gap-3 mb-1">
                          <span
                            className="text-lg font-bold"
                            style={{ color: isFirst ? '#a78bfa' : '#c4b5fd' }}
                          >
                            {entry.version}
                          </span>
                          <span className="text-sm" style={{ color: '#555555' }}>
                            {entry.date}
                          </span>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-mono"
                            style={{ backgroundColor: '#1a1a1a', color: '#666666' }}
                          >
                            {entry.hash}
                          </span>
                        </div>
                        {entry.summary && (
                          <p className="text-base" style={{ color: '#999999' }}>
                            {entry.summary}
                          </p>
                        )}
                      </>
                    ) : (
                      /* Regular commit */
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-mono"
                          style={{ backgroundColor: '#1a1a1a', color: '#555555' }}
                        >
                          {entry.hash}
                        </span>
                        <span className="text-sm" style={{ color: '#888888' }}>
                          {entry.summary}
                        </span>
                        <span className="text-xs" style={{ color: '#444444' }}>
                          {entry.date}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
