'use client'
import React from 'react'
import ChatContent from '@/components/ChatContent'
import type { StaticScenario } from './scenarios'

interface Props {
  scenario: StaticScenario
}

export default function StaticViewer({ scenario }: Props) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Info bar */}
      <div style={{
        padding: '6px 16px',
        backgroundColor: '#060d19',
        borderBottom: '1px solid #1a2740',
        fontSize: '0.7rem',
        color: '#3a5a7a',
        fontFamily: 'monospace',
        flexShrink: 0,
      }}>
        <i className="fa-solid fa-database" style={{ marginRight: 6 }} />
        fixture: <span style={{ color: '#58a6ff' }}>chat-lab / {scenario.sessionId}.json</span>
        <span style={{ marginLeft: 16, color: '#2a3a4a' }}>ephemeral=true</span>
      </div>

      {/* ChatContent with fixture */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ChatContent
          key={scenario.sessionId}
          projectId="chat-lab"
          projectName="Chat Lab"
          resumeSessionId={scenario.sessionId}
          ephemeral={true}
        />
      </div>
    </div>
  )
}
