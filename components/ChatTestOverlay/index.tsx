'use client'
import React, { useState } from 'react'
import { ChatPanelsProvider } from '@/contexts/ChatPanelsContext'
import ScenarioList from './ScenarioList'
import StaticViewer from './StaticViewer'
import InteractiveViewer from './InteractiveViewer'
import TeamViewer from './TeamViewer'
import { CATEGORIES, SCENARIOS, type Scenario } from './scenarios'

interface Props {
  onClose: () => void
}

function ScenarioViewer({ scenario }: { scenario: Scenario }) {
  if (scenario.type === 'static') {
    return <StaticViewer key={scenario.id} scenario={scenario} />
  }
  if (scenario.type === 'team') {
    return <TeamViewer key={scenario.id} scenario={scenario} />
  }
  return <InteractiveViewer key={scenario.id} scenario={scenario} />
}

export default function ChatTestOverlay({ onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string>('1-1')
  const scenario = SCENARIOS.find(s => s.id === selectedId) ?? SCENARIOS[0]

  return (
    <ChatPanelsProvider>
    <div
      data-debug-overlay
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        height: 52,
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        backgroundColor: '#04090f',
        borderBottom: '1px solid #131f2e',
        flexShrink: 0,
        gap: 12,
      }}>
        <i className="fa-solid fa-flask-vial" style={{ color: '#58a6ff', fontSize: '1rem' }} />
        <span style={{
          color: '#c9d8e8',
          fontWeight: 700,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '0.9rem',
          letterSpacing: '0.04em',
        }}>
          Chat Test Lab
        </span>
        <span style={{
          color: '#2a4a6a',
          fontSize: '0.75rem',
          fontFamily: 'monospace',
          paddingLeft: 4,
          borderLeft: '1px solid #131f2e',
        }}>
          {SCENARIOS.length} 個情境 · 每個情境獨立隔離
        </span>
        <button
          data-debug-overlay
          onClick={onClose}
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: '1px solid #1a2a3a',
            color: '#4a6a8a',
            cursor: 'pointer',
            fontSize: '0.85rem',
            padding: '5px 10px',
            borderRadius: 6,
            fontFamily: 'ui-monospace, monospace',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          title="關閉 Chat Test Lab"
        >
          <i className="fa-solid fa-xmark" />
          <span style={{ fontSize: '0.75rem' }}>ESC</span>
        </button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left: Scenario List */}
        <ScenarioList
          scenarios={SCENARIOS}
          categories={CATEGORIES}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        {/* Right: Viewer */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {scenario && <ScenarioViewer scenario={scenario} />}
        </div>
      </div>
    </div>
    </ChatPanelsProvider>
  )
}
