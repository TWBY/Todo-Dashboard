'use client';

import { createContext, useContext, useState, useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { useClaudeChat } from '@/hooks/useClaudeChat';
import type { ChatMessage, StreamingActivity } from '@/lib/claude-chat-types';

export type BuildState = 'idle' | 'running' | 'done' | 'error';

// --- Phase detection (duplicated here to avoid circular imports) ---

type StepProgress = { phase: number; step: number };

interface PhaseData { phase: string; title: string; type: 'mechanical' | 'ai' }
export const PHASES: PhaseData[] = [
  { phase: 'Phase 1', title: '偵察', type: 'mechanical' },
  { phase: 'Phase 2', title: '智能 Commit', type: 'ai' },
  { phase: 'Phase 3', title: '版本判斷', type: 'ai' },
  { phase: 'Phase 4', title: '版本升級與打包', type: 'mechanical' },
  { phase: 'Phase 5', title: 'Release Commit', type: 'mechanical' },
];

function detectProgress(messages: ChatMessage[]): StepProgress {
  let currentPhase = 0;
  let currentStep = -1;
  const completedSteps = new Map<number, Set<number>>();

  for (const msg of messages) {
    if (msg.role !== 'tool' || !msg.toolName) continue;
    const desc = (msg.toolDescription || '').toLowerCase();
    const content = (msg.content || '').toLowerCase();

    if (msg.toolName === 'Bash') {
      if (desc.includes('git status') || content.includes('git status')) {
        currentPhase = 1;
        if (!completedSteps.has(1)) completedSteps.set(1, new Set());
        completedSteps.get(1)!.add(0); currentStep = 0;
      }
      if (desc.includes('git log') && (desc.includes('release:') || desc.includes('--grep'))) {
        currentPhase = 1;
        if (!completedSteps.has(1)) completedSteps.set(1, new Set());
        completedSteps.get(1)!.add(1); currentStep = 1;
      }
      if (desc.includes('git diff') || content.includes('git diff')) {
        currentPhase = 2;
        if (!completedSteps.has(2)) completedSteps.set(2, new Set());
        completedSteps.get(2)!.add(0); currentStep = 0;
      }
      if ((desc.includes('git add') || desc.includes('git commit')) && !desc.includes('release:') && !content.includes('release:')) {
        if (currentPhase < 4) {
          currentPhase = 2;
          if (!completedSteps.has(2)) completedSteps.set(2, new Set());
          completedSteps.get(2)!.add(2); currentStep = 2;
        }
      }
      if (desc.includes('..head') || content.includes('..head')) {
        currentPhase = 3;
        if (!completedSteps.has(3)) completedSteps.set(3, new Set());
        completedSteps.get(3)!.add(0); currentStep = 0;
      }
      if ((desc.includes('version.json') || content.includes('version.json')) && !desc.includes('git add')) {
        currentPhase = 4;
        if (!completedSteps.has(4)) completedSteps.set(4, new Set());
        completedSteps.get(4)!.add(0); currentStep = 0;
      }
      if (desc.includes('npm run build') || content.includes('npm run build')) {
        currentPhase = 4;
        if (!completedSteps.has(4)) completedSteps.set(4, new Set());
        completedSteps.get(4)!.add(1); currentStep = 1;
      }
      if (desc.includes('git add') && (desc.includes('version.json') || content.includes('version.json'))) {
        currentPhase = 5;
        if (!completedSteps.has(5)) completedSteps.set(5, new Set());
        completedSteps.get(5)!.add(0); currentStep = 0;
      }
      if ((desc.includes('release:') || content.includes('release:')) && (desc.includes('git commit') || content.includes('git commit'))) {
        currentPhase = 5;
        if (!completedSteps.has(5)) completedSteps.set(5, new Set());
        completedSteps.get(5)!.add(1); currentStep = 1;
      }
      if (desc.includes('bump dev') || content.includes('bump dev')) {
        currentPhase = 5;
        if (!completedSteps.has(5)) completedSteps.set(5, new Set());
        completedSteps.get(5)!.add(2); completedSteps.get(5)!.add(3); currentStep = 3;
      }
    }
  }

  return { phase: currentPhase, step: currentStep };
}

// --- Context interface ---

interface BuildPanelContextValue {
  // Panel open/close
  open: boolean;
  toggle: () => void;
  close: () => void;

  // Build lifecycle
  buildState: BuildState;
  setBuildState: (state: BuildState) => void;
  resetBuild: () => void;
  startBuild: () => void;

  // Chat state (hoisted here so BuildPanel survives unmount)
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingActivity: StreamingActivity | null;
  sendMessage: (msg: string, mode?: 'plan' | 'edit' | 'auto', images?: File[], modelOverride?: 'haiku' | 'sonnet' | 'opus') => Promise<void>;
  stopStreaming: () => void;
  error: string | null;

  // Phase progress (derived, shared with mini-widget on home screen)
  currentPhase: number;
  currentStep: number;
}

const BuildPanelContext = createContext<BuildPanelContextValue>({
  open: false,
  toggle: () => {},
  close: () => {},
  buildState: 'idle',
  setBuildState: () => {},
  resetBuild: () => {},
  startBuild: () => {},
  messages: [],
  isStreaming: false,
  streamingActivity: null,
  sendMessage: async () => {},
  stopStreaming: () => {},
  error: null,
  currentPhase: 0,
  currentStep: -1,
});

export function BuildPanelProvider({ children }: { children: ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [buildState, setBuildState] = useState<BuildState>('idle');
  const [currentPhase, setCurrentPhase] = useState(0);
  const [currentStep, setCurrentStep] = useState(-1);

  const {
    messages,
    isStreaming,
    streamingActivity,
    streamStatus,
    sendMessage,
    stopStreaming,
    error,
  } = useClaudeChat('dashboard', { ephemeral: true });

  // Detect phase progress from messages
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
      const phase = detectProgress(messages).phase;
      setBuildState(phase >= 5 ? 'done' : (messages.some(m => m.isError) ? 'error' : 'done'));
      if (phase >= 5) setCurrentPhase(5);
    }
    if (streamStatus === 'error') {
      setBuildState('error');
    }
  }, [streamStatus, isStreaming, messages, buildState]);

  const toggle = useCallback(() => setPanelOpen(prev => !prev), []);

  const close = useCallback(() => {
    setPanelOpen(false);
    // Do NOT reset buildState or stop streaming — let it keep running in background
  }, []);

  const startBuild = useCallback(() => setBuildState('running'), []);

  const resetBuild = useCallback(() => {
    setBuildState('idle');
    setCurrentPhase(0);
    setCurrentStep(-1);
  }, []);

  const value = useMemo(() => ({
    open: panelOpen,
    toggle,
    close,
    buildState,
    setBuildState,
    resetBuild,
    startBuild,
    messages,
    isStreaming,
    streamingActivity,
    sendMessage,
    stopStreaming,
    error,
    currentPhase,
    currentStep,
  }), [panelOpen, toggle, close, buildState, resetBuild, startBuild, messages, isStreaming, streamingActivity, sendMessage, stopStreaming, error, currentPhase, currentStep]);

  return (
    <BuildPanelContext.Provider value={value}>
      {children}
    </BuildPanelContext.Provider>
  );
}

export function useBuildPanel() {
  return useContext(BuildPanelContext);
}
