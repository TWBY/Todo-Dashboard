'use client'
import React, { useState } from 'react'
import ChatContent from '@/components/ChatContent'
import type { TeamScenario } from './scenarios'

interface Props {
  scenario: TeamScenario
}

export default function TeamViewer({ scenario }: Props) {
  const [instanceKey, setInstanceKey] = useState(0)
  const [mockStarted, setMockStarted] = useState(false)
  const [mockError, setMockError] = useState<string | null>(null)

  const handleAction = async (action: string) => {
    if (action === 'reset') {
      setMockStarted(false)
      setMockError(null)
      setInstanceKey(k => k + 1)
      return
    }
    if (action === 'start-mock-team') {
      try {
        setMockError(null)
        // Reset the mock server timer
        await fetch(`/api/team-monitor/mock?reset=${crypto.randomUUID()}`)
        setInstanceKey(k => k + 1)
        setMockStarted(true)
      } catch (e) {
        setMockError(String(e))
      }
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Controls */}
      <div style={{
        padding: '8px 16px',
        backgroundColor: '#060d19',
        borderBottom: '1px solid #1a2740',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        flexWrap: 'wrap',
      }}>
        <span style={{ color: '#3a5a7a', fontSize: '0.7rem', fontFamily: 'monospace', marginRight: 4 }}>
          <i className="fa-solid fa-users-gear" style={{ marginRight: 5 }} />team controls:
        </span>
        {scenario.controls.map(ctrl => (
          <button
            key={ctrl.id}
            onClick={() => handleAction(ctrl.action)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              cursor: 'pointer',
              border: '1px solid',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              backgroundColor: ctrl.variant === 'primary' ? '#1a0e3a' : '#0a1520',
              borderColor: ctrl.variant === 'primary' ? '#5a2a9a' : '#1a2740',
              color: ctrl.variant === 'primary' ? '#bc8cff' : '#8b949e',
            }}
          >
            {ctrl.icon && <i className={`fa-solid ${ctrl.icon}`} style={{ fontSize: '0.7rem' }} />}
            {ctrl.label}
          </button>
        ))}
        {mockStarted && (
          <span style={{ fontSize: '0.65rem', color: '#bc8cff', fontFamily: 'monospace' }}>
            <i className="fa-solid fa-circle-dot fa-fade" style={{ marginRight: 4 }} />mock team running (60s)
          </span>
        )}
        {mockError && (
          <span style={{ fontSize: '0.65rem', color: '#f85149', fontFamily: 'monospace' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 4 }} />{mockError}
          </span>
        )}
      </div>

      {/* Steps Guide */}
      {scenario.steps && scenario.steps.length > 0 && (
        <div style={{
          padding: '8px 16px',
          backgroundColor: '#0a0f1a',
          borderBottom: '1px solid #0d1a2a',
          fontSize: '0.65rem',
          color: '#4a6a8a',
          fontFamily: 'monospace',
          flexShrink: 0,
        }}>
          {scenario.steps.map((step, idx) => (
            <div key={idx} style={{ marginBottom: idx < scenario.steps!.length - 1 ? 6 : 0 }}>
              <span style={{ color: '#6a8a9a' }}>{idx + 1}. {step.action}</span>
              <span style={{ color: '#2a5a30', marginLeft: 12 }}>→ {step.expect}</span>
            </div>
          ))}
          {scenario.passCondition && (
            <div style={{ marginTop: 8, color: '#f97316', borderTop: '1px solid #0d1a2a', paddingTop: 6 }}>
              通過標準：{scenario.passCondition}
            </div>
          )}
        </div>
      )}

      {/* Chat area */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ChatContent
          key={instanceKey}
          projectId="chat-lab"
          projectName="Chat Lab"
          ephemeral={true}
          resumeSessionId={
            mockStarted && 'fixtureSessionId' in scenario && scenario.fixtureSessionId
              ? scenario.fixtureSessionId
              : undefined
          }
        />
      </div>
    </div>
  )
}
