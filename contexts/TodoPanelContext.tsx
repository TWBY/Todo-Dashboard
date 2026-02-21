'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface TodoPanelContextValue {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const TodoPanelContext = createContext<TodoPanelContextValue>({
  open: false,
  toggle: () => {},
  close: () => {},
});

export function TodoPanelProvider({ children }: { children: ReactNode }) {
  const [panelOpen, setPanelOpen] = useState(false);

  const toggle = useCallback(() => {
    setPanelOpen(prev => !prev);
  }, []);

  const close = useCallback(() => {
    setPanelOpen(false);
  }, []);

  return (
    <TodoPanelContext.Provider value={{ open: panelOpen, toggle, close }}>
      {children}
    </TodoPanelContext.Provider>
  );
}

export function useTodoPanel() {
  return useContext(TodoPanelContext);
}
