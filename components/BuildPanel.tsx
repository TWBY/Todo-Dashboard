'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useBuildPanel } from '@/contexts/BuildPanelContext';
import { useClaudeChat } from '@/hooks/useClaudeChat';
import PulsingDots from '@/components/PulsingDots';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage, StreamingActivity } from '@/lib/claude-chat-types';

// --- Build Prompt ---

const BUILD_PROMPT = `直接依序執行以下打包流程，不要詢問確認：

Phase 1 — 偵察（機械執行）
1. git status 查看未提交的變更（modified + untracked）
2. git log --oneline --grep="^release:" -1 找到上次 release commit hash

Phase 2 — 智能 Commit（AI 介入）
3. 查看 git diff + untracked files，判斷哪些文件該 commit
4. 按功能/模組將變更智能分組成多次 commit（同一功能放一個 commit，資料更新另一個，UI 調整又一個）
5. 逐組執行 git add <files> + git commit -m "描述"

Phase 3 — 版本判斷（AI 介入）
6. git log <上次release>..HEAD --oneline 列出所有新 commit
7. 根據 commit 內容決定版本升級幅度（嚴格遵守 SemVer 語意：patch/minor/major）

Phase 4 — 版本升級與打包（機械執行）
8. 讀取 version.json 的 development 版本，根據步驟 7 的判斷升級版本號（例如 1.15.7-dev patch→1.15.7, minor→1.16.0, major→2.0.0），去掉 -dev 後綴，然後寫入 production 欄位
9. npm run build

Phase 5 — Release Commit（機械執行）
10. git add version.json
11. git commit -m "release: vX.Y.Z — 一行功能摘要"（使用 production 版本號，不加前綴）
12. 將 development 版本升級為下一個 patch-dev（例如 production 是 1.15.7，則 development 改為 1.15.8-dev）
13. git add version.json && git commit -m "chore: bump dev version to X.Y.Z-dev"
14. 回報新版本號和本次變更摘要`;

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

// --- Phase detection logic ---

interface StepProgress {
  phase: number;
  step: number; // 0-indexed
}

/** Detect current phase and step based on messages from AI */
function detectProgress(messages: ChatMessage[]): StepProgress {
  let currentPhase = 0;
  let currentStep = -1;

  const completedSteps = new Map<number, Set<number>>(); // phase -> Set of completed step indices

  for (const msg of messages) {
    if (msg.role !== 'tool' || !msg.toolName) continue;
    const desc = (msg.toolDescription || '').toLowerCase();
    const content = (msg.content || '').toLowerCase();

    if (msg.toolName === 'Bash') {
      // Phase 1
      if (desc.includes('git status') || content.includes('git status')) {
        currentPhase = 1;
        if (!completedSteps.has(1)) completedSteps.set(1, new Set());
        completedSteps.get(1)!.add(0);
        currentStep = 0;
      }
      if (desc.includes('git log') && (desc.includes('release:') || desc.includes('--grep'))) {
        currentPhase = 1;
        if (!completedSteps.has(1)) completedSteps.set(1, new Set());
        completedSteps.get(1)!.add(1);
        currentStep = 1;
      }

      // Phase 2
      if (desc.includes('git diff') || content.includes('git diff')) {
        currentPhase = 2;
        if (!completedSteps.has(2)) completedSteps.set(2, new Set());
        completedSteps.get(2)!.add(0);
        currentStep = 0;
      }
      if ((desc.includes('git add') || desc.includes('git commit')) && !desc.includes('release:') && !content.includes('release:')) {
        if (currentPhase < 4) { // Distinguish Phase 2 commits from Phase 5
          currentPhase = 2;
          if (!completedSteps.has(2)) completedSteps.set(2, new Set());
          completedSteps.get(2)!.add(2);
          currentStep = 2;
        }
      }

      // Phase 3
      if (desc.includes('..head') || content.includes('..head')) {
        currentPhase = 3;
        if (!completedSteps.has(3)) completedSteps.set(3, new Set());
        completedSteps.get(3)!.add(0);
        currentStep = 0;
      }

      // Phase 4
      if ((desc.includes('version.json') || content.includes('version.json')) && !desc.includes('git add')) {
        currentPhase = 4;
        if (!completedSteps.has(4)) completedSteps.set(4, new Set());
        completedSteps.get(4)!.add(0);
        currentStep = 0;
      }
      if (desc.includes('npm run build') || content.includes('npm run build')) {
        currentPhase = 4;
        if (!completedSteps.has(4)) completedSteps.set(4, new Set());
        completedSteps.get(4)!.add(1);
        currentStep = 1;
      }

      // Phase 5
      if (desc.includes('git add') && (desc.includes('version.json') || content.includes('version.json'))) {
        currentPhase = 5;
        if (!completedSteps.has(5)) completedSteps.set(5, new Set());
        completedSteps.get(5)!.add(0);
        currentStep = 0;
      }
      if ((desc.includes('release:') || content.includes('release:')) && (desc.includes('git commit') || content.includes('git commit'))) {
        currentPhase = 5;
        if (!completedSteps.has(5)) completedSteps.set(5, new Set());
        completedSteps.get(5)!.add(1);
        currentStep = 1;
      }
      if (desc.includes('bump dev') || content.includes('bump dev')) {
        currentPhase = 5;
        if (!completedSteps.has(5)) completedSteps.set(5, new Set());
        completedSteps.get(5)!.add(2);
        completedSteps.get(5)!.add(3);
        currentStep = 3;
      }
    }
  }

  return { phase: currentPhase, step: currentStep };
}

/** Legacy: Detect which phase is currently active (for backward compat) */
function detectPhase(messages: ChatMessage[]): number {
  return detectProgress(messages).phase;
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
      return <i className="fa-solid fa-circle-check text-sm" style={{ color: '#22c55e' }} />;
    case 'running':
      return <i className="fa-solid fa-spinner fa-spin text-sm build-spinner-glow" style={{ color: '#f59e0b' }} />;
    case 'error':
      return <i className="fa-solid fa-circle-xmark text-sm" style={{ color: '#ef4444' }} />;
    default:
      return <i className="fa-regular fa-circle text-sm" style={{ color: 'var(--text-tertiary)', opacity: 0.4 }} />;
  }
}

function PhaseHeader({ phase, title, type, status }: { phase: string; title: string; type: 'mechanical' | 'ai'; status: StepStatus }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <PhaseStatusIcon status={status} />
      <span
        className="text-sm font-semibold px-2 py-0.5 rounded"
        style={{
          backgroundColor: status === 'running' ? 'rgba(245,158,11,0.15)' : status === 'done' ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.06)',
          color: status === 'running' ? '#f59e0b' : status === 'done' ? '#22c55e' : 'var(--text-secondary)',
          transition: 'all 0.3s',
          lineHeight: '1.6',
        }}
      >
        {phase}
      </span>
      <span className="text-sm" style={{ color: 'var(--text-tertiary)', lineHeight: '1.6' }}>{title}</span>
      <TypeBadge type={type} />
    </div>
  );
}

function StepNode({ step, status }: { step: StepData; status: StepStatus }) {
  return (
    <div className="flex items-start gap-2.5 py-2">
      <span className="shrink-0 mt-0.5">
        {status === 'done' ? (
          <i className="fa-solid fa-check text-sm" style={{ color: '#22c55e' }} />
        ) : status === 'running' ? (
          <i className="fa-solid fa-spinner fa-spin text-sm build-spinner-glow" style={{ color: '#f59e0b' }} />
        ) : status === 'error' ? (
          <i className="fa-solid fa-xmark text-sm" style={{ color: '#ef4444' }} />
        ) : (
          <i className="fa-regular fa-circle text-sm" style={{ color: 'var(--text-tertiary)', opacity: 0.3 }} />
        )}
      </span>
      <div className="flex-1 min-w-0" style={{ lineHeight: '1.6' }}>
        <span
          className="text-sm font-mono"
          style={{
            color: status === 'done' ? '#22c55e'
              : status === 'running' ? '#f59e0b'
              : step.ai ? '#a855f7' : 'var(--text-secondary)',
            transition: 'color 0.3s',
          }}
        >
          {step.command}
        </span>
        <span className="text-sm ml-2" style={{ color: 'var(--text-tertiary)' }}>
          {step.description}
        </span>
      </div>
    </div>
  );
}

/** Inline AI output area — shows streaming messages within Phase 2/3 */
function AiOutputArea({ messages, isStreaming, streamingActivity }: {
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingActivity: StreamingActivity | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, streamingActivity]);

  // Filter to only assistant text messages (skip tool messages for cleaner view)
  const aiMessages = messages.filter(m => m.role === 'assistant' && m.content.trim());

  if (aiMessages.length === 0 && !isStreaming) return null;

  return (
    <div
      ref={containerRef}
      className="mt-3 rounded-md overflow-y-auto"
      style={{
        maxHeight: '280px',
        backgroundColor: 'rgba(0,0,0,0.15)',
        border: '1px solid rgba(168,85,247,0.2)',
        padding: '10px 12px',
      }}
    >
      {/* Activity indicator */}
      {isStreaming && streamingActivity && (
        <div className="flex items-center gap-2 mb-1.5">
          {streamingActivity.status === 'tool' ? (
            <span className="text-sm font-mono" style={{ color: '#a855f7', lineHeight: '1.6' }}>
              {streamingActivity.toolName}
              {streamingActivity.toolDetail && (
                <span style={{ color: 'var(--text-tertiary)' }}> — {streamingActivity.toolDetail}</span>
              )}
            </span>
          ) : streamingActivity.status === 'thinking' ? (
            <span className="text-sm flex items-center gap-2" style={{ color: 'var(--text-tertiary)', lineHeight: '1.6' }}>
              <PulsingDots color="#a855f7" /> 思考中
            </span>
          ) : streamingActivity.status === 'replying' ? (
            <span className="text-sm flex items-center gap-2" style={{ color: 'var(--text-tertiary)', lineHeight: '1.6' }}>
              <PulsingDots color="#a855f7" /> 回應中
            </span>
          ) : null}
        </div>
      )}

      {/* AI messages */}
      {aiMessages.slice(-3).map(msg => (
        <div key={msg.id} className="text-sm mb-1.5 build-ai-output" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {msg.content.length > 500 ? msg.content.slice(-500) : msg.content}
          </ReactMarkdown>
        </div>
      ))}
    </div>
  );
}

// --- Main Panel ---

export default function BuildPanel() {
  const { close, buildState, setBuildState, resetBuild } = useBuildPanel();
  const {
    messages,
    isStreaming,
    streamingActivity,
    streamStatus,
    sendMessage,
    stopStreaming,
    error,
  } = useClaudeChat('dashboard', { ephemeral: true });

  const scrollRef = useRef<HTMLDivElement>(null);
  const [currentPhase, setCurrentPhase] = useState(0); // 0 = idle, 1-5 = phase number
  const [currentStep, setCurrentStep] = useState(-1); // current step index within phase

  // Detect phase and step from messages
  useEffect(() => {
    if (buildState !== 'running') return;
    const progress = detectProgress(messages);
    setCurrentPhase(progress.phase);
    setCurrentStep(progress.step);
  }, [messages, buildState]);

  // Detect completion or error
  useEffect(() => {
    if (buildState !== 'running') return;

    if (streamStatus === 'completed' && !isStreaming) {
      // Check if we reached Phase 5 (success) or if there was an error
      const phase = detectPhase(messages);
      if (phase >= 5) {
        setBuildState('done');
        setCurrentPhase(5);
      } else {
        // Stream completed but didn't finish all phases — could be partial or error
        const hasError = messages.some(m => m.isError);
        if (hasError) {
          setBuildState('error');
        } else {
          setBuildState('done');
        }
      }
    }

    if (streamStatus === 'error') {
      setBuildState('error');
    }
  }, [streamStatus, isStreaming, messages, buildState, setBuildState]);

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

  // Extract result summary from last assistant message
  const resultSummary = useMemo(() => {
    if (buildState !== 'done') return null;
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant' && m.content.trim());
    return lastAssistant?.content || null;
  }, [buildState, messages]);

  const handleStartBuild = async () => {
    setBuildState('running');
    setCurrentPhase(0);
    await sendMessage(BUILD_PROMPT, 'edit');
  };

  const handleReset = () => {
    resetBuild();
    setCurrentPhase(0);
  };

  return (
    <div
      className="h-full flex flex-col min-w-0"
      style={{
        border: '1.5px solid transparent',
        borderRadius: 6,
        padding: '8px 16px',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between py-4 mb-6 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-color)' }}>
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
            <button
              onClick={handleReset}
              className="h-9 px-4 rounded-md text-sm font-semibold transition-colors cursor-pointer hover:bg-white/10"
              style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
            >
              重新執行
            </button>
          )}
        </div>
        <button
          onClick={close}
          className="w-9 h-9 rounded-md flex items-center justify-center text-sm transition-colors hover:bg-white/10 shrink-0"
          style={{ color: 'var(--text-secondary)' }}
          title="關閉"
        >
          <i className="fa-solid fa-xmark" />
        </button>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-2">
        <div className="pb-8">
          {/* Phase 0: System startup */}
          {buildState === 'running' && currentPhase === 0 && (
            <div className="mb-5">
              <div className="flex items-center gap-2.5 mb-3">
                <i className="fa-solid fa-spinner fa-spin text-sm build-spinner-glow" style={{ color: '#f59e0b' }} />
                <span
                  className="text-sm font-semibold px-2 py-0.5 rounded"
                  style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b', lineHeight: '1.6' }}
                >
                  Phase 0
                </span>
                <span className="text-sm" style={{ color: 'var(--text-tertiary)', lineHeight: '1.6' }}>系統啟動</span>
              </div>
              <div className="pl-6 flex items-center gap-2.5 py-2">
                <i className="fa-solid fa-spinner fa-spin text-sm build-spinner-glow" style={{ color: '#f59e0b' }} />
                <span className="text-sm font-mono" style={{ color: '#f59e0b', lineHeight: '1.6' }}>系統準備中</span>
              </div>
            </div>
          )}

          {PHASES.map((phase, phaseIdx) => {
            const phaseStatus = finalStatuses[phaseIdx];
            const isAiPhase = phase.type === 'ai';
            const isActiveAiPhase = isAiPhase && phaseStatus === 'running';

            return (
              <div key={phase.phase} className={phaseIdx > 0 ? 'mt-5' : ''} data-phase={phaseIdx + 1}>

                <PhaseHeader phase={phase.phase} title={phase.title} type={phase.type} status={phaseStatus} />
                <div className="pl-6">
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

                  {/* Inline AI output for Phase 2/3 when active */}
                  {isActiveAiPhase && (
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
              className="mt-5 rounded-md px-4 py-3 text-sm"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', lineHeight: '1.6' }}
            >
              <i className="fa-regular fa-triangle-exclamation mr-1.5" />
              {error}
            </div>
          )}

          {/* Result summary */}
          {buildState === 'done' && resultSummary && (
            <div
              className="mt-5 rounded-md px-4 py-3"
              style={{ backgroundColor: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              <div className="text-sm font-medium mb-1.5" style={{ color: '#22c55e', lineHeight: '1.6' }}>
                <i className="fa-solid fa-circle-check mr-1.5" />
                Build 完成
              </div>
              <div className="text-sm build-ai-output" style={{ color: 'var(--text-secondary)', lineHeight: '1.6' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {resultSummary.trim()}
                </ReactMarkdown>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
