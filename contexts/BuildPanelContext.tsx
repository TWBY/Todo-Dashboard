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
}

const BuildPanelContext = createContext<BuildPanelContextValue>({
  open: false,
  toggle: () => {},
  close: () => {},
  buildState: 'idle',
  setBuildState: () => {},
  resetBuild: () => {},
});

export function BuildPanelProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [buildState, setBuildState] = useState<BuildState>('idle');
  const toggle = useCallback(() => setOpen(prev => !prev), []);
  const close = useCallback(() => setOpen(false), []);
  const resetBuild = useCallback(() => setBuildState('idle'), []);

  return (
    <BuildPanelContext.Provider value={{ open, toggle, close, buildState, setBuildState, resetBuild }}>
      {children}
    </BuildPanelContext.Provider>
  );
}

export function useBuildPanel() {
  return useContext(BuildPanelContext);
}
