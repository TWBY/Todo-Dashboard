'use client'
import React from 'react'
import type { Scenario, ScenarioCategory } from './scenarios'

interface Props {
  scenarios: Scenario[]
  categories: ScenarioCategory[]
  selectedId: string
  onSelect: (id: string) => void
}

const TYPE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  static:      { bg: '#0e2a18', color: '#3fb950', label: 'fixture' },
  interactive: { bg: '#2a1800', color: '#f97316', label: 'live' },
  team:        { bg: '#1e0e3a', color: '#bc8cff', label: 'team' },
}

export default function ScenarioList({ scenarios, categories, selectedId, onSelect }: Props) {
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
    }}>
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
              </button>
            )
          })}

          {/* Category spacer */}
          <div style={{ height: 8 }} />
        </div>
      ))}
    </div>
  )
}
