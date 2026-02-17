'use client'

import { useState, useMemo } from 'react'
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard'
import SubpageShell from '@/components/SubpageShell'
import {
  CHAT_FEATURES,
  generatePortingChecklist,
  type ChatFeature,
  type FeatureTier,
} from '@/lib/chat-center-features'

// --- Sub-components ---

function TierBadge({ tier }: { tier: FeatureTier }) {
  const config: Record<FeatureTier, { label: string; bg: string; fg: string; border: string }> = {
    core: { label: '基本配備', bg: 'rgba(34,197,94,0.1)', fg: '#22c55e', border: 'rgba(34,197,94,0.2)' },
    standard: { label: '標準配備', bg: 'rgba(249,115,22,0.1)', fg: '#f97316', border: 'rgba(249,115,22,0.2)' },
    optional: { label: '選配', bg: 'rgba(59,130,246,0.1)', fg: '#3b82f6', border: 'rgba(59,130,246,0.2)' },
    advanced: { label: '進階', bg: 'rgba(168,85,247,0.1)', fg: '#a855f7', border: 'rgba(168,85,247,0.2)' },
  }
  const c = config[tier]
  return (
    <span
      className="text-sm px-1.5 py-0.5 rounded shrink-0"
      style={{ backgroundColor: c.bg, color: c.fg, border: `1px solid ${c.border}` }}
    >
      {c.label}
    </span>
  )
}

function FeatureCard({
  feature,
  expanded,
  onToggle,
}: {
  feature: ChatFeature
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div
      className="rounded-lg cursor-pointer transition-colors duration-150 hover:bg-white/5"
      style={{
        backgroundColor: 'var(--background-tertiary)',
        border: '1px solid var(--border-color)',
        padding: '12px 16px',
      }}
      onClick={onToggle}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {feature.label}
          </span>
          <span className="text-sm font-mono" style={{ color: 'var(--text-tertiary)' }}>
            {feature.name}
          </span>
        </div>
        <TierBadge tier={feature.tier} />
      </div>

      <div className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
        {feature.description}
      </div>

      {feature.useCases.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {feature.useCases.map((uc, i) => (
            <span
              key={i}
              className="text-sm px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}
            >
              {uc}
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
          <div className="text-sm mb-1.5 font-semibold" style={{ color: 'var(--text-secondary)' }}>
            包含檔案
          </div>
          {feature.files.map(file => (
            <div key={file} className="text-sm font-mono ml-4" style={{ color: 'var(--text-tertiary)' }}>
              {file}
            </div>
          ))}
          {feature.npmPackages && feature.npmPackages.length > 0 && (
            <>
              <div className="text-sm mt-2 mb-1 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                npm 套件
              </div>
              {feature.npmPackages.map(pkg => (
                <div key={pkg} className="text-sm font-mono ml-4" style={{ color: 'var(--text-tertiary)' }}>
                  {pkg}
                </div>
              ))}
            </>
          )}
          {feature.dependencies.length > 0 && (
            <>
              <div className="text-sm mt-2 mb-1 font-semibold" style={{ color: 'var(--text-secondary)' }}>
                依賴
              </div>
              <div className="text-sm font-mono ml-4" style={{ color: 'var(--text-tertiary)' }}>
                {feature.dependencies.join(', ')}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ConfiguratorRow({
  feature,
  checked,
  locked,
  onToggle,
}: {
  feature: ChatFeature
  checked: boolean
  locked: boolean
  onToggle: () => void
}) {
  const depLabels = feature.dependencies
    .map(depId => CHAT_FEATURES.find(f => f.id === depId)?.label)
    .filter(Boolean)

  return (
    <label
      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors duration-150 ${locked ? '' : 'cursor-pointer hover:bg-white/5'}`}
      style={{
        backgroundColor: checked ? 'rgba(255,255,255,0.03)' : 'transparent',
        border: '1px solid var(--border-color)',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={locked}
        onChange={onToggle}
        className="accent-[#3b82f6] w-4 h-4"
      />
      <span className="text-sm flex-1" style={{ color: checked ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
        {feature.label}
      </span>
      {depLabels.length > 0 && (
        <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
          {depLabels.join(', ')}
        </span>
      )}
      <TierBadge tier={feature.tier} />
    </label>
  )
}

// --- Page ---

export default function ChatCenterPage() {
  const { copy, isCopied } = useCopyToClipboard(2000)

  // 展示區：哪張卡片展開
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  // 選配器：core 鎖定，standard 預設勾選可取消，optional/advanced 預設不勾
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(CHAT_FEATURES.filter(f => f.tier === 'core' || f.tier === 'standard').map(f => f.id))
  )
  const [showOutput, setShowOutput] = useState(false)

  // 依賴連動的 toggle
  const toggleFeature = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        // 取消勾選：同時取消所有依賴此 feature 的項目
        next.delete(id)
        for (const f of CHAT_FEATURES) {
          if (f.dependencies.includes(id) && f.tier !== 'core') {
            next.delete(f.id)
          }
        }
      } else {
        // 勾選：自動勾選其所有依賴
        next.add(id)
        const feature = CHAT_FEATURES.find(f => f.id === id)
        if (feature) {
          for (const depId of feature.dependencies) {
            next.add(depId)
          }
        }
      }
      return next
    })
    setShowOutput(false)
  }

  // 分組
  const coreFeatures = CHAT_FEATURES.filter(f => f.tier === 'core')
  const standardFeatures = CHAT_FEATURES.filter(f => f.tier === 'standard')
  const optionalFeatures = CHAT_FEATURES.filter(f => f.tier === 'optional')
  const advancedFeatures = CHAT_FEATURES.filter(f => f.tier === 'advanced')

  // 摘要統計
  const selectedFeatures = CHAT_FEATURES.filter(f => selectedIds.has(f.id))
  const totalFiles = selectedFeatures.reduce((sum, f) => sum + f.files.length, 0)

  // 移植清單
  const checklist = useMemo(
    () => generatePortingChecklist(selectedIds),
    [selectedIds]
  )
  const copied = isCopied(checklist)

  return (
    <SubpageShell title="Chat 功能中心">
      <div className="max-w-[820px] mx-auto px-5 sm:px-8 pt-8 pb-12">

          {/* Section 1: 功能展示 */}
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="text-sm font-semibold px-2 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}
              >
                功能展示
              </span>
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                Chat 系統的所有模組一覽
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CHAT_FEATURES.map(feature => (
                <FeatureCard
                  key={feature.id}
                  feature={feature}
                  expanded={expandedCard === feature.id}
                  onToggle={() =>
                    setExpandedCard(prev => (prev === feature.id ? null : feature.id))
                  }
                />
              ))}
            </div>
          </section>

          {/* Section 2: 自定義選配 */}
          <section className="mb-12">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="text-sm font-semibold px-2 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}
              >
                自定義選配
              </span>
              <span className="text-sm" style={{ color: 'var(--text-tertiary)' }}>
                勾選要移植的功能模組
              </span>
            </div>

            {/* Core（鎖定） */}
            <div className="mb-4">
              <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                基本配備
                <span className="ml-2 font-normal" style={{ color: 'var(--text-tertiary)' }}>
                  — 必要元件，無法取消
                </span>
              </div>
              <div className="space-y-2">
                {coreFeatures.map(f => (
                  <ConfiguratorRow
                    key={f.id}
                    feature={f}
                    checked={true}
                    locked={true}
                    onToggle={() => {}}
                  />
                ))}
              </div>
            </div>

            {/* Standard（預設勾選，可取消） */}
            <div className="mb-4">
              <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                標準配備
                <span className="ml-2 font-normal" style={{ color: 'var(--text-tertiary)' }}>
                  — 大多數場景都需要，預設包含
                </span>
              </div>
              <div className="space-y-2">
                {standardFeatures.map(f => (
                  <ConfiguratorRow
                    key={f.id}
                    feature={f}
                    checked={selectedIds.has(f.id)}
                    locked={false}
                    onToggle={() => toggleFeature(f.id)}
                  />
                ))}
              </div>
            </div>

            {/* Optional */}
            <div className="mb-4">
              <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                選配功能
                <span className="ml-2 font-normal" style={{ color: 'var(--text-tertiary)' }}>
                  — 依需求自由搭配
                </span>
              </div>
              <div className="space-y-2">
                {optionalFeatures.map(f => (
                  <ConfiguratorRow
                    key={f.id}
                    feature={f}
                    checked={selectedIds.has(f.id)}
                    locked={false}
                    onToggle={() => toggleFeature(f.id)}
                  />
                ))}
              </div>
            </div>

            {/* Advanced */}
            <div className="mb-4">
              <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                進階功能
                <span className="ml-2 font-normal" style={{ color: 'var(--text-tertiary)' }}>
                  — 較複雜的擴充模組
                </span>
              </div>
              <div className="space-y-2">
                {advancedFeatures.map(f => (
                  <ConfiguratorRow
                    key={f.id}
                    feature={f}
                    checked={selectedIds.has(f.id)}
                    locked={false}
                    onToggle={() => toggleFeature(f.id)}
                  />
                ))}
              </div>
            </div>

            {/* 摘要 + 生成按鈕 */}
            <div
              className="flex items-center justify-between px-4 py-3 rounded-lg mt-4"
              style={{ backgroundColor: 'var(--background-tertiary)', border: '1px solid var(--border-color)' }}
            >
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                已選 <strong>{selectedIds.size}</strong> 項功能，共 <strong>{totalFiles}</strong> 個檔案
              </span>
              <button
                onClick={() => setShowOutput(true)}
                className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
                style={{
                  backgroundColor: 'rgba(59,130,246,0.15)',
                  color: '#3b82f6',
                  border: '1px solid rgba(59,130,246,0.3)',
                }}
              >
                生成移植清單
              </button>
            </div>
          </section>

          {/* Section 3: 一鍵複製 */}
          {showOutput && (
            <section className="mb-12">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-semibold px-2 py-0.5 rounded"
                    style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}
                  >
                    移植清單
                  </span>
                </div>
                <button
                  onClick={() => copy(checklist)}
                  className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer"
                  style={{
                    backgroundColor: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                    color: copied ? '#22c55e' : 'var(--text-secondary)',
                    border: `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'var(--border-color)'}`,
                  }}
                >
                  {copied ? '已複製' : '複製到剪貼簿'}
                </button>
              </div>

              <pre
                className="text-sm font-mono p-5 rounded-lg overflow-x-auto whitespace-pre-wrap"
                style={{
                  backgroundColor: 'var(--background-tertiary)',
                  color: 'var(--text-secondary)',
                  border: '1px solid var(--border-color)',
                  lineHeight: 1.6,
                }}
              >
                {checklist}
              </pre>
            </section>
          )}

      </div>
    </SubpageShell>
  )
}
