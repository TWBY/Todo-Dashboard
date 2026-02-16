'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type BuildState = 'idle' | 'running' | 'done' | 'error';

interface BuildPanelContextValue {
  open: boolean; // deprecated, kept for backward compat
  toggle: () => void; // now triggers build start
  close: () => void;
  buildState: BuildState;
  setBuildState: (state: BuildState) => void;
  resetBuild: () => void;
  startBuild: () => void; // new: explicitly start build
}

const BuildPanelContext = createContext<BuildPanelContextValue>({
  open: false,
  toggle: () => {},
  close: () => {},
  buildState: 'idle',
  setBuildState: () => {},
  resetBuild: () => {},
  startBuild: () => {},
});

export function BuildPanelProvider({ children }: { children: ReactNode }) {
  const [buildState, setBuildState] = useState<BuildState>('idle');

  // Start build (show panel + set running state)
  const startBuild = useCallback(() => {
    setBuildState('running');
  }, []);

  // Toggle now means: start build if idle, otherwise do nothing
  const toggle = useCallback(() => {
    if (buildState === 'idle') {
      startBuild();
    }
  }, [buildState, startBuild]);

  // Close means: reset to idle (hide panel)
  const close = useCallback(() => setBuildState('idle'), []);

  // Reset means: go back to idle
  const resetBuild = useCallback(() => setBuildState('idle'), []);

  // For backward compat: compute "open" from buildState
  const open = buildState !== 'idle';

  return (
    <BuildPanelContext.Provider value={{ open, toggle, close, buildState, setBuildState, resetBuild, startBuild }}>
      {children}
    </BuildPanelContext.Provider>
  );
}

export function useBuildPanel() {
  return useContext(BuildPanelContext);
}
