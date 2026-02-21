'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface PortsPanelContextValue {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const PortsPanelContext = createContext<PortsPanelContextValue>({
  open: false,
  toggle: () => {},
  close: () => {},
});

export function PortsPanelProvider({ children }: { children: ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(false);

  const toggle = useCallback(() => {
    setPanelOpen(prev => !prev);
  }, []);

  const close = useCallback(() => {
    setPanelOpen(false);
  }, []);

  return (
    <PortsPanelContext.Provider value={{ open: panelOpen, toggle, close }}>
      {children}
    </PortsPanelContext.Provider>
  );
}

export function usePortsPanel() {
  return useContext(PortsPanelContext);
}
