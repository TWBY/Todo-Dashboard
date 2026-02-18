'use client'
import React, { useState } from 'react'
import { ChatPanelsProvider } from '@/contexts/ChatPanelsContext'
import ScenarioList from './ScenarioList'
import StaticViewer from './StaticViewer'
import InteractiveViewer from './InteractiveViewer'
import TeamViewer from './TeamViewer'
import { useTestResults } from './useTestResults'
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
  const { results, setResult, getStats } = useTestResults()

  return (
    <ChatPanelsProvider>
    <div
      data-debug-overlay
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: '#000000',
      }}
    >
      {/* Main */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Left: Scenario List */}
        <ScenarioList
          scenarios={SCENARIOS}
          categories={CATEGORIES}
          selectedId={selectedId}
          onSelect={setSelectedId}
          testResults={results}
          onSetTestResult={setResult}
          stats={getStats()}
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
