'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export type BuildState = 'idle' | 'running' | 'done' | 'error';

interface BuildPanelContextValue {
  open: boolean;
  toggle: () => void;
  close: () => void;
  buildState: BuildState;
  setBuildState: (state: BuildState) => void;
  resetBuild: () => void;
  startBuild: () => void;
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
  const [panelOpen, setPanelOpen] = useState(false);
  const [buildState, setBuildState] = useState<BuildState>('idle');

  // Toggle panel open/close (does NOT start build)
  const toggle = useCallback(() => {
    setPanelOpen(prev => !prev);
  }, []);

  // Close panel + reset build state
  const close = useCallback(() => {
    setPanelOpen(false);
    setBuildState('idle');
  }, []);

  // Start build (set running state, panel stays open)
  const startBuild = useCallback(() => {
    setBuildState('running');
  }, []);

  // Reset build state to idle (panel stays open)
  const resetBuild = useCallback(() => {
    setBuildState('idle');
  }, []);

  return (
    <BuildPanelContext.Provider value={{ open: panelOpen, toggle, close, buildState, setBuildState, resetBuild, startBuild }}>
      {children}
    </BuildPanelContext.Provider>
  );
}

export function useBuildPanel() {
  return useContext(BuildPanelContext);
}
