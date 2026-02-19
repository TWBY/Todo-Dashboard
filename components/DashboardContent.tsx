'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { Project } from '@/lib/types';
import DevServerPanel from './DevServerPanel';
import ScratchPad from './ScratchPad';
import ResizableLayout from './ResizableLayout';

const CDP_INTERVAL = 10

function CdpStatusBadge() {
  const [cdpActive, setCdpActive] = useState<boolean | null>(null)
  const [restarting, setRestarting] = useState(false)

  const checkStatus = useCallback(() => {
    fetch('/api/cdp-status')
      .then(r => r.json())
      .then(d => setCdpActive(d.portOpen && d.cdpResponding))
      .catch(() => setCdpActive(false))
  }, [])

  useEffect(() => {
    checkStatus()
    const pollId = setInterval(checkStatus, CDP_INTERVAL * 1000)
    return () => clearInterval(pollId)
  }, [checkStatus])

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

  if (cdpActive === null) return null

  return (
    <button
      onClick={() => handleRestart(!cdpActive)}
      disabled={restarting}
      className="flex-shrink-0 mt-3 mx-3 w-auto text-xs py-1.5 px-3 rounded-lg cursor-pointer transition-all"
      style={{
        backgroundColor: restarting ? 'var(--background-tertiary)' : cdpActive ? 'transparent' : 'var(--accent-color, #0184ff)',
        color: restarting ? 'var(--text-tertiary)' : cdpActive ? 'var(--text-secondary)' : '#fff',
        opacity: restarting ? 0.6 : 1,
        border: cdpActive ? '1px solid var(--border-color)' : 'none',
      }}
    >
      {restarting ? '重新啟動中...' : cdpActive ? '關閉 CDP' : '開啟 CDP'}
    </button>
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

        </div>
      }
    />

    </>
  );
}
