'use client'

import { useState, useEffect } from 'react'
import versionConfig from '@/version.json'
import SubpageShell from '@/components/SubpageShell'

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

  useEffect(() => {
    fetch('/api/changelog')
      .then(r => r.json())
      .then(data => { setEntries(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <SubpageShell title="Changelog">
      <div className="max-w-2xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-16" style={{ color: 'var(--text-tertiary)' }}>
            載入中...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-tertiary)' }}>
            尚無 release 記錄
          </div>
        ) : (
          <div className="relative ml-16">
            {/* Timeline line */}
            <div
              className="absolute left-[7px] top-3 bottom-3"
              style={{ width: 2, backgroundColor: 'var(--border-color)' }}
            />

            <div className="space-y-0">
              {/* Current development version indicator */}
              {(() => {
                const currentDevVersion = versionConfig.development
                const latestReleaseVersion = entries.find(e => e.type === 'release')?.version?.replace(/^v/, '')
                const devVersionNumber = currentDevVersion.replace(/-dev$/, '')

                // Helper: compare semantic versions (e.g., "1.15.12" > "1.15.11")
                const isVersionGreater = (a: string, b: string): boolean => {
                  const aParts = a.split('.').map(Number)
                  const bParts = b.split('.').map(Number)
                  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
                    const aPart = aParts[i] || 0
                    const bPart = bParts[i] || 0
                    if (aPart > bPart) return true
                    if (aPart < bPart) return false
                  }
                  return false
                }

                // Only show if dev version is ahead of latest release
                if (latestReleaseVersion && isVersionGreater(devVersionNumber, latestReleaseVersion)) {
                  return (
                    <div className="relative pl-8 pb-8">
                      {/* DEV tag */}
                      <div className="absolute -left-16 top-0">
                        <span
                          className="text-xs px-1.5 py-0.5 rounded whitespace-nowrap"
                          style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}
                        >
                          DEV
                        </span>
                      </div>

                      {/* Timeline dot - pulsing animation */}
                      <div className="absolute left-0 top-1.5 w-4 h-4">
                        <div
                          className="absolute inset-0 rounded-full animate-ping"
                          style={{ backgroundColor: '#4ade80', opacity: 0.3 }}
                        />
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{ backgroundColor: '#22c55e', border: '2px solid #16a34a' }}
                        />
                      </div>

                      {/* Version info */}
                      <div className="flex items-center gap-3 mb-1">
                        <span
                          className="text-lg font-bold shrink-0"
                          style={{ color: '#4ade80' }}
                        >
                          v{devVersionNumber}
                        </span>
                        <span className="text-sm shrink-0 whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
                          開發中
                        </span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80' }}
                        >
                          {currentDevVersion}
                        </span>
                      </div>
                      <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
                        尚未發布的開發版本
                      </p>
                    </div>
                  )
                }
                return null
              })()}

              {entries.map((entry, i) => {
                const isRelease = entry.type === 'release'
                const isFirst = i === 0

                return (
                  <div key={entry.hash} className={`relative pl-8 ${isRelease ? 'pb-8' : 'pb-4'}`}>
                    {/* PROD / DEV tags — match against version.json */}
                    {isRelease && (() => {
                      const ver = entry.version.replace(/^v/, '')
                      const isProd = ver === versionConfig.production
                      const isDev = ver === versionConfig.development.replace(/-dev$/, '')
                      if (!isProd && !isDev) return null
                      return (
                        <div className="absolute -left-16 top-0 flex flex-col gap-1">
                          {isProd && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded whitespace-nowrap"
                              style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}
                            >
                              PROD
                            </span>
                          )}
                          {isDev && (
                            <span
                              className="text-xs px-1.5 py-0.5 rounded whitespace-nowrap"
                              style={{ backgroundColor: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' }}
                            >
                              DEV
                            </span>
                          )}
                        </div>
                      )
                    })()}

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
                            className="text-lg font-bold shrink-0"
                            style={{ color: isFirst ? '#a78bfa' : '#c4b5fd' }}
                          >
                            {entry.version}
                          </span>
                          <span className="text-sm shrink-0 whitespace-nowrap" style={{ color: 'var(--text-tertiary)' }}>
                            {entry.date}
                          </span>
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0"
                            style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)' }}
                          >
                            {entry.hash}
                          </span>
                        </div>
                        {entry.summary && (
                          <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
                            {entry.summary}
                          </p>
                        )}
                      </>
                    ) : (
                      /* Regular commit — grid: hash | summary | date */
                      <div
                        className="grid items-start gap-x-2"
                        style={{ gridTemplateColumns: 'auto 1fr auto' }}
                      >
                        <span
                          className="text-xs px-1.5 py-0.5 rounded font-mono whitespace-nowrap"
                          style={{ backgroundColor: 'var(--background-tertiary)', color: 'var(--text-tertiary)' }}
                        >
                          {entry.hash}
                        </span>
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                          {entry.summary}
                        </span>
                        <span className="text-xs whitespace-nowrap pt-0.5" style={{ color: 'var(--text-tertiary)' }}>
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
    </SubpageShell>
  )
}
