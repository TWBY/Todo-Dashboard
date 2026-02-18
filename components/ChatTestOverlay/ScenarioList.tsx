'use client'
import React from 'react'
import type { Scenario, ScenarioCategory } from './scenarios'
import type { TestResults, TestStatus } from './useTestResults'

interface Stats {
  total: number
  tested: number
  passed: number
  failed: number
  skipped: number
  passRate: number
}

interface Props {
  scenarios: Scenario[]
  categories: ScenarioCategory[]
  selectedId: string
  onSelect: (id: string) => void
  testResults?: TestResults
  onSetTestResult?: (scenarioId: string, status: TestStatus) => void
  stats?: Stats
}

const TYPE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  static:      { bg: '#0e2a18', color: '#3fb950', label: 'fixture' },
  interactive: { bg: '#2a1800', color: '#f97316', label: 'live' },
  team:        { bg: '#1e0e3a', color: '#bc8cff', label: 'team' },
}

export default function ScenarioList({ scenarios, categories, selectedId, onSelect, testResults, onSetTestResult, stats }: Props) {
  const grouped = categories.map(cat => ({
    ...cat,
    items: scenarios.filter(s => s.categoryId === cat.id),
  }))

  return (
    <div style={{
      width: 300,
      flexShrink: 0,
      borderRight: '1px solid #131f2e',
      overflowY: 'auto',
      backgroundColor: '#04090f',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Stats Summary Bar */}
      {stats && stats.total > 0 && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#060d19',
          borderBottom: '1px solid #131f2e',
          fontSize: '0.7rem',
          color: '#8b949e',
          flexShrink: 0,
        }}>
          <div style={{ marginBottom: 6 }}>
            <span style={{ color: '#58a6ff' }}>
              <i className="fa-solid fa-chart-simple" style={{ marginRight: 4 }} />
              通過率
            </span>
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
            <span style={{ color: '#3fb950' }}>{stats.passed}</span>
            <span style={{ color: '#8b949e' }}> / {stats.tested}</span>
            {stats.tested > 0 && (
              <span style={{ color: '#f97316', marginLeft: 8 }}>
                ({stats.passRate}%)
              </span>
            )}
          </div>
          {stats.failed > 0 && (
            <div style={{ fontSize: '0.65rem', marginTop: 4, color: '#f85149' }}>
              失敗: {stats.failed} · 跳過: {stats.skipped}
            </div>
          )}
        </div>
      )}

      {/* Scenario List */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
      {grouped.map(cat => (
        <div key={cat.id}>
          {/* Category header */}
          <div style={{
            padding: '16px 16px 8px',
            fontSize: '0.65rem',
            fontWeight: 700,
            color: cat.color,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            opacity: 0.85,
          }}>
            {cat.label}
          </div>

          {/* Scenario items */}
          {cat.items.map(scenario => {
            const isSelected = selectedId === scenario.id
            const typeStyle = TYPE_STYLE[scenario.type]
            return (
              <button
                key={scenario.id}
                onClick={() => onSelect(scenario.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '10px 16px',
                  backgroundColor: isSelected ? '#0a1e30' : 'transparent',
                  borderLeft: `3px solid ${isSelected ? cat.color : 'transparent'}`,
                  borderRight: 'none',
                  borderTop: 'none',
                  borderBottom: '1px solid #0a0f17',
                  cursor: 'pointer',
                  display: 'block',
                  transition: 'background-color 0.15s',
                }}
              >
                {/* Label row */}
                <div style={{
                  color: isSelected ? '#dde6f0' : '#8a9aaa',
                  fontSize: '0.82rem',
                  lineHeight: 1.4,
                  fontWeight: isSelected ? 600 : 400,
                  marginBottom: 5,
                }}>
                  {scenario.label}
                </div>

                {/* Meta row: type badge + description */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    backgroundColor: typeStyle.bg,
                    color: typeStyle.color,
                    padding: '1px 6px',
                    borderRadius: 4,
                    fontSize: '0.6rem',
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    flexShrink: 0,
                  }}>
                    {typeStyle.label}
                  </span>
                  <span style={{
                    color: '#3a5060',
                    fontSize: '0.68rem',
                    lineHeight: 1.3,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {scenario.description}
                  </span>
                </div>

                {/* Test Result Buttons (shown when selected) */}
                {isSelected && testResults && onSetTestResult && (
                  <div style={{
                    display: 'flex',
                    gap: 6,
                    marginTop: 8,
                    paddingTop: 8,
                    borderTop: '1px solid #0d1a2a',
                  }}>
                    {[
                      { status: 'pass' as const, label: 'Pass', color: '#3fb950' },
                      { status: 'fail' as const, label: 'Fail', color: '#f85149' },
                      { status: 'skip' as const, label: 'Skip', color: '#8b949e' },
                    ].map(btn => {
                      const isActive = testResults.results[scenario.id]?.status === btn.status
                      return (
                        <button
                          key={btn.status}
                          onClick={(e) => {
                            e.stopPropagation()
                            onSetTestResult(scenario.id, isActive ? null : btn.status)
                          }}
                          style={{
                            flex: 1,
                            padding: '4px 8px',
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            border: `1px solid ${btn.color}`,
                            backgroundColor: isActive ? btn.color + '20' : 'transparent',
                            color: isActive ? btn.color : '#4a6a8a',
                            borderRadius: 4,
                            cursor: 'pointer',
                            transition: 'all 0.1s',
                          }}
                        >
                          {btn.label}
                        </button>
                      )
                    })}
                  </div>
                )}
              </button>
            )
          })}

          {/* Category spacer */}
          <div style={{ height: 8 }} />
        </div>
      ))}
      </div>
    </div>
  )
}
