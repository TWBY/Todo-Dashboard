'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useBuildPanel, PHASES as PHASES_FROM_CTX } from '@/contexts/BuildPanelContext';
import { useChatPanels } from '@/contexts/ChatPanelsContext';
import PulsingDots from '@/components/PulsingDots';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, StreamingActivity } from '@/lib/claude-chat-types';

// --- Build Prompt ---

const BUILD_PROMPT = `直接依序執行以下打包流程，不要詢問確認：

## 執行紀錄要求（全程遵守）
- 每個 Phase 開始前輸出：「▶ Phase X 開始」
- 每個 Phase 完成後輸出：「✓ Phase X 完成」
- 每次 git commit 後輸出完整 commit hash 和訊息
- 如遇錯誤，完整輸出錯誤訊息，不要截斷

---

Phase 1 — 偵察（機械執行）
1. git status：完整列出所有 modified + untracked 檔案
2. git log --oneline --grep="^release:" -1：找出上次 release commit hash，記錄備用

Phase 2 — 智能 Commit（AI 介入）
3. git diff HEAD 查看所有已追蹤檔案的變更，逐檔分析變更性質（UI / 邏輯 / 資料 / 設定）
4. 按功能/模組分組，說明每組的分組依據
5. 逐組執行 git add <files> + git commit
   → commit message 必須使用繁體中文，格式：「類型：說明」
   → 類型：新增 / 修復 / 改善 / 重構 / 資料 / 設定
   → 例如：「新增：打包流程背景執行支援」「修復：BuildPanel 切換頁面中斷問題」
   → 每次 commit 後輸出：「Commit [hash] — [訊息]」

Phase 3 — 版本判斷（AI 介入）
6. git log <上次release hash>..HEAD --oneline 列出所有新 commit（含 hash）
7. 逐條分析每個 commit 對 SemVer 的影響，說明最終升級幅度判斷依據
   → patch：僅修復 bug 或更新資料
   → minor：新增功能但向後相容
   → major：破壞性變更

Phase 4 — 版本升級與打包（機械執行）
8. 讀取 version.json，記錄當前 development 版本
   根據步驟 7 升級版本號（例如 1.15.7-dev + patch → production: 1.15.7），寫入 version.json
9. npm run build，輸出完整 build log

Phase 5 — Release Commit（機械執行）
10. git add version.json
11. git commit -m "release: vX.Y.Z — 一行功能摘要"
    → 摘要使用繁體中文，概括本次最重要的變更，例如「打包背景執行、工具輸出顯示優化」
12. 將 development 版本升級為下一個 patch-dev（production 1.15.7 → development 1.15.8-dev）
13. git add version.json && git commit -m "chore: bump dev version to X.Y.Z-dev"

---

完成後輸出完整摘要（使用 Markdown 格式）：

## vX.Y.Z 發布摘要

**版本升級**：\`前版本\` → \`新版本\`（升級幅度：patch / minor / major）
**下一個開發版本**：\`X.Y.Z-dev\`

### 本次變更

| 類型 | Commit | 說明 |
|------|--------|------|
| 新增 | \`hash\` | 說明 |
| 修復 | \`hash\` | 說明 |

（所有中文標點使用全形，例如冒號用「：」不用「:」）`;

// --- Types & Data ---

type StepStatus = 'pending' | 'running' | 'done' | 'error';

interface StepData {
  command: string;
  description: string;
  ai?: boolean;
}

interface PhaseData {
  phase: string;
  title: string;
  type: 'mechanical' | 'ai';
  steps: StepData[];
  note?: string;
}

const PHASES: PhaseData[] = [
  {
    phase: 'Phase 1',
    title: '偵察',
    type: 'mechanical',
    steps: [
      { command: 'git status', description: '查看未提交的變更（modified + untracked）' },
      { command: 'git log --oneline --grep="^release:" -1', description: '找到上次 release commit hash' },
    ],
  },
  {
    phase: 'Phase 2',
    title: '智能 Commit',
    type: 'ai',
    steps: [
      { command: 'git diff + untracked files', description: 'AI 查看所有變更內容', ai: true },
      { command: '智能分組', description: '按功能/模組將變更分成多次 commit', ai: true },
      { command: 'git add <files> + git commit', description: '逐組執行 add 和 commit', ai: true },
    ],
    note: 'AI 根據檔案變更的關聯性分組：同一功能的修改放一個 commit，資料更新另一個，UI 調整又一個',
  },
  {
    phase: 'Phase 3',
    title: '版本判斷',
    type: 'ai',
    steps: [
      { command: 'git log <上次release>..HEAD --oneline', description: '列出所有新 commit' },
      { command: 'SemVer 判斷', description: 'AI 根據 commit 內容決定 patch / minor / major', ai: true },
    ],
  },
  {
    phase: 'Phase 4',
    title: '版本升級與打包',
    type: 'mechanical',
    steps: [
      { command: 'version.json 版本同步', description: 'development → production' },
      { command: 'npm run build', description: '打包專案產生 .next/ 資料夾' },
    ],
  },
  {
    phase: 'Phase 5',
    title: 'Release Commit',
    type: 'mechanical',
    steps: [
      { command: 'git add version.json', description: '暫存 Production 版本' },
      { command: 'git commit -m "release: P-X.Y.Z — 摘要"', description: '建立 release commit' },
      { command: 'Development 版本升級為下一個 patch-dev', description: '例如 1.15.6-dev' },
      { command: 'git add version.json && git commit -m "chore: bump dev"', description: '提交新 Dev 版本' },
    ],
  },
];

// --- Utility functions ---

/** Remove Unicode emoji from text */
function removeEmoji(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Emoji ranges
    .replace(/[\u{2600}-\u{27BF}]/gu, '') // Miscellaneous Symbols
    .replace(/[\u{2300}-\u{23FF}]/gu, '') // Miscellaneous Technical
    .replace(/[\u{2000}-\u{206F}]/gu, '') // General Punctuation
    .replace(/[\u{20A0}-\u{20CF}]/gu, ''); // Currency Symbols
}

// --- Sub-components ---

function VArrow({ status }: { status: StepStatus }) {
  const color = status === 'done' ? '#22c55e'
    : status === 'running' ? '#f59e0b'
    : 'var(--text-tertiary)';

  return (
    <div className="flex flex-col items-center" style={{ height: '24px', margin: '2px 0' }}>
      <div style={{ width: 2, height: 14, backgroundColor: color, transition: 'background-color 0.3s' }} />
      <div
        style={{
          width: 0, height: 0,
          borderLeft: '4px solid transparent',
          borderRight: '4px solid transparent',
          borderTop: `5px solid ${color}`,
          transition: 'border-top-color 0.3s',
        }}
      />
    </div>
  );
}

function TypeBadge({ type }: { type: 'mechanical' | 'ai' }) {
  const config = type === 'mechanical'
    ? { bg: 'rgba(34,197,94,0.1)', fg: '#22c55e', border: 'rgba(34,197,94,0.2)', icon: 'fa-gear', label: '機械執行' }
    : { bg: 'rgba(168,85,247,0.1)', fg: '#a855f7', border: 'rgba(168,85,247,0.2)', icon: 'fa-wand-magic-sparkles', label: 'AI 介入' };

  return (
    <span
      className="text-sm px-2 py-0.5 rounded shrink-0 inline-flex items-center gap-1.5"
      style={{ backgroundColor: config.bg, color: config.fg, border: `1px solid ${config.border}`, lineHeight: '1.6' }}
    >
      <i className={`fa-solid ${config.icon} text-sm`} />
      {config.label}
    </span>
  );
}

function PhaseStatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'done':
      return <i className="fa-solid fa-circle-check text-base" style={{ color: '#22c55e' }} />;
    case 'running':
      return <i className="fa-solid fa-circle text-base" style={{ color: '#f59e0b' }} />;
    case 'error':
      return <i className="fa-solid fa-circle-xmark text-base" style={{ color: '#ef4444' }} />;
    default:
      return <i className="fa-regular fa-circle text-base" style={{ color: 'var(--text-tertiary)', opacity: 0.4 }} />;
  }
}

function PhaseHeader({ phase, title, type, status }: { phase: string; title: string; type: 'mechanical' | 'ai'; status: StepStatus }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <PhaseStatusIcon status={status} />
      <span
        className="text-base font-semibold px-2.5 py-1 rounded"
        style={{
          backgroundColor: status === 'running' ? 'rgba(245,158,11,0.15)' : status === 'done' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.06)',
          color: status === 'running' ? '#f59e0b' : status === 'done' ? '#22c55e' : 'var(--text-secondary)',
          transition: 'all 0.3s',
          lineHeight: '1.7',
        }}
      >
        {phase}
      </span>
      <span className="text-base" style={{ color: 'var(--text-tertiary)', lineHeight: '1.7' }}>{title}</span>
      <TypeBadge type={type} />
    </div>
  );
}

function StepNode({ step, status }: { step: StepData; status: StepStatus }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="shrink-0 mt-1">
        {status === 'done' ? (
          <i className="fa-solid fa-check text-base" style={{ color: '#22c55e' }} />
        ) : status === 'running' ? (
          <i className="fa-solid fa-spinner fa-spin text-base build-spinner-glow" style={{ color: '#f59e0b' }} />
        ) : status === 'error' ? (
          <i className="fa-solid fa-xmark text-base" style={{ color: '#ef4444' }} />
        ) : (
          <i className="fa-regular fa-circle text-base" style={{ color: 'var(--text-tertiary)', opacity: 0.3 }} />
        )}
      </span>
      <div className="flex-1 min-w-0" style={{ lineHeight: '1.7' }}>
        <span
          className="text-base font-mono"
          style={{
            color: status === 'done' ? '#22c55e'
              : status === 'running' ? '#f59e0b'
              : step.ai ? '#a855f7' : 'var(--text-secondary)',
            transition: 'color 0.3s',
          }}
        >
          {step.command}
        </span>
        <span className="text-base ml-2.5" style={{ color: 'var(--text-tertiary)' }}>
          {step.description}
        </span>
      </div>
    </div>
  );
}

// --- Tool type config ---

interface ToolConfig {
  icon: string;
  color: string;
  bg: string;
  border: string;
  label: string;
}

function getToolConfig(toolName: string | undefined): ToolConfig {
  const name = (toolName || '').toLowerCase();
  if (name === 'bash') return { icon: 'fa-terminal', color: '#4ade80', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)', label: 'Bash' };
  if (name === 'read') return { icon: 'fa-file-lines', color: '#60a5fa', bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.2)', label: 'Read' };
  if (name === 'write') return { icon: 'fa-file-pen', color: '#fb923c', bg: 'rgba(251,146,60,0.08)', border: 'rgba(251,146,60,0.2)', label: 'Write' };
  if (name === 'edit') return { icon: 'fa-pen-to-square', color: '#facc15', bg: 'rgba(250,204,21,0.08)', border: 'rgba(250,204,21,0.2)', label: 'Edit' };
  if (name === 'glob') return { icon: 'fa-magnifying-glass', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)', label: 'Glob' };
  if (name === 'grep') return { icon: 'fa-filter', color: '#a78bfa', bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.2)', label: 'Grep' };
  if (name === 'todowrite') return { icon: 'fa-list-check', color: '#34d399', bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.2)', label: 'Todo' };
  return { icon: 'fa-gear', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)', label: toolName || 'Tool' };
}

// Collapsible tool output
const OUTPUT_COLLAPSE_LINES = 5;

function ToolOutput({ content }: { content: string }) {
  const lines = content.split('\n');
  const needsCollapse = lines.length > OUTPUT_COLLAPSE_LINES;
  const [expanded, setExpanded] = useState(false);

  const displayed = needsCollapse && !expanded
    ? lines.slice(0, OUTPUT_COLLAPSE_LINES).join('\n')
    : content;

  return (
    <div>
      <pre
        className="text-xs font-mono whitespace-pre-wrap"
        style={{ color: '#7a8a9a', lineHeight: '1.6', margin: 0, wordBreak: 'break-word' }}
      >
        {displayed}
        {needsCollapse && !expanded && <span style={{ color: '#4a5568' }}>…</span>}
      </pre>
      {needsCollapse && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="mt-1 text-xs flex items-center gap-1 hover:opacity-80 transition-opacity cursor-pointer"
          style={{ color: '#4a5568' }}
        >
          <i className={`fa-solid ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'} text-xs`} />
          {expanded ? '收起' : `展開全部（${lines.length} 行）`}
        </button>
      )}
    </div>
  );
}

// Single tool message card
function ToolCard({ msg }: { msg: ChatMessage }) {
  const cfg = getToolConfig(msg.toolName);
  const hasOutput = msg.content.trim().length > 0;

  return (
    <div
      className="rounded"
      style={{
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <div
        className="flex items-center gap-2 px-2.5 py-1.5"
        style={{ borderBottom: hasOutput ? `1px solid ${cfg.border}` : 'none' }}
      >
        <i className={`fa-solid ${cfg.icon} text-xs`} style={{ color: cfg.color, opacity: 0.85 }} />
        <span className="text-xs font-mono font-semibold" style={{ color: cfg.color }}>
          {cfg.label}
        </span>
        {msg.toolDescription && (
          <span
            className="text-xs font-mono truncate flex-1 min-w-0"
            style={{ color: '#5a6a7a' }}
            title={msg.toolDescription}
          >
            {msg.toolDescription}
          </span>
        )}
      </div>

      {/* Output */}
      {hasOutput && (
        <div className="px-2.5 py-1.5">
          <ToolOutput content={msg.content.trim()} />
        </div>
      )}
    </div>
  );
}

/** Inline AI output area — shows ALL messages (assistant + tool) as a continuous log */
function AiOutputArea({ messages, isStreaming, streamingActivity }: {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingActivity: StreamingActivity | null;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [messages, streamingActivity]);

  const visibleMessages = messages.filter(m => m.role !== 'user' && (m.content.trim() || m.toolName));

  if (visibleMessages.length === 0 && !isStreaming) return null;

  // Live activity badge
  const activityBadge = isStreaming && streamingActivity ? (() => {
    if (streamingActivity.status === 'thinking') {
      return (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded" style={{ backgroundColor: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)' }}>
          <PulsingDots color="#a855f7" />
          <span className="text-xs" style={{ color: '#a855f7' }}>思考中</span>
        </div>
      );
    }
    if (streamingActivity.status === 'replying') {
      return (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded" style={{ backgroundColor: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.15)' }}>
          <PulsingDots color="#a855f7" />
          <span className="text-xs" style={{ color: '#a855f7' }}>回應中</span>
        </div>
      );
    }
    if (streamingActivity.status === 'tool') {
      const cfg = getToolConfig(streamingActivity.toolName);
      return (
        <div className="flex items-center gap-2 px-2.5 py-1.5 rounded" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
          <i className={`fa-solid fa-spinner fa-spin text-xs`} style={{ color: cfg.color }} />
          <span className="text-xs font-mono font-semibold" style={{ color: cfg.color }}>{streamingActivity.toolName}</span>
          {streamingActivity.toolDetail && (
            <span className="text-xs font-mono truncate" style={{ color: '#5a6a7a' }}>{streamingActivity.toolDetail}</span>
          )}
        </div>
      );
    }
    return null;
  })() : null;

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {visibleMessages.map(msg => (
        <div key={msg.id}>
          {msg.role === 'assistant' ? (
            msg.content.trim() && (
              <div
                className="pl-3 py-0.5 text-sm build-ai-output"
                style={{
                  borderLeft: '2px solid rgba(168,85,247,0.35)',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.7',
                }}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.content.trim()}
                </ReactMarkdown>
              </div>
            )
          ) : (
            <ToolCard msg={msg} />
          )}
        </div>
      ))}

      {/* Live activity indicator — always at bottom */}
      {activityBadge && (
        <div>{activityBadge}</div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

// --- Rescue Prompt Builder ---

function buildRescuePrompt(messages: ChatMessage[], currentPhase: number, error: string | null): string {
  const phaseName = currentPhase > 0 && currentPhase <= PHASES.length
    ? `${PHASES[currentPhase - 1].phase} — ${PHASES[currentPhase - 1].title}`
    : `Phase ${currentPhase}`;

  // Collect last few tool messages for error context
  const recentToolMsgs = messages
    .filter(m => m.role === 'tool' && m.content.trim())
    .slice(-5)
    .map(m => `[${m.toolName}] ${m.content.slice(0, 500)}`)
    .join('\n');

  // Collect completed phases
  const completedPhases = PHASES
    .filter((_, i) => i + 1 < currentPhase)
    .map(p => `${p.phase} ${p.title}`)
    .join('、');

  return `Pack 打包流程在「${phaseName}」階段出錯，請協助診斷並修復。

## 錯誤資訊
${error || '（串流中斷或未知錯誤）'}

## 已完成的階段
${completedPhases || '（尚未完成任何階段）'}

## 最近的工具輸出
\`\`\`
${recentToolMsgs || '（無）'}
\`\`\`

請先分析錯誤原因，然後嘗試修復問題。修復完成後，從失敗的階段繼續執行剩餘的 Pack 流程。

完整的 Pack 流程供參考：
${BUILD_PROMPT}`;
}

// --- Main Panel ---

export default function BuildPanel() {
  const { close, buildState, setBuildState, resetBuild, messages, isStreaming, streamingActivity, sendMessage, stopStreaming, error, currentPhase, currentStep } = useBuildPanel();
  const { addPanel } = useChatPanels();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Compute phase statuses
  const phaseStatuses: StepStatus[] = useMemo(() => {
    return PHASES.map((_, i) => {
      const phaseNum = i + 1;
      if (buildState === 'idle') return 'pending';
      if (buildState === 'error' && phaseNum === currentPhase) return 'error';
      if (phaseNum < currentPhase) return 'done';
      if (phaseNum === currentPhase) return 'running';
      return 'pending';
    });
  }, [currentPhase, buildState]);

  // When done, mark all phases done
  const finalStatuses: StepStatus[] = useMemo(() => {
    if (buildState === 'done') return PHASES.map(() => 'done');
    return phaseStatuses;
  }, [buildState, phaseStatuses]);

  // Auto-scroll to active phase
  useEffect(() => {
    if (currentPhase > 0 && scrollRef.current) {
      const phaseEl = scrollRef.current.querySelector(`[data-phase="${currentPhase}"]`);
      if (phaseEl) {
        phaseEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentPhase]);


  const handleStartBuild = async () => {
    setBuildState('running');
    await sendMessage(BUILD_PROMPT, 'edit', undefined, 'sonnet');
  };

  const handleReset = () => {
    resetBuild();
  };

  const handleRescue = () => {
    const rescuePrompt = buildRescuePrompt(messages, currentPhase, error);
    addPanel('dashboard', 'Pack 救援', {
      initialMessage: rescuePrompt,
      initialMode: 'edit',
      model: 'opus',
      ephemeral: true,
    });
  };

  return (
    <div
      className="h-full flex flex-col min-w-0"
      style={{
        border: '1.5px solid transparent',
        borderRadius: 6,
        padding: '8px 24px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-start py-4 mb-6 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {buildState === 'idle' && (
            <button
              onClick={handleStartBuild}
              className="h-9 px-4 rounded-md text-sm font-semibold transition-colors cursor-pointer hover:brightness-110"
              style={{ backgroundColor: '#332815', color: '#f59e0b', border: '1px solid #4a3520' }}
            >
              開始建立
            </button>
          )}
          {buildState === 'running' && (
            <button
              onClick={() => { stopStreaming(); setBuildState('error'); }}
              className="h-9 px-4 rounded-md text-sm font-semibold transition-colors cursor-pointer hover:bg-red-500/20"
              style={{ color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              停止
            </button>
          )}
          {(buildState === 'done' || buildState === 'error') && (
            <>
              <button
                onClick={handleReset}
                className="h-9 px-4 rounded-md text-sm font-semibold transition-colors cursor-pointer hover:bg-white/10"
                style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
              >
                重新執行
              </button>
              {buildState === 'error' && (
                <button
                  onClick={handleRescue}
                  className="h-9 px-4 rounded-md text-sm font-semibold transition-colors cursor-pointer hover:brightness-110"
                  style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}
                >
                  <i className="fa-solid fa-life-ring mr-1.5" />
                  救援
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        <div className="pb-8">
          {/* Phase 0: System startup — always show once build started, don't hide after completion */}
          {buildState === 'running' && (
            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3">
                <i className={`fa-solid ${currentPhase === 0 ? 'fa-circle' : 'fa-circle-check'} text-base`} style={{ color: currentPhase === 0 ? '#f59e0b' : '#22c55e' }} />
                <span
                  className="text-base font-semibold px-2.5 py-1 rounded"
                  style={{ backgroundColor: currentPhase === 0 ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.1)', color: currentPhase === 0 ? '#f59e0b' : '#22c55e', lineHeight: '1.7' }}
                >
                  Phase 0
                </span>
                <span className="text-base" style={{ color: 'var(--text-tertiary)', lineHeight: '1.7' }}>系統啟動</span>
              </div>
              <div className="pl-7">
                {currentPhase === 0 ? (
                  <div className="flex flex-col gap-1.5">
                    {/* 根據 streamingActivity 顯示細分進度 */}
                    <div className="flex items-center gap-3 py-1">
                      {(!streamingActivity || streamingActivity.status === 'connecting') ? (
                        <>
                          <i className="fa-solid fa-spinner fa-spin text-base build-spinner-glow" style={{ color: '#f59e0b' }} />
                          <span className="text-base font-mono" style={{ color: '#f59e0b', lineHeight: '1.7' }}>正在連線 Claude SDK</span>
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-check text-base" style={{ color: '#22c55e' }} />
                          <span className="text-base font-mono" style={{ color: '#22c55e', lineHeight: '1.7' }}>SDK 連線成功</span>
                        </>
                      )}
                    </div>
                    {streamingActivity && streamingActivity.status !== 'connecting' && (
                      <div className="flex items-center gap-3 py-1">
                        <i className="fa-solid fa-spinner fa-spin text-base build-spinner-glow" style={{ color: '#f59e0b' }} />
                        <span className="text-base font-mono" style={{ color: '#f59e0b', lineHeight: '1.7' }}>
                          {streamingActivity.status === 'thinking' ? 'Claude 正在分析指令' : '準備開始偵察'}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 py-2.5">
                    <i className="fa-solid fa-check text-base" style={{ color: '#22c55e' }} />
                    <span className="text-base font-mono" style={{ color: '#22c55e', lineHeight: '1.7' }}>系統準備完成</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {PHASES.map((phase, phaseIdx) => {
            const phaseStatus = finalStatuses[phaseIdx];
            const isAiPhase = phase.type === 'ai';
            const showAiOutput = isAiPhase && (phaseStatus === 'running' || phaseStatus === 'done');

            return (
              <div key={phase.phase} className={phaseIdx > 0 ? 'mt-6' : ''} data-phase={phaseIdx + 1}>

                <PhaseHeader phase={phase.phase} title={phase.title} type={phase.type} status={phaseStatus} />
                <div className="pl-7">
                  {phase.steps.map((step, stepIdx) => {
                    let stepStatus: StepStatus = 'pending';

                    if (phaseStatus === 'done') {
                      stepStatus = 'done';
                    } else if (phaseStatus === 'running') {
                      // Fine-grained step status
                      const currentPhaseNum = phaseIdx + 1;
                      if (currentPhaseNum === currentPhase) {
                        if (stepIdx < currentStep) stepStatus = 'done';
                        else if (stepIdx === currentStep) stepStatus = 'running';
                        else stepStatus = 'pending';
                      } else if (currentPhaseNum < currentPhase) {
                        stepStatus = 'done';
                      } else {
                        stepStatus = 'pending';
                      }
                    } else if (phaseStatus === 'error') {
                      stepStatus = 'error';
                    }

                    return <StepNode key={`${phaseIdx}-${stepIdx}`} step={step} status={stepStatus} />;
                  })}

                  {/* Inline AI output for Phase 2/3 — keep visible after completion */}
                  {showAiOutput && (
                    <AiOutputArea
                      messages={messages}
                      isStreaming={isStreaming}
                      streamingActivity={streamingActivity}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Error display */}
          {error && (
            <div
              className="mt-6 rounded-md px-5 py-4 text-base"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', lineHeight: '1.7' }}
            >
              <i className="fa-regular fa-triangle-exclamation mr-2" />
              {error}
            </div>
          )}

          {/* Completion marker */}
          {buildState === 'done' && (
            <div className="mt-6 pt-5" style={{ borderTop: '1px solid var(--border-color)' }}>
              <div className="text-lg font-semibold" style={{ color: '#22c55e', lineHeight: '1.7' }}>
                <i className="fa-solid fa-circle-check mr-2" />
                Build 完成
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
