import { useState, useEffect } from 'react'

export type TestStatus = 'pass' | 'fail' | 'skip' | null

export interface TestResult {
  status: TestStatus
  testedAt?: number
}

export interface TestResults {
  version: 1
  results: Record<string, TestResult>
}

const STORAGE_KEY = 'chat-lab:test-results'

function loadFromStorage(): TestResults {
  try {
    if (typeof window === 'undefined') return { version: 1, results: {} }
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return { version: 1, results: {} }
    return JSON.parse(stored) as TestResults
  } catch {
    return { version: 1, results: {} }
  }
}

function saveToStorage(data: TestResults) {
  try {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // 忽略 storage 錯誤（隱私模式等）
  }
}

export function useTestResults() {
  const [results, setResults] = useState<TestResults>(() => loadFromStorage())

  const setResult = (scenarioId: string, status: TestStatus) => {
    setResults(prev => {
      const next: TestResults = {
        version: 1,
        results: {
          ...prev.results,
          [scenarioId]: {
            status,
            testedAt: status ? Date.now() : undefined,
          },
        },
      }
      saveToStorage(next)
      return next
    })
  }

  const clearAll = () => {
    const empty: TestResults = { version: 1, results: {} }
    setResults(empty)
    saveToStorage(empty)
  }

  const getStats = () => {
    const values = Object.values(results.results)
    const tested = values.filter(v => v.status !== null)
    const passed = values.filter(v => v.status === 'pass')
    const failed = values.filter(v => v.status === 'fail')
    const skipped = values.filter(v => v.status === 'skip')

    return {
      total: Object.keys(results.results).length,
      tested: tested.length,
      passed: passed.length,
      failed: failed.length,
      skipped: skipped.length,
      passRate: tested.length > 0 ? Math.round((passed.length / tested.length) * 100) : 0,
    }
  }

  return { results, setResult, clearAll, getStats }
}
