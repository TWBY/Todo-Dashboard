'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface DocsPanelContextValue {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const DocsPanelContext = createContext<DocsPanelContextValue>({
  open: false,
  toggle: () => {},
  close: () => {},
});

export function DocsPanelProvider({ children }: { children: ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(false);

  const toggle = useCallback(() => {
    setPanelOpen(prev => !prev);
  }, []);

  const close = useCallback(() => {
    setPanelOpen(false);
  }, []);

  return (
    <DocsPanelContext.Provider value={{ open: panelOpen, toggle, close }}>
      {children}
    </DocsPanelContext.Provider>
  );
}

export function useDocsPanel() {
  return useContext(DocsPanelContext);
}
