'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Project } from '@/lib/types';
import DevServerPanel from './DevServerPanel';
import ScratchPad from './ScratchPad';
import { ClaudeUsageBar, MemoryCpuBar } from './SystemStatusBar';
import ResizableLayout from './ResizableLayout';
import { ProcessKillButtons } from './MemoryWarningBanner';

const CDP_INTERVAL = 10
const SDK_INTERVAL = 30

function CdpStatusBadge() {
  const [status, setStatus] = useState<{ portOpen: boolean; cdpResponding: boolean; browser: string | null } | null>(null)
  const [sdkOk, setSdkOk] = useState<boolean | null>(null)
  const [countdown, setCountdown] = useState(CDP_INTERVAL)
  const [restarting, setRestarting] = useState(false)

  const checkStatus = useCallback(() => {
    fetch('/api/cdp-status')
      .then(r => r.json())
      .then(d => setStatus({ portOpen: d.portOpen, cdpResponding: d.cdpResponding, browser: d.browser }))
      .catch(() => setStatus({ portOpen: false, cdpResponding: false, browser: null }))
    setCountdown(CDP_INTERVAL)
  }, [])

  useEffect(() => {
    checkStatus()
    const pollId = setInterval(checkStatus, CDP_INTERVAL * 1000)
    const tickId = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 0), 1000)
    return () => { clearInterval(pollId); clearInterval(tickId) }
  }, [checkStatus])

  useEffect(() => {
    const checkSdk = () => {
      fetch('/api/cdp-sdk-test')
        .then(r => r.json())
        .then(d => setSdkOk(d.ok))
        .catch(() => setSdkOk(false))
    }
    checkSdk()
    const id = setInterval(checkSdk, SDK_INTERVAL * 1000)
    return () => clearInterval(id)
  }, [])

  const handleRestart = useCallback((withCdp: boolean) => {
    setRestarting(true)
    fetch('/api/cdp-restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cdp: withCdp }),
    }).finally(() => {
      setTimeout(() => {
        setRestarting(false)
        checkStatus()
      }, 4000)
    })
  }, [checkStatus])

  if (status === null) return null

  const { portOpen, cdpResponding, browser } = status
  const cdpActive = portOpen && cdpResponding

  const Row = ({ ok, label, detail }: { ok: boolean | null; label: string; detail: string }) => (
    <div className="flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: ok === null ? '#6b7280' : ok ? '#4ade80' : '#ef4444' }} />
      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>{detail}</span>
    </div>
  )

  return (
    <div
      className="flex-shrink-0 mt-3 px-3 py-2 rounded-lg"
      style={{ backgroundColor: 'var(--background-secondary)' }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Arc CDP</span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)', opacity: 0.5 }}>{countdown}s</span>
      </div>
      <div className="flex flex-col gap-1">
        <Row ok={portOpen} label="Port 9222" detail={portOpen ? '監聽中' : '未開啟'} />
        <Row ok={cdpResponding} label="CDP 端點" detail={cdpResponding ? (browser?.split('/')[0] ?? '回應') : portOpen ? '無回應' : '—'} />
        <Row ok={sdkOk} label="SDK MCP" detail={sdkOk === null ? '測試中...' : sdkOk ? '可用' : '不可用'} />
      </div>
      <button
        onClick={() => handleRestart(!cdpActive)}
        disabled={restarting}
        className="mt-2 w-full text-xs py-1 px-2 rounded cursor-pointer"
        style={{
          backgroundColor: restarting ? 'var(--background-tertiary)' : cdpActive ? 'transparent' : 'var(--accent-color, #0184ff)',
          color: restarting ? 'var(--text-tertiary)' : cdpActive ? 'var(--text-secondary)' : '#fff',
          opacity: restarting ? 0.6 : 1,
          border: cdpActive ? '1px solid var(--border-color)' : 'none',
        }}
      >
        {restarting ? '重新啟動中...' : cdpActive ? '關閉 CDP 重啟' : '開啟 CDP 重啟'}
      </button>
    </div>
  )
}

// Client-safe version of flattenProjectsWithChildren
function flattenProjects(projects: Project[]): Project[] {
  const result: Project[] = [];
  for (const p of projects) {
    result.push(p);
    if (p.children) {
      for (const child of p.children) {
        if (child.devPort) {
          result.push({
            ...p,
            id: `${p.id}::${child.name}`,
            name: child.name,
            displayName: child.name,
            path: `${p.path}/${child.name}`,
            devPort: child.devPort,
            devAddedAt: child.devAddedAt,
          });
        }
      }
    }
  }
  return result;
}


export default function DashboardContent() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [courseFiles, setCourseFiles] = useState<Project[]>([]);
  const [utilityTools, setUtilityTools] = useState<Project[]>([]);

  useEffect(() => {
    fetch('/api/cities')
      .then(res => res.json())
      .then(json => {
        setProjects(json.projects ?? []);
        setCourseFiles(json.courseFiles ?? []);
        setUtilityTools(json.utilityTools ?? []);
      })
      .catch(console.error);
  }, []);

  const allProjects = useMemo(
    () => flattenProjects([...projects, ...courseFiles, ...utilityTools]),
    [projects, courseFiles, utilityTools]
  );

  const updateProject = useCallback((updatedProject: Project, category: 'projects' | 'courseFiles' | 'utilityTools') => {
    const setState = category === 'projects' ? setProjects : category === 'courseFiles' ? setCourseFiles : setUtilityTools;

    setState(prev => prev.map(p => {
      if (p.id === updatedProject.id) {
        return updatedProject;
      }
      if (p.children) {
        const updatedChildren = p.children.map(child => {
          if (child.name === updatedProject.name) {
            return { ...child, devPort: updatedProject.devPort };
          }
          return child;
        });
        if (JSON.stringify(updatedChildren) !== JSON.stringify(p.children)) {
          return { ...p, children: updatedChildren };
        }
      }
      return p;
    }));
  }, []);

  return (
    <>
    <ResizableLayout
      left={
        <div className="animate-fade-in flex flex-col h-full">
          {/* Quick Actions: ScratchPad */}
          <div className="flex-shrink-0 mb-3">
            <ScratchPad />
          </div>

          {/* Main: Dev Server panel (fills remaining space) */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <DevServerPanel projects={allProjects} onUpdate={updateProject} />
          </div>

          {/* Chat Test Lab 按鈕（僅 dev 環境） */}
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={() => router.push('/chat-test')}
              className="flex-shrink-0 mt-3 mx-3 flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition-colors"
              style={{
                backgroundColor: 'var(--background-secondary)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <i className="fa-solid fa-flask-vial" style={{ fontSize: '0.75rem' }} />
              <span>Chat Test Lab</span>
            </button>
          )}

          {/* CDP Status */}
          <CdpStatusBadge />

          {/* Bottom: Claude Usage + Memory/CPU Indicators (50/50 split) */}
          <div className="flex-shrink-0 mt-2 px-3 py-2 rounded-lg flex gap-4" style={{ backgroundColor: 'var(--background-secondary)' }}>
            {/* Left Column: Session + Memory */}
            <div style={{ flex: '0 0 50%' }}>
              <ClaudeUsageBar layout="session-only" />
              <MemoryCpuBar layout="memory-only" />
            </div>
            {/* Right Column: Weekly + CPU */}
            <div style={{ flex: '0 0 50%' }}>
              <ClaudeUsageBar layout="weekly-only" />
              <MemoryCpuBar layout="cpu-only" />
            </div>
          </div>

          {/* Process Kill Buttons */}
          <div className="flex-shrink-0 mt-3">
            <ProcessKillButtons />
          </div>
        </div>
      }
    />

    </>
  );
}
