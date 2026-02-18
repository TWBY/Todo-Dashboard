'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { Project } from '@/lib/types';
import DevServerPanel from './DevServerPanel';
import ScratchPad from './ScratchPad';
import { ClaudeUsageBar, MemoryCpuBar } from './SystemStatusBar';
import ResizableLayout from './ResizableLayout';
import { ProcessKillButtons } from './MemoryWarningBanner';

function CdpStatusBadge() {
  const [active, setActive] = useState<boolean | null>(null)

  useEffect(() => {
    const check = () => {
      fetch('/api/cdp-status')
        .then(r => r.json())
        .then(d => setActive(d.active))
        .catch(() => setActive(false))
    }
    check()
    const id = setInterval(check, 10000)
    return () => clearInterval(id)
  }, [])

  if (active === null) return null

  return (
    <div
      className="flex-shrink-0 mt-3 px-3 py-1.5 rounded-lg flex items-center gap-2"
      style={{ backgroundColor: 'var(--background-secondary)' }}
      title={active ? 'Arc CDP 已連線（port 9222）' : 'Arc CDP 未連線 — 請執行：pkill -a Arc; open -a Arc --args --remote-debugging-port=9222'}
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: active ? '#4ade80' : '#ef4444' }}
      />
      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
        Arc CDP {active ? '已連線' : '未連線'}
      </span>
      {!active && (
        <i className="fa-solid fa-circle-info text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }} />
      )}
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
  );
}
