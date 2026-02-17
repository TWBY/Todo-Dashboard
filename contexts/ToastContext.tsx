'use client'

// Temporary placeholder - will be replaced with actual implementation

import { createContext, useContext, useState, useCallback, useRef } from 'react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastContextValue {
  toasts: Toast[]
  showToast: (message: string, type?: ToastType) => void
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  showToast: () => {},
})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counterRef = useRef(0)

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `toast-${++counterRef.current}`
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toasts, showToast }}>
      {children}
      {/* Toast container — fixed bottom-right */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" style={{ pointerEvents: 'none' }}>
          {toasts.map(toast => (
            <div
              key={toast.id}
              className="px-4 py-2 rounded-lg text-sm font-medium shadow-lg animate-fade-in"
              style={{
                pointerEvents: 'auto',
                backgroundColor: toast.type === 'error' ? 'rgba(220, 38, 38, 0.9)'
                  : toast.type === 'success' ? 'rgba(5, 150, 105, 0.9)'
                  : 'rgba(59, 130, 246, 0.9)',
                color: 'white',
              }}
            >
              {toast.message}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
